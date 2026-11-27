# M2 Arc tool registry and orchestration

Design: `05-ai-design.md` sections 1, 2, 5, 6; ADR-0007, ADR-0010, ADR-0011; interfaces from design 2.5, 2.6, 3.3, 5.2.

### ARC-M2-01 Arc routes, session and task-run stores (P0)
- Goal: the `/api/arc` Hono sub-app behind `USTAAD_ENABLE_ARC`, with the `arc_sessions` store (and its `turns` subcollection) and the `arc_task_runs` store (`04` section 3.0, I1 to I5).
- AC: routes follow `04` I1. Every route uses `authorizeSupervisor`, the same-origin check and the rate limiter. A `clientTurnId` reused with different input gets 409 `CONFLICT`, and one in progress gets 409 `IN_PROGRESS`. Replay of stored events is delivered with ARC-M2-06. The request and response bodies, error codes and the history reads (`GET /api/arc/turns`, `GET /api/arc/turns/:clientTurnId`) follow `06-arc-wire-contract.md`; with `USTAAD_ENABLE_ARC` off every route returns 404 `ARC_NOT_ENABLED`. The turn record gains the nullable `errorCode` (06 decision D3). Sessions are scoped to the demo session. `arc_sessions` keeps the list of job IDs the session created or opened (bounded, newest last, oldest dropped, as `04` section 2.5), so J10 "open my last approved card" works across lots without a collection query.
- Depends on: M1-02, M1-05. Owner: backend engineer.
- Test plan: route tests for authentication, replay and cross-session access.
- M0 gate additions: the route prefix is settled as `/api/arc/*` in ADR-0007, with `GET /api/arc/runs/:taskRunId/events`, so the AC tests behaviour: a request without the signed session cookie gets 401, and a `sessionId` field in the body is rejected with 400 `VALIDATION_ERROR` (`04` I2). The transcript and turn-summary store follows `04` section 3 ("Interface decisions"), with a TTL and no raw PO text; a test asserts no PO free text is stored.

### ARC-M2-02 Tool registry (P0)
- Goal: the 15 tools in `src/arc/tools/` (05 section 1), each with a strict zod schema, a precondition, a key builder and `execute` calling a command from M1-01.
- AC: no tool reaches approve. The declarations sent to Gemini equal the registry. ID arguments are enums built from IDs that tools returned in this session. Unknown tools and IDs are rejected.
- Depends on: M1-01, M2-01. Owner: AI engineer.
- Test plan: the `tool-registry` offline suite (12 assertions).

### ARC-M2-03 Turn runner (P0)
- Goal: `src/arc/turn-runner.js`, with deterministic pre-routing, one router call for typed text, at most 3 function calls and 4 tool steps per turn, and limits in `config/arc.json`.
- AC: buttons and suggestion chips cost 0 attempts. Typed text costs 1 router attempt, plus 1 answer-writer attempt for a typed data question (decision A3); both are reserved through `reserve`. A step resumes with the same idempotency key after a restart. A turn summary stores no prompt or document text.
- Carry-over from ARC-M1-17 QA: Gemini calls from Arc turns or background work must run inside `runAsGeminiCaller` (`src/gemini-caller-context.js`), or they skip the per-session and per-IP limits. Add a test that a turn-runner call reaches the store with the session and IP.
- Wire contract: `POST /api/arc/turns` responds as in `06-arc-wire-contract.md` section 4.4 (stream, replay header, pre-stream JSON errors).
- Depends on: M2-02, M1-08. Owner: AI engineer.
- Test plan: offline tests over a fake router, plus attempt counting asserted from the budget store. A restart test kills the runner between two steps and resumes it, asserting the same effect key and no second attempt.

