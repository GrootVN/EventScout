export type EventSourceType =
  | "api"
  | "rss"
  | "ics"
  | "website"
  | "social"
  | "community"
  | "mock";

export type PriceType = "free" | "paid" | "unknown";

export type RawEvent = {
  sourceId: string;
  sourceName: string;
  sourceType: EventSourceType;
  sourceEventId?: string | null;
  sourceUrl: string;
  fetchedAt: string;
  raw: unknown;
};

export type OriginalSource = {
  sourceId: string;
  sourceName: string;
  sourceType: EventSourceType;
  sourceUrl: string;
  sourceEventId: string | null;
};

export type ScoutEvent = {
  id: string;
  canonicalKey: string | null;
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
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMiles: number | null;
  priceType: PriceType;
  minPrice: number | null;
  maxPrice: number | null;
  currency: string | null;
  sourceId: string;
  sourceName: string;
  sourceType: EventSourceType;
  sourceUrl: string;
  sourceEventId: string | null;
  sourceFetchedAt: string;
  imageUrl: string | null;
  categories: string[];
  interests: string[];
  confidence: number;
  isNewcomerFriendly: boolean;
  isSoloFriendly: boolean;
  originalSources: OriginalSource[];
  createdAt: string;
  updatedAt: string;
};

export type MockEventSeed = {
  id: string;
  title: string;
  description: string | null;
  startDateTime: string;
  endDateTime: string | null;
  timezone?: string | null;
  venueName: string | null;
  address?: string | null;
  city: string;
  region: string | null;
  country?: string | null;
  neighborhood?: string | null;
  latitude: number | null;
  longitude: number | null;
  priceType: PriceType;
  minPrice: number | null;
  maxPrice: number | null;
  currency?: string | null;
  sourceId: string;
  sourceName: string;
  sourceType: EventSourceType;
  sourceUrl: string;
  sourceEventId: string;
  imageUrl: string | null;
  categories: string[];
};

export type EventFilters = {
  city?: string;
  interests?: string[];
  startDate?: string;
  endDate?: string;
  priceType?: PriceType | "any";
  keyword?: string;
  soloFriendly?: boolean;
  newcomerFriendly?: boolean;
};

export type RankingInput = {
  interests: string[];
  userCity?: string;
  latitude?: number;
  longitude?: number;
  preferFree?: boolean;
};

export type ScoredEvent = ScoutEvent & {
  score: number;
  scoreBreakdown: {
    interestMatch: number;
    dateSoonness: number;
    distanceScore: number;
    sourceTrust: number;
    affordability: number;
    newcomerBoost: number;
  };
};
