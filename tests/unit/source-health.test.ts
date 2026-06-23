import { afterEach, describe, expect, it, vi } from "vitest";

async function importHealthWithMocks() {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: {
      adminToken: "secret",
      enableMockProvider: true,
      enableCommunityMockProvider: false,
      enableCuratedProvider: true,
      enableCommunitySubmissionsProvider: true,
      enableTicketmasterProvider: true,
      enableMeetupProvider: false,
      enableIcsProvider: false,
      enableRssProvider: true,
      enableWebsiteProvider: false,
      enableSocialLeads: false,
      ticketmasterApiKey: "",
      meetupAccessToken: "",
      meetupGraphqlEndpoint: "https://api.meetup.com/gql",
      defaultCity: "Cincinnati",
      defaultRegion: "OH",
      defaultCountry: "USA",
      defaultCityPreset: "cincinnati",
      icsSourceUrls: "",
      rssSourceUrls: "https://example.com/feed.xml",
      curatedEventsPath: "apps/web/data/curated-events.json"
    }
  }));
  vi.doMock("@/lib/sources/registry", () => ({
    getAllProviders: () => [
      {
        sourceId: "mock",
        sourceName: "Mock Local Radar",
        sourceType: "mock",
        enabled: true
      },
      {
        sourceId: "curated",
        sourceName: "Curated Admin Events",
        sourceType: "community",
        enabled: true
      },
      {
        sourceId: "community-submissions",
        sourceName: "Community Submissions",
        sourceType: "community",
        enabled: true
      },
      {
        sourceId: "ticketmaster",
        sourceName: "Ticketmaster",
        sourceType: "api",
        enabled: false
      },
      {
        sourceId: "rss",
        sourceName: "RSS Feed",
        sourceType: "rss",
        enabled: true
      },
      {
        sourceId: "social",
        sourceName: "Social Leads",
        sourceType: "social",
        enabled: false
      }
    ]
  }));
  vi.doMock("@/config/ics-sources", () => ({
    getIcsSourceConfigs: () => []
  }));
  vi.doMock("@/config/rss-sources", () => ({
    getRssSourceConfigs: () => [{ sourceId: "rss-1", sourceName: "RSS Feed 1", url: "https://example.com/feed.xml" }]
  }));
  vi.doMock("@/lib/sources/curatedProvider", () => ({
    snapshotCuratedProviderDiagnostics: () => ({
      rawLoadedCount: 2,
      approvedCount: 1,
      pendingCount: 1,
      rejectedCount: 0,
      suppressedCount: 0,
      invalidCount: 0,
      warnings: ["Skipped curated event curated-2 because its status is pending."],
      errors: []
    })
  }));
  vi.doMock("@/lib/sources/communitySubmissionProvider", () => ({
    snapshotCommunitySubmissionProviderDiagnostics: () => ({
      totalSubmissions: 2,
      pendingCount: 1,
      approvedCount: 1,
      rejectedCount: 0,
      suppressedCount: 0,
      emittedRawEventCount: 1,
      invalidConversionCount: 0,
      warnings: ["Skipped 1 pending community submission."],
      errors: []
    })
  }));
  vi.doMock("@/lib/sources/ticketmasterProvider", () => ({
    snapshotTicketmasterProviderDiagnostics: () => []
  }));
  vi.doMock("@/lib/sources/meetupProvider", () => ({
    snapshotMeetupProviderDiagnostics: () => []
  }));
  vi.doMock("@/lib/sources/icsProvider", () => ({
    snapshotIcsProviderDiagnostics: () => []
  }));
  vi.doMock("@/lib/sources/rssProvider", () => ({
    snapshotRssProviderDiagnostics: () => [
      { level: "warning" as const, message: "RSS source RSS Feed 1: missing event date." }
    ]
  }));

  return import("../../apps/web/lib/sources/health");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("source health report", () => {
  it("distinguishes ready, warning, needs-config, and disabled providers", async () => {
    const { getSourceHealthReport } = await importHealthWithMocks();
    const report = getSourceHealthReport();

    expect(report.config.adminTokenConfigured).toBe(true);
    expect(report.config.rssSourceCount).toBe(1);
    expect(report.totals).toMatchObject({
      providerCount: 6,
      enabledProviderCount: 4,
      readyProviderCount: 3,
      warningProviderCount: 1,
      errorProviderCount: 0,
      needsConfigProviderCount: 1,
      disabledProviderCount: 1
    });

    expect(report.providers.find((provider) => provider.sourceId === "mock")).toMatchObject({
      status: "ready",
      enabled: true
    });
    expect(report.providers.find((provider) => provider.sourceId === "curated")).toMatchObject({
      status: "ready",
      counters: expect.objectContaining({
        rawLoadedCount: 2,
        approvedCount: 1,
        pendingCount: 1
      })
    });
    expect(report.providers.find((provider) => provider.sourceId === "community-submissions")).toMatchObject({
      status: "ready",
      counters: expect.objectContaining({
        totalSubmissions: 2,
        emittedRawEventCount: 1,
        pendingCount: 1
      })
    });
    expect(report.providers.find((provider) => provider.sourceId === "ticketmaster")).toMatchObject({
      status: "needs-config",
      enabled: false
    });
    expect(report.providers.find((provider) => provider.sourceId === "rss")).toMatchObject({
      status: "warning",
      enabled: true
    });
    expect(report.providers.find((provider) => provider.sourceId === "social")).toMatchObject({
      status: "disabled",
      enabled: false
    });
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        "Skipped curated event curated-2 because its status is pending.",
        "Skipped 1 pending community submission.",
        "RSS source RSS Feed 1: missing event date."
      ])
    );
    expect(report.errors).toEqual([]);
  });
});
