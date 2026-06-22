import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

type EnvOverrides = Record<string, boolean | string>;

async function importIcsProviderWithEnv(overrides: EnvOverrides = {}) {
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

  return import("../../apps/web/lib/sources/icsProvider");
}

function fixtureText(name: string) {
  return readFileSync(new URL(`../fixtures/ics/${name}`, import.meta.url), "utf8");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("icsProvider", () => {
  it("is disabled by default", async () => {
    const { icsProvider } = await importIcsProviderWithEnv();

    expect(icsProvider.enabled).toBe(false);
  });

  it("returns no events when the source list is missing", async () => {
    const { icsProvider, consumeIcsProviderDiagnostics } = await importIcsProviderWithEnv({
      enableIcsProvider: true,
      icsSourceUrls: ""
    });

    const events = await icsProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
    expect(consumeIcsProviderDiagnostics()).toEqual([
      expect.objectContaining({
        level: "warning",
        message: expect.stringContaining("ICS_SOURCE_URLS is missing or invalid")
      })
    ]);
  });

  it("returns raw events from a valid ICS fixture", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => fixtureText("sample-calendar.ics")
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { icsProvider, consumeIcsProviderDiagnostics } = await importIcsProviderWithEnv({
      enableIcsProvider: true,
      icsSourceUrls: "https://example.com/calendars/civic.ics"
    });

    const events = await icsProvider.fetchEvents({ city: "Cincinnati" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      sourceId: "ics",
      sourceName: "ICS Calendar 1",
      sourceType: "ics",
      sourceEventId: "ics-tech-1@example.com",
      sourceUrl: "https://calendar.example.com/events/tech-meetup-library"
    });
    expect(events[1]).toMatchObject({
      sourceId: "ics",
      sourceName: "ICS Calendar 1",
      sourceType: "ics",
      sourceEventId: "ics-film-1@example.com",
      sourceUrl: "https://example.com/calendars/civic.ics"
    });
    expect(events.every((event) => event.fetchedAt.length > 0)).toBe(true);
    expect(consumeIcsProviderDiagnostics().some((diagnostic) => diagnostic.message.includes("calendar URL fallback"))).toBe(true);
  });

  it("returns an empty array for an empty calendar", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => fixtureText("empty-calendar.ics")
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { icsProvider } = await importIcsProviderWithEnv({
      enableIcsProvider: true,
      icsSourceUrls: "https://example.com/calendars/empty.ics"
    });

    const events = await icsProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
  });

  it("skips malformed calendars without crashing", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => fixtureText("malformed-calendar.ics")
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { icsProvider, consumeIcsProviderDiagnostics } = await importIcsProviderWithEnv({
      enableIcsProvider: true,
      icsSourceUrls: "https://example.com/calendars/malformed.ics"
    });

    const events = await icsProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
    expect(
      consumeIcsProviderDiagnostics().some((diagnostic) =>
        diagnostic.message.includes("skipped 2 malformed or recurring event records")
      )
    ).toBe(true);
  });

  it("skips recurring events and warns about the limitation", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => fixtureText("recurring-calendar.ics")
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { icsProvider, consumeIcsProviderDiagnostics } = await importIcsProviderWithEnv({
      enableIcsProvider: true,
      icsSourceUrls: "https://example.com/calendars/recurring.ics"
    });

    const events = await icsProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
    expect(
      consumeIcsProviderDiagnostics().some((diagnostic) => diagnostic.message.includes("Skipped recurring ICS event"))
    ).toBe(true);
  });

  it("does not crash when the upstream request fails", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("upstream timeout");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { icsProvider, consumeIcsProviderDiagnostics } = await importIcsProviderWithEnv({
      enableIcsProvider: true,
      icsSourceUrls: "https://example.com/calendars/civic.ics"
    });

    const events = await icsProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
    expect(
      consumeIcsProviderDiagnostics().some((diagnostic) =>
        diagnostic.message.includes("upstream timeout")
      )
    ).toBe(true);
  });
});
