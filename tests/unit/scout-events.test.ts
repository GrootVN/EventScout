import { afterEach, describe, expect, it, vi } from "vitest";
import { communityMockProvider } from "../../apps/web/lib/sources/communityMockProvider";
import { validateScoutEvent } from "../../apps/web/lib/events/schema";
import { dedupeEvents } from "../../apps/web/lib/events/dedupe";
import { normalizeRawEvent } from "../../apps/web/lib/events/normalize";
import { mockProvider } from "../../apps/web/lib/sources/mockProvider";
import type { EventSourceProvider } from "../../apps/web/lib/sources/provider";
import sampleTicketmasterEvent from "../fixtures/ticketmaster/sample-event.json";
import meetupSampleResponse from "../fixtures/meetup/sample-events.json";

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

async function importCuratedProviderWithEnv(overrides: Record<string, boolean | string> = {}) {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: {
      appName: "Event Scout",
      defaultCity: "Cincinnati",
      defaultRegion: "OH",
      defaultCountry: "USA",
      ticketmasterApiKey: "",
      meetupAccessToken: "",
      meetupGraphqlEndpoint: "https://api.meetup.com/gql",
      defaultCityPreset: "cincinnati",
      icsSourceUrls: "",
      rssSourceUrls: "",
      curatedEventsPath: "apps/web/data/curated-events.json",
      enableMockProvider: true,
      enableCommunityMockProvider: true,
      enableCuratedProvider: true,
      enableCityPresets: false,
      enableTicketmasterProvider: false,
      enableMeetupProvider: false,
      enableIcsProvider: false,
      enableRssProvider: false,
      enableWebsiteProvider: false,
      enableSocialLeads: false,
      ...overrides
    }
  }));

  return import("../../apps/web/lib/sources/curatedProvider");
}

async function importTicketmasterProviderWithEnv() {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: {
      appName: "Event Scout",
      defaultCity: "Cincinnati",
      defaultRegion: "OH",
      defaultCountry: "USA",
      ticketmasterApiKey: "test-key",
      meetupAccessToken: "",
      meetupGraphqlEndpoint: "https://api.meetup.com/gql",
      defaultCityPreset: "cincinnati",
      icsSourceUrls: "",
      rssSourceUrls: "",
      enableMockProvider: true,
      enableCommunityMockProvider: true,
      enableCityPresets: false,
      enableTicketmasterProvider: true,
      enableMeetupProvider: false,
      enableIcsProvider: false,
      enableRssProvider: false,
      enableWebsiteProvider: false,
      enableSocialLeads: false
    }
  }));

  return import("../../apps/web/lib/sources/ticketmasterProvider");
}

async function importMeetupProviderWithEnv() {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: {
      appName: "Event Scout",
      defaultCity: "Cincinnati",
      defaultRegion: "OH",
      defaultCountry: "USA",
      ticketmasterApiKey: "",
      meetupAccessToken: "test-token",
      meetupGraphqlEndpoint: "https://api.meetup.com/gql",
      defaultCityPreset: "cincinnati",
      icsSourceUrls: "",
      rssSourceUrls: "",
      enableMockProvider: true,
      enableCommunityMockProvider: true,
      enableCityPresets: false,
      enableTicketmasterProvider: false,
      enableMeetupProvider: true,
      enableIcsProvider: false,
      enableRssProvider: false,
      enableWebsiteProvider: false,
      enableSocialLeads: false
    }
  }));

  return import("../../apps/web/lib/sources/meetupProvider");
}

