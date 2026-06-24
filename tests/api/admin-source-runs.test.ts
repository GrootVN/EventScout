import { NextRequest } from "next/server";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

function makeRun(id: string, finishedAt: string, providerId = "provider-a") {
  return {
    id,
    runType: "manual" as const,
    appVersion: "0.13.0",
    startedAt: finishedAt,
    finishedAt,
    durationMs: 20,
    overallStatus: "success" as const,
    enabledProviderCount: 1,
    disabledProviderCount: 0,
    needsConfigProviderCount: 0,
    rawCount: 1,
    validCount: 1,
    droppedCount: 0,
    finalCount: 1,
    duplicateGroupCount: 0,
    warningCount: 0,
    errorCount: 0,
    providers: [
      {
        providerId,
        providerName: providerId === "provider-a" ? "Provider A" : "Provider B",
        sourceType: "mock",
        status: "success" as const,
        enabled: true,
        configured: true,
        rawCount: 1,
        validCount: 1,
        droppedCount: 0,
        finalCount: 1,
        duplicateGroupCount: 0,
        warningCount: 0,
        errorCount: 0,
        warnings: [],
        errors: [],
        startedAt: finishedAt,
        finishedAt,
        durationMs: 20
      }
    ],
    metadata: {
      generatedBy: "test",
      notes: "note"
    }
  };
}

async function importRoute(options: {
  runtimeMode?: "development" | "test" | "production";
  adminToken?: string;
  historyPath?: string;
} = {}) {
  vi.resetModules();
  const runtimeMode = options.runtimeMode ?? "development";
  const historyPath = options.historyPath ?? path.join(mkdtempSync(path.join(tmpdir(), "eventscout-admin-history-")), "source-run-history.json");

  vi.doMock("@/lib/config/runtime", () => ({
    getRuntimeMode: () => runtimeMode,
    isProduction: () => runtimeMode === "production",
    isTest: () => runtimeMode === "test",
    isDevelopment: () => runtimeMode === "development"
  }));
  vi.doMock("@/lib/config/env", () => ({
    env: {
      appName: "Event Scout",
      defaultCity: "Cincinnati",
      defaultRegion: "OH",
      defaultCountry: "USA",
      adminToken: options.adminToken ?? "",
      ticketmasterApiKey: "",
      meetupAccessToken: "",
      meetupGraphqlEndpoint: "https://api.meetup.com/gql",
      defaultCityPreset: "cincinnati",
      icsSourceUrls: "",
      rssSourceUrls: "",
      curatedEventsPath: "apps/web/data/curated-events.json",
      enableMockProvider: true,
      enableCommunityMockProvider: true,
      enableSourceRunHistory: true,
      sourceRunHistoryPath: historyPath,
      sourceRunHistoryLimit: 10,
      enableCommunitySubmissionsProvider: true,
      enableSampleSubmissions: false,
      enableSampleTrustedSources: false,
      enableDetailedHealth: false,
      enableCuratedProvider: false,
      enableCityPresets: false,
      enableTicketmasterProvider: false,
      enableMeetupProvider: false,
      enableIcsProvider: false,
      enableRssProvider: false,
      enableWebsiteProvider: false,
      enableSocialLeads: false
    }
  }));

  const store = await import("../../apps/web/lib/sources/runHistoryStore");
  store.clearSourceRunsForTests();

  return {
    store,
    ...(await import("../../apps/web/app/api/admin/source-runs/route"))
  };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/admin/source-runs", () => {
  it("requires auth in production when ADMIN_TOKEN is missing", async () => {
    const { GET } = await importRoute({ runtimeMode: "production", adminToken: "" });

    const response = await GET(new NextRequest("http://localhost/api/admin/source-runs"));

    expect(response.status).toBe(401);
  });

  it("returns empty history safely in development", async () => {
    const { GET } = await importRoute({ runtimeMode: "development", adminToken: "" });

    const response = await GET(new NextRequest("http://localhost/api/admin/source-runs"));
    const payload = (await response.json()) as { ok: boolean; runs: unknown[]; latest: unknown };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.runs).toEqual([]);
    expect(payload.latest).toBeNull();
  });

  it("returns runs with limit and provider filtering", async () => {
    const { GET, store } = await importRoute({ runtimeMode: "production", adminToken: "secret-token" });
    store.appendSourceRun(makeRun("run-1", "2026-06-21T10:00:00.000Z", "provider-a"));
    store.appendSourceRun(makeRun("run-2", "2026-06-22T10:00:00.000Z", "provider-b"));
    store.appendSourceRun(makeRun("run-3", "2026-06-23T10:00:00.000Z", "provider-a"));

    const response = await GET(
      new NextRequest("http://localhost/api/admin/source-runs?limit=1&providerId=provider-a", {
        headers: { "x-admin-token": "secret-token" }
      })
    );
    const payload = (await response.json()) as {
      ok: boolean;
      runs: Array<{ id: string; providers: Array<{ providerId: string }> }>;
      latest: { id: string } | null;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.runs).toHaveLength(1);
    expect(payload.runs[0]?.providers.every((provider) => provider.providerId === "provider-a")).toBe(true);
    expect(payload.latest?.id).toBe("run-3");
  });

  it("does not leak token values in the response", async () => {
    const { GET, store } = await importRoute({ runtimeMode: "production", adminToken: "secret-token" });
    store.appendSourceRun(makeRun("run-1", "2026-06-23T10:00:00.000Z"));

    const response = await GET(
      new NextRequest("http://localhost/api/admin/source-runs", {
        headers: { "x-admin-token": "secret-token" }
      })
    );
    const text = await response.text();

    expect(text).not.toContain("secret-token");
    expect(text).not.toContain("ADMIN_TOKEN");
  });
});
