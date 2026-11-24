# Packet: ARC-M2-03 Turn runner

Role: ai-engineer. QA tier: A (it spends model attempts and runs tools).
Branch: `arc/ARC-M2-03-turn-runner`, stacked on `arc/ARC-M2-02-tool-registry` (head a338c62; its second QA is still running, so you build on that branch and not on `arc/main`). Worktree: `/Users/siddhant/Developer/momentum-wt/ARC-M2-03`.
Written by the orchestrator on 2026-11-24.

## Read first
1. `AGENTS.md`, `CLAUDE.md`, `docs/arc/delivery/external-agents.md` (section 2 live integrations; section 2a no network, you cannot commit, hand back `commit-plan.json`), `docs/arc/delivery/external/known-findings.md` (all 16), your role prompt `external/roles/ai-engineer.md`.
2. The ticket ARC-M2-03 in `docs/arc/delivery/tickets/M2-tool-registry-and-orchestration.md`.
3. `docs/arc/delivery/05-ai-design.md` sections 1, 2 (turn loop), 3 (model choice and cost), 5 (guardrails, in order) and 6 (streaming); ADR-0007, ADR-0008, ADR-0010, ADR-0011; `04-technical-design.md` section 3.0 (I1 to I9); the wire contract `06-arc-wire-contract.md` section 4.4 (`POST /api/arc/turns`: the stream, the replay header, the pre-stream JSON errors).
4. The code you build on: `src/arc/tools/` and `src/arc/canonical-json.js` (the registry and effect keys), `src/arc/routes.js` (the route has a `runTurn` hook that currently makes new turns return 503), the Arc stores (`src/google-cloud/firestore-arc-session-store.js`, `firestore-arc-task-run-store.js`), `src/daily-gemini-call-cap.js` and the budget store (`reserve`; the replay outcome `GEMINI_CALL_REPLAYED`), `src/gemini-caller-context.js`, `src/google-cloud/vertex-gemini-client.js`, `config/arc-models.json`, `prompts/`.

## Goal and acceptance criteria
`src/arc/turn-runner.js` and `config/arc.json`:
- Deterministic pre-routing first (buttons, suggestion chips and known actions cost 0 model attempts). One router call for typed text, at most 3 function calls and 4 tool steps per turn, limits read from `config/arc.json`.
- Typed text costs 1 router attempt, plus 1 answer-writer attempt for a typed data question (decision A3); both are reserved through the budget store's `reserve`. The router and writer calls themselves are behind an interface here (a fake in tests); the router prompt and scope rules are ARC-M2-04 and the writer and output checks are ARC-M2-05, so do not write them.
- A step resumes with the same idempotency key (effect key) after a restart: when a reservation replays (`GEMINI_CALL_REPLAYED`), read the stored effect and continue, with no second provider call and no second attempt charged.
- A turn summary stores no prompt or document text (a test asserts it, as for the stores).
- Every model call runs inside `runAsGeminiCaller`; a test shows a runner call reaches the budget store with the session and IP.
- Wire the runner into `POST /api/arc/turns` so a new turn streams as the contract says; replay and conflict behaviour stay as merged. Keep the route behind `USTAAD_ENABLE_ARC`. Pre-stream errors are JSON with a stable code and carry `Cache-Control: no-store`.
- Tool results and untrusted content never grant a capability, change the rules or trigger an action; the runner passes only registry tools, only the IDs discovered in this session.
- Off-topic, approval and injection phrasing that the deterministic rules refuse never reach a model (the rule set arrives in M2-04; here, leave the pre-router hook and test it with a stub rule).

Test plan from the ticket: offline tests over a fake router, attempt counting asserted from the budget store, and a restart test that stops the runner between two steps and resumes it, asserting the same effect key and no second attempt. Each test is written first and seen to fail by assertion, not timeout.

## Dependencies
ARC-M2-02 (stacked, not merged), ARC-M2-01 (merged), ARC-M1-08, ARC-M1-10.

## Out of scope
The router prompt and scope rules (M2-04), answer writing and output checks (M2-05), the events and resume routes (M2-06), the eval harness (M2-07). No live Gemini calls; fakes only in tests.

## Plan to write before coding
Each acceptance criterion, the files you will touch, the test for each, and the shape of the router and writer interfaces so M2-04 and M2-05 plug in without changing the runner. If the design records disagree with each other or the code, fix everything else, report the disagreement, and do not choose quietly.

## Checks before hand-back
Run the in-process tests your sandbox allows (`node --test test/<file>.test.js`) and say which you could not run. The orchestrator runs the full suite. Hand back per `external-agents.md` section 4 with the commit plan and a line saying you checked against `known-findings.md`.

## Cloud needs
None. State the cost per turn that `config/arc.json` allows (attempts and tool steps) in the hand-back.
