function readFlag(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  return value === "true";
}

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Event Scout",
  defaultCity: process.env.NEXT_PUBLIC_DEFAULT_CITY ?? "Cincinnati",
  defaultRegion: process.env.NEXT_PUBLIC_DEFAULT_REGION ?? "OH",
  defaultCountry: process.env.NEXT_PUBLIC_DEFAULT_COUNTRY ?? "USA",
  adminToken: process.env.ADMIN_TOKEN ?? "",
  ticketmasterApiKey: process.env.TICKETMASTER_API_KEY ?? "",
  meetupAccessToken: process.env.MEETUP_ACCESS_TOKEN ?? "",
  meetupGraphqlEndpoint: process.env.MEETUP_GRAPHQL_ENDPOINT ?? "https://api.meetup.com/gql",
  defaultCityPreset: process.env.DEFAULT_CITY_PRESET ?? "cincinnati",
  icsSourceUrls: process.env.ICS_SOURCE_URLS ?? "",
  rssSourceUrls: process.env.RSS_SOURCE_URLS ?? "",
  cityPresetQaLiveFetch: readFlag("CITY_PRESET_QA_LIVE_FETCH", false),
  enableMockProvider: readFlag("ENABLE_MOCK_PROVIDER", true),
  enableCommunityMockProvider: readFlag("ENABLE_COMMUNITY_MOCK_PROVIDER", true),
  enableCityPresets: readFlag("ENABLE_CITY_PRESETS", false),
  enableTicketmasterProvider: readFlag("ENABLE_TICKETMASTER_PROVIDER", false),
  enableMeetupProvider: readFlag("ENABLE_MEETUP_PROVIDER", false),
  enableIcsProvider: readFlag("ENABLE_ICS_PROVIDER", false),
  enableRssProvider: readFlag("ENABLE_RSS_PROVIDER", false),
  enableWebsiteProvider: readFlag("ENABLE_WEBSITE_PROVIDER", false),
  enableSocialLeads: readFlag("ENABLE_SOCIAL_LEADS", false)
};
