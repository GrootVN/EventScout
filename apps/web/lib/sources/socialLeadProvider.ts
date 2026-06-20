import { env } from "@/lib/config/env";
import type { EventSourceProvider } from "./provider";

export const socialLeadProvider: EventSourceProvider = {
  sourceId: "social",
  sourceName: "Social Leads",
  sourceType: "social",
  enabled: env.enableSocialLeads,
  async fetchEvents() {
    return [];
  }
};
