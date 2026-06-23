# Community Submissions

Event Scout supports public community event submissions that are reviewed before they are shown to everyone.

## Flow

1. A user submits an event through `/submit` or `POST /api/submissions`.
2. The app stores a pending submission in the in-memory submission store.
3. An admin reviews the item from `/admin` or `GET /api/admin/submissions`.
4. The admin can approve, reject, or suppress the submission.
5. Approved submissions are converted into curated/community event input and enter the same aggregator pipeline as other approved sources.

## Statuses

- `pending`: visible only in the moderation queue.
- `approved`: converted into a public community event.
- `rejected`: kept out of public discovery.
- `suppressed`: kept out of public discovery and treated as explicitly blocked.

## Safety rules

- Public submissions are untrusted input.
- Pending submissions never appear in public discovery.
- There is no CAPTCHA, spam scoring, or rate limiting in this milestone.
- There is no persistent moderation database yet.
- There is no user account or identity verification layer yet.

## Feature flag

Enable the provider with:

```env
ENABLE_COMMUNITY_SUBMISSIONS_PROVIDER="true"
```

The flag is disabled by default. When it is off, the submissions still exist for moderation but they do not enter the public aggregation pipeline.

## Admin auth

Set `ADMIN_TOKEN` before deploying anything that should be protected.

- When `ADMIN_TOKEN` is set, admin routes require the matching token.
- When `ADMIN_TOKEN` is empty, the admin tools stay open for local development.

## Limitation

The submission store is in-memory only. It resets when the process restarts.

## Next milestone

M16: Source health dashboard.

