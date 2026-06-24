# Event Scout Milestones

Current stage: post-M18 source reliability and operations layer. M18 source-run history is complete, this release completes M18.1 reconciliation, and M19 is next.

Next milestone: M19: Source health alerts.

Not next: recommendations, personalization, UI redesign, Eventbrite, database migration, notifications, CAPTCHA, or production database adapters.

## Canonical Roadmap

| Milestone | Status | Version / tag | Key files and features | Known limitations | Next action |
| --- | --- | --- | --- | --- | --- |
| M1-M8: Base EventScout app and aggregator foundation | complete | v0.3.0 through v0.8.0 lineage | `apps/web/app`, `apps/web/lib/events/*`, `apps/web/lib/sources/provider.ts`, `apps/web/lib/sources/registry.ts`, mock events, filters, ranking, classification, dedupe, source attribution | Early milestones are summarized because later milestones consolidated the base app | Maintain through regression tests |
| M8.5: Aggregator hardening | complete | covered before v0.9.0 | `apps/web/lib/events/service.ts`, provider failure handling, normalized aggregation path | No separate milestone doc existed before reconciliation | Maintain through scout and QA tests |
| M8.6: Visual aggregator QA report | complete | v0.9.0 lineage | `apps/web/lib/events/aggregatorQa.ts`, `Scripts/qa-aggregator.test.ts`, `vitest.qa.config.ts`, `qa-results/` output | Generated reports are ignored; sanitized sample lives under `docs/examples/` | Keep CI QA gate passing |
| M8.7: Cross-provider mock aggregation | complete | v0.9.0 lineage | `mockProvider`, `communityMockProvider`, dedupe/source preservation tests | Mock-only duplicate coverage is intentional | Maintain default QA coverage |
| M9: Ticketmaster provider | complete | v0.10.0 lineage | `ticketmasterProvider.ts`, Ticketmaster normalization, registry/env flags, mocked API tests | Disabled by default and requires `TICKETMASTER_API_KEY` | Keep live smoke manual only |
| M9.1: Ticketmaster live smoke QA | complete | v0.10.0 lineage | `Scripts/qa-ticketmaster.cjs`, `ticketmasterLiveQa.ts`, live report artifact policy | Live smoke is manual and not required in CI | Run only with real key when needed |
| M10: Generic ICS provider | complete | v0.11.0 lineage | `icsProvider.ts`, `icsParser.ts`, `apps/web/config/ics-sources.ts`, ICS fixtures/tests | Recurring events are skipped instead of expanded | Add real sources through presets |
| M11: Generic RSS provider | complete | v0.12.0 lineage | `rssProvider.ts`, `rssParser.ts`, `apps/web/config/rss-sources.ts`, RSS fixtures/tests | Requires explicit event dates; feed dates are metadata only | Add verified feeds through presets |
| M12: Local city source preset pack | complete | v0.12.1 lineage | `apps/web/config/cities/*`, `localPresetProvider.ts`, sources page | Cincinnati entries include placeholders/disabled sources | Promote sources after validation |
| M12.1: Real city preset validation | complete | v0.12.1 lineage | `Scripts/qa-city-preset.cjs`, `cityPresetQa.ts`, `docs/CITY_PRESETS.md` | Live validation is opt-in | Keep metadata current |
| M13: Meetup provider | complete | v0.13.0 lineage | `meetupProvider.ts`, Meetup fixtures/tests, registry/env flags | No OAuth or token refresh UI; no live smoke QA required | Keep fixture tests and optional manual validation |
| M14: Admin moderation and trusted-source controls | complete | v0.13.0 lineage | `/admin`, `admin-auth.ts`, trusted source store/API, flagged suppression API | Local admin can be open when `ADMIN_TOKEN` is empty; production fails closed | Maintain admin auth tests |
| M14.1: Curated/admin event ingestion provider | complete | v0.13.0 lineage | `curatedProvider.ts`, `curatedSchema.ts`, `apps/web/data/curated-events.json`, `docs/CURATED_EVENTS.md` | File-backed only; no persistent CRUD editor | Keep approved-only publishing tests |
| M15: Community submissions | complete | v0.13.0 lineage | `/submit`, `/api/submissions`, admin submissions API, `communitySubmissionProvider.ts`, submission store/schema | In-memory moderation only; no CAPTCHA, rate limiting, accounts, or persistent DB | Add persistence only in a future database milestone |
| M16: Source health dashboard | complete | v0.13.0 lineage | `/health`, `/api/health`, `source health` logic, public/admin visibility rules | Health is snapshot/reporting only; no alerts yet | M19 adds alerts |
| M17: Deployment and production safety hardening | complete | v0.13.0 lineage | `Scripts/check-env.cjs`, `env.ts`, `docs/DEPLOYMENT.md`, QA artifact policy | Security hardening is focused on config gates, not a full security subsystem | Keep `check:env` in CI |
| M17.1: CI aggregator QA gate | complete | v0.13.0 lineage | CI workflow tests, `tests/unit/ci-workflow.test.ts`, `npm run qa:aggregator` | Live provider smoke remains outside CI | Keep generated artifacts ignored |
| M18: Source run persistence/history | complete | v0.13.0 | `runHistoryStore.ts`, `runHistoryBuilder.ts`, `/api/admin/source-runs`, `/health`, `docs/SOURCE_RUN_HISTORY.md` | File-backed summary storage; no production monitoring service | Use as foundation for M19 |
| M18.1: Roadmap, release, and test inventory reconciliation | complete | v0.13.1 | `docs/CURRENT_STATE.md`, this milestone table, aligned README/PLAN/source docs, version metadata | No feature work by design | Tag and push this release after checks |
| M19: Source health alerts | next | not tagged | Planned alerting on top of source health and run history | Not implemented in M18.1 | Define alert rules, channels, and non-CI live behavior |

