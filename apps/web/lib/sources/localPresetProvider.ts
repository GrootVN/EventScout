import { env } from "@/lib/config/env";
import { getCityPreset, listCityPresets } from "@/config/cities";
import type { CitySourcePreset } from "@/config/cities/types";

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function isEnabledEntry(entry: { enabled?: boolean }) {
  return entry.enabled !== false;
}

export function isCityPresetsEnabled() {
  return env.enableCityPresets;
}

export function getAvailableCityPresets() {
  return listCityPresets();
}

export function getActiveCityPreset(): CitySourcePreset | null {
  if (!env.enableCityPresets) {
    return null;
  }

  const preset = getCityPreset(clean(env.defaultCityPreset));
  return preset ?? null;
}

export function getActiveCityPresetSummary() {
  const preset = getActiveCityPreset();
  if (!preset) {
    return null;
  }

  return {
    cityId: preset.cityId,
    cityName: preset.cityName,
    region: preset.region,
    country: preset.country,
    defaultRadiusMiles: preset.defaultRadiusMiles,
    icsSourceCount: preset.sources.ics.filter(isEnabledEntry).length,
    rssSourceCount: preset.sources.rss.filter(isEnabledEntry).length,
    ticketmasterEnabled: Boolean(preset.sources.ticketmaster?.enabled)
  };
}
