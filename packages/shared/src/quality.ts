import { EventRecord, ConfidenceLabel } from "./types";

const spamTokens = [
  "crypto giveaway",
  "guaranteed profit",
  "dm for details",
  "click link now"
];

export function isSpamLike(event: Pick<EventRecord, "title" | "description">): boolean {
  const target = `${event.title} ${event.description}`.toLowerCase();
  return spamTokens.some((token) => target.includes(token));
}

export function isExpired(event: Pick<EventRecord, "end_time" | "start_time">, nowIso: string): boolean {
  const now = new Date(nowIso).getTime();
  const end = event.end_time
    ? new Date(event.end_time).getTime()
    : new Date(event.start_time).getTime();
  return end < now;
}

export function hasMandatoryFields(
  event: Partial<Pick<EventRecord, "title" | "start_time" | "address" | "source_url">>
): boolean {
  return Boolean(event.title && event.start_time && event.address && event.source_url);
}

export function calculateConfidence(event: EventRecord): number {
  let score = 0.3;

  if (event.lat !== 0 && event.lng !== 0) {
    score += 0.2;
  }
  if (event.venue_name) {
    score += 0.1;
  }
  if (event.description.length > 40) {
    score += 0.1;
  }
  if (event.categories.length > 0) {
    score += 0.1;
  }
  if (event.engagement_signals.upvotes || event.engagement_signals.interested_count) {
    score += 0.1;
  }
  if (event.source === "event_api") {
    score += 0.1;
  }
  if (event.verification_count >= 2) {
    score += 0.2;
  }
  if (event.verified_by_trusted_source) {
    score += 0.2;
  }
  if (event.publish_state === "published") {
    score += 0.05;
  }

  return Math.max(0, Math.min(1, score));
}

export function confidenceLabel(confidence: number): ConfidenceLabel {
  if (confidence >= 0.75) {
    return "high";
  }
  if (confidence >= 0.45) {
    return "medium";
  }
  return "low";
}
