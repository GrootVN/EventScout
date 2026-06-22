export const PRIMARY_INTERESTS = [
  "music",
  "food-drink",
  "arts",
  "outdoors",
  "fitness",
  "tech",
  "business",
  "education",
  "volunteering",
  "nightlife",
  "sports",
  "family",
  "gaming",
  "books",
  "film",
  "culture",
  "dating",
  "networking",
  "spirituality",
  "markets",
  "festivals",
  "university",
  "comedy",
  "theater",
  "wellness"
] as const;

export const UTILITY_TAGS = [
  "free",
  "cheap",
  "solo-friendly",
  "newcomer-friendly",
  "family-friendly",
  "beginner-friendly",
  "indoor",
  "outdoor",
  "casual",
  "professional",
  "social",
  "quiet",
  "high-energy",
  "recurring"
] as const;

export type PrimaryInterest = (typeof PRIMARY_INTERESTS)[number];
export type UtilityTag = (typeof UTILITY_TAGS)[number];

export const INTEREST_LABELS: Record<string, string> = {
  "food-drink": "Food & Drink",
  nightlife: "Nightlife",
  volunteering: "Volunteering",
  networking: "Networking",
  university: "University",
  "solo-friendly": "Solo Friendly",
  "newcomer-friendly": "Newcomer Friendly",
  "family-friendly": "Family Friendly",
  "beginner-friendly": "Beginner Friendly"
};

export function formatInterestLabel(value: string): string {
  return (
    INTEREST_LABELS[value] ??
    value
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}
