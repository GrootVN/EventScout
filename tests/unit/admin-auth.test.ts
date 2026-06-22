import { afterEach, describe, expect, it, vi } from "vitest";

async function importAdminAuth(adminToken: string) {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: {
      adminToken
    }
  }));
  return import("../../apps/web/lib/admin-auth");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("admin auth", () => {
  it("allows access when no admin token is configured", async () => {
    const { requireAdminToken, isAdminPageAuthorized } = await importAdminAuth("");

    expect(requireAdminToken(null)).toBe(true);
    expect(isAdminPageAuthorized(undefined)).toBe(true);
  });

  it("requires an exact matching token when configured", async () => {
    const { requireAdminToken, isAdminPageAuthorized } = await importAdminAuth("secret");

    expect(requireAdminToken("secret")).toBe(true);
    expect(requireAdminToken("wrong")).toBe(false);
    expect(isAdminPageAuthorized("secret")).toBe(true);
    expect(isAdminPageAuthorized("wrong")).toBe(false);
  });

  it("trims surrounding whitespace before comparing tokens", async () => {
    const { requireAdminToken, isAdminPageAuthorized } = await importAdminAuth("secret");

    expect(requireAdminToken("  secret  ")).toBe(true);
    expect(isAdminPageAuthorized("  secret  ")).toBe(true);
  });
});
