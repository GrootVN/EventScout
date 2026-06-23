import { afterEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("curatedProvider", () => {
  it("is disabled by default", async () => {
    const { curatedProvider } = await importCuratedProviderWithEnv({
      enableCuratedProvider: false
    });

    expect(curatedProvider.enabled).toBe(false);
  });

  it("loads the default curated file and returns approved records only", async () => {
    const { curatedProvider, consumeCuratedProviderDiagnostics } = await importCuratedProviderWithEnv({
      enableCuratedProvider: true,
      curatedEventsPath: "apps/web/data/curated-events.json"
    });

    const rawEvents = await curatedProvider.fetchEvents({ city: "Cincinnati" });
    const diagnostics = consumeCuratedProviderDiagnostics();

    expect(rawEvents).toHaveLength(5);
    expect(rawEvents.every((event) => event.sourceId === "curated")).toBe(true);
    expect(rawEvents.every((event) => event.sourceType === "community")).toBe(true);
    expect(rawEvents.every((event) => event.sourceName.length > 0)).toBe(true);
    expect(diagnostics).toMatchObject({
      rawLoadedCount: 8,
      approvedCount: 5,
      pendingCount: 1,
      rejectedCount: 1,
      suppressedCount: 1,
      invalidCount: 0
    });
  });

  it("returns an empty list and diagnostics when the file is missing", async () => {
    const { curatedProvider, consumeCuratedProviderDiagnostics } = await importCuratedProviderWithEnv({
      enableCuratedProvider: true,
      curatedEventsPath: "tests/fixtures/curated/missing-file.json"
    });

    const rawEvents = await curatedProvider.fetchEvents({ city: "Cincinnati" });
    const diagnostics = consumeCuratedProviderDiagnostics();

    expect(rawEvents).toEqual([]);
    expect(diagnostics.errors.some((message) => message.includes("could not be read"))).toBe(true);
  });

  it("returns an empty list and diagnostics when JSON is invalid", async () => {
    const { curatedProvider, consumeCuratedProviderDiagnostics } = await importCuratedProviderWithEnv({
      enableCuratedProvider: true,
      curatedEventsPath: "tests/fixtures/curated/invalid-json.json"
    });

    const rawEvents = await curatedProvider.fetchEvents({ city: "Cincinnati" });
    const diagnostics = consumeCuratedProviderDiagnostics();

    expect(rawEvents).toEqual([]);
    expect(diagnostics.errors.some((message) => message.includes("could not be parsed"))).toBe(true);
  });

  it("drops invalid and non-approved records while counting them in diagnostics", async () => {
    const { curatedProvider, consumeCuratedProviderDiagnostics } = await importCuratedProviderWithEnv({
      enableCuratedProvider: true,
      curatedEventsPath: "tests/fixtures/curated/mixed-status-events.json"
    });

    const rawEvents = await curatedProvider.fetchEvents({ city: "Cincinnati" });
    const diagnostics = consumeCuratedProviderDiagnostics();

    expect(rawEvents).toHaveLength(5);
    expect(rawEvents.map((event) => event.sourceEventId)).toEqual(
      expect.arrayContaining([
        "curated-mixed-tech",
        "curated-mixed-coffee",
        "curated-mixed-brunch",
        "curated-mixed-picnic",
        "curated-mixed-gallery"
      ])
    );
    expect(rawEvents.some((event) => event.sourceEventId === "curated-mixed-pending")).toBe(false);
    expect(rawEvents.some((event) => event.sourceEventId === "curated-mixed-rejected")).toBe(false);
    expect(rawEvents.some((event) => event.sourceEventId === "curated-mixed-suppressed")).toBe(false);
    expect(diagnostics).toMatchObject({
      rawLoadedCount: 9,
      approvedCount: 5,
      pendingCount: 1,
      rejectedCount: 1,
      suppressedCount: 1,
      invalidCount: 1
    });
    expect(diagnostics.warnings.some((message) => message.includes("Skipped curated event"))).toBe(true);
    expect(diagnostics.warnings.some((message) => message.includes("Dropped invalid curated event"))).toBe(true);
  });
});
