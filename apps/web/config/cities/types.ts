export type CitySourceStatus = "verified" | "placeholder" | "disabled" | "needs_review";

export type CityPresetSourceBase = {
  sourceId: string;
  sourceName: string;
  url: string;
  enabled?: boolean;
  status?: CitySourceStatus;
  notes?: string;
  city?: string;
  region?: string;
  country?: string;
  defaultInterests?: string[];
  defaultCategories?: string[];
  sourceUrl?: string;
  confidence?: number;
};

export type CityIcsSourceConfig = CityPresetSourceBase;

export type CityRssSourceConfig = CityPresetSourceBase;

export type CityTicketmasterPresetConfig = {
  enabled: boolean;
  defaultKeyword?: string;
  status?: CitySourceStatus;
  notes?: string;
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
    ticketmaster?: CityTicketmasterPresetConfig;
  };
};
