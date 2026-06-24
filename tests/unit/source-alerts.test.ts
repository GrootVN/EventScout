import { describe, expect, it } from "vitest";
import type { SourceHealthReport } from "../../apps/web/lib/sources/health";
import type { SourceRunProviderSummary, SourceRunRecord } from "../../apps/web/lib/sources/runHistoryTypes";
import { evaluateSourceAlerts, summarizeSourceAlerts } from "../../apps/web/lib/sources/sourceAlerts";
import type { SourceAlert } from "../../apps/web/lib/sources/sourceAlertTypes";

const now = new Date("2026-06-24T12:00:00.000Z");

function makeHealthProvider(overrides: Partial<SourceHealthReport["providers"][number]> = {}) {
  return {
    sourceId: "mock",
    sourceName: "Mock Provider",
    sourceType: "mock",
    enabled: true,
    status: "ready" as const,
    summary: "Configured and ready.",
    configNotes: [],
    warnings: [],
    errors: [],
    warningCount: 0,
    errorCount: 0,
    counters: {},
    ...overrides
  };
}

function makeHealth(providers: SourceHealthReport["providers"] = [makeHealthProvider()]): SourceHealthReport {
  return {
    generatedAt: "2026-06-24T12:00:00.000Z",
    config: {
      adminTokenConfigured: true,
      mockProviderEnabled: true,
      communityMockProviderEnabled: false,
      curatedProviderEnabled: false,
      communitySubmissionsProviderEnabled: false,
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
      providerCount: providers.length,
      enabledProviderCount: providers.filter((provider) => provider.enabled).length,
      readyProviderCount: providers.filter((provider) => provider.status === "ready").length,
      warningProviderCount: providers.filter((provider) => provider.status === "warning").length,
      errorProviderCount: providers.filter((provider) => provider.status === "error").length,
      needsConfigProviderCount: providers.filter((provider) => provider.status === "needs-config").length,
      disabledProviderCount: providers.filter((provider) => provider.status === "disabled").length
    },
    providers,
    warnings: providers.flatMap((provider) => provider.warnings),
    errors: providers.flatMap((provider) => provider.errors)
  };
}

function makeProviderSummary(
  providerId: string,
  status: SourceRunProviderSummary["status"],
  counts: Partial<Pick<SourceRunProviderSummary, "rawCount" | "validCount" | "droppedCount" | "finalCount">> = {}
): SourceRunProviderSummary {
  return {
    providerId,
    providerName: providerId === "ticketmaster" ? "Ticketmaster" : "Mock Provider",
    sourceType: providerId === "ticketmaster" ? "api" : "mock",
    status,
    enabled: true,
    configured: true,
    rawCount: counts.rawCount ?? 10,
    validCount: counts.validCount ?? 10,
    droppedCount: counts.droppedCount ?? 0,
    finalCount: counts.finalCount ?? 10,
    duplicateGroupCount: 0,
    warningCount: status === "warning" ? 1 : 0,
    errorCount: status === "error" ? 1 : 0,
    warnings: status === "warning" ? ["warning"] : [],
    errors: status === "error" ? ["secret-token should not leak"] : [],
    startedAt: "2026-06-24T11:00:00.000Z",
    finishedAt: "2026-06-24T11:00:00.000Z",
    durationMs: 20
  };
}

function makeRun(
  id: string,
  finishedAt: string,
  provider: SourceRunProviderSummary = makeProviderSummary("mock", "success")
): SourceRunRecord {
  return {
    id,
    runType: "manual",
    appVersion: "0.13.1",
    startedAt: finishedAt,
    finishedAt,
    durationMs: 20,
    overallStatus: provider.status === "error" ? "error" : provider.status === "warning" ? "warning" : "success",
    enabledProviderCount: 1,
    disabledProviderCount: 0,
    needsConfigProviderCount: 0,
    rawCount: provider.rawCount,
    validCount: provider.validCount,
    droppedCount: provider.droppedCount,
    finalCount: provider.finalCount,
    duplicateGroupCount: 0,
    warningCount: provider.warningCount,
    errorCount: provider.errorCount,
    providers: [provider],
    metadata: {
      generatedBy: "test"
    }
  };
}

function alertIds(alerts: SourceAlert[]) {
  return alerts.map((alert) => alert.id);
}

