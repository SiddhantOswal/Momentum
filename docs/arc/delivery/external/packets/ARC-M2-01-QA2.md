# Review packet: ARC-M2-01 fixes (QA lead, second look)

Role: qa-lead. You are a fresh session; you did not build this and did not do the first review.
Branch under review: `arc/ARC-M2-01-arc-routes`, head 74e14aa. It adds four commits (87165f4, a48bf3a, 13feedf, 74e14aa) on 751a9f9, which an earlier QA review rated NOT YET. Work in `/Users/siddhant/Developer/momentum-wt/review-M2-01`, a detached checkout at the head. You may apply mutations (deliberate bugs) but must revert each with `git checkout -- <file>`, leave the tree clean, and never commit.
Written by the orchestrator on 2026-11-24. QA tier: A.

## Read first
`AGENTS.md`, `CLAUDE.md` (5.2), `docs/arc/delivery/external-agents.md` (section 2a: no network, no local servers), your role prompt `docs/arc/delivery/external/roles/qa-lead.md`, `docs/arc/delivery/external/README.md` sections 4c and 6, `docs/arc/delivery/external/known-findings.md`, the fix packet `docs/arc/delivery/external/packets/ARC-M2-01-FIX.md` (the four findings and the tech lead's decision on QA-4) and the wire contract `docs/arc/delivery/06-arc-wire-contract.md`.

## Evidence the orchestrator ran outside the sandbox
Two full `npm test` runs at the same time on this head: `/private/tmp/claude-501/-Users-siddhant-Developer-Momentum/0fef2159-0f37-4beb-a509-b3757c090bca/scratchpad/codex/logs/M2-01-fix-run-a.txt` and `/private/tmp/claude-501/-Users-siddhant-Developer-Momentum/0fef2159-0f37-4beb-a509-b3757c090bca/scratchpad/codex/logs/M2-01-fix-run-b.txt` (986 tests, 986 pass, 0 fail, 0 cancelled in each). `node scripts/quality/check.mjs commits` exit 0.

## What to check
1. Each of QA-1 to QA-4 is fixed as the packet says, against the contract. For each, the test that covers it, and whether it can fail: apply a mutation per fix (remove the query `sessionId` check on each of the three routes; drop `Cache-Control: no-store` on the flag-off 404, the 413 and both 429s; move the body-size check after the rate limit; drop `Retry-After`; remove `errorCode` from the turn view; read N + 2 documents; make `nextBefore` non-null on a last page) and report how many a test catches.
2. The earlier review's other mutations (flag, cookie, origin, replay, cross-session 404, job bounds, action hashing) still fail their tests: re-run a sample.
3. Regressions: the full list of assertions changed or removed between 751a9f9 and the head (`git diff 751a9f9..HEAD -- test`). The builder changed one existing 503 assertion to use a signed cookie and added a separate anonymous 401 assertion: judge whether that is the contract's order of checks or a weakening.
4. Contract text: the edit to the history read bound is accurate and says nothing else changed.
5. Check the work against `known-findings.md`, all 15 items, for the files changed.
6. What is NOT RUN against live services.

## Report
`external/README.md` section 6: a table (QA-1...), BLOCKING, SHOULD-FIX or NIT, evidence, owner; under 400 words; end with `VERDICT: MERGE`, `VERDICT: MERGE WITH FIXES` (list each) or `VERDICT: NOT YET`.