### ARC-M2-04 Router prompt and scope rules (P0)
- Goal: the router system instruction and the deterministic scope and approval rules (05 section 5, steps 1 and 2), with `reply_out_of_scope`, `ask_clarification` and `explain_cannot_approve`.
- AC: off-topic, approval and injection phrasings that match the rules never reach the model. The router model and region come from config.
- Depends on: M2-03, M1-12, founder decision A1. Owner: AI engineer.
- Carry-over from the ARC-M2-03 QA (QA-9): the tool registry is rebuilt every turn and discovered IDs live in the per-turn instance, so a typed `diagnose_approved_photo` can never validate (not in the same turn, because validation runs before the list step, and not in a later turn). No typed turn can spend Gemini on a tool today. Decide how discovered IDs persist across a turn (for example from the session's stored tool results) so the router can use them, and test it. Also wire the router into `index.mjs` and expose the budget store from `service-ports` (see ARC-M2-05).
- Test plan: the offline `scope-refusal` and `off-topic` rule cases; the live router comparison of flash-lite against flash is recorded with an "eval run" label.
- M0 gate additions: the router sees only the extracted PO fields listed in `05` section 5 (enums, numbers and IDs; no free text such as customer or buyer name). A test asserts that the router request body contains none of the free-text fields of PO1 to PO5.

### ARC-M2-05 Answer rendering and output checks (P0)
- Goal: Gemini writes the answer from the same turn's tool results (founder decision A3, 2026-11-23). Code runs the schema, numeric-fidelity and tool-IDs-only checks before anything is emitted, and the template rendering is the fallback.
- AC: typed job-card retrieval (J10) and refusals never call the writer, so they cost 1 attempt (spec AC10.2). A number or ID that is not in the turn's tool results blocks the model's answer, and the template answer is shown instead. The fallback is counted in the turn record. Every value carries its provenance label from code, not from the model. Every answer the writer produced carries the "Generated by Gemini" chip, set in code (spec section 5, G17); a template fallback does not carry it. A test fails if either is wrong.
- Wire contract: builds `AnswerView` and the answer blocks of `06-arc-wire-contract.md` section 5 from the turn record and `resultRefs`, and sets `generatedByGemini` from `writerOutcome`.
- Depends on: M2-03. Owner: AI engineer.
- Carry-over from the ARC-M2-03 build: add `GEMINI_CALL_REPLAYED` and `BUDGET_TURN_EXHAUSTED` (both not retry-safe) to the `05` G2 error table with user copy. Typed text returns `SERVICE_UNAVAILABLE` until the router, writer, `attemptStore` and `geminiCap` are wired into `index.mjs` (ARC-M2-04 and this ticket); the budget store is not yet exposed by `service-ports`. The typed job-card path (no writer for `get_job` and `get_job_card`) needs its test here.
- Carry-over from the ARC-M2-04 build, for the founders and the copy editor before M2-05 ships: (1) the safety-block message for the router path is worded three ways (`05` section 5 step 6: "Arc cannot help with that message..."; the spec at line 475: "Gemini blocked this message..."; AC11.12 forbids the J5 text there). Pick one, from the spec, and amend the others. (2) The safety-block code is `GEMINI_SAFETY_BLOCKED` in the client (shipped in M1-12 and M1-14); the docs say `VERTEX_SAFETY_BLOCKED` and the wire contract lists neither. Tech-lead decision: the code name is `GEMINI_SAFETY_BLOCKED`; amend `05` and add it to contract 3.2. (3) Refusal suggestions: J5 wants three, but the turn summary stores only the intent, so this ticket rebuilds them from `config/arc-scope.json`. (4) The Hindi approval patterns and the suggestion and clarification labels in `config/arc-scope.json` have no native-speaker or PM review.
- Test plan: the offline `numeric-fidelity` (30 cases) and `provenance-labels` suites.

### ARC-M2-06 Event stream and resume (P0)
- Goal: server-sent events of real step states only (ADR-0011), with `GET /api/arc/runs/:taskRunId/events` using `Last-Event-ID` and `POST /api/arc/runs/:taskRunId/resume`.
- AC: no percentage or time estimate is sent. Reconnecting replays the stored events. A resumed `plan_lot` returns the stored job without a second attempt when the first call finished.
- Wire contract: event frames, `Last-Event-ID`, the resume response and the stream endings follow `06-arc-wire-contract.md` sections 3, 4.3 and 4.5.
- Depends on: M2-01, M2-03, M1-07. Owner: backend engineer.
- Carry-over from the ARC-M2-03 build (tech-lead decision, 2026-11-24): the turn runner fails closed with `GEMINI_CALL_REPLAYED` when a step replays and no stored effect exists, because nothing in production stores a router plan or a tool effect yet (`index.mjs` passes no `readModelEffect` or `readToolEffect`). This ticket adds the durable effect store and wires both readers, so a restart resumes a turn without a second attempt, as the ARC-M2-03 AC says. `04` section 3.4 and `05` section 2 say a re-run step runs again under a new lease owner and counts its Gemini calls; the ticket AC governs, and those two sections are amended in this ticket.
- Test plan: stream tests with a dropped connection; a restart simulation.
- M0 gate additions: covers spec AC11.8. Two tabs reconnect to the same run during a resume; one run continues, and both tabs show the same events. A test fails if a second run is created.

### ARC-M2-07 Offline eval harness and `npm run eval:offline` (P0)
- Goal: `evals/` as `node --test` suites over an extended `src/mock-agents.js`, run with a new `eval:offline` script in `package.json`. The `quality.yml` step "Offline evals" already calls that script, and today it prints "NOT RUN" because the script does not exist (ADR-0001 item 7).
- AC: `npm run eval:offline` runs every offline suite with no network and no Gemini, and exits non-zero on any failure. CI shows the step as run, not NOT RUN. A deliberately broken case makes the suite fail. The script prints the pass count per suite.
- Depends on: M2-02. Owner: AI engineer; QA lead checks that the cases can fail.
- Test plan: the CI run link in the PR.

### ARC-M2-08 Measure tokens, latency and attempts (P0, closes at the M3 gate)
- Goal: measure the figures 05 section 3 marks NOT MEASURED, on a tagged no-traffic revision.
- AC: `data/arc-m2-measurements.md` records input, output and thinking tokens per role, p50 and p95 latency per role and for `plan_lot`, and attempts per J1 run (O10). Each is labelled "eval run, not the live service".
- Depends on: M3-01. Owner: AI engineer; the verification auditor checks the run logs.
- Test plan: the scripted run itself, with its raw output kept in the record.

### ARC-M2-09 Save a regenerated explanation to the current draft (P1)
- Goal: the registry tool `retry_explanation` fails closed because no command saves a regenerated explanation to the current draft (ARC-M2-02 QA).
- AC: a command in `src/commands/` regenerates the explanation through the budget wrapper and saves it, with its source, to the current draft revision; the tool calls it. A superseded revision returns 409 `REVISION_SUPERSEDED`; a replayed key stores nothing twice.
- Depends on: M2-02, M1-10, M1-21. Owner: backend engineer and AI engineer.
- Test plan: command tests with a fake model and the fake Firestore; the registry test that the tool no longer fails closed.

