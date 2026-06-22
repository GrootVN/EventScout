export type CityIcsSourceConfig = {
  sourceId: string;
  sourceName: string;
  url: string;
  enabled?: boolean;
  city?: string;
  region?: string;
  country?: string;
  defaultInterests?: string[];
  defaultCategories?: string[];
  sourceUrl?: string;
  confidence?: number;
};

export type CityRssSourceConfig = {
  sourceId: string;
  sourceName: string;
  url: string;
  enabled?: boolean;
  city?: string;
  region?: string;
  country?: string;
  defaultInterests?: string[];
  defaultCategories?: string[];
  sourceUrl?: string;
  confidence?: number;
};

export type CitySourcePreset = {
  cityId: string;
  cityName: string;
  region: string;
  country: string;
  defaultRadiusMiles: number;
  sources: {
    ics: CityIcsSourceConfig[];
    rss: CityRssSourceConfig[];
    ticketmaster?: {
      enabled: boolean;
      defaultKeyword?: string;
    };
  };
};
