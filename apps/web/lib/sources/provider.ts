import type { EventSourceType, RawEvent } from "@/lib/events/types";

export type FetchEventsInput = {
  city: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  startDate?: string;
  endDate?: string;
  interests?: string[];
  keyword?: string;
};

export type EventSourceProvider = {
  sourceId: string;
  sourceName: string;
  sourceType: EventSourceType;
  enabled: boolean;
  fetchEvents(input: FetchEventsInput): Promise<RawEvent[]>;
};
