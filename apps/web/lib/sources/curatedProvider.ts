import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/config/env";
import type { RawEvent } from "@/lib/events/types";
import type { CuratedEventRecord } from "@/lib/events/curatedSchema";
import { validateCuratedEvent } from "@/lib/events/curatedSchema";
import type { EventSourceProvider, FetchEventsInput } from "./provider";

type Diagnostic = {
  level: "warning" | "error";
  message: string;
};

export type CuratedProviderDiagnostics = {
  rawLoadedCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  suppressedCount: number;
  invalidCount: number;
  warnings: string[];
  errors: string[];
};

const DEFAULT_SOURCE_NAME = "Curated Admin Events";
const DEFAULT_CURATED_EVENTS_PATH = "apps/web/data/curated-events.json";

const zeroDiagnostics = (): CuratedProviderDiagnostics => ({
  rawLoadedCount: 0,
  approvedCount: 0,
  pendingCount: 0,
  rejectedCount: 0,
  suppressedCount: 0,
  invalidCount: 0,
  warnings: [],
  errors: []
});

let diagnostics = zeroDiagnostics();

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function record(level: Diagnostic["level"], message: string) {
  diagnostics[level === "warning" ? "warnings" : "errors"].push(message);
}

function resolveCuratedEventsPath() {
  return path.resolve(process.cwd(), clean(env.curatedEventsPath) || DEFAULT_CURATED_EVENTS_PATH);
}

function toRawEvent(record: CuratedEventRecord, fetchedAt: string): RawEvent {
  return {
    sourceId: "curated",
    sourceName: clean(record.sourceName) || DEFAULT_SOURCE_NAME,
    sourceType: "community",
    sourceEventId: clean(record.sourceEventId) || record.id,
    sourceUrl: record.sourceUrl,
    fetchedAt,
    raw: record
  };
}

function readCuratedPayload(payload: string) {
  const parsed = JSON.parse(payload) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Curated events file must contain a JSON array.");
  }

  return parsed;
}

function snapshotDiagnostics() {
  return {
    ...diagnostics,
    warnings: [...diagnostics.warnings],
    errors: [...diagnostics.errors]
  };
}

export function snapshotCuratedProviderDiagnostics() {
  return snapshotDiagnostics();
}

export function consumeCuratedProviderDiagnostics() {
  const current = snapshotDiagnostics();
  diagnostics = zeroDiagnostics();
  return current;
}

async function fetchCuratedEvents(_: FetchEventsInput): Promise<RawEvent[]> {
  if (!env.enableCuratedProvider) {
    diagnostics = zeroDiagnostics();
    return [];
  }

  diagnostics = zeroDiagnostics();

  const filePath = resolveCuratedEventsPath();
  let payload = "";
  try {
    payload = await readFile(filePath, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    record("error", `Curated events file could not be read at ${filePath}: ${reason}`);
    return [];
  }

  let entries: unknown[];
  try {
    entries = readCuratedPayload(payload);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    record("error", `Curated events file could not be parsed at ${filePath}: ${reason}`);
    return [];
  }

  diagnostics.rawLoadedCount = entries.length;

  const fetchedAt = new Date().toISOString();
  const rawEvents: RawEvent[] = [];

  for (const entry of entries) {
    const validation = validateCuratedEvent(entry);
    if (!validation.ok) {
      diagnostics.invalidCount += 1;
      record("warning", `Dropped invalid curated event (${validation.errors.join(", ")}).`);
      continue;
    }

    const curated = validation.value;
    for (const warning of validation.warnings) {
      record("warning", `Curated event ${curated.id}: ${warning}`);
    }
    const status = curated.status;

    if (status === "approved") {
      diagnostics.approvedCount += 1;
      rawEvents.push(toRawEvent(curated, fetchedAt));
      continue;
    }

    if (status === "pending") {
      diagnostics.pendingCount += 1;
    } else if (status === "rejected") {
      diagnostics.rejectedCount += 1;
    } else {
      diagnostics.suppressedCount += 1;
    }
    record("warning", `Skipped curated event ${curated.id} because its status is ${status}.`);
  }

  return rawEvents;
}

export const curatedProvider: EventSourceProvider = {
  sourceId: "curated",
  sourceName: DEFAULT_SOURCE_NAME,
  sourceType: "community",
  enabled: env.enableCuratedProvider,
  fetchEvents: fetchCuratedEvents
};
