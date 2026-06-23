import { afterEach, describe, expect, it, vi } from "vitest";

async function importEnvModule(overrides: Record<string, string> = {}, runtimeMode = "development") {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", runtimeMode);
  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value);
  }

  return import("../../apps/web/lib/config/env");
}

async function importSubmissionStore(overrides: Record<string, string> = {}, runtimeMode = "production") {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", runtimeMode);
  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value);
  }

  return import("../../apps/web/lib/submissions/submissionStore");
}

async function importTrustedSourcesStore(overrides: Record<string, string> = {}, runtimeMode = "production") {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", runtimeMode);
  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value);
  }

  return import("../../apps/web/lib/trustedSourcesStore");
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("production safety validation", () => {
  it("requires an admin token and flags unsafe production defaults", async () => {
    const { validateProductionSafety } = await importEnvModule(
      {
        ADMIN_TOKEN: "",
        ENABLE_SAMPLE_SUBMISSIONS: "true",
        ENABLE_SAMPLE_TRUSTED_SOURCES: "true",
        ENABLE_DETAILED_HEALTH: "true",
        ENABLE_TICKETMASTER_PROVIDER: "true",
        TICKETMASTER_API_KEY: "",
        ENABLE_MEETUP_PROVIDER: "true",
        MEETUP_ACCESS_TOKEN: "",
        ENABLE_ICS_PROVIDER: "true",
        ICS_SOURCE_URLS: "",
        ENABLE_RSS_PROVIDER: "true",
        RSS_SOURCE_URLS: "",
        ENABLE_CURATED_PROVIDER: "true",
        CURATED_EVENTS_PATH: "apps/web/data/missing-curated-events.json"
      },
      "production"
    );

    const check = validateProductionSafety();

    expect(check.ok).toBe(false);
    expect(check.errors).toEqual(
      expect.arrayContaining([
        "ADMIN_TOKEN is required in production.",
        "ENABLE_SAMPLE_SUBMISSIONS must be false in production.",
        "ENABLE_SAMPLE_TRUSTED_SOURCES must be false in production."
      ])
    );
    expect(check.warnings).toEqual(
      expect.arrayContaining([
        "ENABLE_DETAILED_HEALTH is enabled in production; detailed health must stay admin-protected.",
        "Ticketmaster provider is enabled but TICKETMASTER_API_KEY is not configured.",
        "Meetup provider is enabled but MEETUP_ACCESS_TOKEN is not configured.",
        "ICS provider is enabled but ICS_SOURCE_URLS is empty.",
        "RSS provider is enabled but RSS_SOURCE_URLS is empty.",
        "Curated provider is enabled but the curated events file is missing."
      ])
    );
  });

  it("does not flag local development as a production safety failure", async () => {
    const { validateProductionSafety } = await importEnvModule(
      {
        ADMIN_TOKEN: "",
        ENABLE_SAMPLE_SUBMISSIONS: "true",
        ENABLE_SAMPLE_TRUSTED_SOURCES: "true"
      },
      "development"
    );

    const check = validateProductionSafety();

    expect(check.ok).toBe(true);
    expect(check.errors).toEqual([]);
  });
});

describe("sample data gating", () => {
  it("keeps submission samples out of production by default but allows explicit test resets", async () => {
    const store = await importSubmissionStore({ ENABLE_SAMPLE_SUBMISSIONS: "false" }, "production");

    expect(store.listSubmissions()).toEqual([]);

    store.resetSubmissionsForTests();
    expect(store.listSubmissions("pending").length).toBeGreaterThan(0);
  });

  it("keeps trusted source samples out of production by default but allows explicit test resets", async () => {
    const store = await importTrustedSourcesStore({ ENABLE_SAMPLE_TRUSTED_SOURCES: "false" }, "production");

    expect(store.listTrustedSources()).toEqual([]);

    store.resetTrustedSourcesForTests();
    expect(store.listTrustedSources().length).toBeGreaterThan(0);
  });
});
