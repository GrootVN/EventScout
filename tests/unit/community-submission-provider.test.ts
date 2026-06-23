import { afterEach, describe, expect, it, vi } from "vitest";

const sampleSubmissions = [
  {
    id: "submission-approved-1",
    title: "Approved One",
    description: null,
    startDateTime: "2026-06-24T22:30:00.000Z",
    endDateTime: null,
    timezone: null,
    venueName: "Venue",
    address: null,
    city: "Cincinnati",
    region: null,
    country: null,
    priceType: "free" as const,
    minPrice: null,
    maxPrice: null,
    currency: null,
    sourceUrl: "https://example.com/events/approved-one",
    submitterName: null,
    submitterEmail: null,
    submitterNote: null,
    categories: ["community"],
    interests: ["newcomer-friendly"],
    status: "approved" as const,
    moderationNote: null,
    reviewedAt: null,
    reviewedBy: null,
    createdAt: "2026-06-19T12:00:00.000Z",
    updatedAt: "2026-06-19T12:00:00.000Z"
  },
  {
    id: "submission-pending-1",
    title: "Pending One",
    description: null,
    startDateTime: "2026-06-24T22:30:00.000Z",
    endDateTime: null,
    timezone: null,
    venueName: null,
    address: null,
    city: "Cincinnati",
    region: null,
    country: null,
    priceType: "unknown" as const,
    minPrice: null,
    maxPrice: null,
    currency: null,
    sourceUrl: "https://example.com/events/pending-one",
    submitterName: null,
    submitterEmail: null,
    submitterNote: null,
    categories: [],
    interests: [],
    status: "pending" as const,
    moderationNote: null,
    reviewedAt: null,
    reviewedBy: null,
    createdAt: "2026-06-19T12:00:00.000Z",
    updatedAt: "2026-06-19T12:00:00.000Z"
  },
  {
    id: "submission-rejected-1",
    title: "Rejected One",
    description: null,
    startDateTime: "2026-06-24T22:30:00.000Z",
    endDateTime: null,
    timezone: null,
    venueName: null,
    address: null,
    city: "Cincinnati",
    region: null,
    country: null,
    priceType: "unknown" as const,
    minPrice: null,
    maxPrice: null,
    currency: null,
    sourceUrl: "https://example.com/events/rejected-one",
    submitterName: null,
    submitterEmail: null,
    submitterNote: null,
    categories: [],
    interests: [],
    status: "rejected" as const,
    moderationNote: null,
    reviewedAt: null,
    reviewedBy: null,
    createdAt: "2026-06-19T12:00:00.000Z",
    updatedAt: "2026-06-19T12:00:00.000Z"
  },
  {
    id: "submission-suppressed-1",
    title: "Suppressed One",
    description: null,
    startDateTime: "2026-06-24T22:30:00.000Z",
    endDateTime: null,
    timezone: null,
    venueName: null,
    address: null,
    city: "Cincinnati",
    region: null,
    country: null,
    priceType: "unknown" as const,
    minPrice: null,
    maxPrice: null,
    currency: null,
    sourceUrl: "https://example.com/events/suppressed-one",
    submitterName: null,
    submitterEmail: null,
    submitterNote: null,
    categories: [],
    interests: [],
    status: "suppressed" as const,
    moderationNote: null,
    reviewedAt: null,
    reviewedBy: null,
    createdAt: "2026-06-19T12:00:00.000Z",
    updatedAt: "2026-06-19T12:00:00.000Z"
  },
  {
    id: "submission-approved-bad",
    title: "Bad Approved",
    description: null,
    startDateTime: "2026-06-24T22:30:00.000Z",
    endDateTime: null,
    timezone: null,
    venueName: null,
    address: null,
    city: "Cincinnati",
    region: null,
    country: null,
    priceType: "unknown" as const,
    minPrice: null,
    maxPrice: null,
    currency: null,
    sourceUrl: "https://example.com/events/bad-approved",
    submitterName: null,
    submitterEmail: null,
    submitterNote: null,
    categories: [],
    interests: [],
    status: "approved" as const,
    moderationNote: null,
    reviewedAt: null,
    reviewedBy: null,
    createdAt: "2026-06-19T12:00:00.000Z",
    updatedAt: "2026-06-19T12:00:00.000Z"
  }
];

