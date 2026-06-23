import packageJson from "../../../../package.json";
import { requireAdminToken } from "@/lib/admin-auth";
import { env } from "@/lib/config/env";
import { isProduction } from "@/lib/config/runtime";
import { getRssSourceConfigs } from "@/config/rss-sources";
import { getIcsSourceConfigs } from "@/config/ics-sources";
import { getAllProviders } from "./registry";
import {
  snapshotCuratedProviderDiagnostics,
  type CuratedProviderDiagnostics
} from "./curatedProvider";
import {
  snapshotCommunitySubmissionProviderDiagnostics,
  type CommunitySubmissionProviderDiagnostics
} from "./communitySubmissionProvider";
import { snapshotIcsProviderDiagnostics, type IcsDiagnostic } from "./icsProvider";
import { snapshotMeetupProviderDiagnostics, type MeetupDiagnostic } from "./meetupProvider";
import { snapshotRssProviderDiagnostics, type RssDiagnostic } from "./rssProvider";
import {
  snapshotTicketmasterProviderDiagnostics,
  type TicketmasterDiagnostic
} from "./ticketmasterProvider";

export type SourceHealthStatus = "ready" | "warning" | "error" | "needs-config" | "disabled";

export type SourceHealthCounters = {
  totalSubmissions?: number;
  emittedRawEventCount?: number;
  invalidConversionCount?: number;
  rawLoadedCount?: number;
  approvedCount?: number;
  pendingCount?: number;
  rejectedCount?: number;
  suppressedCount?: number;
  invalidCount?: number;
};

export type SourceHealthEntry = {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  enabled: boolean;
  status: SourceHealthStatus;
  summary: string;
  configNotes: string[];
  warnings: string[];
  errors: string[];
  warningCount: number;
  errorCount: number;
  counters: SourceHealthCounters;
};

export type SourceHealthReport = {
  generatedAt: string;
  config: {
    adminTokenConfigured: boolean;
    mockProviderEnabled: boolean;
    communityMockProviderEnabled: boolean;
    curatedProviderEnabled: boolean;
    communitySubmissionsProviderEnabled: boolean;
    ticketmasterProviderEnabled: boolean;
    meetupProviderEnabled: boolean;
    icsProviderEnabled: boolean;
    rssProviderEnabled: boolean;
    websiteProviderEnabled: boolean;
    socialLeadProviderEnabled: boolean;
    icsSourceCount: number;
    rssSourceCount: number;
  };
  totals: {
    providerCount: number;
    enabledProviderCount: number;
    readyProviderCount: number;
    warningProviderCount: number;
    errorProviderCount: number;
    needsConfigProviderCount: number;
    disabledProviderCount: number;
  };
  providers: SourceHealthEntry[];
  warnings: string[];
  errors: string[];
};

export type PublicHealthSummary = {
  generatedAt: string;
  appVersion: string;
  status: "ok" | "degraded";
  totals: SourceHealthReport["totals"];
  warningCount: number;
  errorCount: number;
};

