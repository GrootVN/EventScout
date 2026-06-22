import { classifyInterests } from "./classifyInterests";
import { assertValidScoutEvent } from "./schema";
import type { RawEvent, ScoutEvent } from "./types";
import { slugify } from "@/lib/utils/slug";

type NormalizableEvent = {
  id?: string;
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
  neighborhood?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  priceType?: "free" | "paid" | "unknown";
  minPrice?: number | null;
  maxPrice?: number | null;
  currency?: string | null;
  imageUrl?: string | null;
  categories?: string[];
};

type TicketmasterRawEvent = {
  id?: unknown;
  name?: unknown;
  url?: unknown;
  info?: unknown;
  pleaseNote?: unknown;
  description?: unknown;
  images?: Array<Record<string, unknown>>;
  classifications?: Array<{
    segment?: { name?: unknown };
    genre?: { name?: unknown };
    subGenre?: { name?: unknown };
    type?: { name?: unknown };
  }>;
  priceRanges?: Array<{
    currency?: unknown;
    min?: unknown;
    max?: unknown;
  }>;
  dates?: {
    timezone?: unknown;
    start?: {
      dateTime?: unknown;
      localDate?: unknown;
      localTime?: unknown;
      timezone?: unknown;
    };
    end?: {
      dateTime?: unknown;
      localDate?: unknown;
      localTime?: unknown;
      timezone?: unknown;
    };
  };
  _embedded?: {
    venues?: Array<{
      name?: unknown;
      city?: { name?: unknown };
      state?: { stateCode?: unknown };
      country?: { countryCode?: unknown; name?: unknown };
      address?: { line1?: unknown; line2?: unknown };
      location?: { latitude?: unknown; longitude?: unknown };
    }>;
  };
};

function clean(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? null;
}

function cleanUnknown(value: unknown) {
  return typeof value === "string" ? clean(value) : null;
}

