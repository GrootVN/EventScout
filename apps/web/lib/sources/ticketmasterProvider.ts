import { env } from "@/lib/config/env";
import type { EventSourceProvider, FetchEventsInput } from "./provider";
import type { RawEvent } from "@/lib/events/types";

export type TicketmasterDiagnostic = {
  level: "warning" | "error";
  message: string;
};

type TicketmasterVenue = {
  name?: unknown;
  city?: { name?: unknown };
  state?: { stateCode?: unknown };
  country?: { countryCode?: unknown; name?: unknown };
  address?: { line1?: unknown; line2?: unknown };
  location?: { latitude?: unknown; longitude?: unknown };
};

type TicketmasterPriceRange = {
  currency?: unknown;
  min?: unknown;
  max?: unknown;
};

type TicketmasterClassification = {
  segment?: { name?: unknown };
  genre?: { name?: unknown };
  subGenre?: { name?: unknown };
  type?: { name?: unknown };
};

type TicketmasterEvent = {
  id?: unknown;
  name?: unknown;
  url?: unknown;
  info?: unknown;
  pleaseNote?: unknown;
  description?: unknown;
  images?: Array<Record<string, unknown>>;
  classifications?: TicketmasterClassification[];
  priceRanges?: TicketmasterPriceRange[];
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
    venues?: TicketmasterVenue[];
  };
};

type TicketmasterResponse = {
  _embedded?: {
    events?: unknown[];
  };
};

type TicketmasterNormalizedResponseEvent = RawEvent;

const TICKETMASTER_API_ROOT = "https://app.ticketmaster.com/discovery/v2/events.json";
const diagnostics: TicketmasterDiagnostic[] = [];

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function recordDiagnostic(level: TicketmasterDiagnostic["level"], message: string) {
  diagnostics.push({ level, message });
}

function snapshotDiagnostics() {
  return [...diagnostics];
}

export function snapshotTicketmasterProviderDiagnostics() {
  return snapshotDiagnostics();
}

export function consumeTicketmasterProviderDiagnostics() {
  const current = snapshotDiagnostics();
  diagnostics.length = 0;
  return current;
}

function normalizeCountryCode(country: unknown) {
  const value = cleanString(country).toUpperCase();
  if (value === "US" || value === "USA" || value === "UNITED STATES" || value === "UNITED STATES OF AMERICA") {
    return "USA";
  }
  return cleanString(country) || null;
}

