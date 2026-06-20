import type { MockEventSeed } from "@/lib/events/types";

const now = new Date("2026-06-19T12:00:00.000Z");

function iso(daysFromNow: number, hour: number, minute = 0) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

const seeds: Array<Omit<MockEventSeed, "id" | "sourceEventId">> = [
  {
    title: "Founders & Freelancers Coffee Club",
    description: "A casual coworking meetup with intros for newcomers, coffee, and lightning hellos.",
    venueName: "Collective Espresso",
    city: "Cincinnati",
    region: "OH",
    neighborhood: "Over-the-Rhine",
    categories: ["tech", "business"],
    priceType: "free",
    minPrice: null,
    maxPrice: null,
    startDateTime: iso(0, 22),
    endDateTime: iso(1, 0),
    latitude: 39.1107,
    longitude: -84.5155,
    sourceId: "mock",
    sourceName: "Mock Local Radar",
    sourceType: "mock",
    sourceUrl: "https://example.com/events/founders-freelancers",
    imageUrl: null
  },
  {
    title: "Beginner Salsa Night",
    description: "No partner needed. A warm intro lesson followed by a social dance floor.",
    venueName: "Liberty Hall",
    city: "Cincinnati",
    region: "OH",
    neighborhood: "Pendleton",
    categories: ["culture", "nightlife"],
    priceType: "paid",
    minPrice: 12,
    maxPrice: 18,
    startDateTime: iso(1, 23),
    endDateTime: iso(2, 2),
    latitude: 39.1091,
    longitude: -84.5031,
    sourceId: "mock",
    sourceName: "Mock Local Radar",
    sourceType: "mock",
    sourceUrl: "https://example.com/events/beginner-salsa-night",
    imageUrl: null
  },
  {
    title: "Sunset Run Club",
    description: "A 3-mile social run with pace groups and a post-run patio hang.",
    venueName: "Smale Riverfront Park",
    city: "Cincinnati",
    region: "OH",
    neighborhood: "Downtown",
    categories: ["fitness", "outdoors"],
    priceType: "free",
    minPrice: null,
    maxPrice: null,
    startDateTime: iso(0, 23),
    endDateTime: iso(1, 0),
    latitude: 39.0977,
    longitude: -84.5166,
    sourceId: "mock",
    sourceName: "Mock Local Radar",
    sourceType: "mock",
    sourceUrl: "https://example.com/events/sunset-run-club",
    imageUrl: null
  },
  {
    title: "Indie Bookstore Trivia",
    description: "Teams form on arrival. Great for meeting people who just moved here.",
    venueName: "The Storyline Books",
    city: "Cincinnati",
    region: "OH",
    neighborhood: "Northside",
    categories: ["books", "gaming"],
    priceType: "free",
    minPrice: null,
    maxPrice: null,
    startDateTime: iso(2, 0),
    endDateTime: iso(2, 2),
    latitude: 39.1612,
    longitude: -84.538,
    sourceId: "mock",
    sourceName: "Mock Local Radar",
    sourceType: "mock",
    sourceUrl: "https://example.com/events/indie-bookstore-trivia",
    imageUrl: null
  },
  {
    title: "Public Square Night Market",
    description: "Food stalls, vintage vendors, and live local music in the square.",
    venueName: "Court Street Plaza",
    city: "Cincinnati",
    region: "OH",
    neighborhood: "Downtown",
    categories: ["markets", "food-drink", "music"],
    priceType: "free",
    minPrice: null,
    maxPrice: null,
    startDateTime: iso(3, 22),
    endDateTime: iso(4, 1),
    latitude: 39.1037,
    longitude: -84.5122,
    sourceId: "mock",
    sourceName: "Mock Local Radar",
    sourceType: "mock",
    sourceUrl: "https://example.com/events/public-square-night-market",
    imageUrl: null
  },
  {
    title: "Intro to Pottery Wheel",
    description: "A beginner workshop with all clay and tools included.",
    venueName: "Queen City Clay",
    city: "Cincinnati",
    region: "OH",
    neighborhood: "Oakley",
    categories: ["arts", "education"],
    priceType: "paid",
    minPrice: 35,
    maxPrice: 35,
    startDateTime: iso(4, 23),
    endDateTime: iso(5, 1),
    latitude: 39.1573,
    longitude: -84.4311,
    sourceId: "mock",
    sourceName: "Mock Local Radar",
    sourceType: "mock",
    sourceUrl: "https://example.com/events/intro-pottery-wheel",
    imageUrl: null
  },
  {
    title: "City Newcomer Picnic",
    description: "An open invite picnic for interns, remote workers, and recent arrivals.",
    venueName: "Ault Park",
    city: "Cincinnati",
    region: "OH",
    neighborhood: "Mt. Lookout",
    categories: ["community", "outdoors", "networking"],
    priceType: "free",
    minPrice: null,
    maxPrice: null,
    startDateTime: iso(5, 19),
    endDateTime: iso(5, 22),
    latitude: 39.1302,
    longitude: -84.4297,
    sourceId: "mock",
    sourceName: "Mock Local Radar",
    sourceType: "mock",
    sourceUrl: "https://example.com/events/city-newcomer-picnic",
    imageUrl: null
  },
  {
    title: "Jazz Under the Bridge",
    description: "Live jazz set with picnic seating and a riverside skyline view.",
    venueName: "Sawyer Point",
    city: "Cincinnati",
    region: "OH",
    neighborhood: "Riverfront",
    categories: ["music", "culture"],
    priceType: "free",
    minPrice: null,
    maxPrice: null,
    startDateTime: iso(6, 23),
    endDateTime: iso(7, 1),
    latitude: 39.0968,
    longitude: -84.4989,
    sourceId: "mock",
    sourceName: "Mock Local Radar",
    sourceType: "mock",
    sourceUrl: "https://example.com/events/jazz-under-the-bridge",
    imageUrl: null
  },
  {
    title: "Women in Product Happy Hour",
    description: "Conversation prompts, mentor tables, and a friendly first-timer host.",
    venueName: "Union Hall",
    city: "Cincinnati",
    region: "OH",
    neighborhood: "Over-the-Rhine",
    categories: ["tech", "networking", "business"],
    priceType: "paid",
    minPrice: 10,
    maxPrice: 10,
    startDateTime: iso(7, 22),
    endDateTime: iso(8, 0),
    latitude: 39.1114,
    longitude: -84.5152,
    sourceId: "mock",
    sourceName: "Mock Local Radar",
    sourceType: "mock",
    sourceUrl: "https://example.com/events/women-in-product-happy-hour",
    imageUrl: null
  },
  {
    title: "Family Storytime in the Garden",
    description: "Outdoor storytime with songs, movement, and shaded seating for families.",
    venueName: "Krohn Conservatory Lawn",
    city: "Cincinnati",
    region: "OH",
    neighborhood: "Eden Park",
    categories: ["family", "books", "outdoors"],
    priceType: "free",
    minPrice: null,
    maxPrice: null,
    startDateTime: iso(8, 15),
    endDateTime: iso(8, 16),
    latitude: 39.1139,
    longitude: -84.4882,
    sourceId: "mock",
    sourceName: "Mock Local Radar",
    sourceType: "mock",
    sourceUrl: "https://example.com/events/family-storytime-garden",
    imageUrl: null
  }
];

export const MOCK_EVENT_SEEDS: MockEventSeed[] = Array.from({ length: 36 }, (_, index) => {
  const seed = seeds[index % seeds.length];
  const cycle = Math.floor(index / seeds.length);
  const start = new Date(seed.startDateTime);
  const end = seed.endDateTime ? new Date(seed.endDateTime) : null;

  start.setUTCDate(start.getUTCDate() + cycle * 9);
  if (end) {
    end.setUTCDate(end.getUTCDate() + cycle * 9);
  }

  return {
    ...seed,
    id: `mock-${index + 1}`,
    sourceEventId: `mock-source-${index + 1}`,
    startDateTime: start.toISOString(),
    endDateTime: end?.toISOString() ?? null,
    sourceUrl: `${seed.sourceUrl}?instance=${index + 1}`
  };
});
