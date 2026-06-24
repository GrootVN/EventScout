# Event Scout Milestones

## M1: Project scaffold

Status: [x]

### Acceptance criteria

- Next.js TypeScript app runs locally.
- Basic layout exists.
- Homepage renders.
- CI workflow exists.

### Required checks

- npm run lint
- npm run typecheck
- npm run build

---

## M2: Event data model and mock seed data

Status: [x]

### Acceptance criteria

- Shared Event type exists.
- Mock provider returns at least 30 events.
- Events include title, description, start time, end time, venue, city, category, interests, price, source name, and source URL.
- App works without external API keys.

### Required tests

- normalize.test.ts
- mockProvider test

---

## M3: Browse and filter events

Status: [x]

### Acceptance criteria

- Homepage shows event cards.
- User can filter by city.
- User can filter by date range.
- User can filter by interest.
- User can filter by price.
- Empty state appears when no events match.
- URL query params reflect filters.

### Required tests

- filters.test.ts
- event-discovery.spec.ts

---

## M4: Event detail and source attribution

Status: [x]

### Acceptance criteria

- Event detail page exists.
- Original source link is visible.
- Source badge is visible.
- Event metadata is displayed clearly.
- Missing optional fields do not crash the page.

### Required tests

- source-attribution.spec.ts

---

## M5: Saved events

Status: [x]

### Acceptance criteria

- User can save event.
- User can unsave event.
- Saved events page exists.
- Saved state persists locally.
- Missing/deleted event IDs are handled safely.

### Required tests

- saved-events behavior coverage

---

## M6: Source provider architecture

Status: [x]

### Acceptance criteria

- Provider interface exists.
- Provider registry exists.
- Mock provider implements interface.
- External providers can be added without changing UI code.
- Scout API can fetch from enabled providers.

### Required tests

- provider registry test
- normalize.test.ts

---

## M7: Deduplication

Status: [x]

### Acceptance criteria

- Duplicate events from different sources can be merged.
- Original source list is preserved.
- Similar title/date/venue events are detected.
- Dedupe confidence is testable.

### Required tests

- dedupe.test.ts
- similar-title dedupe coverage

---

## M8: Interest classification and ranking

Status: [x]

### Acceptance criteria

- Events receive interest tags.
- User selected interests affect ranking.
- Ranking is deterministic and testable.
- Newcomer-friendly and free/cheap boosts exist.

### Required tests

- classifyInterests.test.ts
- ranking.test.ts

---

## M8.6: Aggregator visual QA report

Status: [x]

### Acceptance criteria

- `npm run qa:aggregator` generates HTML and JSON artifacts under `qa-results/`.
- Report shows enabled providers, pipeline counts, duplicate groups, event rows, and warnings/errors.
- Report uses the current mock-backed aggregation flow and does not introduce real providers or recommendation logic.

### Required checks

- npm run qa:aggregator

---

## M8.7: Cross-provider mock aggregation

Status: [x]

### Acceptance criteria

- A second mock provider can be enabled independently with `ENABLE_COMMUNITY_MOCK_PROVIDER`.
- Aggregation merges intentional cross-provider duplicates while preserving all original source metadata.
- Cross-provider mock tests cover dedupe behavior, provider registry behavior, scout aggregation, and QA report visibility.
- `npm run qa:aggregator` shows provider-level pipeline counts and duplicate groups with visible source links.

### Required checks

- npm run lint
- npm run typecheck
- npm test
- npm run build
- npm run qa:aggregator

---

## M9: First real source adapter

Status: [x]

### Acceptance criteria

- One real source provider is implemented.
- Ticketmaster is disabled by default and stays off when the API key is missing.
- Provider failures do not crash the app.
- Raw events are normalized into the shared Event model.
- QA output includes Ticketmaster when the provider is enabled.

### Required tests

- provider test with mocked API response
- provider disabled/missing-key coverage
- Ticketmaster normalization coverage
- aggregation and QA coverage with mocked Ticketmaster data

---

## M9.1: Live Ticketmaster smoke QA

Status: [x]

### Acceptance criteria

- A manual smoke QA path can run Ticketmaster with a real key.
- The script exits cleanly when Ticketmaster is not configured.
- Live QA artifacts are written to `qa-results/` and kept out of normal commits.
- The report shows query input, provider status, counts, warnings/errors, and event source details.

### Required checks

- npm run qa:ticketmaster

---

## M10: Generic ICS calendar provider

Status: [x]

### Acceptance criteria

- ICS feeds can be enabled behind `ENABLE_ICS_PROVIDER` and `ICS_SOURCE_URLS`.
- Public calendar events normalize into the shared ScoutEvent shape with original source attribution.
- Recurring ICS events are skipped with warnings instead of being expanded into many instances.
- Mock-only mode still works when no ICS configuration is present.
- README and `.env.example` explain setup and manual QA.

### Required checks

- npm run lint
- npm run typecheck
- npm test
- npm run build
- npm run qa:aggregator

### Next recommended milestone

- M11: Generic RSS provider

---

## M11: Generic RSS provider

Status: [x]

### Acceptance criteria

- RSS and Atom feeds can be enabled behind `ENABLE_RSS_PROVIDER` and `RSS_SOURCE_URLS`.
- Semi-structured RSS items normalize into the shared ScoutEvent shape with original source attribution.
- Items without a clear source URL or event date are skipped with warnings instead of being silently misclassified.
- Mock-only mode still works when no RSS configuration is present.
- README and `.env.example` explain setup and manual QA.

### Required checks

- npm run lint
- npm run typecheck
- npm test
- npm run build
- npm run qa:aggregator

### Next recommended milestone

- M12: Local city source preset pack

---

## M12: Local city source preset pack

Status: [x]

### Acceptance criteria

