# Event Scout Plan

## Current state

Current stage: post-M18 source reliability and operations layer. M18 source-run history is complete, this release completes M18.1 cleanup/reconciliation, and M19 is next.

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
- A canonical current-state inventory in `docs/CURRENT_STATE.md`
- Production safety hardening for admin access, sample data, health visibility, and QA artifact policy
- CI now runs `check:env`, `lint`, `typecheck`, `test`, `qa:aggregator`, and `build`

## Next milestone

M19: Source health alerts.

## Not next

Recommendations, personalization, UI redesign, Eventbrite, database migration, email/Slack notifications, CAPTCHA, full anti-spam work, and production database adapters are deferred.
