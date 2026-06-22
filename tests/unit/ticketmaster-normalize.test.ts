import { describe, expect, it } from "vitest";
import { normalizeRawEvent } from "../../apps/web/lib/events/normalize";
import { validateScoutEvent } from "../../apps/web/lib/events/schema";
import sampleEvent from "../fixtures/ticketmaster/sample-event.json";

describe("ticketmaster normalization", () => {
  it("normalizes a Ticketmaster event into the canonical ScoutEvent shape", () => {
    const event = normalizeRawEvent({
      sourceId: "ticketmaster",
      sourceName: "Ticketmaster",
      sourceType: "api",
      sourceEventId: "ticketmaster-123",
      sourceUrl: "https://www.ticketmaster.com/cincinnati-tech-meetup-at-rhinegeist/event/123",
      fetchedAt: "2026-06-19T12:00:00.000Z",
      raw: sampleEvent
    });

    expect(validateScoutEvent(event)).toEqual([]);
    expect(event).toMatchObject({
      title: "Cincinnati Tech Meetup at Rhinegeist",
      sourceId: "ticketmaster",
      sourceName: "Ticketmaster",
      sourceType: "api",
      sourceUrl: "https://www.ticketmaster.com/cincinnati-tech-meetup-at-rhinegeist/event/123",
      sourceEventId: "ticketmaster-123",
      city: "Cincinnati",
      region: "OH",
      country: "USA",
      venueName: "Rhinegeist Brewery",
      address: "1910 Elm St",
      priceType: "free",
      minPrice: 0,
      maxPrice: 0,
      currency: "USD",
      imageUrl: "https://img.ticketmaster.com/large.jpg",
      categories: ["music"],
      originalSources: [
        {
          sourceId: "ticketmaster",
          sourceName: "Ticketmaster",
          sourceType: "api",
          sourceUrl: "https://www.ticketmaster.com/cincinnati-tech-meetup-at-rhinegeist/event/123",
          sourceEventId: "ticketmaster-123"
        }
      ]
    });
    expect(event.interests).toEqual(expect.arrayContaining(["music", "newcomer-friendly", "solo-friendly"]));
  });

  it("keeps optional fields nullable when Ticketmaster omits them", () => {
    const event = normalizeRawEvent({
      sourceId: "ticketmaster",
      sourceName: "Ticketmaster",
      sourceType: "api",
      sourceEventId: "ticketmaster-arts",
      sourceUrl: "https://www.ticketmaster.com/arts-theatre-event/event/arts",
      fetchedAt: "2026-06-19T12:00:00.000Z",
      raw: {
        id: "ticketmaster-arts",
        name: "Arts & Theatre Evening",
        url: "https://www.ticketmaster.com/arts-theatre-event/event/arts",
        dates: {
          start: {
            dateTime: "2026-06-23T19:30:00Z"
          }
        },
        classifications: [
          {
            segment: {
              name: "Arts & Theatre"
            },
            genre: {
              name: "Theatre"
            }
          }
        ]
      }
    });

    expect(event.venueName).toBeNull();
    expect(event.address).toBeNull();
    expect(event.imageUrl).toBeNull();
    expect(event.categories).toEqual(expect.arrayContaining(["arts", "theater"]));
    expect(event.interests).toEqual(expect.arrayContaining(["arts", "theater"]));
    expect(validateScoutEvent(event)).toEqual([]);
  });

  it("fails validation when the source URL is missing", () => {
    expect(() =>
      normalizeRawEvent({
        sourceId: "ticketmaster",
        sourceName: "Ticketmaster",
        sourceType: "api",
        sourceEventId: "ticketmaster-missing-url",
        sourceUrl: "",
        fetchedAt: "2026-06-19T12:00:00.000Z",
        raw: {
          id: "ticketmaster-missing-url",
          name: "Broken Event",
          dates: {
            start: {
              dateTime: "2026-06-23T19:30:00Z"
            }
          }
        }
      })
    ).toThrow("sourceUrl is required");
  });
});
