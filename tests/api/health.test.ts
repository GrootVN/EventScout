import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

async function importRouteWithMocks() {
  vi.resetModules();
  vi.doMock("@/lib/sources/health", () => ({
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
      warnings: [],
      errors: []
    })
  }));

  return import("../../apps/web/app/api/health/route");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/health", () => {
  it("includes source health in the service snapshot", async () => {
    const { GET } = await importRouteWithMocks();
    const response = await GET(new NextRequest("http://localhost/api/health"));
    const payload = (await response.json()) as {
      status: string;
      sourceHealth: { totals: { providerCount: number } };
    };

    expect(response.status).toBe(200);
    expect(payload.status).toBe("ok");
    expect(payload.sourceHealth.totals.providerCount).toBe(2);
  });
});
