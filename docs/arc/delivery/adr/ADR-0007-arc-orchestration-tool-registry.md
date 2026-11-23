# ADR-0007: Arc orchestration over a typed tool registry

Status: Proposed
Date: 2026-11-23 (amended the same day for founder decision A3, and for the M0 gate items SH-CR-1 to SH-CR-7)
Author role: AI architect
Related: `05-ai-design.md` sections 1, 2 and 6; `04-technical-design.md` sections 2.5, 2.6, 3.3 and 3.4; ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0011

## Context

- Arc must reach the same outcome as the dashboard through the same backend commands, and it must not click the UI or recompute numbers (CLAUDE.md section 4; spec 1.4).
- v2 has no chat or Arc route. `src/google-cloud/gemini-function-runner.js` exists but only its test imports it. It is fixed to the seven Blueprint tools in `AGENT_TOOLS` and allows 8 model rounds and 12 tool calls.
- Several commands live inline in `index.mjs` route handlers (`POST /jobs` at line 954, weather at 1384, status at 614), so a tool cannot call them without copying logic.
- Every `generateContent` call is one attempt against a shared daily cap (300 on `momentum`, 100 on `prepagent`, one Firestore document). Spec O10 allows at most 3 attempts for a button-only J1 run, plus 1 per typed message and 1 more for each typed data question that reaches the answer writer.
- The M0 gate found `04` and `05` describing the same interfaces differently: route prefix, turn body, turn idempotency store, transcript location, step states, tool names and effect keys (SH-CR-1 to SH-CR-7). This ADR settles them; `04` section 3 records the same choices for the backend.
- The Action Cards addendum (21 November) proposes a generic `execute_next_action(action_id, ...)` tool.

## Decision

1. Arc uses Gemini function calling on Vertex AI over a registry in `src/arc/tools/`. Each tool has a strict zod argument schema, a precondition over the session and lot record, an effect-key builder for write tools, and an `execute` that calls one command function from `04` section 1.2.
2. Inline route logic moves to `src/commands/*.js`. The route and the tool call the same function. A tool ships only once its command is extracted.
3. The registry holds 15 tools (list in `05-ai-design.md` section 1). There is no approve tool, and no tool reaches `POST /jobs/:id/approve`. Confirm order, Confirm conditions, Approve and photo upload are button paths only.
4. Tool names follow `04` section 1.2 where the documents differed. One rename: `set_condition_drafts` becomes `set_conditions`. No other tool has a different name in `04`.
5. The router declares three side-effect-free reply functions (`reply_out_of_scope`, `ask_clarification`, `explain_cannot_approve`) whose text is fixed copy.
6. The router uses mode `ANY` with `allowedFunctionNames` set per lot state, so it always returns a function call and never free text.
7. At most 2 model calls per typed turn: one router call, and for a typed data question that returned data, one answer-writer call. A typed data question therefore costs 2 attempts; any other typed message costs 1. At most 3 function calls per router response and 4 tool steps per turn. Buttons and exact suggestion text map to fixed plans in code with no model call.
8. Founder decision A3 (2026-11-23): the answer to a typed data question is written by Gemini (`gemini-3.5-flash`, `asia-south1`, about $0.0087 per call, estimate) from the same turn's tool results. The writer has no tools declared. Code checks every number and ID against those results (ADR-0010). On any failure the template rendering is shown. Values and labels on the answer card are always rendered by code. Picked suggestions and buttons keep the template.
9. Tool arguments never take free IDs. Current lot, review and job come from session state; any ID the model chooses is an enum built from this session's tool results, with jobs taken from the job-ID list on the session record.
10. **Routes.** Every Arc route sits under `/api/arc/*`, behind `requireSupervisor`, same-origin on non-GET, and the rate limiter:
    - `POST /api/arc/turns`: one turn, answered as an event stream (ADR-0011);
    - `GET /api/arc/session`: session state;
    - `GET /api/arc/runs/:id`: task-run state;
    - `GET /api/arc/runs/:id/events`: replay and follow a run's events with `Last-Event-ID`;
    - `POST /api/arc/runs/:id/resume`: continue an unfinished step.
