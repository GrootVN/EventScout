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
  it("merges meet-up and meetup variants when date and venue match", () => {
    const variant = {
      ...baseEvent,
      id: "b",
      title: "Boston Backend Meet-up",
      sourceId: "meetup",
      sourceName: "Meetup",
      sourceType: "api" as const,
      sourceUrl: "https://meetup.com/events/2",
      sourceEventId: "meetup-2",
      confidence: 0.9,
      originalSources: [
        {
          sourceId: "meetup",
          sourceName: "Meetup",
          sourceType: "api" as const,
          sourceUrl: "https://meetup.com/events/2",
          sourceEventId: "meetup-2"
        }
      ]
    };

    expect(isLikelyDuplicate(baseEvent, variant)).toBe(true);
    expect(dedupeEvents([baseEvent, variant])).toHaveLength(1);
  });

  it("merges title variants and preserves all source metadata, categories, interests, and confidence", () => {
    const communityVariant: ScoutEvent = {
      ...baseEvent,
      id: "community-1",
      title: "Tech Meetup",
      venueName: "Rhinegeist Brewery",
      address: "1910 Elm St, Cincinnati, OH",
      canonicalKey: "tech-meetup|2026-08-01|rhinegeist-brewery",
      sourceId: "community-mock",
      sourceName: "Community Calendar Mock",
      sourceType: "mock",
      sourceUrl: "https://community.example.com/events/tech-meetup",
      sourceEventId: "community-1",
      categories: ["tech", "community"],
      interests: ["tech", "newcomer-friendly"],
      confidence: 0.93,
      originalSources: [
        {
          sourceId: "community-mock",
          sourceName: "Community Calendar Mock",
          sourceType: "mock",
          sourceUrl: "https://community.example.com/events/tech-meetup",
          sourceEventId: "community-1"
        }
      ]
    };
    const mockVariant: ScoutEvent = {
      ...baseEvent,
      id: "mock-2",
      title: "Cincinnati Tech Meetup at Rhinegeist",
      venueName: "Rhinegeist Brewery",
      address: "1910 Elm St, Cincinnati, OH",
      canonicalKey: "cincinnati-tech-meetup-at-rhinegeist|2026-08-01|rhinegeist-brewery",
      sourceUrl: "https://example.com/tech-1",
      sourceEventId: "mock-2",
      categories: ["tech", "business"],
      interests: ["tech", "networking", "solo-friendly"],
      confidence: 0.88,
      originalSources: [
        {
          sourceId: "mock",
          sourceName: "Mock Local Radar",
          sourceType: "mock",
          sourceUrl: "https://example.com/tech-1",
          sourceEventId: "mock-2"
        }
      ]
    };

    const result = dedupeEvents([mockVariant, communityVariant]);

    expect(getDuplicateConfidence(mockVariant, communityVariant)).toBeGreaterThanOrEqual(0.72);
    expect(result).toHaveLength(1);
    expect(result[0]?.confidence).toBe(0.93);
    expect(result[0]?.categories.sort()).toEqual(["business", "community", "tech"]);
    expect(result[0]?.interests.sort()).toEqual([
      "networking",
      "newcomer-friendly",
      "solo-friendly",
      "tech"
    ]);
    expect(result[0]?.originalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceName: "Mock Local Radar",
          sourceUrl: "https://example.com/tech-1"
        }),
        expect.objectContaining({
          sourceName: "Community Calendar Mock",
          sourceUrl: "https://community.example.com/events/tech-meetup"
        })
      ])
    );
  });

  it("does not merge unrelated events", () => {
    const unrelated = {
      ...baseEvent,
      id: "z",
      title: "Neighborhood Jazz Jam",
      venueName: "Riverside Theater",
      address: "5 River Rd, Boston, MA",
      startDateTime: "2026-08-03T18:00:00.000Z",
      sourceId: "community-mock",
      sourceName: "Community Calendar Mock",
      sourceType: "mock" as const,
      sourceUrl: "https://community.example.com/events/jazz-jam",
      sourceEventId: "community-z",
      originalSources: [
        {
          sourceId: "community-mock",
          sourceName: "Community Calendar Mock",
          sourceType: "mock" as const,
          sourceUrl: "https://community.example.com/events/jazz-jam",
          sourceEventId: "community-z"
        }
      ]
    };

    expect(isLikelyDuplicate(baseEvent, unrelated)).toBe(false);
    expect(dedupeEvents([baseEvent, unrelated])).toHaveLength(2);
  });

  it("does not merge recurring events on different days even when the title and venue match", () => {
    const recurringVariant = {
      ...baseEvent,
      id: "repeat-1",
      startDateTime: "2026-08-08T18:00:00.000Z",
      endDateTime: "2026-08-08T21:00:00.000Z",
      sourceId: "community-mock",
      sourceName: "Community Calendar Mock",
      sourceType: "mock" as const,
      sourceUrl: "https://community.example.com/events/boston-backend-repeat",
      sourceEventId: "repeat-1",
      originalSources: [
        {
          sourceId: "community-mock",
          sourceName: "Community Calendar Mock",
          sourceType: "mock" as const,
          sourceUrl: "https://community.example.com/events/boston-backend-repeat",
          sourceEventId: "repeat-1"
        }
      ]
    };

    expect(isLikelyDuplicate(baseEvent, recurringVariant)).toBe(false);
    expect(dedupeEvents([baseEvent, recurringVariant])).toHaveLength(2);
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
