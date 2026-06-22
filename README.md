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
- A sources page showing enabled and planned providers
- Aggregator QA artifacts with provider counts and merge visibility

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
```

## Versioning

This repo uses Semantic Versioning with tags in the form `vMAJOR.MINOR.PATCH`.

- `PATCH`: fixes, hardening, test coverage, internal refactors
- `MINOR`: new features or milestone-sized capability additions
- `MAJOR`: breaking changes to contracts or structure

## Next milestone

Implement M10 from [docs/MILESTONES.md](/C:/Users/nguye/Documents/EventScout/docs/MILESTONES.md): polish and deployment readiness.
