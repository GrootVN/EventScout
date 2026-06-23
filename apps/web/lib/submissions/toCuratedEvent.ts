import type { CuratedEventInput } from "@/lib/events/curatedSchema";
import type { CommunitySubmission } from "./types";

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function inferSignal(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function communitySubmissionToCuratedEvent(submission: CommunitySubmission): CuratedEventInput {
  if (submission.status !== "approved") {
    throw new Error(`Community submission ${submission.id} is not approved`);
  }

  const text = [
    submission.title,
    submission.description,
    submission.submitterNote,
    submission.venueName,
    submission.address,
    submission.city,
    submission.region,
    submission.country,
    ...(submission.categories ?? []),
    ...(submission.interests ?? [])
  ]
    .map((value) => clean(value))
    .filter((value) => value.length > 0)
    .join(" ")
    .toLowerCase();

  const newcomerFriendly =
    submission.interests.includes("newcomer-friendly") ||
    inferSignal(text, ["newcomer", "new to town", "welcome", "beginner", "intro", "all levels"]);
  const soloFriendly =
    submission.interests.includes("solo-friendly") ||
    inferSignal(text, ["solo", "social", "networking", "casual", "open to all", "everyone welcome"]);

  const confidence = newcomerFriendly || soloFriendly ? 0.74 : 0.68;

  return {
    id: `submission-${submission.id}`,
    title: submission.title,
    description: submission.description,
    startDateTime: submission.startDateTime,
    endDateTime: submission.endDateTime,
    timezone: submission.timezone,
    venueName: submission.venueName,
    address: submission.address,
    city: submission.city,
    region: submission.region,
    country: submission.country,
    latitude: null,
    longitude: null,
    priceType: submission.priceType,
    minPrice: submission.minPrice,
    maxPrice: submission.maxPrice,
    currency: submission.currency,
    sourceUrl: submission.sourceUrl,
    sourceName: "Community Submission",
    sourceEventId: submission.id,
    categories: [...submission.categories],
    interests: [...submission.interests],
    confidence,
    isNewcomerFriendly: newcomerFriendly,
    isSoloFriendly: soloFriendly,
    status: "approved"
  };
}

