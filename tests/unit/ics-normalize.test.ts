import { describe, expect, it } from "vitest";
import { normalizeRawEvent } from "../../apps/web/lib/events/normalize";
import { validateScoutEvent } from "../../apps/web/lib/events/schema";

function makeIcsRawEvent(overrides: Record<string, unknown> = {}) {
  const { raw: rawOverrides = {}, ...topLevelOverrides } = overrides as {
    raw?: Record<string, unknown>;
  };

  return {
    sourceId: "ics",
    sourceName: "Downtown Library Calendar",
    sourceType: "ics" as const,
    sourceEventId: "ics-tech-1@example.com",
    sourceUrl: "https://calendar.example.com/events/tech-meetup-library",
    fetchedAt: "2026-06-19T12:00:00.000Z",
    ...topLevelOverrides,
    raw: {
      uid: "ics-tech-1@example.com",
      summary: "Cincinnati Tech Meetup at the Library",
      description: "Join neighbors for demos, introductions, and coffee after work.",
      startDateTime: "2026-06-21T22:00:00.000Z",
      endDateTime: "2026-06-22T00:00:00.000Z",
      timezone: "America/New_York",
      location: "Downtown Library - 800 Vine St, Cincinnati, OH 45202",
      city: "Cincinnati",
      region: "OH",
      country: "USA",
      priceType: "free" as const,
      minPrice: null,
      maxPrice: null,
      currency: "USD",
      categories: ["Tech", "Networking"],
      interests: ["community-guides"],
      sourceCalendarUrl: "https://example.com/calendars/civic.ics",
      confidence: 0.9,
      ...rawOverrides
    }
  };
}

describe("ics normalization", () => {
  it("normalizes a valid ICS raw event into the canonical ScoutEvent shape", () => {
    const event = normalizeRawEvent(makeIcsRawEvent());

    expect(validateScoutEvent(event)).toEqual([]);
    expect(event).toMatchObject({
      title: "Cincinnati Tech Meetup at the Library",
      sourceId: "ics",
      sourceName: "Downtown Library Calendar",
      sourceType: "ics",
      sourceUrl: "https://calendar.example.com/events/tech-meetup-library",
      sourceEventId: "ics-tech-1@example.com",
      city: "Cincinnati",
      region: "OH",
      country: "USA",
      venueName: "Downtown Library",
      address: "800 Vine St, Cincinnati, OH 45202",
      categories: ["tech", "networking"],
      originalSources: [
        {
          sourceId: "ics",
          sourceName: "Downtown Library Calendar",
          sourceType: "ics",
          sourceUrl: "https://calendar.example.com/events/tech-meetup-library",
          sourceEventId: "ics-tech-1@example.com"
        }
      ]
    });
    expect(event.interests).toEqual(expect.arrayContaining(["community-guides", "newcomer-friendly", "solo-friendly"]));
  });

  it("uses the calendar URL fallback when the event URL is missing", () => {
    const event = normalizeRawEvent(
      makeIcsRawEvent({
        sourceUrl: "https://example.com/calendars/civic.ics",
        raw: {
          uid: "ics-film-1@example.com",
          summary: "Neighborhood Film Night",
          description: "Bring a blanket and enjoy a movie under the stars.",
          startDateTime: "2026-06-22T01:00:00.000Z",
          location: "Washington Park | 1230 Elm St, Cincinnati, OH",
          city: "Cincinnati",
          region: "OH",
          country: "USA",
          categories: ["film", "community"],
          interests: [],
          sourceCalendarUrl: "https://example.com/calendars/civic.ics",
          confidence: 0.82
        }
      })
    );

    expect(event.sourceUrl).toBe("https://example.com/calendars/civic.ics");
    expect(event.confidence).toBeLessThan(0.9);
    expect(event.venueName).toBe("Washington Park");
    expect(event.address).toBe("1230 Elm St, Cincinnati, OH");
  });

  it("drops events with a missing SUMMARY", () => {
    expect(() =>
      normalizeRawEvent(
        makeIcsRawEvent({
      raw: {
        uid: "missing-summary",
        summary: undefined,
        description: "Broken record",
        startDateTime: "2026-06-22T01:00:00.000Z",
        sourceCalendarUrl: "https://example.com/calendars/civic.ics"
      }
        })
      )
    ).toThrow("ICS event is missing SUMMARY");
  });

  it("drops events with a missing DTSTART", () => {
    expect(() =>
      normalizeRawEvent(
        makeIcsRawEvent({
      raw: {
        uid: "missing-start",
        summary: "Broken record",
        startDateTime: undefined,
        sourceCalendarUrl: "https://example.com/calendars/civic.ics"
      }
        })
      )
    ).toThrow("ICS event is missing DTSTART");
  });

  it("maps LOCATION safely when only the raw location text is present", () => {
    const event = normalizeRawEvent(
      makeIcsRawEvent({
        raw: {
          uid: "location-only",
          summary: "City Hall Orientation",
          description: "An intro session for newcomers.",
          startDateTime: "2026-06-23T18:30:00.000Z",
          location: "City Hall @ 801 Plum St, Cincinnati, OH",
          city: "Cincinnati",
          region: "OH",
          country: "USA",
          sourceCalendarUrl: "https://example.com/calendars/city-hall.ics",
          confidence: 0.88
        }
      })
    );

    expect(event.venueName).toBe("City Hall");
    expect(event.address).toBe("801 Plum St, Cincinnati, OH");
    expect(validateScoutEvent(event)).toEqual([]);
  });

  it("merges categories and interests from ICS defaults and raw tags", () => {
    const event = normalizeRawEvent(
      makeIcsRawEvent({
        raw: {
          uid: "defaults",
          summary: "Books and Coffee",
          description: "A relaxed reading circle.",
          startDateTime: "2026-06-24T18:00:00.000Z",
          location: "Union Hall - 1311 Vine St, Cincinnati, OH",
          categories: ["Books", "Community"],
          interests: ["quiet", "newcomer-friendly"],
          sourceCalendarUrl: "https://example.com/calendars/books.ics",
          confidence: 0.9
        }
      })
    );

    expect(event.categories).toEqual(["books", "community"]);
    expect(event.interests).toEqual(
      expect.arrayContaining(["books", "community", "quiet", "newcomer-friendly", "solo-friendly"])
    );
  });
});
