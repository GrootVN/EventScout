import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

function makeTempPath(name: string) {
  return path.join(mkdtempSync(path.join(tmpdir(), "eventscout-history-")), name);
}

function makeRun(id: string, finishedAt: string, providerId = "provider-a") {
  return {
    id,
    runType: "manual" as const,
    appVersion: "0.13.0",
    startedAt: finishedAt,
    finishedAt,
    durationMs: 25,
    overallStatus: "success" as const,
    enabledProviderCount: 1,
    disabledProviderCount: 0,
    needsConfigProviderCount: 0,
    rawCount: 3,
    validCount: 2,
    droppedCount: 1,
    finalCount: 2,
    duplicateGroupCount: 0,
    warningCount: 0,
    errorCount: 0,
    providers: [
      {
        providerId,
        providerName: "Provider A",
        sourceType: "mock",
        status: "success" as const,
        enabled: true,
        configured: true,
        rawCount: 3,
        validCount: 2,
        droppedCount: 1,
        finalCount: 2,
        duplicateGroupCount: 0,
        warningCount: 0,
        errorCount: 0,
        warnings: [],
        errors: [],
        startedAt: finishedAt,
        finishedAt,
        durationMs: 25
      }
    ],
    metadata: {
      cityPreset: "cincinnati",
      generatedBy: "test",
      notes: "note"
    }
  };
}

async function importStore(historyPath: string, enabled = true, limit = 2) {
  vi.resetModules();
  vi.doMock("@/lib/config/runtime", () => ({
    isProduction: () => false
  }));
  vi.doMock("@/lib/config/env", () => ({
    env: {
      enableSourceRunHistory: enabled,
      sourceRunHistoryPath: historyPath,
      sourceRunHistoryLimit: limit
    }
  }));

  return import("../../apps/web/lib/sources/runHistoryStore");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("source run history store", () => {
  it("appends runs, keeps newest-first order, and enforces the history limit", async () => {
    const historyPath = makeTempPath("history.json");
    const store = await importStore(historyPath, true, 2);
    store.clearSourceRunsForTests();

    const first = store.appendSourceRun(makeRun("run-1", "2026-06-21T10:00:00.000Z"));
    const second = store.appendSourceRun(makeRun("run-2", "2026-06-22T10:00:00.000Z"));
    const third = store.appendSourceRun(makeRun("run-3", "2026-06-23T10:00:00.000Z"));

    expect(first.id).toBe("run-1");
    expect(second.id).toBe("run-2");
    expect(third.id).toBe("run-3");
    expect(store.listSourceRuns()).toHaveLength(2);
    expect(store.listSourceRuns().map((run) => run.id)).toEqual(["run-3", "run-2"]);
    expect(store.getLatestSourceRun()?.id).toBe("run-3");
    expect(store.getSourceRun("run-2")?.id).toBe("run-2");
  });

  it("filters provider history newest-first", async () => {
    const historyPath = makeTempPath("provider-history.json");
    const store = await importStore(historyPath, true, 5);
    store.clearSourceRunsForTests();

    store.appendSourceRun(makeRun("run-1", "2026-06-21T10:00:00.000Z", "provider-a"));
    store.appendSourceRun(makeRun("run-2", "2026-06-22T10:00:00.000Z", "provider-b"));
    store.appendSourceRun(makeRun("run-3", "2026-06-23T10:00:00.000Z", "provider-a"));

    expect(store.getProviderHistory("provider-a", 2).map((provider) => provider.providerId)).toEqual([
      "provider-a",
      "provider-a"
    ]);
    expect(store.getProviderHistory("provider-a", 2)[0]?.finishedAt).toBe("2026-06-23T10:00:00.000Z");
  });

  it("starts empty when the history file is missing", async () => {
    const historyPath = makeTempPath("missing-history.json");
    const store = await importStore(historyPath, true, 5);
    store.clearSourceRunsForTests();

    expect(store.listSourceRuns()).toEqual([]);
    expect(store.getLatestSourceRun()).toBeNull();
    expect(store.getSourceRun("missing")).toBeNull();
  });

  it("recovers safely from invalid JSON on disk", async () => {
    const historyPath = makeTempPath("invalid-history.json");
    writeFileSync(historyPath, "{ not-valid-json", "utf8");

    const store = await importStore(historyPath, true, 5);

    expect(store.listSourceRuns()).toEqual([]);
    expect(store.consumeSourceRunHistoryWarnings().some((warning) => warning.includes("could not be read"))).toBe(
      true
    );
  });

  it("warns but does not crash when the file path cannot be written", async () => {
    const historyPath = mkdtempSync(path.join(tmpdir(), "eventscout-blocked-history-"));
    const store = await importStore(historyPath, true, 5);
    store.clearSourceRunsForTests();

    const record = store.appendSourceRun(makeRun("run-blocked", "2026-06-23T10:00:00.000Z"));

    expect(record.id).toBe("run-blocked");
    expect(store.listSourceRuns()).toHaveLength(1);
    expect(store.consumeSourceRunHistoryWarnings().some((warning) => warning.includes("could not be written"))).toBe(
      true
    );
  });

  it("does not append when history is disabled", async () => {
    const historyPath = makeTempPath("disabled-history.json");
    const store = await importStore(historyPath, false, 5);
    store.clearSourceRunsForTests();

    store.appendSourceRun(makeRun("run-disabled", "2026-06-23T10:00:00.000Z"));

    expect(store.listSourceRuns()).toEqual([]);
  });
});
