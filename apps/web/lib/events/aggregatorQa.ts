import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dedupeEvents, getDedupeKey, isLikelyDuplicate } from "./dedupe";
import { normalizeRawEvent } from "./normalize";
import { validateScoutEvent } from "./schema";
import type { RawEvent, ScoutEvent } from "./types";
import { env } from "@/lib/config/env";
import { getEnabledProviders } from "@/lib/sources/registry";
import type { FetchEventsInput } from "@/lib/sources/provider";

type ProviderSummary = {
  sourceId: string;
  sourceName: string;
  sourceType: string;
};

type DuplicateGroup = {
  dedupeKey: string;
  title: string;
  date: string;
  venue: string | null;
  city: string;
  size: number;
  eventIds: string[];
  sourceNames: string[];
  sourceUrls: string[];
};

type EventRow = {
  title: string;
  date: string;
  venue: string | null;
  city: string;
  interests: string[];
  sourceName: string;
  sourceUrl: string;
  originalSourcesCount: number;
};

export type AggregatorQaReport = {
  generatedAt: string;
  city: string;
  enabledProviders: ProviderSummary[];
  rawEventCount: number;
  validNormalizedCount: number;
  droppedInvalidCount: number;
  dedupedCount: number;
  finalCount: number;
  duplicateGroups: DuplicateGroup[];
  events: EventRow[];
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
      return {
        dedupeKey: getDedupeKey(representative),
        title: representative.title,
        date: representative.startDateTime,
        venue: representative.venueName,
        city: representative.city,
        size: group.length,
        eventIds: group.map((event) => event.id),
        sourceNames: sortValues(group.map((event) => event.sourceName)),
        sourceUrls: sortValues(group.map((event) => event.sourceUrl))
      };
    })
    .sort((left, right) => right.size - left.size || left.title.localeCompare(right.title));
}

export async function generateAggregatorQaReport(
  input: FetchEventsInput = defaultFetchInput()
): Promise<AggregatorQaReport> {
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

  if (dedupedEvents.length === 0) {
    warnings.push("Aggregation produced no final events.");
  }

  return {
    generatedAt: new Date().toISOString(),
    city: input.city,
    enabledProviders: providers.map((provider) => ({
      sourceId: provider.sourceId,
      sourceName: provider.sourceName,
      sourceType: provider.sourceType
    })),
    rawEventCount: rawEvents.length,
    validNormalizedCount: normalizedEvents.length,
    droppedInvalidCount,
    dedupedCount: dedupedEvents.length,
    finalCount: dedupedEvents.length,
    duplicateGroups,
    events: dedupedEvents.map((event) => ({
      title: event.title,
      date: event.startDateTime,
      venue: event.venueName,
      city: event.city,
      interests: [...event.interests].sort((left, right) => left.localeCompare(right)),
      sourceName: event.sourceName,
      sourceUrl: event.sourceUrl,
      originalSourcesCount: event.originalSources.length
    })),
    warnings,
    errors
  };
}

function renderProviderList(providers: ProviderSummary[]) {
  if (providers.length === 0) {
    return "<li>None</li>";
  }

  return providers
    .map(
      (provider) =>
        `<li><strong>${escapeHtml(provider.sourceName)}</strong> <span>${escapeHtml(provider.sourceId)}</span> <span>${escapeHtml(provider.sourceType)}</span></li>`
    )
    .join("");
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
          <th>Sources</th>
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
                <td>${escapeHtml(group.sourceNames.join(", "))}</td>
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
          <td><a href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(event.sourceUrl)}</a></td>
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
      </div>

      <section>
        <h2>Enabled Providers</h2>
        <ul>${renderProviderList(report.enabledProviders)}</ul>
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
