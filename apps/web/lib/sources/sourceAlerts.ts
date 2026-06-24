import { validateProductionSafety, type ProductionSafetyCheck } from "@/lib/config/env";
import { isProduction as getRuntimeIsProduction } from "@/lib/config/runtime";
import type { SourceHealthReport } from "./health";
import { getSourceHealthReport } from "./health";
import { isSourceRunHistoryEnabled, listSourceRuns } from "./runHistoryStore";
import { getProviderTrend } from "./runHistoryStats";
import type { SourceRunProviderSummary, SourceRunRecord } from "./runHistoryTypes";
import {
  DEFAULT_SOURCE_ALERT_THRESHOLDS,
  type SourceAlert,
  type SourceAlertCategory,
  type SourceAlertSeverity,
  type SourceAlertSummary,
  type SourceAlertThresholds
} from "./sourceAlertTypes";

export type EvaluateSourceAlertsInput = {
  health?: SourceHealthReport | null;
  latestRun?: SourceRunRecord | null;
  runHistory?: SourceRunRecord[];
  now?: Date;
  thresholds?: Partial<SourceAlertThresholds>;
  isProduction?: boolean;
  runHistoryEnabled?: boolean;
  productionSafety?: ProductionSafetyCheck;
};

export type CurrentSourceAlertsResult = {
  generatedAt: string;
  thresholds: SourceAlertThresholds;
  summary: SourceAlertSummary;
  alerts: SourceAlert[];
};

const severityRank: Record<SourceAlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2
};

const realProviderIds = new Set(["ticketmaster", "meetup", "ics", "rss"]);

function mergeThresholds(overrides: Partial<SourceAlertThresholds> | undefined): SourceAlertThresholds {
  return {
    ...DEFAULT_SOURCE_ALERT_THRESHOLDS,
    ...overrides
  };
}

function sortRuns(runs: SourceRunRecord[]) {
  return [...runs].sort((left, right) => right.finishedAt.localeCompare(left.finishedAt));
}

function latestFromHistory(runs: SourceRunRecord[]) {
  return sortRuns(runs)[0] ?? null;
}

function providerLabel(provider: SourceRunProviderSummary | SourceHealthReport["providers"][number] | null | undefined, providerId: string) {
  if (!provider) {
    return providerId;
  }

  return "providerName" in provider ? provider.providerName : provider.sourceName;
}

function makeAlert(input: {
  id: string;
  severity: SourceAlertSeverity;
  category: SourceAlertCategory;
  title: string;
  message: string;
  recommendedAction: string;
  providerId?: string;
  evidence?: Record<string, unknown>;
  createdAt?: string;
}): SourceAlert {
  return {
    id: input.id,
    severity: input.severity,
    category: input.category,
    status: "active",
    title: input.title,
    message: input.message,
    providerId: input.providerId,
    recommendedAction: input.recommendedAction,
    evidence: input.evidence,
    createdAt: input.createdAt
  };
}

function sanitizeIdPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeEvidence(evidence: Record<string, unknown>) {
  const blocked = /token|key|secret|password|credential/i;
  return Object.fromEntries(Object.entries(evidence).filter(([key]) => !blocked.test(key)));
}

function addConfigurationAlerts(alerts: SourceAlert[], health: SourceHealthReport | null, createdAt: string) {
  if (!health) {
    return;
  }

  for (const provider of health.providers) {
    if (provider.status !== "needs-config") {
      continue;
    }

    const severity: SourceAlertSeverity = realProviderIds.has(provider.sourceId) ? "critical" : "warning";
    alerts.push(
      makeAlert({
        id: `provider-${provider.sourceId}-missing-config`,
        severity,
        category: "configuration",
        providerId: provider.sourceId,
        title: `${provider.sourceName} is enabled but missing configuration`,
        message: `${provider.sourceName} cannot fetch events until required configuration is provided.`,
        recommendedAction: `Set the required ${provider.sourceName} environment variables or disable the provider flag.`,
        evidence: sanitizeEvidence({
          status: provider.status,
          sourceType: provider.sourceType,
          enabled: provider.enabled
        }),
        createdAt
      })
    );
  }
}

