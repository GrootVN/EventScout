import { env } from "@/lib/config/env";
import type { RawEvent } from "@/lib/events/types";
import { getRssSourceConfigs } from "@/config/rss-sources";
import type { EventSourceProvider, FetchEventsInput } from "./provider";
import { parseRssFeed } from "./rssParser";
import type { RssSourceConfig } from "@/config/rss-sources";

type Diagnostic = {
  level: "warning" | "error";
  message: string;
};

type RssParsedPayload = {
  id: string | null;
  title: string;
  description: string | null;
  startDateTime: string;
  endDateTime: string | null;
  timezone: string | null;
  venueName: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  priceType: "free" | "paid" | "unknown";
  minPrice: number | null;
  maxPrice: number | null;
  currency: string | null;
  imageUrl: string | null;
  categories: string[];
  interests: string[];
  confidence: number;
  publishedAt: string | null;
  updatedAt: string | null;
  sourceFeedUrl: string;
  feedTitle: string | null;
};

const diagnostics: Diagnostic[] = [];

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function recordDiagnostic(level: Diagnostic["level"], message: string) {
  diagnostics.push({ level, message });
}

export function consumeRssProviderDiagnostics() {
  const current = [...diagnostics];
  diagnostics.length = 0;
  return current;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => clean(value)).filter((value) => value.length > 0))];
}

function resolveSourceUrl(itemLink: string | null, feedUrl: string) {
  const cleanedLink = clean(itemLink);
  if (!cleanedLink) {
    return null;
  }

  try {
    return new URL(cleanedLink, feedUrl).toString();
  } catch {
    return null;
  }
}

function buildRawEvent(
  item: ReturnType<typeof parseRssFeed>["items"][number],
  sourceConfig: RssSourceConfig,
  feedTitle: string | null,
  sourceFeedUrl: string
) {
  const title = clean(item.title);
  if (!title) {
    recordDiagnostic("warning", `RSS item from ${sourceConfig.sourceName} was skipped because the title was missing.`);
    return null;
  }

  const sourceUrl = resolveSourceUrl(item.link, sourceFeedUrl);
  if (!sourceUrl) {
    recordDiagnostic(
      "warning",
      `RSS item ${title} from ${sourceConfig.sourceName} was skipped because it did not include a clear sourceUrl.`
    );
    return null;
  }

  const startDateTime = clean(item.eventDate);
  if (!startDateTime) {
    recordDiagnostic(
      "warning",
      `RSS item ${title} from ${sourceConfig.sourceName} was skipped because it did not include a clear event date.`
    );
    return null;
  }

  const categories = uniqueStrings([...(sourceConfig.defaultCategories ?? []), ...item.categories]);
  const interests = uniqueStrings([...(sourceConfig.defaultInterests ?? []), ...item.categories]);
  const confidence = sourceConfig.confidence ?? 0.78;
  const resolvedFeedTitle = feedTitle ?? sourceConfig.sourceName;
  const fetchedAt = new Date().toISOString();

  return {
    sourceId: "rss",
    sourceName: resolvedFeedTitle,
    sourceType: "rss" as const,
    sourceEventId: clean(item.id) || null,
    sourceUrl,
    fetchedAt,
    raw: {
      id: clean(item.id) || null,
      title,
      description: item.description,
      startDateTime,
      endDateTime: item.endDateTime,
      timezone: item.timezone,
      venueName: item.venueName,
      address: item.address,
      city: item.city ?? sourceConfig.city ?? null,
      region: item.region ?? sourceConfig.region ?? null,
      country: item.country ?? sourceConfig.country ?? null,
      priceType: "unknown" as const,
      minPrice: null,
      maxPrice: null,
      currency: null,
      imageUrl: null,
      categories,
      interests,
      confidence,
      publishedAt: item.publishedAt,
      updatedAt: item.updatedAt,
      sourceFeedUrl,
      feedTitle: resolvedFeedTitle
    } satisfies RssParsedPayload
  } satisfies RawEvent;
}

async function fetchRssFeed(sourceConfig: RssSourceConfig) {
  const response = await fetch(sourceConfig.url, {
    headers: {
      Accept: "application/rss+xml, application/atom+xml, text/xml, application/xml, */*;q=0.1"
    }
  });

  if (!response.ok) {
    recordDiagnostic("error", `RSS request for ${sourceConfig.sourceName} failed with HTTP ${response.status}.`);
    return [];
  }

  const text = await response.text();
  if (!text.trim()) {
    return [];
  }

  const parsed = parseRssFeed(text);
  for (const warning of parsed.warnings) {
    recordDiagnostic("warning", `RSS source ${sourceConfig.sourceName}: ${warning}`);
  }

  const rawEvents: RawEvent[] = [];
  let skipped = 0;

  for (const item of parsed.items) {
    const rawEvent = buildRawEvent(item, sourceConfig, parsed.feedTitle, sourceConfig.url);
    if (!rawEvent) {
      skipped += 1;
      continue;
    }

    rawEvents.push(rawEvent);
  }

  if (skipped > 0) {
    recordDiagnostic(
      "warning",
      `RSS source ${sourceConfig.sourceName} skipped ${skipped} record${skipped === 1 ? "" : "s"} without a usable sourceUrl or event date.`
    );
  }

  return rawEvents;
}

async function fetchRssEvents(input: FetchEventsInput): Promise<RawEvent[]> {
  if (!env.enableRssProvider) {
    return [];
  }

  const sourceConfigs = getRssSourceConfigs();
  if (sourceConfigs.length === 0) {
    recordDiagnostic("warning", "RSS provider is enabled but RSS_SOURCE_URLS is missing or invalid.");
    return [];
  }

  const settled = await Promise.allSettled(
    sourceConfigs.map(async (sourceConfig) => fetchRssFeed(sourceConfig))
  );

  const rawEvents: RawEvent[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      rawEvents.push(...result.value);
      continue;
    }

    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    recordDiagnostic("error", `RSS provider request failed: ${reason}`);
  }

  return rawEvents;
}

export const rssProvider: EventSourceProvider = {
  sourceId: "rss",
  sourceName: "RSS Feed",
  sourceType: "rss",
  enabled: env.enableRssProvider && getRssSourceConfigs().length > 0,
  fetchEvents: fetchRssEvents
};
