import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

async function importRouteWithHealthMocks(options: { detailed: boolean; runtimeMode?: "development" | "test" | "production" } = { detailed: false }) {
  vi.resetModules();
  const runtimeMode = options.runtimeMode ?? "production";

  vi.doMock("@/lib/sources/health", () => ({
    canViewDetailedHealth: () => options.detailed,
    getPublicHealthSummary: () => ({
      generatedAt: "2026-06-19T12:00:00.000Z",
      appVersion: "0.13.0",
      status: "ok",
      totals: {
        providerCount: 2,
        enabledProviderCount: 1,
        readyProviderCount: 1,
        warningProviderCount: 0,
        errorProviderCount: 0,
        needsConfigProviderCount: 0,
        disabledProviderCount: 1
      },
      warningCount: 0,
      errorCount: 0,
      latestRunAt: "2026-06-18T08:00:00.000Z",
      latestRunStatus: "success",
      runHistoryEnabled: true
    }),
    getSourceHealthReport: () => ({
      generatedAt: "2026-06-19T12:00:00.000Z",
      config: {
        adminTokenConfigured: true,
        mockProviderEnabled: true,
        communityMockProviderEnabled: false,
        curatedProviderEnabled: true,
        communitySubmissionsProviderEnabled: true,
        ticketmasterProviderEnabled: false,
        meetupProviderEnabled: false,
        icsProviderEnabled: false,
        rssProviderEnabled: false,
        websiteProviderEnabled: false,
        socialLeadProviderEnabled: false,
        icsSourceCount: 0,
        rssSourceCount: 0
      },
      totals: {
        providerCount: 2,
        enabledProviderCount: 1,
        readyProviderCount: 1,
        warningProviderCount: 0,
        errorProviderCount: 0,
        needsConfigProviderCount: 0,
        disabledProviderCount: 1
      },
      providers: [],
      warnings: ["Detailed warning"],
      errors: []
    })
  }));
  vi.doMock("@/lib/sources/runHistoryStore", () => ({
    getPublicSourceRunHistorySummary: () => ({
      latestRunAt: "2026-06-18T08:00:00.000Z",
      latestRunStatus: "success",
      runHistoryEnabled: true
    })
  }));
  vi.doMock("@/lib/config/runtime", () => ({
    getRuntimeMode: () => runtimeMode,
    isProduction: () => runtimeMode === "production",
    isTest: () => runtimeMode === "test",
    isDevelopment: () => runtimeMode === "development"
  }));

  return import("../../apps/web/app/api/health/route");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/health", () => {
  it("returns a public summary in production without admin authorization", async () => {
    const { GET } = await importRouteWithHealthMocks({ detailed: false, runtimeMode: "production" });
    const response = await GET(
      new NextRequest("http://localhost/api/health", {
        headers: { "x-admin-token": "wrong" }
      })
    );
    const payload = (await response.json()) as {
      status: string;
      mode: string;
      health: {
        appVersion: string;
        warningCount: number;
        errorCount: number;
        latestRunAt: string | null;
        latestRunStatus: string | null;
        runHistoryEnabled: boolean;
      };
      history: {
        latestRunAt: string | null;
        latestRunStatus: string | null;
        runHistoryEnabled: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.status).toBe("ok");
    expect(payload.mode).toBe("summary");
    expect(payload.health.appVersion).toBe("0.13.0");
    expect(payload.health.warningCount).toBe(0);
    expect(payload.health.errorCount).toBe(0);
    expect(payload.health.latestRunAt).toBe("2026-06-18T08:00:00.000Z");
    expect(payload.health.latestRunStatus).toBe("success");
    expect(payload.health.runHistoryEnabled).toBe(true);
    expect(payload.history).toMatchObject({
      latestRunAt: "2026-06-18T08:00:00.000Z",
      latestRunStatus: "success",
      runHistoryEnabled: true
    });
    expect(JSON.stringify(payload)).not.toContain("Detailed warning");
  });

  it("returns detailed health in development", async () => {
    const { GET } = await importRouteWithHealthMocks({ detailed: true, runtimeMode: "development" });
    const response = await GET(new NextRequest("http://localhost/api/health"));
    const payload = (await response.json()) as {
      status: string;
      mode: string;
      health: { config: { adminTokenConfigured: boolean }; warnings: string[] };
    };

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("detailed");
    expect(payload.health.config.adminTokenConfigured).toBe(true);
    expect(payload.health.warnings).toEqual(["Detailed warning"]);
  });
});