11. **Session.** The session ID is taken from the signed demo-session cookie only. The turn body is `{ clientTurnId, input }` and carries no `sessionId`; a body that sends one fails validation.
12. **Turn idempotency.** The turn claim is `idempotency/{sha256("arc-turn:v1:" + sessionId + ":" + clientTurnId)}` with scope `arc_turn` (`04` section 3.3). A replayed turn returns its stored events and makes no Gemini call. There is no separate `arc_turns` collection.
13. **Session record and transcript.** The session record is `arc_sessions/{sessionId}` as in `04` section 2.5, with the job-ID list added in `04` section 3. Arc keeps one turn summary per turn in `arc_sessions/{sessionId}/turns/{turnId}`: intent, tool names, IDs, labels, versions, attempt count, writer outcome and fallback reason. Typed text, prompts and document text are not stored. Turn summaries take the session record's TTL. The router reads the last 4 summaries as its history. Shown answers live in the run's stored events (ADR-0011), not in the turn summary.
14. **Task runs and step states.** Runs are `arc_task_runs/{taskRunId}` as in `04` section 2.6. Step states are the `04` enum: `PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`, `WAITING_FOR_USER`, `BLOCKED`, `SKIPPED`.
15. **Effect keys.** Every write tool (`read_order`, `set_conditions`, `plan_lot`, `retry_explanation`) passes `arc1.<taskRunId without dashes>.<stepId>.<attempt>.<argsHash first 16 hex>` to its command (`04` section 3.3). The key comes from the step record, so a resumed step keeps its key and the command replays. `attempt` increases only when the user presses Retry on a FAILED step. Read tools take no effect key.

## Consequences

- O4 becomes testable at two layers: the `tool-registry` suite inspects declarations, and the approve route rejects calls without `reviewConfirmed` and the fingerprint (ADR-0003).
- A button-only J1 run still spends 2 or 3 attempts (extraction, explanation, optional retry). A typed message spends 1, and a typed data question spends 2, as O10 now allows.
- Arc's typed answers read as conversation, with the checked card underneath and the "Generated by Gemini" chip on the written text. Generative work is visible in order reading, typed-value parsing, intent routing, the plan explanation, photo diagnosis and written answers.
- O7 now depends on a check after generation, not only on construction. The fallback keeps it at 100% for what is shown; the cost is a template answer when the writer fails, and the fallback rate is reported per suite (`05` section 7).
- Because the session comes from the cookie, one session cannot write turns into another by naming its ID. Because the effect key is derived, a resume after a crash cannot create a second job, and the budget does not charge the same key twice (`04` section 5.2).
- Keeping only turn summaries means the history panel (G9) shows intents and the stored answers, not the user's typed words. This is a privacy choice (RAI-6); retention is ticketed with the transcript retention item SH-SE-3.
- Refactor cost: extracting the `POST /jobs`, weather and status commands is the first ticket and touches the live route. It needs the existing route tests to pass unchanged before and after.
- Failure mode: if the router picks a wrong but allowed tool, the precondition check or the template exposes it, and no state changes without a button press.
- Rollback: Arc is a new route behind a flag. Turning it off leaves the dashboard as it is.

## Alternatives rejected

1. **Reuse `gemini-function-runner.js` unchanged.** Its tool list is the old Blueprint set, it allows 8 rounds (8 attempts per turn), and it returns model text as the answer. Its validation helpers are kept.
2. **Templated answers only, with no model-written text (this ADR's first draft).** It kept O7 true by construction and O10 at one attempt per typed message. The founders chose written answers instead (A3, 2026-11-23): typed questions deserve answers in plain language, and the checks plus the template fallback keep every shown number grounded. Rejected by founder decision. The template stays as the fallback and for button paths.
3. **A written answer with a retry when the check fails.** Spends a third attempt on a turn whose template is already correct.
4. **A generic `execute_next_action(actionId)` tool (Action Cards addendum).** It moves the allow-list into data and lets one declaration reach any action, including ones added later. Named tools keep each capability visible in review and in the `tool-registry` suite.
5. **Mode `AUTO`, as the client sends today.** The model can answer in free text and skip tools, so numbers could appear without a source.
6. **Arc driving the UI or calling HTTP routes from the server.** Adds a second path with its own auth and parsing, and breaks "same command functions".
7. **`sessionId` in the turn body (this ADR's earlier draft).** The server would have to compare it with the cookie on every turn, and a mismatch is one more path to get wrong. The cookie already identifies the session.
8. **A separate `arc_turns` collection for turn claims.** Duplicates the idempotency store that `/jobs` already uses, with its own TTL and parse rules.
9. **Random effect keys per call.** A resumed step would get a new key, so `/jobs` would create a second job and the budget would charge twice.
10. **Routes under `/arc/*` without the `/api` prefix.** The per-IP limiter is mounted on `/api/*` (`index.mjs:159`), so routes outside the prefix would skip it unless each one added it by hand. The trace stream already lives at `/api/runs` (`index.mjs:547`).
