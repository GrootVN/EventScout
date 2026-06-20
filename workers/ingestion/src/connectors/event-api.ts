import {
  CanonicalEventCandidate,
  SourceAdapter,
  SourceHealthStatus,
  SourceRawRecord
} from "@eventscout/shared";

interface EventApiRaw {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  timezone?: string;
  venue_name?: string;
  address?: string;
  city?: string;
  region?: string;
  categories?: string[];
  price?: string;
  url?: string;
  lat?: number;
  lng?: number;
  popularity?: number;
}

export class EventApiConnector implements SourceAdapter {
  source = "event_api";
  sourceFamily = "listing_api" as const;
  seeds = [];
  rateLimitPolicy = { maxRequestsPerMinute: 60 };
  retryPolicy = { maxRetries: 3, baseDelayMs: 1000 };

  async fetchSince(cursorOrIso: string): Promise<SourceRawRecord[]> {
    const baseUrl = process.env.EVENT_API_BASE_URL;
    if (!baseUrl) {
      return [];
    }
    const url = new URL("/events", baseUrl);
    url.searchParams.set("updated_since", cursorOrIso);
    if (process.env.EVENT_API_KEY) {
      url.searchParams.set("api_key", process.env.EVENT_API_KEY);
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Event API request failed: ${response.status}`);
    }
    const payload = (await response.json()) as { events?: EventApiRaw[] };
    return (payload.events ?? []).map((event) => ({
      source_event_id: event.id ?? `event-api-${Date.now()}`,
      source_url: event.url ?? baseUrl,
      payload: event,
      fetched_at: new Date().toISOString(),
      http_status: response.status,
      parser_version: "event-api-v2",
      metadata: {
        adapter: this.source
      }
    }));
  }

  normalize(raw: SourceRawRecord): CanonicalEventCandidate | null {
    const event = raw.payload as EventApiRaw;
    if (!event.id || !event.title || !event.start_time || !event.url || !event.address) {
      return null;
    }
    return {
      title: event.title,
      description: event.description ?? "",
      start_time: event.start_time,
      end_time: event.end_time ?? null,
      timezone: event.timezone ?? "UTC",
      venue_name: event.venue_name ?? null,
      address: event.address,
      lat: event.lat ?? null,
      lng: event.lng ?? null,
      city: event.city ?? "",
      region: event.region ?? "",
      categories: event.categories ?? [],
      price_type: event.price ?? "unknown",
      source: this.source,
      source_family: this.sourceFamily,
      source_url: event.url,
      source_event_id: event.id,
      organizer_name: null,
      engagement_signals: {
        interested_count: event.popularity ?? 0
      },
      raw_payload: raw.payload
    };
  }

  async sourceHealthCheck(): Promise<SourceHealthStatus> {
    return {
      source: this.source,
      healthy: Boolean(process.env.EVENT_API_BASE_URL),
      detail: process.env.EVENT_API_BASE_URL
        ? "Configured"
        : "EVENT_API_BASE_URL is missing"
    };
  }
}
