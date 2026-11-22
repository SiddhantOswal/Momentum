# M2 Arc tool registry and orchestration

Design: `05-ai-design.md` sections 1, 2, 5, 6; ADR-0007, ADR-0010, ADR-0011; interfaces from design 2.5, 2.6, 3.3, 5.2.

### ARC-M2-01 Arc routes, session and task-run stores (P0)
- Goal: the `/arc` Hono sub-app behind `USTAAD_ENABLE_ARC`, with `arc_sessions`, `arc_turns` and `arc_task_runs` stores.
- AC: this ticket settles the route prefix, because the two designs differ (`/arc/*` in 04 section 1.3, `/api/arc/*` in 05 section 2), and records the choice in ADR-0007. Every route uses `authorizeSupervisor`, the same-origin check and the rate limiter. A replayed `clientTurnId` returns the stored events and spends nothing. Sessions are scoped to the demo session.
- Depends on: M1-02, M1-05. Owner: backend engineer.
- Test plan: route tests for authentication, replay and cross-session access.

### ARC-M2-02 Tool registry (P0)
- Goal: the 15 tools in `src/arc/tools/` (05 section 1), each with a strict zod schema, a precondition, a key builder and `execute` calling a command from M1-01.
- AC: no tool reaches approve. The declarations sent to Gemini equal the registry. ID arguments are enums built from IDs that tools returned in this session. Unknown tools and IDs are rejected.
- Depends on: M1-01, M2-01. Owner: AI engineer.
- Test plan: the `tool-registry` offline suite (12 assertions).

### ARC-M2-03 Turn runner (P0)
- Goal: `src/arc/turn-runner.js`, with deterministic pre-routing, one router call for typed text, at most 3 function calls and 4 tool steps per turn, and limits in `config/arc.json`.
- AC: buttons and suggestion chips cost 0 attempts. Typed text costs 1, reserved through `reserve`. A step resumes with the same idempotency key after a restart. A turn summary stores no prompt or document text.
- Depends on: M2-02, M1-08. Owner: AI engineer.
- Test plan: offline tests over a fake router, plus attempt counting asserted from the budget store.

### ARC-M2-04 Router prompt and scope rules (P0)
- Goal: the router system instruction and the deterministic scope and approval rules (05 section 5, steps 1 and 2), with `reply_out_of_scope`, `ask_clarification` and `explain_cannot_approve`.
- AC: off-topic, approval and injection phrasings that match the rules never reach the model. The router model and region come from config.
- Depends on: M2-03, M1-12, founder decision A1. Owner: AI engineer.
- Test plan: the offline `scope-refusal` and `off-topic` rule cases; the live router comparison of flash-lite against flash is recorded with an "eval run" label.

### ARC-M2-05 Answer rendering and output checks (P0)
- Goal: Gemini writes the answer from the same turn's tool results (founder decision A3, 2026-11-23). Code runs the schema, numeric-fidelity and tool-IDs-only checks before anything is emitted, and the template rendering is the fallback.
- AC: a number or ID that is not in the turn's tool results blocks the model's answer, and the template answer is shown instead. The fallback is counted in the turn record. Every value carries its provenance label from code, not from the model.
- Depends on: M2-03. Owner: AI engineer.
- Test plan: the offline `numeric-fidelity` (30 cases) and `provenance-labels` suites.

### ARC-M2-06 Event stream and resume (P0)
- Goal: server-sent events of real step states only (ADR-0011), with `GET /arc/runs/:id/events` using `Last-Event-ID` and `POST /arc/runs/:id/resume`.
- AC: no percentage or time estimate is sent. Reconnecting replays the stored events. A resumed `plan_lot` returns the stored job without a second attempt when the first call finished.
- Depends on: M2-01, M2-03, M1-07. Owner: backend engineer.
- Test plan: stream tests with a dropped connection; a restart simulation.

### ARC-M2-07 Offline eval harness and `npm run eval:offline` (P0)
- Goal: `evals/` as `node --test` suites over an extended `src/mock-agents.js`, run with a new `eval:offline` script in `package.json`. The `quality.yml` step "Offline evals" already calls that script, and today it prints "NOT RUN" because the script does not exist (ADR-0001 item 7).
- AC: `npm run eval:offline` runs every offline suite with no network and no Gemini, and exits non-zero on any failure. CI shows the step as run, not NOT RUN. A deliberately broken case makes the suite fail. The script prints the pass count per suite.
- Depends on: M2-02. Owner: AI engineer; QA lead checks that the cases can fail.
- Test plan: the CI run link in the PR.

### ARC-M2-08 Measure tokens, latency and attempts (P0)
- Goal: measure the figures 05 section 3 marks NOT MEASURED, on a tagged no-traffic revision.
- AC: `data/arc-m2-measurements.md` records input, output and thinking tokens per role, p50 and p95 latency per role and for `plan_lot`, and attempts per J1 run (O10). Each is labelled "eval run, not the live service".
- Depends on: M3-01. Owner: AI engineer; the verification auditor checks the run logs.
- Test plan: the scripted run itself, with its raw output kept in the record.