describe("source alert evaluator", () => {
  it("returns no alerts for healthy providers with a recent successful run", () => {
    const alerts = evaluateSourceAlerts({
      health: makeHealth(),
      runHistory: [makeRun("run-1", "2026-06-24T11:00:00.000Z")],
      now
    });

    expect(alerts).toEqual([]);
  });

  it("creates a critical alert for an enabled real provider missing config", () => {
    const alerts = evaluateSourceAlerts({
      health: makeHealth([
        makeHealthProvider({
          sourceId: "ticketmaster",
          sourceName: "Ticketmaster",
          sourceType: "api",
          enabled: false,
          status: "needs-config",
          summary: "Feature is enabled, but required configuration is missing."
        })
      ]),
      runHistory: [makeRun("run-1", "2026-06-24T11:00:00.000Z")],
      now
    });

    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "provider-ticketmaster-missing-config",
          severity: "critical",
          category: "configuration",
          providerId: "ticketmaster"
        })
      ])
    );
  });

  it("detects provider warning and error streaks", () => {
    const warningAlerts = evaluateSourceAlerts({
      runHistory: [
        makeRun("run-3", "2026-06-24T11:00:00.000Z", makeProviderSummary("mock", "warning")),
        makeRun("run-2", "2026-06-24T10:00:00.000Z", makeProviderSummary("mock", "warning")),
        makeRun("run-1", "2026-06-24T09:00:00.000Z", makeProviderSummary("mock", "warning"))
      ],
      now
    });
    const errorAlerts = evaluateSourceAlerts({
      runHistory: [
        makeRun("run-2", "2026-06-24T11:00:00.000Z", makeProviderSummary("mock", "error")),
        makeRun("run-1", "2026-06-24T10:00:00.000Z", makeProviderSummary("mock", "error"))
      ],
      now
    });

    expect(alertIds(warningAlerts)).toContain("provider-mock-warning-streak");
    expect(alertIds(errorAlerts)).toContain("provider-mock-error-streak");
  });

  it("detects high drop rates and contribution drops", () => {
    const alerts = evaluateSourceAlerts({
      runHistory: [
        makeRun(
          "run-2",
          "2026-06-24T11:00:00.000Z",
          makeProviderSummary("mock", "warning", { rawCount: 10, validCount: 5, droppedCount: 5, finalCount: 0 })
        ),
        makeRun(
          "run-1",
          "2026-06-24T10:00:00.000Z",
          makeProviderSummary("mock", "success", { rawCount: 10, validCount: 10, droppedCount: 0, finalCount: 8 })
        )
      ],
      now
    });

    expect(alertIds(alerts)).toEqual(
      expect.arrayContaining(["provider-mock-high-drop-rate", "provider-mock-zero-contribution"])
    );
  });

  it("detects stale runs and no-contribution streaks", () => {
    const alerts = evaluateSourceAlerts({
      runHistory: [
        makeRun("run-3", "2026-06-22T11:00:00.000Z", makeProviderSummary("mock", "success", { finalCount: 0 })),
        makeRun("run-2", "2026-06-22T10:00:00.000Z", makeProviderSummary("mock", "success", { finalCount: 0 })),
        makeRun("run-1", "2026-06-22T09:00:00.000Z", makeProviderSummary("mock", "success", { finalCount: 0 }))
      ],
      now
    });

    expect(alertIds(alerts)).toEqual(
      expect.arrayContaining(["source-run-history-stale-success", "provider-mock-no-contribution-streak"])
    );
  });

  it("maps production safety alerts without exposing secrets in evidence", () => {
    const alerts = evaluateSourceAlerts({
      runHistory: [makeRun("run-1", "2026-06-24T11:00:00.000Z", makeProviderSummary("mock", "error"))],
      now,
      isProduction: true,
      runHistoryEnabled: false,
      productionSafety: {
        ok: false,
        errors: ["ADMIN_TOKEN is required in production."],
        warnings: ["ENABLE_DETAILED_HEALTH is enabled in production; detailed health must stay admin-protected."]
      }
    });
    const serialized = JSON.stringify(alerts);

    expect(alertIds(alerts)).toEqual(
      expect.arrayContaining([
        "production-source-run-history-disabled",
        "production-safety-error-admin-token-is-required-in-production",
        "production-safety-warning-enable-detailed-health-is-enabled-in-production-detailed-health-must-stay-admin-protected"
      ])
    );
    expect(serialized).not.toContain("secret-token");
  });

  it("sorts alerts deterministically and summarizes counts", () => {
    const alerts = evaluateSourceAlerts({
      health: makeHealth([
        makeHealthProvider({
          sourceId: "ticketmaster",
          sourceName: "Ticketmaster",
          sourceType: "api",
          enabled: false,
          status: "needs-config"
        })
      ]),
      runHistory: [
        makeRun(
          "run-2",
          "2026-06-24T11:00:00.000Z",
          makeProviderSummary("mock", "warning", { rawCount: 10, droppedCount: 5, finalCount: 0 })
        ),
        makeRun("run-1", "2026-06-24T10:00:00.000Z", makeProviderSummary("mock", "success"))
      ],
      now
    });
    const summary = summarizeSourceAlerts(alerts);

    expect(alertIds(alerts)).toEqual([...alertIds(alerts)].sort((left, right) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 } as const;
      const byId = new Map(alerts.map((alert) => [alert.id, alert]));
      const leftAlert = byId.get(left)!;
      const rightAlert = byId.get(right)!;
      return (
        severityOrder[leftAlert.severity] - severityOrder[rightAlert.severity] ||
        leftAlert.category.localeCompare(rightAlert.category) ||
        (leftAlert.providerId ?? "").localeCompare(rightAlert.providerId ?? "") ||
        left.localeCompare(right)
      );
    }));
    expect(summary.total).toBe(alerts.length);
    expect(summary.critical).toBeGreaterThan(0);
    expect(summary.warning).toBeGreaterThan(0);
    expect(summary.hasCritical).toBe(true);
    expect(summary.byProvider.mock).toBeGreaterThan(0);
  });

  it("handles missing history safely", () => {
    const alerts = evaluateSourceAlerts({
      health: makeHealth(),
      runHistory: [],
      now
    });

    expect(alertIds(alerts)).toContain("source-run-history-no-runs");
  });
});
