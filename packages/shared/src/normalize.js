import { mapCategories } from "./taxonomy";
function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
}
function normalizePriceType(raw) {
    const normalized = raw.trim().toLowerCase();
    if (normalized.includes("free")) {
        return "free";
    }
    if (normalized.includes("paid") || normalized.includes("$")) {
        return "paid";
    }
    return "unknown";
}
export function normalizeCandidate(candidate, nowIso) {
    const title = normalizeWhitespace(candidate.title);
    const description = normalizeWhitespace(candidate.description);
    const address = normalizeWhitespace(candidate.address);
    return {
        title,
        description,
        start_time: new Date(candidate.start_time).toISOString(),
        end_time: candidate.end_time ? new Date(candidate.end_time).toISOString() : null,
        timezone: candidate.timezone || "UTC",
        venue_name: candidate.venue_name ? normalizeWhitespace(candidate.venue_name) : null,
        address,
        lat: candidate.lat ?? 0,
        lng: candidate.lng ?? 0,
        city: normalizeWhitespace(candidate.city),
        region: normalizeWhitespace(candidate.region),
        categories: mapCategories(candidate.categories),
        price_type: normalizePriceType(candidate.price_type),
        source: candidate.source,
        source_family: candidate.source_family,
        source_url: candidate.source_url,
        source_event_id: candidate.source_event_id,
        engagement_signals: candidate.engagement_signals,
        confidence_score: 0.5,
        publish_state: "pending",
        verification_count: 0,
        verified_by_trusted_source: false,
        verification_reasons: [],
        ingested_at: nowIso,
        last_seen_at: nowIso,
        duplicate_of_event_id: null,
        provenance_source_ids: [candidate.source_event_id]
    };
}
