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
      enableMockProvider: true,
      enableCommunityMockProvider: true,
      enableTicketmasterProvider: false,
      enableMeetupProvider: false,
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

  it("exposes unique provider IDs", async () => {
    const { getAllProviders } = await importRegistryWithEnv();
    const providerIds = getAllProviders().map((provider) => provider.sourceId);

    expect(new Set(providerIds).size).toBe(providerIds.length);
  });
});
