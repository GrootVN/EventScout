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

The current baseline for the post-M18 source reliability and operations layer is `v0.13.1`.

The previous verified tag before M18.1 reconciliation was `v0.13.0`. M18.1 is a patch-level documentation, release, and test-inventory reconciliation milestone.
