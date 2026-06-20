import { env } from "@/lib/config/env";
import type { EventSourceProvider } from "./provider";

export const rssProvider: EventSourceProvider = {
  sourceId: "rss",
  sourceName: "Public Calendar Feeds",
  sourceType: "rss",
  enabled: env.enableRssProvider,
  async fetchEvents() {
    return [];
  }
};
