export type CommunitySubmissionStatus = "pending" | "approved" | "rejected" | "suppressed";

export type CommunitySubmission = {
  id: string;
  title: string;
  description: string | null;

  startDateTime: string;
  endDateTime: string | null;
  timezone: string | null;

  venueName: string | null;
  address: string | null;
  city: string;
  region: string | null;
  country: string | null;

  priceType: "free" | "paid" | "unknown";
  minPrice: number | null;
  maxPrice: number | null;
  currency: string | null;

  sourceUrl: string;
  submitterName: string | null;
  submitterEmail: string | null;
  submitterNote: string | null;

  categories: string[];
  interests: string[];

  status: CommunitySubmissionStatus;

  moderationNote: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;

  createdAt: string;
  updatedAt: string;
};

export type CommunitySubmissionDraft = Omit<
  CommunitySubmission,
  "id" | "status" | "moderationNote" | "reviewedAt" | "reviewedBy" | "createdAt" | "updatedAt"
>;

