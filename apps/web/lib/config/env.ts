import { existsSync } from "node:fs";
import { isProduction } from "./runtime";

function readFlag(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  return value === "true";
}

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function hasConfiguredCredential(value: string | null | undefined) {
  return clean(value).length > 0;
}

export type ProductionSafetyCheck = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

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
  curatedEventsPath: process.env.CURATED_EVENTS_PATH ?? "apps/web/data/curated-events.json",
  cityPresetQaLiveFetch: readFlag("CITY_PRESET_QA_LIVE_FETCH", false),
  enableMockProvider: readFlag("ENABLE_MOCK_PROVIDER", true),
  enableCommunityMockProvider: readFlag("ENABLE_COMMUNITY_MOCK_PROVIDER", true),
  enableCommunitySubmissionsProvider: readFlag("ENABLE_COMMUNITY_SUBMISSIONS_PROVIDER", false),
  enableSampleSubmissions: readFlag("ENABLE_SAMPLE_SUBMISSIONS", false),
  enableSampleTrustedSources: readFlag("ENABLE_SAMPLE_TRUSTED_SOURCES", false),
  enableDetailedHealth: readFlag("ENABLE_DETAILED_HEALTH", false),
  enableCuratedProvider: readFlag("ENABLE_CURATED_PROVIDER", false),
  enableCityPresets: readFlag("ENABLE_CITY_PRESETS", false),
  enableTicketmasterProvider: readFlag("ENABLE_TICKETMASTER_PROVIDER", false),
  enableMeetupProvider: readFlag("ENABLE_MEETUP_PROVIDER", false),
  enableIcsProvider: readFlag("ENABLE_ICS_PROVIDER", false),
  enableRssProvider: readFlag("ENABLE_RSS_PROVIDER", false),
  enableWebsiteProvider: readFlag("ENABLE_WEBSITE_PROVIDER", false),
  enableSocialLeads: readFlag("ENABLE_SOCIAL_LEADS", false)
};

export function validateProductionSafety(): ProductionSafetyCheck {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!isProduction()) {
    return { ok: true, warnings, errors };
  }

  if (!hasConfiguredCredential(env.adminToken)) {
    errors.push("ADMIN_TOKEN is required in production.");
  }

  if (env.enableSampleSubmissions) {
    errors.push("ENABLE_SAMPLE_SUBMISSIONS must be false in production.");
  }

  if (env.enableSampleTrustedSources) {
    errors.push("ENABLE_SAMPLE_TRUSTED_SOURCES must be false in production.");
  }

  if (env.enableDetailedHealth) {
    warnings.push("ENABLE_DETAILED_HEALTH is enabled in production; detailed health must stay admin-protected.");
  }

  if (env.enableTicketmasterProvider && !hasConfiguredCredential(env.ticketmasterApiKey)) {
    warnings.push("Ticketmaster provider is enabled but TICKETMASTER_API_KEY is not configured.");
  }

  if (env.enableMeetupProvider && !hasConfiguredCredential(env.meetupAccessToken)) {
    warnings.push("Meetup provider is enabled but MEETUP_ACCESS_TOKEN is not configured.");
  }

  if (env.enableIcsProvider && !process.env.ICS_SOURCE_URLS?.trim()) {
    warnings.push("ICS provider is enabled but ICS_SOURCE_URLS is empty.");
  }

  if (env.enableRssProvider && !process.env.RSS_SOURCE_URLS?.trim()) {
    warnings.push("RSS provider is enabled but RSS_SOURCE_URLS is empty.");
  }

  if (env.enableCuratedProvider && !existsSync(env.curatedEventsPath)) {
    warnings.push("Curated provider is enabled but the curated events file is missing.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
