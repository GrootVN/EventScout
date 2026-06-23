import { afterEach, describe, expect, it, vi } from "vitest";

async function importAdminAuth(options: { adminToken?: string; runtimeMode?: "development" | "test" | "production" } = {}) {
  vi.resetModules();
  const runtimeMode = options.runtimeMode ?? "development";

  vi.doMock("@/lib/config/runtime", () => ({
    getRuntimeMode: () => runtimeMode,
    isProduction: () => runtimeMode === "production",
    isTest: () => runtimeMode === "test",
    isDevelopment: () => runtimeMode === "development"
  }));
  vi.doMock("@/lib/config/env", () => ({
    env: {
      adminToken: options.adminToken ?? ""
    }
  }));

  return import("../../apps/web/lib/admin-auth");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("admin auth", () => {
  it.each(["development", "test"] as const)("allows local admin access when no token is configured in %s", async (runtimeMode) => {
    const { requireAdminToken, isAdminPageAuthorized } = await importAdminAuth({ runtimeMode, adminToken: "" });

    expect(requireAdminToken(null)).toBe(true);
    expect(isAdminPageAuthorized(undefined)).toBe(true);
  });

  it("denies admin access in production when no token is configured", async () => {
    const { requireAdminToken, isAdminPageAuthorized } = await importAdminAuth({
      runtimeMode: "production",
      adminToken: ""
    });

    expect(requireAdminToken(null)).toBe(false);
    expect(isAdminPageAuthorized(undefined)).toBe(false);
  });

  it("requires an exact matching token when configured", async () => {
    const { requireAdminToken, isAdminPageAuthorized } = await importAdminAuth({
      runtimeMode: "production",
      adminToken: "secret"
    });

    expect(requireAdminToken("secret")).toBe(true);
    expect(requireAdminToken("wrong")).toBe(false);
    expect(isAdminPageAuthorized("secret")).toBe(true);
    expect(isAdminPageAuthorized("wrong")).toBe(false);
  });

  it("trims surrounding whitespace before comparing tokens", async () => {
    const { requireAdminToken, isAdminPageAuthorized } = await importAdminAuth({
      runtimeMode: "production",
      adminToken: "secret"
    });

    expect(requireAdminToken("  secret  ")).toBe(true);
    expect(isAdminPageAuthorized("  secret  ")).toBe(true);
  });
});
