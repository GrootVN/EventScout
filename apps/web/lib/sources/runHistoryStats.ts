import type { SourceRunProviderSummary, SourceRunRecord } from "./runHistoryTypes";

export type SourceRunHistorySummary = {
  latestRun: SourceRunRecord | null;
  previousRun: SourceRunRecord | null;
  rawDelta: number;
  validDelta: number;
  droppedDelta: number;
  finalDelta: number;
  warningStreak: number;
  errorStreak: number;
  providersNeverSuccessful: string[];
  staleProviders: string[];
};

export type ProviderTrend = {
  providerId: string;
  providerName: string | null;
  latest: SourceRunProviderSummary | null;
  previous: SourceRunProviderSummary | null;
  rawDelta: number;
  validDelta: number;
  droppedDelta: number;
  finalDelta: number;
  warningStreak: number;
  errorStreak: number;
  neverSuccessful: boolean;
  lastSeenAt: string | null;
};

export type StaleProviderSummary = {
  providerId: string;
  providerName: string;
  lastSeenAt: string | null;
  ageHours: number | null;
};

function sortRuns(runs: SourceRunRecord[]) {
  return [...runs].sort((left, right) => right.finishedAt.localeCompare(left.finishedAt));
}

function countConsecutiveRuns(runs: SourceRunRecord[], predicate: (run: SourceRunRecord) => boolean) {
  let streak = 0;
  for (const run of sortRuns(runs)) {
    if (!predicate(run)) {
      break;
    }
    streak += 1;
  }

  return streak;
}

export function summarizeRunHistory(runs: SourceRunRecord[]): SourceRunHistorySummary {
  const ordered = sortRuns(runs);
  const latestRun = ordered[0] ?? null;
  const previousRun = ordered[1] ?? null;
  const providerSuccessMap = new Map<string, boolean>();
  for (const run of ordered) {
    for (const provider of run.providers) {
      const current = providerSuccessMap.get(provider.providerId) ?? false;
      providerSuccessMap.set(provider.providerId, current || provider.status === "success");
    }
  }
  const providersNeverSuccessful = [...providerSuccessMap.entries()]
    .filter(([, sawSuccess]) => !sawSuccess)
    .map(([providerId]) => providerId)
    .sort((left, right) => left.localeCompare(right));
  const staleProviders = detectStaleProviders(ordered, 72).map((provider) => provider.providerId);

  return {
    latestRun,
    previousRun,
    rawDelta: (latestRun?.rawCount ?? 0) - (previousRun?.rawCount ?? 0),
    validDelta: (latestRun?.validCount ?? 0) - (previousRun?.validCount ?? 0),
    droppedDelta: (latestRun?.droppedCount ?? 0) - (previousRun?.droppedCount ?? 0),
    finalDelta: (latestRun?.finalCount ?? 0) - (previousRun?.finalCount ?? 0),
    warningStreak: countConsecutiveRuns(ordered, (run) => run.overallStatus === "warning" || run.overallStatus === "error"),
    errorStreak: countConsecutiveRuns(ordered, (run) => run.overallStatus === "error"),
    providersNeverSuccessful,
    staleProviders
  };
}

export function getProviderTrend(providerId: string, runs: SourceRunRecord[]): ProviderTrend {
  const ordered = sortRuns(runs);
  const occurrences = ordered
    .map((run) => ({
      run,
      provider: run.providers.find((entry) => entry.providerId === providerId) ?? null
    }))
    .filter((entry): entry is { run: SourceRunRecord; provider: SourceRunProviderSummary } => Boolean(entry.provider));

  const latest = occurrences[0]?.provider ?? null;
  const previous = occurrences[1]?.provider ?? null;
  const latestRun = occurrences[0]?.run ?? null;
  const neverSuccessful = occurrences.every((entry) => entry.provider.status !== "success");

  let warningStreak = 0;
  let errorStreak = 0;
  for (const occurrence of occurrences) {
    if (occurrence.provider.status === "warning") {
      warningStreak += 1;
      continue;
    }
    break;
  }

  for (const occurrence of occurrences) {
    if (occurrence.provider.status === "error") {
      errorStreak += 1;
      continue;
    }
    break;
  }

  return {
    providerId,
    providerName: latest?.providerName ?? previous?.providerName ?? null,
    latest,
    previous,
    rawDelta: (latest?.rawCount ?? 0) - (previous?.rawCount ?? 0),
    validDelta: (latest?.validCount ?? 0) - (previous?.validCount ?? 0),
    droppedDelta: (latest?.droppedCount ?? 0) - (previous?.droppedCount ?? 0),
    finalDelta: (latest?.finalCount ?? 0) - (previous?.finalCount ?? 0),
    warningStreak,
    errorStreak,
    neverSuccessful,
    lastSeenAt: latestRun?.finishedAt ?? null
  };
}

export function detectStaleProviders(runs: SourceRunRecord[], maxAgeHours: number): StaleProviderSummary[] {
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) {
    return [];
  }

  const ordered = sortRuns(runs);
  if (ordered.length === 0) {
    return [];
  }

  const latestByProvider = new Map<string, SourceRunProviderSummary & { finishedAt: string }>();
  for (const run of ordered) {
    for (const provider of run.providers) {
      if (!latestByProvider.has(provider.providerId)) {
        latestByProvider.set(provider.providerId, {
          ...provider,
          finishedAt: run.finishedAt
        });
      }
    }
  }

  const now = Date.now();
  const thresholdMs = maxAgeHours * 60 * 60 * 1000;

  return [...latestByProvider.values()]
    .map((provider) => {
      const lastSeenAt = provider.finishedAt;
      const parsedLastSeen = Date.parse(lastSeenAt);
      const ageHours = Number.isFinite(parsedLastSeen) ? (now - parsedLastSeen) / (60 * 60 * 1000) : null;
      return {
        providerId: provider.providerId,
        providerName: provider.providerName,
        lastSeenAt,
        ageHours
      };
    })
    .filter((provider) => provider.ageHours !== null && provider.ageHours > thresholdMs / (60 * 60 * 1000))
    .sort((left, right) => (right.ageHours ?? 0) - (left.ageHours ?? 0));
}
