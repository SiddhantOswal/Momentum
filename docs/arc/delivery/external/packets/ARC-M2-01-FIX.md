# Packet: ARC-M2-01-FIX QA findings on the Arc routes and stores

Role: backend-engineer
Branch: `arc/ARC-M2-01-arc-routes` (head 751a9f9), checked out in your worktree `/Users/siddhant/Developer/momentum-wt/ARC-M2-01`. You add fixes on top of it; you do not rebase or rewrite it.
Written by the orchestrator on 2026-11-24.

## Read first
`AGENTS.md`, `CLAUDE.md`, `docs/arc/delivery/external-agents.md` (section 2a: no network, you cannot commit, you cannot start local servers; hand back a `commit-plan.json`), your role prompt `docs/arc/delivery/external/roles/backend-engineer.md`, the ticket ARC-M2-01 in `docs/arc/delivery/tickets/M2-tool-registry-and-orchestration.md`, and the wire contract `docs/arc/delivery/06-arc-wire-contract.md` (the authority for every status, header and code below). Then the code: `src/arc/routes.js`, `src/google-cloud/firestore-arc-session-store.js`, `src/google-cloud/firestore-arc-task-run-store.js`, `index.mjs` (the Arc mount and the global limiter), `test/arc-routes.test.js`, `test/arc-mount-http.test.js`.

## QA findings to fix (an independent QA lead reviewed the branch; verdict NOT YET)
- **QA-1 (BLOCKING), `routes.js:226`.** The mounted app accepted a `sessionId` query key on run detail and turn detail (returned 200) and on turn submission (returned 409 `IN_PROGRESS`). All three must return 400 `VALIDATION_ERROR`, as the session and history list routes already do. A `sessionId` in the body or the query is rejected on every Arc route.
- **QA-2 (BLOCKING), `routes.js:138` and `index.mjs:192`.** The flag-off 404, the global 413 and both 429 responses omit `Cache-Control: no-store`. An oversized request against an exhausted bucket returns 429 before 413. With the stores unconfigured, 503 is returned before the origin and cookie checks the contract requires. Fix the headers, and the order of checks, to match the contract's rules for each response.
- **QA-3 (SHOULD-FIX), `routes.js:302` and `arc-routes.test.js:404`.** An in-progress turn read omits `Retry-After`. Removing `errorCode` from the turn view passes the existing tests, and so does removing the flag-off cache header. The socket mount test asserts only the status of the 429 responses, not the `RATE_LIMIT_EXCEEDED` body shape or the header. Add the header, and add tests that fail for each of these removals.
- **QA-4 (SHOULD-FIX), `firestore-arc-session-store.js:310`. Decided by the tech lead on 2026-11-24: keep the one extra read.** A history page of 20 reads 21 documents so the store knows whether another page exists, which is what the contract needs for `nextBefore: null` on the last page. Do not change the query. Amend the wire contract instead (`06-arc-wire-contract.md`, where it says at most 20 reads): a page of N items reads at most N + 1 documents, the extra one only to tell whether a next page exists, and it is never returned. Make that edit its own entry in the commit plan. Add a test that fails if the store reads more than N + 1 documents, and one that shows `nextBefore` is null exactly on the last page (a history of exactly 20 turns, and of 21).

## Acceptance criteria
Each finding fixed, with a test that fails before the fix and passes after (QA-4 is a contract wording change plus tests) (tests that need a server are written but cannot run in your sandbox: say so and make them in-process where the code allows it). No existing assertion weakened. The contract stays the authority; if a finding conflicts with it, still fix every other finding and report the conflict, rather than stopping the whole packet.

## Out of scope
The turn runner, answer blocks, events and resume (M2-03, M2-05, M2-06).

## Hand-back
The format in `external-agents.md` section 4, with the commit plan. List which tests you could and could not run.
