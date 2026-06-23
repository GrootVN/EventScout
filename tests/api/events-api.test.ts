import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { EventSourceProvider } from "../../apps/web/lib/sources/provider";
import { resetRepositoryForTests } from "../../apps/web/lib/repository";

function makeEvent(id: string, overrides: Record<string, unknown> = {}) {
  return {
    sourceId: "mock",
    sourceName: "Mock Local Radar",
    sourceType: "mock" as const,
    sourceEventId: id,
    sourceUrl: `https://example.com/events/${id}`,
    fetchedAt: "2026-06-19T12:00:00.000Z",
    raw: {
      id,
      title: `Event ${id}`,
      description: "A local event feed item",
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

const provider: EventSourceProvider = {
  sourceId: "mock",
  sourceName: "Mock Local Radar",
  sourceType: "mock",
  enabled: true,
  async fetchEvents() {
    return [
      makeEvent("cin-tech-free", {
        title: "Tech Coffee for Newcomers",
        description: "Coffee and intros for new residents",
        city: "Cincinnati",
        categories: ["tech", "business"],
        priceType: "free"
      }),
      makeEvent("cin-arts-paid", {
        title: "Gallery Walk After Hours",
        description: "An arts crawl in OTR",
        city: "Cincinnati",
        categories: ["arts"],
        priceType: "paid",
        minPrice: 18,
        maxPrice: 18,
        startDateTime: "2026-06-21T22:00:00.000Z"
      }),
      makeEvent("col-food-free", {
        title: "Columbus Food Truck Meetup",
        description: "Street food and live music",
        city: "Columbus",
        region: "OH",
        categories: ["food-drink", "music"],
        priceType: "free"
      }),
      makeEvent("cin-yoga-free", {
        title: "Sunrise Yoga at the Park",
        description: "Outdoor wellness and stretching",
        city: "Cincinnati",
        categories: ["fitness", "outdoors"],
        priceType: "free",
        startDateTime: "2026-06-28T12:00:00.000Z"
      })
    ];
  }
};

async function getRoute(providers: EventSourceProvider[] = [provider], resetModules = true) {
  if (resetModules) {
    vi.resetModules();
  }
  vi.doMock("@/lib/sources/registry", () => ({
    getEnabledProviders: () => providers
  }));
  return import("../../apps/web/app/api/events/route");
}

afterEach(() => {
  resetRepositoryForTests();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/events", () => {
  it("filters by city", async () => {
    const { GET } = await getRoute();
    const response = await GET(new NextRequest("http://localhost:3000/api/events?city=Columbus&datePreset=this-month"));
    const payload = (await response.json()) as { data: Array<{ city: string }> };

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.city).toBe("Columbus");
  });

  it("filters by interest", async () => {
    const { GET } = await getRoute();
    const response = await GET(
      new NextRequest("http://localhost:3000/api/events?city=Cincinnati&datePreset=this-month&interests=arts")
    );
    const payload = (await response.json()) as { data: Array<{ title: string }> };

    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.title).toBe("Gallery Walk After Hours");
  });

  it("filters by keyword", async () => {
    const { GET } = await getRoute();
    const response = await GET(
      new NextRequest("http://localhost:3000/api/events?city=Cincinnati&datePreset=this-month&keyword=yoga")
    );
    const payload = (await response.json()) as { data: Array<{ title: string }> };

    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.title).toBe("Sunrise Yoga at the Park");
  });

  it("filters by price", async () => {
    const { GET } = await getRoute();
    const response = await GET(
      new NextRequest("http://localhost:3000/api/events?city=Cincinnati&datePreset=this-month&priceType=paid")
    );
    const payload = (await response.json()) as { data: Array<{ title: string }> };

    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.title).toBe("Gallery Walk After Hours");
  });

  it("filters by date range", async () => {
    const { GET } = await getRoute();
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/events?city=Cincinnati&datePreset=custom&startDate=2026-06-20T00:00:00.000Z&endDate=2026-06-22T23:59:59.000Z"
      )
    );
    const payload = (await response.json()) as { data: Array<{ title: string }> };

    expect(payload.data).toHaveLength(2);
    expect(payload.data.map((event) => event.title).sort()).toEqual([
      "Gallery Walk After Hours",
      "Tech Coffee for Newcomers"
    ]);
  });

  it("supports filter combinations", async () => {
    const { GET } = await getRoute();
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/events?city=Cincinnati&datePreset=custom&startDate=2026-06-20T00:00:00.000Z&endDate=2026-06-22T23:59:59.000Z&interests=tech&keyword=coffee&priceType=free"
      )
    );
    const payload = (await response.json()) as { data: Array<{ title: string }> };

    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.title).toBe("Tech Coffee for Newcomers");
  });

  it("returns a valid empty data array when nothing matches", async () => {
    const { GET } = await getRoute();
    const response = await GET(
      new NextRequest("http://localhost:3000/api/events?city=Cincinnati&datePreset=this-month&keyword=impossible-query")
    );
    const payload = (await response.json()) as { data: unknown[]; meta: { count: number } };

    expect(response.status).toBe(200);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data).toEqual([]);
    expect(payload.meta.count).toBe(0);
  });

  it("preserves source attribution in API responses", async () => {
    const { GET } = await getRoute();
    const response = await GET(new NextRequest("http://localhost:3000/api/events?city=Cincinnati&datePreset=this-month"));
    const payload = (await response.json()) as {
      data: Array<{ originalSources: Array<{ sourceName: string; sourceUrl: string }> }>;
    };

    expect(payload.data[0]?.originalSources[0]?.sourceName).toBeTruthy();
    expect(payload.data[0]?.originalSources[0]?.sourceUrl).toContain("https://");
  });

  it("omits suppressed curated events from the public list", async () => {
    const suppressedEventIds = new Set<string>();
    const curatedProvider: EventSourceProvider = {
      sourceId: "curated",
      sourceName: "Curated Admin Events",
      sourceType: "community",
      enabled: true,
      async fetchEvents() {
        return [
          {
            sourceId: "curated",
            sourceName: "Curated Admin Events",
            sourceType: "community" as const,
            sourceEventId: "curated-suppress-me",
            sourceUrl: "https://example.com/curated/events/suppress-me",
            fetchedAt: "2026-06-19T12:00:00.000Z",
            raw: {
              id: "curated-suppress-me",
              title: "Suppressed Curated Event",
              description: "A curated event that should be hidden after suppression.",
              startDateTime: "2026-06-30T22:00:00.000Z",
              city: "Cincinnati",
              priceType: "free",
              sourceUrl: "https://example.com/curated/events/suppress-me",
              categories: ["community"],
              status: "approved"
            }
          }
        ];
      }
    };

    vi.resetModules();
    vi.doMock("@/lib/repository", () => ({
      getEventRepository: () => ({
        listSuppressedEventIds: async () => [...suppressedEventIds],
        suppressEvent: async (eventId: string) => {
          suppressedEventIds.add(eventId);
        }
      })
    }));
    vi.doMock("@/lib/sources/registry", () => ({
      getEnabledProviders: () => [curatedProvider]
    }));

    const { suppressEvent } = await import("../../apps/web/lib/event-service");
    await suppressEvent("curated-suppress-me");

    const { GET } = await import("../../apps/web/app/api/events/route");
    const response = await GET(
      new NextRequest("http://localhost:3000/api/events?city=Cincinnati&datePreset=this-month")
    );
    const payload = (await response.json()) as {
      data: Array<{ originalSources: Array<{ sourceEventId: string | null }> }>;
    };

    expect(response.status).toBe(200);
    expect(
      payload.data.some((event) =>
        event.originalSources.some((source) => source.sourceEventId === "curated-suppress-me")
      )
    ).toBe(false);
  });
});