function addHealthRuntimeAlerts(alerts: SourceAlert[], health: SourceHealthReport | null, createdAt: string) {
  if (!health) {
    return;
  }

  for (const provider of health.providers) {
    if (provider.status !== "error") {
      continue;
    }

    alerts.push(
      makeAlert({
        id: `provider-${provider.sourceId}-health-error`,
        severity: "critical",
        category: "runtime",
        providerId: provider.sourceId,
        title: `${provider.sourceName} has active source errors`,
        message: `${provider.sourceName} reported ${provider.errorCount} active error${provider.errorCount === 1 ? "" : "s"}.`,
        recommendedAction: "Review provider diagnostics and upstream availability before relying on this source.",
        evidence: sanitizeEvidence({
          status: provider.status,
          errorCount: provider.errorCount
        }),
        createdAt
      })
    );
  }
}

function addRunProviderAlerts(
  alerts: SourceAlert[],
  runHistory: SourceRunRecord[],
  thresholds: SourceAlertThresholds,
  createdAt: string
) {
  const providerIds = [...new Set(runHistory.flatMap((run) => run.providers.map((provider) => provider.providerId)))].sort(
    (left, right) => left.localeCompare(right)
  );

  for (const providerId of providerIds) {
    const trend = getProviderTrend(providerId, runHistory);
    const providerName = providerLabel(trend.latest ?? trend.previous, providerId);
    const latest = trend.latest;
    const previous = trend.previous;

    if (trend.errorStreak >= thresholds.errorStreakThreshold) {
      alerts.push(
        makeAlert({
          id: `provider-${providerId}-error-streak`,
          severity: "critical",
          category: "runtime",
          providerId,
          title: `${providerName} has repeated source errors`,
          message: `${providerName} has errored for ${trend.errorStreak} consecutive run${trend.errorStreak === 1 ? "" : "s"}.`,
          recommendedAction: "Inspect the provider diagnostics, credentials, source URLs, and upstream health.",
          evidence: sanitizeEvidence({
            errorStreak: trend.errorStreak,
            threshold: thresholds.errorStreakThreshold,
            latestFinishedAt: trend.lastSeenAt
          }),
          createdAt
        })
      );
    }

    if (trend.warningStreak >= thresholds.warningStreakThreshold) {
      alerts.push(
        makeAlert({
          id: `provider-${providerId}-warning-streak`,
          severity: "warning",
          category: "runtime",
          providerId,
          title: `${providerName} has repeated source warnings`,
          message: `${providerName} has warned for ${trend.warningStreak} consecutive run${trend.warningStreak === 1 ? "" : "s"}.`,
          recommendedAction: "Review warning diagnostics and decide whether the source needs configuration or data cleanup.",
          evidence: sanitizeEvidence({
            warningStreak: trend.warningStreak,
            threshold: thresholds.warningStreakThreshold,
            latestFinishedAt: trend.lastSeenAt
          }),
          createdAt
        })
      );
    }

    if (latest && latest.rawCount > 0) {
      const dropRate = latest.droppedCount / latest.rawCount;
      if (dropRate >= thresholds.dropRateWarningThreshold) {
        alerts.push(
          makeAlert({
            id: `provider-${providerId}-high-drop-rate`,
            severity: "warning",
            category: "data-quality",
            providerId,
            title: `${providerName} is dropping many records`,
            message: `${providerName} dropped ${latest.droppedCount} of ${latest.rawCount} raw record${latest.rawCount === 1 ? "" : "s"} in the latest run.`,
            recommendedAction: "Inspect normalization warnings and source data shape before promoting this source.",
            evidence: sanitizeEvidence({
              rawCount: latest.rawCount,
              droppedCount: latest.droppedCount,
              dropRate,
              threshold: thresholds.dropRateWarningThreshold
            }),
            createdAt
          })
        );
      }
    }

    if (latest && previous && previous.finalCount > 0 && latest.finalCount === 0) {
      alerts.push(
        makeAlert({
          id: `provider-${providerId}-zero-contribution`,
          severity: latest.errorCount > 0 || latest.status === "error" ? "critical" : "warning",
          category: "runtime",
          providerId,
          title: `${providerName} stopped contributing events`,
          message: `${providerName} contributed events previously but contributed none in the latest run.`,
          recommendedAction: "Compare the latest run with the previous successful run and inspect provider diagnostics.",
          evidence: sanitizeEvidence({
            previousFinalCount: previous.finalCount,
            latestFinalCount: latest.finalCount,
            latestStatus: latest.status
          }),
          createdAt
        })
      );
    } else if (latest && previous && previous.finalCount > 0 && latest.finalCount > 0) {
      const contributionRatio = latest.finalCount / previous.finalCount;
      if (contributionRatio <= 1 - thresholds.sharpDropRatio) {
        alerts.push(
          makeAlert({
            id: `provider-${providerId}-sharp-contribution-drop`,
            severity: "warning",
            category: "runtime",
            providerId,
            title: `${providerName} contribution dropped sharply`,
            message: `${providerName} final contribution fell from ${previous.finalCount} to ${latest.finalCount}.`,
            recommendedAction: "Check source freshness, upstream result counts, and normalization drops.",
            evidence: sanitizeEvidence({
              previousFinalCount: previous.finalCount,
              latestFinalCount: latest.finalCount,
              contributionRatio,
              sharpDropRatio: thresholds.sharpDropRatio
            }),
            createdAt
          })
        );
      }
    }

    const recent = runHistory
      .filter((run) => run.providers.some((provider) => provider.providerId === providerId))
      .slice(0, thresholds.noContributionRunThreshold);
    if (
      recent.length >= thresholds.noContributionRunThreshold &&
      recent.every((run) => {
        const provider = run.providers.find((entry) => entry.providerId === providerId);
        return provider ? provider.enabled && provider.finalCount === 0 : false;
      })
    ) {
      alerts.push(
        makeAlert({
          id: `provider-${providerId}-no-contribution-streak`,
          severity: "warning",
          category: "freshness",
          providerId,
          title: `${providerName} has not contributed recently`,
          message: `${providerName} contributed no final events for ${thresholds.noContributionRunThreshold} consecutive run${thresholds.noContributionRunThreshold === 1 ? "" : "s"}.`,
          recommendedAction: "Review whether this source is stale, misconfigured, or no longer useful.",
          evidence: sanitizeEvidence({
            runThreshold: thresholds.noContributionRunThreshold,
            runIds: recent.map((run) => run.id)
          }),
          createdAt
        })
      );
    }
  }
}