## Verified Test Inventory

Aggregator foundation:

- Filtering: `tests/unit/filters.test.ts`
- Ranking: `tests/unit/ranking.test.ts`
- Classification: `tests/unit/classifyInterests.test.ts`
- Normalization: `tests/unit/normalize.test.ts`
- Deduplication: `tests/unit/dedupe.test.ts`
- Provider registry: `tests/unit/provider-registry.test.ts`
- Scout aggregation: `tests/unit/scout-events.test.ts`
- Events API: `tests/api/events-api.test.ts`
- Aggregator QA: `tests/unit/aggregator-qa.test.ts`, `Scripts/qa-aggregator.test.ts`

Real and source providers:

- Ticketmaster provider and normalization: `tests/unit/ticketmaster-provider.test.ts`, `tests/unit/ticketmaster-normalize.test.ts`
- Ticketmaster live QA artifact path: `tests/unit/ticketmaster-live-qa.test.ts`
- ICS provider and normalization: `tests/unit/ics-provider.test.ts`, `tests/unit/ics-normalize.test.ts`
- RSS provider and normalization: `tests/unit/rss-provider.test.ts`, `tests/unit/rss-normalize.test.ts`
- Meetup provider and normalization: `tests/unit/meetup-provider.test.ts`, `tests/unit/meetup-normalize.test.ts`

Post-M14 features:

- Admin auth: `tests/unit/admin-auth.test.ts`
- Admin flagged/suppression API: `tests/api/admin-flagged.test.ts`, `tests/unit/suppression.test.ts`
- Trusted sources store/API: `tests/unit/trusted-sources-store.test.ts`, `tests/api/admin-trusted-sources.test.ts`
- Curated schema/provider/normalization: `tests/unit/curated-schema.test.ts`, `tests/unit/curated-provider.test.ts`, `tests/unit/curated-normalize.test.ts`
- Community submissions schema/API/provider: `tests/unit/submission-schema.test.ts`, `tests/unit/submission-store.test.ts`, `tests/unit/submission-to-curated.test.ts`, `tests/api/submissions-api.test.ts`, `tests/api/admin-submissions.test.ts`, `tests/unit/community-submission-provider.test.ts`
- Source health dashboard logic/API: `tests/unit/source-health.test.ts`, `tests/api/health.test.ts`
- Source-run history store/stats/builder/API: `tests/unit/source-run-history-store.test.ts`, `tests/unit/source-run-history-stats.test.ts`, `tests/unit/source-run-history-builder.test.ts`, `tests/api/admin-source-runs.test.ts`
- Production env checks: `tests/unit/env-safety.test.ts`
- QA artifact policy and CI gate: `tests/unit/qa-artifact-policy.test.ts`, `tests/unit/ci-workflow.test.ts`

## Release Notes

- Current root version: `0.13.1`
- Current web app version: `0.13.1`
- Matching release tag for this reconciliation release: `v0.13.1` after final checks, commit, tag, and push
- Highest verified pre-reconciliation tag: `v0.13.0`
