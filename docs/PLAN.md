# Event Scout Plan

## Current state

The repo has been refocused around a newcomer-first discovery experience with:

- A canonical event model
- Source-provider adapters
- Mock-data-first browsing
- Cross-provider mock aggregation with intentional duplicate coverage
- Pure filters, dedupe, ranking, and classification helpers
- Source transparency in the UI and QA reports
- A real Ticketmaster adapter behind `ENABLE_TICKETMASTER_PROVIDER`
- A token-based Meetup adapter behind `ENABLE_MEETUP_PROVIDER`
- A generic ICS calendar provider behind `ENABLE_ICS_PROVIDER`
- A generic RSS/Atom provider behind `ENABLE_RSS_PROVIDER`
- A Cincinnati city preset pack behind `ENABLE_CITY_PRESETS`
- A Cincinnati city preset validation report behind `npm run qa:city-preset`
- A manual Ticketmaster live smoke QA script for real-key validation

## Next milestone

M14: Curated/admin source provider.
