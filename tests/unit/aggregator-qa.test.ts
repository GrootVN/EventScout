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
  envOverrides: Record<string, boolean | string> = {}
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
      enableMockProvider: true,
      enableCommunityMockProvider: true,
      enableTicketmasterProvider: false,
      enableMeetupProvider: false,
      enableRssProvider: false,
      enableWebsiteProvider: false,
      enableSocialLeads: false,
      ...envOverrides
    }
  }));
  vi.doMock("@/lib/sources/registry", () => ({
    getEnabledProviders: () => providers
  }));
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
      enableMockProvider: true,
      enableCommunityMockProvider: true,
      enableTicketmasterProvider: true,
      enableMeetupProvider: false,
      enableRssProvider: false,
      enableWebsiteProvider: false,
      enableSocialLeads: false
    }
  }));

  return import("../../apps/web/lib/sources/ticketmasterProvider");
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
});
