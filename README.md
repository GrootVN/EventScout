# Event Scout

Event Scout is a newcomer-first local discovery app. It helps someone answer: "What is happening near me that I would actually care about?" by combining events from multiple sources, normalizing them into one schema, ranking them by relevance, and always showing the original source.

## What is in the repo

- `AGENTS.md`: durable repo instructions for Codex.
- `docs/`: product brief, milestones, architecture, ranking, dedupe, and source strategy.
- `apps/web`: the Next.js app with the discovery UI and route handlers.
- `tests/`: unit and API coverage for normalization, filtering, dedupe, classification, ranking, and source attribution.

## Current product slice

Current stage: post-M18 source reliability and operations layer. M18 source-run history is complete, this release completes M18.1 roadmap/release/test reconciliation, and M19 is next.

- Mock-data-first event discovery
- Cross-provider mock aggregation with duplicate source preservation
- Canonical source-adapter architecture
- URL-driven browsing filters
- Event detail pages with source transparency
- Local saved events
- A Ticketmaster adapter behind `ENABLE_TICKETMASTER_PROVIDER`
- A Meetup adapter behind `ENABLE_MEETUP_PROVIDER`
- A generic ICS calendar adapter behind `ENABLE_ICS_PROVIDER`
- A generic RSS/Atom adapter behind `ENABLE_RSS_PROVIDER`
- A sources page showing enabled and planned providers
- A source health dashboard showing readiness, configuration gaps, and recent diagnostics
- Source-run history for QA and health snapshots, surfaced in `/health` and the admin history API
- Canonical milestone, provider, release, and test inventory in [docs/CURRENT_STATE.md](/C:/Users/nguye/Documents/EventScout/docs/CURRENT_STATE.md)
- Aggregator QA artifacts with provider counts and merge visibility
- A manual Ticketmaster smoke QA path that can write live report artifacts
- A file-backed curated/admin events provider behind `ENABLE_CURATED_PROVIDER`
- A community submission flow with in-memory moderation
- A deployment guide and environment safety check for production readiness

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
cmd /c npm run qa:aggregator
cmd /c npm run build
cmd /c npm run qa:ticketmaster
cmd /c npm run check:env
```

The GitHub Actions CI workflow runs `check:env`, `lint`, `typecheck`, `test`, `qa:aggregator`, and `build` in that order.

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

## Meetup provider

Enable the Meetup provider when you want to ingest social and community events from Meetup's token-based GraphQL API:

```bash
ENABLE_MEETUP_PROVIDER=true
MEETUP_ACCESS_TOKEN=your_real_token_here
npm run qa:aggregator
```

Notes:

- Mock-only mode still works when the flag is off or `MEETUP_ACCESS_TOKEN` is empty.
- `MEETUP_GRAPHQL_ENDPOINT` defaults to `https://api.meetup.com/gql` and can be overridden for local testing.
- The provider preserves the original Meetup event URL and source attribution on every normalized event.
- Tests use mocked GraphQL fixtures only; there is no OAuth login or refresh UI in this milestone.
- Aggregator QA shows Meetup provider counts, duplicate groups, warnings, and event source links when the provider is enabled.

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

## RSS/Atom provider

Enable the generic RSS provider when you want to ingest semi-structured public feeds that describe local events:

```bash
ENABLE_RSS_PROVIDER=true
RSS_SOURCE_URLS="https://example.com/feed.xml"
npm run qa:aggregator
```

Notes:

- Mock-only mode still works when `ENABLE_RSS_PROVIDER` is false or `RSS_SOURCE_URLS` is empty.
- The provider preserves the original item link on every event and skips items without a clear source URL.
- RSS items must expose a deterministic event date through explicit feed fields or clearly labeled content.
- `pubDate` and `updated` are treated as feed metadata, not as event dates.
- `RSS_SOURCE_URLS` can be a comma, semicolon, or newline separated list of feed URLs.

## City source presets

Enable the Cincinnati launch preset when you want the ICS and RSS adapters to load a curated local source bundle:

