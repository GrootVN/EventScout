import { afterEach, describe, expect, it, vi } from "vitest";
import type { EventSourceProvider } from "../../apps/web/lib/sources/provider";

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

async function importAggregatorQaWithProviders(providers: EventSourceProvider[]) {
  vi.resetModules();
  vi.doMock("@/lib/sources/registry", () => ({
    getEnabledProviders: () => providers
  }));
  return import("../../apps/web/lib/events/aggregatorQa");
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
          makeRawEvent("alpha-1", {
            title: "Builder Coffee Meetup",
            categories: ["tech", "business"]
          }),
          makeRawEvent("broken-1", {
            startDateTime: "not-a-date"
          })
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
          makeRawEvent("alpha-2", {
            title: "Builder Coffee Meet-Up",
            sourceName: "Mock B",
            sourceId: "mock-b",
            sourceUrl: "https://example.com/events/alpha-2"
          })
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
    expect(report.events[0]?.originalSourcesCount).toBe(2);
    expect(report.warnings.some((warning) => warning.includes("Dropped invalid event"))).toBe(true);
    expect(report.errors).toContain("Provider fetch failed: upstream timeout");
  });
});
