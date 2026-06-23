import type { ScoutEvent } from "./types";

function buildSuppressedIdSet(suppressedIds: Iterable<string>) {
  return new Set([...suppressedIds].map((value) => value.trim()).filter((value) => value.length > 0));
}

export function shouldSuppressEvent(event: ScoutEvent, suppressedIds: Iterable<string>) {
  const suppressed = buildSuppressedIdSet(suppressedIds);
  if (suppressed.has(event.id)) {
    return true;
  }

  return event.originalSources.some((source) => {
    const sourceEventId = source.sourceEventId?.trim();
    return Boolean(sourceEventId && suppressed.has(sourceEventId));
  });
}

export function filterSuppressedEvents(events: ScoutEvent[], suppressedIds: Iterable<string>) {
  const suppressed = buildSuppressedIdSet(suppressedIds);
  return events.filter((event) => {
    if (suppressed.has(event.id)) {
      return false;
    }

    return !event.originalSources.some((source) => {
      const sourceEventId = source.sourceEventId?.trim();
      return Boolean(sourceEventId && suppressed.has(sourceEventId));
    });
  });
}
