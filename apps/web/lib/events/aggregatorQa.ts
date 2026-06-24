import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dedupeEvents, getDedupeKey, isLikelyDuplicate } from "./dedupe";
import { normalizeRawEvent } from "./normalize";
import { validateScoutEvent } from "./schema";
import { filterSuppressedEvents } from "./suppression";
import type { OriginalSource, RawEvent, ScoutEvent } from "./types";
import { env } from "@/lib/config/env";
import { consumeCuratedProviderDiagnostics } from "@/lib/sources/curatedProvider";
import { consumeCommunitySubmissionProviderDiagnostics } from "@/lib/sources/communitySubmissionProvider";
import { getEnabledProviders } from "@/lib/sources/registry";
import {
  appendSourceRun,
  consumeSourceRunHistoryWarnings,
  isSourceRunHistoryEnabled,
  listSourceRuns
} from "@/lib/sources/runHistoryStore";
import { buildSourceRunFromAggregatorQa } from "@/lib/sources/runHistoryBuilder";
import { evaluateSourceAlerts, summarizeSourceAlerts } from "@/lib/sources/sourceAlerts";
import type { SourceAlertSummary } from "@/lib/sources/sourceAlertTypes";
import { consumeTicketmasterProviderDiagnostics } from "@/lib/sources/ticketmasterProvider";
import { consumeMeetupProviderDiagnostics } from "@/lib/sources/meetupProvider";
import { consumeIcsProviderDiagnostics } from "@/lib/sources/icsProvider";
import { consumeRssProviderDiagnostics } from "@/lib/sources/rssProvider";
import { getActiveCityPresetSummary } from "@/lib/sources/localPresetProvider";
import type { EventSourceProvider, FetchEventsInput } from "@/lib/sources/provider";

