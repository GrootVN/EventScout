import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { env } from "@/lib/config/env";
import { isProduction } from "@/lib/config/runtime";
import type {
  PublicSourceRunHistorySummary,
  SourceRunProviderSummary,
  SourceRunRecord
} from "./runHistoryTypes";

type SourceRunHistoryFile = {
  version: 1;
  runs: SourceRunRecord[];
};

type SourceRunHistoryState = {
  loaded: boolean;
  writeDisabled: boolean;
  runs: SourceRunRecord[];
  warnings: string[];
};

const DEFAULT_HISTORY_PATH = ".eventscout/source-run-history.json";
const DEFAULT_HISTORY_LIMIT = 100;

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function historyEnabled() {
  return env.enableSourceRunHistory ?? !isProduction();
}

function historyLimit() {
  const limit = env.sourceRunHistoryLimit ?? DEFAULT_HISTORY_LIMIT;
  const parsed = typeof limit === "number" ? limit : Number.parseInt(String(limit), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_HISTORY_LIMIT;
}

function historyPath() {
  return path.resolve(process.cwd(), clean(env.sourceRunHistoryPath) || DEFAULT_HISTORY_PATH);
}

function createEmptyState(): SourceRunHistoryState {
  return {
    loaded: false,
    writeDisabled: false,
    runs: [],
    warnings: []
  };
}

let state = createEmptyState();

function cloneRecord(record: SourceRunRecord): SourceRunRecord {
  return {
    ...record,
    providers: record.providers.map((provider) => ({
      ...provider,
      warnings: [...provider.warnings],
      errors: [...provider.errors]
    })),
    metadata: { ...record.metadata }
  };
}

function normalizeRecord(record: SourceRunRecord): SourceRunRecord {
  return cloneRecord(record);
}

function pushWarning(message: string) {
  state.warnings.push(message);
}

function loadFileIfNeeded() {
  if (state.loaded) {
    return;
  }

  state.loaded = true;

  if (!historyEnabled()) {
    return;
  }

  const filePath = historyPath();
  if (!existsSync(filePath)) {
    return;
  }

  try {
    const payload = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(payload) as unknown;
    const runs = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && "runs" in parsed
        ? (parsed as SourceRunHistoryFile).runs
        : [];

    if (!Array.isArray(runs)) {
      throw new Error("source run history file must contain an array of runs");
    }

    state.runs = runs
      .filter((run): run is SourceRunRecord => Boolean(run && typeof run === "object" && typeof (run as SourceRunRecord).id === "string"))
      .map(cloneRecord);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    state.runs = [];
    pushWarning(`Source run history could not be read from ${filePath}: ${reason}`);
  }
}

function persistHistory() {
  if (!historyEnabled() || state.writeDisabled) {
    return;
  }

  const filePath = historyPath();

  try {
    mkdirSync(path.dirname(filePath), { recursive: true });
    const payload: SourceRunHistoryFile = {
      version: 1,
      runs: state.runs.slice(0, historyLimit()).map(cloneRecord)
    };
    writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    state.writeDisabled = true;
    pushWarning(`Source run history could not be written to ${filePath}: ${reason}`);
  }
}

function ensureLoaded() {
  loadFileIfNeeded();
}

function takeRuns(limit?: number) {
  const max = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : historyLimit();
  return state.runs.slice(0, max).map(cloneRecord);
}

function filterProviderHistory(providerId: string) {
  return state.runs
    .flatMap((run) =>
      run.providers.filter((provider) => provider.providerId === providerId).map((provider) => ({
        ...provider,
        warnings: [...provider.warnings],
        errors: [...provider.errors]
      }))
    )
    .map((provider) => ({
      ...provider,
      warnings: [...provider.warnings],
      errors: [...provider.errors]
    }));
}

export function isSourceRunHistoryEnabled() {
  return historyEnabled();
}

export function getSourceRunHistoryPath() {
  return historyPath();
}

export function getSourceRunHistoryLimit() {
  return historyLimit();
}

export function getPublicSourceRunHistorySummary(): PublicSourceRunHistorySummary {
  const latest = getLatestSourceRun();
  return {
    latestRunAt: latest?.finishedAt ?? null,
    latestRunStatus: latest?.overallStatus ?? null,
    runHistoryEnabled: historyEnabled()
  };
}

export function consumeSourceRunHistoryWarnings() {
  const warnings = [...state.warnings];
  state.warnings = [];
  return warnings;
}

export function listSourceRuns(limit?: number) {
  ensureLoaded();
  return takeRuns(limit);
}

export function getSourceRun(id: string) {
  ensureLoaded();
  const record = state.runs.find((run) => run.id === id);
  return record ? cloneRecord(record) : null;
}

export function appendSourceRun(record: SourceRunRecord) {
  if (!historyEnabled()) {
    return cloneRecord(normalizeRecord(record));
  }

  ensureLoaded();

  const nextRecord = normalizeRecord(record);
  state.runs = [nextRecord, ...state.runs.filter((existing) => existing.id !== nextRecord.id)].slice(0, historyLimit());
  persistHistory();
  return cloneRecord(nextRecord);
}

export function clearSourceRunsForTests() {
  state = createEmptyState();
  state.loaded = true;
}

export function getLatestSourceRun() {
  ensureLoaded();
  const record = state.runs[0];
  return record ? cloneRecord(record) : null;
}

export function getProviderHistory(providerId: string, limit = 10) {
  ensureLoaded();
  const providers = filterProviderHistory(providerId);
  const max = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
  return providers.slice(0, max).map((provider) => ({
    ...provider,
    warnings: [...provider.warnings],
    errors: [...provider.errors]
  })) as SourceRunProviderSummary[];
}
