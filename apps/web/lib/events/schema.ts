import type { OriginalSource, ScoutEvent } from "./types";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isOriginalSource(value: unknown): value is OriginalSource {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Record<string, unknown>;
  return (
    isNonEmptyString(source.sourceId) &&
    isNonEmptyString(source.sourceName) &&
    isNonEmptyString(source.sourceType) &&
    isNonEmptyString(source.sourceUrl) &&
    (source.sourceEventId === null || typeof source.sourceEventId === "string")
  );
}

export function validateScoutEvent(event: ScoutEvent): string[] {
  const errors: string[] = [];

  if (!isNonEmptyString(event.id)) {
    errors.push("id is required");
  }
  if (event.canonicalKey !== null && !isNonEmptyString(event.canonicalKey)) {
    errors.push("canonicalKey must be null or a non-empty string");
  }
  if (!isNonEmptyString(event.title)) {
    errors.push("title is required");
  }
  if (!isNullableString(event.description)) {
    errors.push("description must be null or a string");
  }
  if (!isNonEmptyString(event.startDateTime) || Number.isNaN(Date.parse(event.startDateTime))) {
    errors.push("startDateTime must be a valid date string");
  }
  if (event.endDateTime !== null && Number.isNaN(Date.parse(event.endDateTime))) {
    errors.push("endDateTime must be null or a valid date string");
  }
  if (!isNullableString(event.timezone)) {
    errors.push("timezone must be null or a string");
  }
  if (!isNullableString(event.venueName)) {
    errors.push("venueName must be null or a string");
  }
  if (!isNullableString(event.address)) {
    errors.push("address must be null or a string");
  }
  if (!isNonEmptyString(event.city)) {
    errors.push("city is required");
  }
  if (!isNullableString(event.region)) {
    errors.push("region must be null or a string");
  }
  if (!isNullableString(event.country)) {
    errors.push("country must be null or a string");
  }
  if (!isNullableString(event.neighborhood)) {
    errors.push("neighborhood must be null or a string");
  }
  if (!isNullableNumber(event.latitude)) {
    errors.push("latitude must be null or a number");
  }
  if (!isNullableNumber(event.longitude)) {
    errors.push("longitude must be null or a number");
  }
  if (!isNullableNumber(event.distanceMiles)) {
    errors.push("distanceMiles must be null or a number");
  }
  if (!["free", "paid", "unknown"].includes(event.priceType)) {
    errors.push("priceType must be free, paid, or unknown");
  }
  if (!isNullableNumber(event.minPrice)) {
    errors.push("minPrice must be null or a number");
  }
  if (!isNullableNumber(event.maxPrice)) {
    errors.push("maxPrice must be null or a number");
  }
  if (!isNullableString(event.currency)) {
    errors.push("currency must be null or a string");
  }
  if (!isNonEmptyString(event.sourceId)) {
    errors.push("sourceId is required");
  }
  if (!isNonEmptyString(event.sourceName)) {
    errors.push("sourceName is required");
  }
  if (!isNonEmptyString(event.sourceType)) {
    errors.push("sourceType is required");
  }
  if (!isNonEmptyString(event.sourceUrl)) {
    errors.push("sourceUrl is required");
  }
  if (event.sourceEventId !== null && typeof event.sourceEventId !== "string") {
    errors.push("sourceEventId must be null or a string");
  }
  if (!isNonEmptyString(event.sourceFetchedAt) || Number.isNaN(Date.parse(event.sourceFetchedAt))) {
    errors.push("sourceFetchedAt must be a valid date string");
  }
  if (!isNullableString(event.imageUrl)) {
    errors.push("imageUrl must be null or a string");
  }
  if (!Array.isArray(event.categories) || event.categories.some((value) => !isNonEmptyString(value))) {
    errors.push("categories must be a string array");
  }
  if (!Array.isArray(event.interests) || event.interests.some((value) => !isNonEmptyString(value))) {
    errors.push("interests must be a string array");
  }
  if (typeof event.confidence !== "number" || event.confidence < 0 || event.confidence > 1) {
    errors.push("confidence must be a number between 0 and 1");
  }
  if (typeof event.isNewcomerFriendly !== "boolean") {
    errors.push("isNewcomerFriendly must be a boolean");
  }
  if (typeof event.isSoloFriendly !== "boolean") {
    errors.push("isSoloFriendly must be a boolean");
  }
  if (!Array.isArray(event.originalSources) || event.originalSources.length === 0) {
    errors.push("originalSources must contain at least one source");
  } else if (event.originalSources.some((source) => !isOriginalSource(source))) {
    errors.push("every originalSources entry must include valid source attribution");
  }
  if (!isNonEmptyString(event.createdAt) || Number.isNaN(Date.parse(event.createdAt))) {
    errors.push("createdAt must be a valid date string");
  }
  if (!isNonEmptyString(event.updatedAt) || Number.isNaN(Date.parse(event.updatedAt))) {
    errors.push("updatedAt must be a valid date string");
  }

  return errors;
}

export function assertValidScoutEvent(event: ScoutEvent): ScoutEvent {
  const errors = validateScoutEvent(event);
  if (errors.length > 0) {
    throw new Error(`Invalid ScoutEvent: ${errors.join("; ")}`);
  }
  return event;
}
