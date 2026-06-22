import { env } from "@/lib/config/env";
import type { EventSourceProvider } from "./provider";

export const ticketmasterProvider: EventSourceProvider = {
  sourceId: "ticketmaster",
  sourceName: "Ticketmaster",
  sourceType: "api",
  enabled: env.enableTicketmasterProvider && Boolean(env.ticketmasterApiKey),
  async fetchEvents() {
    return [];
  }
};
