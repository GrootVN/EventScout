import { SourceAdapter } from "@eventscout/shared";
import { EventApiConnector } from "./event-api.js";
import { MeetupConnector } from "./meetup.js";
import { PublicWebConnector } from "./public-web.js";
import { RedditConnector } from "./reddit.js";

export function createSourceRegistry(): SourceAdapter[] {
  return [
    new EventApiConnector(),
    new RedditConnector(),
    new MeetupConnector(),
    new PublicWebConnector()
  ];
}
