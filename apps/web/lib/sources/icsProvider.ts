import { env } from "@/lib/config/env";
import type { RawEvent } from "@/lib/events/types";
import { getIcsSourceConfigs } from "@/config/ics-sources";
import type { EventSourceProvider, FetchEventsInput } from "./provider";
import { parseIcsCalendar } from "./icsParser";

type Diagnostic = {
  level: "warning" | "error";
  message: string;
};

type IcsParsedPayload = {
  uid: string | null;
  summary: string | null;
  description: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
  timezone: string | null;
  location: string | null;
  venueName: string | null;
  address: string | null;
  url: string | null;
  categories: string[];
  interests: string[];
  recurrenceRule: string | null;
  isRecurring: boolean;
  rawProperties: Record<string, string[]>;
  sourceCalendarUrl: string;
  sourceConfig: ReturnType<typeof getIcsSourceConfigs>[number];
  confidence: number;
  city: string | null;
  region: string | null;
  country: string | null;
};

const diagnostics: Diagnostic[] = [];

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function recordDiagnostic(level: Diagnostic["level"], message: string) {
  diagnostics.push({ level, message });
}

export function consumeIcsProviderDiagnostics() {
  const current = [...diagnostics];
  diagnostics.length = 0;
  return current;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => clean(value)).filter((value) => value.length > 0))];
}

function buildSourceUrl(eventUrl: string | null, sourceConfigUrl: string) {
  return clean(eventUrl) || sourceConfigUrl;
}

function prepareRawEvent(
  parsedEvent: ReturnType<typeof parseIcsCalendar>["events"][number],
  sourceConfig: ReturnType<typeof getIcsSourceConfigs>[number]
) {
  if (parsedEvent.isRecurring) {
    const label = parsedEvent.summary ?? parsedEvent.uid ?? sourceConfig.sourceName;
    recordDiagnostic("warning", `Skipped recurring ICS event ${label} from ${sourceConfig.sourceName}.`);
    return null;
  }

  if (!parsedEvent.summary) {
    recordDiagnostic("warning", `Skipped ICS event from ${sourceConfig.sourceName} because SUMMARY was missing.`);
    return null;
  }

  if (!parsedEvent.startDateTime) {
    recordDiagnostic("warning", `Skipped ICS event ${parsedEvent.summary} from ${sourceConfig.sourceName} because DTSTART was missing.`);
    return null;
  }

  const sourceCalendarUrl = sourceConfig.sourceUrl ?? sourceConfig.url;
  const sourceUrl = buildSourceUrl(parsedEvent.url, sourceCalendarUrl);
  const fallbackUsed = clean(parsedEvent.url).length === 0;
  const categories = uniqueStrings([...(sourceConfig.defaultCategories ?? []), ...parsedEvent.categories]);
  const interests = uniqueStrings([...(sourceConfig.defaultInterests ?? []), ...parsedEvent.categories]);
  const baseConfidence = sourceConfig.confidence ?? 0.88;
  const confidence = fallbackUsed ? Math.min(baseConfidence, 0.82) : baseConfidence;

  if (fallbackUsed) {
    recordDiagnostic(
      "warning",
      `ICS event ${parsedEvent.summary} from ${sourceConfig.sourceName} used the calendar URL fallback because the event URL was missing.`
    );
  }

  return {
    sourceId: "ics",
    sourceName: sourceConfig.sourceName,
    sourceType: "ics" as const,
    sourceEventId: parsedEvent.uid ?? null,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
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
      categories,
      interests,
      recurrenceRule: parsedEvent.recurrenceRule,
      isRecurring: parsedEvent.isRecurring,
      rawProperties: parsedEvent.rawProperties,
      sourceCalendarUrl,
      sourceConfig,
      confidence,
      city: sourceConfig.city ?? null,
      region: sourceConfig.region ?? null,
      country: sourceConfig.country ?? null
    } satisfies IcsParsedPayload
  } satisfies RawEvent;
}

async function fetchIcsCalendar(sourceConfig: ReturnType<typeof getIcsSourceConfigs>[number], input: FetchEventsInput) {
  const response = await fetch(sourceConfig.url, {
    headers: {
      Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1"
    }
  });

  if (!response.ok) {
    recordDiagnostic("error", `ICS request for ${sourceConfig.sourceName} failed with HTTP ${response.status}.`);
    return [];
  }

  const text = await response.text();
  if (!text.trim()) {
    return [];
  }

  const parsed = parseIcsCalendar(text);
  for (const warning of parsed.warnings) {
    recordDiagnostic("warning", `ICS source ${sourceConfig.sourceName}: ${warning}`);
  }

  const fetchedAt = new Date().toISOString();
  const rawEvents: RawEvent[] = [];
  let skipped = 0;

  for (const parsedEvent of parsed.events) {
    const rawEvent = prepareRawEvent(parsedEvent, sourceConfig);
    if (!rawEvent) {
      skipped += 1;
      continue;
    }

    rawEvents.push({
      ...rawEvent,
      fetchedAt
    });
  }

  if (skipped > 0) {
    recordDiagnostic(
      "warning",
      `ICS source ${sourceConfig.sourceName} skipped ${skipped} malformed or recurring event record${skipped === 1 ? "" : "s"}.`
    );
  }

  return rawEvents;
}

async function fetchIcsEvents(input: FetchEventsInput): Promise<RawEvent[]> {
  if (!env.enableIcsProvider) {
    return [];
  }

  const sourceConfigs = getIcsSourceConfigs();
  if (sourceConfigs.length === 0) {
    recordDiagnostic("warning", "ICS provider is enabled but ICS_SOURCE_URLS is missing or invalid.");
    return [];
  }

  const settled = await Promise.allSettled(
    sourceConfigs.map(async (sourceConfig) => fetchIcsCalendar(sourceConfig, input))
  );

  const rawEvents: RawEvent[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      rawEvents.push(...result.value);
      continue;
    }

    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    recordDiagnostic("error", `ICS provider request failed: ${reason}`);
  }

  return rawEvents;
}

export const icsProvider: EventSourceProvider = {
  sourceId: "ics",
  sourceName: "ICS Calendar",
  sourceType: "ics",
  enabled: env.enableIcsProvider && getIcsSourceConfigs().length > 0,
  fetchEvents: fetchIcsEvents
};
