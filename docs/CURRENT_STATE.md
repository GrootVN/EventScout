# Current State

Current stage: source reliability and operations layer. M19 source health alerts are implemented as deterministic in-app/API/QA visibility.

Next recommended milestone: real source quality validation, likely Cincinnati source verification/live source validation.

Not next: recommendations, personalization, UI redesign, Eventbrite, database migration, email or Slack notifications, CAPTCHA, full anti-spam work, or a production database adapter.

## Version And Tags

- Root package version: `0.13.1`
- Web package version: `0.13.1`
- Package lock root and web versions: `0.13.1`
- Highest verified pre-reconciliation Git tag: `v0.13.0`
- Release tag for this milestone: `v0.13.1`

## Provider Inventory

| Provider | Source ID | Feature flag | Default state | Credentials required | Test mode | Aggregator QA |
| --- | --- | --- | --- | --- | --- | --- |
| Mock provider | `mock` | `ENABLE_MOCK_PROVIDER` | enabled | no | unit and QA | yes |
| Community mock provider | `community-mock` | `ENABLE_COMMUNITY_MOCK_PROVIDER` | enabled | no | unit and QA | yes |
| Ticketmaster provider | `ticketmaster` | `ENABLE_TICKETMASTER_PROVIDER` | disabled | `TICKETMASTER_API_KEY` | fixture-tested plus optional manual live smoke | yes when enabled |
| ICS provider | `ics` | `ENABLE_ICS_PROVIDER` | disabled | no secret; requires `ICS_SOURCE_URLS` | fixture-tested | yes when enabled and configured |
| RSS provider | `rss` | `ENABLE_RSS_PROVIDER` | disabled | no secret; requires `RSS_SOURCE_URLS` | fixture-tested | yes when enabled and configured |
| Meetup provider | `meetup` | `ENABLE_MEETUP_PROVIDER` | disabled | `MEETUP_ACCESS_TOKEN` | fixture-tested only | yes when enabled |
| Curated/admin provider | `curated` | `ENABLE_CURATED_PROVIDER` | disabled | no secret; requires curated JSON path to emit events | fixture-tested | yes when enabled |
| Community submissions provider | `community-submissions` | `ENABLE_COMMUNITY_SUBMISSIONS_PROVIDER` | disabled | no provider secret; admin moderation protected by `ADMIN_TOKEN` when configured | unit/API tested | yes when enabled |
| Website placeholder provider | `website` | `ENABLE_WEBSITE_PROVIDER` | disabled | no | placeholder only | yes when enabled, currently emits no events |
| Social lead placeholder provider | `social` | `ENABLE_SOCIAL_LEADS` | disabled | no | placeholder only | yes when enabled, currently emits no events |

Eventbrite remains a future candidate provider. It is not implemented in the provider registry.

## What Is Confirmed Complete

- Newcomer-first mock browsing works without external API keys.
- Every provider uses the shared source provider interface and preserves source URL attribution.
- Filtering, ranking, normalization, dedupe, provider registry, scout aggregation, events API, and aggregator QA are covered by pure/unit/API tests.
- Ticketmaster, ICS, RSS, Meetup, curated/admin events, community submissions, source health, source-run history, production safety, and QA artifact policy have visible tests.
- Source health alerts evaluate provider configuration, runtime streaks, freshness, data quality, and production safety signals.
- Alert summaries are visible in `/health` and aggregator QA; detailed alert data is admin-only through `/api/admin/source-alerts` or detailed health mode.
- Generated QA artifacts and generated source-run history files are ignored by default.
- Production safety checks cover `ADMIN_TOKEN`, sample data gates, detailed health visibility, optional live provider config warnings, and local/mock behavior.

## Partial Or Deferred

- City preset URLs include placeholder or disabled entries until real-source validation promotes them.
- Ticketmaster live smoke QA is manual and not part of CI.
- Meetup is fixture-tested only; there is no live smoke QA or OAuth/token refresh UI.
- Curated events are file-backed only.
- Community submissions are in-memory only and have no CAPTCHA, rate limiting, account system, or persistent moderation database.
- Source alerts are visibility-only; email, Slack, webhooks, alert acknowledgement, and database-backed alert history are future work.
- Eventbrite is not implemented.

## Standard Checks

Use these commands before claiming a milestone complete:

```bash
cmd /c npm run check:env
cmd /c npm run lint
cmd /c npm run typecheck
cmd /c npm test
cmd /c npm run qa:aggregator
cmd /c npm run build
```
