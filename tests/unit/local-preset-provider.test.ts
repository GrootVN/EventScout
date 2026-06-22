import { afterEach, describe, expect, it, vi } from "vitest";
import { mockProvider } from "../../apps/web/lib/sources/mockProvider";

type EnvOverrides = Record<string, boolean | string>;

function makeEnv(overrides: EnvOverrides = {}) {
  return {
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
  };
}

async function importPresetModulesWithEnv(overrides: EnvOverrides = {}) {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: makeEnv(overrides)
  }));

  const localPresetProvider = await import("../../apps/web/lib/sources/localPresetProvider");
  const icsSources = await import("../../apps/web/config/ics-sources");
  const rssSources = await import("../../apps/web/config/rss-sources");
  return { localPresetProvider, icsSources, rssSources };
}

async function importAggregatorQaWithEnv(overrides: EnvOverrides = {}) {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: makeEnv(overrides)
  }));
  vi.doMock("@/lib/sources/registry", () => ({
    getEnabledProviders: () => [mockProvider]
  }));

  return import("../../apps/web/lib/events/aggregatorQa");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("local city presets", () => {
  it("loads the Cincinnati preset when city presets are enabled", async () => {
    const { localPresetProvider } = await importPresetModulesWithEnv({
      enableCityPresets: true
    });

    expect(localPresetProvider.isCityPresetsEnabled()).toBe(true);
    expect(localPresetProvider.getAvailableCityPresets()).toHaveLength(1);
    expect(localPresetProvider.getActiveCityPreset()).toMatchObject({
      cityId: "cincinnati",
      cityName: "Cincinnati",
      region: "OH",
      country: "USA",
      defaultRadiusMiles: 25
    });
    expect(
      localPresetProvider.getActiveCityPreset()?.sources.ics.every(
        (source) => source.status === "placeholder" && source.enabled === false && typeof source.notes === "string"
      )
    ).toBe(true);
    expect(
      localPresetProvider.getActiveCityPreset()?.sources.rss.every(
        (source) => source.status === "placeholder" && source.enabled === false && typeof source.notes === "string"
      )
    ).toBe(true);
    expect(localPresetProvider.getActiveCityPreset()?.sources.ticketmaster?.status).toBe("disabled");
  });

  it("keeps preset source IDs unique", async () => {
    const { localPresetProvider } = await importPresetModulesWithEnv({
      enableCityPresets: true
    });

    const preset = localPresetProvider.getActiveCityPreset();
    expect(preset).not.toBeNull();

    const sourceIds = [
      ...preset!.sources.ics.map((source) => source.sourceId),
      ...preset!.sources.rss.map((source) => source.sourceId)
    ];

    expect(new Set(sourceIds).size).toBe(sourceIds.length);
  });

  it("does not affect mock-only flow when city presets are disabled", async () => {
    const { localPresetProvider, icsSources, rssSources } = await importPresetModulesWithEnv({
      enableCityPresets: false
    });

    expect(localPresetProvider.getActiveCityPreset()).toBeNull();
    expect(icsSources.getIcsSourceConfigs()).toEqual([]);
    expect(rssSources.getRssSourceConfigs()).toEqual([]);
  });

  it("maps preset sources into ICS and RSS source configs", async () => {
    const { icsSources, rssSources } = await importPresetModulesWithEnv({
      enableCityPresets: true
    });

    const icsConfigs = icsSources.getIcsSourceConfigs();
    const rssConfigs = rssSources.getRssSourceConfigs();

    expect(icsConfigs).toEqual([]);
    expect(rssConfigs).toEqual([]);
  });

  it("shows preset grouping in the QA report", async () => {
    const { generateAggregatorQaReport, renderAggregatorQaHtml } = await importAggregatorQaWithEnv({
      enableCityPresets: true
    });

    const report = await generateAggregatorQaReport({ city: "Cincinnati" });
    const html = renderAggregatorQaHtml(report);

    expect(report.cityPreset).toMatchObject({
      cityId: "cincinnati",
      cityName: "Cincinnati",
      icsSourceCount: 0,
      rssSourceCount: 0,
      ticketmasterEnabled: false
    });
    expect(html).toContain("City Preset");
    expect(html).toContain("Cincinnati");
  });
});
