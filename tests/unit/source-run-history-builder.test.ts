import { describe, expect, it } from "vitest";
import { buildSourceRunFromAggregatorQa, buildSourceRunFromHealthSnapshot } from "../../apps/web/lib/sources/runHistoryBuilder";

describe("source run history builders", () => {
  it("maps aggregator QA reports into safe run records", () => {
    const record = buildSourceRunFromAggregatorQa({
      generatedAt: "2026-06-23T10:00:00.000Z",
      city: "Cincinnati",
      cityPreset: { cityId: "cincinnati", cityName: "Cincinnati", region: "OH", country: "USA", defaultRadiusMiles: 25, icsSourceCount: 0, rssSourceCount: 0, ticketmasterEnabled: false },
      enabledProviders: [
        {
          sourceId: "mock",
          sourceName: "Mock Local Radar",
          sourceType: "mock",
          rawCount: 2,
          validCount: 2,
          droppedCount: 0,
          finalContributionCount: 2
        },
        {
          sourceId: "rss",
          sourceName: "RSS Feed",
          sourceType: "rss",
          rawCount: 2,
          validCount: 1,
          droppedCount: 1,
          finalContributionCount: 1
        }
      ],
      curatedProvider: null,
      communitySubmissionsProvider: null,
      rawEventCount: 4,
      validNormalizedCount: 3,
      droppedInvalidCount: 1,
      dedupedCount: 2,
      finalCount: 2,
      duplicateGroups: [{ dedupeKey: "k", mergedEventId: "event-1", title: "Shared Event", date: "2026-06-23T10:00:00.000Z", venue: null, city: "Cincinnati", size: 2, eventIds: ["event-1", "event-2"], variantTitles: ["Shared Event"], sourceNames: ["Mock Local Radar"], sourceUrls: ["https://example.com/events/1"], sources: [] }],
      events: [],
      warnings: ["Dropped invalid event"],
      errors: []
    });

    expect(record.runType).toBe("aggregator-qa");
    expect(record.overallStatus).toBe("warning");
    expect(record.enabledProviderCount).toBe(2);
    expect(record.duplicateGroupCount).toBe(1);
    expect(record.metadata.generatedBy).toBe("qa:aggregator");
    expect(record.metadata.cityPreset).toBe("cincinnati");
    expect(record.providers[0]).not.toHaveProperty("sourceUrl");
    expect(record.providers[0]).not.toHaveProperty("eventIds");
    expect(JSON.stringify(record)).not.toContain("https://example.com/events/1");
  });

  it("marks QA records as error when the report has fetch failures", () => {
    const record = buildSourceRunFromAggregatorQa({
      generatedAt: "2026-06-23T10:00:00.000Z",
      city: "Cincinnati",
      cityPreset: null,
      enabledProviders: [
        {
          sourceId: "mock",
          sourceName: "Mock Local Radar",
          sourceType: "mock",
          rawCount: 1,
          validCount: 1,
          droppedCount: 0,
          finalContributionCount: 1
        }
      ],
      curatedProvider: null,
      communitySubmissionsProvider: null,
      rawEventCount: 1,
      validNormalizedCount: 1,
      droppedInvalidCount: 0,
      dedupedCount: 1,
      finalCount: 1,
      duplicateGroups: [],
      events: [],
      warnings: [],
      errors: ["Provider fetch failed: upstream timeout"]
    });

    expect(record.overallStatus).toBe("error");
    expect(record.errorCount).toBe(1);
  });

  it("maps health snapshots into provider summaries and statuses", () => {
    const record = buildSourceRunFromHealthSnapshot({
      generatedAt: "2026-06-23T10:00:00.000Z",
      config: {
        adminTokenConfigured: true,
        mockProviderEnabled: true,
        communityMockProviderEnabled: false,
        curatedProviderEnabled: true,
        communitySubmissionsProviderEnabled: true,
        ticketmasterProviderEnabled: true,
        meetupProviderEnabled: false,
        icsProviderEnabled: false,
        rssProviderEnabled: false,
        websiteProviderEnabled: false,
        socialLeadProviderEnabled: false,
        icsSourceCount: 0,
        rssSourceCount: 0
      },
      totals: {
        providerCount: 4,
        enabledProviderCount: 3,
        readyProviderCount: 1,
        warningProviderCount: 1,
        errorProviderCount: 1,
        needsConfigProviderCount: 1,
        disabledProviderCount: 1
      },
      providers: [
        {
          sourceId: "mock",
          sourceName: "Mock Local Radar",
          sourceType: "mock",
          enabled: true,
          status: "ready" as const,
          summary: "Configured and ready.",
          configNotes: [],
          warnings: [],
          errors: [],
          warningCount: 0,
          errorCount: 0,
          counters: {}
        },
        {
          sourceId: "curated",
          sourceName: "Curated Admin Events",
          sourceType: "community",
          enabled: true,
          status: "warning" as const,
          summary: "Approved records exist.",
          configNotes: [],
          warnings: ["Skipped curated event."],
          errors: [],
          warningCount: 1,
          errorCount: 0,
          counters: {
            rawLoadedCount: 2,
            approvedCount: 1,
            pendingCount: 1,
            rejectedCount: 0,
            suppressedCount: 0,
            invalidCount: 0
          }
        },
        {
          sourceId: "community-submissions",
          sourceName: "Community Submissions",
          sourceType: "community",
          enabled: true,
          status: "error" as const,
          summary: "Conversion failed.",
          configNotes: [],
          warnings: [],
          errors: ["Conversion failed"],
          warningCount: 0,
          errorCount: 1,
          counters: {
            totalSubmissions: 3,
            emittedRawEventCount: 1,
            invalidConversionCount: 1,
            approvedCount: 1,
            pendingCount: 1,
            rejectedCount: 0,
            suppressedCount: 0
          }
        },
        {
          sourceId: "ticketmaster",
          sourceName: "Ticketmaster",
          sourceType: "api",
          enabled: false,
          status: "needs-config" as const,
          summary: "Needs config.",
          configNotes: ["Ticketmaster key missing."],
          warnings: [],
          errors: [],
          warningCount: 0,
          errorCount: 0,
          counters: {}
        }
      ],
      warnings: ["Skipped curated event."],
      errors: ["Conversion failed."]
    } as never);

    expect(record.runType).toBe("health-snapshot");
    expect(record.providers.find((provider) => provider.providerId === "mock")).toMatchObject({
      status: "success",
      enabled: true,
      configured: true
    });
    expect(record.providers.find((provider) => provider.providerId === "curated")).toMatchObject({
      status: "warning",
      rawCount: 2,
      validCount: 1,
      droppedCount: 1
    });
    expect(record.providers.find((provider) => provider.providerId === "community-submissions")).toMatchObject({
      status: "error",
      rawCount: 3,
      validCount: 1,
      droppedCount: 2
    });
    expect(record.providers.find((provider) => provider.providerId === "ticketmaster")).toMatchObject({
      status: "needs-config",
      enabled: false,
      configured: false
    });
    expect(record.overallStatus).toBe("error");
  });
});
