import packageJson from "../../../../package.json";
import type { AggregatorQaReport } from "@/lib/events/aggregatorQa";
import type { SourceHealthReport } from "./health";
import type { SourceRunProviderSummary, SourceRunRecord, SourceRunStatus } from "./runHistoryTypes";

function makeRunId(prefix: string, timestamp: string) {
  return `${prefix}-${timestamp.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

function getAppVersion() {
  return packageJson.version as string;
}

function toRunStatus(status: SourceHealthReport["providers"][number]["status"]): SourceRunStatus {
  if (status === "disabled") {
    return "disabled";
  }

  if (status === "needs-config") {
    return "needs-config";
  }

  if (status === "error") {
    return "error";
  }

  if (status === "warning") {
    return "warning";
  }

  return "success";
}

function computeOverallStatus(providers: SourceRunProviderSummary[], hasErrors = false) {
  if (hasErrors || providers.some((provider) => provider.status === "error")) {
    return "error" as const;
  }

  if (providers.some((provider) => provider.status === "warning" || provider.droppedCount > 0 || provider.warningCount > 0 || provider.errorCount > 0)) {
    return "warning" as const;
  }

  return "success" as const;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function createQaProviderSummary(provider: AggregatorQaReport["enabledProviders"][number]): SourceRunProviderSummary {
  const warnings: string[] = [];
  const errors: string[] = [];
  const status: SourceRunStatus =
    provider.invalidCount && provider.invalidCount > 0
      ? "warning"
      : provider.invalidConversionCount && provider.invalidConversionCount > 0
        ? "warning"
        : provider.droppedCount > 0
          ? "warning"
          : "success";

  if (status === "warning") {
    warnings.push(
      provider.droppedCount > 0
        ? `Dropped ${provider.droppedCount} record${provider.droppedCount === 1 ? "" : "s"} during aggregation.`
        : `Provider ${provider.sourceName} reported a non-zero warning signal.`
    );
  }

  return {
    providerId: provider.sourceId,
    providerName: provider.sourceName,
    sourceType: provider.sourceType,
    status,
    enabled: true,
    configured: true,
    rawCount: provider.rawCount,
    validCount: provider.validCount,
    droppedCount: provider.droppedCount,
    finalCount: provider.finalContributionCount,
    duplicateGroupCount: 0,
    warningCount: warnings.length,
    errorCount: errors.length,
    warnings,
    errors,
    startedAt: null,
    finishedAt: null,
    durationMs: null
  };
}

function createHealthProviderSummary(
  provider: SourceHealthReport["providers"][number]
): SourceRunProviderSummary {
  const status = toRunStatus(provider.status);
  const rawCount = provider.counters.rawLoadedCount ?? provider.counters.totalSubmissions ?? provider.counters.emittedRawEventCount ?? 0;
  const validCount = provider.counters.approvedCount ?? provider.counters.emittedRawEventCount ?? rawCount;
  const droppedCount =
    (provider.counters.pendingCount ?? 0) +
    (provider.counters.rejectedCount ?? 0) +
    (provider.counters.suppressedCount ?? 0) +
    (provider.counters.invalidCount ?? 0) +
    (provider.counters.invalidConversionCount ?? 0);
  const finalCount = provider.counters.emittedRawEventCount ?? provider.counters.approvedCount ?? validCount;

  return {
    providerId: provider.sourceId,
    providerName: provider.sourceName,
    sourceType: provider.sourceType,
    status,
    enabled: provider.enabled,
    configured: status === "needs-config" ? false : provider.enabled ? true : null,
    rawCount,
    validCount,
    droppedCount,
    finalCount,
    duplicateGroupCount: 0,
    warningCount: provider.warningCount,
    errorCount: provider.errorCount,
    warnings: [...provider.warnings],
    errors: [...provider.errors],
    startedAt: null,
    finishedAt: null,
    durationMs: null
  };
}

function buildRecord(overall: Omit<SourceRunRecord, "overallStatus">, hasErrors = false): SourceRunRecord {
  return {
    ...overall,
    overallStatus: computeOverallStatus(overall.providers, hasErrors)
  };
}

export function buildSourceRunFromAggregatorQa(report: AggregatorQaReport): SourceRunRecord {
  const finishedAt = report.generatedAt;
  const providers = report.enabledProviders.map(createQaProviderSummary);
  const rawCount = sum(providers.map((provider) => provider.rawCount));
  const validCount = sum(providers.map((provider) => provider.validCount));
  const droppedCount = sum(providers.map((provider) => provider.droppedCount));
  const finalCount = sum(providers.map((provider) => provider.finalCount));
  const warningCount = report.warnings.length + sum(providers.map((provider) => provider.warningCount));
  const errorCount = report.errors.length + sum(providers.map((provider) => provider.errorCount));

  return buildRecord(
    {
    id: makeRunId("aggregator-qa", finishedAt),
    runType: "aggregator-qa",
    appVersion: getAppVersion(),
    startedAt: finishedAt,
    finishedAt,
    durationMs: 0,
    enabledProviderCount: report.enabledProviders.length,
    disabledProviderCount: 0,
    needsConfigProviderCount: 0,
    rawCount,
    validCount,
    droppedCount,
    finalCount,
    duplicateGroupCount: report.duplicateGroups.length,
    warningCount,
    errorCount,
    providers,
    metadata: {
      cityPreset: report.cityPreset?.cityId ?? null,
      generatedBy: "qa:aggregator",
      notes: report.city
    }
  },
    report.errors.length > 0
  );
}

export function buildSourceRunFromHealthSnapshot(snapshot: SourceHealthReport): SourceRunRecord {
  const finishedAt = snapshot.generatedAt;
  const providers = snapshot.providers.map(createHealthProviderSummary);
  const rawCount = sum(providers.map((provider) => provider.rawCount));
  const validCount = sum(providers.map((provider) => provider.validCount));
  const droppedCount = sum(providers.map((provider) => provider.droppedCount));
  const finalCount = sum(providers.map((provider) => provider.finalCount));
  const warningCount = sum(providers.map((provider) => provider.warningCount));
  const errorCount = sum(providers.map((provider) => provider.errorCount));

  return buildRecord(
    {
    id: makeRunId("health-snapshot", finishedAt),
    runType: "health-snapshot",
    appVersion: getAppVersion(),
    startedAt: finishedAt,
    finishedAt,
    durationMs: 0,
    enabledProviderCount: snapshot.totals.enabledProviderCount,
    disabledProviderCount: snapshot.totals.disabledProviderCount,
    needsConfigProviderCount: snapshot.totals.needsConfigProviderCount,
    rawCount,
    validCount,
    droppedCount,
    finalCount,
    duplicateGroupCount: 0,
    warningCount,
    errorCount,
    providers,
    metadata: {
      cityPreset: null,
      generatedBy: "health:snapshot",
      notes: "Source health snapshot"
    }
  },
    errorCount > 0
  );
}
