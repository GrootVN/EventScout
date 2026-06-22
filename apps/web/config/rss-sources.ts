import { env } from "@/lib/config/env";

export type RssSourceConfig = {
  sourceId: string;
  sourceName: string;
  url: string;
  city?: string;
  region?: string;
  country?: string;
  defaultInterests?: string[];
  defaultCategories?: string[];
  sourceUrl?: string;
  confidence?: number;
};

const DEFAULT_RSS_SOURCE_CONFIGS: RssSourceConfig[] = [];

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function parseSourceUrls(rawValue: string) {
  return rawValue
    .split(/[\n,;]+/)
    .map((entry) => clean(entry))
    .filter((entry) => entry.length > 0);
}

export function getRssSourceConfigs() {
  const parsedConfigs: RssSourceConfig[] = parseSourceUrls(env.rssSourceUrls).flatMap((url, index) => {
    if (!isValidUrl(url)) {
      return [];
    }

    const sourceName = `RSS Feed ${index + 1}`;

    return [
      {
        sourceId: `rss-${index + 1}`,
        sourceName,
        url,
        sourceUrl: url,
        confidence: 0.78
      }
    ];
  });

  return [...DEFAULT_RSS_SOURCE_CONFIGS, ...parsedConfigs];
}

export const RSS_SOURCE_CONFIGS = getRssSourceConfigs();
