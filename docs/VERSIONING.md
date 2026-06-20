# Versioning

Event Scout uses Semantic Versioning with Git tags in the form `vMAJOR.MINOR.PATCH`.

## Bump rules

- `PATCH`: bug fixes, hardening, tests, cleanup, internal refactors
- `MINOR`: new features, milestone-sized capability additions, new adapters
- `MAJOR`: breaking changes to contracts, schemas, or repo structure

## Release rule

Every completed update should:

1. Pass lint, typecheck, tests, and build
2. Be pushed to GitHub
3. Receive a Git tag for the released version

## Current baseline

The current baseline for the rebuilt and hardened app is `v0.2.0`.
