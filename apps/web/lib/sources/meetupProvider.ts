import { env } from "@/lib/config/env";
import type { EventSourceProvider } from "./provider";

export const meetupProvider: EventSourceProvider = {
  sourceId: "meetup",
  sourceName: "Meetup",
  sourceType: "api",
  enabled: env.enableMeetupProvider && Boolean(env.meetupAccessToken),
  async fetchEvents() {
    return [];
  }
};
