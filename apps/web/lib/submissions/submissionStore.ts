import { validateCommunitySubmissionInput } from "./submissionSchema";
import type { CommunitySubmission, CommunitySubmissionStatus } from "./types";

type SubmissionSeed = Omit<CommunitySubmission, "createdAt" | "updatedAt">;

const nowIso = "2026-06-19T12:00:00.000Z";

const initialSubmissions: SubmissionSeed[] = [
  {
    id: "submission-seeded-1",
    title: "Neighborhood Welcome Coffee",
    description: "A low-pressure coffee hour for people new to the city.",
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
    submitterNote: "Great fit for newcomers who want a quiet first meetup.",
    categories: ["community", "social"],
    interests: ["newcomer-friendly", "solo-friendly"],
    status: "pending",
    moderationNote: null,
    reviewedAt: null,
    reviewedBy: null
  },
  {
    id: "submission-seeded-2",
    title: "Riverfront Cleanup Morning",
    description: "Volunteer cleanup with gloves and coffee provided.",
    startDateTime: "2026-06-26T13:00:00.000Z",
    endDateTime: "2026-06-26T16:00:00.000Z",
    timezone: "America/New_York",
    venueName: "Yeatman's Cove",
    address: "705 E Pete Rose Way, Cincinnati, OH 45202",
    city: "Cincinnati",
    region: "OH",
    country: "USA",
    priceType: "free",
    minPrice: null,
    maxPrice: null,
    currency: "USD",
    sourceUrl: "https://example.com/community/submissions/riverfront-cleanup-morning",
    submitterName: "Jordan",
    submitterEmail: null,
    submitterNote: "Organized by residents for people who want to meet neighbors outdoors.",
    categories: ["community", "outdoors"],
    interests: ["community", "outdoors"],
    status: "pending",
    moderationNote: null,
    reviewedAt: null,
    reviewedBy: null
  },
  {
    id: "submission-seeded-3",
    title: "Board Game Brunch for New Neighbors",
    description: "Brunch tables and easy games for recent arrivals.",
    startDateTime: "2026-06-27T15:00:00.000Z",
    endDateTime: "2026-06-27T18:00:00.000Z",
    timezone: "America/New_York",
    venueName: "OTR StillHouse",
    address: "2017 Branch St, Cincinnati, OH 45202",
    city: "Cincinnati",
    region: "OH",
    country: "USA",
    priceType: "paid",
    minPrice: 8,
    maxPrice: 15,
    currency: "USD",
    sourceUrl: "https://example.com/community/submissions/board-game-brunch",
    submitterName: "Avery",
    submitterEmail: "avery@example.com",
    submitterNote: "Could be good for solo attendees and people who just moved here.",
    categories: ["gaming", "food-drink"],
    interests: ["social", "newcomer-friendly"],
    status: "pending",
    moderationNote: null,
    reviewedAt: null,
    reviewedBy: null
  }
];

function cloneSubmission(submission: CommunitySubmission): CommunitySubmission {
  return {
    ...submission,
    categories: [...submission.categories],
    interests: [...submission.interests]
  };
}

function withTimestamps(submission: SubmissionSeed, createdAt: string, updatedAt: string): CommunitySubmission {
  return cloneSubmission({
    ...submission,
    createdAt,
    updatedAt
  });
}

function buildSubmissionId() {
  return `submission-${sequence++}`;
}

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function findIndexById(id: string) {
  return submissions.findIndex((submission) => submission.id === id);
}

function now() {
  return new Date().toISOString();
}

function seedSubmissions() {
  submissions.splice(
    0,
    submissions.length,
    ...initialSubmissions.map((submission) => withTimestamps(submission, nowIso, nowIso))
  );
  sequence = initialSubmissions.length + 1;
}

let submissions: CommunitySubmission[] = [];
let sequence = 1;
seedSubmissions();

export function listSubmissions(status?: CommunitySubmissionStatus) {
  const filtered = typeof status === "string" ? submissions.filter((submission) => submission.status === status) : submissions;
  return filtered
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt))
    .map(cloneSubmission);
}

export function getSubmission(id: string) {
  const submission = submissions.find((entry) => entry.id === id);
  return submission ? cloneSubmission(submission) : null;
}

export function createSubmission(input: unknown) {
  const validation = validateCommunitySubmissionInput(input);
  if (!validation.ok) {
    throw new Error(`Invalid community submission: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }

  const createdAt = now();
  const submission: CommunitySubmission = {
    id: buildSubmissionId(),
    ...validation.value,
    status: "pending",
    moderationNote: null,
    reviewedAt: null,
    reviewedBy: null,
    createdAt,
    updatedAt: createdAt
  };

  submissions.unshift(cloneSubmission(submission));
  return cloneSubmission(submission);
}

export function updateSubmissionStatus(
  id: string,
  status: CommunitySubmissionStatus,
  moderationNote?: string,
  reviewedBy?: string
) {
  const index = findIndexById(id);
  if (index < 0) {
    return null;
  }

  const existing = submissions[index]!;
  const updatedAt = now();
  const nextSubmission: CommunitySubmission = {
    ...existing,
    status,
    moderationNote: clean(moderationNote) || null,
    reviewedAt: updatedAt,
    reviewedBy: clean(reviewedBy) || "admin",
    updatedAt
  };

  submissions.splice(index, 1, cloneSubmission(nextSubmission));
  return cloneSubmission(nextSubmission);
}

export function approveSubmission(id: string, moderationNote?: string, reviewedBy?: string) {
  return updateSubmissionStatus(id, "approved", moderationNote, reviewedBy);
}

export function rejectSubmission(id: string, moderationNote?: string, reviewedBy?: string) {
  return updateSubmissionStatus(id, "rejected", moderationNote, reviewedBy);
}

export function suppressSubmission(id: string, moderationNote?: string, reviewedBy?: string) {
  return updateSubmissionStatus(id, "suppressed", moderationNote, reviewedBy);
}

export function resetSubmissionsForTests() {
  seedSubmissions();
}

