import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

type EnvOverrides = Record<string, boolean | string>;

async function importRssProviderWithEnv(overrides: EnvOverrides = {}) {
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

  return import("../../apps/web/lib/sources/rssProvider");
}

function fixtureText(name: string) {
  return readFileSync(new URL(`../fixtures/rss/${name}`, import.meta.url), "utf8");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("rssProvider", () => {
  it("is disabled by default", async () => {
    const { rssProvider } = await importRssProviderWithEnv();

    expect(rssProvider.enabled).toBe(false);
  });

  it("returns no events when the source list is missing", async () => {
    const { rssProvider, consumeRssProviderDiagnostics } = await importRssProviderWithEnv({
      enableRssProvider: true,
      rssSourceUrls: ""
    });

    const events = await rssProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
    expect(consumeRssProviderDiagnostics()).toEqual([
      expect.objectContaining({
        level: "warning",
        message: expect.stringContaining("RSS_SOURCE_URLS is missing or invalid")
      })
    ]);
  });

  it("returns raw events from an RSS fixture and warns about skipped items", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => fixtureText("sample-feed.xml")
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { rssProvider, consumeRssProviderDiagnostics } = await importRssProviderWithEnv({
      enableRssProvider: true,
      rssSourceUrls: "https://example.com/feeds/city.xml"
    });

    const events = await rssProvider.fetchEvents({ city: "Cincinnati" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      sourceId: "rss",
      sourceName: "Downtown City Events",
      sourceType: "rss",
      sourceEventId: "rss-1",
      sourceUrl: "https://example.com/events/welcome-coffee"
    });
    const diagnostics = consumeRssProviderDiagnostics();
    expect(diagnostics.some((diagnostic) => diagnostic.message.includes("clear sourceUrl"))).toBe(true);
    expect(diagnostics.some((diagnostic) => diagnostic.message.includes("clear event date"))).toBe(true);
  });

  it("returns raw events from an Atom fixture", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => fixtureText("atom-feed.xml")
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { rssProvider, consumeRssProviderDiagnostics } = await importRssProviderWithEnv({
      enableRssProvider: true,
      rssSourceUrls: "https://example.com/feeds/university.xml"
    });

    const events = await rssProvider.fetchEvents({ city: "Cincinnati" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      sourceName: "University Events",
      sourceUrl: "https://example.com/events/maker-night",
      sourceEventId: "urn:uuid:atom-1"
    });
    expect(consumeRssProviderDiagnostics()).toEqual([]);
  });

  it("skips malformed feeds without crashing", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => fixtureText("malformed-feed.xml")
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { rssProvider, consumeRssProviderDiagnostics } = await importRssProviderWithEnv({
      enableRssProvider: true,
      rssSourceUrls: "https://example.com/feeds/broken.xml"
    });

    const events = await rssProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
    expect(
      consumeRssProviderDiagnostics().some((diagnostic) =>
        diagnostic.message.includes("did not contain any item or entry records")
      )
    ).toBe(true);
  });

  it("does not crash when the upstream request fails", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("upstream timeout");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rssProvider, consumeRssProviderDiagnostics } = await importRssProviderWithEnv({
      enableRssProvider: true,
      rssSourceUrls: "https://example.com/feeds/city.xml"
    });

    const events = await rssProvider.fetchEvents({ city: "Cincinnati" });

    expect(events).toEqual([]);
    expect(
      consumeRssProviderDiagnostics().some((diagnostic) => diagnostic.message.includes("upstream timeout"))
    ).toBe(true);
  });
});
