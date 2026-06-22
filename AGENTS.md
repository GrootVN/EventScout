# AGENTS.md

You are Codex working on Event Scout.

Event Scout is a local event discovery web app for people who are new to town. The app scouts events from many sources, normalizes them into one place, lets users filter by interests, and always shows the original event source.

## Product goal

Help a user answer:

"What is happening near me that I would actually care about?"

The app should prioritize:
- Newcomer-friendly discovery
- Interest-based filtering
- Source transparency
- Clean local browsing
- Trustworthy event data

## Engineering rules

- Work one milestone at a time.
- Do not make giant unrelated changes.
- Do not hardcode API keys.
- Use environment variables for secrets.
- Every event must preserve its original source URL.
- Every provider must implement the shared source provider interface.
- The app must work with mock data even when no external API keys exist.
- All filtering logic should be testable as pure functions.
- All deduplication logic should be testable as pure functions.
- All ranking logic should be testable as pure functions.
- Never claim a milestone is complete unless lint, typecheck, tests, and build pass.
- Every completed update must be pushed to GitHub.
- Every pushed update must get a semantic version tag.

## Versioning rules

Use Semantic Versioning with `vMAJOR.MINOR.PATCH`.

- Bump `PATCH` for fixes, tests, refactors, and hardening that do not change the intended product surface.
- Bump `MINOR` for new user-facing features, milestone-sized additions, or new provider support.
- Bump `MAJOR` only for breaking changes to APIs, data contracts, or repo structure.
- Update versioned files before tagging and pushing.

## Required commands

Before finishing any task, run:

```bash
cmd /c npm run lint
cmd /c npm run typecheck
cmd /c npm test
cmd /c npm run build
```

## Required handoff format

At the end of every task, report:

- Milestone completed
- Summary of changes
- Files changed
- Tests/checks run
- Known limitations
- Next recommended milestone
