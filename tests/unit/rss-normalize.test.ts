import { describe, expect, it } from "vitest";
import { normalizeRawEvent } from "../../apps/web/lib/events/normalize";
import { validateScoutEvent } from "../../apps/web/lib/events/schema";

function makeRssRawEvent(overrides: Record<string, unknown> = {}) {
  const { raw: rawOverrides = {}, ...topLevelOverrides } = overrides as {
    raw?: Record<string, unknown>;
  };

  return {
    sourceId: "rss",
    sourceName: "Downtown City Events",
    sourceType: "rss" as const,
    sourceEventId: "rss-1",
    sourceUrl: "https://example.com/events/welcome-coffee",
    fetchedAt: "2026-06-19T12:00:00.000Z",
    ...topLevelOverrides,
    raw: {
      id: "rss-1",
      title: "Neighborhood Welcome Coffee",
      description: "A newcomer-friendly coffee hour for people new to town.",
      startDateTime: "2026-06-23T22:30:00.000Z",
      endDateTime: "2026-06-23T23:30:00.000Z",
      timezone: "UTC",
      venueName: "Central Library",
      address: "800 Vine St, Cincinnati, OH 45202",
      city: "Cincinnati",
      region: "OH",
      country: "USA",
      priceType: "unknown" as const,
      minPrice: null,
      maxPrice: null,
      currency: null,
      imageUrl: null,
      categories: ["Community", "Newcomer-Friendly"],
      interests: ["rss", "community"],
      confidence: 0.78,
      feedTitle: "Downtown City Events",
      publishedAt: "2026-06-19T12:00:00.000Z",
      sourceFeedUrl: "https://example.com/feeds/city.xml",
      ...rawOverrides
    }
  };
}

describe("rss normalization", () => {
  it("normalizes a valid RSS raw event into the canonical ScoutEvent shape", () => {
    const event = normalizeRawEvent(makeRssRawEvent());

    expect(validateScoutEvent(event)).toEqual([]);
    expect(event).toMatchObject({
      title: "Neighborhood Welcome Coffee",
      sourceId: "rss",
      sourceName: "Downtown City Events",
      sourceType: "rss",
      sourceUrl: "https://example.com/events/welcome-coffee",
      sourceEventId: "rss-1",
      city: "Cincinnati",
      region: "OH",
      country: "USA",
      venueName: "Central Library",
      address: "800 Vine St, Cincinnati, OH 45202",
      categories: ["community", "newcomer-friendly"],
      originalSources: [
        {
          sourceId: "rss",
          sourceName: "Downtown City Events",
          sourceType: "rss",
          sourceUrl: "https://example.com/events/welcome-coffee",
          sourceEventId: "rss-1"
        }
      ]
    });
    expect(event.interests).toEqual(
      expect.arrayContaining(["rss", "community", "newcomer-friendly", "solo-friendly"])
    );
    expect(event.confidence).toBeLessThan(0.88);
  });

  it("keeps publication metadata separate from the event start time", () => {
    expect(() =>
      normalizeRawEvent(
        makeRssRawEvent({
          raw: {
            id: "rss-pubdate",
            title: "Volunteer Fair at the Park",
            description: "The feed has a publication date, but no event date.",
            startDateTime: undefined,
            publishedAt: "2026-06-19T12:00:00.000Z"
          }
        })
      )
    ).toThrow("RSS event is missing a clear event date");
  });

  it("drops events with missing titles", () => {
    expect(() =>
      normalizeRawEvent(
        makeRssRawEvent({
          raw: {
            id: "rss-missing-title",
            title: undefined,
            startDateTime: "2026-06-23T22:30:00.000Z"
          }
        })
      )
    ).toThrow("RSS event is missing a title");
  });
});
