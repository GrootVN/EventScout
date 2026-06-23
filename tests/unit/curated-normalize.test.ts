import { describe, expect, it } from "vitest";
import { normalizeRawEvent } from "../../apps/web/lib/events/normalize";
import { validateScoutEvent } from "../../apps/web/lib/events/schema";

describe("normalizeRawEvent for curated events", () => {
  it("normalizes approved curated records and preserves source attribution", () => {
    const result = normalizeRawEvent({
      sourceId: "curated",
      sourceName: "Curated Admin Events",
      sourceType: "community",
      sourceEventId: "curated-tech-meetup-rhinegeist",
      sourceUrl: "https://example.com/curated/events/cincinnati-tech-meetup-rhinegeist",
      fetchedAt: "2026-06-19T12:00:00.000Z",
      raw: {
        id: "curated-tech-meetup-rhinegeist",
        title: "Cincinnati Tech Meetup at Rhinegeist",
        description: "A curator-approved newcomer-friendly tech social with quick intros and brewery tables.",
        startDateTime: "2026-06-21T22:00:00.000Z",
        endDateTime: "2026-06-22T00:00:00.000Z",
        timezone: "America/New_York",
        venueName: "Rhinegeist Brewery",
        address: "1910 Elm St, Cincinnati, OH 45202",
        city: "Cincinnati",
        region: "OH",
        country: "USA",
        latitude: 39.1134,
        longitude: -84.5191,
        priceType: "free",
        sourceUrl: "https://example.com/curated/events/cincinnati-tech-meetup-rhinegeist",
        categories: ["tech", "networking", "business"],
        interests: ["tech", "newcomer-friendly", "solo-friendly"],
        confidence: 0.86,
        isNewcomerFriendly: true,
        isSoloFriendly: true
      }
    });

    expect(result.sourceId).toBe("curated");
    expect(result.sourceName).toBe("Curated Admin Events");
    expect(result.sourceUrl).toBe("https://example.com/curated/events/cincinnati-tech-meetup-rhinegeist");
    expect(result.sourceEventId).toBe("curated-tech-meetup-rhinegeist");
    expect(result.originalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "curated",
          sourceName: "Curated Admin Events",
          sourceType: "community",
          sourceUrl: "https://example.com/curated/events/cincinnati-tech-meetup-rhinegeist"
        })
      ])
    );
    expect(result.categories).toEqual(expect.arrayContaining(["business", "networking", "tech"]));
    expect(result.interests).toEqual(expect.arrayContaining(["newcomer-friendly", "solo-friendly", "tech"]));
    expect(result.isNewcomerFriendly).toBe(true);
    expect(result.isSoloFriendly).toBe(true);
    expect(result.priceType).toBe("free");
    expect(result.minPrice).toBeNull();
    expect(result.maxPrice).toBeNull();
    expect(result.latitude).toBeCloseTo(39.1134);
    expect(result.longitude).toBeCloseTo(-84.5191);
    expect(validateScoutEvent(result)).toEqual([]);
  });

  it("fills safe defaults when optional curated fields are omitted", () => {
    const result = normalizeRawEvent({
      sourceId: "curated",
      sourceName: "Curated Admin Events",
      sourceType: "community",
      sourceEventId: null,
      sourceUrl: "https://example.com/curated/events/minimal",
      fetchedAt: "2026-06-19T12:00:00.000Z",
      raw: {
        id: "curated-minimal",
        title: "Minimal Curated Event",
        startDateTime: "2026-06-30T18:00:00.000Z",
        city: "Cincinnati",
        priceType: "unknown",
        sourceUrl: "https://example.com/curated/events/minimal"
      }
    });

    expect(result.sourceName).toBe("Curated Admin Events");
    expect(result.categories).toEqual([]);
    expect(result.interests).toEqual([]);
    expect(result.venueName).toBeNull();
    expect(result.address).toBeNull();
    expect(result.country).toBe("USA");
    expect(result.confidence).toBe(0.8);
    expect(validateScoutEvent(result)).toEqual([]);
  });
});
