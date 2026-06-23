import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

function importRouteWithMocks(overrides: {
  authorized?: boolean;
  getFlaggedEvents?: () => Promise<unknown>;
  suppressEvent?: (eventId: string, note?: string) => Promise<void>;
} = {}) {
  vi.resetModules();
  vi.doMock("@/lib/admin-auth", () => ({
    requireAdminToken: () => overrides.authorized ?? true
  }));
  vi.doMock("@/lib/event-service", () => ({
    getFlaggedEvents: overrides.getFlaggedEvents ?? (async () => []),
    suppressEvent: overrides.suppressEvent ?? (async () => undefined)
  }));
  return import("../../apps/web/app/api/admin/flagged/route");
}

async function importRouteWithProductionAuth(adminToken = "") {
  vi.resetModules();
  vi.doMock("@/lib/config/runtime", () => ({
    getRuntimeMode: () => "production",
    isProduction: () => true,
    isTest: () => false,
    isDevelopment: () => false
  }));
  vi.doMock("@/lib/config/env", () => ({
    env: {
      adminToken
    }
  }));
  vi.doMock("@/lib/event-service", () => ({
    getFlaggedEvents: async () => [],
    suppressEvent: async () => undefined
  }));

  return import("../../apps/web/app/api/admin/flagged/route");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/admin/flagged", () => {
  it("returns the moderation queue", async () => {
    const { GET } = await importRouteWithMocks({
      getFlaggedEvents: async () => [{ id: "event-1", title: "Needs review" }]
    });

    const response = await GET(new NextRequest("http://localhost/api/admin/flagged"));
    const payload = (await response.json()) as { data: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([{ id: "event-1", title: "Needs review" }]);
  });

  it("rejects unauthorized requests", async () => {
    const { GET } = await importRouteWithMocks({ authorized: false });

    const response = await GET(new NextRequest("http://localhost/api/admin/flagged"));

    expect(response.status).toBe(401);
  });

  it("denies access in production when ADMIN_TOKEN is missing", async () => {
    const { GET } = await importRouteWithProductionAuth("");

    const response = await GET(new NextRequest("http://localhost/api/admin/flagged"));

    expect(response.status).toBe(401);
  });
});

describe("POST /api/admin/flagged", () => {
  it("suppresses a flagged event", async () => {
    const suppressEvent = vi.fn(async () => undefined);
    const { POST } = await importRouteWithMocks({ suppressEvent });

    const response = await POST(
      new NextRequest("http://localhost/api/admin/flagged", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_id: "event-1",
          note: "Reviewed by admin"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(suppressEvent).toHaveBeenCalledWith("event-1", "Reviewed by admin");
  });
});
