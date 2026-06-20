import type { OriginalSource, ScoutEvent } from "./types";

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeSources(existing: OriginalSource[], incoming: OriginalSource[]) {
  const merged = new Map(existing.map((source) => [`${source.sourceId}:${source.sourceEventId}:${source.sourceUrl}`, source]));
  for (const source of incoming) {
    merged.set(`${source.sourceId}:${source.sourceEventId}:${source.sourceUrl}`, source);
  }
  return [...merged.values()];
}

export function getDedupeKey(event: ScoutEvent) {
  const title = normalizeTitle(event.title);
  const day = event.startDateTime.slice(0, 10);
  const place = (event.venueName ?? event.address ?? event.city).toLowerCase();
  return `${title}|${day}|${place}`;
}

export function dedupeEvents(events: ScoutEvent[]) {
  const byKey = new Map<string, ScoutEvent>();

  for (const event of events) {
    const key = getDedupeKey(event);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, event);
      continue;
    }

    byKey.set(key, {
      ...existing,
      confidence: Math.max(existing.confidence, event.confidence),
      interests: [...new Set([...existing.interests, ...event.interests])],
      categories: [...new Set([...existing.categories, ...event.categories])],
      originalSources: mergeSources(existing.originalSources, event.originalSources),
      updatedAt: event.updatedAt
    });
  }

  return [...byKey.values()];
}
