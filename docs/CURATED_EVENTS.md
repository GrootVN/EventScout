# Curated Events

Event Scout supports a file-backed curated source for admin-controlled events.

## Purpose

The curated provider is meant for trusted, manually reviewed event records that should flow through the same ingestion pipeline as every other source.

It does not replace the existing moderation queue. It simply gives admins a clean way to seed approved events into the public discovery pipeline while keeping source attribution intact.

## Enablement

Set these environment variables:

```env
ENABLE_CURATED_PROVIDER="true"
CURATED_EVENTS_PATH="apps/web/data/curated-events.json"
```

The provider is disabled by default.

## File format

`CURATED_EVENTS_PATH` should point to a JSON array of curated event records.

Required fields:

- `id`
- `title`
- `startDateTime`
- `city`
- `priceType`
- `sourceUrl`

Recommended fields:

- `sourceName`
- `sourceEventId`
- `venueName`
- `address`
- `region`
- `country`
- `categories`
- `interests`
- `confidence`
- `isNewcomerFriendly`
- `isSoloFriendly`

## Status behavior

- `approved` records enter the public aggregator.
- `pending`, `rejected`, and `suppressed` records are counted in QA, but they do not become public events.
- Missing `status` defaults to `approved`.

## Validation behavior

- Invalid JSON is reported in diagnostics and the provider returns no events.
- Invalid records are dropped individually with warnings.
- Missing file paths are treated as non-fatal errors.
- The provider never throws globally just because one record is bad.

## Current limitation

The curated source is file-backed only. There is no persistent CRUD admin editor yet.

## QA

Run the aggregator QA report after enabling the provider:

```bash
npm run qa:aggregator
```

The report will show curated load counts, status breakdowns, and duplicate groups involving curated events.

## Next step

M16: Source health dashboard.
