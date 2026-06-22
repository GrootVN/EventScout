import { describe, expect, it } from "vitest";
import { filterEvents } from "../../apps/web/lib/events/filters";
import type { ScoutEvent } from "../../apps/web/lib/events/types";

const event: ScoutEvent = {
  id: "mock-1",
  canonicalKey: "mock-1",
  title: "Beginner Salsa Night",
  description: "No partner needed.",
  startDateTime: "2026-06-20T23:00:00.000Z",
  endDateTime: "2026-06-21T02:00:00.000Z",
  timezone: "America/New_York",
  venueName: "Liberty Hall",
  address: "123 Main St",
  city: "Cincinnati",
  region: "OH",
  country: "USA",
  neighborhood: "Pendleton",
  latitude: 39.1091,
  longitude: -84.5031,
  distanceMiles: null,
  priceType: "paid",
  minPrice: 12,
  maxPrice: 18,
  currency: "USD",
  sourceId: "mock",
  sourceName: "Mock Local Radar",
  sourceType: "mock",
  sourceUrl: "https://example.com/salsa",
  sourceEventId: "salsa-1",
  sourceFetchedAt: "2026-06-19T12:00:00.000Z",
  imageUrl: null,
  categories: ["culture", "nightlife"],
  interests: ["nightlife", "social", "solo-friendly", "newcomer-friendly"],
  confidence: 0.9,
  isNewcomerFriendly: true,
  isSoloFriendly: true,
  originalSources: [
    {
      sourceId: "mock",
      sourceName: "Mock Local Radar",
      sourceType: "mock",
      sourceUrl: "https://example.com/salsa",
      sourceEventId: "salsa-1"
    }
  ],
  createdAt: "2026-06-19T12:00:00.000Z",
  updatedAt: "2026-06-19T12:00:00.000Z"
};

describe("filterEvents", () => {
  it("filters by city, interest, and vibe tags", () => {
    const result = filterEvents([event], {
      city: "Cincinnati",
      interests: ["nightlife"],
      soloFriendly: true,
      newcomerFriendly: true
    });

    expect(result).toHaveLength(1);
  });

  it("excludes events that miss the selected keyword", () => {
    const result = filterEvents([event], {
      keyword: "pottery"
    });

    expect(result).toHaveLength(0);
  });
});
