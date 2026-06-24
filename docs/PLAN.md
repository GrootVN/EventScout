# Event Scout Plan

## Current state

Current stage: source reliability and operations layer. M19 source health alerts are implemented as deterministic in-app/API/QA visibility.

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
- A curated/admin source allowlist and moderation queue behind `/admin`
- A file-backed curated admin events provider behind `ENABLE_CURATED_PROVIDER`
- A public community submission flow behind `/submit` and `/api/submissions`
- A source health dashboard behind `/health` and `/api/health`
- Source-run history for QA and health snapshots behind the run-history store and admin API
- Source health alerts behind `/health`, `/api/admin/source-alerts`, and aggregator QA summary output
- A canonical current-state inventory in `docs/CURRENT_STATE.md`
- Production safety hardening for admin access, sample data, health visibility, and QA artifact policy
- CI now runs `check:env`, `lint`, `typecheck`, `test`, `qa:aggregator`, and `build`

## Next milestone

Real source quality validation, likely Cincinnati source verification/live source validation.

## Not next

Recommendations, personalization, UI redesign, Eventbrite, database migration, email/Slack/webhook notifications, alert acknowledgement, CAPTCHA, full anti-spam work, and production database adapters are deferred.
