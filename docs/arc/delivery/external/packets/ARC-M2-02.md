# Packet: ARC-M2-02 Tool registry

Role: ai-engineer
Branch: `arc/ARC-M2-02-tool-registry`, stacked on `arc/ARC-M2-01-arc-routes` (head 74e14aa; its QA is still running, so you build on the branch, not on `arc/main`). Work in your own worktree at `/Users/siddhant/Developer/momentum-wt/ARC-M2-02`.
Written by the orchestrator on 2026-11-24. QA tier: A (the registry decides what Arc can do and must never reach approve).

## Read first
1. `AGENTS.md`, `CLAUDE.md`, `docs/arc/delivery/external-agents.md` (section 2: live integrations; section 2a: your sandbox has no network, you cannot commit, you cannot start local servers; hand back a `commit-plan.json`).
2. Your role prompt `docs/arc/delivery/external/roles/ai-engineer.md` and `docs/arc/delivery/external/known-findings.md` (check your work against all 15 items).
3. The ticket ARC-M2-02 in `docs/arc/delivery/tickets/M2-tool-registry-and-orchestration.md`.
4. The design: `docs/arc/delivery/05-ai-design.md` section 1 (the 15 tools, their schemas, preconditions, key builders), sections 2, 5 and 6; ADR-0007, ADR-0010 and ADR-0011; `04-technical-design.md` section 3.0 (decisions I1 to I9, especially the tool names and the effect key `arc1.<taskRunId>.<stepId>.<attempt>.<argsHash16>`); the wire contract `06-arc-wire-contract.md`.
5. The commands the tools call: `src/commands/*` (ARC-M1-01), `src/state-schemas.js`, `src/arc/routes.js` and the Arc stores from ARC-M2-01, and `src/gemini-caller-context.js` (every model call inside a tool must run in `runAsGeminiCaller`).

## Goal and acceptance criteria
From the ticket: the 15 tools in `src/arc/tools/`, each with a strict zod schema, a precondition, a key builder and an `execute` that calls a command from ARC-M1-01. No tool reaches approve (the final job-card approval stays a human checkbox plus a button; no registry entry, alias or argument can trigger it). The function declarations sent to Gemini equal the registry exactly (generate them from the registry; a test fails if they drift). ID arguments are enums built from IDs that tools returned in this session; unknown tools and unknown IDs are rejected. Tool names follow the `05` registry (`set_conditions`, `get_job_card`, and the rest).

Test plan from the ticket: the `tool-registry` offline suite with 12 assertions. Write each test, run it, and see it fail for the right reason before the code. Tests must fail by assertion, not by timeout.

## Dependencies
ARC-M2-01 (stacked, not yet merged), ARC-M1-01, ARC-M1-10 (lot revisions and the approve guard). Carry-over from the ARC-M1-17 QA: model calls from tools run inside `runAsGeminiCaller`, and a test shows a registry tool call reaches the budget store with the session and IP.

## Out of scope
The turn runner and router (M2-03, M2-04), answer writing (M2-05), event streaming (M2-06), the eval harness (M2-07). Do not call Gemini yourself in tests; use fakes.

## Plan to write before coding
Each acceptance criterion, the files you will touch, and the test for each. If the design records disagree with each other or the code, fix everything else, report the disagreement, and do not choose quietly.

## Checks before hand-back
The tests you can run in your sandbox (`node --test test/<file>.test.js`; in-process only); say which you could not run. The orchestrator runs the full suite. Hand back per `external-agents.md` section 4 with the commit plan.

## Cloud needs
None.