type ProviderSummary = {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  rawCount: number;
  validCount: number;
  droppedCount: number;
  finalContributionCount: number;
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

type DuplicateGroup = {
  dedupeKey: string;
  mergedEventId: string;
  title: string;
  date: string;
  venue: string | null;
  city: string;
  size: number;
  eventIds: string[];
  variantTitles: string[];
  sourceNames: string[];
  sourceUrls: string[];
  sources: OriginalSource[];
};

type CityPresetSummary = {
  cityId: string;
  cityName: string;
  region: string;
  country: string;
  defaultRadiusMiles: number;
  icsSourceCount: number;
  rssSourceCount: number;
  ticketmasterEnabled: boolean;
};

type EventRow = {
  id: string;
  title: string;
  date: string;
  venue: string | null;
  city: string;
  interests: string[];
  sourceName: string;
  sourceUrl: string;
  originalSourcesCount: number;
  originalSources: OriginalSource[];
};

export type AggregatorQaReport = {
  generatedAt: string;
  city: string;
  cityPreset: CityPresetSummary | null;
  enabledProviders: ProviderSummary[];
  curatedProvider: ProviderSummary | null;
  communitySubmissionsProvider: ProviderSummary | null;
  rawEventCount: number;
  validNormalizedCount: number;
  droppedInvalidCount: number;
  dedupedCount: number;
  finalCount: number;
  duplicateGroups: DuplicateGroup[];
  events: EventRow[];
  alertSummary: SourceAlertSummary;
  warnings: string[];
  errors: string[];
};

function defaultFetchInput(): FetchEventsInput {
  return {
    city: env.defaultCity,
    region: env.defaultRegion,
    country: env.defaultCountry
  };
}

function sortValues(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadSuppressedEventIds() {
  const { getEventRepository } = await import("@/lib/repository");
  return getEventRepository().listSuppressedEventIds();
}

function buildDuplicateGroups(events: ScoutEvent[], dedupedEvents: ScoutEvent[]): DuplicateGroup[] {
  const grouped = new Map<string, ScoutEvent[]>();

  for (const event of events) {
    const match = dedupedEvents.find((candidate) => {
      const exactKeyMatch = getDedupeKey(candidate) === getDedupeKey(event);
      return exactKeyMatch || isLikelyDuplicate(candidate, event);
    });

    const key = match?.id ?? event.id;
    const existing = grouped.get(key) ?? [];
    grouped.set(key, [...existing, event]);
  }

  return [...grouped.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const representative = group[0]!;
      const mergedEvent =
        dedupedEvents.find((candidate) => candidate.id === representative.id) ??
        dedupedEvents.find((candidate) => {
          const exactKeyMatch = getDedupeKey(candidate) === getDedupeKey(representative);
          return exactKeyMatch || isLikelyDuplicate(candidate, representative);
        }) ??
        representative;
      return {
        dedupeKey: getDedupeKey(representative),
        mergedEventId: mergedEvent.id,
        title: representative.title,
        date: representative.startDateTime,
        venue: representative.venueName,
        city: representative.city,
        size: group.length,
        eventIds: group.map((event) => event.id),
        variantTitles: sortValues(group.map((event) => event.title)),
        sourceNames: sortValues(group.map((event) => event.sourceName)),
        sourceUrls: sortValues(group.map((event) => event.sourceUrl)),
        sources: [...mergedEvent.originalSources].sort((left, right) =>
          left.sourceName.localeCompare(right.sourceName) || left.sourceUrl.localeCompare(right.sourceUrl)
        )
      };
    })
    .sort((left, right) => right.size - left.size || left.title.localeCompare(right.title));
}

function createProviderSummaries(
  providers: EventSourceProvider[],
  rawEvents: RawEvent[],
  normalizedEvents: ScoutEvent[],
  dedupedEvents: ScoutEvent[],
  curatedDiagnostics: ReturnType<typeof consumeCuratedProviderDiagnostics>,
  communityDiagnostics: ReturnType<typeof consumeCommunitySubmissionProviderDiagnostics>
) {
  return providers.map((provider) => {
    const rawCount = rawEvents.filter((event) => event.sourceId === provider.sourceId).length;
    const validCount = normalizedEvents.filter((event) => event.sourceId === provider.sourceId).length;
    const finalContributionCount = dedupedEvents.filter((event) =>
      event.originalSources.some((source) => source.sourceId === provider.sourceId)
    ).length;
    const curatedCounts =
      provider.sourceId === "curated"
        ? curatedDiagnostics
        : {
            rawLoadedCount: undefined,
            approvedCount: undefined,
            pendingCount: undefined,
            rejectedCount: undefined,
            suppressedCount: undefined,
            invalidCount: undefined,
            warnings: [],
            errors: []
          };
    const communityCounts =
      provider.sourceId === "community-submissions"
        ? communityDiagnostics
        : {
            totalSubmissions: undefined,
            pendingCount: undefined,
            approvedCount: undefined,
            rejectedCount: undefined,
            suppressedCount: undefined,
            emittedRawEventCount: undefined,
            invalidConversionCount: undefined,
            warnings: [],
            errors: []
          };

    return {
      sourceId: provider.sourceId,
      sourceName: provider.sourceName,
      sourceType: provider.sourceType,
      rawCount,
      validCount,
      droppedCount: rawCount - validCount,
      finalContributionCount,
      totalSubmissions: communityCounts.totalSubmissions,
      emittedRawEventCount: communityCounts.emittedRawEventCount,
      invalidConversionCount: communityCounts.invalidConversionCount,
      rawLoadedCount: curatedCounts.rawLoadedCount,
      approvedCount: curatedCounts.approvedCount,
      pendingCount: curatedCounts.pendingCount,
      rejectedCount: curatedCounts.rejectedCount,
      suppressedCount: curatedCounts.suppressedCount,
      invalidCount: curatedCounts.invalidCount
    };
  });
}

export async function generateAggregatorQaReport(
  input: FetchEventsInput = defaultFetchInput()
): Promise<AggregatorQaReport> {
  const providers = getEnabledProviders();
  const cityPreset = getActiveCityPresetSummary();
  const warnings: string[] = [];
  const errors: string[] = [];

  if (providers.length === 0) {
    warnings.push("No providers are currently enabled.");
  }

  const settled = await Promise.allSettled(
    providers.map(async (provider) => ({
      provider,
      events: await provider.fetchEvents(input)
    }))
  );

  const rawEvents: RawEvent[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      rawEvents.push(...result.value.events);
      continue;
    }

    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    errors.push(`Provider fetch failed: ${reason}`);
  }

  const normalizedEvents: ScoutEvent[] = [];
  let droppedInvalidCount = 0;

  for (const rawEvent of rawEvents) {
    try {
      const normalizedEvent = normalizeRawEvent(rawEvent);
      const validationErrors = validateScoutEvent(normalizedEvent);
      if (validationErrors.length > 0) {
        droppedInvalidCount += 1;
        warnings.push(
          `Dropped invalid event ${rawEvent.sourceId}:${rawEvent.sourceEventId ?? "unknown"} (${validationErrors.join(", ")})`
        );
        continue;
      }
      normalizedEvents.push(normalizedEvent);
    } catch (error) {
      droppedInvalidCount += 1;
      const reason = error instanceof Error ? error.message : String(error);
      warnings.push(
        `Dropped invalid event ${rawEvent.sourceId}:${rawEvent.sourceEventId ?? "unknown"} (${reason})`
      );
    }
  }

  const dedupedEvents = dedupeEvents(normalizedEvents);
  const suppressedEventIds = await loadSuppressedEventIds();
  const visibleDedupedEvents = filterSuppressedEvents(dedupedEvents, suppressedEventIds);
  const duplicateGroups = buildDuplicateGroups(normalizedEvents, visibleDedupedEvents);
  const curatedDiagnostics = consumeCuratedProviderDiagnostics();
  const communityDiagnostics = consumeCommunitySubmissionProviderDiagnostics();
  const curatedProvider = providers.find((provider) => provider.sourceId === "curated") ?? null;
  const communitySubmissionsProvider =
    providers.find((provider) => provider.sourceId === "community-submissions") ?? null;
  const suppressedFinalCount = dedupedEvents.length - visibleDedupedEvents.length;

  if (env.enableTicketmasterProvider && !env.ticketmasterApiKey) {
    warnings.push("Ticketmaster provider is enabled but TICKETMASTER_API_KEY is missing; the provider stays disabled.");
  }

  if (env.enableMeetupProvider && !env.meetupAccessToken) {
    warnings.push("Meetup provider is enabled but MEETUP_ACCESS_TOKEN is missing; the provider stays disabled.");
  }

  for (const diagnostic of consumeTicketmasterProviderDiagnostics()) {
    if (diagnostic.level === "warning") {
      warnings.push(diagnostic.message);
    } else {
      errors.push(diagnostic.message);
    }
  }

  for (const diagnostic of consumeMeetupProviderDiagnostics()) {
    if (diagnostic.level === "warning") {
      warnings.push(diagnostic.message);
    } else {
      errors.push(diagnostic.message);
    }
  }

  for (const diagnostic of consumeIcsProviderDiagnostics()) {
    if (diagnostic.level === "warning") {
      warnings.push(diagnostic.message);
    } else {
      errors.push(diagnostic.message);
    }
  }

  for (const diagnostic of consumeRssProviderDiagnostics()) {
    if (diagnostic.level === "warning") {
      warnings.push(diagnostic.message);
    } else {
      errors.push(diagnostic.message);
    }
  }

  warnings.push(...curatedDiagnostics.warnings);
  errors.push(...curatedDiagnostics.errors);
  warnings.push(...communityDiagnostics.warnings);
  errors.push(...communityDiagnostics.errors);

  if (suppressedFinalCount > 0) {
    warnings.push(
      `Suppressed ${suppressedFinalCount} event${suppressedFinalCount === 1 ? "" : "s"} from final output.`
    );
  }

  if (visibleDedupedEvents.length === 0) {
    warnings.push("Aggregation produced no final events.");
  }

  const report: AggregatorQaReport = {
    generatedAt: new Date().toISOString(),
    city: input.city,
    cityPreset,
    enabledProviders: createProviderSummaries(
      providers,
      rawEvents,
      normalizedEvents,
      visibleDedupedEvents,
      curatedDiagnostics,
      communityDiagnostics
    ),
    curatedProvider:
      curatedProvider && curatedProvider.enabled
        ? {
            sourceId: curatedProvider.sourceId,
            sourceName: curatedProvider.sourceName,
            sourceType: curatedProvider.sourceType,
            rawCount: rawEvents.filter((event) => event.sourceId === curatedProvider.sourceId).length,
            validCount: normalizedEvents.filter((event) => event.sourceId === curatedProvider.sourceId).length,
            droppedCount:
              rawEvents.filter((event) => event.sourceId === curatedProvider.sourceId).length -
              normalizedEvents.filter((event) => event.sourceId === curatedProvider.sourceId).length,
            finalContributionCount: visibleDedupedEvents.filter((event) =>
              event.originalSources.some((source) => source.sourceId === curatedProvider.sourceId)
            ).length,
            rawLoadedCount: curatedDiagnostics.rawLoadedCount,
            approvedCount: curatedDiagnostics.approvedCount,
            pendingCount: curatedDiagnostics.pendingCount,
            rejectedCount: curatedDiagnostics.rejectedCount,
            suppressedCount: curatedDiagnostics.suppressedCount,
            invalidCount: curatedDiagnostics.invalidCount
          }
        : null,
    communitySubmissionsProvider:
      communitySubmissionsProvider && communitySubmissionsProvider.enabled
        ? {
            sourceId: communitySubmissionsProvider.sourceId,
            sourceName: communitySubmissionsProvider.sourceName,
            sourceType: communitySubmissionsProvider.sourceType,
            rawCount: rawEvents.filter((event) => event.sourceId === communitySubmissionsProvider.sourceId).length,
            validCount: normalizedEvents.filter((event) => event.sourceId === communitySubmissionsProvider.sourceId).length,
            droppedCount:
              rawEvents.filter((event) => event.sourceId === communitySubmissionsProvider.sourceId).length -
              normalizedEvents.filter((event) => event.sourceId === communitySubmissionsProvider.sourceId).length,
            finalContributionCount: visibleDedupedEvents.filter((event) =>
              event.originalSources.some((source) => source.sourceId === communitySubmissionsProvider.sourceId)
            ).length,
            totalSubmissions: communityDiagnostics.totalSubmissions,
            emittedRawEventCount: communityDiagnostics.emittedRawEventCount,
            invalidConversionCount: communityDiagnostics.invalidConversionCount,
            pendingCount: communityDiagnostics.pendingCount,
            approvedCount: communityDiagnostics.approvedCount,
            rejectedCount: communityDiagnostics.rejectedCount,
            suppressedCount: communityDiagnostics.suppressedCount
          }
        : null,
    rawEventCount: rawEvents.length,
    validNormalizedCount: normalizedEvents.length,
    droppedInvalidCount,
    dedupedCount: dedupedEvents.length,
    finalCount: visibleDedupedEvents.length,
    duplicateGroups,
    events: visibleDedupedEvents.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.startDateTime,
      venue: event.venueName,
      city: event.city,
      interests: [...event.interests].sort((left, right) => left.localeCompare(right)),
      sourceName: event.sourceName,
      sourceUrl: event.sourceUrl,
      originalSourcesCount: event.originalSources.length,
      originalSources: [...event.originalSources].sort((left, right) =>
        left.sourceName.localeCompare(right.sourceName) || left.sourceUrl.localeCompare(right.sourceUrl)
      )
    })),
    alertSummary: summarizeSourceAlerts([]),
    warnings,
    errors
  };

  const qaRun = buildSourceRunFromAggregatorQa(report);
  const alerts = evaluateSourceAlerts({
    latestRun: qaRun,
    runHistory: [qaRun, ...listSourceRuns()],
    now: new Date(report.generatedAt),
    runHistoryEnabled: isSourceRunHistoryEnabled()
  });
  report.alertSummary = summarizeSourceAlerts(alerts);

  return report;
}

