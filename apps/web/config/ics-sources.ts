import { env } from "@/lib/config/env";
import { getActiveCityPreset } from "@/lib/sources/localPresetProvider";

export type IcsSourceConfig = {
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

const DEFAULT_ICS_SOURCE_CONFIGS: IcsSourceConfig[] = [];

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

function isValidSourceConfig(config: IcsSourceConfig) {
  return clean(config.sourceId).length > 0 && clean(config.sourceName).length > 0 && isValidUrl(config.url);
}

function dedupeSourceConfigs(configs: IcsSourceConfig[]) {
  const merged = new Map<string, IcsSourceConfig>();
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

export function getIcsSourceConfigs() {
  const presetConfigs = getActiveCityPreset()?.sources.ics ?? [];
  const parsedConfigs: IcsSourceConfig[] = parseSourceUrls(env.icsSourceUrls).flatMap((url, index) => {
    if (!isValidUrl(url)) {
      return [];
    }

    const sourceName = `ICS Calendar ${index + 1}`;

    return [
      {
        sourceId: `ics-${index + 1}`,
        sourceName,
        url,
        sourceUrl: url,
        confidence: 0.88
      }
    ];
  });

  return dedupeSourceConfigs([...DEFAULT_ICS_SOURCE_CONFIGS, ...presetConfigs, ...parsedConfigs]);
}

export const ICS_SOURCE_CONFIGS = getIcsSourceConfigs();
