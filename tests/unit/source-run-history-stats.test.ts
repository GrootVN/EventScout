import { describe, expect, it } from "vitest";
import { detectStaleProviders, getProviderTrend, summarizeRunHistory } from "../../apps/web/lib/sources/runHistoryStats";

function makeRun(
  id: string,
  finishedAt: string,
  overallStatus: "success" | "warning" | "error",
  providerStatus: "success" | "warning" | "error",
  providerId = "provider-a",
  counts = { rawCount: 4, validCount: 3, droppedCount: 1, finalCount: 3 }
) {
  return {
    id,
    runType: "manual" as const,
    appVersion: "0.13.0",
    startedAt: finishedAt,
    finishedAt,
    durationMs: 15,
    overallStatus,
    enabledProviderCount: 1,
    disabledProviderCount: 0,
    needsConfigProviderCount: 0,
    rawCount: counts.rawCount,
    validCount: counts.validCount,
    droppedCount: counts.droppedCount,
    finalCount: counts.finalCount,
    duplicateGroupCount: 0,
    warningCount: overallStatus === "warning" ? 1 : 0,
    errorCount: overallStatus === "error" ? 1 : 0,
    providers: [
      {
        providerId,
        providerName: providerId === "provider-a" ? "Provider A" : "Provider B",
        sourceType: "mock",
        status: providerStatus,
        enabled: true,
        configured: true,
        rawCount: counts.rawCount,
        validCount: counts.validCount,
        droppedCount: counts.droppedCount,
        finalCount: counts.finalCount,
        duplicateGroupCount: 0,
        warningCount: providerStatus === "warning" ? 1 : 0,
        errorCount: providerStatus === "error" ? 1 : 0,
        warnings: providerStatus === "warning" ? ["warning"] : [],
        errors: providerStatus === "error" ? ["error"] : [],
        startedAt: finishedAt,
        finishedAt,
        durationMs: 15
      }
    ],
    metadata: {
      generatedBy: "test",
      notes: "note"
    }
  };
}

describe("source run history stats", () => {
  it("summarizes the latest and previous runs and computes streaks", () => {
    const runs = [
      makeRun("run-1", "2026-06-21T09:00:00.000Z", "success", "success", "provider-a", {
        rawCount: 8,
        validCount: 8,
        droppedCount: 0,
        finalCount: 8
      }),
      makeRun("run-2", "2026-06-22T09:00:00.000Z", "error", "error", "provider-a", {
        rawCount: 6,
        validCount: 5,
        droppedCount: 1,
        finalCount: 5
      }),
      makeRun("run-3", "2026-06-23T09:00:00.000Z", "warning", "warning", "provider-a", {
        rawCount: 5,
        validCount: 4,
        droppedCount: 1,
        finalCount: 4
      })
    ];

    const summary = summarizeRunHistory(runs);

    expect(summary.latestRun?.id).toBe("run-3");
    expect(summary.previousRun?.id).toBe("run-2");
    expect(summary.rawDelta).toBe(-1);
    expect(summary.validDelta).toBe(-1);
    expect(summary.droppedDelta).toBe(0);
    expect(summary.finalDelta).toBe(-1);
    expect(summary.warningStreak).toBe(2);
    expect(summary.errorStreak).toBe(0);
    expect(summary.providersNeverSuccessful).toEqual([]);
  });

  it("tracks provider trends and never-successful providers", () => {
    const runs = [
      makeRun("run-1", "2024-06-20T10:00:00.000Z", "warning", "warning", "provider-b", {
        rawCount: 2,
        validCount: 1,
        droppedCount: 1,
        finalCount: 1
      }),
      makeRun("run-2", "2026-06-23T08:00:00.000Z", "success", "success", "provider-a", {
        rawCount: 7,
        validCount: 7,
        droppedCount: 0,
        finalCount: 7
      }),
      makeRun("run-3", "2026-06-23T09:00:00.000Z", "warning", "warning", "provider-a", {
        rawCount: 6,
        validCount: 5,
        droppedCount: 1,
        finalCount: 5
      })
    ];

    const trend = getProviderTrend("provider-a", runs);
    const staleProviders = detectStaleProviders(runs, 24);

    expect(trend.latest?.status).toBe("warning");
    expect(trend.previous?.status).toBe("success");
    expect(trend.rawDelta).toBe(-1);
    expect(trend.validDelta).toBe(-2);
    expect(trend.droppedDelta).toBe(1);
    expect(trend.finalDelta).toBe(-2);
    expect(trend.warningStreak).toBe(1);
    expect(trend.errorStreak).toBe(0);
    expect(trend.neverSuccessful).toBe(false);
    expect(staleProviders.some((provider) => provider.providerId === "provider-b")).toBe(true);
  });

  it("handles empty history safely", () => {
    const summary = summarizeRunHistory([]);

    expect(summary.latestRun).toBeNull();
    expect(summary.previousRun).toBeNull();
    expect(summary.rawDelta).toBe(0);
    expect(summary.validDelta).toBe(0);
    expect(summary.droppedDelta).toBe(0);
    expect(summary.finalDelta).toBe(0);
    expect(summary.warningStreak).toBe(0);
    expect(summary.errorStreak).toBe(0);
    expect(summary.providersNeverSuccessful).toEqual([]);
    expect(summary.staleProviders).toEqual([]);
  });
});
