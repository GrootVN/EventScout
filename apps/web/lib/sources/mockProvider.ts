import { MOCK_EVENT_SEEDS } from "@/data/mock-events";
import type { RawEvent } from "@/lib/events/types";
import { env } from "@/lib/config/env";
import type { EventSourceProvider, FetchEventsInput } from "./provider";

async function fetchMockEvents(input: FetchEventsInput): Promise<RawEvent[]> {
  return MOCK_EVENT_SEEDS.filter((seed) => seed.city.toLowerCase() === input.city.toLowerCase()).map((seed) => ({
    sourceId: seed.sourceId,
    sourceName: seed.sourceName,
    sourceType: seed.sourceType,
    sourceEventId: seed.sourceEventId,
    sourceUrl: seed.sourceUrl,
    fetchedAt: new Date("2026-06-19T12:00:00.000Z").toISOString(),
    raw: seed
  }));
}

export const mockProvider: EventSourceProvider = {
  sourceId: "mock",
  sourceName: "Mock Local Radar",
  sourceType: "mock",
  enabled: env.enableMockProvider,
  fetchEvents: fetchMockEvents
};