async function importIcsProviderWithEnv(overrides: Record<string, boolean | string> = {}) {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: {
      appName: "Event Scout",
      defaultCity: "Cincinnati",
      defaultRegion: "OH",
      defaultCountry: "USA",
      ticketmasterApiKey: "",
      meetupAccessToken: "",
      meetupGraphqlEndpoint: "https://api.meetup.com/gql",
      defaultCityPreset: "cincinnati",
      icsSourceUrls: "",
      rssSourceUrls: "",
      enableMockProvider: true,
      enableCommunityMockProvider: true,
      enableCityPresets: false,
      enableTicketmasterProvider: false,
      enableMeetupProvider: false,
      enableIcsProvider: false,
      enableRssProvider: false,
      enableWebsiteProvider: false,
      enableSocialLeads: false,
      ...overrides
    }
  }));

  return import("../../apps/web/lib/sources/icsProvider");
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

  it("aggregates both mock providers, merges duplicate groups, and keeps unique community events", async () => {
    const providers = [mockProvider, communityMockProvider];
    const rawEvents = (
      await Promise.all(providers.map((provider) => provider.fetchEvents({ city: "Cincinnati" })))
    ).flat();
    const normalizedRaw = rawEvents.map((rawEvent) => normalizeRawEvent(rawEvent));
    const dedupedRaw = dedupeEvents(normalizedRaw);

    const { scoutEvents } = await importScoutEventsWithProviders(providers);
    const events = await scoutEvents({ city: "Cincinnati" }, { interests: [], userCity: "Cincinnati" });

    expect(rawEvents.length).toBeGreaterThan(events.length);
    expect(events.length).toBe(dedupedRaw.length);

    const techMeetup = events.find((event) =>
      event.originalSources.some((source) => source.sourceId === "community-mock") &&
      event.originalSources.some((source) => source.sourceId === "mock") &&
      event.originalSources.length > 1
    );

    expect(techMeetup).toBeDefined();
    expect(techMeetup?.originalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceName: "Mock Local Radar" }),
        expect.objectContaining({ sourceName: "Community Calendar Mock" })
      ])
    );

    expect(events.some((event) => event.title === "Neighborhood Film on the Lawn")).toBe(true);
    expect(events.some((event) => event.title === "Volunteer River Cleanup Morning")).toBe(true);
  });

  it("includes curated approved events and merges curated duplicates with mock data", async () => {
    const { curatedProvider } = await importCuratedProviderWithEnv({
      enableCuratedProvider: true,
      curatedEventsPath: "apps/web/data/curated-events.json"
    });
    const providers = [curatedProvider, mockProvider];

    const { scoutEvents } = await importScoutEventsWithProviders(providers);
    const events = await scoutEvents({ city: "Cincinnati" }, { interests: [], userCity: "Cincinnati" });

    expect(events.some((event) => event.originalSources.some((source) => source.sourceId === "curated"))).toBe(true);

    const mergedEvent = events.find((event) =>
      event.originalSources.some((source) => source.sourceId === "curated") &&
      event.originalSources.some((source) => source.sourceId === "mock")
    );

    expect(mergedEvent).toBeDefined();
    expect(mergedEvent?.originalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceName: "Curated Admin Events" }),
        expect.objectContaining({ sourceName: "Mock Local Radar" })
      ])
    );
    expect(events.some((event) => event.originalSources.some((source) => source.sourceEventId === "curated-riverside-film-preview"))).toBe(false);
    expect(events.some((event) => event.originalSources.some((source) => source.sourceEventId === "curated-park-cleanup-rejected"))).toBe(false);
    expect(events.some((event) => event.originalSources.some((source) => source.sourceEventId === "curated-internal-draft-suppressed"))).toBe(false);
  });

  it("does not crash when the curated file is missing", async () => {
    const { curatedProvider } = await importCuratedProviderWithEnv({
      enableCuratedProvider: true,
      curatedEventsPath: "tests/fixtures/curated/missing-file.json"
    });
    const providers = [curatedProvider, mockProvider];

    const { scoutEvents } = await importScoutEventsWithProviders(providers);
    const events = await scoutEvents({ city: "Cincinnati" }, { interests: [], userCity: "Cincinnati" });

    expect(events.length).toBeGreaterThan(0);
    expect(events.some((event) => event.sourceId === "curated")).toBe(false);
  });

  it("works with Ticketmaster enabled and merges duplicate events from Ticketmaster and mock data", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        _embedded: {
          events: [sampleTicketmasterEvent]
        }
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { ticketmasterProvider } = await importTicketmasterProviderWithEnv();
    const providers = [ticketmasterProvider, mockProvider];

    const { scoutEvents } = await importScoutEventsWithProviders(providers);
    const events = await scoutEvents({ city: "Cincinnati" }, { interests: [], userCity: "Cincinnati" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events.length).toBeLessThanOrEqual(36);

    const mergedEvent = events.find((event) =>
      event.originalSources.some((source) => source.sourceId === "ticketmaster") &&
      event.originalSources.some((source) => source.sourceId === "mock")
    );

    expect(mergedEvent).toBeDefined();
    expect(mergedEvent?.originalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceName: "Ticketmaster" }),
        expect.objectContaining({ sourceName: "Mock Local Radar" })
      ])
    );
  });

  it("does not crash when Ticketmaster fails and the rest of aggregation still succeeds", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ticketmaster timeout");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { ticketmasterProvider } = await importTicketmasterProviderWithEnv();
    const providers = [ticketmasterProvider, mockProvider];

    const { scoutEvents } = await importScoutEventsWithProviders(providers);
    const events = await scoutEvents({ city: "Cincinnati" }, { interests: [], userCity: "Cincinnati" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((event) => event.sourceId === "ticketmaster")).toBe(false);
  });

  it("works with Meetup enabled using mocked GraphQL data and merges duplicates with mock data", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => meetupSampleResponse
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { meetupProvider } = await importMeetupProviderWithEnv();
    const providers = [meetupProvider, mockProvider, communityMockProvider];

    const { scoutEvents } = await importScoutEventsWithProviders(providers);
    const events = await scoutEvents({ city: "Cincinnati" }, { interests: [], userCity: "Cincinnati" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.sourceId === "meetup")).toBe(true);

    const mergedEvent = events.find((event) =>
      event.originalSources.some((source) => source.sourceId === "meetup") &&
      event.originalSources.some((source) => source.sourceId === "mock") &&
      event.originalSources.some((source) => source.sourceId === "community-mock")
    );

    expect(mergedEvent).toBeDefined();
    expect(mergedEvent?.originalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceName: "Meetup" }),
        expect.objectContaining({ sourceName: "Mock Local Radar" }),
        expect.objectContaining({ sourceName: "Community Calendar Mock" })
      ])
    );
  });

  it("works with ICS enabled using a fixture-backed source and merges duplicates with mock data", async () => {
    const duplicateMockProvider: EventSourceProvider = {
      sourceId: "mock-ics",
      sourceName: "Mock Calendar Mirror",
      sourceType: "mock",
      enabled: true,
      async fetchEvents() {
        return [
          {
            sourceId: "mock-ics",
            sourceName: "Mock Calendar Mirror",
            sourceType: "mock" as const,
            sourceEventId: "mock-ics-1",
            sourceUrl: "https://example.com/events/tech-meetup-library",
            fetchedAt: "2026-06-19T12:00:00.000Z",
            raw: {
              id: "mock-ics-1",
              title: "Cincinnati Tech Meetup at the Library",
              description: "A mirror listing for the same event.",
              startDateTime: "2026-06-21T22:00:00.000Z",
              endDateTime: "2026-06-22T00:00:00.000Z",
              timezone: "America/New_York",
              venueName: "Downtown Library",
              address: "800 Vine St, Cincinnati, OH 45202",
              city: "Cincinnati",
              region: "OH",
              country: "USA",
              priceType: "free" as const,
              minPrice: null,
              maxPrice: null,
              currency: "USD",
              categories: ["tech", "community"]
            }
          }
        ];
      }
    };
    const icsFixtureProvider: EventSourceProvider = {
      sourceId: "ics",
      sourceName: "ICS Calendar 1",
      sourceType: "ics",
      enabled: true,
      async fetchEvents() {
        return [
          {
            sourceId: "ics",
            sourceName: "ICS Calendar 1",
            sourceType: "ics" as const,
            sourceEventId: "ics-tech-1@example.com",
            sourceUrl: "https://calendar.example.com/events/tech-meetup-library",
            fetchedAt: "2026-06-19T12:00:00.000Z",
            raw: {
              uid: "ics-tech-1@example.com",
              summary: "Cincinnati Tech Meetup at the Library",
              description: "Join neighbors for demos, introductions, and coffee after work.",
              startDateTime: "2026-06-21T22:00:00.000Z",
              endDateTime: "2026-06-22T00:00:00.000Z",
              timezone: "America/New_York",
              location: "Downtown Library - 800 Vine St, Cincinnati, OH 45202",
              city: "Cincinnati",
              region: "OH",
              country: "USA",
              priceType: "free" as const,
              minPrice: null,
              maxPrice: null,
              currency: "USD",
              categories: ["tech", "networking"],
              interests: ["community-guides"],
              sourceCalendarUrl: "https://example.com/calendars/civic.ics",
              confidence: 0.88
            }
          },
          {
            sourceId: "ics",
            sourceName: "ICS Calendar 1",
            sourceType: "ics" as const,
            sourceEventId: "ics-film-1@example.com",
            sourceUrl: "https://example.com/calendars/civic.ics",
            fetchedAt: "2026-06-19T12:00:00.000Z",
            raw: {
              uid: "ics-film-1@example.com",
              summary: "Neighborhood Film Night",
              description: "Bring a blanket and enjoy a movie under the stars.",
              startDateTime: "2026-06-22T01:00:00.000Z",
              endDateTime: "2026-06-22T03:00:00.000Z",
              timezone: "America/New_York",
              location: "Washington Park | 1230 Elm St, Cincinnati, OH",
              city: "Cincinnati",
              region: "OH",
              country: "USA",
              priceType: "free" as const,
              minPrice: null,
              maxPrice: null,
              currency: "USD",
              categories: ["film", "community"],
              interests: ["community"],
              sourceCalendarUrl: "https://example.com/calendars/civic.ics",
              confidence: 0.82
            }
          }
        ];
      }
    };

    const { scoutEvents } = await importScoutEventsWithProviders([icsFixtureProvider, duplicateMockProvider]);
    const events = await scoutEvents({ city: "Cincinnati" }, { interests: [], userCity: "Cincinnati" });

    expect(events.some((event) => event.originalSources.some((source) => source.sourceId === "ics"))).toBe(true);
    const mergedEvent = events.find((event) =>
      event.originalSources.some((source) => source.sourceId === "ics") &&
      event.originalSources.some((source) => source.sourceId === "mock-ics")
    );
    expect(mergedEvent).toBeDefined();
    expect(mergedEvent?.originalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceName: "ICS Calendar 1" }),
        expect.objectContaining({ sourceName: "Mock Calendar Mirror" })
      ])
    );
  });

  it("drops malformed ICS records without crashing aggregation", async () => {
    const malformedIcsProvider: EventSourceProvider = {
      sourceId: "ics",
      sourceName: "ICS Calendar 1",
      sourceType: "ics",
      enabled: true,
      async fetchEvents() {
        return [
          {
            sourceId: "ics",
            sourceName: "ICS Calendar 1",
            sourceType: "ics" as const,
            sourceEventId: "broken-1@example.com",
            sourceUrl: "https://example.com/calendars/malformed.ics",
            fetchedAt: "2026-06-19T12:00:00.000Z",
            raw: {
              uid: "broken-1@example.com",
              summary: "Missing Date Event",
              location: "Unknown Venue - 123 Example St, Cincinnati, OH",
              city: "Cincinnati",
              region: "OH",
              country: "USA",
              categories: ["community"],
              sourceCalendarUrl: "https://example.com/calendars/malformed.ics",
              confidence: 0.82
            }
          }
        ];
      }
    };

    const { scoutEvents } = await importScoutEventsWithProviders([malformedIcsProvider, mockProvider]);
    const events = await scoutEvents({ city: "Cincinnati" }, { interests: [], userCity: "Cincinnati" });

    expect(events.some((event) => event.sourceId === "ics")).toBe(false);
    expect(events.some((event) => event.sourceId === "mock")).toBe(true);
  });

  it("works with RSS enabled using a fixture-backed source and merges duplicates with mock data", async () => {
    const rssFixtureProvider: EventSourceProvider = {
      sourceId: "rss",
      sourceName: "Downtown City Events",
      sourceType: "rss",
      enabled: true,
      async fetchEvents() {
        return [
          {
            sourceId: "rss",
            sourceName: "Downtown City Events",
            sourceType: "rss" as const,
            sourceEventId: "rss-1",
            sourceUrl: "https://example.com/events/welcome-coffee",
            fetchedAt: "2026-06-19T12:00:00.000Z",
            raw: {
              id: "rss-1",
              title: "Neighborhood Welcome Coffee",
              description: "A newcomer-friendly coffee hour.",
              startDateTime: "2026-06-23T22:30:00.000Z",
              endDateTime: "2026-06-23T23:30:00.000Z",
              timezone: "UTC",
              venueName: "Central Library",
              address: "800 Vine St, Cincinnati, OH 45202",
              city: "Cincinnati",
              region: "OH",
              country: "USA",
              priceType: "unknown" as const,
              minPrice: null,
              maxPrice: null,
              currency: null,
              categories: ["community", "newcomer-friendly"],
              interests: ["community", "newcomer-friendly"],
              confidence: 0.78,
              feedTitle: "Downtown City Events",
              sourceFeedUrl: "https://example.com/feeds/city.xml"
            }
          }
        ];
      }
    };
    const duplicateMockProvider: EventSourceProvider = {
      sourceId: "mock-rss",
      sourceName: "Mock Calendar Mirror",
      sourceType: "mock",
      enabled: true,
      async fetchEvents() {
        return [
          {
            sourceId: "mock-rss",
            sourceName: "Mock Calendar Mirror",
            sourceType: "mock" as const,
            sourceEventId: "mock-rss-1",
            sourceUrl: "https://example.com/events/welcome-coffee",
            fetchedAt: "2026-06-19T12:00:00.000Z",
            raw: {
              id: "mock-rss-1",
              title: "Neighborhood Welcome Coffee",
              description: "A mirror listing for the same event.",
              startDateTime: "2026-06-23T22:30:00.000Z",
              endDateTime: "2026-06-23T23:30:00.000Z",
              timezone: "UTC",
              venueName: "Central Library",
              address: "800 Vine St, Cincinnati, OH 45202",
              city: "Cincinnati",
              region: "OH",
              country: "USA",
              priceType: "unknown" as const,
              minPrice: null,
              maxPrice: null,
              currency: null,
              categories: ["community"],
              interests: ["community"]
            }
          }
        ];
      }
    };

    const { scoutEvents } = await importScoutEventsWithProviders([rssFixtureProvider, duplicateMockProvider]);
    const events = await scoutEvents({ city: "Cincinnati" }, { interests: [], userCity: "Cincinnati" });

    expect(events.some((event) => event.originalSources.some((source) => source.sourceId === "rss"))).toBe(true);
    const mergedEvent = events.find((event) =>
      event.originalSources.some((source) => source.sourceId === "rss") &&
      event.originalSources.some((source) => source.sourceId === "mock-rss")
    );
    expect(mergedEvent).toBeDefined();
    expect(mergedEvent?.originalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceName: "Downtown City Events" }),
        expect.objectContaining({ sourceName: "Mock Calendar Mirror" })
      ])
    );
  });
});
