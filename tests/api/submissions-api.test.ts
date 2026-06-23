import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

async function importRoutes() {
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
      enableMockProvider: false,
      enableCommunityMockProvider: false,
      enableCommunitySubmissionsProvider: true,
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

  return Promise.all([
    import("../../apps/web/app/api/submissions/route"),
    import("../../apps/web/app/api/events/route")
  ]);
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("POST /api/submissions", () => {
  it("creates a pending submission and keeps it out of public events until approved", async () => {
    const [{ POST }, { GET }] = await importRoutes();
    const { approveSubmission, resetSubmissionsForTests } = await import("../../apps/web/lib/submissions/submissionStore");
    resetSubmissionsForTests();
    const payload = {
      title: "Neighborhood Welcome Coffee",
      description: "A low-pressure hello for new neighbors.",
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
      categories: ["community", "social"],
      interests: ["newcomer-friendly"],
      submitterName: "Maya",
      submitterEmail: "maya@example.com",
      submitterNote: "Great fit for newcomers."
    };

    const response = await POST(
      new NextRequest("http://localhost/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      })
    );
    const body = (await response.json()) as {
      ok: boolean;
      submission?: { id: string; status: string; title: string };
      error?: string;
      issues?: Array<{ path: string; message: string }>;
    };

    expect(response.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.submission).toMatchObject({
      status: "pending",
      title: "Neighborhood Welcome Coffee"
    });
    expect(body).not.toHaveProperty("moderationNote");
    expect(body).not.toHaveProperty("reviewedAt");
    expect(body).not.toHaveProperty("reviewedBy");

    const publicBeforeApproval = await GET(
      new NextRequest(
        "http://localhost/api/events?city=Cincinnati&datePreset=custom&startDate=2026-06-24T00:00:00.000Z&endDate=2026-06-25T23:59:59.000Z"
      )
    );
    const publicBeforePayload = (await publicBeforeApproval.json()) as { data: Array<{ title: string }> };
    expect(publicBeforeApproval.status).toBe(200);
    expect(publicBeforePayload.data.some((event) => event.title === payload.title)).toBe(false);

    approveSubmission(body.submission!.id, "Looks good", "admin");

    const publicAfterApproval = await GET(
      new NextRequest(
        "http://localhost/api/events?city=Cincinnati&datePreset=custom&startDate=2026-06-24T00:00:00.000Z&endDate=2026-06-25T23:59:59.000Z"
      )
    );
    const publicAfterPayload = (await publicAfterApproval.json()) as { data: Array<{ title: string }> };

    expect(publicAfterApproval.status).toBe(200);
    expect(publicAfterPayload.data.some((event) => event.title === payload.title)).toBe(true);
  });

  it("rejects invalid submissions with field issues", async () => {
    const [{ POST }] = await importRoutes();
    const { resetSubmissionsForTests } = await import("../../apps/web/lib/submissions/submissionStore");
    resetSubmissionsForTests();
    const response = await POST(
      new NextRequest("http://localhost/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "",
          startDateTime: "not-a-date",
          city: "",
          sourceUrl: "notaurl",
          submitterEmail: "not-an-email"
        })
      })
    );
    const body = (await response.json()) as { ok: boolean; error?: string; issues?: Array<{ path: string }> };

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Validation failed");
    expect(body.issues?.some((issue) => issue.path === "title")).toBe(true);
    expect(body.issues?.some((issue) => issue.path === "startDateTime")).toBe(true);
    expect(body.issues?.some((issue) => issue.path === "city")).toBe(true);
    expect(body.issues?.some((issue) => issue.path === "sourceUrl")).toBe(true);
    expect(body.issues?.some((issue) => issue.path === "submitterEmail")).toBe(true);
  });
});
