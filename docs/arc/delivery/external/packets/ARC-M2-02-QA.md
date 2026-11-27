# Review packet: ARC-M2-02 Tool registry (QA lead)

Role: qa-lead. Fresh session; you did not build this. QA tier: A.
Branch under review: `arc/ARC-M2-02-tool-registry` (2 commits on `arc/main` 96e7927: c236a56 tests, 7b70855 registry; 24 files, +711 -18). Work in `/Users/siddhant/Developer/momentum-wt/review-M2-02`, a detached checkout of the head. You may apply mutations but must revert each with `git checkout -- <file>`, leave the tree clean, and never commit.
Written by the orchestrator on 2026-11-24.

## Read first
`AGENTS.md`, `CLAUDE.md` (5.2), `docs/arc/delivery/external-agents.md` (2a: no network, no local servers), your role prompt, `external/README.md` (4c, 6), `external/known-findings.md`, the build packet `external/packets/ARC-M2-02.md`, the ticket ARC-M2-02 in `docs/arc/delivery/tickets/M2-tool-registry-and-orchestration.md`, `docs/arc/delivery/05-ai-design.md` section 1 and ADR-0007, ADR-0010.

## Evidence the orchestrator ran outside the sandbox
Two full `npm test` runs at the same time on this head: `/private/tmp/claude-501/-Users-siddhant-Developer-Momentum/0fef2159-0f37-4beb-a509-b3757c090bca/scratchpad/codex/logs/M2-02-run-a.txt` and `/private/tmp/claude-501/-Users-siddhant-Developer-Momentum/0fef2159-0f37-4beb-a509-b3757c090bca/scratchpad/codex/logs/M2-02-run-b.txt` (1004 tests, 1004 pass, 0 fail, 0 cancelled in each). `node scripts/quality/check.mjs commits` exit 0.

## What the builder reports (verify, do not trust)
All 15 tool names exist; the Vertex function declarations are generated from the registry's zod schemas; the 12-test offline suite `test/tool-registry.test.js` covers strict arguments, unknown and foreign IDs, approval aliases and arguments, required human confirmations, canonical effect keys and propagation of session and IP to the Gemini budget store. Four tools fail closed because their commands do not exist yet: `read_order` and `set_conditions` (need durable replay support), `retry_explanation` (needs a command that saves an explanation to the current draft), `query_metric` (needs the ARC-M4-01 dictionary). PDF content comparison and photo caching belong to ARC-M3-03 and ARC-M5-01. Existing files also changed: `index.mjs`, `src/arc/routes.js`, `src/daily-gemini-call-cap.js`, `src/gemini-caller-context.js`, `src/synthetic-po-allowlist.js`.

## What to check
1. **No tool reaches approve.** Read every tool and the registry for any path (name, alias, argument, tool chain, a tool that calls the approve command or the approve route) that could approve a job card. Try to break it: add an approve alias or argument to a tool and see whether a test fails. The final approval stays a human checkbox plus a button.
2. The declarations sent to Gemini equal the registry exactly: add or change a tool field and check a test fails.
3. ID arguments are enums built from IDs that tools returned in this session; unknown tools, unknown IDs and IDs from another session are rejected. Try each.
4. Effect keys follow `arc1.<taskRunId>.<stepId>.<attempt>.<argsHash16>`, are stable for the same arguments, and change for different arguments; two orderings of the same JSON give the same key.
5. Every model call from a tool runs inside `runAsGeminiCaller` and reaches the budget store with the session and IP (carry-over from ARC-M1-17). Remove the wrapper and see a test fail.
6. The four fail-closed tools: judge whether failing closed is safe (no partial effect, clear error code, nothing silently returned as success) and whether the ticket's acceptance criteria are met without them. List what each needs, and which existing or new ticket should own it, so that ARC-M3-01 (the J1 plan) is not blocked later. Do not call this a blocking finding unless the ticket's own criteria require them now.
7. Changes to the five existing source files: read each diff for behaviour changes outside the registry and for regressions. List every assertion changed or removed in `test/` (`git diff arc/main..HEAD -- test`).
8. Check against all 15 items of `known-findings.md`. Say what is NOT RUN against live services.

## Report
`external/README.md` section 6: a table (QA-1...), BLOCKING, SHOULD-FIX or NIT, evidence, owner; under 500 words; end with `VERDICT: MERGE`, `VERDICT: MERGE WITH FIXES` (list each) or `VERDICT: NOT YET`.
