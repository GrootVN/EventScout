import type { EventFilters, ScoutEvent } from "./types";

export function filterEvents(events: ScoutEvent[], filters: EventFilters): ScoutEvent[] {
  return events.filter((event) => {
    if (filters.city && event.city.toLowerCase() !== filters.city.toLowerCase()) {
      return false;
    }

    if (filters.priceType && filters.priceType !== "any" && event.priceType !== filters.priceType) {
      return false;
    }

    if (filters.interests?.length) {
      const eventInterests = new Set(event.interests);
      if (!filters.interests.some((interest) => eventInterests.has(interest))) {
        return false;
      }
    }

    if (filters.keyword) {
      const haystack = `${event.title} ${event.description ?? ""} ${event.venueName ?? ""}`.toLowerCase();
      if (!haystack.includes(filters.keyword.toLowerCase())) {
        return false;
      }
    }

    if (filters.startDate && event.startDateTime < filters.startDate) {
      return false;
    }

    if (filters.endDate && event.startDateTime > filters.endDate) {
      return false;
    }

    if (filters.soloFriendly && !event.isSoloFriendly) {
      return false;
    }

    if (filters.newcomerFriendly && !event.isNewcomerFriendly) {
      return false;
    }

    return true;
  });
}
