import { env } from "@/lib/config/env";
import { getActiveCityPreset } from "@/lib/sources/localPresetProvider";

export type RssSourceConfig = {
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

function isEnabledEntry(entry: { enabled?: boolean }) {
  return entry.enabled !== false;
}

function isValidSourceConfig(config: RssSourceConfig) {
  return clean(config.sourceId).length > 0 && clean(config.sourceName).length > 0 && isValidUrl(config.url);
}

function dedupeSourceConfigs(configs: RssSourceConfig[]) {
  const merged = new Map<string, RssSourceConfig>();
  for (const config of configs) {
    if (!isValidSourceConfig(config) || !isEnabledEntry(config)) {
      continue;
    }

    if (!merged.has(config.sourceId)) {
      merged.set(config.sourceId, config);
    }
  }

  return [...merged.values()];
}

export function getRssSourceConfigs() {
  const presetConfigs = getActiveCityPreset()?.sources.rss ?? [];
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

  return dedupeSourceConfigs([...DEFAULT_RSS_SOURCE_CONFIGS, ...presetConfigs, ...parsedConfigs]);
}

export const RSS_SOURCE_CONFIGS = getRssSourceConfigs();
