import { NextRequest, NextResponse } from "next/server";
import { createSubmission } from "@/lib/submissions/submissionStore";
import { validateCommunitySubmissionInput } from "@/lib/submissions/submissionSchema";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as unknown;
  const validation = validateCommunitySubmissionInput(body);

  if (!validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Validation failed",
        issues: validation.issues
      },
      { status: 400 }
    );
  }

  // TODO: Add rate limiting and spam protection before production use.
  const submission = createSubmission(body);

  return NextResponse.json(
    {
      ok: true,
      submission: {
        id: submission.id,
        status: submission.status,
        title: submission.title
      }
    },
    { status: 201 }
  );
}

