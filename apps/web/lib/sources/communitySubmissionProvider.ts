import { env } from "@/lib/config/env";
import type { RawEvent } from "@/lib/events/types";
import { listSubmissions } from "@/lib/submissions/submissionStore";
import { communitySubmissionToCuratedEvent } from "@/lib/submissions/toCuratedEvent";
import type { EventSourceProvider, FetchEventsInput } from "./provider";

type Diagnostic = {
  level: "warning" | "error";
  message: string;
};

export type CommunitySubmissionProviderDiagnostics = {
  totalSubmissions: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  suppressedCount: number;
  emittedRawEventCount: number;
  invalidConversionCount: number;
  warnings: string[];
  errors: string[];
};

const diagnostics: CommunitySubmissionProviderDiagnostics = zeroDiagnostics();

function zeroDiagnostics(): CommunitySubmissionProviderDiagnostics {
  return {
    totalSubmissions: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    suppressedCount: 0,
    emittedRawEventCount: 0,
    invalidConversionCount: 0,
    warnings: [],
    errors: []
  };
}

function record(level: Diagnostic["level"], message: string) {
  diagnostics[level === "warning" ? "warnings" : "errors"].push(message);
}

export function consumeCommunitySubmissionProviderDiagnostics() {
  const current = {
    ...diagnostics,
    warnings: [...diagnostics.warnings],
    errors: [...diagnostics.errors]
  };

  const reset = zeroDiagnostics();
  Object.assign(diagnostics, reset);
  return current;
}

async function fetchCommunitySubmissions(_: FetchEventsInput): Promise<RawEvent[]> {
  if (!env.enableCommunitySubmissionsProvider) {
    Object.assign(diagnostics, zeroDiagnostics());
    return [];
  }

  const fetchedAt = new Date().toISOString();
  const submissions = listSubmissions();
  const rawEvents: RawEvent[] = [];

  Object.assign(diagnostics, zeroDiagnostics());
  diagnostics.totalSubmissions = submissions.length;

  for (const submission of submissions) {
    if (submission.status === "pending") {
      diagnostics.pendingCount += 1;
      continue;
    }

    if (submission.status === "rejected") {
      diagnostics.rejectedCount += 1;
      continue;
    }

    if (submission.status === "suppressed") {
      diagnostics.suppressedCount += 1;
      continue;
    }

    diagnostics.approvedCount += 1;

    try {
      const curatedEvent = communitySubmissionToCuratedEvent(submission);
      rawEvents.push({
        sourceId: "community-submissions",
        sourceName: "Community Submissions",
        sourceType: "community",
        sourceEventId: submission.id,
        sourceUrl: submission.sourceUrl,
        fetchedAt,
        raw: curatedEvent
      });
    } catch (error) {
      diagnostics.invalidConversionCount += 1;
      const reason = error instanceof Error ? error.message : String(error);
      record("warning", `Dropped community submission ${submission.id} because it could not be converted: ${reason}`);
    }
  }

  diagnostics.emittedRawEventCount = rawEvents.length;
  if (diagnostics.pendingCount > 0) {
    record("warning", `Skipped ${diagnostics.pendingCount} pending community submission${diagnostics.pendingCount === 1 ? "" : "s"}.`);
  }
  if (diagnostics.rejectedCount > 0) {
    record("warning", `Skipped ${diagnostics.rejectedCount} rejected community submission${diagnostics.rejectedCount === 1 ? "" : "s"}.`);
  }
  if (diagnostics.suppressedCount > 0) {
    record("warning", `Skipped ${diagnostics.suppressedCount} suppressed community submission${diagnostics.suppressedCount === 1 ? "" : "s"}.`);
  }

  return rawEvents;
}

export const communitySubmissionProvider: EventSourceProvider = {
  sourceId: "community-submissions",
  sourceName: "Community Submissions",
  sourceType: "community",
  enabled: env.enableCommunitySubmissionsProvider,
  fetchEvents: fetchCommunitySubmissions
};

