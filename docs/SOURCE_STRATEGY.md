# Source Strategy

## Principle

Event Scout should collect events from many sources, but every source must be legal, maintainable, and clearly attributed.

## Source priority

### Tier 1: Mock and structured APIs

- Mock provider
- Ticketmaster
- Meetup
- Organizer-connected Eventbrite

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

## Required provider behavior

Each provider must:

- Return raw events
- Include source URL
- Include source name
- Handle API failure gracefully
- Avoid crashing the scout pipeline
- Respect missing API keys
