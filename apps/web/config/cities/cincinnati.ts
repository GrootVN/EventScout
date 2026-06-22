import type { CitySourcePreset } from "./types";

export const cincinnatiCityPreset: CitySourcePreset = {
  cityId: "cincinnati",
  cityName: "Cincinnati",
  region: "OH",
  country: "USA",
  defaultRadiusMiles: 25,
  sources: {
    ics: [
      {
        sourceId: "cincinnati-public-library-ics",
        sourceName: "Cincinnati Public Library Calendar",
        url: "https://example.com/cincinnati/library-calendar.ics",
        enabled: true,
        city: "Cincinnati",
        region: "OH",
        country: "USA",
        defaultCategories: ["books", "community"],
        defaultInterests: ["books", "newcomer-friendly"],
        sourceUrl: "https://example.com/cincinnati/library-calendar.ics",
        confidence: 0.86
      },
      {
        sourceId: "cincinnati-park-board-ics",
        sourceName: "Cincinnati Park Board Calendar",
        url: "https://example.com/cincinnati/parks-calendar.ics",
        enabled: true,
        city: "Cincinnati",
        region: "OH",
        country: "USA",
        defaultCategories: ["outdoors", "community"],
        defaultInterests: ["outdoors", "solo-friendly"],
        sourceUrl: "https://example.com/cincinnati/parks-calendar.ics",
        confidence: 0.84
      },
      {
        sourceId: "cincinnati-university-ics",
        sourceName: "Cincinnati University Events",
        url: "https://example.com/cincinnati/university-events.ics",
        enabled: false,
        city: "Cincinnati",
        region: "OH",
        country: "USA",
        defaultCategories: ["education", "tech"],
        defaultInterests: ["beginner-friendly", "networking"],
        sourceUrl: "https://example.com/cincinnati/university-events.ics",
        confidence: 0.85
      }
    ],
    rss: [
      {
        sourceId: "cincinnati-city-rss",
        sourceName: "Cincinnati City News & Events",
        url: "https://example.com/cincinnati/city-events.xml",
        enabled: true,
        city: "Cincinnati",
        region: "OH",
        country: "USA",
        defaultCategories: ["community", "culture"],
        defaultInterests: ["community", "newcomer-friendly"],
        sourceUrl: "https://example.com/cincinnati/city-events.xml",
        confidence: 0.78
      },
      {
        sourceId: "cincinnati-museum-rss",
        sourceName: "Cincinnati Museum Calendar",
        url: "https://example.com/cincinnati/museum-calendar.xml",
        enabled: true,
        city: "Cincinnati",
        region: "OH",
        country: "USA",
        defaultCategories: ["arts", "family"],
        defaultInterests: ["arts", "family-friendly"],
        sourceUrl: "https://example.com/cincinnati/museum-calendar.xml",
        confidence: 0.76
      },
      {
        sourceId: "cincinnati-community-rss",
        sourceName: "Cincinnati Community Digest",
        url: "https://example.com/cincinnati/community-digest.xml",
        enabled: false,
        city: "Cincinnati",
        region: "OH",
        country: "USA",
        defaultCategories: ["community"],
        defaultInterests: ["social"],
        sourceUrl: "https://example.com/cincinnati/community-digest.xml",
        confidence: 0.75
      }
    ],
    ticketmaster: {
      enabled: false,
      defaultKeyword: "Cincinnati"
    }
  }
};
