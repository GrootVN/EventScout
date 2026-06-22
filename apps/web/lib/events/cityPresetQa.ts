import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCityPreset } from "@/config/cities";
import type { CitySourcePreset, CitySourceStatus } from "@/config/cities/types";
import { env } from "@/lib/config/env";
import { normalizeRawEvent } from "./normalize";
import { validateScoutEvent } from "./schema";
import type { RawEvent } from "./types";
import { parseIcsCalendar } from "@/lib/sources/icsParser";
import { parseRssFeed } from "@/lib/sources/rssParser";

export type CityPresetQaFetchStatus = "success" | "failure" | "skipped";
export type CityPresetQaParseStatus = "success" | "failure" | "skipped";
export type CityPresetQaRecommendation =
  | "keep"
  | "disable"
  | "replace"
  | "needs_manual_review"
  | "placeholder_only";

export type CityPresetSourceReport = {
  sourceId: string;
  sourceName: string;
  sourceType: "ics" | "rss" | "ticketmaster" | "other";
  enabled: boolean;
  status: CitySourceStatus;
  sourceUrl: string | null;
  notes: string | null;
  fetchAttempted: boolean;
  fetchStatus: CityPresetQaFetchStatus;
  httpStatus: number | null;
  parseStatus: CityPresetQaParseStatus;
  rawItemCount: number;
  validNormalizedEventCount: number;
  droppedCount: number;
  warnings: string[];
  errors: string[];
  recommendation: CityPresetQaRecommendation;
};

export type CityPresetQaReport = {
  generatedAt: string;
  selectedCityPresetId: string;
  selectedCityName: string | null;
  region: string | null;
  country: string | null;
  cityPresetsEnabled: boolean;
  liveFetchEnabled: boolean;
  totalConfiguredSources: number;
  enabledSources: number;
  disabledSources: number;
  placeholderSources: number;
  verifiedSources: number;
  needsReviewSources: number;
  sourceReports: CityPresetSourceReport[];
  warnings: string[];
  errors: string[];
};

