import { haversineDistanceKm } from "./geo";
const WEIGHTS = {
    distance: 0.35,
    time: 0.25,
    popularity: 0.2,
    interests: 0.15,
    confidence: 0.05
};
function clamp(value) {
    return Math.max(0, Math.min(1, value));
}
function scoreDistance(event, ctx) {
    if (ctx.viewerLat === undefined || ctx.viewerLng === undefined) {
        return 0.5;
    }
    const distance = haversineDistanceKm(ctx.viewerLat, ctx.viewerLng, event.lat, event.lng);
    return clamp(1 - distance / 50);
}
function scoreTime(event, ctx) {
    const now = new Date(ctx.nowIso).getTime();
    const start = new Date(event.start_time).getTime();
    const diffHours = (start - now) / (1000 * 60 * 60);
    if (diffHours < -24) {
        return 0;
    }
    if (diffHours <= 0) {
        return 1;
    }
    if (diffHours <= 48) {
        return clamp(1 - diffHours / 48);
    }
    return clamp(1 - diffHours / 168);
}
function scorePopularity(event) {
    const signals = event.engagement_signals;
    const raw = (signals.likes ?? 0) * 0.3 +
        (signals.comments ?? 0) * 0.2 +
        (signals.upvotes ?? 0) * 0.4 +
        (signals.interested_count ?? 0) * 0.1;
    return clamp(raw / 250);
}
function scoreInterests(event, ctx) {
    if (!ctx.interestCategories.length) {
        return 0.5;
    }
    const matches = event.categories.filter((cat) => ctx.interestCategories.includes(cat)).length;
    return clamp(matches / ctx.interestCategories.length);
}
export function scoreEvent(event, ctx) {
    const distanceScore = scoreDistance(event, ctx);
    const timeScore = scoreTime(event, ctx);
    const popularityScore = scorePopularity(event);
    const interestScore = scoreInterests(event, ctx);
    const confidenceScore = clamp(event.confidence_score);
    const finalScore = distanceScore * WEIGHTS.distance +
        timeScore * WEIGHTS.time +
        popularityScore * WEIGHTS.popularity +
        interestScore * WEIGHTS.interests +
        confidenceScore * WEIGHTS.confidence;
    return {
        finalScore,
        distanceScore,
        timeScore,
        popularityScore,
        interestScore,
        confidenceScore
    };
}
