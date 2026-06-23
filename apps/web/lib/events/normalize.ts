import { classifyInterests } from "./classifyInterests";
import type { CuratedEventInput } from "./curatedSchema";
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
  interests?: string[];
  confidence?: number;
  isNewcomerFriendly?: boolean;
  isSoloFriendly?: boolean;
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

function normalizeTagList(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => cleanUnknown(value)?.toLowerCase().trim() ?? null)
    .filter((value): value is string => Boolean(value));
}

function splitIcsLocation(value: string) {
  const separators = ["\n", " | ", " - ", " @ "];
  for (const separator of separators) {
    if (value.includes(separator)) {
      const [venueName, ...rest] = value.split(separator);
      return {
        venueName: clean(venueName) ?? value,
        address: clean(rest.join(separator))
      };
    }
  }

  return {
    venueName: value,
    address: null
  };
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

type IcsRawEvent = {
  uid?: string | null;
  summary?: string | null;
  description?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  timezone?: string | null;
  venueName?: string | null;
  address?: string | null;
  location?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  priceType?: "free" | "paid" | "unknown";
  minPrice?: number | null;
  maxPrice?: number | null;
  currency?: string | null;
  imageUrl?: string | null;
  categories?: string[];
  interests?: string[];
  confidence?: number;
  sourceCalendarUrl?: string | null;
  url?: string | null;
};

type RssRawEvent = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  timezone?: string | null;
  venueName?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  priceType?: "free" | "paid" | "unknown";
  minPrice?: number | null;
  maxPrice?: number | null;
  currency?: string | null;
  imageUrl?: string | null;
  categories?: string[];
  interests?: string[];
  confidence?: number;
  sourceFeedUrl?: string | null;
  feedTitle?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
};

type MeetupRawEvent = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  timezone?: string | null;
  venueName?: string | null;
  address?: string | null;
  city?: string | null;
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
  interests?: string[];
  confidence?: number;
  groupName?: string | null;
  groupUrl?: string | null;
  groupTopics?: string[];
  tags?: string[];
  isRecurring?: boolean;
};

type CuratedRawEvent = CuratedEventInput;

const MEETUP_TECH_TERMS = ["tech", "software", "developer", "developer", "startup", "coding", "programming"];
const MEETUP_OUTDOORS_TERMS = ["hiking", "run", "running", "cycling", "bike", "biking", "outdoors", "outdoor"];
const MEETUP_BOOKS_TERMS = ["book", "books", "reading", "writing", "lecture", "literary", "author"];
const MEETUP_SOCIAL_TERMS = ["social", "friends", "new in town", "newcomer", "newcomers", "casual", "gathering", "networking"];
const MEETUP_BUSINESS_TERMS = ["business", "professional", "founder", "entrepreneur", "startup", "product", "career"];
const MEETUP_WELLNESS_TERMS = ["yoga", "wellness", "meditation", "mindfulness", "fitness"];
const MEETUP_GAMING_TERMS = ["board game", "board games", "tabletop", "gaming", "game night", "games"];
const MEETUP_FAMILY_TERMS = ["family", "kids", "children"];
const MEETUP_ARTS_TERMS = ["arts", "art", "music", "film", "theatre", "theater", "culture"];
const MEETUP_NEWCOMER_TERMS = [
  "newcomer",
  "newcomers",
  "new in town",
  "first-timer",
  "first-timers",
  "beginner",
  "beginners",
  "open to all",
  "all levels",
  "all skill levels",
  "welcome",
  "welcoming"
];
const MEETUP_BEGINNER_TERMS = ["beginner", "beginners", "intro", "introduction", "starter", "first-timer", "first-timers"];
const MEETUP_RECURRING_TERMS = ["weekly", "monthly", "recurring", "every week", "every month", "regular"];

