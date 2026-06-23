import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

function importRouteWithMocks(overrides: {
  authorized?: boolean;
  listTrustedSources?: () => Promise<unknown>;
  upsertTrustedSource?: (input: unknown) => Promise<unknown>;
  deactivateTrustedSource?: (id: string) => Promise<void>;
} = {}) {
  vi.resetModules();
  vi.doMock("@/lib/admin-auth", () => ({
    requireAdminToken: () => overrides.authorized ?? true
  }));
  vi.doMock("@/lib/event-service", () => ({
    listTrustedSources: overrides.listTrustedSources ?? (async () => []),
    upsertTrustedSource: overrides.upsertTrustedSource ?? (async (input: unknown) => input),
    deactivateTrustedSource: overrides.deactivateTrustedSource ?? (async () => undefined)
  }));
  return import("../../apps/web/app/api/admin/trusted-sources/route");
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
    listTrustedSources: async () => [],
    upsertTrustedSource: async (input: unknown) => input,
    deactivateTrustedSource: async () => undefined
  }));

  return import("../../apps/web/app/api/admin/trusted-sources/route");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/admin/trusted-sources", () => {
  it("returns trusted sources for authorized requests", async () => {
    const { GET } = await importRouteWithMocks({
      listTrustedSources: async () => [{ id: "trusted-1", source_value: "www.example.com" }]
    });

    const response = await GET(new NextRequest("http://localhost/api/admin/trusted-sources"));
    const payload = (await response.json()) as { data: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([{ id: "trusted-1", source_value: "www.example.com" }]);
  });

  it("rejects unauthorized requests", async () => {
    const { GET } = await importRouteWithMocks({ authorized: false });

    const response = await GET(new NextRequest("http://localhost/api/admin/trusted-sources"));

    expect(response.status).toBe(401);
  });

  it("denies access in production when ADMIN_TOKEN is missing", async () => {
    const { GET } = await importRouteWithProductionAuth("");

    const response = await GET(new NextRequest("http://localhost/api/admin/trusted-sources"));

    expect(response.status).toBe(401);
  });
});

describe("POST /api/admin/trusted-sources", () => {
  it("upserts a trusted source", async () => {
    const { POST } = await importRouteWithMocks({
      upsertTrustedSource: async (input) => ({
        id: "trusted-new",
        ...(input as Record<string, unknown>)
      })
    });

    const response = await POST(
      new NextRequest("http://localhost/api/admin/trusted-sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source_type: "domain",
          source_value: "www.example.com",
          source_family: "calendar",
          notes: "Trusted by admins",
          active: true
        })
      })
    );
    const payload = (await response.json()) as { data: { id: string; source_value: string } };

    expect(response.status).toBe(200);
    expect(payload.data.id).toBe("trusted-new");
    expect(payload.data.source_value).toBe("www.example.com");
  });
});

describe("DELETE /api/admin/trusted-sources", () => {
  it("deactivates a trusted source", async () => {
    const deactivateTrustedSource = vi.fn(async () => undefined);
    const { DELETE } = await importRouteWithMocks({ deactivateTrustedSource });

    const response = await DELETE(new NextRequest("http://localhost/api/admin/trusted-sources?id=trusted-new"));

    expect(response.status).toBe(200);
    expect(deactivateTrustedSource).toHaveBeenCalledWith("trusted-new");
  });
});
