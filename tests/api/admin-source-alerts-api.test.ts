import { NextRequest } from "next/server";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

async function importRoute(options: {
  runtimeMode?: "development" | "test" | "production";
  adminToken?: string;
  historyPath?: string;
} = {}) {
  vi.resetModules();
  const runtimeMode = options.runtimeMode ?? "development";
  const historyPath =
    options.historyPath ??
    path.join(mkdtempSync(path.join(tmpdir(), "eventscout-admin-alerts-")), "source-run-history.json");

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
      enableCommunitySubmissionsProvider: false,
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
    },
    validateProductionSafety: () => ({
      ok: runtimeMode !== "production" || Boolean(options.adminToken),
      errors: runtimeMode === "production" && !options.adminToken ? ["ADMIN_TOKEN is required in production."] : [],
      warnings: []
    })
  }));

  const store = await import("../../apps/web/lib/sources/runHistoryStore");
  store.clearSourceRunsForTests();

  return import("../../apps/web/app/api/admin/source-alerts/route");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/admin/source-alerts", () => {
  it("rejects unauthenticated production requests", async () => {
    const { GET } = await importRoute({ runtimeMode: "production", adminToken: "secret-token" });

    const response = await GET(new NextRequest("http://localhost/api/admin/source-alerts"));

    expect(response.status).toBe(401);
  });

  it("rejects the wrong admin token", async () => {
    const { GET } = await importRoute({ runtimeMode: "production", adminToken: "secret-token" });

    const response = await GET(
      new NextRequest("http://localhost/api/admin/source-alerts", {
        headers: { "x-admin-token": "wrong-token" }
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns alerts and summary for a valid admin token", async () => {
    const { GET } = await importRoute({ runtimeMode: "production", adminToken: "secret-token" });

    const response = await GET(
      new NextRequest("http://localhost/api/admin/source-alerts", {
        headers: { "x-admin-token": "secret-token" }
      })
    );
    const payload = (await response.json()) as {
      ok: boolean;
      generatedAt: string;
      alerts: unknown[];
      summary: { total: number; critical: number; warning: number; info: number; hasCritical: boolean };
      thresholds: { staleRunHours: number };
    };
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.generatedAt).toEqual(expect.any(String));
    expect(Array.isArray(payload.alerts)).toBe(true);
    expect(payload.summary.total).toBe(payload.alerts.length);
    expect(payload.thresholds.staleRunHours).toBeGreaterThan(0);
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("x-admin-token");
  });

  it("tolerates empty or missing run history", async () => {
    const { GET } = await importRoute({ runtimeMode: "development", adminToken: "" });

    const response = await GET(new NextRequest("http://localhost/api/admin/source-alerts"));
    const payload = (await response.json()) as { alerts: Array<{ id: string }>; summary: { total: number } };

    expect(response.status).toBe(200);
    expect(payload.alerts.some((alert) => alert.id === "source-run-history-no-runs")).toBe(true);
    expect(payload.summary.total).toBe(payload.alerts.length);
  });
});
