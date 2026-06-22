import { describe, expect, it } from "vitest";
import { normalizeRawEvent } from "../../apps/web/lib/events/normalize";
import { validateScoutEvent } from "../../apps/web/lib/events/schema";

describe("meetup normalization", () => {
  it("normalizes a Meetup event into the canonical ScoutEvent shape", () => {
    const event = normalizeRawEvent({
      sourceId: "meetup",
      sourceName: "Meetup",
      sourceType: "api",
      sourceEventId: "meetup-tech-1",
      sourceUrl: "https://www.meetup.com/cincinnati-tech-meetup/events/meetup-tech-1",
      fetchedAt: "2026-06-19T12:00:00.000Z",
      raw: {
        id: "meetup-tech-1",
        title: "Cincinnati Tech Meetup at Rhinegeist",
        description: "A newcomer-friendly tech social with quick intros, demos, and brewery tables.",
        startDateTime: "2026-06-21T22:00:00.000Z",
        endDateTime: "2026-06-22T00:00:00.000Z",
        timezone: "America/New_York",
        venueName: "Rhinegeist Brewery",
        address: "1910 Elm St",
        city: "Cincinnati",
        region: "OH",
        country: "USA",
        latitude: 39.1134,
        longitude: -84.5191,
        imageUrl: "https://images.meetup.com/tech-1.jpg",
        categories: ["tech", "networking"],
        interests: ["tech", "networking"],
        confidence: 0.91,
        groupName: "Cincinnati Tech Meetup",
        groupTopics: ["Tech", "Networking"],
        tags: ["community"]
      }
    });

    expect(validateScoutEvent(event)).toEqual([]);
    expect(event).toMatchObject({
      id: "meetup-tech-1",
      title: "Cincinnati Tech Meetup at Rhinegeist",
      sourceId: "meetup",
      sourceName: "Meetup",
      sourceType: "api",
      sourceUrl: "https://www.meetup.com/cincinnati-tech-meetup/events/meetup-tech-1",
      sourceEventId: "meetup-tech-1",
      city: "Cincinnati",
      region: "OH",
      country: "USA",
      venueName: "Rhinegeist Brewery",
      address: "1910 Elm St",
      priceType: "unknown",
      imageUrl: "https://images.meetup.com/tech-1.jpg",
      originalSources: [
        {
          sourceId: "meetup",
          sourceName: "Meetup",
          sourceType: "api",
          sourceUrl: "https://www.meetup.com/cincinnati-tech-meetup/events/meetup-tech-1",
          sourceEventId: "meetup-tech-1"
        }
      ]
    });
    expect(event.categories).toEqual(
      expect.arrayContaining(["tech", "networking", "social", "community"])
    );
    expect(event.interests).toEqual(
      expect.arrayContaining(["tech", "networking", "newcomer-friendly", "solo-friendly"])
    );
    expect(event.isNewcomerFriendly).toBe(true);
    expect(event.isSoloFriendly).toBe(true);
  });

  it("keeps optional fields nullable when Meetup omits them", () => {
    const event = normalizeRawEvent({
      sourceId: "meetup",
      sourceName: "Meetup",
      sourceType: "api",
      sourceEventId: "meetup-social-1",
      sourceUrl: "https://www.meetup.com/welcome-town-social/events/meetup-social-1",
      fetchedAt: "2026-06-19T12:00:00.000Z",
      raw: {
        id: "meetup-social-1",
        title: "Welcome to Town Social Hour",
        description: "An open social gathering for newcomers and first-timers.",
        startDateTime: "2026-06-24T22:30:00.000Z",
        city: "Cincinnati",
        categories: ["social", "community"],
        interests: ["social"]
      }
    });

    expect(event.venueName).toBeNull();
    expect(event.address).toBeNull();
    expect(event.imageUrl).toBeNull();
    expect(event.timezone).toBe("America/New_York");
    expect(event.interests).toEqual(
      expect.arrayContaining(["social", "community", "newcomer-friendly", "solo-friendly"])
    );
    expect(validateScoutEvent(event)).toEqual([]);
  });

  it("fails validation when the source URL is missing", () => {
    expect(() =>
      normalizeRawEvent({
        sourceId: "meetup",
        sourceName: "Meetup",
        sourceType: "api",
        sourceEventId: "meetup-broken",
        sourceUrl: "",
        fetchedAt: "2026-06-19T12:00:00.000Z",
        raw: {
          id: "meetup-broken",
          title: "Broken Meetup",
          startDateTime: "2026-06-26T22:00:00.000Z",
          city: "Cincinnati"
        }
      })
    ).toThrow("sourceUrl is required");
  });
});
