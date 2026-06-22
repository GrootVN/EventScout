import { afterEach, describe, expect, it, vi } from "vitest";

type EnvOverrides = Record<string, boolean | string>;

async function importRegistryWithEnv(overrides: EnvOverrides = {}) {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: {
      appName: "Event Scout",
      defaultCity: "Cincinnati",
      defaultRegion: "OH",
      defaultCountry: "USA",
      ticketmasterApiKey: "",
      meetupAccessToken: "",
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

  return import("../../apps/web/lib/sources/registry");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("provider registry", () => {
  it("keeps the base mock provider enabled by default", async () => {
    const { getEnabledProviders } = await importRegistryWithEnv();

    expect(getEnabledProviders().some((provider) => provider.sourceId === "mock")).toBe(true);
  });

  it("includes the community mock provider when enabled", async () => {
    const { getEnabledProviders } = await importRegistryWithEnv({
      enableCommunityMockProvider: true
    });

    expect(getEnabledProviders().some((provider) => provider.sourceId === "community-mock")).toBe(
      true
    );
  });

  it("excludes the community mock provider when disabled", async () => {
    const { getEnabledProviders } = await importRegistryWithEnv({
      enableCommunityMockProvider: false
    });

    expect(getEnabledProviders().some((provider) => provider.sourceId === "community-mock")).toBe(
      false
    );
  });

  it("excludes Ticketmaster by default", async () => {
    const { getEnabledProviders } = await importRegistryWithEnv();

    expect(getEnabledProviders().some((provider) => provider.sourceId === "ticketmaster")).toBe(
      false
    );
  });

  it("excludes ICS by default", async () => {
    const { getEnabledProviders } = await importRegistryWithEnv();

    expect(getEnabledProviders().some((provider) => provider.sourceId === "ics")).toBe(false);
  });

  it("excludes Ticketmaster when the API key is missing", async () => {
    const { getEnabledProviders } = await importRegistryWithEnv({
      enableTicketmasterProvider: true,
      ticketmasterApiKey: ""
    });

    expect(getEnabledProviders().some((provider) => provider.sourceId === "ticketmaster")).toBe(
      false
    );
  });

  it("includes Ticketmaster when the feature flag and API key are present", async () => {
    const { getEnabledProviders } = await importRegistryWithEnv({
      enableTicketmasterProvider: true,
      ticketmasterApiKey: "test-key"
    });

    expect(getEnabledProviders().some((provider) => provider.sourceId === "ticketmaster")).toBe(
      true
    );
  });

  it("includes ICS when the feature flag and source URLs are present", async () => {
    const { getEnabledProviders } = await importRegistryWithEnv({
      enableIcsProvider: true,
      icsSourceUrls: "https://example.com/calendars/civic.ics"
    });

    expect(getEnabledProviders().some((provider) => provider.sourceId === "ics")).toBe(true);
  });

  it("excludes ICS when the feature flag is enabled but the source list is empty", async () => {
    const { getEnabledProviders } = await importRegistryWithEnv({
      enableIcsProvider: true,
      icsSourceUrls: ""
    });

    expect(getEnabledProviders().some((provider) => provider.sourceId === "ics")).toBe(false);
  });

  it("includes RSS when the feature flag and source URLs are present", async () => {
    const { getEnabledProviders } = await importRegistryWithEnv({
      enableRssProvider: true,
      rssSourceUrls: "https://example.com/feeds/city.xml"
    });

    expect(getEnabledProviders().some((provider) => provider.sourceId === "rss")).toBe(true);
  });

  it("excludes RSS when the feature flag is enabled but the source list is empty", async () => {
    const { getEnabledProviders } = await importRegistryWithEnv({
      enableRssProvider: true,
      rssSourceUrls: ""
    });

    expect(getEnabledProviders().some((provider) => provider.sourceId === "rss")).toBe(false);
  });

  it("exposes unique provider IDs", async () => {
    const { getAllProviders } = await importRegistryWithEnv();
    const providerIds = getAllProviders().map((provider) => provider.sourceId);

    expect(new Set(providerIds).size).toBe(providerIds.length);
  });
});
