import type { OriginalSource, ScoutEvent } from "./types";

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/\bmeet[\s-]+up\b/g, "meetup")
    .replace(/\bco[\s-]+working\b/g, "coworking")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeTitle(title: string) {
  return new Set(
    normalizeTitle(title)
      .split(" ")
      .filter((token) => token.length > 2)
      .filter((token) => !["the", "for", "and", "with"].includes(token))
  );
}

function getVenueKey(event: ScoutEvent) {
  return (event.venueName ?? event.address ?? event.city).toLowerCase().trim();
}

export function getDuplicateConfidence(left: ScoutEvent, right: ScoutEvent) {
  if (left.sourceId === right.sourceId && left.sourceEventId === right.sourceEventId) {
    return 1;
  }

  const leftTokens = tokenizeTitle(left.title);
  const rightTokens = tokenizeTitle(right.title);
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size || 1;
  const titleSimilarity = intersection / union;
  const sameDay = left.startDateTime.slice(0, 10) === right.startDateTime.slice(0, 10);
  const sameVenue = getVenueKey(left) === getVenueKey(right);

  let confidence = titleSimilarity * 0.7;
  if (sameDay) {
    confidence += 0.2;
  }
  if (sameVenue) {
    confidence += 0.1;
  }

  return Number(Math.min(1, confidence).toFixed(3));
}

export function isLikelyDuplicate(left: ScoutEvent, right: ScoutEvent) {
  return getDuplicateConfidence(left, right) >= 0.72;
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
  const place = getVenueKey(event);
  return `${title}|${day}|${place}`;
}

export function dedupeEvents(events: ScoutEvent[]) {
  const deduped: ScoutEvent[] = [];

  for (const event of events) {
    const existing = deduped.find((candidate) => {
      const exactKeyMatch = getDedupeKey(candidate) === getDedupeKey(event);
      return exactKeyMatch || isLikelyDuplicate(candidate, event);
    });

    if (!existing) {
      deduped.push(event);
      continue;
    }

    const mergedEvent: ScoutEvent = {
      ...existing,
      confidence: Math.max(existing.confidence, event.confidence),
      interests: [...new Set([...existing.interests, ...event.interests])],
      categories: [...new Set([...existing.categories, ...event.categories])],
      originalSources: mergeSources(existing.originalSources, event.originalSources),
      updatedAt: event.updatedAt
    };

    const existingIndex = deduped.indexOf(existing);
    deduped.splice(existingIndex, 1, mergedEvent);
  }

  return deduped;
}
