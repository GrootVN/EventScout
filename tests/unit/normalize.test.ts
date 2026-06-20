import { describe, expect, it } from "vitest";
import { normalizeRawEvent } from "../../apps/web/lib/events/normalize";

describe("normalizeRawEvent", () => {
  it("normalizes whitespace, ids, and inferred tags", () => {
    const result = normalizeRawEvent({
      sourceId: "mock",
      sourceName: "Mock Local Radar",
      sourceType: "mock",
      sourceEventId: "source-1",
      sourceUrl: "https://example.com",
      fetchedAt: "2026-06-19T12:00:00.000Z",
      raw: {
        title: "  Startup   Night ",
        description: "A beginner meetup with coffee and intros. ",
        startDateTime: "2026-08-20T19:00:00-04:00",
        endDateTime: null,
        timezone: "America/New_York",
        venueName: "  Main   Hall ",
        address: " 10 State St, Boston, MA ",
        city: " Boston ",
        region: " MA ",
        country: " USA ",
        neighborhood: " Downtown ",
        latitude: 42.35,
        longitude: -71.06,
        categories: ["tech", "business"],
        priceType: "free",
        minPrice: null,
        maxPrice: null,
        currency: "USD",
        imageUrl: null
      }
    });

    expect(result.title).toBe("Startup Night");
    expect(result.venueName).toBe("Main Hall");
    expect(result.city).toBe("Boston");
    expect(result.interests).toContain("newcomer-friendly");
    expect(result.originalSources[0]?.sourceUrl).toBe("https://example.com");
  });
});