- A local city preset can bundle ICS and RSS source configs for Cincinnati.
- City presets stay disabled by default and do not break mock-only mode.
- The preset contains at least five configured local sources, including disabled examples.
- QA shows the active preset summary alongside provider counts.
- The source page surfaces the active preset bundle and its source inventory.

### Required checks

- npm run lint
- npm run typecheck
- npm test
- npm run build
- npm run qa:aggregator

### Next recommended milestone

- M12.1: Real Cincinnati source validation

---

## M12.1: Real Cincinnati source validation

Status: [x]

### Acceptance criteria

- Cincinnati preset source entries expose clear status metadata.
- Placeholder sources are disabled by default.
- A city-preset QA report can be generated in metadata-only mode.
- Live validation is opt-in and does not run unless explicitly enabled.
- The report classifies sources as verified, placeholder, disabled, or needs review.

### Required checks

- npm run lint
- npm run typecheck
- npm test
- npm run build
- npm run qa:aggregator
- npm run qa:city-preset

### Next recommended milestone

- M13: Meetup provider

---

## M13: Meetup provider

Status: [x]

### Acceptance criteria

- Meetup is disabled by default and only enables when both the feature flag and access token are present.
- Meetup GraphQL responses normalize into the shared ScoutEvent shape with original source attribution preserved.
- Missing token, malformed records, GraphQL errors, and network failures do not crash aggregation.
- Mock-only mode still works when Meetup is disabled or misconfigured.
- Aggregator QA reports show Meetup provider counts, duplicate groups, and source links.

### Required checks

- npm run lint
- npm run typecheck
- npm test
- npm run build
- npm run qa:aggregator

### Next recommended milestone

- M14: Curated/admin source provider

---

## M14: Curated/admin source provider

Status: [x]

### Acceptance criteria

- Admin access is gated by `ADMIN_TOKEN` when configured.
- The `/admin` page shows a moderation queue and a trusted source allowlist.
- Trusted sources can be listed, created, and deactivated through the admin API.
- Flagged events can be listed and suppressed through the admin API.
- Mock-only mode still works when the admin token is not set.

### Required checks

- npm run lint
- npm run typecheck
- npm test
- npm run build
- npm run qa:aggregator

### Next recommended milestone

- M15: Community submissions

---

## M15: Community submissions

Status: [x]

### Acceptance criteria

- Public submissions create pending records before any moderation decision.
- Approved submissions enter the public aggregator pipeline.
- Rejected and suppressed submissions stay out of discovery.
- The admin moderation queue can review pending submissions.
- The public submission page explains that items stay hidden until approved.
- The submission store is in-memory only for this milestone.
- QA shows approved community submissions when the provider is enabled.

### Required checks

- npm run lint
- npm run typecheck
- npm test
- npm run build
- npm run qa:aggregator

### Next recommended milestone

- M16: Source health dashboard

---

## M16: Source health dashboard

Status: [x]

### Acceptance criteria

- A source health dashboard summarizes provider readiness in one place.
- The dashboard distinguishes healthy, warning, needs-config, and disabled providers.
- Provider diagnostics remain available to the dashboard without breaking aggregation.
- The `/health` page and `/api/health` route expose the same source health snapshot.
- Mock-only mode still works when health visibility is queried.

### Required checks

- npm run lint
- npm run typecheck
- npm test
- npm run build
- npm run qa:aggregator

### Next recommended milestone

- M17: Deployment and production safety hardening

---

## M14.1: Curated event ingestion provider

Status: [x]

### Acceptance criteria

- A file-backed curated provider can be enabled behind `ENABLE_CURATED_PROVIDER`.
- Curated records validate strictly before entering the public pipeline.
- Only approved curated records become public events.
- Pending, rejected, and suppressed curated records are counted in QA but do not enter discovery.
- Aggregator QA reports curated load/status diagnostics and curated duplicate groups.
- Mock-only mode still works when curated ingestion is disabled or misconfigured.

### Required checks

- npm run lint
- npm run typecheck
- npm test
- npm run build
- npm run qa:aggregator

### Next recommended milestone

- M15: Community submissions

---

## M17: Deployment and production safety hardening

Status: [x]

### Acceptance criteria

- Admin access fails closed in production when `ADMIN_TOKEN` is missing.
- Sample submissions and sample trusted sources stay out of production by default.
- `/api/health` returns a public summary by default and hides detailed diagnostics unless authorized.
- QA artifacts are ignored instead of being committed as live generated reports.
- Deployment guidance explains local, staging, and production behavior clearly.

### Required checks

- npm run lint
- npm run typecheck
- npm test
- npm run build
- npm run qa:aggregator
- npm run check:env

### Next recommended milestone

- M18: Source run persistence/history

---

## M17.1: CI aggregator QA gate

Status: [x]

### Acceptance criteria

- GitHub Actions runs `npm run qa:aggregator` on each validation pass.
- Generated QA artifacts remain ignored and do not dirty the repository.
- CI order stays consistent with the deployment-safety workflow.

### Required checks

- npm run check:env
- npm run lint
- npm run typecheck
- npm test
- npm run qa:aggregator
- npm run build

### Next recommended milestone

- M18: Source run persistence/history

---

## M18: Source run persistence/history

Status: [x]

### Acceptance criteria

- Aggregator QA appends source-run summaries to a lightweight history store.
- The history store keeps summaries only and does not persist secrets or raw event payloads.
- The `/health` page shows recent run history and provider trend summaries.
- The admin source-run API returns history summaries behind admin authorization.
- The store is file-backed by default and falls back safely if filesystem writes fail.

### Required checks

- npm run check:env
- npm run lint
- npm run typecheck
- npm test
- npm run qa:aggregator
- npm run build

### Next recommended milestone

- M19: Source health alerts
