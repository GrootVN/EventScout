import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

async function importRoute() {
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({
    env: {
      appName: "Event Scout",
      defaultCity: "Cincinnati",
      defaultRegion: "OH",
      defaultCountry: "USA",
      adminToken: "secret-token",
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

  return import("../../apps/web/app/api/admin/submissions/route");
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/admin/submissions", () => {
  it("requires auth when ADMIN_TOKEN is set", async () => {
    const { GET } = await importRoute();
    const { resetSubmissionsForTests } = await import("../../apps/web/lib/submissions/submissionStore");
    resetSubmissionsForTests();
    const response = await GET(new NextRequest("http://localhost/api/admin/submissions"));

    expect(response.status).toBe(401);
  });

  it("returns submissions for authorized requests and supports status filtering", async () => {
    const { GET } = await importRoute();
    const { createSubmission, approveSubmission, resetSubmissionsForTests } = await import("../../apps/web/lib/submissions/submissionStore");
    resetSubmissionsForTests();
    const submitted = createSubmission({
      title: "Admin Review Target",
      startDateTime: "2026-06-24T22:30:00.000Z",
      city: "Cincinnati",
      sourceUrl: "https://example.com/events/admin-review-target"
    });
    approveSubmission(submitted.id, "Looks good", "admin");

    const response = await GET(
      new NextRequest("http://localhost/api/admin/submissions?status=approved", {
        headers: { "x-admin-token": "secret-token" }
      })
    );
    const payload = (await response.json()) as { data: Array<{ id: string; status: string }> };

    expect(response.status).toBe(200);
    expect(payload.data.every((submission) => submission.status === "approved")).toBe(true);
    expect(payload.data.some((submission) => submission.id === submitted.id)).toBe(true);
  });
});

describe("POST /api/admin/submissions", () => {
  it.each([
    ["approve", "approved"],
    ["reject", "rejected"],
    ["suppress", "suppressed"]
  ] as const)("applies the %s action", async (action, expectedStatus) => {
    const { POST } = await importRoute();
    const { createSubmission, getSubmission, resetSubmissionsForTests } = await import("../../apps/web/lib/submissions/submissionStore");
    resetSubmissionsForTests();
    const submission = createSubmission({
      title: `Action ${action}`,
      startDateTime: "2026-06-24T22:30:00.000Z",
      city: "Cincinnati",
      sourceUrl: `https://example.com/events/action-${action}`
    });

    const response = await POST(
      new NextRequest("http://localhost/api/admin/submissions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-token": "secret-token"
        },
        body: JSON.stringify({
          submissionId: submission.id,
          action,
          moderationNote: "Reviewed"
        })
      })
    );
    const payload = (await response.json()) as { data: { status: string; moderationNote: string | null } };

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe(expectedStatus);
    expect(getSubmission(submission.id)?.status).toBe(expectedStatus);
    expect(payload.data.moderationNote).toBe("Reviewed");
  });

  it("rejects invalid actions", async () => {
    const { POST } = await importRoute();
    const { createSubmission, resetSubmissionsForTests } = await import("../../apps/web/lib/submissions/submissionStore");
    resetSubmissionsForTests();
    const submission = createSubmission({
      title: "Invalid action target",
      startDateTime: "2026-06-24T22:30:00.000Z",
      city: "Cincinnati",
      sourceUrl: "https://example.com/events/invalid-action-target"
    });

    const response = await POST(
      new NextRequest("http://localhost/api/admin/submissions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-token": "secret-token"
        },
        body: JSON.stringify({
          submissionId: submission.id,
          action: "archive"
        })
      })
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("action must be approve, reject, or suppress");
  });

  it("returns 404 for missing submissions", async () => {
    const { POST } = await importRoute();
    const { resetSubmissionsForTests } = await import("../../apps/web/lib/submissions/submissionStore");
    resetSubmissionsForTests();
    const response = await POST(
      new NextRequest("http://localhost/api/admin/submissions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-token": "secret-token"
        },
        body: JSON.stringify({
          submissionId: "missing-submission",
          action: "approve"
        })
      })
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Submission not found");
  });
});
