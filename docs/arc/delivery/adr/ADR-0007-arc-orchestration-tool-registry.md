# ADR-0007: Arc orchestration over a typed tool registry

Status: Proposed
Date: 2026-11-23 (amended the same day for founder decision A3)
Author role: AI architect
Related: `05-ai-design.md` sections 1 and 2; ADR-0001, ADR-0002, ADR-0003, ADR-0004

## Context

- Arc must reach the same outcome as the dashboard through the same backend commands, and it must not click the UI or recompute numbers (CLAUDE.md section 4; spec 1.4).
- v2 has no chat or Arc route. `src/google-cloud/gemini-function-runner.js` exists but only its test imports it. It is fixed to the seven Blueprint tools in `AGENT_TOOLS` and allows 8 model rounds and 12 tool calls.
- Several commands live inline in `index.mjs` route handlers (`POST /jobs` at line 954, weather at 1384, status at 614), so a tool cannot call them without copying logic.
- Every `generateContent` call is one attempt against a shared daily cap (300 on `momentum`, 100 on `prepagent`, one Firestore document). The spec proposes at most 3 attempts for a button-only J1 run, plus one per typed message (O10).
- The Action Cards addendum (21 November) proposes a generic `execute_next_action(action_id, ...)` tool.

## Decision

1. Arc uses Gemini function calling on Vertex AI over a registry in `src/arc/tools/`. Each tool has a strict zod argument schema, a precondition over the session and lot record, an idempotency key builder and an `execute` that calls one command function.
2. Inline route logic moves to `src/commands/*.js`. The route and the tool call the same function. A tool ships only once its command is extracted.
3. The registry holds 15 tools (list in `05-ai-design.md` section 1). There is no approve tool, and no tool reaches `POST /jobs/:id/approve`. Confirm order, Confirm conditions, Approve and photo upload are button paths only.
4. The router declares three side-effect-free reply functions (`reply_out_of_scope`, `ask_clarification`, `explain_cannot_approve`) whose text is fixed copy.
5. The router uses mode `ANY` with `allowedFunctionNames` set per lot state, so it always returns a function call and never free text.
6. At most 2 model calls per typed turn: one router call, and for a typed data question that returned data, one answer-writer call. At most 3 function calls per router response and 4 tool steps per turn. Buttons and exact suggestion text map to fixed plans in code with no model call.
7. Founder decision A3 (2026-11-23): the answer to a typed data question is written by Gemini (`gemini-3.5-flash`, `asia-south1`, about $0.0087 per call, estimate) from the same turn's tool results. The writer has no tools declared. Code checks every number and ID against those results (ADR-0010). On any failure the template rendering is shown. Values and labels on the answer card are always rendered by code. Picked suggestions and buttons keep the template.
8. Tool arguments never take free IDs. Current lot, review and job come from session state; any ID the model chooses is an enum built from this session's tool results.
9. Turns, sessions and task runs are stored under ADR-0002. A long step resumes by re-issuing the same call with the same idempotency key.

## Consequences

- O4 becomes testable at two layers: the `tool-registry` suite inspects declarations, and the approve route rejects calls without `reviewConfirmed` and the fingerprint (ADR-0003).
- A button-only J1 run still spends 2 or 3 attempts (extraction, explanation, optional retry). A typed message spends 1, and a typed data question spends 2. O10 in spec 9.1 must be amended to allow the second attempt (product manager).
- Arc's typed answers read as conversation, with the checked card underneath. Generative work is visible in order reading, typed-value parsing, intent routing, the plan explanation, photo diagnosis and written answers.
- O7 now depends on a check after generation, not only on construction. The fallback keeps it at 100% for what is shown; the cost is a template answer when the writer fails, and the fallback rate is measured in M2.
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
