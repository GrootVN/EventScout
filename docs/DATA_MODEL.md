# Event Scout Data Model

## Canonical Event

Every event from every source must normalize into this shape.

```ts
type Event = {
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
  latitude: number | null;
  longitude: number | null;
  priceType: "free" | "paid" | "unknown";
  minPrice: number | null;
  maxPrice: number | null;
  currency: string | null;
  sourceId: string;
  sourceName: string;
  sourceType: "api" | "rss" | "ics" | "website" | "social" | "community" | "mock";
  sourceUrl: string;
  sourceEventId: string | null;
  sourceFetchedAt: string;
  imageUrl: string | null;
  categories: string[];
  interests: string[];
  confidence: number;
  isNewcomerFriendly: boolean;
  isSoloFriendly: boolean;
  originalSources: Array<{
    sourceId: string;
    sourceName: string;
    sourceType: string;
    sourceUrl: string;
    sourceEventId: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
};
```

## Source attribution

Never lose source attribution.

If duplicate events are merged, preserve all source links.
