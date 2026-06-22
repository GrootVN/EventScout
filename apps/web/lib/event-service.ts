import { confidenceLabel, scoreEvent, type EventFacetResponse, type EventQuery, type EventRecord, type QueryContext, type TrustedSource } from "@eventscout/shared";
import { getEventRepository } from "@/lib/repository";

export type RankedEvent = EventRecord & {
  ranking: ReturnType<typeof scoreEvent>;
  confidence_label: ReturnType<typeof confidenceLabel>;
};

const REFERENCE_NOW = "2026-06-19T12:00:00.000Z";

function toRankingContext(query: EventQuery, interests: QueryContext["interestCategories"]): QueryContext {
  return {
    nowIso: REFERENCE_NOW,
    viewerLat: query.lat,
    viewerLng: query.lng,
    interestCategories: interests
  };
}

function toRankedEvent(event: EventRecord, query: EventQuery, interests: QueryContext["interestCategories"]): RankedEvent {
  const ranking = scoreEvent(event, toRankingContext(query, interests));
  return {
    ...event,
    ranking,
    confidence_label: confidenceLabel(ranking.confidenceScore)
  };
}

export async function getRankedEvents(query: EventQuery, interests: QueryContext["interestCategories"]) {
  const repository = getEventRepository();
  const events = await repository.getEvents(query);
  return events.map((event) => toRankedEvent(event, query, interests));
}

export async function getEventById(id: string) {
  const repository = getEventRepository();
  const event = await repository.getEventById(id);
  return event ? toRankedEvent(event, {}, []) : null;
}

export async function getFacets(query: EventQuery): Promise<EventFacetResponse> {
  return getEventRepository().getFacets(query);
}

export async function createFeedback(input: {
  event_id: string;
  type: "not_relevant" | "duplicate" | "wrong_location";
  note?: string;
}) {
  await getEventRepository().createFeedback(input);
}

export async function getFlaggedEvents() {
  return getEventRepository().getFlaggedEvents();
}

export async function getReviewQueue() {
  return getEventRepository().getReviewQueue();
}

export async function suppressEvent(eventId: string, note?: string) {
  await getEventRepository().suppressEvent(eventId, note);
}

export async function listTrustedSources(): Promise<TrustedSource[]> {
  return getEventRepository().listTrustedSources();
}

export async function upsertTrustedSource(input: {
  source_type: "domain" | "account" | "profile_url";
  source_value: string;
  source_family: import("@eventscout/shared").EventSourceFamily;
  notes?: string;
  active?: boolean;
}) {
  return getEventRepository().upsertTrustedSource(input);
}

export async function deactivateTrustedSource(id: string) {
  await getEventRepository().deactivateTrustedSource(id);
}
