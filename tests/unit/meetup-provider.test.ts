import { afterEach, describe, expect, it, vi } from "vitest";
import sampleResponse from "../fixtures/meetup/sample-events.json";
import emptyResponse from "../fixtures/meetup/empty-response.json";
import graphqlErrorsResponse from "../fixtures/meetup/graphql-errors.json";
import malformedResponse from "../fixtures/meetup/malformed-response.json";

type EnvOverrides = Record<string, boolean | string>;

async function importMeetupProviderWithEnv(overrides: EnvOverrides = {}) {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: {
      appName: "Event Scout",
      defaultCity: "Cincinnati",
      defaultRegion: "OH",
      defaultCountry: "USA",
      ticketmasterApiKey: "",
      meetupAccessToken: "",
      meetupGraphqlEndpoint: "https://api.meetup.com/gql",
      defaultCityPreset: "cincinnati",
      icsSourceUrls: "",
      rssSourceUrls: "",
      enableMockProvider: true,
      enableCommunityMockProvider: true,
      enableCityPresets: false,
      enableTicketmasterProvider: false,
      enableMeetupProvider: false,
      enableIcsProvider: false,
      enableRssProvider: false,
      enableWebsiteProvider: false,
      enableSocialLeads: false,
      ...overrides
    }
  }));

  return import("../../apps/web/lib/sources/meetupProvider");
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

describe("meetupProvider", () => {
  it("is disabled by default", async () => {
    const { meetupProvider } = await importMeetupProviderWithEnv();

    expect(meetupProvider.enabled).toBe(false);
  });

  it("returns no events and records a warning when the token is missing", async () => {
    const { meetupProvider, consumeMeetupProviderDiagnostics } = await importMeetupProviderWithEnv(
      {
        enableMeetupProvider: true,
        meetupAccessToken: ""
      }
    );

    const events = await meetupProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
    expect(consumeMeetupProviderDiagnostics()).toEqual([
      expect.objectContaining({
        level: "warning",
        message: expect.stringContaining("MEETUP_ACCESS_TOKEN is missing")
      })
    ]);
  });

  it("returns normalized raw events from a mocked GraphQL response", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.meetup.com/gql");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual(
        expect.objectContaining({
          Authorization: "Bearer test-token",
          Accept: "application/json",
          "Content-Type": "application/json"
        })
      );

      const body = JSON.parse(String(init?.body ?? "{}")) as {
        operationName?: string;
        query?: string;
        variables?: { input?: Record<string, unknown> };
      };

      expect(body.operationName).toBe("MeetupEvents");
      expect(body.query).toContain("eventSearch");
      expect(body.variables?.input).toMatchObject({
        city: "Cincinnati",
        keyword: "meetup",
        interests: ["tech", "networking"],
        limit: 50
      });

      return makeFetchResponse(sampleResponse);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { meetupProvider, buildMeetupGraphqlRequest } = await importMeetupProviderWithEnv({
      enableMeetupProvider: true,
      meetupAccessToken: "test-token"
    });

    const request = buildMeetupGraphqlRequest({
      city: "Cincinnati",
      keyword: "meetup",
      interests: ["tech", "networking"]
    });

    expect(request.endpoint).toBe("https://api.meetup.com/gql");
    expect(request.init.method).toBe("POST");

    const events = await meetupProvider.fetchEvents({
      city: "Cincinnati",
      keyword: "meetup",
      interests: ["tech", "networking"]
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(5);
    expect(events[0]).toMatchObject({
      sourceId: "meetup",
      sourceName: "Meetup",
      sourceType: "api",
      sourceEventId: "meetup-tech-1",
      sourceUrl: "https://www.meetup.com/cincinnati-tech-meetup/events/meetup-tech-1"
    });
  });

  it("returns an empty array for an empty response", async () => {
    const fetchMock = vi.fn(async () => makeFetchResponse(emptyResponse));
    vi.stubGlobal("fetch", fetchMock);

    const { meetupProvider } = await importMeetupProviderWithEnv({
      enableMeetupProvider: true,
      meetupAccessToken: "test-token"
    });

    const events = await meetupProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
  });

  it("returns no events and records GraphQL errors", async () => {
    const fetchMock = vi.fn(async () => makeFetchResponse(graphqlErrorsResponse));
    vi.stubGlobal("fetch", fetchMock);

    const { meetupProvider, consumeMeetupProviderDiagnostics } = await importMeetupProviderWithEnv({
      enableMeetupProvider: true,
      meetupAccessToken: "test-token"
    });

    const events = await meetupProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
    expect(consumeMeetupProviderDiagnostics()).toEqual([
      expect.objectContaining({
        level: "error",
        message: expect.stringContaining("Access denied")
      }),
      expect.objectContaining({
        level: "error",
        message: expect.stringContaining("Token expired")
      })
    ]);
  });

  it("skips malformed individual records without crashing", async () => {
    const fetchMock = vi.fn(async () => makeFetchResponse(malformedResponse));
    vi.stubGlobal("fetch", fetchMock);

    const { meetupProvider, consumeMeetupProviderDiagnostics } = await importMeetupProviderWithEnv({
      enableMeetupProvider: true,
      meetupAccessToken: "test-token"
    });

    const events = await meetupProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toHaveLength(1);
    expect(events[0]?.sourceEventId).toBe("meetup-good-1");
    expect(consumeMeetupProviderDiagnostics()).toEqual([
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

    const { meetupProvider, consumeMeetupProviderDiagnostics } = await importMeetupProviderWithEnv({
      enableMeetupProvider: true,
      meetupAccessToken: "test-token"
    });

    const events = await meetupProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
    expect(consumeMeetupProviderDiagnostics()).toEqual([
      expect.objectContaining({
        level: "error",
        message: expect.stringContaining("upstream timeout")
      })
    ]);
  });
});
