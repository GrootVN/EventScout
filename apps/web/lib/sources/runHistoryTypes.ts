export type SourceRunStatus = "success" | "warning" | "error" | "disabled" | "needs-config";

export type SourceRunProviderSummary = {
  providerId: string;
  providerName: string;
  sourceType: string | null;

  status: SourceRunStatus;

  enabled: boolean;
  configured: boolean | null;

  rawCount: number;
  validCount: number;
  droppedCount: number;
  finalCount: number;
  duplicateGroupCount: number;

  warningCount: number;
  errorCount: number;

  warnings: string[];
  errors: string[];

  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
};

export type SourceRunRecord = {
  id: string;
  runType: "aggregator-qa" | "health-snapshot" | "manual";
  appVersion: string;

  startedAt: string;
  finishedAt: string;
  durationMs: number;

  overallStatus: "success" | "warning" | "error";

  enabledProviderCount: number;
  disabledProviderCount: number;
  needsConfigProviderCount: number;

  rawCount: number;
  validCount: number;
  droppedCount: number;
  finalCount: number;
  duplicateGroupCount: number;

  warningCount: number;
  errorCount: number;

  providers: SourceRunProviderSummary[];

  metadata: {
    cityPreset?: string | null;
    generatedBy?: string;
    notes?: string | null;
  };
};

export type PublicSourceRunHistorySummary = {
  latestRunAt: string | null;
  latestRunStatus: SourceRunRecord["overallStatus"] | null;
  runHistoryEnabled: boolean;
};
