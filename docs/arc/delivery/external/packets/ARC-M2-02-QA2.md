# Review packet: ARC-M2-02 fixes (QA lead, second look)

Role: qa-lead. Fresh session; you did not build this or do the first review. QA tier: A.
Branch under review: `arc/ARC-M2-02-tool-registry`, head a338c62 (7 commits on `arc/main` 5438ecf: the registry and its tests, then five fix commits). The first QA review rated the registry NOT YET. Work in `/Users/siddhant/Developer/momentum-wt/review-M2-02`, a detached checkout. Apply mutations but revert each with `git checkout -- <file>`, leave the tree clean, never commit.
Written by the orchestrator on 2026-11-24.

## Read first
`AGENTS.md`, `CLAUDE.md` (5.2), `external-agents.md` (2a), your role prompt, `external/README.md` (4c, 6), `external/known-findings.md` (16 items), the fix packet `external/packets/ARC-M2-02-FIX.md` (the three findings), `docs/arc/delivery/05-ai-design.md` sections 1 and 2.

## Evidence run outside the sandbox
Two full `npm test` runs at once: `/private/tmp/claude-501/-Users-siddhant-Developer-Momentum/0fef2159-0f37-4beb-a509-b3757c090bca/scratchpad/codex/logs/M2-02-fix-run-a.txt` and `/private/tmp/claude-501/-Users-siddhant-Developer-Momentum/0fef2159-0f37-4beb-a509-b3757c090bca/scratchpad/codex/logs/M2-02-fix-run-b.txt` (1009 tests, 1009 pass, 0 fail, 0 cancelled in each). `node scripts/quality/check.mjs commits` exit 0.

## What to check
1. QA-1: the declaration contract across discovery states. Mutate: rename a parameter, drop a parameter, change an enum, drop a required flag, turn an ID enum into an unrestricted string, offer a tool whose ID set is empty. Each must fail a test. Judge the rule "a tool with no known IDs is omitted from that call's declarations and allowed names": does the model ever lose a tool it needs, for example one that creates the first ID? Check against `05` section 1.
2. QA-2: the replay guard. Two concurrent dispatches under one claim must make one provider call. Judge the replay outcome (`GEMINI_CALL_REPLAYED`): safe and no partial charge or effect; clear for the turn runner to turn into a read of the stored effect; consistent with the budget wrapper's other error codes. Mutate: remove the guard; make it replay for a different key.
3. QA-3: the effect key changes when an argument value changes and not when property order changes. Mutate the hash input.
4. The two changed existing expectations (empty enums omitted; a replayed reservation calls the provider once overall) are in their own commits with the reason. Confirm they state the new rule and nothing else changed (`git diff 5438ecf..HEAD -- test`).
5. Re-run a sample of the first review's mutations: approval alias, approval argument, enum drift, ownership filter, canonical sorting, caller wrapper.
6. The doc edit to `05-ai-design.md` is accurate and short. STATUS.md was not touched.
7. What is NOT RUN against live services.

## Report
`external/README.md` section 6: a table (QA-1...), BLOCKING, SHOULD-FIX or NIT; under 400 words; end with `VERDICT: MERGE`, `VERDICT: MERGE WITH FIXES` (list each) or `VERDICT: NOT YET`.
