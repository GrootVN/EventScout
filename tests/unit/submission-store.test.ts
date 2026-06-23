import { afterEach, describe, expect, it } from "vitest";
import {
  approveSubmission,
  createSubmission,
  getSubmission,
  listSubmissions,
  rejectSubmission,
  resetSubmissionsForTests,
  suppressSubmission
} from "../../apps/web/lib/submissions/submissionStore";

afterEach(() => {
  resetSubmissionsForTests();
});

describe("submissionStore", () => {
  it("creates pending submissions by default", () => {
    const submission = createSubmission({
      title: "Neighborhood Welcome Coffee",
      startDateTime: "2026-06-24T22:30:00.000Z",
      city: "Cincinnati",
      sourceUrl: "https://example.com/events/welcome-coffee"
    });

    expect(submission.status).toBe("pending");
    expect(getSubmission(submission.id)?.status).toBe("pending");
  });

  it("lists submissions by status", () => {
    const pending = createSubmission({
      title: "Pending submission",
      startDateTime: "2026-06-24T22:30:00.000Z",
      city: "Cincinnati",
      sourceUrl: "https://example.com/events/pending"
    });
    const approved = createSubmission({
      title: "Approved submission",
      startDateTime: "2026-06-24T22:30:00.000Z",
      city: "Cincinnati",
      sourceUrl: "https://example.com/events/approved"
    });

    approveSubmission(approved.id, "Looks good", "moderator-1");

    expect(listSubmissions("pending").some((submission) => submission.id === pending.id)).toBe(true);
    expect(listSubmissions("approved").some((submission) => submission.id === approved.id)).toBe(true);
  });

  it("approves, rejects, and suppresses submissions with review metadata", () => {
    const submission = createSubmission({
      title: "Moderation target",
      startDateTime: "2026-06-24T22:30:00.000Z",
      city: "Cincinnati",
      sourceUrl: "https://example.com/events/moderation-target"
    });

    const approved = approveSubmission(submission.id, "Approved", "moderator-1");
    expect(approved?.status).toBe("approved");
    expect(approved?.reviewedAt).toBeTruthy();
    expect(approved?.reviewedBy).toBe("moderator-1");
    expect(approved?.moderationNote).toBe("Approved");

    const rejected = rejectSubmission(submission.id, "Rejected", "moderator-2");
    expect(rejected?.status).toBe("rejected");
    expect(rejected?.reviewedBy).toBe("moderator-2");

    const suppressed = suppressSubmission(submission.id, "Suppressed", "moderator-3");
    expect(suppressed?.status).toBe("suppressed");
    expect(suppressed?.reviewedBy).toBe("moderator-3");
  });

  it("resetSubmissionsForTests restores the seeded queue", () => {
    const submission = createSubmission({
      title: "Temporary",
      startDateTime: "2026-06-24T22:30:00.000Z",
      city: "Cincinnati",
      sourceUrl: "https://example.com/events/temporary"
    });

    expect(getSubmission(submission.id)).not.toBeNull();
    resetSubmissionsForTests();
    expect(getSubmission(submission.id)).toBeNull();
    expect(listSubmissions("pending").length).toBeGreaterThan(0);
  });
});

