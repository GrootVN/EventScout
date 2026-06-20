import {
  CanonicalEventCandidate,
  SourceAdapter,
  SourceHealthStatus,
  SourceRawRecord
} from "@eventscout/shared";

interface MeetupEvent {
  id: string;
  title: string;
  description?: string;
  date_time: string;
  venue?: {
    name?: string;
    address_1?: string;
    city?: string;
    state?: string;
    lat?: number;
    lng?: number;
  };
  event_url: string;
  group?: {
    category?: { name?: string };
  };
  fee?: { required?: boolean };
  yes_rsvp_count?: number;
}

interface MeetupPayload {
  events?: MeetupEvent[];
}

export class MeetupConnector implements SourceAdapter {
  source = "meetup";
  sourceFamily = "community" as const;
  seeds = [{ url: "https://api.meetup.com/find/upcoming_events", label: "meetup-upcoming" }];
  rateLimitPolicy = { maxRequestsPerMinute: 30 };
  retryPolicy = { maxRetries: 3, baseDelayMs: 1200 };

  async fetchSince(_cursorOrIso: string): Promise<SourceRawRecord[]> {
    const token = process.env.MEETUP_ACCESS_TOKEN;
    if (!token) {
      return [];
    }
    const endpoint = "https://api.meetup.com/find/upcoming_events";
    const response = await fetch(endpoint, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      throw new Error(`Meetup request failed: ${response.status}`);
    }
    const payload = (await response.json()) as MeetupPayload;
    return (payload.events ?? []).map((event) => ({
      source_event_id: event.id,
      source_url: event.event_url,
      payload: event,
      fetched_at: new Date().toISOString(),
      http_status: response.status,
      parser_version: "meetup-v2",
      metadata: {
        adapter: this.source
      }
    }));
  }

  normalize(raw: SourceRawRecord): CanonicalEventCandidate | null {
    const event = raw.payload as MeetupEvent;
    if (!event.id || !event.title || !event.date_time || !event.event_url) {
      return null;
    }
    return {
      title: event.title,
      description: event.description ?? "",
      start_time: event.date_time,
      end_time: null,
      timezone: "America/New_York",
      venue_name: event.venue?.name ?? null,
      address: event.venue?.address_1 ?? "",
      lat: event.venue?.lat ?? null,
      lng: event.venue?.lng ?? null,
      city: event.venue?.city ?? "",
      region: event.venue?.state ?? "",
      categories: event.group?.category?.name ? [event.group.category.name] : [],
      price_type: event.fee?.required ? "paid" : "free",
      source: this.source,
      source_family: this.sourceFamily,
      source_url: event.event_url,
      source_event_id: event.id,
      organizer_name: null,
      engagement_signals: {
        interested_count: event.yes_rsvp_count ?? 0
      },
      raw_payload: raw.payload
    };
  }

  async sourceHealthCheck(): Promise<SourceHealthStatus> {
    return {
      source: this.source,
      healthy: Boolean(process.env.MEETUP_ACCESS_TOKEN),
      detail: process.env.MEETUP_ACCESS_TOKEN
        ? "Configured"
        : "MEETUP_ACCESS_TOKEN is missing"
    };
  }
}
