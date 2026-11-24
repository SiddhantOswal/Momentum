# Review packet: ARC-M1-REPAIR-1 (QA lead)

Role: qa-lead (fresh session; you did not build this).
Branch under review: `arc/ARC-M1-REPAIR-1-idempotency-fail-closed` (commits 98309d3 and 705f26c on `arc/main` f86942b). Review it in your worktree at `/Users/siddhant/Developer/momentum-wt/ARC-M1-REPAIR-1`; the working tree is clean and equals the branch head. You may apply deliberate bugs (mutations) to test the tests, but you must revert every one so the tree is clean when you finish (`git checkout -- <file>`), and you never commit.
Written by the orchestrator on 2026-11-24.

## Read first
`AGENTS.md`, `CLAUDE.md` (section 5.2), `docs/arc/delivery/external-agents.md` (section 2a: your sandbox has no network and cannot start local servers), your role prompt `docs/arc/delivery/external/roles/qa-lead.md`, `docs/arc/delivery/external/README.md` sections 4c and 6, the packet this work was built from (`docs/arc/delivery/external/packets/ARC-M1-REPAIR-1.md`) and `docs/arc/delivery/reviews/M1-review.md` (CR-1, CR-2).

## Evidence the orchestrator ran outside the sandbox (you cannot run the server-starting tests)
- Two full `npm test` runs at the same time on this branch: logs at `/private/tmp/claude-501/-Users-siddhant-Developer-Momentum/0fef2159-0f37-4beb-a509-b3757c090bca/scratchpad/codex/logs/REPAIR-1-run-a.txt` and `/private/tmp/claude-501/-Users-siddhant-Developer-Momentum/0fef2159-0f37-4beb-a509-b3757c090bca/scratchpad/codex/logs/REPAIR-1-run-b.txt`. Read them; each should end with `ℹ tests 916`, pass 916, fail 0, cancelled 0.
- `node scripts/quality/check.mjs commits` checked 212 messages, exit 0.

## What to check
1. Each acceptance criterion of the packet and the test that covers it. Run the focused tests you can (`node --test test/job-idempotency.test.js test/durable-job-idempotency.test.js test/firestore-idempotency-store.test.js`; say which test files need a server and so cannot run in your sandbox).
2. That each test can fail. Apply a mutation per rule and report how many a test catches: return the in-memory store outside demo mode again (CR-1); let the route plan a job when the store is unavailable; make `/api/status` report the wrong `durableIdempotencyConfigured` for each of the three flag and mode combinations; break the offline demo replay. Revert each one.
3. The existing tests: list every assertion removed or changed between `arc/main` and the branch (`git diff arc/main..HEAD -- test`). Commit 98309d3 scopes existing replay assertions to offline demo mode; judge whether that weakens anything or only states the real condition under which they hold.
4. Whether the fail-closed 503 can be bypassed by a request header, a cookie, a query field or the demo-session cookie outside demo mode.
5. Read the comments changed (CR-2, CR-9): plain, current, explaining why.
6. What is NOT RUN against live services.

## Report
`external/README.md` section 6: a table (QA-1...), BLOCKING, SHOULD-FIX or NIT, evidence, owner; under 400 words; end with `VERDICT: MERGE`, `VERDICT: MERGE WITH FIXES` (list each) or `VERDICT: NOT YET`.
