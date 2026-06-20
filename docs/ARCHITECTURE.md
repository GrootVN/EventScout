# Event Scout Architecture

## Main architecture

Event Scout uses a source-adapter pipeline.

```text
Source Providers
    ->
Raw Events
    ->
Normalizer
    ->
Interest Classifier
    ->
Deduplicator
    ->
Ranker
    ->
Web UI / API
```

## Source providers

Each source provider fetches events from one source type:

- Mock data
- Ticketmaster
- Meetup
- RSS feeds
- ICS calendars
- Venue websites
- Social media leads
- Community submissions

All providers implement the same interface.

## Event lifecycle

1. Fetch raw event
2. Store source metadata
3. Normalize into canonical event schema
4. Add interest tags
5. Detect duplicates
6. Rank for user
7. Display with original source link

## Design principles

- Source transparency first
- Mock data first
- External APIs behind adapters
- Pure functions for filters, ranking, and dedupe
- No hardcoded secrets
- Graceful failure per source