function addFreshnessAlerts(
  alerts: SourceAlert[],
  latestRun: SourceRunRecord | null,
  thresholds: SourceAlertThresholds,
  now: Date,
  createdAt: string
) {
  if (!latestRun) {
    alerts.push(
      makeAlert({
        id: "source-run-history-no-runs",
        severity: "warning",
        category: "freshness",
        title: "No source-run history is available",
        message: "Source alerts do not have a recent successful source-run snapshot to evaluate freshness trends.",
        recommendedAction: "Run aggregator QA or record a health snapshot to seed source-run history.",
        evidence: sanitizeEvidence({
          staleRunHours: thresholds.staleRunHours
        }),
        createdAt
      })
    );
    return;
  }

  const latestFinishedAt = Date.parse(latestRun.finishedAt);
  if (!Number.isFinite(latestFinishedAt)) {
    return;
  }

  const ageHours = (now.getTime() - latestFinishedAt) / (60 * 60 * 1000);
  if (ageHours >= thresholds.staleRunHours || latestRun.overallStatus !== "success") {
    alerts.push(
      makeAlert({
        id: "source-run-history-stale-success",
        severity: "warning",
        category: "freshness",
        title: "No recent successful source run",
        message:
          latestRun.overallStatus === "success"
            ? `The latest successful source run is ${Math.round(ageHours)} hours old.`
            : "The latest source run did not complete successfully.",
        recommendedAction: "Run aggregator QA or record a new health snapshot and review provider diagnostics.",
        evidence: sanitizeEvidence({
          latestRunId: latestRun.id,
          latestRunStatus: latestRun.overallStatus,
          latestFinishedAt: latestRun.finishedAt,
          ageHours,
          staleRunHours: thresholds.staleRunHours
        }),
        createdAt
      })
    );
  }
}

