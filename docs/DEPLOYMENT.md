# Deployment Guide

Event Scout is easiest to run locally with mock data, but production should fail closed for admin access and keep sample data disabled unless a developer explicitly opts in.

## Local Development

1. Install dependencies.
2. Copy `.env.example` to `.env.local`.
3. Run `cmd /c npm run dev`.

Local defaults:

- Mock providers stay on.
- `ADMIN_TOKEN` is optional for convenience.
- Sample submissions and sample trusted sources stay off unless explicitly enabled.
- `/api/health` returns a public summary by default.
- `/health` shows detailed diagnostics in development and test mode.

Helpful commands:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run qa:aggregator`
- `npm run build`
- `npm run check:env`
- `npm run check:env:production` for a manual production-readiness gate after secrets are set

CI runs `check:env`, `lint`, `typecheck`, `test`, `qa:aggregator`, and `build`.

## Production

Required environment variables:

- `ADMIN_TOKEN`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_DEFAULT_CITY`
- `NEXT_PUBLIC_DEFAULT_REGION`
- `NEXT_PUBLIC_DEFAULT_COUNTRY`

Provider flags and credentials should only be enabled together when the provider is intentionally deployed:

- `ENABLE_TICKETMASTER_PROVIDER` with `TICKETMASTER_API_KEY`
- `ENABLE_MEETUP_PROVIDER` with `MEETUP_ACCESS_TOKEN`
- `ENABLE_ICS_PROVIDER` with `ICS_SOURCE_URLS`
- `ENABLE_RSS_PROVIDER` with `RSS_SOURCE_URLS`
- `ENABLE_CURATED_PROVIDER` with `CURATED_EVENTS_PATH`
- `ENABLE_COMMUNITY_SUBMISSIONS_PROVIDER` for moderation-driven community events

Production safety defaults:

- Admin access fails closed when `ADMIN_TOKEN` is missing.
- Sample submissions must stay disabled.
- Sample trusted sources must stay disabled.
- Detailed health stays summarized unless admin authorization is provided and detailed health is explicitly enabled.
- Generated QA reports are ignored and should not be committed.
- `npm run check:env:production` is expected to fail until production secrets are configured.

## Health Behavior

- `GET /api/health` returns a public summary by default.
- Detailed provider diagnostics are available in development/test mode.
- In production, detailed health requires admin authorization and `ENABLE_DETAILED_HEALTH=true`.
- No secret values are exposed in either mode.

## QA Artifact Policy

- Generated reports in `qa-results/*.html` and `qa-results/*.json` are ignored.
- Sanitized samples live under `docs/examples/`.
- Do not commit live provider QA output.

## Deployment Checklist

- [ ] `ADMIN_TOKEN` set
- [ ] sample submissions disabled
- [ ] sample trusted sources reviewed and disabled if not needed
- [ ] provider keys configured only when provider is enabled
- [ ] live QA reports not committed
- [ ] health endpoint checked
- [ ] `npm run check:env` passes
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] `npm run qa:aggregator` passes

## Next Step

M18: Source run persistence/history