type ReportOptions = {
  presetId?: string;
  preset?: CitySourcePreset | null;
  liveFetch?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

type SourceEntry = {
  sourceId: string;
  sourceName: string;
  sourceType: "ics" | "rss" | "ticketmaster" | "other";
  enabled: boolean;
  status: CitySourceStatus;
  notes: string | null;
  sourceUrl: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  defaultInterests: string[];
  defaultCategories: string[];
  confidence: number | null;
};

type ValidationResult = {
  fetchStatus: CityPresetQaFetchStatus;
  httpStatus: number | null;
  parseStatus: CityPresetQaParseStatus;
  rawItemCount: number;
  validNormalizedEventCount: number;
  droppedCount: number;
  warnings: string[];
  errors: string[];
};

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function isValidUrl(value: string | null) {
  if (!value) {
    return false;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function normalizeStatus(value: CitySourceStatus | undefined, enabled: boolean): CitySourceStatus {
  if (value) {
    return value;
  }

  return enabled ? "verified" : "disabled";
}

function getSelectedPreset(presetId: string, presetOverride?: CitySourcePreset | null) {
  if (presetOverride !== undefined) {
    return presetOverride;
  }

  const normalizedPresetId = clean(presetId);
  if (!normalizedPresetId) {
    return null;
  }

  return getCityPreset(normalizedPresetId);
}

function createSourceEntries(preset: CitySourcePreset | null): SourceEntry[] {
  if (!preset) {
    return [];
  }

  const icsSources = preset.sources.ics.map(
    (source): SourceEntry => ({
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      sourceType: "ics",
      enabled: source.enabled !== false,
      status: normalizeStatus(source.status, source.enabled !== false),
      notes: source.notes ?? null,
      sourceUrl: clean(source.sourceUrl ?? source.url) || null,
      city: source.city ?? null,
      region: source.region ?? null,
      country: source.country ?? null,
      defaultInterests: source.defaultInterests ?? [],
      defaultCategories: source.defaultCategories ?? [],
      confidence: typeof source.confidence === "number" ? source.confidence : null
    })
  );

  const rssSources = preset.sources.rss.map(
    (source): SourceEntry => ({
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      sourceType: "rss",
      enabled: source.enabled !== false,
      status: normalizeStatus(source.status, source.enabled !== false),
      notes: source.notes ?? null,
      sourceUrl: clean(source.sourceUrl ?? source.url) || null,
      city: source.city ?? null,
      region: source.region ?? null,
      country: source.country ?? null,
      defaultInterests: source.defaultInterests ?? [],
      defaultCategories: source.defaultCategories ?? [],
      confidence: typeof source.confidence === "number" ? source.confidence : null
    })
  );

  const ticketmasterSource = preset.sources.ticketmaster
    ? [
        {
          sourceId: `${preset.cityId}-ticketmaster-preset`,
          sourceName: `${preset.cityName} Ticketmaster Stub`,
          sourceType: "ticketmaster" as const,
          enabled: preset.sources.ticketmaster.enabled,
          status: normalizeStatus(preset.sources.ticketmaster.status, preset.sources.ticketmaster.enabled),
          notes: preset.sources.ticketmaster.notes ?? null,
          sourceUrl: null,
          city: preset.cityName,
          region: preset.region,
          country: preset.country,
          defaultInterests: [],
          defaultCategories: [],
          confidence: null
        }
      ]
    : [];

  return [...icsSources, ...rssSources, ...ticketmasterSource];
}

function aggregateStatusCounts(sourceReports: CityPresetSourceReport[]) {
  return {
    totalConfiguredSources: sourceReports.length,
    enabledSources: sourceReports.filter((report) => report.enabled).length,
    disabledSources: sourceReports.filter((report) => !report.enabled).length,
    placeholderSources: sourceReports.filter((report) => report.status === "placeholder").length,
    verifiedSources: sourceReports.filter((report) => report.status === "verified").length,
    needsReviewSources: sourceReports.filter((report) => report.status === "needs_review").length
  };
}

function buildRawIcsEvent(source: SourceEntry, parsedEvent: ReturnType<typeof parseIcsCalendar>["events"][number], fetchedAt: string): RawEvent {
  const sourceUrl = clean(parsedEvent.url) || source.sourceUrl || "";

  return {
    sourceId: "ics",
    sourceName: source.sourceName,
    sourceType: "ics",
    sourceEventId: parsedEvent.uid ?? null,
    sourceUrl,
    fetchedAt,
    raw: {
      uid: parsedEvent.uid,
      summary: parsedEvent.summary,
      description: parsedEvent.description,
      startDateTime: parsedEvent.startDateTime,
      endDateTime: parsedEvent.endDateTime,
      timezone: parsedEvent.timezone,
      location: parsedEvent.location,
      venueName: parsedEvent.venueName,
      address: parsedEvent.address,
      url: parsedEvent.url,
      categories: [
        ...source.defaultCategories,
        ...parsedEvent.categories
      ],
      interests: [
        ...source.defaultInterests,
        ...parsedEvent.categories
      ],
      sourceCalendarUrl: source.sourceUrl,
      city: source.city,
      region: source.region,
      country: source.country,
      confidence: source.confidence ?? (parsedEvent.url && source.sourceUrl && parsedEvent.url !== source.sourceUrl ? 0.88 : 0.82)
    }
  };
}

function buildRawRssEvent(
  source: SourceEntry,
  parsedItem: ReturnType<typeof parseRssFeed>["items"][number],
  fetchedAt: string
): RawEvent | null {
  const itemLink = clean(parsedItem.link);
  if (!itemLink) {
    return null;
  }

  let sourceUrl = "";
  try {
    sourceUrl = source.sourceUrl ? new URL(itemLink, source.sourceUrl).toString() : new URL(itemLink).toString();
  } catch {
    return null;
  }

  return {
    sourceId: "rss",
    sourceName: source.sourceName,
    sourceType: "rss",
    sourceEventId: parsedItem.id ?? null,
    sourceUrl,
    fetchedAt,
    raw: {
      id: parsedItem.id,
      title: parsedItem.title,
      description: parsedItem.description ?? parsedItem.content,
      startDateTime: parsedItem.eventDate,
      endDateTime: parsedItem.endDateTime,
      timezone: parsedItem.timezone,
      venueName: parsedItem.venueName,
      address: parsedItem.address,
      city: parsedItem.city ?? source.city,
      region: parsedItem.region ?? source.region,
      country: parsedItem.country ?? source.country,
      priceType: "unknown" as const,
      minPrice: null,
      maxPrice: null,
      currency: null,
      imageUrl: null,
      categories: [...source.defaultCategories, ...parsedItem.categories],
      interests: [...source.defaultInterests, ...parsedItem.categories],
      confidence: source.confidence ?? 0.78,
      publishedAt: parsedItem.publishedAt,
      updatedAt: parsedItem.updatedAt,
      sourceFeedUrl: source.sourceUrl,
      feedTitle: source.sourceName
    }
  };
}

function buildMetadataOnlyResult(source: SourceEntry): ValidationResult {
  const errors: string[] = [];
  if (source.sourceType !== "ticketmaster" && !isValidUrl(source.sourceUrl)) {
    errors.push(`Configured URL is missing or invalid for ${source.sourceName}.`);
  }

  return {
    fetchStatus: "skipped",
    httpStatus: null,
    parseStatus: "skipped",
    rawItemCount: 0,
    validNormalizedEventCount: 0,
    droppedCount: 0,
    warnings: [],
    errors
  };
}

async function validateIcsSource(source: SourceEntry, fetchImpl: typeof fetch, nowIso: string): Promise<ValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const response = await fetchImpl(source.sourceUrl ?? "", {
      headers: {
        Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1"
      }
    });

    if (!response.ok) {
      errors.push(`HTTP ${response.status} while fetching ${source.sourceName}.`);
      return {
        fetchStatus: "failure",
        httpStatus: response.status,
        parseStatus: "skipped",
        rawItemCount: 0,
        validNormalizedEventCount: 0,
        droppedCount: 0,
        warnings,
        errors
      };
    }

    const text = await response.text();
    if (!text.trim()) {
      warnings.push(`ICS source ${source.sourceName} returned an empty calendar response.`);
      return {
        fetchStatus: "success",
        httpStatus: response.status,
        parseStatus: "failure",
        rawItemCount: 0,
        validNormalizedEventCount: 0,
        droppedCount: 0,
        warnings,
        errors
      };
    }

    const parsed = parseIcsCalendar(text);
    warnings.push(...parsed.warnings.map((warning) => `ICS source ${source.sourceName}: ${warning}`));

    const fetchedAt = nowIso;
    let validCount = 0;
    let droppedCount = 0;

    for (const parsedEvent of parsed.events) {
      if (parsedEvent.isRecurring) {
        droppedCount += 1;
        warnings.push(`Skipped recurring ICS event ${parsedEvent.summary ?? parsedEvent.uid ?? source.sourceName} from ${source.sourceName}.`);
        continue;
      }

      try {
        const rawEvent = buildRawIcsEvent(source, parsedEvent, fetchedAt);
        const normalized = normalizeRawEvent(rawEvent);
        const validationErrors = validateScoutEvent(normalized);
        if (validationErrors.length > 0) {
          droppedCount += 1;
          warnings.push(
            `Dropped ICS event ${parsedEvent.summary ?? parsedEvent.uid ?? source.sourceName} from ${source.sourceName} (${validationErrors.join(", ")}).`
          );
          continue;
        }

        validCount += 1;
      } catch (error) {
        droppedCount += 1;
        const reason = error instanceof Error ? error.message : String(error);
        warnings.push(
          `Dropped ICS event ${parsedEvent.summary ?? parsedEvent.uid ?? source.sourceName} from ${source.sourceName} (${reason}).`
        );
      }
    }

    const parseStatus = parsed.events.length === 0 && parsed.warnings.length > 0 ? "failure" : "success";

    return {
      fetchStatus: "success",
      httpStatus: response.status,
      parseStatus,
      rawItemCount: parsed.events.length,
      validNormalizedEventCount: validCount,
      droppedCount: parsed.events.length - validCount,
      warnings,
      errors
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to fetch ICS source ${source.sourceName}: ${reason}`);
    return {
      fetchStatus: "failure",
      httpStatus: null,
      parseStatus: "skipped",
      rawItemCount: 0,
      validNormalizedEventCount: 0,
      droppedCount: 0,
      warnings,
      errors
    };
  }
}

async function validateRssSource(source: SourceEntry, fetchImpl: typeof fetch, nowIso: string): Promise<ValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const response = await fetchImpl(source.sourceUrl ?? "", {
      headers: {
        Accept: "application/rss+xml, application/atom+xml, text/xml, application/xml, */*;q=0.1"
      }
    });

    if (!response.ok) {
      errors.push(`HTTP ${response.status} while fetching ${source.sourceName}.`);
      return {
        fetchStatus: "failure",
        httpStatus: response.status,
        parseStatus: "skipped",
        rawItemCount: 0,
        validNormalizedEventCount: 0,
        droppedCount: 0,
        warnings,
        errors
      };
    }

    const text = await response.text();
    if (!text.trim()) {
      warnings.push(`RSS source ${source.sourceName} returned an empty feed response.`);
      return {
        fetchStatus: "success",
        httpStatus: response.status,
        parseStatus: "failure",
        rawItemCount: 0,
        validNormalizedEventCount: 0,
        droppedCount: 0,
        warnings,
        errors
      };
    }

    const parsed = parseRssFeed(text);
    warnings.push(...parsed.warnings.map((warning) => `RSS source ${source.sourceName}: ${warning}`));

    const fetchedAt = nowIso;
    let validCount = 0;
    let droppedCount = 0;

    for (const parsedItem of parsed.items) {
      try {
        const rawEvent = buildRawRssEvent(source, parsedItem, fetchedAt);
        if (!rawEvent) {
          droppedCount += 1;
          warnings.push(
            `Dropped RSS item ${parsedItem.title ?? parsedItem.id ?? source.sourceName} from ${source.sourceName} because it did not expose a usable source URL.`
          );
          continue;
        }

        const normalized = normalizeRawEvent(rawEvent);
        const validationErrors = validateScoutEvent(normalized);
        if (validationErrors.length > 0) {
          droppedCount += 1;
          warnings.push(
            `Dropped RSS item ${parsedItem.title ?? parsedItem.id ?? source.sourceName} from ${source.sourceName} (${validationErrors.join(", ")}).`
          );
          continue;
        }

        validCount += 1;
      } catch (error) {
        droppedCount += 1;
        const reason = error instanceof Error ? error.message : String(error);
        warnings.push(
          `Dropped RSS item ${parsedItem.title ?? parsedItem.id ?? source.sourceName} from ${source.sourceName} (${reason}).`
        );
      }
    }

    const parseStatus =
      parsed.items.length === 0 && parsed.warnings.length > 0 ? "failure" : "success";

    return {
      fetchStatus: "success",
      httpStatus: response.status,
      parseStatus,
      rawItemCount: parsed.items.length,
      validNormalizedEventCount: validCount,
      droppedCount: parsed.items.length - validCount,
      warnings,
      errors
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to fetch RSS source ${source.sourceName}: ${reason}`);
    return {
      fetchStatus: "failure",
      httpStatus: null,
      parseStatus: "skipped",
      rawItemCount: 0,
      validNormalizedEventCount: 0,
      droppedCount: 0,
      warnings,
      errors
    };
  }
}

function getRecommendation(status: CitySourceStatus, validation: ValidationResult): CityPresetQaRecommendation {
  if (status === "placeholder") {
    return "placeholder_only";
  }

  if (status === "disabled") {
    return "disable";
  }

  if (validation.errors.length > 0) {
    return "replace";
  }

  if (validation.fetchStatus === "failure" || validation.parseStatus === "failure") {
    return "replace";
  }

  if (status === "needs_review") {
    return "needs_manual_review";
  }

  return "keep";
}

function makeSourceReport(
  source: SourceEntry,
  validation: ValidationResult
): CityPresetSourceReport {
  return {
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    sourceType: source.sourceType,
    enabled: source.enabled,
    status: source.status,
    sourceUrl: source.sourceUrl,
    notes: source.notes,
    fetchAttempted: validation.fetchStatus !== "skipped",
    fetchStatus: validation.fetchStatus,
    httpStatus: validation.httpStatus,
    parseStatus: validation.parseStatus,
    rawItemCount: validation.rawItemCount,
    validNormalizedEventCount: validation.validNormalizedEventCount,
    droppedCount: validation.droppedCount,
    warnings: validation.warnings,
    errors: validation.errors,
    recommendation: getRecommendation(source.status, validation)
  };
}

function sortByStatus(sourceReports: CityPresetSourceReport[]) {
  const statusOrder: Record<CitySourceStatus, number> = {
    verified: 0,
    needs_review: 1,
    placeholder: 2,
    disabled: 3
  };

  return [...sourceReports].sort((left, right) => {
    const statusDelta = statusOrder[left.status] - statusOrder[right.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }

    return left.sourceName.localeCompare(right.sourceName);
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderStatusChip(label: string, className: string) {
  return `<span class="chip ${className}">${escapeHtml(label)}</span>`;
}

function humanizeEnum(value: string) {
  return value.replaceAll("_", " ");
}

function renderSourceTable(sourceReports: CityPresetSourceReport[]) {
  if (sourceReports.length === 0) {
    return "<p>No sources in this group.</p>";
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Source</th>
          <th>Type</th>
          <th>Status</th>
          <th>Enabled</th>
          <th>URL</th>
          <th>Notes</th>
          <th>Fetch</th>
          <th>Parse</th>
          <th>Raw</th>
          <th>Valid</th>
          <th>Dropped</th>
          <th>Recommendation</th>
        </tr>
      </thead>
      <tbody>
        ${sourceReports
          .map(
            (source) => `
              <tr class="status-${escapeHtml(source.status)} ${source.fetchStatus === "failure" || source.parseStatus === "failure" ? "status-failed" : ""}">
                <td><strong>${escapeHtml(source.sourceName)}</strong><br /><span class="mono">${escapeHtml(source.sourceId)}</span></td>
                <td>${escapeHtml(source.sourceType)}</td>
                <td>${renderStatusChip(humanizeEnum(source.status), source.status)}</td>
                <td>${source.enabled ? "Yes" : "No"}</td>
                <td>${source.sourceUrl ? `<a href="${escapeHtml(source.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(source.sourceUrl)}</a>` : "n/a"}</td>
                <td>${escapeHtml(source.notes ?? "")}</td>
                <td>${source.fetchStatus}${source.fetchAttempted ? "" : " (skipped)"}</td>
                <td>${source.parseStatus}</td>
                <td>${source.rawItemCount}</td>
                <td>${source.validNormalizedEventCount}</td>
                <td>${source.droppedCount}</td>
                <td>${renderStatusChip(humanizeEnum(source.recommendation), `recommendation-${source.recommendation}`)}</td>
              </tr>
              ${source.warnings.length > 0 || source.errors.length > 0 ? `
                <tr>
                  <td colspan="12">
                    ${source.warnings.length > 0 ? `<div><strong>Warnings:</strong><ul>${source.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></div>` : ""}
                    ${source.errors.length > 0 ? `<div><strong>Errors:</strong><ul>${source.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul></div>` : ""}
                  </td>
                </tr>
              ` : ""}
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderSourceSection(title: string, sourceReports: CityPresetSourceReport[]) {
  return `
    <section class="group">
      <h2>${escapeHtml(title)}</h2>
      ${renderSourceTable(sourceReports)}
    </section>
  `;
}

function renderList(items: string[], emptyLabel: string) {
  if (items.length === 0) {
    return `<li>${escapeHtml(emptyLabel)}</li>`;
  }

  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

export async function generateCityPresetQaReport(options: ReportOptions = {}): Promise<CityPresetQaReport> {
  const selectedPresetId = clean(options.presetId ?? env.defaultCityPreset);
  const selectedPreset = getSelectedPreset(selectedPresetId, options.preset);
  const liveFetchEnabled = options.liveFetch ?? env.cityPresetQaLiveFetch;
  const nowIso = (options.now ?? (() => new Date()))().toISOString();
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!env.enableCityPresets) {
    warnings.push("City presets are disabled; validating the configured preset metadata only.");
  }

  if (!liveFetchEnabled) {
    warnings.push("CITY_PRESET_QA_LIVE_FETCH is false; remote URLs were not fetched.");
  }

  if (!selectedPreset) {
    warnings.push(`No city preset named "${selectedPresetId || "unknown"}" was found.`);
  }

  const sourceEntries = createSourceEntries(selectedPreset);
  const sourceReports: CityPresetSourceReport[] = [];

  for (const source of sourceEntries) {
    const hasValidUrl = source.sourceType === "ticketmaster" || isValidUrl(source.sourceUrl);
    const shouldLiveFetch = liveFetchEnabled && source.enabled && source.status !== "placeholder" && hasValidUrl && source.sourceType !== "ticketmaster";

    if (!selectedPreset) {
      sourceReports.push(
        makeSourceReport(source, {
          fetchStatus: "skipped",
          httpStatus: null,
          parseStatus: "skipped",
          rawItemCount: 0,
          validNormalizedEventCount: 0,
          droppedCount: 0,
          warnings: [],
          errors: ["No preset selected."]
        })
      );
      continue;
    }

    if (!shouldLiveFetch) {
      const metadataResult = buildMetadataOnlyResult(source);
      sourceReports.push(makeSourceReport(source, metadataResult));
      if (metadataResult.errors.length > 0) {
        errors.push(...metadataResult.errors);
      }
      continue;
    }

    let validation: ValidationResult;
    if (source.sourceType === "ics") {
      validation = await validateIcsSource(source, options.fetchImpl ?? fetch, nowIso);
    } else if (source.sourceType === "rss") {
      validation = await validateRssSource(source, options.fetchImpl ?? fetch, nowIso);
    } else {
      validation = buildMetadataOnlyResult(source);
    }

    sourceReports.push(makeSourceReport(source, validation));
    warnings.push(...validation.warnings);
    errors.push(...validation.errors);
  }

  const counts = aggregateStatusCounts(sourceReports);
  const selectedCityName = selectedPreset?.cityName ?? null;

  return {
    generatedAt: nowIso,
    selectedCityPresetId: selectedPresetId || env.defaultCityPreset,
    selectedCityName,
    region: selectedPreset?.region ?? null,
    country: selectedPreset?.country ?? null,
    cityPresetsEnabled: env.enableCityPresets,
    liveFetchEnabled,
    totalConfiguredSources: counts.totalConfiguredSources,
    enabledSources: counts.enabledSources,
    disabledSources: counts.disabledSources,
    placeholderSources: counts.placeholderSources,
    verifiedSources: counts.verifiedSources,
    needsReviewSources: counts.needsReviewSources,
    sourceReports: sortByStatus(sourceReports),
    warnings,
    errors
  };
}

function renderSummaryCards(report: CityPresetQaReport) {
  return `
    <div class="grid">
      <div class="card"><span class="label">Total Sources</span><span class="value">${report.totalConfiguredSources}</span></div>
      <div class="card"><span class="label">Enabled</span><span class="value">${report.enabledSources}</span></div>
      <div class="card"><span class="label">Disabled</span><span class="value">${report.disabledSources}</span></div>
      <div class="card"><span class="label">Placeholder</span><span class="value">${report.placeholderSources}</span></div>
      <div class="card"><span class="label">Verified</span><span class="value">${report.verifiedSources}</span></div>
      <div class="card"><span class="label">Needs Review</span><span class="value">${report.needsReviewSources}</span></div>
    </div>
  `;
}

export function renderCityPresetQaHtml(report: CityPresetQaReport) {
  const grouped = {
    verified: report.sourceReports.filter((source) => source.status === "verified"),
    needs_review: report.sourceReports.filter((source) => source.status === "needs_review"),
    placeholder: report.sourceReports.filter((source) => source.status === "placeholder"),
    disabled: report.sourceReports.filter((source) => source.status === "disabled"),
    failed: report.sourceReports.filter((source) => source.fetchStatus === "failure" || source.parseStatus === "failure")
  } as const;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>City Preset QA Report</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f2ea;
        --panel: #fffdf8;
        --text: #1f2933;
        --muted: #6b7280;
        --line: #d6d3d1;
        --accent: #0f766e;
        --verified: #14532d;
        --placeholder: #7c2d12;
        --disabled: #334155;
        --needs-review: #92400e;
        --failed: #991b1b;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--text);
        background: linear-gradient(180deg, #f7f4ed 0%, #efe7db 100%);
      }
      main {
        max-width: 1280px;
        margin: 0 auto;
        padding: 2rem 1.25rem 3rem;
      }
      h1, h2, h3 { margin: 0 0 0.75rem; }
      p, li { line-height: 1.5; }
      .meta { color: var(--muted); margin-bottom: 1.25rem; }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.75rem;
        margin: 1.25rem 0 1.75rem;
      }
      .card, section {
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
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .card .value {
        display: block;
        margin-top: 0.4rem;
        font-size: 1.7rem;
        font-weight: 700;
      }
      section {
        padding: 1.25rem;
        margin-top: 1rem;
        overflow-x: auto;
      }
      .group + .group { margin-top: 1rem; }
      table { width: 100%; border-collapse: collapse; }
      th, td {
        padding: 0.7rem;
        border-top: 1px solid var(--line);
        vertical-align: top;
        text-align: left;
      }
      th {
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }
      a { color: var(--accent); }
      ul { margin: 0; padding-left: 1.25rem; }
      .chip {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.55rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        background: #e5e7eb;
      }
      .verified { background: #dcfce7; color: var(--verified); }
      .placeholder { background: #ffedd5; color: var(--placeholder); }
      .disabled { background: #e2e8f0; color: var(--disabled); }
      .needs_review { background: #fef3c7; color: var(--needs-review); }
      .recommendation-keep { background: #dcfce7; color: var(--verified); }
      .recommendation-disable { background: #e2e8f0; color: var(--disabled); }
      .recommendation-replace { background: #fee2e2; color: var(--failed); }
      .recommendation-needs_manual_review { background: #fef3c7; color: var(--needs-review); }
      .recommendation-placeholder_only { background: #ffedd5; color: var(--placeholder); }
      .status-failed { background: rgba(220, 38, 38, 0.06); }
      .mono { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 0.85rem; color: var(--muted); }
      .warning-list li, .error-list li { margin-bottom: 0.4rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>City Preset QA Report</h1>
      <p class="meta">
        Generated ${escapeHtml(report.generatedAt)} for preset <strong>${escapeHtml(report.selectedCityPresetId)}</strong>
        ${report.selectedCityName ? `(${escapeHtml(report.selectedCityName)})` : ""}
      </p>
      <p class="meta">
        Region: ${escapeHtml(report.region ?? "n/a")} | Country: ${escapeHtml(report.country ?? "n/a")} |
        City presets enabled: ${report.cityPresetsEnabled ? "Yes" : "No"} |
        Live fetch: ${report.liveFetchEnabled ? "Yes" : "No"}
      </p>

      ${renderSummaryCards(report)}

      <section>
        <h2>Status Overview</h2>
        <p>The preset inventory is grouped below so it is easy to see what is ready, what is disabled, and what still needs manual review.</p>
      </section>

      ${renderSourceSection("Verified Sources", grouped.verified)}
      ${renderSourceSection("Needs Review", grouped.needs_review)}
      ${renderSourceSection("Placeholder Sources", grouped.placeholder)}
      ${renderSourceSection("Disabled Sources", grouped.disabled)}
      ${renderSourceSection("Failed Sources", grouped.failed)}

      <section>
        <h2>Warnings</h2>
        <ul class="warning-list">${renderList(report.warnings, "No warnings.")}</ul>
      </section>

      <section>
        <h2>Errors</h2>
        <ul class="error-list">${renderList(report.errors, "No errors.")}</ul>
      </section>
    </main>
  </body>
</html>`;
}

export async function writeCityPresetQaReport(
  outputDir = path.resolve(process.cwd(), "qa-results"),
  options: ReportOptions = {}
) {
  const report = await generateCityPresetQaReport(options);
  const html = renderCityPresetQaHtml(report);

  await mkdir(outputDir, { recursive: true });

  const htmlPath = path.join(outputDir, "city-preset-report.html");
  const jsonPath = path.join(outputDir, "city-preset-report.json");

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