```bash
ENABLE_CITY_PRESETS=true
DEFAULT_CITY_PRESET="cincinnati"
npm run qa:aggregator
```

Notes:

- Mock-only mode still works when city presets are disabled.
- The preset currently ships with Cincinnati-specific source inventory entries, but the current URLs are placeholders or disabled until verified.
- The source page shows the active preset summary and the preset source bundle.
- See [docs/CITY_PRESETS.md](/C:/Users/nguye/Documents/EventScout/docs/CITY_PRESETS.md) for the current preset inventory.

## City preset validation

Run the city preset QA report when you want to see which Cincinnati sources are verified, placeholder, disabled, or needing manual review:

```bash
npm run qa:city-preset
```

Notes:

- The report is metadata-only by default and does not fetch remote URLs unless `CITY_PRESET_QA_LIVE_FETCH=true`.
- Live fetching is opt-in so broken or placeholder sources never become a surprise in normal development.
- The report is useful for deciding which preset entries should be kept, replaced, disabled, or promoted to verified status.
- See [docs/CITY_PRESETS.md](/C:/Users/nguye/Documents/EventScout/docs/CITY_PRESETS.md) for the current preset inventory and status labels.

## Admin moderation

Set `ADMIN_TOKEN` when you want to protect the curated source and moderation tools:

```bash
ADMIN_TOKEN="choose-a-long-random-token"
```

Then open the admin page with the matching query key:

```bash
/admin?key=choose-a-long-random-token
```

Notes:

- The admin page shows the moderation queue and trusted source allowlist.
- The moderation API accepts the token through the `x-admin-token` header or the page query key.
- When `ADMIN_TOKEN` is empty, the admin tools stay open for local development but fail closed in production.

## Curated admin events

Enable the curated provider when you want file-backed admin-approved events to flow through the same discovery pipeline:

```bash
ENABLE_CURATED_PROVIDER=true
CURATED_EVENTS_PATH="apps/web/data/curated-events.json"
npm run qa:aggregator
```

Notes:

- The provider is disabled by default.
- Approved records enter the public aggregator; pending, rejected, and suppressed records stay out of the public list.
- Invalid records are dropped with diagnostics instead of crashing the app.
- See [docs/CURATED_EVENTS.md](/C:/Users/nguye/Documents/EventScout/docs/CURATED_EVENTS.md) for the file format and QA details.

## Community submissions

Users can submit local events from `/submit` without creating accounts:

```bash
ENABLE_COMMUNITY_SUBMISSIONS_PROVIDER=true
```

Notes:

- New submissions are stored as `pending` first.
- Pending submissions do not appear in public discovery until an admin approves them.
- Approved submissions are converted into community events and enter the same aggregator pipeline as other sources.
- The moderation store is in-memory only and resets on process restart.
- See [docs/COMMUNITY_SUBMISSIONS.md](/C:/Users/nguye/Documents/EventScout/docs/COMMUNITY_SUBMISSIONS.md) for the flow, API contract, and limitations.

## Versioning

This repo uses Semantic Versioning with tags in the form `vMAJOR.MINOR.PATCH`.

- Current version: `0.13.1`
- Current release: M18.1 reconciliation
- Previous verified tag before this reconciliation: `v0.13.0`

- `PATCH`: fixes, hardening, test coverage, internal refactors
- `MINOR`: new features or milestone-sized capability additions
- `MAJOR`: breaking changes to contracts or structure

## Deployment

See [docs/DEPLOYMENT.md](/C:/Users/nguye/Documents/EventScout/docs/DEPLOYMENT.md) for local, staging, and production guidance, including health behavior, admin safety, source-run history, and QA artifact policy.

See [docs/SOURCE_RUN_HISTORY.md](/C:/Users/nguye/Documents/EventScout/docs/SOURCE_RUN_HISTORY.md) for the storage model and run-history API details.

## Next milestone

Implement M19 from [docs/MILESTONES.md](/C:/Users/nguye/Documents/EventScout/docs/MILESTONES.md): Source health alerts.

Not next: recommendations, personalization, UI redesign, Eventbrite, database migration, notifications, CAPTCHA, or production database adapters.
