import { afterEach, describe, expect, it, vi } from "vitest";
import { validateScoutEvent } from "../../apps/web/lib/events/schema";
import type { EventSourceProvider } from "../../apps/web/lib/sources/provider";

function makeProviderEvent(id: string, overrides: Record<string, unknown> = {}) {
  return {
    sourceId: "mock",
    sourceName: "Mock Source",
    sourceType: "mock" as const,
    sourceEventId: id,
    sourceUrl: `https://example.com/events/${id}`,
    fetchedAt: "2026-06-19T12:00:00.000Z",
    raw: {
      id,
      title: `Event ${id}`,
      description: "A valid event",
      startDateTime: "2026-06-20T20:00:00.000Z",
      endDateTime: "2026-06-20T22:00:00.000Z",
      timezone: "America/New_York",
      venueName: "Union Hall",
      address: "1311 Vine St",
      city: "Cincinnati",
      region: "OH",
      country: "USA",
      neighborhood: "Over-the-Rhine",
      latitude: 39.1114,
      longitude: -84.5152,
      priceType: "free" as const,
      minPrice: null,
      maxPrice: null,
      currency: "USD",
      imageUrl: null,
      categories: ["tech"],
      ...overrides
    }
  };
}

async function importScoutEventsWithProviders(providers: EventSourceProvider[]) {
  vi.resetModules();
  vi.doMock("@/lib/sources/registry", () => ({
    getEnabledProviders: () => providers
  }));
  return import("../../apps/web/lib/events/service");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("scoutEvents", () => {
  it("returns only schema-valid normalized events", async () => {
    const provider: EventSourceProvider = {
      sourceId: "mock",
      sourceName: "Mock Source",
      sourceType: "mock",
      enabled: true,
      async fetchEvents() {
        return [makeProviderEvent("valid-1")];
      }
    };

    const { scoutEvents } = await importScoutEventsWithProviders([provider]);
    const events = await scoutEvents({ city: "Cincinnati" }, { interests: [], userCity: "Cincinnati" });

    expect(events.length).toBe(1);
    expect(validateScoutEvent(events[0]!)).toEqual([]);
  });

  it("requires source attribution on every returned event", async () => {
    const provider: EventSourceProvider = {
      sourceId: "mock",
      sourceName: "Mock Source",
      sourceType: "mock",
      enabled: true,
      async fetchEvents() {
        return [makeProviderEvent("valid-2")];
      }
    };

    const { scoutEvents } = await importScoutEventsWithProviders([provider]);
    const events = await scoutEvents({ city: "Cincinnati" }, { interests: [], userCity: "Cincinnati" });

    expect(events.every((event) => event.originalSources.length > 0)).toBe(true);
    expect(events.every((event) => event.originalSources.every((source) => source.sourceUrl.length > 0))).toBe(true);
  });

  it("does not crash when one provider fails", async () => {
    const failingProvider: EventSourceProvider = {
      sourceId: "bad",
      sourceName: "Broken Source",
      sourceType: "api",
      enabled: true,
      async fetchEvents() {
        throw new Error("provider failed");
      }
    };
    const healthyProvider: EventSourceProvider = {
      sourceId: "mock",
      sourceName: "Mock Source",
      sourceType: "mock",
      enabled: true,
      async fetchEvents() {
        return [makeProviderEvent("valid-3")];
      }
    };

    const { scoutEvents } = await importScoutEventsWithProviders([failingProvider, healthyProvider]);
    const events = await scoutEvents({ city: "Cincinnati" }, { interests: [], userCity: "Cincinnati" });

    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("valid-3");
  });

  it("aggregates events from multiple providers into one result set", async () => {
    const providerA: EventSourceProvider = {
      sourceId: "mock-a",
      sourceName: "Mock A",
      sourceType: "mock",
      enabled: true,
      async fetchEvents() {
        return [makeProviderEvent("a-1", { title: "Alpha Builder Meetup" })];
      }
    };
    const providerB: EventSourceProvider = {
      sourceId: "mock-b",
      sourceName: "Mock B",
      sourceType: "mock",
      enabled: true,
      async fetchEvents() {
        return [makeProviderEvent("b-1", { title: "Beta Coffee Meetup" })];
      }
    };

    const { scoutEvents } = await importScoutEventsWithProviders([providerA, providerB]);
    const events = await scoutEvents({ city: "Cincinnati" }, { interests: [], userCity: "Cincinnati" });

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.title).sort()).toEqual([
      "Alpha Builder Meetup",
      "Beta Coffee Meetup"
    ]);
  });
});
