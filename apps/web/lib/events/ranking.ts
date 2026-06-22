import { SOURCE_TRUST } from "@/data/source-trust";
import { calculateDistanceMiles } from "@/lib/utils/distance";
import type { RankingInput, ScoredEvent, ScoutEvent } from "./types";

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getInterestMatch(event: ScoutEvent, interests: string[]) {
  if (!interests.length) {
    return 0.5;
  }

  const eventTags = new Set(event.interests);
  const matches = interests.filter((interest) => eventTags.has(interest)).length;
  return clamp(matches / interests.length);
}

function getDateSoonness(event: ScoutEvent) {
  const now = new Date("2026-06-19T12:00:00.000Z").getTime();
  const start = new Date(event.startDateTime).getTime();
  const diffHours = (start - now) / (1000 * 60 * 60);

  if (diffHours <= 0) {
    return 1;
  }
  if (diffHours <= 24) {
    return clamp(1 - diffHours / 24);
  }
  if (diffHours <= 24 * 14) {
    return clamp(1 - diffHours / (24 * 14));
  }
  return 0.1;
}

function getDistanceScore(event: ScoutEvent, input: RankingInput) {
  const distance = calculateDistanceMiles(
    input.latitude ?? null,
    input.longitude ?? null,
    event.latitude,
    event.longitude
  );
  if (distance === null) {
    return 0.5;
  }
  return clamp(1 - distance / 25);
}

export function scoreEvent(event: ScoutEvent, input: RankingInput): ScoredEvent {
  const interestMatch = getInterestMatch(event, input.interests);
  const dateSoonness = getDateSoonness(event);
  const distanceScore = getDistanceScore(event, input);
  const sourceTrust = SOURCE_TRUST[event.sourceId] ?? event.confidence;
  const affordability =
    input.preferFree && event.priceType === "free"
      ? 1
      : event.priceType === "free"
        ? 0.9
        : event.priceType === "paid"
          ? 0.5
          : 0.4;
  const newcomerBoost = event.isNewcomerFriendly ? 1 : event.isSoloFriendly ? 0.7 : 0.2;

  const score =
    interestMatch * 0.35 +
    dateSoonness * 0.2 +
    distanceScore * 0.15 +
    sourceTrust * 0.15 +
    affordability * 0.1 +
    newcomerBoost * 0.05;

  return {
    ...event,
    distanceMiles: calculateDistanceMiles(
      input.latitude ?? null,
      input.longitude ?? null,
      event.latitude,
      event.longitude
    ),
    score,
    scoreBreakdown: {
      interestMatch,
      dateSoonness,
      distanceScore,
      sourceTrust,
      affordability,
      newcomerBoost
    }
  };
}

export function rankEvents(events: ScoutEvent[], input: RankingInput): ScoredEvent[] {
  return events
    .map((event) => scoreEvent(event, input))
    .sort((left, right) => right.score - left.score);
}