function normalizeCountry(value: unknown) {
  const country = cleanUnknown(value);
  if (!country) {
    return null;
  }

  const normalized = country.toUpperCase();
  if (
    normalized === "US" ||
    normalized === "USA" ||
    normalized === "UNITED STATES" ||
    normalized === "UNITED STATES OF AMERICA"
  ) {
    return "USA";
  }

  return country;
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function resolveTicketmasterDate(dateTime: unknown, localDate: unknown, localTime: unknown) {
  const exactDateTime = cleanUnknown(dateTime);
  if (exactDateTime) {
    return exactDateTime;
  }

  const cleanedDate = cleanUnknown(localDate);
  if (!cleanedDate) {
    return null;
  }

  const cleanedTime = cleanUnknown(localTime);
  if (cleanedTime) {
    return `${cleanedDate}T${cleanedTime}Z`;
  }

  return `${cleanedDate}T12:00:00.000Z`;
}

function mapTicketmasterCategories(classifications: TicketmasterRawEvent["classifications"]) {
  if (!Array.isArray(classifications)) {
    return [];
  }

  const categories = new Set<string>();

  for (const classification of classifications) {
    const labels = [
      cleanUnknown(classification?.segment?.name),
      cleanUnknown(classification?.genre?.name),
      cleanUnknown(classification?.subGenre?.name),
      cleanUnknown(classification?.type?.name)
    ]
      .filter((label): label is string => label !== null)
      .map((label) => label.toLowerCase());

    const labelText = labels.join(" ");

    if (labelText.includes("music")) {
      categories.add("music");
    }
    if (labelText.includes("sports")) {
      categories.add("sports");
    }
    if (labelText.includes("arts & theatre") || labelText.includes("arts and theatre")) {
      categories.add("arts");
      categories.add("theater");
    }
    if (labelText.includes("film")) {
      categories.add("film");
    }
    if (labelText.includes("family")) {
      categories.add("family");
    }
    if (labelText.includes("miscellaneous")) {
      categories.add("culture");
      categories.add("entertainment");
    }
  }

  return [...categories];
}

function normalizeTicketmasterPriceRanges(priceRanges: TicketmasterRawEvent["priceRanges"]) {
  if (!Array.isArray(priceRanges) || priceRanges.length === 0) {
    return {
      priceType: "unknown" as const,
      minPrice: null,
      maxPrice: null,
      currency: null
    };
  }

  const parsedRanges = priceRanges
    .map((range) => {
      if (!range || typeof range !== "object") {
        return null;
      }

      const min = toNumber(range.min);
      const max = toNumber(range.max);
      return {
        min,
        max,
        currency: cleanUnknown(range.currency)
      };
    })
    .filter((range): range is { min: number | null; max: number | null; currency: string | null } => Boolean(range));

  if (parsedRanges.length === 0) {
    return {
      priceType: "unknown" as const,
      minPrice: null,
      maxPrice: null,
      currency: null
    };
  }

  const minValues = parsedRanges.flatMap((range) => (range.min === null ? [] : [range.min]));
  const maxValues = parsedRanges.flatMap((range) => (range.max === null ? [] : [range.max]));
  const currency = parsedRanges.find((range) => range.currency)?.currency ?? null;
  const clearlyFree =
    parsedRanges.length > 0 &&
    parsedRanges.every((range) => range.min === 0 && (range.max === 0 || range.max === null));

  return {
    priceType: clearlyFree ? ("free" as const) : ("paid" as const),
    minPrice: minValues.length > 0 ? Math.min(...minValues) : null,
    maxPrice: maxValues.length > 0 ? Math.max(...maxValues) : null,
    currency
  };
}

function selectTicketmasterImage(images: TicketmasterRawEvent["images"]) {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  return images
    .map((image) => {
      if (!image || typeof image !== "object") {
        return null;
      }

      const url = cleanUnknown(image.url);
      if (!url) {
        return null;
      }

      const width = toNumber(image.width) ?? 0;
      const height = toNumber(image.height) ?? 0;

      return {
        url,
        score: width * height
      };
    })
    .filter((image): image is { url: string; score: number } => Boolean(image))
    .sort((left, right) => right.score - left.score)[0]?.url ?? null;
}

function normalizeTicketmasterEvent(rawEvent: TicketmasterRawEvent): NormalizableEvent {
  if (!rawEvent || typeof rawEvent !== "object") {
    throw new Error("Ticketmaster event payload is malformed");
  }

  const venue = rawEvent._embedded?.venues?.[0];
  const start = rawEvent.dates?.start;
  const end = rawEvent.dates?.end;
  const price = normalizeTicketmasterPriceRanges(rawEvent.priceRanges);
  const addressParts = [cleanUnknown(venue?.address?.line1), cleanUnknown(venue?.address?.line2)].filter(Boolean);
  const startDateTime =
    resolveTicketmasterDate(start?.dateTime, start?.localDate, start?.localTime);

  if (!startDateTime) {
    throw new Error("Ticketmaster event is missing a start date");
  }

  return {
    id: cleanUnknown(rawEvent.id) ?? undefined,
    title: cleanUnknown(rawEvent.name) ?? "Untitled Event",
    description: cleanUnknown(rawEvent.info) ?? cleanUnknown(rawEvent.pleaseNote) ?? cleanUnknown(rawEvent.description),
    startDateTime,
    endDateTime:
      resolveTicketmasterDate(end?.dateTime, end?.localDate, end?.localTime) ??
      null,
    timezone: cleanUnknown(start?.timezone) ?? cleanUnknown(rawEvent.dates?.timezone),
    venueName: cleanUnknown(venue?.name),
    address: addressParts.length > 0 ? addressParts.join(", ") : null,
    city: cleanUnknown(venue?.city?.name) ?? "Unknown",
    region: cleanUnknown(venue?.state?.stateCode),
    country: normalizeCountry(venue?.country?.countryCode ?? venue?.country?.name),
    neighborhood: null,
    latitude: toNumber(venue?.location?.latitude),
    longitude: toNumber(venue?.location?.longitude),
    priceType: price.priceType,
    minPrice: price.minPrice,
    maxPrice: price.maxPrice,
    currency: price.currency,
    imageUrl: selectTicketmasterImage(rawEvent.images),
    categories: mapTicketmasterCategories(rawEvent.classifications)
  };
}

export function normalizeRawEvent(rawEvent: RawEvent): ScoutEvent {
  const raw = rawEvent.sourceId === "ticketmaster" ? normalizeTicketmasterEvent(rawEvent.raw as TicketmasterRawEvent) : (rawEvent.raw as NormalizableEvent);
  const title = clean(raw.title) ?? "Untitled Event";
  const description = clean(raw.description);
  const venueName = clean(raw.venueName);
  const address = clean(raw.address);
  const city = clean(raw.city) ?? "Unknown";
  const region = clean(raw.region);
  const country = clean(raw.country) ?? "USA";
  const neighborhood = clean(raw.neighborhood);
  const categories = [...new Set((raw.categories ?? []).map((entry) => entry.trim().toLowerCase()))];
  const interests = classifyInterests({
    title,
    description,
    categories,
    priceType: raw.priceType ?? "unknown"
  });
  const createdAt = rawEvent.fetchedAt;
  const updatedAt = rawEvent.fetchedAt;
  const sourceEventId = rawEvent.sourceEventId ?? null;
  const canonicalKey = `${slugify(title)}|${raw.startDateTime.slice(0, 10)}|${slugify(venueName ?? city)}`;

  return assertValidScoutEvent({
    id: raw.id ?? `${rawEvent.sourceId}-${sourceEventId ?? slugify(title)}`,
    canonicalKey,
    title,
    description,
    startDateTime: raw.startDateTime,
    endDateTime: raw.endDateTime ?? null,
    timezone: raw.timezone ?? "America/New_York",
    venueName,
    address,
    city,
    region,
    country,
    neighborhood,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    distanceMiles: null,
    priceType: raw.priceType ?? "unknown",
    minPrice: raw.minPrice ?? null,
    maxPrice: raw.maxPrice ?? null,
    currency: raw.currency ?? "USD",
    sourceId: rawEvent.sourceId,
    sourceName: rawEvent.sourceName,
    sourceType: rawEvent.sourceType,
    sourceUrl: rawEvent.sourceUrl,
    sourceEventId,
    sourceFetchedAt: rawEvent.fetchedAt,
    imageUrl: raw.imageUrl ?? null,
    categories,
    interests,
    confidence: rawEvent.sourceType === "social" ? 0.55 : 0.92,
    isNewcomerFriendly: interests.includes("newcomer-friendly"),
    isSoloFriendly: interests.includes("solo-friendly"),
    originalSources: [
      {
        sourceId: rawEvent.sourceId,
        sourceName: rawEvent.sourceName,
        sourceType: rawEvent.sourceType,
        sourceUrl: rawEvent.sourceUrl,
        sourceEventId
      }
    ],
    createdAt,
    updatedAt
  });
}
