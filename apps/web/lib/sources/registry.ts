import { communityMockProvider } from "./communityMockProvider";
import { communitySubmissionProvider } from "./communitySubmissionProvider";
import { curatedProvider } from "./curatedProvider";
import { icsProvider } from "./icsProvider";
import type { EventSourceProvider } from "./provider";
import { meetupProvider } from "./meetupProvider";
import { mockProvider } from "./mockProvider";
import { rssProvider } from "./rssProvider";
import { socialLeadProvider } from "./socialLeadProvider";
import { ticketmasterProvider } from "./ticketmasterProvider";
import { websiteProvider } from "./websiteProvider";

const providers: EventSourceProvider[] = [
  curatedProvider,
  communitySubmissionProvider,
  mockProvider,
  communityMockProvider,
  icsProvider,
  ticketmasterProvider,
  meetupProvider,
  rssProvider,
  websiteProvider,
  socialLeadProvider
];

export function getAllProviders() {
  return providers;
}

export function getEnabledProviders() {
  return providers.filter((provider) => provider.enabled);
}
