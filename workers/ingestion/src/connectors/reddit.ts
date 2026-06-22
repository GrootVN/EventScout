import {
  CanonicalEventCandidate,
  SourceAdapter,
  SourceHealthStatus,
  SourceRawRecord
} from "@eventscout/shared";

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  created_utc: number;
  score: number;
  num_comments: number;
  permalink: string;
}

interface RedditListing {
  data?: {
    children?: Array<{ data: RedditPost }>;
  };
}

export class RedditConnector implements SourceAdapter {
  source = "reddit-r-cincinnati";
  sourceFamily = "forum" as const;
  seeds = [{ url: "https://www.reddit.com/r/cincinnati/new.json?limit=80", label: "r/cincinnati" }];
  rateLimitPolicy = { maxRequestsPerMinute: 30 };
  retryPolicy = { maxRetries: 3, baseDelayMs: 1500 };

  async fetchSince(_cursorOrIso: string): Promise<SourceRawRecord[]> {
    const userAgent = process.env.REDDIT_USER_AGENT;
    if (!userAgent) {
      return [];
    }

    const endpoint = "https://www.reddit.com/r/cincinnati/new.json?limit=80";
    const response = await fetch(endpoint, {
      headers: { "user-agent": userAgent }
    });
    if (!response.ok) {
      throw new Error(`Reddit request failed: ${response.status}`);
    }

    const payload = (await response.json()) as RedditListing;
    return (
      payload.data?.children?.map((child) => ({
        source_event_id: child.data.id,
        source_url: `https://reddit.com${child.data.permalink}`,
        payload: child.data,
        fetched_at: new Date().toISOString(),
        http_status: response.status,
        parser_version: "reddit-v2",
        metadata: {
          adapter: this.source,
          subreddit: "cincinnati"
        }
      })) ?? []
    );
  }

  normalize(raw: SourceRawRecord): CanonicalEventCandidate | null {
    const post = raw.payload as RedditPost;
    if (!post.id || !post.title) {
      return null;
    }

    const addressMatch = post.selftext.match(
      /(\d{1,5}\s+[A-Za-z0-9.\s]+,\s*[A-Za-z.\s]+,\s*[A-Z]{2})/
    );
    const startMatch = post.selftext.match(
      /\b(20\d{2}-\d{2}-\d{2}\s+\d{1,2}:\d{2})\b/
    );

    if (!addressMatch || !startMatch) {
      return null;
    }

    return {
      title: post.title,
      description: post.selftext,
      start_time: new Date(startMatch[1]).toISOString(),
      end_time: null,
      timezone: "America/New_York",
      venue_name: null,
      address: addressMatch[1],
      lat: null,
      lng: null,
      city: "Cincinnati",
      region: "OH",
      categories: [],
      price_type: "unknown",
      source: this.source,
      source_family: this.sourceFamily,
      source_url: `https://reddit.com${post.permalink}`,
      source_event_id: post.id,
      organizer_name: null,
      engagement_signals: {
        upvotes: post.score,
        comments: post.num_comments
      },
      raw_payload: raw.payload
    };
  }

  async sourceHealthCheck(): Promise<SourceHealthStatus> {
    return {
      source: this.source,
      healthy: Boolean(process.env.REDDIT_USER_AGENT),
      detail: process.env.REDDIT_USER_AGENT
        ? "Configured"
        : "REDDIT_USER_AGENT is missing"
    };
  }
}
