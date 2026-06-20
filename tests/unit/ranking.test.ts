import { describe, expect, it } from "vitest";
import { rankEvents, scoreEvent } from "../../apps/web/lib/events/ranking";
import type { ScoutEvent } from "../../apps/web/lib/events/types";

function baseEvent(overrides: Partial<ScoutEvent> = {}): ScoutEvent {
  return {
    id: "event-1",
    canonicalKey: "event-1",
    title: "Founder Coffee Club",
    description: "A social meetup for builders.",
    startDateTime: "2026-06-20T22:00:00.000Z",
    endDateTime: "2026-06-21T00:00:00.000Z",
    timezone: "America/New_York",
    venueName: "Collective Espresso",
    address: "1210 Main St",
    city: "Cincinnati",
    region: "OH",
    country: "USA",
    neighborhood: "Over-the-Rhine",
    latitude: 39.1107,
    longitude: -84.5155,
    distanceMiles: null,
    priceType: "free",
    minPrice: null,
    maxPrice: null,
    currency: "USD",
    sourceId: "mock",
    sourceName: "Mock Local Radar",
    sourceType: "mock",
    sourceUrl: "https://example.com/events/1",
    sourceEventId: "mock-1",
    sourceFetchedAt: "2026-06-19T12:00:00.000Z",
    imageUrl: null,
    categories: ["tech", "business"],
    interests: ["tech", "networking", "newcomer-friendly", "solo-friendly"],
    confidence: 0.92,
    isNewcomerFriendly: true,
    isSoloFriendly: true,
    originalSources: [
      {
        sourceId: "mock",
        sourceName: "Mock Local Radar",
        sourceType: "mock",
        sourceUrl: "https://example.com/events/1",
        sourceEventId: "mock-1"
      }
    ],
    createdAt: "2026-06-19T12:00:00.000Z",
    updatedAt: "2026-06-19T12:00:00.000Z",
    ...overrides
  };
}

describe("scoreEvent", () => {
  it("returns a deterministic newcomer-focused score", () => {
    const event = baseEvent();
    const scored = scoreEvent(event, {
      interests: ["tech"],
      userCity: "Cincinnati",
      latitude: 39.1107,
      longitude: -84.5155,
      preferFree: true
    });

    expect(scored.score).toBeGreaterThan(0.7);
    expect(scored.scoreBreakdown.interestMatch).toBe(1);
    expect(scored.scoreBreakdown.newcomerBoost).toBe(1);
  });

  it("ranks closer interest matches above weaker ones", () => {
    const ranked = rankEvents(
      [
        baseEvent({ id: "strong" }),
        baseEvent({
          id: "weak",
          title: "Gallery Walk",
          interests: ["arts"],
          categories: ["arts"],
          isNewcomerFriendly: false,
          isSoloFriendly: false
        })
      ],
      { interests: ["tech"], userCity: "Cincinnati", preferFree: true }
    );

    expect(ranked[0]?.id).toBe("strong");
  });
});
