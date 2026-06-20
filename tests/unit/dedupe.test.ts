import { describe, expect, it } from "vitest";
import { dedupeEvents, getDuplicateConfidence, isLikelyDuplicate } from "../../apps/web/lib/events/dedupe";
import type { ScoutEvent } from "../../apps/web/lib/events/types";

const baseEvent: ScoutEvent = {
  id: "a",
  canonicalKey: "boston-backend|2026-08-01|tech-hub",
  title: "Boston Backend Meetup",
  description: "Talks on production infra.",
  startDateTime: "2026-08-01T18:00:00.000Z",
  endDateTime: "2026-08-01T21:00:00.000Z",
  timezone: "America/New_York",
  venueName: "Tech Hub",
  address: "123 Main St, Boston, MA",
  city: "Boston",
  region: "MA",
  country: "USA",
  neighborhood: "Seaport",
  latitude: 42.35,
  longitude: -71.06,
  distanceMiles: null,
  priceType: "free",
  minPrice: null,
  maxPrice: null,
  currency: "USD",
  sourceId: "mock",
  sourceName: "Mock Local Radar",
  sourceType: "mock",
  sourceUrl: "https://example.com/1",
  sourceEventId: "mock-1",
  sourceFetchedAt: "2026-06-19T12:00:00.000Z",
  imageUrl: null,
  categories: ["tech"],
  interests: ["tech", "networking"],
  confidence: 0.8,
  isNewcomerFriendly: false,
  isSoloFriendly: true,
  originalSources: [
    {
      sourceId: "mock",
      sourceName: "Mock Local Radar",
      sourceType: "mock",
      sourceUrl: "https://example.com/1",
      sourceEventId: "mock-1"
    }
  ],
  createdAt: "2026-06-19T12:00:00.000Z",
  updatedAt: "2026-06-19T12:00:00.000Z"
};

describe("dedupeEvents", () => {
  it("merges duplicate events and preserves source attribution", () => {
    const result = dedupeEvents([
      baseEvent,
      {
        ...baseEvent,
        id: "b",
        title: "Boston backend meetup",
        sourceId: "meetup",
        sourceName: "Meetup",
        sourceType: "api",
        sourceUrl: "https://meetup.com/events/2",
        sourceEventId: "meetup-2",
        confidence: 0.9,
        originalSources: [
          {
            sourceId: "meetup",
            sourceName: "Meetup",
            sourceType: "api",
            sourceUrl: "https://meetup.com/events/2",
            sourceEventId: "meetup-2"
          }
        ]
      }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.confidence).toBe(0.9);
    expect(result[0]?.originalSources).toHaveLength(2);
  });

  it("handles similar titles, not only exact title matches", () => {
    const result = dedupeEvents([
      baseEvent,
      {
        ...baseEvent,
        id: "c",
        title: "Boston Backend Meet-up for Engineers",
        sourceId: "rss",
        sourceName: "City Feed",
        sourceType: "rss",
        sourceUrl: "https://city.example.com/events/3",
        sourceEventId: "rss-3",
        originalSources: [
          {
            sourceId: "rss",
            sourceName: "City Feed",
            sourceType: "rss",
            sourceUrl: "https://city.example.com/events/3",
            sourceEventId: "rss-3"
          }
        ]
      }
    ]);

    expect(isLikelyDuplicate(baseEvent, {
      ...baseEvent,
      id: "c",
      title: "Boston Backend Meet-up for Engineers"
    })).toBe(true);
    expect(getDuplicateConfidence(baseEvent, {
      ...baseEvent,
      id: "c",
      title: "Boston Backend Meet-up for Engineers"
    })).toBeGreaterThanOrEqual(0.72);
    expect(result).toHaveLength(1);
    expect(result[0]?.originalSources).toHaveLength(2);
  });

  it("preserves all originalSources across repeated merges", () => {
    const result = dedupeEvents([
      baseEvent,
      {
        ...baseEvent,
        id: "b",
        sourceId: "meetup",
        sourceName: "Meetup",
        sourceType: "api",
        sourceUrl: "https://meetup.com/events/2",
        sourceEventId: "meetup-2",
        originalSources: [
          {
            sourceId: "meetup",
            sourceName: "Meetup",
            sourceType: "api",
            sourceUrl: "https://meetup.com/events/2",
            sourceEventId: "meetup-2"
          }
        ]
      },
      {
        ...baseEvent,
        id: "c",
        title: "Boston Backend Meet-up",
        sourceId: "rss",
        sourceName: "City Feed",
        sourceType: "rss",
        sourceUrl: "https://city.example.com/events/3",
        sourceEventId: "rss-3",
        originalSources: [
          {
            sourceId: "rss",
            sourceName: "City Feed",
            sourceType: "rss",
            sourceUrl: "https://city.example.com/events/3",
            sourceEventId: "rss-3"
          }
        ]
      }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.originalSources).toHaveLength(3);
  });
});
