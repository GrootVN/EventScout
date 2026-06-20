import { filterEvents } from "./filters";
import { normalizeRawEvent } from "./normalize";
import { rankEvents } from "./ranking";
import type { EventFilters, RankingInput, ScoutEvent } from "./types";
import { dedupeEvents } from "./dedupe";
import { getEnabledProviders } from "@/lib/sources/registry";
import type { FetchEventsInput } from "@/lib/sources/provider";

async function fetchAllProviderEvents(input: FetchEventsInput) {
  const providers = getEnabledProviders();
  const settled = await Promise.allSettled(
    providers.map(async (provider) => provider.fetchEvents(input))
  );

  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

export async function scoutEvents(filters: EventFilters, rankingInput: RankingInput) {
  const rawEvents = await fetchAllProviderEvents({
    city: filters.city ?? rankingInput.userCity ?? "Cincinnati",
    startDate: filters.startDate,
    endDate: filters.endDate,
    interests: filters.interests,
    keyword: filters.keyword
  });

  const normalized = rawEvents.map(normalizeRawEvent);
  const deduped = dedupeEvents(normalized);
  const filtered = filterEvents(deduped, filters);
  return rankEvents(filtered, rankingInput);
}

export async function getEventById(id: string) {
  const events = await scoutEvents(
    { city: "Cincinnati" },
    { interests: [], userCity: "Cincinnati" }
  );
  return events.find((event) => event.id === id) ?? null;
}

export async function listSourceSummaries() {
  const { getAllProviders } = await import("@/lib/sources/registry");
  return getAllProviders().map((provider) => ({
    sourceId: provider.sourceId,
    sourceName: provider.sourceName,
    sourceType: provider.sourceType,
    enabled: provider.enabled
  }));
}

export function toPlainEvent(event: ScoutEvent) {
  return {
    ...event,
    originalSources: event.originalSources
  };
}
