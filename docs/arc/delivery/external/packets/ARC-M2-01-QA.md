# Review packet: ARC-M2-01 Arc routes, session and task-run stores (QA lead)

Role: qa-lead (fresh session; you did not build this).
Branch under review: `arc/ARC-M2-01-arc-routes` (head: last commit "Mount the Arc routes in the server"), built on `arc/main` at the ARC-M1-10 merge (`6b09301`). Review it in a detached scratch worktree; never edit the branch.
Written by the orchestrator on 2026-11-24.

## Read first
`AGENTS.md`, `CLAUDE.md` (section 5.2), your role prompt `docs/arc/delivery/external/roles/qa-lead.md`, `docs/arc/delivery/external/README.md` section 6, then the ticket ARC-M2-01 in `docs/arc/delivery/tickets/M2-tool-registry-and-orchestration.md` (including the M0 gate additions) and the wire contract `docs/arc/delivery/06-arc-wire-contract.md`.

## What was built (builder's hand-back, to be verified, not trusted)
Commits: 030b6e5 `errorCode` on the turn record; 06abfcb the session and turn store (plus a small additive change to `test/fixtures/fake-firestore.js`); 3ad3773 and 26e4a9e the task-run store; 9a20b94 the routes behind `USTAAD_ENABLE_ARC`; the last commit mounts them in the server. Claimed results: 974 of 974 tests; stores and routes tested red first, except one `createIfAbsent:false` store case added after its code. Cross-session access returns 404 `NOT_FOUND` (contract D9), not 403. `POST /api/arc/turns` returns 503 until the turn runner exists (M2-03). Known gaps left to later tickets: `blocks` empty until M2-05; replay of a turn with a task run is 503 without `readEvents` (M2-06); `lastSequence` 0 until M2-06; the events and resume routes are not mounted. The 429 `RATE_LIMIT_EXCEEDED` body shape was asserted by status only.

## What to check
1. Each AC of ARC-M2-01 and each route rule of the contract (flag-off 404 `ARC_NOT_ENABLED` before auth; 401 without the cookie; same-origin check; `sessionId` in body or query gives 400 `VALIDATION_ERROR`; replay returns the stored result and spends nothing; conflicts; cross-session 404; bounded newest-last job list; no PO free text stored). For each, the test that covers it and whether that test can fail: apply a deliberate bug (a mutation) per rule, revert it with `git checkout -- <file>`, and report how many are caught.
2. The change to `test/fixtures/fake-firestore.js` (the shared fake): confirm every existing store test still passes and no behaviour of the earlier stores changed.
3. Existing tests: diff against `arc/main` and list any removed or loosened assertion.
4. Contract fidelity: compare the implemented response bodies, status codes and error codes with `06-arc-wire-contract.md` route by route; list any difference.
5. The full suite twice (once alongside a second run) and `node scripts/quality/check.mjs commits`. Report exact counts ("ℹ tests N").
6. What is NOT RUN against live services, and which ticket owns it.

## Rules
Read-only on the branch under review. Work in your scratch worktree only. No Google Cloud. Never print a secret. Other sessions run tests; never kill their processes.

## Report
`external/README.md` section 6: a table (QA-1...), BLOCKING, SHOULD-FIX or NIT, evidence, owner; under 500 words; end with `VERDICT: MERGE`, `VERDICT: MERGE WITH FIXES` (list each) or `VERDICT: NOT YET`.
