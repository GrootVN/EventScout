import { CanonicalEventCandidate, EventSource, EventSourceFamily } from "./types";
export interface SourceRateLimitPolicy {
    maxRequestsPerMinute: number;
}
export interface SourceRetryPolicy {
    maxRetries: number;
    baseDelayMs: number;
}
export interface SourceHealthStatus {
    source: EventSource;
    healthy: boolean;
    detail?: string;
}
export interface SourceSeed {
    url: string;
    label?: string;
    story?: boolean;
}
export interface SourceRawRecord {
    source_event_id: string;
    source_url: string;
    payload: unknown;
    fetched_at: string;
    http_status?: number | null;
    parser_version?: string | null;
    story?: boolean;
    requires_auth?: boolean;
    inaccessible_reason?: string | null;
    metadata?: Record<string, unknown>;
}
export interface SourceAdapter {
    source: EventSource;
    sourceFamily: EventSourceFamily;
    seeds: SourceSeed[];
    rateLimitPolicy: SourceRateLimitPolicy;
    retryPolicy: SourceRetryPolicy;
    fetchSince(cursorOrIso: string): Promise<SourceRawRecord[]>;
    normalize(raw: SourceRawRecord): CanonicalEventCandidate | null;
    sourceHealthCheck(): Promise<SourceHealthStatus>;
}
