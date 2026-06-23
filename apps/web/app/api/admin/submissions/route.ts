import { NextRequest, NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/admin-auth";
import {
  approveSubmission,
  getSubmission,
  listSubmissions,
  rejectSubmission,
  suppressSubmission
} from "@/lib/submissions/submissionStore";
import type { CommunitySubmissionStatus } from "@/lib/submissions/types";

function getRequestToken(request: NextRequest) {
  const url = new URL(request.url);
  return request.headers.get("x-admin-token") ?? url.searchParams.get("key");
}

function unauthorized() {
  return NextResponse.json({ error: "Admin access required" }, { status: 401 });
}

function parseStatus(value: string | null): CommunitySubmissionStatus | undefined | null {
  if (!value) {
    return undefined;
  }

  if (value === "pending" || value === "approved" || value === "rejected" || value === "suppressed") {
    return value;
  }

  return null;
}

export async function GET(request: NextRequest) {
  if (!requireAdminToken(getRequestToken(request))) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const status = parseStatus(url.searchParams.get("status"));
  if (status === null) {
    return NextResponse.json({ error: "status must be pending, approved, rejected, or suppressed" }, { status: 400 });
  }

  return NextResponse.json({
    data: listSubmissions(status)
  });
}

export async function POST(request: NextRequest) {
  if (!requireAdminToken(getRequestToken(request))) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    submissionId?: unknown;
    submission_id?: unknown;
    moderationNote?: unknown;
    moderation_note?: unknown;
    reviewedBy?: unknown;
  };

  const submissionId =
    typeof body.submissionId === "string"
      ? body.submissionId.trim()
      : typeof body.submission_id === "string"
        ? body.submission_id.trim()
        : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";
  const moderationNote =
    typeof body.moderationNote === "string"
      ? body.moderationNote
      : typeof body.moderation_note === "string"
        ? body.moderation_note
        : undefined;
  const reviewedBy = typeof body.reviewedBy === "string" && body.reviewedBy.trim() ? body.reviewedBy.trim() : "admin";

  if (!submissionId) {
    return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
  }

  if (action !== "approve" && action !== "reject" && action !== "suppress") {
    return NextResponse.json({ error: "action must be approve, reject, or suppress" }, { status: 400 });
  }

  if (!getSubmission(submissionId)) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const updated =
    action === "approve"
      ? approveSubmission(submissionId, moderationNote, reviewedBy)
      : action === "reject"
        ? rejectSubmission(submissionId, moderationNote, reviewedBy)
        : suppressSubmission(submissionId, moderationNote, reviewedBy);

  if (!updated) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: updated
  });
}
