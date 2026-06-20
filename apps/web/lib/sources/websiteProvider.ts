import { env } from "@/lib/config/env";
import type { EventSourceProvider } from "./provider";

export const websiteProvider: EventSourceProvider = {
  sourceId: "website",
  sourceName: "Allowlisted Venue Sites",
  sourceType: "website",
  enabled: env.enableWebsiteProvider,
  async fetchEvents() {
    return [];
  }
};
