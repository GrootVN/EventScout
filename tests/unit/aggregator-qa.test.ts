import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EventSourceProvider } from "../../apps/web/lib/sources/provider";
import sampleTicketmasterEvent from "../fixtures/ticketmaster/sample-event.json";
import meetupSampleResponse from "../fixtures/meetup/sample-events.json";
import meetupGraphqlErrorsResponse from "../fixtures/meetup/graphql-errors.json";
import { communityMockProvider } from "../../apps/web/lib/sources/communityMockProvider";
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
  icsModule: Record<string, unknown> | null = null,
  meetupModule: Record<string, unknown> | null = null,
  curatedModule: Record<string, unknown> | null = null,
  communityModule: Record<string, unknown> | null = null
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
      meetupGraphqlEndpoint: "https://api.meetup.com/gql",
      defaultCityPreset: "cincinnati",
      icsSourceUrls: "",
      rssSourceUrls: "",
      enableMockProvider: true,
      enableCommunityMockProvider: true,
      enableCommunitySubmissionsProvider: false,
      enableCityPresets: false,
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
  if (meetupModule) {
    vi.doMock("@/lib/sources/meetupProvider", () => meetupModule);
  }
  if (curatedModule) {
    vi.doMock("@/lib/sources/curatedProvider", () => curatedModule);
  }
  if (communityModule) {
    vi.doMock("@/lib/sources/communitySubmissionProvider", () => communityModule);
  }
  return import("../../apps/web/lib/events/aggregatorQa");
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
      enableCommunitySubmissionsProvider: false,
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
      enableCommunitySubmissionsProvider: false,
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
      enableCommunitySubmissionsProvider: false,
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

