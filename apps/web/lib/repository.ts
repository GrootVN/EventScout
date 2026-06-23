import { EventFacetResponse, EventQuery, EventRecord, EventSourceFamily, TrustedSource } from "@eventscout/shared";
import { scoutEvents } from "@/lib/events/service";
import { deactivateTrustedSource, listTrustedSources, resetTrustedSourcesForTests, upsertTrustedSource } from "@/lib/trustedSourcesStore";

type FeedbackRecord = {
  event_id: string;
  type: "not_relevant" | "duplicate" | "wrong_location";
  note?: string;
  created_at: string;
};

type RepositoryState = {
  feedback: FeedbackRecord[];
  suppressedEventIds: Set<string>;
};

const state: RepositoryState = {
  feedback: [],
  suppressedEventIds: new Set()
};

const REFERENCE_NOW = "2026-06-19T12:00:00.000Z";

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeCategory(category: string): EventRecord["categories"][number] {
  const normalized = category.trim().toLowerCase();
  if (
    normalized === "music" ||
    normalized === "food" ||
    normalized === "sports" ||
    normalized === "tech" ||
    normalized === "arts" ||
    normalized === "networking" ||
    normalized === "community"
  ) {
    return normalized;
  }

  return "other";
}

function normalizeSourceFamily(sourceId: string, sourceType: string): EventSourceFamily {
  if (sourceType === "rss" || sourceType === "ics") {
    return "calendar";
  }
  if (sourceType === "social") {
    return "social";
  }
  if (sourceType === "website") {
    return "venue";
  }
  if (sourceType === "community" || sourceId === "community-mock") {
    return "community";
  }
  if (sourceId === "ticketmaster" || sourceId === "meetup") {
    return "listing_api";
  }

  return "other";
}

function derivePublishState(confidence: number) {
  if (confidence >= 0.85) {
    return "published" as const;
  }
  if (confidence >= 0.7) {
    return "verified" as const;
  }
  return "pending" as const;
}

function toEventRecord(event: Awaited<ReturnType<typeof scoutEvents>>[number]): EventRecord {
  return {
    id: event.id,
    title: event.title,
    description: clean(event.description) || event.title,
    start_time: event.startDateTime,
    end_time: event.endDateTime,
    timezone: event.timezone ?? "America/New_York",
    venue_name: event.venueName,
    address: event.address ?? "Unknown address",
    lat: event.latitude ?? 0,
    lng: event.longitude ?? 0,
    city: event.city,
    region: event.region ?? "OH",
    categories: [...new Set(event.categories.map(normalizeCategory))],
    price_type: event.priceType,
    source: event.sourceId,
    source_family: normalizeSourceFamily(event.sourceId, event.sourceType),
    source_url: event.sourceUrl,
    source_event_id: event.sourceEventId ?? event.id,
    engagement_signals: {
      interested_count: Math.max(0, Math.round(event.score * 100))
    },
    confidence_score: event.confidence,
    publish_state: derivePublishState(event.confidence),
    verification_count: event.originalSources.length,
    verified_by_trusted_source: event.originalSources.some((source) => source.sourceId === "ticketmaster" || source.sourceId === "meetup"),
    verification_reasons: event.originalSources.map((source) => source.sourceName),
    ingested_at: event.createdAt,
    last_seen_at: event.updatedAt,
    duplicate_of_event_id: null,
    provenance_source_ids: event.originalSources.map((source) => source.sourceId)
  };
}

function matchesQuery(event: EventRecord, query: EventQuery) {
  if (query.categories?.length) {
    const requested = new Set(query.categories);
    if (!event.categories.some((category) => requested.has(category))) {
      return false;
    }
  }

  if (query.price_type && event.price_type !== query.price_type) {
    return false;
  }

  if (query.confidence_min !== undefined && event.confidence_score < query.confidence_min) {
    return false;
  }

  if (query.start_time && new Date(event.start_time).getTime() < new Date(query.start_time).getTime()) {
    return false;
  }

  if (query.end_time && new Date(event.start_time).getTime() > new Date(query.end_time).getTime()) {
    return false;
  }

  return true;
}

