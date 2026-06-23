import type { CommunitySubmission, CommunitySubmissionDraft, CommunitySubmissionStatus } from "./types";

export type CommunitySubmissionValidationIssue = {
  path: string;
  message: string;
};

export type CommunitySubmissionValidationResult =
  | {
      ok: true;
      value: CommunitySubmissionDraft;
      issues: CommunitySubmissionValidationIssue[];
    }
  | {
      ok: false;
      issues: CommunitySubmissionValidationIssue[];
    };

const MAX_LENGTHS = {
  title: 160,
  description: 3000,
  venueName: 160,
  address: 300,
  submitterName: 120,
  submitterEmail: 254,
  submitterNote: 2000
} as const;

const VALID_STATUSES = new Set<CommunitySubmissionStatus>(["pending", "approved", "rejected", "suppressed"]);

function cleanText(value: unknown, maxLength?: number) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (typeof maxLength === "number" && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength).trimEnd();
  }

  return trimmed;
}

function cleanNullableText(value: unknown, maxLength?: number) {
  if (value === null || value === undefined) {
    return null;
  }

  return cleanText(value, maxLength);
}

function cleanPriceNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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

function isEmailShaped(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toStringList(value: unknown) {
  if (value === null || value === undefined) {
    return [];
  }

  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : null;
  if (!items) {
    return null;
  }

  const cleaned = items
    .map((entry) => cleanText(entry))
    .filter((entry): entry is string => Boolean(entry));

  return [...new Set(cleaned)];
}

function statusFromValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "pending" as const;
  }

  const cleaned = cleanText(value);
  if (!cleaned || !VALID_STATUSES.has(cleaned as CommunitySubmissionStatus)) {
    return null;
  }

  return cleaned as CommunitySubmissionStatus;
}

export function validateCommunitySubmissionInput(value: unknown): CommunitySubmissionValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      issues: [
        {
          path: "body",
          message: "submission must be an object"
        }
      ]
    };
  }

  const record = value as Record<string, unknown>;
  const issues: CommunitySubmissionValidationIssue[] = [];

  const title = cleanText(record.title, MAX_LENGTHS.title);
  if (!title) {
    issues.push({ path: "title", message: "title is required" });
  }

  const startDateTime = cleanText(record.startDateTime);
  if (!startDateTime) {
    issues.push({ path: "startDateTime", message: "startDateTime is required" });
  } else if (!isValidDateString(startDateTime)) {
    issues.push({ path: "startDateTime", message: "startDateTime must be a valid date string" });
  }

  const city = cleanText(record.city);
  if (!city) {
    issues.push({ path: "city", message: "city is required" });
  }

  const sourceUrl = cleanText(record.sourceUrl);
  if (!sourceUrl) {
    issues.push({ path: "sourceUrl", message: "sourceUrl is required" });
  } else if (!isValidUrl(sourceUrl)) {
    issues.push({ path: "sourceUrl", message: "sourceUrl must be a valid URL" });
  }

  const submitterEmail = cleanNullableText(record.submitterEmail, MAX_LENGTHS.submitterEmail);
  if (submitterEmail && !isEmailShaped(submitterEmail)) {
    issues.push({ path: "submitterEmail", message: "submitterEmail must be email-shaped" });
  }

  const priceTypeRaw = cleanText(record.priceType) ?? "unknown";
  if (priceTypeRaw !== "free" && priceTypeRaw !== "paid" && priceTypeRaw !== "unknown") {
    issues.push({ path: "priceType", message: "priceType must be free, paid, or unknown" });
  }

  const endDateTime = cleanNullableText(record.endDateTime);
  if (endDateTime && !isValidDateString(endDateTime)) {
    issues.push({ path: "endDateTime", message: "endDateTime must be a valid date string" });
  }

  const status = statusFromValue(record.status);
  if (record.status !== undefined && status === null) {
    issues.push({ path: "status", message: "status must be pending, approved, rejected, or suppressed" });
  }

  const categories = toStringList(record.categories);
  if (categories === null) {
    issues.push({ path: "categories", message: "categories must be an array of strings or comma-separated text" });
  }

  const interests = toStringList(record.interests);
  if (interests === null) {
    issues.push({ path: "interests", message: "interests must be an array of strings or comma-separated text" });
  }

  const minPrice = cleanPriceNumber(record.minPrice);
  if (record.minPrice !== undefined && record.minPrice !== null && minPrice === null) {
    issues.push({ path: "minPrice", message: "minPrice must be a number or null" });
  }

  const maxPrice = cleanPriceNumber(record.maxPrice);
  if (record.maxPrice !== undefined && record.maxPrice !== null && maxPrice === null) {
    issues.push({ path: "maxPrice", message: "maxPrice must be a number or null" });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const valueDraft: CommunitySubmissionDraft = {
    title: title!,
    description: cleanNullableText(record.description, MAX_LENGTHS.description),
    startDateTime: startDateTime!,
    endDateTime: endDateTime,
    timezone: cleanNullableText(record.timezone),
    venueName: cleanNullableText(record.venueName, MAX_LENGTHS.venueName),
    address: cleanNullableText(record.address, MAX_LENGTHS.address),
    city: city!,
    region: cleanNullableText(record.region),
    country: cleanNullableText(record.country),
    priceType: (priceTypeRaw as CommunitySubmission["priceType"]) ?? "unknown",
    minPrice,
    maxPrice,
    currency: cleanNullableText(record.currency),
    sourceUrl: sourceUrl!,
    submitterName: cleanNullableText(record.submitterName, MAX_LENGTHS.submitterName),
    submitterEmail,
    submitterNote: cleanNullableText(record.submitterNote, MAX_LENGTHS.submitterNote),
    categories: categories ?? [],
    interests: interests ?? []
  };

  return {
    ok: true,
    value: valueDraft,
    issues: []
  };
}

export function assertValidCommunitySubmissionInput(value: unknown) {
  const result = validateCommunitySubmissionInput(value);
  if (!result.ok) {
    throw new Error(`Invalid community submission: ${result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }

  return result.value;
}

