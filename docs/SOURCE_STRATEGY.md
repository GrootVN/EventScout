# Source Strategy

## Principle

Event Scout should collect events from many sources, but every source must be legal, maintainable, and clearly attributed.

## Source priority

### Tier 1: Mock and structured APIs

- Mock provider
- Ticketmaster
- Meetup
- Organizer-connected Eventbrite
- Curated/admin file-backed events

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

## Required provider behavior

Each provider must:

- Return raw events
- Include source URL
- Include source name
- Handle API failure gracefully
- Avoid crashing the scout pipeline
- Respect missing API keys

The source health dashboard should summarize whether each provider is ready, disabled, or missing required configuration, and should surface recent warnings and errors without hiding the original source inventory.

Meetup-specific notes:

- Keep Meetup disabled by default behind `ENABLE_MEETUP_PROVIDER`.
- Use `MEETUP_ACCESS_TOKEN` for token-based GraphQL access.
- Preserve the original Meetup event URL on every raw event so source attribution stays transparent.
- Preserve the original community submission source URL on every approved event so source attribution stays transparent.
