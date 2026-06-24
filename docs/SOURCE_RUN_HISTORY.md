# Source Run History

M18 adds a lightweight source-run history layer so Event Scout can keep summary records of aggregator and health runs over time.

Current status: M18 is complete. M18.1 reconciles docs, release, provider, and test inventory. M19 source health alerts is next.

## What is stored

Each run record stores summaries only:

- Run type and app version
- Start/finish timestamps and duration
- Overall success/warning/error status
- Provider-level summary counts and statuses
- Aggregator QA counts, duplicate-group counts, and provider diagnostics summaries
- Safe metadata such as city preset id, generated-by label, and short notes

The store does not persist full event payloads, raw provider responses, secrets, or auth tokens.

## What is intentionally not stored

- Raw event data
- Provider API keys or tokens
- Full moderation records
- User account data
- Spam or trust scoring data

## Storage model

- Default path: `.eventscout/source-run-history.json`
- Default retention limit: `100` runs
- Controlled by:
  - `ENABLE_SOURCE_RUN_HISTORY`
  - `SOURCE_RUN_HISTORY_PATH`
  - `SOURCE_RUN_HISTORY_LIMIT`

The store is file-backed in local development, test, and QA workflows. If file reads or writes fail, the app falls back to in-memory history and keeps running.

## Gitignore policy

Generated run-history files are ignored by default:

- `.eventscout/`
- `source-run-history.json`
- `*.source-runs.json`

Do not commit generated history files.

## Recording runs

Aggregator QA writes a run record automatically when `npm run qa:aggregator` produces its report. The admin source-run API can also record a health snapshot manually.

The builder logic lives in:

- `apps/web/lib/sources/runHistoryBuilder.ts`
- `apps/web/lib/sources/runHistoryStore.ts`

## API contract

Admin history is available at `GET /api/admin/source-runs`.

Public health summaries may include:

- `latestRunAt`
- `latestRunStatus`
- `runHistoryEnabled`

Detailed provider history stays behind admin authorization in production.

## Dashboard behavior

The `/health` page shows:

- Latest run summary
- Recent runs
- Provider trend summaries when detailed health is authorized
- Stale-provider summaries when detailed health is authorized

Public access stays summary-only.

## Why this exists

This milestone is the historical foundation for M19 alerts. It makes trends visible without introducing alerting, cron jobs, or persistent production monitoring infrastructure yet.
