# Packet: ARC-M1-REPAIR-1 In-memory idempotency store outside demo mode (M1 gate CR-1, CR-2)

Role: backend-engineer
Branch: `arc/ARC-M1-REPAIR-1-idempotency-fail-closed`, cut from `arc/main` at 602f00a. Work in your own worktree.
Written by the orchestrator on 2026-11-24.

## Read first
1. `AGENTS.md`, `CLAUDE.md`, `docs/arc/delivery/external-agents.md` (section 2, live integrations).
2. Your role prompt `docs/arc/delivery/external/roles/backend-engineer.md`.
3. `docs/arc/delivery/reviews/M1-review.md` (findings CR-1 and CR-2) and ticket ARC-M1-05 in `docs/arc/delivery/tickets/M1-durable-state-and-quotas.md`.
4. `src/job-idempotency.js` (`selectJobIdempotencyStore`, the class comment), `index.mjs` near line 122, `src/service-ports.js`, and the tests `test/job-idempotency.test.js`, `test/durable-job-idempotency*.test.js`, `test/firestore-idempotency-store.test.js`.

## Goal and acceptance criteria
- CR-1: when `USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY` is off, `selectJobIdempotencyStore` returns an `InMemoryIdempotencyStore` whenever `jobSheetPersistenceAvailable` is true. That does not require demo mode, so a live Cloud Run service with the flag off would silently use a per-instance store, which allows duplicate jobs across instances and is a local-only path in a product route. Outside demo mode, with the flag off, return no store and scope `"unavailable"` and make `/jobs` fail closed with 503 `SERVICE_UNAVAILABLE` and a plain message. The in-memory store stays only for unit tests and the offline demo mode (`demoMode`).
- CR-2: delete the stale first sentence of the comment at `index.mjs:122` ("Om's approved prototype contract keeps idempotency process-local") and make the comment say why, in one or two lines, in current terms. Trim the class comment in `src/job-idempotency.js:3-17` to why the in-memory store must not be used in production, and remove the outdated mention of a BigQuery row insert as a backend (CR-9).
- AC: a test fails if a non-demo service with the flag off gets an in-memory store; a test shows the demo mode and the unit-test path still work; `/api/status` still reports `durableIdempotencyConfigured` truthfully for each combination (flag on, flag off in demo mode, flag off outside demo mode).

## Dependencies already merged
ARC-M1-05 (`67602dc`), ARC-M1-22 (`fbd15d3`).

## Out of scope
SEC-1 and SEC-2 (next packet), any Arc routes, any cloud change.

## Checks before hand-back
`npm test` (the suite uses per-run ports; other sessions may run suites at the same time, so check `ps aux | grep "[n]ode --test"` first and never kill other processes), `node scripts/quality/check.mjs commits`. Report exact counts. Commit everything before reporting. If an existing assertion must change because behaviour changes, put it in its own commit with the reason in the body.

## Cloud needs
None.

## Review after the build
QA lead (fresh session); the security reviewer re-checks CR-1 because it closes a fail-closed gap.
