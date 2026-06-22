# Event Scout

Event Scout is a newcomer-first local discovery app. It helps someone answer: "What is happening near me that I would actually care about?" by combining events from multiple sources, normalizing them into one schema, ranking them by relevance, and always showing the original source.

## What is in the repo

- `AGENTS.md`: durable repo instructions for Codex.
- `docs/`: product brief, milestones, architecture, ranking, dedupe, and source strategy.
- `apps/web`: the Next.js app with the discovery UI and route handlers.
- `tests/`: unit and API coverage for normalization, filtering, dedupe, classification, ranking, and source attribution.

## Current product slice

- Mock-data-first event discovery
- Cross-provider mock aggregation with duplicate source preservation
- Canonical source-adapter architecture
- URL-driven browsing filters
- Event detail pages with source transparency
- Local saved events
- A Ticketmaster adapter behind `ENABLE_TICKETMASTER_PROVIDER`
- A generic ICS calendar adapter behind `ENABLE_ICS_PROVIDER`
- A sources page showing enabled and planned providers
- Aggregator QA artifacts with provider counts and merge visibility
- A manual Ticketmaster smoke QA path that can write live report artifacts

## Quick start

```bash
npm install
copy .env.example .env.local
cmd /c npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
cmd /c npm run lint
cmd /c npm run typecheck
cmd /c npm test
cmd /c npm run build
cmd /c npm run qa:aggregator
cmd /c npm run qa:ticketmaster
```

## Ticketmaster smoke QA

To run a real Ticketmaster smoke check, set a live key and enable the provider:

```bash
ENABLE_TICKETMASTER_PROVIDER=true
TICKETMASTER_API_KEY=your_real_key_here
npm run qa:ticketmaster
```

The script writes `qa-results/ticketmaster-live-report.json` and
`qa-results/ticketmaster-live-report.html`. Those files are ignored by default so live API results do not get committed accidentally.

Optional query overrides:

- `TICKETMASTER_QA_CITY`
- `TICKETMASTER_QA_REGION`
- `TICKETMASTER_QA_COUNTRY`
- `TICKETMASTER_QA_KEYWORD`
- `TICKETMASTER_QA_START_DATE`
- `TICKETMASTER_QA_END_DATE`
- `TICKETMASTER_QA_LATITUDE`
- `TICKETMASTER_QA_LONGITUDE`
- `TICKETMASTER_QA_RADIUS_MILES`
- `TICKETMASTER_QA_INTERESTS`

## ICS calendar provider

Enable the generic ICS provider when you want to ingest public calendar feeds from cities, libraries, universities, museums, parks, and community groups:

```bash
ENABLE_ICS_PROVIDER=true
ICS_SOURCE_URLS="https://example.com/calendar.ics"
npm run qa:aggregator
```

Notes:

- Mock-only mode still works when `ENABLE_ICS_PROVIDER` is false or `ICS_SOURCE_URLS` is empty.
- The provider preserves the original calendar or event URL on every event.
- Recurring feeds are skipped with warnings instead of being expanded into many instances.
- `ICS_SOURCE_URLS` can be a comma, semicolon, or newline separated list of feed URLs.

## Versioning

This repo uses Semantic Versioning with tags in the form `vMAJOR.MINOR.PATCH`.

- `PATCH`: fixes, hardening, test coverage, internal refactors
- `MINOR`: new features or milestone-sized capability additions
- `MAJOR`: breaking changes to contracts or structure

## Next milestone

Implement M11 from [docs/MILESTONES.md](/C:/Users/nguye/Documents/EventScout/docs/MILESTONES.md): generic RSS provider.