function sortEvents(events: EventRecord[], query: EventQuery) {
  const sorted = [...events];
  if (query.sort === "distance") {
    sorted.sort((left, right) => left.lat - right.lat || left.lng - right.lng);
  } else if (query.sort === "start_time") {
    sorted.sort((left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime());
  } else {
    sorted.sort((left, right) => right.confidence_score - left.confidence_score || left.start_time.localeCompare(right.start_time));
  }
  return sorted;
}

function sliceEvents(events: EventRecord[], query: EventQuery) {
  const offset = query.offset ?? 0;
  const limit = query.limit ?? events.length;
  return events.slice(offset, offset + limit);
}

function buildFacets(events: EventRecord[]): EventFacetResponse {
  const categoryCounts = new Map<string, number>();
  const priceCounts = new Map<string, number>();

  for (const event of events) {
    for (const category of event.categories) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
    priceCounts.set(event.price_type, (priceCounts.get(event.price_type) ?? 0) + 1);
  }

  return {
    categories: [...categoryCounts.entries()].map(([category, count]) => ({
      category: category as EventFacetResponse["categories"][number]["category"],
      count
    })),
    price_types: [...priceCounts.entries()].map(([price_type, count]) => ({
      price_type: price_type as EventFacetResponse["price_types"][number]["price_type"],
      count
    }))
  };
}

function getReviewableEvents(events: EventRecord[]) {
  return events.filter((event) => {
    if (state.suppressedEventIds.has(event.id)) {
      return false;
    }

    return event.confidence_score < 0.8 || event.source === "community-mock" || event.source_family === "social";
  });
}

async function getScoutedEvents() {
  const events = await scoutEvents(
    { city: "Cincinnati" },
    { interests: [], userCity: "Cincinnati" }
  );

  return events.map(toEventRecord);
}

export interface EventRepository {
  getEvents(query: EventQuery): Promise<EventRecord[]>;
  getEventById(id: string): Promise<EventRecord | null>;
  getFacets(query: EventQuery): Promise<EventFacetResponse>;
  getFlaggedEvents(): Promise<EventRecord[]>;
  getReviewQueue(): Promise<EventRecord[]>;
  listSuppressedEventIds(): Promise<string[]>;
  createFeedback(input: {
    event_id: string;
    type: "not_relevant" | "duplicate" | "wrong_location";
    note?: string;
  }): Promise<void>;
  suppressEvent(eventId: string, note?: string): Promise<void>;
  listTrustedSources(): Promise<TrustedSource[]>;
  upsertTrustedSource(input: {
    source_type: "domain" | "account" | "profile_url";
    source_value: string;
    source_family: EventSourceFamily;
    notes?: string;
    active?: boolean;
  }): Promise<TrustedSource>;
  deactivateTrustedSource(id: string): Promise<void>;
}

const repository: EventRepository = {
  async getEvents(query) {
    const events = (await getScoutedEvents()).filter((event) => matchesQuery(event, query));
    return sliceEvents(sortEvents(events, query), query);
  },

  async getEventById(id) {
    const events = await getScoutedEvents();
    return events.find((event) => event.id === id) ?? null;
  },

  async getFacets(query) {
    return buildFacets(await repository.getEvents(query));
  },

  async getFlaggedEvents() {
    return getReviewableEvents(await getScoutedEvents());
  },

  async getReviewQueue() {
    return getReviewableEvents(await getScoutedEvents());
  },

  async listSuppressedEventIds() {
    return [...state.suppressedEventIds];
  },

  async createFeedback(input) {
    state.feedback.push({
      ...input,
      created_at: REFERENCE_NOW
    });
  },

  async suppressEvent(eventId, note) {
    state.suppressedEventIds.add(eventId);
    if (note) {
      state.feedback.push({
        event_id: eventId,
        type: "wrong_location",
        note,
        created_at: REFERENCE_NOW
      });
    }
  },

  async listTrustedSources() {
    return listTrustedSources();
  },

  async upsertTrustedSource(input) {
    return upsertTrustedSource(input);
  },

  async deactivateTrustedSource(id) {
    deactivateTrustedSource(id);
  }
};

export function getEventRepository() {
  return repository;
}

export function resetRepositoryForTests() {
  state.feedback = [];
  state.suppressedEventIds = new Set();
  resetTrustedSourcesForTests();
}