async function importProvider(enabled: boolean, throwForBad = false) {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: {
      appName: "Event Scout",
      defaultCity: "Cincinnati",
      defaultRegion: "OH",
      defaultCountry: "USA",
      adminToken: "",
      ticketmasterApiKey: "",
      meetupAccessToken: "",
      meetupGraphqlEndpoint: "https://api.meetup.com/gql",
      defaultCityPreset: "cincinnati",
      icsSourceUrls: "",
      rssSourceUrls: "",
      curatedEventsPath: "apps/web/data/curated-events.json",
      cityPresetQaLiveFetch: false,
      enableMockProvider: true,
      enableCommunityMockProvider: true,
      enableCommunitySubmissionsProvider: enabled,
      enableCuratedProvider: false,
      enableCityPresets: false,
      enableTicketmasterProvider: false,
      enableMeetupProvider: false,
      enableIcsProvider: false,
      enableRssProvider: false,
      enableWebsiteProvider: false,
      enableSocialLeads: false
    }
  }));
  vi.doMock("@/lib/submissions/submissionStore", () => ({
    listSubmissions: () => sampleSubmissions
  }));
  vi.doMock("@/lib/submissions/toCuratedEvent", () => ({
    communitySubmissionToCuratedEvent: (submission: { id: string; title: string; sourceUrl: string; startDateTime: string; city: string; priceType: string; categories: string[]; interests: string[]; status: string; }) => {
      if (throwForBad && submission.id === "submission-approved-bad") {
        throw new Error("conversion failed");
      }

      return {
        id: `submission-${submission.id}`,
        title: submission.title,
        description: null,
        startDateTime: submission.startDateTime,
        endDateTime: null,
        timezone: null,
        venueName: null,
        address: null,
        city: submission.city,
        region: null,
        country: null,
        latitude: null,
        longitude: null,
        priceType: submission.priceType,
        minPrice: null,
        maxPrice: null,
        currency: null,
        sourceUrl: submission.sourceUrl,
        sourceName: "Community Submission",
        sourceEventId: submission.id,
        categories: submission.categories,
        interests: submission.interests,
        confidence: 0.72,
        isNewcomerFriendly: false,
        isSoloFriendly: false,
        status: "approved"
      };
    }
  }));

  return import("../../apps/web/lib/sources/communitySubmissionProvider");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("communitySubmissionProvider", () => {
  it("is disabled by default", async () => {
    const { communitySubmissionProvider } = await importProvider(false);
    expect(communitySubmissionProvider.enabled).toBe(false);
  });

  it("emits approved submissions only and tracks diagnostics", async () => {
    const { communitySubmissionProvider, consumeCommunitySubmissionProviderDiagnostics } = await importProvider(true);

    const rawEvents = await communitySubmissionProvider.fetchEvents({ city: "Cincinnati" });
    const diagnostics = consumeCommunitySubmissionProviderDiagnostics();

    expect(rawEvents).toHaveLength(2);
    expect(rawEvents.every((event) => event.sourceId === "community-submissions")).toBe(true);
    expect(rawEvents.every((event) => event.sourceName === "Community Submissions")).toBe(true);
    expect(diagnostics).toMatchObject({
      totalSubmissions: 5,
      pendingCount: 1,
      approvedCount: 2,
      rejectedCount: 1,
      suppressedCount: 1,
      emittedRawEventCount: 2,
      invalidConversionCount: 0
    });
  });

  it("counts invalid conversions and drops malformed approved submissions", async () => {
    const { communitySubmissionProvider, consumeCommunitySubmissionProviderDiagnostics } = await importProvider(
      true,
      true
    );

    const rawEvents = await communitySubmissionProvider.fetchEvents({ city: "Cincinnati" });
    const diagnostics = consumeCommunitySubmissionProviderDiagnostics();

    expect(rawEvents).toHaveLength(1);
    expect(diagnostics.invalidConversionCount).toBe(1);
    expect(diagnostics.warnings.some((message) => message.includes("conversion failed"))).toBe(true);
  });
});