function normalizePriceRanges(priceRanges: unknown) {
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
      const typedRange = range as TicketmasterPriceRange;
      const min = Number(typedRange.min);
      const max = Number(typedRange.max);
      return {
        min: Number.isFinite(min) ? min : null,
        max: Number.isFinite(max) ? max : null,
        currency: cleanString(typedRange.currency) || null
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

  const numericMins = parsedRanges.flatMap((range) => (range.min === null ? [] : [range.min]));
  const numericMaxes = parsedRanges.flatMap((range) => (range.max === null ? [] : [range.max]));
  const minPrice = numericMins.length > 0 ? Math.min(...numericMins) : null;
  const maxPrice = numericMaxes.length > 0 ? Math.max(...numericMaxes) : null;
  const currency = parsedRanges.find((range) => range.currency)?.currency ?? null;
  const clearlyFree =
    parsedRanges.length > 0 &&
    parsedRanges.every((range) => range.min === 0 && (range.max === 0 || range.max === null));

  return {
    priceType: clearlyFree ? ("free" as const) : ("paid" as const),
    minPrice,
    maxPrice,
    currency
  };
}

function mapInterestToTicketmasterClassificationName(interest: string): string | null {
  const normalized = interest.toLowerCase();
  if (["music", "songs", "concert"].includes(normalized)) {
    return "music";
  }
  if (["sports", "sport"].includes(normalized)) {
    return "sports";
  }
  if (["arts", "theater", "theatre"].includes(normalized)) {
    return "arts & theatre";
  }
  if (normalized === "film" || normalized === "movies") {
    return "film";
  }
  if (normalized === "family") {
    return "family";
  }
  if (["culture", "entertainment", "community"].includes(normalized)) {
    return "miscellaneous";
  }
  return null;
}

function mapTicketmasterClassificationsToCategories(classifications: unknown) {
  if (!Array.isArray(classifications)) {
    return [];
  }

  const categories = new Set<string>();

  for (const classification of classifications) {
    if (!classification || typeof classification !== "object") {
      continue;
    }

    const typedClassification = classification as TicketmasterClassification;
    const labels = [
      cleanString(typedClassification.segment?.name),
      cleanString(typedClassification.genre?.name),
      cleanString(typedClassification.subGenre?.name),
      cleanString(typedClassification.type?.name)
    ]
      .filter(Boolean)
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

function buildTicketmasterUrl(input: FetchEventsInput) {
  const url = new URL(TICKETMASTER_API_ROOT);
  const params = url.searchParams;

  params.set("apikey", env.ticketmasterApiKey);
  params.set("size", "50");
  params.set("sort", "date,asc");

  if (input.keyword?.trim()) {
    params.set("keyword", input.keyword.trim());
  }

  if (input.city?.trim()) {
    params.set("city", input.city.trim());
  }

  if (input.region?.trim()) {
    params.set("stateCode", input.region.trim().toUpperCase());
  }

  if (input.country?.trim()) {
    const countryCode = normalizeCountryCode(input.country);
    if (countryCode) {
      params.set("countryCode", countryCode.toUpperCase().slice(0, 2));
    }
  }

  if (typeof input.latitude === "number" && typeof input.longitude === "number") {
    params.set("latlong", `${input.latitude},${input.longitude}`);
    if (typeof input.radiusMiles === "number" && Number.isFinite(input.radiusMiles)) {
      params.set("radius", String(input.radiusMiles));
      params.set("unit", "miles");
    }
  }

  if (input.startDate?.trim()) {
    params.set("startDateTime", input.startDate.trim());
  }

  if (input.endDate?.trim()) {
    params.set("endDateTime", input.endDate.trim());
  }

  const classificationNames = new Set(
    (input.interests ?? [])
      .map((interest) => mapInterestToTicketmasterClassificationName(interest))
      .filter((classificationName): classificationName is string => classificationName !== null)
  );

  if (classificationNames.size > 0) {
    params.set("classificationName", [...classificationNames].join(","));
  }

  return url;
}

function pickBestImage(images: TicketmasterEvent["images"]) {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  return images
    .map((image) => {
      if (!image || typeof image !== "object") {
        return null;
      }

      const url = cleanString(image.url);
      if (!url) {
        return null;
      }

      const width = Number(image.width);
      const height = Number(image.height);
      return {
        url,
        score: (Number.isFinite(width) ? width : 0) * (Number.isFinite(height) ? height : 0)
      };
    })
    .filter((image): image is { url: string; score: number } => Boolean(image))
    .sort((left, right) => right.score - left.score)[0]?.url ?? null;
}

function resolveTicketmasterDate(dateTime: unknown, localDate: unknown, localTime: unknown) {
  const exactDateTime = cleanString(dateTime);
  if (exactDateTime) {
    return exactDateTime;
  }

  const cleanedDate = cleanString(localDate);
  if (!cleanedDate) {
    return null;
  }

  const cleanedTime = cleanString(localTime);
  if (cleanedTime) {
    return `${cleanedDate}T${cleanedTime}Z`;
  }

  return `${cleanedDate}T12:00:00.000Z`;
}

function mapTicketmasterEvent(event: TicketmasterEvent): TicketmasterNormalizedResponseEvent | null {
  const sourceUrl = cleanString(event.url);
  if (!sourceUrl) {
    return null;
  }

  const venues = event._embedded?.venues;
  const venue = Array.isArray(venues) ? venues[0] : undefined;
  const location = venue && typeof venue === "object" ? venue : undefined;
  const typedVenue = location as TicketmasterVenue | undefined;
  const dateStart = event.dates?.start;
  const dateEnd = event.dates?.end;
  const startDateTime = resolveTicketmasterDate(dateStart?.dateTime, dateStart?.localDate, dateStart?.localTime);

  if (!startDateTime) {
    return null;
  }

  return {
    sourceId: "ticketmaster",
    sourceName: "Ticketmaster",
    sourceType: "api",
    sourceEventId: cleanString(event.id) || null,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    raw: {
      ...event,
      dates: {
        ...(event.dates ?? {}),
        start: {
          ...(event.dates?.start ?? {}),
          dateTime: startDateTime
        }
      }
    }
  };
}

async function fetchTicketmasterEvents(input: FetchEventsInput): Promise<RawEvent[]> {
  if (!env.enableTicketmasterProvider) {
    return [];
  }

  if (!env.ticketmasterApiKey) {
    recordDiagnostic("warning", "Ticketmaster provider is enabled but TICKETMASTER_API_KEY is missing.");
    return [];
  }

  try {
    const response = await fetch(buildTicketmasterUrl(input), {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      recordDiagnostic("error", `Ticketmaster request failed with HTTP ${response.status}.`);
      return [];
    }

    let payload: TicketmasterResponse | null = null;
    try {
      payload = (await response.json()) as TicketmasterResponse;
    } catch {
      recordDiagnostic("error", "Ticketmaster response could not be parsed as JSON.");
      return [];
    }

    const events = payload?._embedded?.events;
    if (!Array.isArray(events) || events.length === 0) {
      return [];
    }

    const fetchedAt = new Date().toISOString();
    const rawEvents: RawEvent[] = [];
    let skipped = 0;

    for (const candidate of events) {
      if (!candidate || typeof candidate !== "object") {
        skipped += 1;
        continue;
      }

      const mapped = mapTicketmasterEvent(candidate as TicketmasterEvent);
      if (!mapped) {
        skipped += 1;
        continue;
      }

      rawEvents.push({
        ...mapped,
        fetchedAt
      });
    }

    if (skipped > 0) {
      recordDiagnostic("warning", `Ticketmaster returned ${skipped} malformed event record${skipped === 1 ? "" : "s"} that were skipped.`);
    }

    return rawEvents;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    recordDiagnostic("error", `Ticketmaster request failed: ${reason}`);
    return [];
  }
}

export const ticketmasterProvider: EventSourceProvider = {
  sourceId: "ticketmaster",
  sourceName: "Ticketmaster",
  sourceType: "api",
  enabled: env.enableTicketmasterProvider && Boolean(env.ticketmasterApiKey),
  fetchEvents: fetchTicketmasterEvents
};

export { buildTicketmasterUrl };
