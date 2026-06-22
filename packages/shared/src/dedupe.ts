import { EventRecord } from "./types";
import { haversineDistanceKm } from "./geo";

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (!aTokens.size || !bTokens.size) {
    return 0;
  }
  let intersect = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      intersect += 1;
    }
  }
  const union = new Set([...aTokens, ...bTokens]).size;
  return intersect / union;
}

function hasTimeOverlap(a: EventRecord, b: EventRecord): boolean {
  const startA = new Date(a.start_time).getTime();
  const endA = a.end_time ? new Date(a.end_time).getTime() : startA + 2 * 3600 * 1000;
  const startB = new Date(b.start_time).getTime();
  const endB = b.end_time ? new Date(b.end_time).getTime() : startB + 2 * 3600 * 1000;
  return startA <= endB && startB <= endA;
}

export function isProbableDuplicate(a: EventRecord, b: EventRecord): boolean {
  if (a.source === b.source && a.source_event_id === b.source_event_id) {
    return true;
  }

  const titleSimilarity = jaccardSimilarity(a.title, b.title);
  const geoDistanceKm = haversineDistanceKm(a.lat, a.lng, b.lat, b.lng);
  const overlap = hasTimeOverlap(a, b);

  return titleSimilarity >= 0.65 && geoDistanceKm <= 1.5 && overlap;
}
