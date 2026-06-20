import { env } from "@/lib/config/env";
import { getDateRangeFromPreset, type DatePreset } from "@/lib/utils/dates";
import type { EventFilters, RankingInput } from "./types";

export type EventSearchState = EventFilters &
  RankingInput & {
    datePreset: DatePreset;
  };

export function parseSearchState(searchParams: Record<string, string | string[] | undefined>): EventSearchState {
  const interestValue = searchParams.interests;
  const interests = Array.isArray(interestValue)
    ? interestValue
    : typeof interestValue === "string" && interestValue.length > 0
      ? interestValue.split(",")
      : [];

  const presetRaw = searchParams.datePreset;
  const datePreset =
    presetRaw === "tonight" ||
    presetRaw === "tomorrow" ||
    presetRaw === "this-weekend" ||
    presetRaw === "this-month" ||
    presetRaw === "custom"
      ? presetRaw
      : "this-weekend";

  const resolvedRange = getDateRangeFromPreset(datePreset);

  return {
    city: typeof searchParams.city === "string" && searchParams.city ? searchParams.city : env.defaultCity,
    interests,
    keyword: typeof searchParams.keyword === "string" ? searchParams.keyword : "",
    priceType:
      searchParams.priceType === "free" || searchParams.priceType === "paid" || searchParams.priceType === "unknown"
        ? searchParams.priceType
        : "any",
    startDate: typeof searchParams.startDate === "string" && searchParams.startDate ? searchParams.startDate : resolvedRange.start,
    endDate: typeof searchParams.endDate === "string" && searchParams.endDate ? searchParams.endDate : resolvedRange.end,
    soloFriendly: searchParams.soloFriendly === "true",
    newcomerFriendly: searchParams.newcomerFriendly === "true",
    userCity: typeof searchParams.city === "string" && searchParams.city ? searchParams.city : env.defaultCity,
    latitude: undefined,
    longitude: undefined,
    preferFree: searchParams.priceType === "free",
    datePreset
  };
}