async function importMeetupProviderWithEnv(overrides: Record<string, boolean | string> = {}) {
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
      enableCommunitySubmissionsProvider: false,
      enableCityPresets: false,
      enableTicketmasterProvider: false,
      enableMeetupProvider: true,
      enableIcsProvider: false,
      enableRssProvider: false,
      enableWebsiteProvider: false,
      enableSocialLeads: false,
      ...overrides
    }
  }));

  return import("../../apps/web/lib/sources/meetupProvider");
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

  it("includes curated diagnostics, counts, and duplicate groups when enabled", async () => {
    const curatedModule = await importCuratedProviderWithEnv({
      enableCuratedProvider: true,
      curatedEventsPath: "apps/web/data/curated-events.json"
    });
    const { generateAggregatorQaReport } = await importAggregatorQaWithProviders(
      [curatedModule.curatedProvider, mockProvider],
      {
        enableCuratedProvider: true,
        curatedEventsPath: "apps/web/data/curated-events.json"
      },
      null,
      null,
      curatedModule
    );

    const report = await generateAggregatorQaReport({ city: "Cincinnati" });
    const curatedSummary = report.enabledProviders.find((provider) => provider.sourceId === "curated");

    expect(report.curatedProvider).toMatchObject({
      sourceId: "curated",
      sourceName: "Curated Admin Events",
      rawLoadedCount: 8,
      approvedCount: 5,
      pendingCount: 1,
      rejectedCount: 1,
      suppressedCount: 1,
      invalidCount: 0
    });
    expect(curatedSummary).toMatchObject({
      rawCount: 5,
      validCount: 5,
      droppedCount: 0,
      finalContributionCount: expect.any(Number),
      rawLoadedCount: 8,
      approvedCount: 5,
      pendingCount: 1,
      rejectedCount: 1,
      suppressedCount: 1,
      invalidCount: 0
    });
    expect(report.warnings.some((warning) => warning.includes("Skipped curated event"))).toBe(true);
    expect(report.duplicateGroups.some((group) => group.sourceNames.includes("Curated Admin Events"))).toBe(true);
    expect(report.events.some((event) => event.originalSources.some((source) => source.sourceId === "curated"))).toBe(true);
  });

  it("includes community submission diagnostics and duplicate groups when enabled", async () => {
    const communityDiagnostics = {
      totalSubmissions: 4,
      pendingCount: 1,
      approvedCount: 1,
      rejectedCount: 1,
      suppressedCount: 1,
      emittedRawEventCount: 1,
      invalidConversionCount: 0,
      warnings: [
        "Skipped 1 pending community submission.",
        "Skipped 1 rejected community submission.",
        "Skipped 1 suppressed community submission."
      ],
      errors: []
    };
    const communityModule = {
      communitySubmissionProvider: {
        sourceId: "community-submissions",
        sourceName: "Community Submissions",
        sourceType: "community",
        enabled: true,
        async fetchEvents() {
          return [
            {
              sourceId: "community-submissions",
              sourceName: "Community Submissions",
              sourceType: "community" as const,
              sourceEventId: "submission-tech-meetup",
              sourceUrl: "https://example.com/community/submissions/tech-meetup",
              fetchedAt: "2026-06-19T12:00:00.000Z",
              raw: {
                id: "submission-tech-meetup",
                title: "Cincinnati Tech Meetup at Rhinegeist",
                description: "A newcomer-friendly tech social with quick intros, demos, and brewery tables.",
                startDateTime: "2026-06-21T22:00:00.000Z",
                endDateTime: "2026-06-22T00:00:00.000Z",
                timezone: "America/New_York",
                venueName: "Rhinegeist Brewery",
                address: "1910 Elm St, Cincinnati, OH 45202",
                city: "Cincinnati",
                region: "OH",
                country: "USA",
                priceType: "free",
                minPrice: null,
                maxPrice: null,
                currency: "USD",
                sourceUrl: "https://example.com/community/submissions/tech-meetup",
                sourceName: "Community Submission",
                sourceEventId: "submission-tech-meetup",
                categories: ["tech", "networking", "business"],
                interests: ["newcomer-friendly", "solo-friendly"],
                confidence: 0.72,
                isNewcomerFriendly: true,
                isSoloFriendly: true,
                status: "approved"
              }
            }
          ];
        }
      },
      consumeCommunitySubmissionProviderDiagnostics: () => ({ ...communityDiagnostics })
    };

    const { generateAggregatorQaReport } = await importAggregatorQaWithProviders(
      [mockProvider, communityModule.communitySubmissionProvider],
      {
        enableCommunitySubmissionsProvider: true
      },
      null,
      null,
      null,
      communityModule
    );

    const report = await generateAggregatorQaReport({ city: "Cincinnati" });
    const communitySummary = report.enabledProviders.find(
      (provider) => provider.sourceId === "community-submissions"
    );

    expect(report.communitySubmissionsProvider).toMatchObject({
      sourceId: "community-submissions",
      sourceName: "Community Submissions",
      totalSubmissions: 4,
      pendingCount: 1,
      approvedCount: 1,
      rejectedCount: 1,
      suppressedCount: 1,
      emittedRawEventCount: 1,
      invalidConversionCount: 0
    });
    expect(communitySummary).toMatchObject({
      rawCount: 1,
      validCount: 1,
      droppedCount: 0,
      finalContributionCount: expect.any(Number),
      totalSubmissions: 4,
      emittedRawEventCount: 1,
      invalidConversionCount: 0
    });
    expect(communitySummary).toMatchObject({
      rawCount: 1,
      validCount: 1,
      droppedCount: 0,
      finalContributionCount: expect.any(Number),
      totalSubmissions: 4,
      emittedRawEventCount: 1,
      invalidConversionCount: 0
    });
    expect(report.warnings.some((warning) => warning.includes("community submission"))).toBe(true);
    expect(report.duplicateGroups.some((group) => group.sourceNames.includes("Community Submissions"))).toBe(true);
    expect(
      report.duplicateGroups.some((group) =>
        group.sources.some(
          (source) =>
            source.sourceName === "Community Submissions" &&
            source.sourceUrl === "https://example.com/community/submissions/tech-meetup"
        )
      )
    ).toBe(true);
    expect(
      report.events.some((event) => event.originalSources.some((source) => source.sourceId === "community-submissions"))
    ).toBe(true);
  });

  it("includes Meetup in provider counts and duplicate groups when enabled", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => meetupSampleResponse
    }));
    vi.stubGlobal("fetch", fetchMock);

    const meetupModule = await importMeetupProviderWithEnv();
    const { meetupProvider } = meetupModule;
    const { generateAggregatorQaReport } = await importAggregatorQaWithProviders(
      [meetupProvider, mockProvider, communityMockProvider],
      {
        enableMeetupProvider: true,
        meetupAccessToken: "test-token"
      },
      null,
      meetupModule
    );

    const report = await generateAggregatorQaReport({ city: "Cincinnati" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(report.enabledProviders.some((provider) => provider.sourceId === "meetup")).toBe(true);
    expect(report.enabledProviders.find((provider) => provider.sourceId === "meetup")).toMatchObject({
      rawCount: 5,
      validCount: 5,
      droppedCount: 0,
      finalContributionCount: 5
    });
    expect(report.duplicateGroups.some((group) => group.sourceNames.includes("Meetup"))).toBe(true);
    expect(
      report.duplicateGroups.some((group) =>
        group.sources.some(
          (source) =>
            source.sourceName === "Meetup" &&
            source.sourceUrl === "https://www.meetup.com/cincinnati-tech-meetup/events/meetup-tech-1"
        )
      )
    ).toBe(true);
  });

  it("surfaces Meetup GraphQL errors in the QA warnings and errors", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => meetupGraphqlErrorsResponse
    }));
    vi.stubGlobal("fetch", fetchMock);

    const meetupModule = await importMeetupProviderWithEnv();
    const { meetupProvider } = meetupModule;
    const { generateAggregatorQaReport } = await importAggregatorQaWithProviders(
      [meetupProvider],
      {
        enableMeetupProvider: true,
        meetupAccessToken: "test-token"
      },
      null,
      meetupModule
    );

    const report = await generateAggregatorQaReport({ city: "Cincinnati" });

    expect(report.errors.some((error) => error.includes("Access denied"))).toBe(true);
    expect(report.errors.some((error) => error.includes("Token expired"))).toBe(true);
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

  it("includes RSS provider counts, warnings, and source links when enabled with fixtures", async () => {
    const rssFixtureProvider: EventSourceProvider = {
      sourceId: "rss",
      sourceName: "RSS Feed",
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
              categories: ["community"],
              interests: ["community", "newcomer-friendly"],
              confidence: 0.78
            }
          },
          {
            sourceId: "rss",
            sourceName: "Downtown City Events",
            sourceType: "rss" as const,
            sourceEventId: "rss-2",
            sourceUrl: "",
            fetchedAt: "2026-06-19T12:00:00.000Z",
            raw: {
              id: "rss-2",
              title: "Volunteer Fair at the Park",
              description: "The feed includes a date, but no source URL.",
              startDateTime: "2026-06-24T18:00:00.000Z",
              endDateTime: null,
              timezone: "UTC",
              venueName: "Riverfront Park",
              address: "1 River Rd, Cincinnati, OH",
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
          },
          {
            sourceId: "rss",
            sourceName: "Downtown City Events",
            sourceType: "rss" as const,
            sourceEventId: "rss-3",
            sourceUrl: "",
            fetchedAt: "2026-06-19T12:00:00.000Z",
            raw: {
              id: "rss-3",
              title: "Sunset Concert Series",
              description: "The feed includes a source URL, but no date.",
              startDateTime: undefined,
              endDateTime: null,
              timezone: "UTC",
              venueName: "Riverfront Park",
              address: "1 River Rd, Cincinnati, OH",
              city: "Cincinnati",
              region: "OH",
              country: "USA",
              priceType: "unknown" as const,
              minPrice: null,
              maxPrice: null,
              currency: null,
              categories: ["music"],
              interests: ["music"]
            }
          }
        ];
      }
    };
    const duplicateProvider: EventSourceProvider = {
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

    const { generateAggregatorQaReport } = await importAggregatorQaWithProviders(
      [rssFixtureProvider, duplicateProvider]
    );

    const report = await generateAggregatorQaReport({ city: "Cincinnati" });

    expect(report.enabledProviders.some((provider) => provider.sourceId === "rss")).toBe(true);
    expect(report.enabledProviders.find((provider) => provider.sourceId === "rss")).toMatchObject({
      rawCount: 3,
      validCount: 1,
      droppedCount: 2,
      finalContributionCount: 1
    });
    expect(report.warnings.some((warning) => warning.includes("sourceUrl is required"))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes("clear event date"))).toBe(true);
    expect(report.duplicateGroups.some((group) => group.sourceNames.includes("Downtown City Events"))).toBe(
      true
    );
    expect(
      report.duplicateGroups.some((group) =>
        group.sources.some((source) => source.sourceName === "Downtown City Events")
      )
    ).toBe(true);
    expect(report.events.some((event) => event.sourceName === "Downtown City Events")).toBe(true);
  });

  it("includes city preset summary when presets are enabled", async () => {
    const { generateAggregatorQaReport, renderAggregatorQaHtml } = await importAggregatorQaWithProviders(
      [mockProvider],
      {
        enableCityPresets: true
      }
    );

    const report = await generateAggregatorQaReport({ city: "Cincinnati" });
    const html = renderAggregatorQaHtml(report);

    expect(report.cityPreset).toMatchObject({
      cityId: "cincinnati",
      cityName: "Cincinnati",
      region: "OH",
      country: "USA",
      defaultRadiusMiles: 25,
      icsSourceCount: 0,
      rssSourceCount: 0,
      ticketmasterEnabled: false
    });
    expect(html).toContain("City Preset");
    expect(html).toContain("Cincinnati");
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

  it("records source-run history when enabled during QA writes", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "eventscout-qa-history-"));
    const historyPath = path.join(tempDir, "source-run-history.json");
    const outputDir = path.join(tempDir, "qa-results");

    const { writeAggregatorQaReport } = await importAggregatorQaWithProviders(
      [mockProvider],
      {
        enableSourceRunHistory: true,
        sourceRunHistoryPath: historyPath
      }
    );

    const result = await writeAggregatorQaReport(outputDir);
    const history = JSON.parse(await readFile(historyPath, "utf8")) as {
      runs: Array<{ id: string; runType: string; overallStatus: string }>;
    };

    expect(result.report.warnings.some((warning) => warning.includes("source run history"))).toBe(false);
    expect(history.runs).toHaveLength(1);
    expect(history.runs[0]).toMatchObject({
      runType: "aggregator-qa",
      overallStatus: expect.any(String)
    });
  });

  it("does not append source-run history when disabled", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "eventscout-qa-history-off-"));
    const historyPath = path.join(tempDir, "source-run-history.json");
    const outputDir = path.join(tempDir, "qa-results");

    const { writeAggregatorQaReport } = await importAggregatorQaWithProviders([mockProvider], {
      enableSourceRunHistory: false,
      sourceRunHistoryPath: historyPath
    });

    await writeAggregatorQaReport(outputDir);

    await expect(readFile(historyPath, "utf8")).rejects.toThrow();
  });

  it("surfaces a warning but still completes when history append fails", async () => {
    const historyPath = mkdtempSync(path.join(tmpdir(), "eventscout-qa-history-fail-"));
    const outputDir = path.join(historyPath, "qa-results");

    const { writeAggregatorQaReport } = await importAggregatorQaWithProviders([mockProvider], {
      enableSourceRunHistory: true,
      sourceRunHistoryPath: historyPath
    });

    const result = await writeAggregatorQaReport(outputDir);

    expect(result.report.warnings.some((warning) => warning.toLowerCase().includes("source run history"))).toBe(
      true
    );
  });
});