function normalizeMeetupText(raw: MeetupRawEvent) {
  return [
    raw.title,
    raw.description,
    raw.groupName,
    raw.venueName,
    raw.address,
    raw.city,
    raw.region,
    raw.country,
    ...(raw.categories ?? []),
    ...(raw.interests ?? []),
    ...(raw.groupTopics ?? []),
    ...(raw.tags ?? [])
  ]
    .map((value) => clean(value)?.toLowerCase() ?? null)
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function hasAnyTerm(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function deriveMeetupSignals(raw: MeetupRawEvent) {
  const categories = new Set(normalizeTagList(raw.categories));
  const interests = new Set(normalizeTagList(raw.interests));
  const text = normalizeMeetupText(raw);

  if (hasAnyTerm(text, MEETUP_TECH_TERMS)) {
    categories.add("tech");
    interests.add("tech");
    interests.add("networking");
  }
  if (hasAnyTerm(text, MEETUP_OUTDOORS_TERMS)) {
    categories.add("outdoors");
    interests.add("outdoors");
    interests.add("fitness");
  }
  if (hasAnyTerm(text, MEETUP_BOOKS_TERMS)) {
    categories.add("books");
    interests.add("books");
    interests.add("education");
  }
  if (hasAnyTerm(text, MEETUP_SOCIAL_TERMS)) {
    categories.add("social");
    interests.add("social");
  }
  if (hasAnyTerm(text, MEETUP_BUSINESS_TERMS)) {
    categories.add("business");
    interests.add("business");
    interests.add("networking");
  }
  if (hasAnyTerm(text, MEETUP_WELLNESS_TERMS)) {
    categories.add("wellness");
    interests.add("wellness");
    interests.add("fitness");
  }
  if (hasAnyTerm(text, MEETUP_GAMING_TERMS)) {
    categories.add("gaming");
    interests.add("gaming");
    interests.add("social");
  }
  if (hasAnyTerm(text, MEETUP_FAMILY_TERMS)) {
    categories.add("family");
    interests.add("family");
  }
  if (hasAnyTerm(text, MEETUP_ARTS_TERMS)) {
    categories.add("arts");
    interests.add("arts");
  }
  if (hasAnyTerm(text, MEETUP_NEWCOMER_TERMS)) {
    categories.add("community");
    interests.add("newcomer-friendly");
  }
  if (hasAnyTerm(text, MEETUP_BEGINNER_TERMS)) {
    interests.add("beginner-friendly");
    interests.add("newcomer-friendly");
  }
  if (raw.isRecurring || hasAnyTerm(text, MEETUP_RECURRING_TERMS)) {
    interests.add("recurring");
  }
  if (raw.priceType === "free") {
    interests.add("free");
    interests.add("cheap");
  }

  const newcomerFriendly =
    hasAnyTerm(text, MEETUP_NEWCOMER_TERMS) ||
    hasAnyTerm(text, MEETUP_BEGINNER_TERMS) ||
    text.includes("open to all") ||
    text.includes("first-timer") ||
    text.includes("first-timers") ||
    text.includes("new in town") ||
    text.includes("social");

  const soloFriendly =
    hasAnyTerm(text, MEETUP_SOCIAL_TERMS) ||
    hasAnyTerm(text, MEETUP_BEGINNER_TERMS) ||
    text.includes("open to all") ||
    text.includes("casual") ||
    text.includes("networking");

  if (soloFriendly) {
    interests.add("solo-friendly");
  }

  return {
    categories: [...categories],
    interests: [...new Set([...categories, ...interests])],
    newcomerFriendly,
    soloFriendly
  };
}

function normalizeMeetupEvent(rawEvent: RawEvent): NormalizableEvent {
  const raw = rawEvent.raw as MeetupRawEvent;
  const title = clean(raw.title);
  if (!title) {
    throw new Error("Meetup event is missing a title");
  }

  const startDateTime = clean(raw.startDateTime);
  if (!startDateTime) {
    throw new Error("Meetup event is missing a start date");
  }

  const signals = deriveMeetupSignals(raw);

  return {
    id: clean(raw.id) ?? undefined,
    title,
    description: clean(raw.description),
    startDateTime,
    endDateTime: clean(raw.endDateTime),
    timezone: clean(raw.timezone),
    venueName: clean(raw.venueName),
    address: clean(raw.address),
    city: clean(raw.city) ?? "Unknown",
    region: clean(raw.region),
    country: normalizeCountry(raw.country),
    neighborhood: clean(raw.neighborhood),
    latitude: typeof raw.latitude === "number" ? raw.latitude : null,
    longitude: typeof raw.longitude === "number" ? raw.longitude : null,
    priceType: raw.priceType ?? "unknown",
    minPrice: raw.minPrice ?? null,
    maxPrice: raw.maxPrice ?? null,
    currency: clean(raw.currency),
    imageUrl: clean(raw.imageUrl),
    categories: signals.categories,
    interests: signals.interests,
    confidence: raw.confidence ?? 0.9
  };
}

function normalizeIcsEvent(rawEvent: RawEvent): NormalizableEvent {
  const raw = rawEvent.raw as IcsRawEvent;
  const title = clean(raw.summary);
  if (!title) {
    throw new Error("ICS event is missing SUMMARY");
  }

  const startDateTime = clean(raw.startDateTime);
  if (!startDateTime) {
    throw new Error("ICS event is missing DTSTART");
  }

  const sourceCalendarUrl = clean(raw.sourceCalendarUrl);
  const eventUrl = clean(raw.url);
  const locationText = clean(raw.location);
  const locationParts = locationText ? splitIcsLocation(locationText) : { venueName: null, address: null };

  return {
    id: clean(raw.uid) ?? undefined,
    title,
    description: clean(raw.description),
    startDateTime,
    endDateTime: clean(raw.endDateTime),
    timezone: clean(raw.timezone),
    venueName: clean(raw.venueName) ?? locationParts.venueName,
    address: clean(raw.address) ?? locationParts.address,
    city: clean(raw.city) ?? "Unknown",
    region: clean(raw.region),
    country: normalizeCountry(raw.country),
    latitude: typeof raw.latitude === "number" ? raw.latitude : null,
    longitude: typeof raw.longitude === "number" ? raw.longitude : null,
    priceType: raw.priceType ?? "unknown",
    minPrice: raw.minPrice ?? null,
    maxPrice: raw.maxPrice ?? null,
    currency: clean(raw.currency),
    imageUrl: clean(raw.imageUrl),
    categories: normalizeTagList(raw.categories),
    interests: normalizeTagList(raw.interests),
    confidence:
      raw.confidence ??
      (sourceCalendarUrl && eventUrl && sourceCalendarUrl !== eventUrl ? 0.88 : 0.82)
  };
}

function normalizeRssEvent(rawEvent: RawEvent): NormalizableEvent {
  const raw = rawEvent.raw as RssRawEvent;
  const title = clean(raw.title);
  if (!title) {
    throw new Error("RSS event is missing a title");
  }

  const startDateTime = clean(raw.startDateTime);
  if (!startDateTime) {
    throw new Error("RSS event is missing a clear event date");
  }

  return {
    id: clean(raw.id) ?? undefined,
    title,
    description: clean(raw.description),
    startDateTime,
    endDateTime: clean(raw.endDateTime),
    timezone: clean(raw.timezone),
    venueName: clean(raw.venueName),
    address: clean(raw.address),
    city: clean(raw.city) ?? "Unknown",
    region: clean(raw.region),
    country: normalizeCountry(raw.country),
    latitude: null,
    longitude: null,
    priceType: raw.priceType ?? "unknown",
    minPrice: raw.minPrice ?? null,
    maxPrice: raw.maxPrice ?? null,
    currency: clean(raw.currency),
    imageUrl: clean(raw.imageUrl),
    categories: normalizeTagList(raw.categories),
    interests: normalizeTagList(raw.interests),
    confidence: raw.confidence ?? 0.78
  };
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

function normalizeCuratedEvent(rawEvent: RawEvent): NormalizableEvent {
  const raw = rawEvent.raw as CuratedRawEvent;
  const title = clean(raw.title);
  if (!title) {
    throw new Error("Curated event is missing a title");
  }

  const startDateTime = clean(raw.startDateTime);
  if (!startDateTime) {
    throw new Error("Curated event is missing a start date");
  }

  const categories = normalizeTagList(raw.categories);
  const interests = [...new Set([...categories, ...normalizeTagList(raw.interests)])];

  return {
    id: clean(raw.id) ?? undefined,
    title,
    description: clean(raw.description),
    startDateTime,
    endDateTime: clean(raw.endDateTime),
    timezone: clean(raw.timezone),
    venueName: clean(raw.venueName),
    address: clean(raw.address),
    city: clean(raw.city) ?? "Unknown",
    region: clean(raw.region),
    country: normalizeCountry(raw.country),
    neighborhood: null,
    latitude: typeof raw.latitude === "number" ? raw.latitude : null,
    longitude: typeof raw.longitude === "number" ? raw.longitude : null,
    priceType: raw.priceType,
    minPrice: raw.minPrice ?? null,
    maxPrice: raw.maxPrice ?? null,
    currency: clean(raw.currency),
    imageUrl: clean(raw.imageUrl),
    categories,
    interests,
    confidence: raw.confidence ?? 0.8
  };
}

export function normalizeRawEvent(rawEvent: RawEvent): ScoutEvent {
  const raw =
    rawEvent.sourceId === "curated"
      ? normalizeCuratedEvent(rawEvent)
      : rawEvent.sourceId === "ticketmaster"
        ? normalizeTicketmasterEvent(rawEvent.raw as TicketmasterRawEvent)
        : rawEvent.sourceId === "meetup"
          ? normalizeMeetupEvent(rawEvent)
          : rawEvent.sourceId === "ics"
            ? normalizeIcsEvent(rawEvent)
            : rawEvent.sourceId === "rss"
              ? normalizeRssEvent(rawEvent)
              : (rawEvent.raw as NormalizableEvent);
  const title = clean(raw.title) ?? "Untitled Event";
  const description = clean(raw.description);
  const venueName = clean(raw.venueName);
  const address = clean(raw.address);
  const city = clean(raw.city) ?? "Unknown";
  const region = clean(raw.region);
  const country = clean(raw.country) ?? "USA";
  const neighborhood = clean(raw.neighborhood);
  const categories = [...new Set((raw.categories ?? []).map((entry) => entry.trim().toLowerCase()))];
  const interests =
    rawEvent.sourceId === "curated"
      ? [...new Set([...categories, ...normalizeTagList(raw.interests)])]
      : rawEvent.sourceId === "meetup"
      ? [...new Set(normalizeTagList(raw.interests))]
      : [...new Set([
          ...classifyInterests({
            title,
            description,
            categories,
            priceType: raw.priceType ?? "unknown"
          }),
          ...normalizeTagList(raw.interests)
        ])];
  const startDateTime = clean(raw.startDateTime);

  if (!startDateTime) {
    throw new Error(`${rawEvent.sourceType.toUpperCase()} event is missing startDateTime`);
  }

  const canonicalKey = `${slugify(title)}|${startDateTime.slice(0, 10)}|${slugify(venueName ?? city)}`;
  const createdAt = rawEvent.fetchedAt;
  const updatedAt = rawEvent.fetchedAt;
  const sourceEventId = rawEvent.sourceEventId ?? null;

  return assertValidScoutEvent({
    id: raw.id ?? `${rawEvent.sourceId}-${sourceEventId ?? slugify(title)}`,
    canonicalKey,
    title,
    description,
    startDateTime,
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
    confidence:
      raw.confidence ??
      (rawEvent.sourceId === "curated"
        ? 0.8
        : rawEvent.sourceType === "social"
          ? 0.55
          : rawEvent.sourceType === "ics"
            ? 0.88
            : rawEvent.sourceType === "rss"
              ? 0.78
              : rawEvent.sourceId === "meetup"
                ? 0.9
                : 0.92),
    isNewcomerFriendly:
      rawEvent.sourceId === "curated"
        ? raw.isNewcomerFriendly ?? interests.includes("newcomer-friendly")
        : rawEvent.sourceId === "meetup"
        ? interests.includes("newcomer-friendly")
        : interests.includes("newcomer-friendly"),
    isSoloFriendly:
      rawEvent.sourceId === "curated"
        ? raw.isSoloFriendly ?? interests.includes("solo-friendly")
        : rawEvent.sourceId === "meetup"
        ? interests.includes("solo-friendly")
        : interests.includes("solo-friendly"),
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
