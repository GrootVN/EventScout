export type SourceAlertSeverity = "info" | "warning" | "critical";

export type SourceAlertCategory =
  | "configuration"
  | "runtime"
  | "freshness"
  | "production-safety"
  | "data-quality";

export type SourceAlertStatus = "active" | "resolved";

export type SourceAlert = {
  id: string;
  severity: SourceAlertSeverity;
  category: SourceAlertCategory;
  status: SourceAlertStatus;
  title: string;
  message: string;
  providerId?: string;
  recommendedAction: string;
  evidence?: Record<string, unknown>;
  createdAt?: string;
};

export type SourceAlertThresholds = {
  warningStreakThreshold: number;
  errorStreakThreshold: number;
  dropRateWarningThreshold: number;
  staleRunHours: number;
  noContributionRunThreshold: number;
  sharpDropRatio: number;
};

export type SourceAlertSummary = {
  total: number;
  critical: number;
  warning: number;
  info: number;
  byProvider: Record<string, number>;
  hasCritical: boolean;
};

export const DEFAULT_SOURCE_ALERT_THRESHOLDS: SourceAlertThresholds = {
  warningStreakThreshold: 3,
  errorStreakThreshold: 2,
  dropRateWarningThreshold: 0.3,
  staleRunHours: 24,
  noContributionRunThreshold: 3,
  sharpDropRatio: 0.7
};
