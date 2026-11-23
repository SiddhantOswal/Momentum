# ADR-0011: Streaming of real step states

Status: Proposed
Date: 2026-11-23 (amended the same day for founder decision A3, and for the M0 gate items SH-CR-1 to SH-CR-7 and SH-CE-8 to SH-CE-10)
Author role: AI architect
Related: `05-ai-design.md` section 6; `04-technical-design.md` sections 2.6 and 3.4; spec 3.1, J11 and design gaps G1, G2, G16; ADR-0002, ADR-0004, ADR-0007

## Context

- A J1 planning step runs BigQuery ML and one or two Gemini calls, estimated at 15 to 40 s (not measured). Users need to see what is running (spec 3.1, Loading: "No spinner without words").
- The approved designs have no Arc loading state (G1) and no failed or cap-reached state (G2).
- v2 already streams trace events over SSE at `GET /api/runs/:runId/events` (`src/trace-routes.js`) with a `Last-Event-ID` cursor, but from an in-memory registry. `momentum` runs up to 4 instances with best-effort session affinity.
- Pitch-day risk: the venue network may drop connections, and Arc should avoid polling (spec section 11).
- CLAUDE.md section 3: never show something as done when it is not.

## Decision

1. `POST /api/arc/turns` responds with a server-sent event stream. The turn's work runs inside that request.
2. Event types: `run.started`, `step.started`, `step.succeeded`, `step.failed`, `step.blocked`, `awaiting_human`, `answer`, `run.completed`, `run.failed`. Each step event records one state of the `04` enum (`RUNNING`, `SUCCEEDED`, `FAILED`, `BLOCKED`, `WAITING_FOR_USER`); `PENDING` and `SKIPPED` are stored but not sent. `awaiting_human` fires when a step enters `WAITING_FOR_USER` and carries `waitingFor` (`confirm_order`, `confirm_conditions`, `choose_line`, `approve`; `04` I6). Each event is written to `traces/{taskRunId}/trace_events/{sequence}`, trace kind `arc_task_run` (`04` I8), before it is sent, with a per-run sequence number. An `answer` event stores the turn reference, not the text; the text is on the turn record.
3. Only real state changes are sent. No percentages, no time estimates, no step shown before it starts, and no event for a step that was skipped. A keep-alive comment every 15 s is not rendered.
4. Each tool has one fixed label for `step.started` (for example "Reading the order", "Planning the lot", "Checking the job card"; full list in `05` section 6). Labels are versioned copy for the designer to approve under G1.
5. `step.failed` carries a mapped error code and whether Retry is safe (the step is idempotent). `step.blocked` carries the rule: `GEMINI_DAILY_CAP_EXCEEDED` with its `BUDGET_*` code, expired review, replaced revision, a step running in another tab, non-allowlisted file, unconfirmed inputs. Each code has one UI string, listed in `05` section 6 for G2 and G10. A safety block has its own string on each path (ADR-0010).
6. Reconnect: `GET /api/arc/runs/:taskRunId/events` with `Last-Event-ID` replays stored events from Firestore, then follows the record with a snapshot listener (as `live-store.js` does). This works on any instance. An unfinished step resumes through `POST /api/arc/runs/:taskRunId/resume` with the same effect key (ADR-0007 item 15).
7. The same ownership rule as the existing trace route applies: a session sees only its own runs.

## Consequences

- The loading copy is honest by construction, and the `failure-handling` suite can assert that no `step.succeeded` precedes a stored result.
- A dropped connection loses no state. A re-run after a step that died before storing anything may spend another Gemini attempt; the turn record shows it.
- Firestore writes per J1 run: about 20 small event documents (estimate, measured in M2).
- The SSE route needs a timeout above the 60 s default for long turns, kept under the Cloud Run request timeout of 120 s; the value is set in ADR-0006.
- The designer must supply G1 and G2 screens. Until then the frontend renders the step label as plain text in the Arc panel.

## Alternatives rejected

1. **A spinner with a timed sequence of messages.** Shows progress that has not happened, which breaks CLAUDE.md section 3.
2. **Client polling of a status endpoint.** Adds requests against the 60-per-minute per-IP limit on a shared venue IP, and gives slower updates.
3. **Reuse the in-memory trace registry.** Events are lost when a reconnect lands on another instance.
4. **WebSockets.** No existing use in v2, adds a second transport, and SSE already exists with a tested cursor format.
5. **Stream model tokens to the user.** Written answers (founder decision A3) and explanations are shown only after their checks pass, so partial text could show numbers that later fail. The writer step shows "Writing the answer" until the checked text or the template arrives.
