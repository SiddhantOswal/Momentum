# Packet: ARC-M2-02-FIX2 fresh-key regression test

Role: ai-engineer. QA tier: B (test-only; the orchestrator verifies by mutation).
Branch: `arc/ARC-M2-02-tool-registry` (head a338c62) in `/Users/siddhant/Developer/momentum-wt/ARC-M2-02`. Add a commit on top; do not rewrite history (the turn runner is stacked on this branch).

Read `AGENTS.md`, `CLAUDE.md`, `docs/arc/delivery/external-agents.md` (section 2a), `external/known-findings.md` and your role prompt. Hand back a `commit-plan.json`. Do not edit STATUS.md.

QA found: the committed tests pass when a fresh reservation key is wrongly reported as a replay (`src/daily-gemini-call-cap.js` near line 162). That would suppress legitimate model calls. A probe against the Firestore fake showed two distinct keys must make two provider calls, two attempts and two usage charges. Add that case to the committed suite (`test/gemini-budget-wiring.test.js` or `test/tool-registry.test.js`, wherever the replay tests are): two different keys, two provider calls; the same key twice, one. Show it failing when the guard treats every reservation as a replay, and passing after you restore it. No source change expected. Do not weaken any assertion. Run what your sandbox allows and say what you could not run.
