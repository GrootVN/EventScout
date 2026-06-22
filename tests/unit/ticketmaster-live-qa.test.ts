import { afterEach, describe, expect, it, vi } from "vitest";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import sampleEvent from "../fixtures/ticketmaster/sample-event.json";

type EnvOverrides = Record<string, boolean | string>;

async function importLiveQaWithEnv(overrides: EnvOverrides = {}, providers: Array<{ sourceId: string }> = []) {
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
      rssSourceUrls: "",
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

  if (providers.length > 0) {
    vi.doMock("@/lib/sources/registry", () => ({
      getEnabledProviders: () => providers
    }));
  }

  return import("../../apps/web/lib/events/ticketmasterLiveQa");
}

async function importTicketmasterProviderWithEnv(overrides: EnvOverrides = {}) {
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
      rssSourceUrls: "",
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

  return import("../../apps/web/lib/sources/ticketmasterProvider");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("ticketmaster live qa", () => {
  it("rejects missing Ticketmaster configuration with a clear message", async () => {
    const { getTicketmasterLiveQaPreflight } = await importLiveQaWithEnv({
      enableTicketmasterProvider: false,
      ticketmasterApiKey: ""
    });

    expect(getTicketmasterLiveQaPreflight()).toEqual(
      expect.objectContaining({
        ok: false,
        message: expect.stringContaining("Ticketmaster live QA is disabled")
      })
    );
  });

  it("generates a live QA report with mocked Ticketmaster data", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        _embedded: {
          events: [sampleEvent]
        }
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { ticketmasterProvider } = await importTicketmasterProviderWithEnv({
      enableTicketmasterProvider: true,
      ticketmasterApiKey: "test-key"
    });
    const { generateTicketmasterLiveQaReport } = await importLiveQaWithEnv(
      {
        enableTicketmasterProvider: true,
        ticketmasterApiKey: "test-key"
      },
      [ticketmasterProvider]
    );

    const report = await generateTicketmasterLiveQaReport({
      city: "Cincinnati",
      region: "OH",
      country: "USA",
      keyword: "meetup"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(report.providerEnabled).toBe(true);
    expect(report.providerConfigured).toBe(true);
    expect(report.ticketmasterProvider).toMatchObject({
      rawCount: 1,
      validCount: 1,
      droppedCount: 0,
      finalContributionCount: 1
    });
    expect(report.events[0]).toMatchObject({
      title: "Cincinnati Tech Meetup at Rhinegeist",
      sourceUrl: "https://www.ticketmaster.com/cincinnati-tech-meetup-at-rhinegeist/event/123",
      imageUrl: "https://img.ticketmaster.com/large.jpg"
    });
    expect(report.query).toMatchObject({
      city: "Cincinnati",
      region: "OH",
      country: "USA",
      keyword: "meetup"
    });
  });

  it("writes HTML and JSON live QA artifacts", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        _embedded: {
          events: [sampleEvent]
        }
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { ticketmasterProvider } = await importTicketmasterProviderWithEnv({
      enableTicketmasterProvider: true,
      ticketmasterApiKey: "test-key"
    });
    const { writeTicketmasterLiveQaReport } = await importLiveQaWithEnv(
      {
        enableTicketmasterProvider: true,
        ticketmasterApiKey: "test-key"
      },
      [ticketmasterProvider]
    );

    const outputDir = path.join(os.tmpdir(), `eventscout-ticketmaster-live-${Date.now()}`);

    try {
      const result = await writeTicketmasterLiveQaReport(outputDir, {
        city: "Cincinnati"
      });

      expect(result.htmlPath).toContain("ticketmaster-live-report.html");
      expect(result.jsonPath).toContain("ticketmaster-live-report.json");
      expect(result.report.finalCount).toBe(1);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
