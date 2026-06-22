import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EventSourceProvider } from "../../apps/web/lib/sources/provider";
import sampleTicketmasterEvent from "../fixtures/ticketmaster/sample-event.json";
import { mockProvider } from "../../apps/web/lib/sources/mockProvider";

function makeRawEvent(id: string, overrides: Record<string, unknown> = {}) {
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

async function importAggregatorQaWithProviders(
  providers: EventSourceProvider[],
  envOverrides: Record<string, boolean | string> = {},
  icsModule: Record<string, unknown> | null = null
) {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: {
      appName: "Event Scout",
      defaultCity: "Cincinnati",
      defaultRegion: "OH",
      defaultCountry: "USA",
      ticketmasterApiKey: "",
      meetupAccessToken: "",
      icsSourceUrls: "",
      enableMockProvider: true,
      enableCommunityMockProvider: true,
      enableTicketmasterProvider: false,
      enableMeetupProvider: false,
      enableIcsProvider: false,
      enableRssProvider: false,
      enableWebsiteProvider: false,
      enableSocialLeads: false,
      ...envOverrides
    }
  }));
  vi.doMock("@/lib/sources/registry", () => ({
    getEnabledProviders: () => providers
  }));
  if (icsModule) {
    vi.doMock("@/lib/sources/icsProvider", () => icsModule);
  }
  return import("../../apps/web/lib/events/aggregatorQa");
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
      icsSourceUrls: "",
      enableMockProvider: true,
      enableCommunityMockProvider: true,
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
      icsSourceUrls: "",
      enableMockProvider: true,
      enableCommunityMockProvider: true,
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

