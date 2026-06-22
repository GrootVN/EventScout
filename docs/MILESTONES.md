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

## M10: Polish and deployment

Status: [ ]

### Acceptance criteria

- Mobile layout is clean.
- Loading, error, and empty states are polished.
- README explains setup.
- .env.example is complete.
- App can be deployed.
