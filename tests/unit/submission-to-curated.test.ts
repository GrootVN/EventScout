import { describe, expect, it } from "vitest";
import { communitySubmissionToCuratedEvent } from "../../apps/web/lib/submissions/toCuratedEvent";
import type { CommunitySubmission } from "../../apps/web/lib/submissions/types";

const approvedSubmission: CommunitySubmission = {
  id: "submission-123",
  title: "Neighborhood Welcome Coffee",
  description: "A low-pressure hello for newcomers.",
  startDateTime: "2026-06-24T22:30:00.000Z",
  endDateTime: "2026-06-24T23:30:00.000Z",
  timezone: "America/New_York",
  venueName: "Central Library",
  address: "800 Vine St, Cincinnati, OH 45202",
  city: "Cincinnati",
  region: "OH",
  country: "USA",
  priceType: "free",
  minPrice: null,
  maxPrice: null,
  currency: "USD",
  sourceUrl: "https://example.com/community/submissions/neighborhood-welcome-coffee",
  submitterName: "Maya",
  submitterEmail: "maya@example.com",
  submitterNote: "Good for solo attendees.",
  categories: ["community", "social"],
  interests: ["newcomer-friendly", "solo-friendly"],
  status: "approved",
  moderationNote: "Looks good",
  reviewedAt: "2026-06-19T12:00:00.000Z",
  reviewedBy: "admin",
  createdAt: "2026-06-19T12:00:00.000Z",
  updatedAt: "2026-06-19T12:00:00.000Z"
};

describe("communitySubmissionToCuratedEvent", () => {
  it("converts approved submissions into curated event input", () => {
    const curated = communitySubmissionToCuratedEvent(approvedSubmission);

    expect(curated.id).toBe("submission-submission-123");
    expect(curated.sourceUrl).toBe(approvedSubmission.sourceUrl);
    expect(curated.sourceEventId).toBe(approvedSubmission.id);
    expect(curated.categories).toEqual(approvedSubmission.categories);
    expect(curated.interests).toEqual(approvedSubmission.interests);
    expect(curated.confidence).toBeGreaterThanOrEqual(0.68);
    expect(curated.confidence).toBeLessThanOrEqual(0.74);
    expect(curated.status).toBe("approved");
  });

  it.each(["pending", "rejected", "suppressed"] as const)("rejects %s submissions", (status) => {
    expect(() =>
      communitySubmissionToCuratedEvent({
        ...approvedSubmission,
        status
      })
    ).toThrow(/is not approved/);
  });
});

