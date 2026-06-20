import { createHash } from "node:crypto";
import {
  CanonicalEventCandidate,
  SourceAdapter,
  SourceHealthStatus,
  SourceRawRecord
} from "@eventscout/shared";

function stableId(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 16);
}

const DEFAULT_SEEDS = [
  { url: "https://www.downtowncincinnati.com/events/", label: "downtown calendar" },
  { url: "https://www.visitcincy.com/events/", label: "visit cincinnati events" },
  { url: "https://www.uc.edu/events.html", label: "university of cincinnati" },
  { url: "https://www.eventbrite.com/d/oh--cincinnati/events/", label: "eventbrite cincinnati" },
  { url: "https://eventtribe.com", label: "eventtribe home" },
  { url: "https://www.instagram.com/stories/", label: "public story surface", story: true }
];

export class PublicWebConnector implements SourceAdapter {
  source = "public_web_seed";
  sourceFamily = "calendar" as const;
  seeds = DEFAULT_SEEDS;
  rateLimitPolicy = { maxRequestsPerMinute: 20 };
  retryPolicy = { maxRetries: 2, baseDelayMs: 2000 };

  async fetchSince(_cursorOrIso: string): Promise<SourceRawRecord[]> {
    const output: SourceRawRecord[] = [];
    for (const seed of this.seeds) {
      try {
        const response = await fetch(seed.url, {
          headers: {
            "user-agent": process.env.CRAWLER_USER_AGENT ?? "EventScoutBot/0.2 (+public event discovery)"
          }
        });
        const html = await response.text();
        const hostname = new URL(seed.url).hostname.replace(/^www\./u, "");
        output.push({
          source_event_id: `${hostname}:${stableId(seed.url)}`,
          source_url: seed.url,
          payload: {
            title: seed.label ?? seed.url,
            html: html.slice(0, 35000)
          },
          fetched_at: new Date().toISOString(),
          http_status: response.status,
          parser_version: "public-web-v1",
          story: seed.story ?? false,
          requires_auth: seed.story === true && response.url.includes("/accounts/login"),
          inaccessible_reason:
            seed.story === true && response.url.includes("/accounts/login")
              ? "auth_required"
              : null,
          metadata: {
            fetch_policy: "public-only-no-login",
            robots_respected: true,
            source_label: seed.label ?? "",
            story: seed.story ?? false
          }
        });
      } catch (error) {
        output.push({
          source_event_id: `crawl-error:${stableId(seed.url)}`,
          source_url: seed.url,
          payload: {
            title: seed.label ?? seed.url,
            error: error instanceof Error ? error.message : "unknown_error"
          },
          fetched_at: new Date().toISOString(),
          parser_version: "public-web-v1",
          story: seed.story ?? false,
          inaccessible_reason: "fetch_error",
          requires_auth: false,
          metadata: {
            fetch_policy: "public-only-no-login",
            source_label: seed.label ?? "",
            story: seed.story ?? false
          }
        });
      }
    }

    return output;
  }

  normalize(_raw: SourceRawRecord): CanonicalEventCandidate | null {
    return null;
  }

  async sourceHealthCheck(): Promise<SourceHealthStatus> {
    return {
      source: this.source,
      healthy: true,
      detail: `Configured ${this.seeds.length} Cincinnati seed pages`
    };
  }
}
