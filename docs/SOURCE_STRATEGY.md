# Source Strategy

## Principle

Event Scout should collect events from many sources, but every source must be legal, maintainable, and clearly attributed.

## Source priority

### Tier 1: Mock and structured APIs

- Mock provider
- Ticketmaster
- Meetup
- Curated/admin file-backed events
- Eventbrite remains a future candidate provider. It is not currently implemented in the provider registry.

### Tier 2: Public calendar feeds

- RSS feeds
- ICS calendars
- City calendars
- University calendars
- Library calendars
- Museum calendars

### Tier 3: Venue websites

- Music venues
- Coffee shops
- Coworking spaces
- Bars
- Community centers
- Parks departments

Only use website adapters for allowlisted sites.

### Tier 4: Social media leads

Social media posts should initially create candidate events, not trusted canonical events.

Candidate event statuses:

- candidate
- verified
- rejected
- needs_review

### Tier 5: Community submissions

Users can submit links or event details.

Community submissions must remain pending until an admin approves them. Approved submissions are converted into curated/community events and then enter the public aggregator alongside other trusted sources.

Operational safety notes:

- Admin surfaces must fail closed in production when `ADMIN_TOKEN` is missing.
- Sample data should stay disabled in production.
- Public health checks should avoid exposing secrets or detailed provider diagnostics unless authorized.
- Source-run history should store summaries only and stay behind admin-protected detail views in production.

## Required provider behavior

Each provider must:

- Return raw events
- Include source URL
- Include source name
- Handle API failure gracefully
- Avoid crashing the scout pipeline
- Respect missing API keys

The source health dashboard should summarize whether each provider is ready, disabled, or missing required configuration, and should surface recent warnings and errors without hiding the original source inventory.

M18 adds source-run history on top of that snapshot so trend questions can be answered before M19 alerting is introduced.

## Implemented provider inventory

| Provider | Source ID | Feature flag | Default state | Credentials required | QA status |
| --- | --- | --- | --- | --- | --- |
| Mock provider | `mock` | `ENABLE_MOCK_PROVIDER` | enabled | no | unit and aggregator QA |
| Community mock provider | `community-mock` | `ENABLE_COMMUNITY_MOCK_PROVIDER` | enabled | no | unit and aggregator QA |
| Ticketmaster provider | `ticketmaster` | `ENABLE_TICKETMASTER_PROVIDER` | disabled | `TICKETMASTER_API_KEY` | fixture-tested plus manual live smoke |
| ICS provider | `ics` | `ENABLE_ICS_PROVIDER` | disabled | `ICS_SOURCE_URLS` feed config only | fixture-tested |
| RSS provider | `rss` | `ENABLE_RSS_PROVIDER` | disabled | `RSS_SOURCE_URLS` feed config only | fixture-tested |
| Meetup provider | `meetup` | `ENABLE_MEETUP_PROVIDER` | disabled | `MEETUP_ACCESS_TOKEN` | fixture-tested only |
| Curated/admin provider | `curated` | `ENABLE_CURATED_PROVIDER` | disabled | curated JSON path only | fixture-tested and aggregator QA |
| Community submissions provider | `community-submissions` | `ENABLE_COMMUNITY_SUBMISSIONS_PROVIDER` | disabled | no provider secret; admin moderation uses `ADMIN_TOKEN` when set | unit/API tested and aggregator QA |
| Website placeholder provider | `website` | `ENABLE_WEBSITE_PROVIDER` | disabled | no | placeholder only, emits no events |
| Social lead placeholder provider | `social` | `ENABLE_SOCIAL_LEADS` | disabled | no | placeholder only, emits no events |

Every implemented provider is present in `apps/web/lib/sources/registry.ts` and every feature flag appears in `.env.example` and `apps/web/lib/config/env.ts`.

Meetup-specific notes:

- Keep Meetup disabled by default behind `ENABLE_MEETUP_PROVIDER`.
- Use `MEETUP_ACCESS_TOKEN` for token-based GraphQL access.
- Preserve the original Meetup event URL on every raw event so source attribution stays transparent.
- Preserve the original community submission source URL on every approved event so source attribution stays transparent.
