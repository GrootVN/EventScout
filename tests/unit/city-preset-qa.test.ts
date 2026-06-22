import { afterEach, describe, expect, it, vi } from "vitest";
import { cincinnatiCityPreset } from "../../apps/web/config/cities/cincinnati";

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
    cityPresetQaLiveFetch: false,
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

async function importCityPresetQaWithEnv(overrides: EnvOverrides = {}) {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: makeEnv(overrides)
  }));

  return import("../../apps/web/lib/events/cityPresetQa");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("cityPresetQa", () => {
  it("reports Cincinnati preset metadata without fetching remote URLs", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { generateCityPresetQaReport, renderCityPresetQaHtml } = await importCityPresetQaWithEnv({
      enableCityPresets: false,
      cityPresetQaLiveFetch: false
    });

    const report = await generateCityPresetQaReport();
    const html = renderCityPresetQaHtml(report);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(report.selectedCityPresetId).toBe("cincinnati");
    expect(report.selectedCityName).toBe("Cincinnati");
    expect(report.cityPresetsEnabled).toBe(false);
    expect(report.liveFetchEnabled).toBe(false);
    expect(report.totalConfiguredSources).toBe(7);
    expect(report.enabledSources).toBe(0);
    expect(report.disabledSources).toBe(7);
    expect(report.placeholderSources).toBe(6);
    expect(report.verifiedSources).toBe(0);
    expect(report.needsReviewSources).toBe(0);
    expect(report.sourceReports.every((source) => source.fetchStatus === "skipped")).toBe(true);
    expect(report.sourceReports.every((source) => source.parseStatus === "skipped")).toBe(true);
    expect(html).toContain("City Preset QA Report");
    expect(html).toContain("Cincinnati Public Library Calendar");
    expect(html).toContain("Placeholder Sources");
    expect(html).toContain("placeholder only");
    expect(html).toContain("Placeholder ICS URL only");
  });

  it("keeps live-fetch mode safe when all preset sources are disabled or placeholder-only", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { generateCityPresetQaReport } = await importCityPresetQaWithEnv({
      enableCityPresets: true,
      cityPresetQaLiveFetch: true
    });

    const report = await generateCityPresetQaReport();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(report.liveFetchEnabled).toBe(true);
    expect(report.sourceReports.every((source) => source.fetchStatus === "skipped")).toBe(true);
  });

  it("reports invalid source config instead of throwing", async () => {
    const badPreset = {
      ...cincinnatiCityPreset,
      cityId: "broken-city",
      cityName: "Broken City",
      sources: {
        ics: [
          {
            sourceId: "broken-ics",
            sourceName: "Broken ICS Calendar",
            url: "",
            enabled: true,
            status: "verified",
            notes: "Broken on purpose for validation coverage."
          }
        ],
        rss: [],
        ticketmaster: {
          enabled: false,
          status: "disabled",
          notes: "Disabled stub."
        }
      }
    };

    const { generateCityPresetQaReport } = await importCityPresetQaWithEnv({
      enableCityPresets: true,
      cityPresetQaLiveFetch: false
    });

    const report = await generateCityPresetQaReport({ preset: badPreset, presetId: "broken-city" });

    expect(report.selectedCityPresetId).toBe("broken-city");
    expect(report.selectedCityName).toBe("Broken City");
    expect(report.sourceReports).toHaveLength(2);
    expect(report.sourceReports[0]?.errors.some((error) => error.includes("missing or invalid"))).toBe(
      true
    );
    expect(report.sourceReports[0]?.recommendation).toBe("replace");
    expect(report.sourceReports[1]?.recommendation).toBe("disable");
  });
});
