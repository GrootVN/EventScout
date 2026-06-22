import { cincinnatiCityPreset } from "./cincinnati";
import type { CitySourcePreset } from "./types";

const CITY_PRESETS: CitySourcePreset[] = [cincinnatiCityPreset];

export function listCityPresets() {
  return [...CITY_PRESETS];
}

export function getCityPreset(cityId: string) {
  const normalizedCityId = cityId.trim().toLowerCase();
  return CITY_PRESETS.find((preset) => preset.cityId.toLowerCase() === normalizedCityId) ?? null;
}
