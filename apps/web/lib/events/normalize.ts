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

function clean(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? null;
}

export function normalizeRawEvent(rawEvent: RawEvent): ScoutEvent {
  const raw = rawEvent.raw as NormalizableEvent;
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
