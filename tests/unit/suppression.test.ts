import { describe, expect, it } from "vitest";
import { filterSuppressedEvents, shouldSuppressEvent } from "../../apps/web/lib/events/suppression";
import type { ScoutEvent } from "../../apps/web/lib/events/types";

const event: ScoutEvent = {
  id: "curated-suppress-me",
  canonicalKey: "suppressed-event|2026-06-30|venue",
  title: "Suppressed Curated Event",
  description: null,
  startDateTime: "2026-06-30T22:00:00.000Z",
  endDateTime: null,
  timezone: "America/New_York",
  venueName: "Venue",
  address: null,
  city: "Cincinnati",
  region: "OH",
  country: "USA",
  neighborhood: null,
  latitude: null,
  longitude: null,
  distanceMiles: null,
  priceType: "free",
  minPrice: null,
  maxPrice: null,
  currency: "USD",
  sourceId: "curated",
  sourceName: "Curated Admin Events",
  sourceType: "community",
  sourceUrl: "https://example.com/curated/events/suppress-me",
  sourceEventId: "curated-suppress-me",
  sourceFetchedAt: "2026-06-19T12:00:00.000Z",
  imageUrl: null,
  categories: ["community"],
  interests: ["community"],
  confidence: 0.8,
  isNewcomerFriendly: false,
  isSoloFriendly: false,
  originalSources: [
    {
      sourceId: "curated",
      sourceName: "Curated Admin Events",
      sourceType: "community",
      sourceUrl: "https://example.com/curated/events/suppress-me",
      sourceEventId: "curated-suppress-me"
    }
  ],
  createdAt: "2026-06-19T12:00:00.000Z",
  updatedAt: "2026-06-19T12:00:00.000Z"
};

describe("suppression helpers", () => {
  it("suppresses direct event ids and original source ids", () => {
    expect(shouldSuppressEvent(event, ["curated-suppress-me"])).toBe(true);
    expect(
      shouldSuppressEvent(
        {
          ...event,
          id: "merged-event",
          originalSources: [
            ...event.originalSources,
            {
              sourceId: "mock",
              sourceName: "Mock Local Radar",
              sourceType: "mock",
              sourceUrl: "https://example.com/events/mock",
              sourceEventId: "mock-1"
            }
          ]
        },
        ["curated-suppress-me"]
      )
    ).toBe(true);
  });

  it("filters suppressed events from a list", () => {
    const visible = filterSuppressedEvents(
      [
        event,
        {
          ...event,
          id: "visible",
          sourceEventId: "visible",
          sourceUrl: "https://example.com/curated/events/visible",
          originalSources: [
            {
              sourceId: "curated",
              sourceName: "Curated Admin Events",
              sourceType: "community",
              sourceUrl: "https://example.com/curated/events/visible",
              sourceEventId: "visible"
            }
          ]
        }
      ],
      ["curated-suppress-me"]
    );

    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe("visible");
  });
});
