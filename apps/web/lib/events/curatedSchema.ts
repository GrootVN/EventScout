export type CuratedEventInput = {
  id: string;
  title: string;
  description?: string | null;

  startDateTime: string;
  endDateTime?: string | null;
  timezone?: string | null;

  venueName?: string | null;
  address?: string | null;
  city: string;
  region?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;

  priceType: "free" | "paid" | "unknown";
  minPrice?: number | null;
  maxPrice?: number | null;
  currency?: string | null;

  sourceUrl: string;
  sourceName?: string;
  sourceEventId?: string | null;

  imageUrl?: string | null;

  categories?: string[];
  interests?: string[];

  confidence?: number;
  isNewcomerFriendly?: boolean;
  isSoloFriendly?: boolean;

  status?: "approved" | "pending" | "rejected" | "suppressed";
  notes?: string | null;
};

export type CuratedEventRecord = CuratedEventInput & {
  status: "approved" | "pending" | "rejected" | "suppressed";
};

export type CuratedEventValidationResult =
  | {
      ok: true;
      value: CuratedEventRecord;
      warnings: string[];
    }
  | {
      ok: false;
      errors: string[];
    };

const VALID_STATUS = new Set(["approved", "pending", "rejected", "suppressed"] as const);

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanNullableString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return cleanString(value);
}

function cleanNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const entries: string[] = [];
  for (const entry of value) {
    const cleaned = cleanString(entry);
    if (!cleaned) {
      return null;
    }
    entries.push(cleaned);
  }

  return entries;
}

function isValidDateString(value: string) {
  return !Number.isNaN(Date.parse(value));
}

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function validateCuratedEvent(value: unknown): CuratedEventValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      errors: ["curated event must be an object"]
    };
  }

  const record = value as Record<string, unknown>;
  const errors: string[] = [];
  const warnings: string[] = [];

  const id = cleanString(record.id);
  if (!id) {
    errors.push("id is required");
  }

  const title = cleanString(record.title);
  if (!title) {
    errors.push("title is required");
  }

  const startDateTime = cleanString(record.startDateTime);
  if (!startDateTime) {
    errors.push("startDateTime is required");
  } else if (!isValidDateString(startDateTime)) {
    errors.push("startDateTime must be a valid date string");
  }

  const city = cleanString(record.city);
  if (!city) {
    errors.push("city is required");
  }

  const priceType = cleanString(record.priceType);
  if (!priceType) {
    errors.push("priceType is required");
  } else if (priceType !== "free" && priceType !== "paid" && priceType !== "unknown") {
    errors.push("priceType must be free, paid, or unknown");
  }

  const sourceUrl = cleanString(record.sourceUrl);
  if (!sourceUrl) {
    errors.push("sourceUrl is required");
  } else if (!isValidUrl(sourceUrl)) {
    errors.push("sourceUrl must be a valid URL");
  }

  const endDateTime = cleanNullableString(record.endDateTime);
  if (endDateTime && !isValidDateString(endDateTime)) {
    errors.push("endDateTime must be a valid date string");
  }

  const timezone = cleanNullableString(record.timezone);
  const venueName = cleanNullableString(record.venueName);
  const address = cleanNullableString(record.address);
  const region = cleanNullableString(record.region);
  const country = cleanNullableString(record.country);
  const latitude = record.latitude === undefined || record.latitude === null ? null : cleanNumber(record.latitude);
  const longitude = record.longitude === undefined || record.longitude === null ? null : cleanNumber(record.longitude);
  const minPrice = record.minPrice === undefined || record.minPrice === null ? null : cleanNumber(record.minPrice);
  const maxPrice = record.maxPrice === undefined || record.maxPrice === null ? null : cleanNumber(record.maxPrice);
  const currency = cleanNullableString(record.currency);
  const sourceName = cleanNullableString(record.sourceName);
  const sourceEventId = record.sourceEventId === undefined ? null : cleanNullableString(record.sourceEventId);
  const imageUrl = cleanNullableString(record.imageUrl);
  const categories = record.categories === undefined ? undefined : cleanStringArray(record.categories);
  const interests = record.interests === undefined ? undefined : cleanStringArray(record.interests);
  const notes = cleanNullableString(record.notes);

  if (record.categories !== undefined && !categories) {
    errors.push("categories must be a string array");
  }
  if (record.interests !== undefined && !interests) {
    errors.push("interests must be a string array");
  }

  if (record.latitude !== undefined && record.latitude !== null && latitude === null) {
    errors.push("latitude must be null or a number");
  }
  if (record.longitude !== undefined && record.longitude !== null && longitude === null) {
    errors.push("longitude must be null or a number");
  }
  if (record.minPrice !== undefined && record.minPrice !== null && minPrice === null) {
    errors.push("minPrice must be null or a number");
  }
  if (record.maxPrice !== undefined && record.maxPrice !== null && maxPrice === null) {
    errors.push("maxPrice must be null or a number");
  }
  if (record.confidence !== undefined && (typeof record.confidence !== "number" || !Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1)) {
    errors.push("confidence must be a number between 0 and 1");
  }
  if (record.isNewcomerFriendly !== undefined && typeof record.isNewcomerFriendly !== "boolean") {
    errors.push("isNewcomerFriendly must be a boolean");
  }
  if (record.isSoloFriendly !== undefined && typeof record.isSoloFriendly !== "boolean") {
    errors.push("isSoloFriendly must be a boolean");
  }

  const statusValue = record.status === undefined ? "approved" : cleanString(record.status);
  if (record.status !== undefined && (!statusValue || !VALID_STATUS.has(statusValue as CuratedEventRecord["status"]))) {
    errors.push("status must be approved, pending, rejected, or suppressed");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const curatedEvent: CuratedEventRecord = {
    id: id!,
    title: title!,
    description: cleanNullableString(record.description),
    startDateTime: startDateTime!,
    endDateTime,
    timezone,
    venueName,
    address,
    city: city!,
    region,
    country,
    latitude,
    longitude,
    priceType: priceType as CuratedEventRecord["priceType"],
    minPrice,
    maxPrice,
    currency,
    sourceUrl: sourceUrl!,
    sourceName: sourceName ?? undefined,
    sourceEventId,
    imageUrl,
    categories: categories ?? undefined,
    interests: interests ?? undefined,
    confidence: typeof record.confidence === "number" ? record.confidence : undefined,
    isNewcomerFriendly:
      typeof record.isNewcomerFriendly === "boolean" ? record.isNewcomerFriendly : undefined,
    isSoloFriendly:
      typeof record.isSoloFriendly === "boolean" ? record.isSoloFriendly : undefined,
    status: (statusValue ?? "approved") as CuratedEventRecord["status"],
    notes
  };

  if (!curatedEvent.sourceName) {
    warnings.push("sourceName is missing and will default to Curated Admin Events.");
  }

  return {
    ok: true,
    value: curatedEvent,
    warnings
  };
}

export function assertValidCuratedEvent(value: unknown) {
  const result = validateCuratedEvent(value);
  if (!result.ok) {
    throw new Error(`Invalid curated event: ${result.errors.join("; ")}`);
  }

  return result.value;
}