function addProductionSafetyAlerts(
  alerts: SourceAlert[],
  productionSafety: ProductionSafetyCheck | undefined,
  isProduction: boolean,
  runHistoryEnabled: boolean,
  createdAt: string
) {
  if (!isProduction) {
    return;
  }

  if (!runHistoryEnabled) {
    alerts.push(
      makeAlert({
        id: "production-source-run-history-disabled",
        severity: "critical",
        category: "production-safety",
        title: "Source-run history is disabled in production",
        message: "Source alerts need source-run history to evaluate freshness and provider trends reliably.",
        recommendedAction: "Enable source-run history or document why production alert freshness is intentionally unavailable.",
        evidence: sanitizeEvidence({
          runHistoryEnabled
        }),
        createdAt
      })
    );
  }

  for (const error of productionSafety?.errors ?? []) {
    alerts.push(
      makeAlert({
        id: `production-safety-error-${sanitizeIdPart(error)}`,
        severity: "critical",
        category: "production-safety",
        title: "Production safety check failed",
        message: error,
        recommendedAction: "Fix production environment configuration before exposing admin or provider surfaces.",
        createdAt
      })
    );
  }

  for (const warning of productionSafety?.warnings ?? []) {
    alerts.push(
      makeAlert({
        id: `production-safety-warning-${sanitizeIdPart(warning)}`,
        severity: "warning",
        category: "production-safety",
        title: "Production safety warning",
        message: warning,
        recommendedAction: "Review the production warning and decide whether it is intentional.",
        createdAt
      })
    );
  }
}

function dedupeAlerts(alerts: SourceAlert[]) {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    if (seen.has(alert.id)) {
      return false;
    }
    seen.add(alert.id);
    return true;
  });
}

function sortAlerts(alerts: SourceAlert[]) {
  return [...alerts].sort(
    (left, right) =>
      severityRank[left.severity] - severityRank[right.severity] ||
      left.category.localeCompare(right.category) ||
      (left.providerId ?? "").localeCompare(right.providerId ?? "") ||
      left.id.localeCompare(right.id)
  );
}

export function evaluateSourceAlerts(input: EvaluateSourceAlertsInput): SourceAlert[] {
  const thresholds = mergeThresholds(input.thresholds);
  const now = input.now ?? new Date();
  const createdAt = now.toISOString();
  const runHistory = sortRuns(input.runHistory ?? []);
  const latestRun = input.latestRun ?? latestFromHistory(runHistory);
  const isProduction = input.isProduction ?? false;
  const runHistoryEnabled = input.runHistoryEnabled ?? true;
  const alerts: SourceAlert[] = [];

  addConfigurationAlerts(alerts, input.health ?? null, createdAt);
  addHealthRuntimeAlerts(alerts, input.health ?? null, createdAt);
  addRunProviderAlerts(alerts, runHistory, thresholds, createdAt);
  addFreshnessAlerts(alerts, latestRun, thresholds, now, createdAt);
  addProductionSafetyAlerts(alerts, input.productionSafety, isProduction, runHistoryEnabled, createdAt);

  return sortAlerts(dedupeAlerts(alerts));
}

export function summarizeSourceAlerts(alerts: SourceAlert[]): SourceAlertSummary {
  const byProvider: Record<string, number> = {};
  let critical = 0;
  let warning = 0;
  let info = 0;

  for (const alert of alerts) {
    if (alert.severity === "critical") {
      critical += 1;
    } else if (alert.severity === "warning") {
      warning += 1;
    } else {
      info += 1;
    }

    if (alert.providerId) {
      byProvider[alert.providerId] = (byProvider[alert.providerId] ?? 0) + 1;
    }
  }

  return {
    total: alerts.length,
    critical,
    warning,
    info,
    byProvider,
    hasCritical: critical > 0
  };
}

export function getCurrentSourceAlerts(now = new Date()): CurrentSourceAlertsResult {
  const health = getSourceHealthReport();
  const runHistory = listSourceRuns();
  const isProduction = getRuntimeIsProduction();
  const runHistoryEnabled = isSourceRunHistoryEnabled();
  const thresholds = mergeThresholds(undefined);
  const alerts = evaluateSourceAlerts({
    health,
    runHistory,
    now,
    thresholds,
    isProduction,
    runHistoryEnabled,
    productionSafety: validateProductionSafety()
  });

  return {
    generatedAt: now.toISOString(),
    thresholds,
    summary: summarizeSourceAlerts(alerts),
    alerts
  };
}