function fixtureText(name: string) {
  return readFileSync(new URL(`../fixtures/ics/${name}`, import.meta.url), "utf8");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("generateAggregatorQaReport", () => {
  it("reports invalid drops, duplicate groups, and provider failures", async () => {
    const healthyProviderA: EventSourceProvider = {
      sourceId: "mock-a",
      sourceName: "Mock A",
      sourceType: "mock",
      enabled: true,
      async fetchEvents() {
        return [
          {
            ...makeRawEvent("alpha-1", {
              title: "Builder Coffee Meetup",
              categories: ["tech", "business"]
            }),
            sourceId: "mock-a",
            sourceName: "Mock A",
            sourceUrl: "https://example.com/events/alpha-1"
          },
          {
            ...makeRawEvent("broken-1", {
              startDateTime: "not-a-date"
            }),
            sourceId: "mock-a",
            sourceName: "Mock A",
            sourceUrl: "https://example.com/events/broken-1"
          }
        ];
      }
    };
    const healthyProviderB: EventSourceProvider = {
      sourceId: "mock-b",
      sourceName: "Mock B",
      sourceType: "mock",
      enabled: true,
      async fetchEvents() {
        return [
          {
            ...makeRawEvent("alpha-2", {
              title: "Builder Coffee Meet-Up",
              categories: ["tech", "community"]
            }),
            sourceId: "mock-b",
            sourceName: "Mock B",
            sourceUrl: "https://example.com/events/alpha-2"
          }
        ];
      }
    };
    const failingProvider: EventSourceProvider = {
      sourceId: "broken-provider",
      sourceName: "Broken Provider",
      sourceType: "api",
      enabled: true,
      async fetchEvents() {
        throw new Error("upstream timeout");
      }
    };

    const { generateAggregatorQaReport } = await importAggregatorQaWithProviders([
      healthyProviderA,
      healthyProviderB,
      failingProvider
    ]);

    const report = await generateAggregatorQaReport({ city: "Cincinnati" });

    expect(report.enabledProviders).toHaveLength(3);
    expect(report.rawEventCount).toBe(3);
    expect(report.validNormalizedCount).toBe(2);
    expect(report.droppedInvalidCount).toBe(1);
    expect(report.dedupedCount).toBe(1);
    expect(report.finalCount).toBe(1);
    expect(report.duplicateGroups).toHaveLength(1);
    expect(report.duplicateGroups[0]?.size).toBe(2);
    expect(report.duplicateGroups[0]?.sourceNames).toEqual(["Mock A", "Mock B"]);
    expect(report.duplicateGroups[0]?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceName: "Mock A", sourceUrl: "https://example.com/events/alpha-1" }),
        expect.objectContaining({ sourceName: "Mock B", sourceUrl: "https://example.com/events/alpha-2" })
      ])
    );
    expect(report.enabledProviders.map((provider) => provider.sourceName)).toEqual(
      expect.arrayContaining(["Mock A", "Mock B", "Broken Provider"])
    );
    expect(report.enabledProviders.find((provider) => provider.sourceId === "mock-a")).toMatchObject({
      rawCount: 2,
      validCount: 1,
      droppedCount: 1,
      finalContributionCount: 1
    });
    expect(report.enabledProviders.find((provider) => provider.sourceId === "mock-b")).toMatchObject({
      rawCount: 1,
      validCount: 1,
      droppedCount: 0,
      finalContributionCount: 1
    });
    expect(report.events[0]?.originalSourcesCount).toBe(2);
    expect(report.events[0]?.originalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceName: "Mock A" }),
        expect.objectContaining({ sourceName: "Mock B" })
      ])
    );
    expect(report.warnings.some((warning) => warning.includes("Dropped invalid event"))).toBe(true);
    expect(report.errors).toContain("Provider fetch failed: upstream timeout");
  });

  it("warns when Ticketmaster is enabled without an API key", async () => {
    const { generateAggregatorQaReport } = await importAggregatorQaWithProviders(
      [mockProvider],
      {
        enableTicketmasterProvider: true,
        ticketmasterApiKey: ""
      }
    );

    const report = await generateAggregatorQaReport({ city: "Cincinnati" });

    expect(report.warnings.some((warning) => warning.includes("TICKETMASTER_API_KEY is missing"))).toBe(true);
  });

  it("includes Ticketmaster in provider counts and duplicate groups when enabled", async () => {
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
    const { generateAggregatorQaReport } = await importAggregatorQaWithProviders(
      [ticketmasterProvider, mockProvider],
      {
        enableTicketmasterProvider: true,
        ticketmasterApiKey: "test-key"
      }
    );

    const report = await generateAggregatorQaReport({ city: "Cincinnati" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(report.enabledProviders.some((provider) => provider.sourceId === "ticketmaster")).toBe(
      true
    );
    expect(report.enabledProviders.find((provider) => provider.sourceId === "ticketmaster")).toMatchObject({
      rawCount: 1,
      validCount: 1,
      droppedCount: 0,
      finalContributionCount: 1
    });
    expect(report.duplicateGroups.some((group) => group.sourceNames.includes("Ticketmaster"))).toBe(
      true
    );
    expect(
      report.duplicateGroups.some((group) =>
        group.sources.some((source) => source.sourceName === "Ticketmaster" && source.sourceUrl.includes("ticketmaster.com"))
      )
    ).toBe(true);
  });

  it("includes ICS provider counts and source links when enabled with fixtures", async () => {
    const duplicateProvider: EventSourceProvider = {
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
    const icsProvider: EventSourceProvider = {
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
              categories: ["tech", "networking", "community"],
              interests: ["community-guides", "newcomer-friendly"],
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

    const { generateAggregatorQaReport } = await importAggregatorQaWithProviders(
      [icsProvider, duplicateProvider],
      {
        enableIcsProvider: true,
        icsSourceUrls: "https://example.com/calendars/civic.ics"
      }
    );

    const report = await generateAggregatorQaReport({ city: "Cincinnati" });

    expect(report.enabledProviders.some((provider) => provider.sourceId === "ics")).toBe(true);
    expect(report.enabledProviders.find((provider) => provider.sourceId === "ics")).toMatchObject({
      rawCount: 2,
      validCount: 2,
      droppedCount: 0,
      finalContributionCount: 2
    });
    expect(report.duplicateGroups.some((group) => group.sourceNames.includes("ICS Calendar 1"))).toBe(
      true
    );
    expect(
      report.duplicateGroups.some((group) =>
        group.sources.some(
          (source) =>
            source.sourceName === "ICS Calendar 1" &&
            source.sourceUrl.includes("calendar.example.com")
        )
      )
    ).toBe(true);
    expect(report.events.some((event) => event.sourceName === "ICS Calendar 1")).toBe(true);
  });

  it("warns about skipped recurring ICS records", async () => {
    const diagnostics: Array<{ level: "warning" | "error"; message: string }> = [];
    const recurringIcsProvider: EventSourceProvider = {
      sourceId: "ics",
      sourceName: "ICS Calendar 1",
      sourceType: "ics",
      enabled: true,
      async fetchEvents() {
        diagnostics.push({
          level: "warning",
          message: "Skipped recurring ICS event Weekly Coding Meetup from ICS Calendar 1."
        });
        return [];
      }
    };

    const { generateAggregatorQaReport } = await importAggregatorQaWithProviders(
      [recurringIcsProvider],
      {
        enableIcsProvider: true,
        icsSourceUrls: "https://example.com/calendars/recurring.ics"
      },
      {
        consumeIcsProviderDiagnostics: () => [...diagnostics]
      }
    );

    const report = await generateAggregatorQaReport({ city: "Cincinnati" });

    expect(report.warnings.some((warning) => warning.includes("Skipped recurring ICS event"))).toBe(true);
  });
});
