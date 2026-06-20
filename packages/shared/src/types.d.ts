export type EventSourceFamily = "listing_api" | "forum" | "community" | "ticketing" | "venue" | "calendar" | "social" | "news" | "other";
export type EventSource = string;
export type PublishState = "pending" | "verified" | "published" | "rejected";
export type PriceType = "free" | "paid" | "unknown";
export type ConfidenceLabel = "high" | "medium" | "low";
export type EventCategory = "music" | "food" | "sports" | "tech" | "arts" | "networking" | "community" | "other";
export interface EngagementSignals {
    likes?: number;
    comments?: number;
    upvotes?: number;
    interested_count?: number;
}
export interface EventRecord {
    id: string;
    title: string;
    description: string;
    start_time: string;
    end_time?: string | null;
    timezone: string;
    venue_name?: string | null;
    address: string;
    lat: number;
    lng: number;
    city: string;
    region: string;
    categories: EventCategory[];
    price_type: PriceType;
    source: EventSource;
    source_family: EventSourceFamily;
    source_url: string;
    source_event_id: string;
    engagement_signals: EngagementSignals;
    confidence_score: number;
    publish_state: PublishState;
    verification_count: number;
    verified_by_trusted_source: boolean;
    verification_reasons: string[];
    ingested_at: string;
    last_seen_at: string;
    duplicate_of_event_id?: string | null;
    provenance_source_ids?: string[];
}
export interface CanonicalEventCandidate {
    title: string;
    description: string;
    start_time: string;
    end_time?: string | null;
    timezone: string;
    venue_name?: string | null;
    address: string;
    lat?: number | null;
    lng?: number | null;
    city: string;
    region: string;
    categories: string[];
    price_type: string;
    source: EventSource;
    source_family: EventSourceFamily;
    source_url: string;
    source_event_id: string;
    organizer_name?: string | null;
    engagement_signals: EngagementSignals;
    raw_payload: unknown;
}
export interface SourceObservation {
    id: string;
    source: EventSource;
    source_family: EventSourceFamily;
    source_url: string;
    source_event_id: string;
    fetched_at: string;
    http_status?: number | null;
    parser_version?: string | null;
    story?: boolean;
    requires_auth?: boolean;
    inaccessible_reason?: string | null;
    metadata: Record<string, unknown>;
}
export interface EventCandidate {
    id: string;
    source_observation_id: string;
    source: EventSource;
    source_family: EventSourceFamily;
    source_url: string;
    source_event_id: string;
    title: string;
    description: string;
    start_time: string;
    end_time?: string | null;
    timezone: string;
    venue_name?: string | null;
    organizer_name?: string | null;
    address: string;
    lat?: number | null;
    lng?: number | null;
    city: string;
    region: string;
    categories: EventCategory[];
    price_type: PriceType;
    extraction_confidence: number;
    extraction_model: string;
    created_at: string;
}
export interface TrustedSource {
    id: string;
    source_type: "domain" | "account" | "profile_url";
    source_value: string;
    source_family: EventSourceFamily;
    active: boolean;
    notes?: string | null;
    created_at: string;
    updated_at: string;
}
export interface QueryContext {
    nowIso: string;
    viewerLat?: number;
    viewerLng?: number;
    interestCategories: EventCategory[];
}
export interface ScoreBreakdown {
    finalScore: number;
    distanceScore: number;
    timeScore: number;
    popularityScore: number;
    interestScore: number;
    confidenceScore: number;
}
export interface EventQuery {
    bbox?: [number, number, number, number];
    lat?: number;
    lng?: number;
    radiusKm?: number;
    categories?: EventCategory[];
    price_type?: PriceType;
    confidence_min?: number;
    time_range?: "today" | "this_weekend" | "custom";
    start_time?: string;
    end_time?: string;
    sort?: "relevance" | "distance" | "start_time";
    limit?: number;
    offset?: number;
}
export interface EventFacetResponse {
    categories: Array<{
        category: EventCategory;
        count: number;
    }>;
    price_types: Array<{
        price_type: PriceType;
        count: number;
    }>;
}