function renderProviderList(providers: ProviderSummary[]) {
  if (providers.length === 0) {
    return "<li>None</li>";
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Provider</th>
          <th>Source ID</th>
          <th>Type</th>
          <th>Raw</th>
          <th>Valid</th>
          <th>Dropped</th>
          <th>Final Contribution</th>
          <th>Total Submissions</th>
          <th>Emitted Raw</th>
          <th>Invalid Conversions</th>
          <th>Raw Loaded</th>
          <th>Approved</th>
          <th>Pending</th>
          <th>Rejected</th>
          <th>Suppressed</th>
          <th>Invalid</th>
        </tr>
      </thead>
      <tbody>
        ${providers
          .map(
            (provider) => `
              <tr>
                <td>${escapeHtml(provider.sourceName)}</td>
                <td>${escapeHtml(provider.sourceId)}</td>
                <td>${escapeHtml(provider.sourceType)}</td>
                <td>${provider.rawCount}</td>
                <td>${provider.validCount}</td>
                <td>${provider.droppedCount}</td>
                <td>${provider.finalContributionCount}</td>
                <td>${provider.totalSubmissions ?? "-"}</td>
                <td>${provider.emittedRawEventCount ?? "-"}</td>
                <td>${provider.invalidConversionCount ?? "-"}</td>
                <td>${provider.rawLoadedCount ?? "-"}</td>
                <td>${provider.approvedCount ?? "-"}</td>
                <td>${provider.pendingCount ?? "-"}</td>
                <td>${provider.rejectedCount ?? "-"}</td>
                <td>${provider.suppressedCount ?? "-"}</td>
                <td>${provider.invalidCount ?? "-"}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderCityPresetSummary(preset: CityPresetSummary | null) {
  if (!preset) {
    return "<p>City presets are disabled or no preset is active.</p>";
  }

  return `
    <table>
      <tbody>
        <tr><th>City</th><td>${escapeHtml(preset.cityName)}</td></tr>
        <tr><th>Preset ID</th><td>${escapeHtml(preset.cityId)}</td></tr>
        <tr><th>Region</th><td>${escapeHtml(preset.region)}</td></tr>
        <tr><th>Country</th><td>${escapeHtml(preset.country)}</td></tr>
        <tr><th>Radius</th><td>${preset.defaultRadiusMiles} miles</td></tr>
        <tr><th>ICS Sources</th><td>${preset.icsSourceCount}</td></tr>
        <tr><th>RSS Sources</th><td>${preset.rssSourceCount}</td></tr>
        <tr><th>Ticketmaster Enabled</th><td>${preset.ticketmasterEnabled ? "Yes" : "No"}</td></tr>
      </tbody>
    </table>
  `;
}

function renderCuratedSummary(provider: ProviderSummary | null) {
  if (!provider) {
    return "<p>Curated provider is disabled or has not produced diagnostics yet.</p>";
  }

  return `
    <table>
      <tbody>
        <tr><th>Source</th><td>${escapeHtml(provider.sourceName)}</td></tr>
        <tr><th>Source ID</th><td>${escapeHtml(provider.sourceId)}</td></tr>
        <tr><th>Raw Loaded</th><td>${provider.rawLoadedCount ?? 0}</td></tr>
        <tr><th>Approved</th><td>${provider.approvedCount ?? 0}</td></tr>
        <tr><th>Pending</th><td>${provider.pendingCount ?? 0}</td></tr>
        <tr><th>Rejected</th><td>${provider.rejectedCount ?? 0}</td></tr>
        <tr><th>Suppressed</th><td>${provider.suppressedCount ?? 0}</td></tr>
        <tr><th>Invalid</th><td>${provider.invalidCount ?? 0}</td></tr>
        <tr><th>Final Contribution</th><td>${provider.finalContributionCount}</td></tr>
      </tbody>
    </table>
  `;
}

function renderCommunitySummary(provider: ProviderSummary | null) {
  if (!provider) {
    return "<p>Community submissions provider is disabled or has not produced diagnostics yet.</p>";
  }

  return `
    <table>
      <tbody>
        <tr><th>Source</th><td>${escapeHtml(provider.sourceName)}</td></tr>
        <tr><th>Source ID</th><td>${escapeHtml(provider.sourceId)}</td></tr>
        <tr><th>Total Submissions</th><td>${provider.totalSubmissions ?? 0}</td></tr>
        <tr><th>Pending</th><td>${provider.pendingCount ?? 0}</td></tr>
        <tr><th>Approved</th><td>${provider.approvedCount ?? 0}</td></tr>
        <tr><th>Rejected</th><td>${provider.rejectedCount ?? 0}</td></tr>
        <tr><th>Suppressed</th><td>${provider.suppressedCount ?? 0}</td></tr>
        <tr><th>Emitted Raw Events</th><td>${provider.emittedRawEventCount ?? 0}</td></tr>
        <tr><th>Invalid Conversions</th><td>${provider.invalidConversionCount ?? 0}</td></tr>
        <tr><th>Final Contribution</th><td>${provider.finalContributionCount}</td></tr>
      </tbody>
    </table>
  `;
}

function renderMessageList(messages: string[], emptyLabel: string) {
  if (messages.length === 0) {
    return `<li>${escapeHtml(emptyLabel)}</li>`;
  }

  return messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("");
}

function renderDuplicateGroups(groups: DuplicateGroup[]) {
  if (groups.length === 0) {
    return "<p>No duplicate groups detected.</p>";
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Date</th>
          <th>Venue</th>
          <th>City</th>
          <th>Group Size</th>
          <th>Merged Variants</th>
          <th>Provider Sources</th>
        </tr>
      </thead>
      <tbody>
        ${groups
          .map(
            (group) => `
              <tr>
                <td>${escapeHtml(group.title)}</td>
                <td>${escapeHtml(group.date)}</td>
                <td>${escapeHtml(group.venue ?? "Unknown")}</td>
                <td>${escapeHtml(group.city)}</td>
                <td>${group.size}</td>
                <td>${escapeHtml(group.variantTitles.join(", "))}</td>
                <td>
                  <ul class="sources">
                    ${group.sources
                      .map(
                        (source) => `
                          <li>
                            <strong>${escapeHtml(source.sourceName)}</strong>
                            <a href="${escapeHtml(source.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(source.sourceUrl)}</a>
                          </li>
                        `
                      )
                      .join("")}
                  </ul>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderEventRows(events: EventRow[]) {
  if (events.length === 0) {
    return `
      <tr>
        <td colspan="8">No events available.</td>
      </tr>
    `;
  }

  return events
    .map(
      (event) => `
        <tr>
          <td>${escapeHtml(event.title)}</td>
          <td>${escapeHtml(event.date)}</td>
          <td>${escapeHtml(event.venue ?? "Unknown")}</td>
          <td>${escapeHtml(event.city)}</td>
          <td>${escapeHtml(event.interests.join(", "))}</td>
          <td>${escapeHtml(event.sourceName)}</td>
          <td>
            <a href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(event.sourceUrl)}</a>
            <ul class="sources">
              ${event.originalSources
                .map(
                  (source) => `
                    <li>
                      <strong>${escapeHtml(source.sourceName)}</strong>
                      <a href="${escapeHtml(source.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(source.sourceUrl)}</a>
                    </li>
                  `
                )
                .join("")}
            </ul>
          </td>
          <td>${event.originalSourcesCount}</td>
        </tr>
      `
    )
    .join("");
}

export function renderAggregatorQaHtml(report: AggregatorQaReport) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Aggregator QA Report</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f1ea;
        --panel: #fffdf8;
        --text: #1f2933;
        --muted: #6b7280;
        --line: #d6d3d1;
        --accent: #0f766e;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.12), transparent 28rem),
          linear-gradient(180deg, #f7f4ed 0%, #efe7db 100%);
      }
      main {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem 1.25rem 3rem;
      }
      h1,
      h2 {
        margin: 0 0 0.75rem;
      }
      p,
      li {
        line-height: 1.5;
      }
      .meta {
        color: var(--muted);
        margin-bottom: 1.5rem;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 0.75rem;
        margin: 1.5rem 0 2rem;
      }
      .card,
      section {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 16px;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
      }
      .card {
        padding: 1rem;
      }
      .card .label {
        display: block;
        color: var(--muted);
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .card .value {
        display: block;
        margin-top: 0.4rem;
        font-size: 1.8rem;
        font-weight: 700;
      }
      section {
        padding: 1.25rem;
        margin-top: 1rem;
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        padding: 0.75rem;
        border-top: 1px solid var(--line);
        vertical-align: top;
        text-align: left;
      }
      th {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }
      a {
        color: var(--accent);
      }
      ul {
        margin: 0;
        padding-left: 1.25rem;
      }
      .sources {
        margin-top: 0.5rem;
      }
      .sources li {
        margin-bottom: 0.35rem;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Aggregator QA Report</h1>
      <p class="meta">Generated ${escapeHtml(report.generatedAt)} for ${escapeHtml(report.city)}</p>

      <div class="grid">
        <div class="card"><span class="label">Enabled Providers</span><span class="value">${report.enabledProviders.length}</span></div>
        <div class="card"><span class="label">Raw Event Count</span><span class="value">${report.rawEventCount}</span></div>
        <div class="card"><span class="label">Valid Normalized</span><span class="value">${report.validNormalizedCount}</span></div>
        <div class="card"><span class="label">Dropped Invalid</span><span class="value">${report.droppedInvalidCount}</span></div>
        <div class="card"><span class="label">Deduped Count</span><span class="value">${report.dedupedCount}</span></div>
        <div class="card"><span class="label">Final Count</span><span class="value">${report.finalCount}</span></div>
        <div class="card"><span class="label">Duplicate Groups</span><span class="value">${report.duplicateGroups.length}</span></div>
        <div class="card"><span class="label">Active Alerts</span><span class="value">${report.alertSummary.total}</span></div>
        <div class="card"><span class="label">Critical Alerts</span><span class="value">${report.alertSummary.critical}</span></div>
        <div class="card"><span class="label">Warning Alerts</span><span class="value">${report.alertSummary.warning}</span></div>
      </div>

      <section>
        <h2>Source Alert Summary</h2>
        <table>
          <tbody>
            <tr><th>Total Active</th><td>${report.alertSummary.total}</td></tr>
            <tr><th>Critical</th><td>${report.alertSummary.critical}</td></tr>
            <tr><th>Warnings</th><td>${report.alertSummary.warning}</td></tr>
            <tr><th>Info</th><td>${report.alertSummary.info}</td></tr>
            <tr><th>Has Critical</th><td>${report.alertSummary.hasCritical ? "Yes" : "No"}</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>City Preset</h2>
        ${renderCityPresetSummary(report.cityPreset)}
      </section>

      <section>
        <h2>Enabled Providers</h2>
        ${renderProviderList(report.enabledProviders)}
      </section>

      <section>
        <h2>Curated Diagnostics</h2>
        ${renderCuratedSummary(report.curatedProvider)}
      </section>

      <section>
        <h2>Community Submissions Diagnostics</h2>
        ${renderCommunitySummary(report.communitySubmissionsProvider)}
      </section>

      <section>
        <h2>Duplicate Groups</h2>
        ${renderDuplicateGroups(report.duplicateGroups)}
      </section>

      <section>
        <h2>Events</h2>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Date</th>
              <th>Venue</th>
              <th>City</th>
              <th>Interests</th>
              <th>Source</th>
              <th>Source URL</th>
              <th>Original Sources</th>
            </tr>
          </thead>
          <tbody>${renderEventRows(report.events)}</tbody>
        </table>
      </section>

      <section>
        <h2>Warnings</h2>
        <ul>${renderMessageList(report.warnings, "No warnings.")}</ul>
      </section>

      <section>
        <h2>Errors</h2>
        <ul>${renderMessageList(report.errors, "No errors.")}</ul>
      </section>
    </main>
  </body>
</html>`;
}

export async function writeAggregatorQaReport(outputDir = path.resolve(process.cwd(), "qa-results")) {
  const report = await generateAggregatorQaReport();
  if (isSourceRunHistoryEnabled()) {
    consumeSourceRunHistoryWarnings();
    try {
      appendSourceRun(buildSourceRunFromAggregatorQa(report));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      report.warnings.push(`Failed to append source run history: ${reason}`);
    }

    const historyWarnings = consumeSourceRunHistoryWarnings();
    if (historyWarnings.length > 0) {
      report.warnings.push(...historyWarnings);
    }
  }

  const html = renderAggregatorQaHtml(report);

  await mkdir(outputDir, { recursive: true });

  const htmlPath = path.join(outputDir, "aggregator-report.html");
  const jsonPath = path.join(outputDir, "aggregator-report.json");

  await Promise.all([
    writeFile(htmlPath, html, "utf8"),
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  ]);

  return {
    htmlPath,
    jsonPath,
    report
  };
}
