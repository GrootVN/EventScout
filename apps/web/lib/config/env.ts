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
  ticketmasterApiKey: process.env.TICKETMASTER_API_KEY ?? "",
  meetupAccessToken: process.env.MEETUP_ACCESS_TOKEN ?? "",
  enableMockProvider: readFlag("ENABLE_MOCK_PROVIDER", true),
  enableTicketmasterProvider: readFlag("ENABLE_TICKETMASTER_PROVIDER", false),
  enableMeetupProvider: readFlag("ENABLE_MEETUP_PROVIDER", false),
  enableRssProvider: readFlag("ENABLE_RSS_PROVIDER", false),
  enableWebsiteProvider: readFlag("ENABLE_WEBSITE_PROVIDER", false),
  enableSocialLeads: readFlag("ENABLE_SOCIAL_LEADS", false)
};
