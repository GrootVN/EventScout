import {
  SourceAdapter,
  calculateConfidence,
  hasMandatoryFields,
  isExpired,
  isProbableDuplicate,
  isSpamLike,
  normalizeCandidate
} from "@eventscout/shared";
import { extractCandidateWithLocalLlm } from "../lib/extraction.js";
import { geocodeAddress } from "../lib/geocode.js";
import { logError, logInfo } from "../lib/logger.js";
import {
  findPotentialDuplicates,
  getActiveTrustedSources,
  insertEventCandidate,
  insertRejectedEvent,
  insertSourceObservation,
  upsertEvent
} from "../lib/persistence.js";
import { archiveRawPayload } from "../lib/raw-archive.js";
import { evaluateVerificationGate } from "../lib/verification.js";

export interface ProcessSourceInput {
  adapter: SourceAdapter;
  cursorOrIso: string;
}

export async function processSource({
  adapter,
  cursorOrIso
}: ProcessSourceInput): Promise<{
  ingested: number;
  rejected: number;
  observations: number;
  candidates: number;
}> {
  const launchMetroCity = (process.env.LAUNCH_METRO_CITY ?? "Cincinnati").toLowerCase();
  const launchMetroRegion = (process.env.LAUNCH_METRO_REGION ?? "OH").toLowerCase();
  const nowIso = new Date().toISOString();
  const rawEvents = await adapter.fetchSince(cursorOrIso);
  const trustedSources = await getActiveTrustedSources();

  let ingested = 0;
  let rejected = 0;
  let observations = 0;
  let candidates = 0;

  for (const raw of rawEvents) {
    try {
      const observationId = await insertSourceObservation({
        ...raw,
        source: adapter.source,
        source_family: adapter.sourceFamily
      });
      observations += 1;

      await archiveRawPayload(adapter.source, raw.source_event_id, raw.payload, {
        fetched_at: raw.fetched_at,
        source_url: raw.source_url,
        http_status: raw.http_status ?? null,
        parser_version: raw.parser_version ?? null
      });

      if (raw.requires_auth || raw.inaccessible_reason === "auth_required") {
        rejected += 1;
        await insertRejectedEvent("story_or_page_not_public", adapter.source, raw.payload);
        continue;
      }

      const normalizedByAdapter = adapter.normalize(raw);
      const extracted = normalizedByAdapter
        ? { candidate: normalizedByAdapter, confidence: 0.85, model: "adapter-normalizer" }
        : await extractCandidateWithLocalLlm(raw, {
            source: adapter.source,
            source_family: adapter.sourceFamily,
            city: process.env.LAUNCH_METRO_CITY ?? "Cincinnati",
            region: process.env.LAUNCH_METRO_REGION ?? "OH"
          });

      if (!extracted.candidate) {
        rejected += 1;
        await insertRejectedEvent("normalization_failed", adapter.source, raw.payload);
        continue;
      }

      let event = normalizeCandidate(extracted.candidate, nowIso);
      if (event.timezone !== "America/New_York") {
        event.timezone = "America/New_York";
      }

      if ((!event.lat || !event.lng) && event.address) {
        const geo = await geocodeAddress(event.address);
        if (geo) {
          event = { ...event, lat: geo.lat, lng: geo.lng };
        } else {
          event = {
            ...event,
            lat: Number(process.env.LAUNCH_METRO_DEFAULT_LAT ?? "39.1031"),
            lng: Number(process.env.LAUNCH_METRO_DEFAULT_LNG ?? "-84.512"),
            verification_reasons: [
              ...event.verification_reasons,
              "geocode fallback to metro center"
            ]
          };
        }
      }

      await insertEventCandidate({
        source_observation_id: observationId,
        source: event.source,
        source_family: event.source_family,
        source_url: event.source_url,
        source_event_id: event.source_event_id,
        title: event.title,
        description: event.description,
        start_time: event.start_time,
        end_time: event.end_time,
        timezone: event.timezone,
        venue_name: event.venue_name,
        organizer_name: extracted.candidate.organizer_name ?? null,
        address: event.address,
        lat: event.lat,
        lng: event.lng,
        city: event.city,
        region: event.region,
        categories: event.categories,
        price_type: event.price_type,
        extraction_confidence: extracted.confidence,
        extraction_model: extracted.model
      });
      candidates += 1;

      if (!hasMandatoryFields(event)) {
        rejected += 1;
        await insertRejectedEvent("missing_mandatory_fields", adapter.source, raw.payload);
        continue;
      }

      if (
        event.city.toLowerCase() !== launchMetroCity ||
        event.region.toLowerCase() !== launchMetroRegion
      ) {
        rejected += 1;
        await insertRejectedEvent("outside_launch_metro", adapter.source, raw.payload);
        continue;
      }

      if (isSpamLike(event)) {
        rejected += 1;
        await insertRejectedEvent("spam_like", adapter.source, raw.payload);
        continue;
      }

      if (isExpired(event, nowIso)) {
        rejected += 1;
        await insertRejectedEvent("expired_event", adapter.source, raw.payload);
        continue;
      }

      const duplicates = await findPotentialDuplicates({
        title: event.title,
        start_time: event.start_time,
        lat: event.lat,
        lng: event.lng
      });

      const duplicate = duplicates.find((candidateEvent) =>
        isProbableDuplicate({ ...candidateEvent }, { ...event, id: "temp" })
      );

      event.confidence_score = calculateConfidence({ ...event, id: "temp" });
      if (duplicate) {
        event.duplicate_of_event_id = duplicate.id;
        event.provenance_source_ids = [
          ...(duplicate.provenance_source_ids ?? []),
          event.source_event_id
        ];
      }

      const verification = evaluateVerificationGate({
        event: { ...event, id: "temp" },
        duplicateEvents: duplicate ? [duplicate] : [],
        trustedSources,
        extractionConfidence: extracted.confidence
      });

      event.publish_state = verification.publish_state;
      event.verification_count = verification.verification_count;
      event.verified_by_trusted_source = verification.verified_by_trusted_source;
      event.verification_reasons = verification.verification_reasons;
      if (verification.publish_state === "published") {
        event.confidence_score = Math.min(1, event.confidence_score + 0.1);
      }

      await upsertEvent({ ...event, id: "temp" });
      ingested += 1;
    } catch (error) {
      rejected += 1;
      logError(`Failed to ingest record from ${adapter.source}`, error);
      await insertRejectedEvent("unhandled_error", adapter.source, raw.payload);
    }
  }

  logInfo(`Processed source ${adapter.source}`, { ingested, rejected, observations, candidates });
  return { ingested, rejected, observations, candidates };
}