type ProviderDiagnosticsSnapshot =
  | CuratedProviderDiagnostics
  | CommunitySubmissionProviderDiagnostics
  | Array<TicketmasterDiagnostic | MeetupDiagnostic | IcsDiagnostic | RssDiagnostic>
  | null;

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function getAppVersion() {
  return packageJson.version as string;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function deriveStatus(
  providerId: string,
  enabled: boolean,
  diagnostics: ProviderDiagnosticsSnapshot
): SourceHealthStatus {
  if (!enabled) {
    return isFeatureFlagEnabled(providerId) && !hasRequiredConfig(providerId) ? "needs-config" : "disabled";
  }

  if (providerId === "ticketmaster" || providerId === "meetup" || providerId === "ics" || providerId === "rss") {
    if (Array.isArray(diagnostics) && diagnostics.some((diagnostic) => diagnostic.level === "error")) {
      return "error";
    }
    if (Array.isArray(diagnostics) && diagnostics.some((diagnostic) => diagnostic.level === "warning")) {
      return "warning";
    }
  }

  if (providerId === "curated") {
    const snapshot = diagnostics as CuratedProviderDiagnostics | null;
    if ((snapshot?.errors.length ?? 0) > 0) {
      return "error";
    }
    if ((snapshot?.invalidCount ?? 0) > 0) {
      return "warning";
    }
    return "ready";
  }

  if (providerId === "community-submissions") {
    const snapshot = diagnostics as CommunitySubmissionProviderDiagnostics | null;
    if ((snapshot?.errors.length ?? 0) > 0) {
      return "error";
    }
    if ((snapshot?.invalidConversionCount ?? 0) > 0) {
      return "warning";
    }
    return "ready";
  }

  if (providerId === "ticketmaster" || providerId === "meetup" || providerId === "ics" || providerId === "rss") {
    return "ready";
  }

  return "ready";
}

function deriveSummary(status: SourceHealthStatus, configNotes: string[], warningCount: number, errorCount: number) {
  if (status === "needs-config") {
    return "Feature is enabled, but required configuration is missing.";
  }

  if (status === "disabled") {
    return "Disabled by feature flag.";
  }

  if (status === "error") {
    return `${pluralize(errorCount, "error")} recorded.`;
  }

  if (status === "warning") {
    return `${pluralize(warningCount, "warning")} recorded.`;
  }

  if (configNotes.length > 0) {
    return configNotes[0]!;
  }

  return "Configured and ready.";
}

function notesForProvider(providerId: string) {
  if (providerId === "mock") {
    return ["Default local mock feed."];
  }

  if (providerId === "community-mock") {
    return ["Intentional community duplicate coverage for QA."];
  }

  if (providerId === "curated") {
    return ["File-backed curated/admin records.", "Only approved records are published."];
  }

  if (providerId === "community-submissions") {
    return ["In-memory moderation queue.", "Approved submissions are converted into curated events."];
  }

  if (providerId === "ticketmaster") {
    return env.ticketmasterApiKey
      ? ["`TICKETMASTER_API_KEY` is configured."]
      : ["`TICKETMASTER_API_KEY` is missing."];
  }

  if (providerId === "meetup") {
    return env.meetupAccessToken ? ["`MEETUP_ACCESS_TOKEN` is configured."] : ["`MEETUP_ACCESS_TOKEN` is missing."];
  }

  if (providerId === "ics") {
    const count = getIcsSourceConfigs().length;
    return count > 0
      ? [pluralize(count, "ICS source") + " configured."]
      : ["`ICS_SOURCE_URLS` is empty or invalid."];
  }

  if (providerId === "rss") {
    const count = getRssSourceConfigs().length;
    return count > 0
      ? [pluralize(count, "RSS source") + " configured."]
      : ["`RSS_SOURCE_URLS` is empty or invalid."];
  }

  if (providerId === "website") {
    return ["Allowlisted venue site adapter placeholder."];
  }

  if (providerId === "social") {
    return ["Placeholder for future social-lead intake."];
  }

  return [];
}

function diagnosticsForProvider(providerId: string): ProviderDiagnosticsSnapshot {
  if (providerId === "curated") {
    return snapshotCuratedProviderDiagnostics();
  }

  if (providerId === "community-submissions") {
    return snapshotCommunitySubmissionProviderDiagnostics();
  }

  if (providerId === "ticketmaster") {
    return snapshotTicketmasterProviderDiagnostics();
  }

  if (providerId === "meetup") {
    return snapshotMeetupProviderDiagnostics();
  }

  if (providerId === "ics") {
    return snapshotIcsProviderDiagnostics();
  }

  if (providerId === "rss") {
    return snapshotRssProviderDiagnostics();
  }

  return null;
}

function isDiagnosticObject(
  diagnostics: ProviderDiagnosticsSnapshot
): diagnostics is CuratedProviderDiagnostics | CommunitySubmissionProviderDiagnostics {
  return diagnostics !== null && !Array.isArray(diagnostics);
}

function countersForProvider(providerId: string, diagnostics: ProviderDiagnosticsSnapshot): SourceHealthCounters {
  if (providerId === "curated") {
    const snapshot = isDiagnosticObject(diagnostics) ? (diagnostics as CuratedProviderDiagnostics) : null;
    return {
      rawLoadedCount: snapshot?.rawLoadedCount ?? 0,
      approvedCount: snapshot?.approvedCount ?? 0,
      pendingCount: snapshot?.pendingCount ?? 0,
      rejectedCount: snapshot?.rejectedCount ?? 0,
      suppressedCount: snapshot?.suppressedCount ?? 0,
      invalidCount: snapshot?.invalidCount ?? 0
    };
  }

  if (providerId === "community-submissions") {
    const snapshot = isDiagnosticObject(diagnostics)
      ? (diagnostics as CommunitySubmissionProviderDiagnostics)
      : null;
    return {
      totalSubmissions: snapshot?.totalSubmissions ?? 0,
      emittedRawEventCount: snapshot?.emittedRawEventCount ?? 0,
      invalidConversionCount: snapshot?.invalidConversionCount ?? 0,
      pendingCount: snapshot?.pendingCount ?? 0,
      approvedCount: snapshot?.approvedCount ?? 0,
      rejectedCount: snapshot?.rejectedCount ?? 0,
      suppressedCount: snapshot?.suppressedCount ?? 0
    };
  }

  return {};
}

function warningsForProvider(diagnostics: ProviderDiagnosticsSnapshot) {
  if (Array.isArray(diagnostics)) {
    return diagnostics.filter((diagnostic) => diagnostic.level === "warning").map((diagnostic) => diagnostic.message);
  }

  return isDiagnosticObject(diagnostics) ? [...diagnostics.warnings] : [];
}

function errorsForProvider(diagnostics: ProviderDiagnosticsSnapshot) {
  if (Array.isArray(diagnostics)) {
    return diagnostics.filter((diagnostic) => diagnostic.level === "error").map((diagnostic) => diagnostic.message);
  }

  return isDiagnosticObject(diagnostics) ? [...diagnostics.errors] : [];
}

function isFeatureFlagEnabled(providerId: string) {
  if (providerId === "mock") {
    return env.enableMockProvider;
  }

  if (providerId === "community-mock") {
    return env.enableCommunityMockProvider;
  }

  if (providerId === "curated") {
    return env.enableCuratedProvider;
  }

  if (providerId === "community-submissions") {
    return env.enableCommunitySubmissionsProvider;
  }

  if (providerId === "ticketmaster") {
    return env.enableTicketmasterProvider;
  }

  if (providerId === "meetup") {
    return env.enableMeetupProvider;
  }

  if (providerId === "ics") {
    return env.enableIcsProvider;
  }

  if (providerId === "rss") {
    return env.enableRssProvider;
  }

  if (providerId === "website") {
    return env.enableWebsiteProvider;
  }

  if (providerId === "social") {
    return env.enableSocialLeads;
  }

  return true;
}

function hasRequiredConfig(providerId: string) {
  if (providerId === "ticketmaster") {
    return clean(env.ticketmasterApiKey).length > 0;
  }

  if (providerId === "meetup") {
    return clean(env.meetupAccessToken).length > 0;
  }

  if (providerId === "ics") {
    return getIcsSourceConfigs().length > 0;
  }

  if (providerId === "rss") {
    return getRssSourceConfigs().length > 0;
  }

  return true;
}

export function getSourceHealthReport(): SourceHealthReport {
  const providers = getAllProviders();
  const entries = providers.map((provider) => {
    const diagnostics = diagnosticsForProvider(provider.sourceId);
    const warnings = warningsForProvider(diagnostics);
    const errors = errorsForProvider(diagnostics);
    const enabled = provider.enabled;
    const status = deriveStatus(provider.sourceId, enabled, diagnostics);
    const configNotes = notesForProvider(provider.sourceId);
    const warningCount = warnings.length;
    const errorCount = errors.length;
    const counters = countersForProvider(provider.sourceId, diagnostics);

    return {
      sourceId: provider.sourceId,
      sourceName: provider.sourceName,
      sourceType: provider.sourceType,
      enabled,
      status,
      summary: deriveSummary(status, configNotes, warningCount, errorCount),
      configNotes,
      warnings,
      errors,
      warningCount,
      errorCount,
      counters
    } satisfies SourceHealthEntry;
  });

  const totals = entries.reduce(
    (accumulator, entry) => {
      accumulator.providerCount += 1;
      if (entry.enabled) {
        accumulator.enabledProviderCount += 1;
      }
      if (entry.status === "ready") {
        accumulator.readyProviderCount += 1;
      } else if (entry.status === "warning") {
        accumulator.warningProviderCount += 1;
      } else if (entry.status === "error") {
        accumulator.errorProviderCount += 1;
      } else if (entry.status === "needs-config") {
        accumulator.needsConfigProviderCount += 1;
      } else {
        accumulator.disabledProviderCount += 1;
      }
      return accumulator;
    },
    {
      providerCount: 0,
      enabledProviderCount: 0,
      readyProviderCount: 0,
      warningProviderCount: 0,
      errorProviderCount: 0,
      needsConfigProviderCount: 0,
      disabledProviderCount: 0
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    config: {
      adminTokenConfigured: clean(env.adminToken).length > 0,
      mockProviderEnabled: env.enableMockProvider,
      communityMockProviderEnabled: env.enableCommunityMockProvider,
      curatedProviderEnabled: env.enableCuratedProvider,
      communitySubmissionsProviderEnabled: env.enableCommunitySubmissionsProvider,
      ticketmasterProviderEnabled: env.enableTicketmasterProvider,
      meetupProviderEnabled: env.enableMeetupProvider,
      icsProviderEnabled: env.enableIcsProvider,
      rssProviderEnabled: env.enableRssProvider,
      websiteProviderEnabled: env.enableWebsiteProvider,
      socialLeadProviderEnabled: env.enableSocialLeads,
      icsSourceCount: getIcsSourceConfigs().length,
      rssSourceCount: getRssSourceConfigs().length
    },
    totals,
    providers: entries,
    warnings: entries.flatMap((entry) => entry.warnings),
    errors: entries.flatMap((entry) => entry.errors)
  };
}

export function getPublicHealthSummary(): PublicHealthSummary {
  const report = getSourceHealthReport();

  return {
    generatedAt: report.generatedAt,
    appVersion: getAppVersion(),
    status: report.errors.length > 0 ? "degraded" : "ok",
    totals: report.totals,
    warningCount: report.warnings.length,
    errorCount: report.errors.length
  };
}

export function canViewDetailedHealth(authToken: string | null | undefined) {
  if (!isProduction()) {
    return true;
  }

  if (!env.enableDetailedHealth) {
    return false;
  }

  return requireAdminToken(authToken ?? null);
}
