import { afterEach, describe, expect, it, vi } from "vitest";
import sampleEvent from "../fixtures/ticketmaster/sample-event.json";
import emptyResponse from "../fixtures/ticketmaster/empty-response.json";
import malformedResponse from "../fixtures/ticketmaster/malformed-response.json";

type EnvOverrides = Record<string, boolean | string>;

async function importTicketmasterProviderWithEnv(overrides: EnvOverrides = {}) {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: {
      appName: "Event Scout",
      defaultCity: "Cincinnati",
      defaultRegion: "OH",
      defaultCountry: "USA",
      ticketmasterApiKey: "",
      meetupAccessToken: "",
      icsSourceUrls: "",
      rssSourceUrls: "",
      enableMockProvider: true,
      enableCommunityMockProvider: true,
      enableTicketmasterProvider: false,
      enableMeetupProvider: false,
      enableIcsProvider: false,
      enableRssProvider: false,
      enableWebsiteProvider: false,
      enableSocialLeads: false,
      ...overrides
    }
  }));

  return import("../../apps/web/lib/sources/ticketmasterProvider");
}

function makeFetchResponse(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload
  };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("ticketmasterProvider", () => {
  it("is disabled by default", async () => {
    const { ticketmasterProvider } = await importTicketmasterProviderWithEnv();

    expect(ticketmasterProvider.enabled).toBe(false);
  });

  it("returns no events when the API key is missing", async () => {
    const { ticketmasterProvider, consumeTicketmasterProviderDiagnostics } =
      await importTicketmasterProviderWithEnv({
        enableTicketmasterProvider: true,
        ticketmasterApiKey: ""
      });

    const events = await ticketmasterProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
    expect(consumeTicketmasterProviderDiagnostics()).toEqual([
      expect.objectContaining({
        level: "warning",
        message: expect.stringContaining("TICKETMASTER_API_KEY is missing")
      })
    ]);
  });

  it("returns normalized raw events from a mocked Ticketmaster response", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const urlString = String(url);
      expect(urlString).toContain("apikey=test-key");
      expect(urlString).toContain("city=Cincinnati");
      expect(urlString).toContain("stateCode=OH");
      expect(urlString).toContain("latlong=39.1%2C-84.5");
      expect(urlString).toContain("radius=25");
      expect(urlString).toContain("unit=miles");
      expect(urlString).toContain("keyword=meetup");
      expect(urlString).toContain("startDateTime=2026-06-20T00%3A00%3A00.000Z");
      expect(urlString).toContain("endDateTime=2026-06-22T23%3A59%3A59.000Z");
      expect(urlString).toContain("classificationName=music");
      return makeFetchResponse({
        _embedded: {
          events: [sampleEvent]
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { ticketmasterProvider } = await importTicketmasterProviderWithEnv({
      enableTicketmasterProvider: true,
      ticketmasterApiKey: "test-key"
    });

    const events = await ticketmasterProvider.fetchEvents({
      city: "Cincinnati",
      region: "OH",
      country: "USA",
      latitude: 39.1,
      longitude: -84.5,
      radiusMiles: 25,
      startDate: "2026-06-20T00:00:00.000Z",
      endDate: "2026-06-22T23:59:59.000Z",
      keyword: "meetup",
      interests: ["music"]
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      sourceId: "ticketmaster",
      sourceName: "Ticketmaster",
      sourceType: "api",
      sourceEventId: "ticketmaster-123",
      sourceUrl: "https://www.ticketmaster.com/cincinnati-tech-meetup-at-rhinegeist/event/123"
    });
  });

  it("returns an empty array for an empty response", async () => {
    const fetchMock = vi.fn(async () => makeFetchResponse(emptyResponse));
    vi.stubGlobal("fetch", fetchMock);

    const { ticketmasterProvider } = await importTicketmasterProviderWithEnv({
      enableTicketmasterProvider: true,
      ticketmasterApiKey: "test-key"
    });

    const events = await ticketmasterProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
  });

  it("skips malformed individual records without crashing", async () => {
    const fetchMock = vi.fn(async () => makeFetchResponse(malformedResponse));
    vi.stubGlobal("fetch", fetchMock);

    const { ticketmasterProvider, consumeTicketmasterProviderDiagnostics } =
      await importTicketmasterProviderWithEnv({
        enableTicketmasterProvider: true,
        ticketmasterApiKey: "test-key"
      });

    const events = await ticketmasterProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toHaveLength(1);
    expect(events[0]?.sourceEventId).toBe("ticketmaster-456");
    expect(consumeTicketmasterProviderDiagnostics()).toEqual([
      expect.objectContaining({
        level: "warning",
        message: expect.stringContaining("malformed event record")
      })
    ]);
  });

  it("returns no events when the upstream HTTP request fails", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("upstream timeout");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { ticketmasterProvider, consumeTicketmasterProviderDiagnostics } =
      await importTicketmasterProviderWithEnv({
        enableTicketmasterProvider: true,
        ticketmasterApiKey: "test-key"
      });

    const events = await ticketmasterProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
    expect(consumeTicketmasterProviderDiagnostics()).toEqual([
      expect.objectContaining({
        level: "error",
        message: expect.stringContaining("upstream timeout")
      })
    ]);
  });
});
