import { env } from "@/lib/config/env";

export type IcsSourceConfig = {
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

export function getIcsSourceConfigs() {
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

  return [...DEFAULT_ICS_SOURCE_CONFIGS, ...parsedConfigs];
}

export const ICS_SOURCE_CONFIGS = getIcsSourceConfigs();
