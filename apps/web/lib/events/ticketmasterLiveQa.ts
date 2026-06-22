import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/config/env";
import { dedupeEvents, getDedupeKey, isLikelyDuplicate } from "./dedupe";
import { normalizeRawEvent } from "./normalize";
import { validateScoutEvent } from "./schema";
import type { OriginalSource, RawEvent, ScoutEvent } from "./types";
import { getEnabledProviders } from "@/lib/sources/registry";
import { consumeTicketmasterProviderDiagnostics } from "@/lib/sources/ticketmasterProvider";
import type { EventSourceProvider, FetchEventsInput } from "@/lib/sources/provider";

type ProviderSummary = {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  enabled: boolean;
  rawCount: number;
  validCount: number;
  droppedCount: number;
  finalContributionCount: number;
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

type LiveEventRow = {
  id: string;
  title: string;
  date: string;
  venue: string | null;
  city: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
  categories: string[];
  interests: string[];
  originalSourcesCount: number;
  originalSources: OriginalSource[];
};

export type TicketmasterLiveQaReport = {
  generatedAt: string;
  query: FetchEventsInput;
  providerEnabled: boolean;
  providerConfigured: boolean;
  enabledProviders: ProviderSummary[];
  ticketmasterProvider: ProviderSummary | null;
  rawEventCount: number;
  validNormalizedCount: number;
  droppedInvalidCount: number;
  dedupedCount: number;
  finalCount: number;
  duplicateGroups: DuplicateGroup[];
  events: LiveEventRow[];
  warnings: string[];
  errors: string[];
};

function defaultTicketmasterInput(): FetchEventsInput {
  return {
    city: process.env.TICKETMASTER_QA_CITY?.trim() || env.defaultCity,
    region: process.env.TICKETMASTER_QA_REGION?.trim() || env.defaultRegion,
    country: process.env.TICKETMASTER_QA_COUNTRY?.trim() || env.defaultCountry,
    keyword: process.env.TICKETMASTER_QA_KEYWORD?.trim() || undefined,
    startDate: process.env.TICKETMASTER_QA_START_DATE?.trim() || undefined,
    endDate: process.env.TICKETMASTER_QA_END_DATE?.trim() || undefined,
    latitude: readOptionalNumber(process.env.TICKETMASTER_QA_LATITUDE),
    longitude: readOptionalNumber(process.env.TICKETMASTER_QA_LONGITUDE),
    radiusMiles: readOptionalNumber(process.env.TICKETMASTER_QA_RADIUS_MILES),
    interests: readOptionalCsv(process.env.TICKETMASTER_QA_INTERESTS)
  };
}

function readOptionalNumber(value: string | undefined) {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readOptionalCsv(value: string | undefined) {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return entries.length > 0 ? entries : undefined;
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
  dedupedEvents: ScoutEvent[]
) {
  return providers.map((provider) => {
    const rawCount = rawEvents.filter((event) => event.sourceId === provider.sourceId).length;
    const validCount = normalizedEvents.filter((event) => event.sourceId === provider.sourceId).length;
    const finalContributionCount = dedupedEvents.filter((event) =>
      event.originalSources.some((source) => source.sourceId === provider.sourceId)
    ).length;

    return {
      sourceId: provider.sourceId,
      sourceName: provider.sourceName,
      sourceType: provider.sourceType,
      enabled: provider.enabled,
      rawCount,
      validCount,
      droppedCount: rawCount - validCount,
      finalContributionCount
    };
  });
}

function formatQuerySummary(query: FetchEventsInput) {
  const parts = [
    `city=${query.city}`,
    query.region ? `region=${query.region}` : null,
    query.country ? `country=${query.country}` : null,
    query.keyword ? `keyword=${query.keyword}` : null,
    query.startDate ? `startDate=${query.startDate}` : null,
    query.endDate ? `endDate=${query.endDate}` : null,
    typeof query.latitude === "number" ? `latitude=${query.latitude}` : null,
    typeof query.longitude === "number" ? `longitude=${query.longitude}` : null,
    typeof query.radiusMiles === "number" ? `radiusMiles=${query.radiusMiles}` : null,
    query.interests?.length ? `interests=${query.interests.join(",")}` : null
  ].filter((part): part is string => Boolean(part));

  return parts.join(" | ");
}

function renderProviderSummary(providers: ProviderSummary[]) {
  if (providers.length === 0) {
    return "<li>None</li>";
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Provider</th>
          <th>Status</th>
          <th>Raw</th>
          <th>Valid</th>
          <th>Dropped</th>
          <th>Final Contribution</th>
        </tr>
      </thead>
      <tbody>
        ${providers
          .map(
            (provider) => `
              <tr>
                <td>${escapeHtml(provider.sourceName)}</td>
                <td>${provider.enabled ? "Enabled" : "Disabled"}</td>
                <td>${provider.rawCount}</td>
                <td>${provider.validCount}</td>
                <td>${provider.droppedCount}</td>
                <td>${provider.finalContributionCount}</td>
              </tr>
            `
          )
          .join("")}
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
          <th>Source Links</th>
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

function renderEventRows(events: LiveEventRow[]) {
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
          <td>
            <a href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(event.sourceUrl)}</a>
          </td>
          <td>
            ${
              event.imageUrl
                ? `<a href="${escapeHtml(event.imageUrl)}" target="_blank" rel="noreferrer">${escapeHtml(event.imageUrl)}</a>`
                : "None"
            }
          </td>
          <td>${escapeHtml(event.categories.join(", ") || "None")}</td>
          <td>${escapeHtml(event.interests.join(", ") || "None")}</td>
        </tr>
      `
    )
    .join("");
}

function renderLiveReportHtml(report: TicketmasterLiveQaReport) {
  const ticketmasterProvider = report.ticketmasterProvider;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ticketmaster Live QA Report</title>
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
      .query {
        font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
        font-size: 0.92rem;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Ticketmaster Live QA Report</h1>
      <p class="meta">Generated ${escapeHtml(report.generatedAt)} for ${escapeHtml(report.query.city)}</p>

      <div class="grid">
        <div class="card"><span class="label">Ticketmaster</span><span class="value">${report.providerEnabled ? "On" : "Off"}</span></div>
        <div class="card"><span class="label">Provider Configured</span><span class="value">${report.providerConfigured ? "Yes" : "No"}</span></div>
        <div class="card"><span class="label">Raw Count</span><span class="value">${report.ticketmasterProvider?.rawCount ?? 0}</span></div>
        <div class="card"><span class="label">Valid Normalized</span><span class="value">${report.ticketmasterProvider?.validCount ?? 0}</span></div>
        <div class="card"><span class="label">Dropped Invalid</span><span class="value">${report.ticketmasterProvider?.droppedCount ?? 0}</span></div>
        <div class="card"><span class="label">Final Count</span><span class="value">${report.finalCount}</span></div>
        <div class="card"><span class="label">Duplicate Groups</span><span class="value">${report.duplicateGroups.length}</span></div>
      </div>

      <section>
        <h2>Query Used</h2>
        <p class="query">${escapeHtml(formatQuerySummary(report.query))}</p>
      </section>

      <section>
        <h2>Provider Status</h2>
        ${renderProviderSummary(report.enabledProviders)}
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
              <th>Source URL</th>
              <th>Image URL</th>
              <th>Categories</th>
              <th>Interests</th>
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

function buildLiveReportEvents(events: ScoutEvent[]): LiveEventRow[] {
  return events
    .map((event) => ({
      id: event.id,
      title: event.title,
      date: event.startDateTime,
      venue: event.venueName,
      city: event.city,
      sourceName: event.sourceName,
      sourceUrl: event.sourceUrl,
      imageUrl: event.imageUrl,
      categories: [...event.categories].sort((left, right) => left.localeCompare(right)),
      interests: [...event.interests].sort((left, right) => left.localeCompare(right)),
      originalSourcesCount: event.originalSources.length,
      originalSources: [...event.originalSources].sort((left, right) =>
        left.sourceName.localeCompare(right.sourceName) || left.sourceUrl.localeCompare(right.sourceUrl)
      )
    }))
    .sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title));
}

export function getTicketmasterLiveQaPreflight() {
  if (!env.enableTicketmasterProvider) {
    return {
      ok: false as const,
      message:
        "Ticketmaster live QA is disabled. Set ENABLE_TICKETMASTER_PROVIDER=true and provide TICKETMASTER_API_KEY before running npm run qa:ticketmaster."
    };
  }

  if (!env.ticketmasterApiKey) {
    return {
      ok: false as const,
      message:
        "TICKETMASTER_API_KEY is missing. Set a real key before running npm run qa:ticketmaster."
    };
  }

  return {
    ok: true as const
  };
}

export async function generateTicketmasterLiveQaReport(
  input: FetchEventsInput = defaultTicketmasterInput()
): Promise<TicketmasterLiveQaReport> {
  const providers = getEnabledProviders();
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
  const duplicateGroups = buildDuplicateGroups(normalizedEvents, dedupedEvents);
  const providerSummaries = createProviderSummaries(providers, rawEvents, normalizedEvents, dedupedEvents);
  const ticketmasterProvider =
    providerSummaries.find((provider) => provider.sourceId === "ticketmaster") ?? null;
  const providerEnabled = Boolean(ticketmasterProvider?.enabled);

  for (const diagnostic of consumeTicketmasterProviderDiagnostics()) {
    if (diagnostic.level === "warning") {
      warnings.push(diagnostic.message);
    } else {
      errors.push(diagnostic.message);
    }
  }

  if (dedupedEvents.length === 0) {
    warnings.push("Aggregation produced no final events.");
  }

  return {
    generatedAt: new Date().toISOString(),
    query: input,
    providerEnabled,
    providerConfigured: env.enableTicketmasterProvider && Boolean(env.ticketmasterApiKey),
    enabledProviders: providerSummaries,
    ticketmasterProvider,
    rawEventCount: rawEvents.length,
    validNormalizedCount: normalizedEvents.length,
    droppedInvalidCount,
    dedupedCount: dedupedEvents.length,
    finalCount: dedupedEvents.length,
    duplicateGroups,
    events: buildLiveReportEvents(dedupedEvents),
    warnings,
    errors
  };
}

export async function writeTicketmasterLiveQaReport(
  outputDir = path.resolve(process.cwd(), "qa-results"),
  input: FetchEventsInput = defaultTicketmasterInput()
) {
  const report = await generateTicketmasterLiveQaReport(input);
  const html = renderLiveReportHtml(report);

  await mkdir(outputDir, { recursive: true });

  const htmlPath = path.join(outputDir, "ticketmaster-live-report.html");
  const jsonPath = path.join(outputDir, "ticketmaster-live-report.json");

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
