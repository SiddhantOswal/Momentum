# 06. Arc wire contract

Addendum to `04-technical-design.md` section 3.0 (interface decisions I1 to I9). It fixes what the browser sends and receives on every `/api/arc/*` route. It adds no stored field except one nullable field on the turn record (decision D3). Where a name already exists in `04`, `05-ai-design.md`, ADR-0007, ADR-0011 or `src/state-schemas.js`, this file uses it unchanged.

Status: proposed, written 2026-11-24 for the frontend (ARC-M6-02) and the backend tickets (ARC-M2-01, M2-03, M2-05, M2-06). Nothing here was run or measured; every response below is a design, not an observed output. Section 8 lists the choices made where the earlier documents were silent, each with the rejected alternative. Section 9 lists the items that need a founder decision.

## 1. Rules that apply to every route

| Rule | Behaviour |
|---|---|
| Prefix | `/api/arc/*` (I1). The per-IP limiter is mounted on `/api/*`, so it covers every route here |
| Session | From the signed demo cookie only (I2). The browser sends `credentials: "same-origin"`. No request body, query string or header carries `sessionId`. A `sessionId` key in any body or query string gives 400 `VALIDATION_ERROR`; all request schemas are strict |
| Order of checks | Body size limit (413), per-IP rate limit (429), the flag (404 `ARC_NOT_ENABLED`), same-origin on non-GET (403), `authorizeSupervisor` (401), then validation (400) and the route's own checks |
| Same-origin | Non-GET routes require the `Origin` header to match the request URL, as `sameOrigin()` does today. GET routes do not |
| Rate limit | The existing limiter, on every route. Over the limit: 429 `RATE_LIMIT_EXCEEDED` with `Retry-After`. The venue limits in `04` 5.4 apply |
| Body size | 10 MiB global limit (existing) and, per route below, a much smaller limit enforced by the schema |
| Cache | Every response carries `Cache-Control: no-store` |
| Content type | JSON routes: `application/json`. Stream routes: `text/event-stream; charset=utf-8` |

### 1.1 Envelope

Success bodies are `{ ok: true, ... }`. Error bodies keep the dashboard's shape, so one client error handler serves both:

```ts
type ArcError = {
  ok: false;
  error: {
    code: string;                 // stable; the client maps it to words (05 section 6)
    message: string;              // plain English for logs and developers; the UI shows its own mapped string
    issues?: ValidationIssue[];   // 400 only
    retryAfterSeconds?: number;   // 429 only; also sent as Retry-After
  };
};
type ValidationIssue = { field: string; path: (string | number)[]; code: string; message: string };  // as validationFailure() builds today
```

```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "The request is not valid.",
  "issues": [{ "field": "sessionId", "path": ["sessionId"], "code": "unrecognized_keys", "message": "Unrecognized key: sessionId" }] } }
```

### 1.2 Error codes shared by every route

| Status | `code` | When | Source |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad body, query or path ID; unknown key (including `sessionId`); `clientTurnId` not a UUID; bad `Last-Event-ID`; unknown `actionId` | I2 |
| 401 | `DEMO_SESSION_REQUIRED` | No cookie, a bad signature or an expired session | `hackathon-demo-auth.js:68` |
| 403 | `ORIGIN_REQUIRED` | Non-GET request without a same-origin `Origin` | `index.mjs:613` |
| 404 | `ARC_NOT_ENABLED` | `USTAAD_ENABLE_ARC` is off (section 7) | new |
| 404 | `NOT_FOUND` | A run or turn that does not exist, has expired, or belongs to another session. The same answer for all three, so IDs cannot be probed | `index.mjs:515` |
| 413 | `PAYLOAD_TOO_LARGE` | Body over the global limit | `index.mjs:204` |
| 429 | `RATE_LIMIT_EXCEEDED` | The per-IP or per-session limiter, with `Retry-After` | `request-guardrails.js:231` |
| 503 | `DEMO_AUTHORIZATION_NOT_CONFIGURED` | Demo auth is off or incomplete | `hackathon-demo-auth.js:62` |
| 503 | `SERVICE_UNAVAILABLE` | Firestore unreachable or a stored record fails its schema. Fails closed, no memory fallback (`04` 3.1) | `04` 3.1 |

Budget blocks (`GEMINI_DAILY_CAP_EXCEEDED` and its `BUDGET_*` codes) are not HTTP errors on Arc routes. They arrive as a `step.blocked` event (section 3, ADR-0011 item 5), so the stream can stay open for the steps that need no Gemini call.

## 2. Shared types

```ts
type Uuid = string;
type TaskRunId = Uuid;
type ClientTurnId = Uuid;
type IsoTime = string;                       // UTC, e.g. "2026-11-24T09:30:00.000Z"; stored Timestamps are serialised this way
type WaitingFor = "confirm_order" | "confirm_conditions" | "choose_line" | "approve";   // I6
type StepStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "BLOCKED" | "WAITING_FOR_USER" | "SKIPPED";
type RunStatus = "RUNNING" | "WAITING_FOR_USER" | "BLOCKED" | "FAILED" | "COMPLETED" | "CANCELLED";
type RunKind = "lot_preparation" | "photo_check" | "history_search" | "data_question";
type ResultRef = { kind: "po_review" | "job" | "lot" | "trace" | "card" | "turn" | "metric" | "photo"; id: string };

type RunView = {                             // a task-run record with internal fields removed
  taskRunId: TaskRunId;
  kind: RunKind;
  lotId: string | null;
  status: RunStatus;
  steps: StepView[];
  lastSequence: number;                      // last stored event; 0 if none
  resumable: boolean;                        // true when a step is PENDING, or RUNNING with an expired lease
  updatedAt: IsoTime;
};
type StepView = {
  stepId: string;
  tool: string;                              // registry name, 05 section 1
  label: string;                             // fixed copy for the tool, 05 section 6 (G1); set by code
  status: StepStatus;
  attempt: number;                           // 0 to 3
  waitingFor: WaitingFor | null;             // set exactly while status is WAITING_FOR_USER
  errorCode: string | null;
  retrySafe: boolean | null;                 // set for FAILED and BLOCKED steps; derived from the error code in code, 05 section 6
  resultRef: ResultRef | null;
  startedAt: IsoTime | null;
  finishedAt: IsoTime | null;
};
```

Never in `RunView`: `leaseOwner`, `leaseExpiresAt`, `idempotencyKey`, `argsHash`, `version`, `sessionId`.

## 3. Event stream

Used by `POST /api/arc/turns`, `POST /api/arc/runs/:taskRunId/resume` and `GET /api/arc/runs/:taskRunId/events`. The three routes send the same events in the same format.

### 3.1 Frame format

```
id: 7
event: step.started
data: {"sequence":7,"type":"step.started","clientTurnId":"6f1c...","stepId":"plan_lot","tool":"plan_lot","label":"Planning the lot"}

```

- `id` is the run's `sequence` (`ArcEventDocSchema.sequence`, `04` 2.3). It is the `Last-Event-ID` cursor. It starts at 1 for each run and rises by 1 with no gap.
- `event` equals `data.type`.
- `data` is one JSON object on one line.
- A comment line `: keep-alive` is sent every 15 s. It is not an event. The client ignores it.
- The first frame is sent as soon as the stream opens, so a proxy does not hold the response.
- Every event is written to `traces/{taskRunId}/trace_events/{sequence}` before it is sent (I8). Fields marked "code-derived" below are computed when the event is sent and are not stored.

### 3.2 Event types

```ts
type ArcEventBase = {
  sequence: number;                          // same as the SSE id
  clientTurnId: ClientTurnId;                // the turn that produced the event
};
type StepEventBase = ArcEventBase & { stepId: string; tool: string; label: string /* code-derived */ };

type ArcEvent =
  | (ArcEventBase & { type: "run.started"; taskRunId: TaskRunId; kind: RunKind })
  | (StepEventBase & { type: "step.started" })                                   // status RUNNING
  | (StepEventBase & { type: "step.succeeded"; resultRef: ResultRef | null })
  | (StepEventBase & { type: "step.failed"; errorCode: string; retrySafe: boolean /* code-derived */ })
  | (StepEventBase & { type: "step.blocked"; errorCode: string; retrySafe: boolean; retryAfterSeconds?: number /* code-derived */ })
  | (StepEventBase & { type: "step.waiting_for_user"; waitingFor: WaitingFor })  // I6
  | (ArcEventBase & { type: "answer"; resultRef: { kind: "turn"; id: ClientTurnId } })   // I8: a reference, not text
  | (ArcEventBase & { type: "run.completed" })
  | (ArcEventBase & { type: "run.failed"; errorCode: string });

type StreamError = { type: "stream.error"; code: "TRACE_INCOMPLETE" | "SERVICE_UNAVAILABLE" | "REQUEST_TIMEOUT" };   // no id, never stored
```

Rules:

- `errorCode` in `step.failed` and `step.blocked` is the code in the G2 table (`05` section 6). For a budget block it is the specific `BUDGET_*` code, which is the row key in that table (`BUDGET_DAY_EXHAUSTED`, `BUDGET_SESSION_EXHAUSTED`, `BUDGET_RATE_LIMITED`, `BUDGET_RESERVED_FOR_PITCH`, `BUDGET_UNAVAILABLE`); the general name `GEMINI_DAILY_CAP_EXCEEDED` is not repeated in the event.
- A Gemini safety block (`finishReason` `SAFETY` or a `promptFeedback.blockReason`, RAI-5) has the `errorCode` `GEMINI_SAFETY_BLOCKED`, and `retrySafe` is false. On the router path no tool runs and the turn ends with `run.failed` (`sequence: 0`, no task run); the client shows "Gemini blocked this message, so Arc did not act on it. Rephrase it, or use the buttons." and never the J5 refusal text (spec J11, AC11.12). On a tool step that calls Gemini it arrives as `step.failed` with that path's string from `05` section 5, step 6. An answer-writer block is not an event: the turn completes with the template answer and `writerOutcome` `fallback`.
- `retryAfterSeconds` appears in an event only on `BUDGET_RATE_LIMITED` and comes from the budget response. It is not in the stored event, so a replay omits it and the UI shows the same string without the number (decision D8). `PLAN_DAILY_LIMIT_REACHED` also has a `retryAfterSeconds` (the seconds to the next IST midnight), but only in the 429 error body of `POST /jobs` (section 1.1); the Arc `step.blocked` event does not carry it, because its words name midnight IST instead of a count.
- `step.waiting_for_user` carries the same `waitingFor` as the step. `approve` is terminal for Arc: no later event moves the lot forward until the user presses Approve in the client (`04` 2.6, 4.4).
- A fixed action that hands over to the person ends with one extra step that runs no tool. Its `tool` is what the person does next (`confirm_order`, `confirm_conditions` or `approve`), and it is sent only as `step.waiting_for_user`. The turn then ends with `answer` and no `run.completed`; the run's status is `WAITING_FOR_USER` (ARC-M3-01, decision D15).
- Step events carry the state of the `04` enum that they record. `PENDING` and `SKIPPED` are stored and never sent.
- No percentage, no time estimate, no step shown before it starts, and no model tokens (ADR-0011 decision 3 and rejected alternative 5). The `label` is the only progress text.
- Event data holds no answer text, no tool result and no order-derived string (SH-SE-3).

```
id: 9
event: step.waiting_for_user
data: {"sequence":9,"type":"step.waiting_for_user","clientTurnId":"6f1c2a44-8b0e-4d51-9c7a-3e5d1b7f0a21","stepId":"confirm_conditions","tool":"set_conditions","label":"Saving the conditions","waitingFor":"confirm_conditions"}
```

```
id: 12
event: answer
data: {"sequence":12,"type":"answer","clientTurnId":"6f1c2a44-8b0e-4d51-9c7a-3e5d1b7f0a21","resultRef":{"kind":"turn","id":"6f1c2a44-8b0e-4d51-9c7a-3e5d1b7f0a21"}}
```

### 3.3 When a stream ends

The server closes the connection after the last event of the turn (or of the resume). The client decides the state from the last event it received:

| Last event | Meaning | Client action |
|---|---|---|
| `run.completed` | Run finished | Read the turn (section 5.3) if an `answer` came; otherwise done |
| `run.failed` | Run failed | Show the mapped string for `errorCode` |
| `answer` | The turn is done; the run is paused or has no run | Read the turn; read the run (section 4.2) if `taskRunId` is set |
| `step.waiting_for_user`, `step.blocked`, `step.failed` | The run stopped at this step | Show the card or string; read the run for the step list |
| `stream.error` | The server stopped following the run | Reconnect (section 3.4), or read the run |
| none, connection dropped | Network loss | Reconnect (section 3.4) |

Terminal events are `run.completed`, `run.failed`, `answer` and `stream.error`. A turn that makes no tool step (an out-of-scope refusal, a clarification, a router block) has no task run and stores no events. Its stream sends one unstored frame with no `id`: an `answer` event with `sequence: 0`. Recovery for such a turn is `GET /api/arc/turns/:clientTurnId` (decision D2).

### 3.4 Reconnect and replay

- `POST /api/arc/turns` cannot be resumed with `Last-Event-ID` (a POST is not re-sent by the browser's `EventSource`). The client uses `fetch` and reads the body stream. After a drop it either re-posts the same body (same `clientTurnId`, which replays: section 5.1) or opens `GET /api/arc/runs/:taskRunId/events` with `Last-Event-ID`.
- `GET .../events` with `Last-Event-ID: n` sends stored events with `sequence > n` in order, then follows the record (`04` 2.3, ADR-0011 item 6), so any instance can serve it. Without the header it starts at sequence 1.
- The server closes the follow when the run has no RUNNING step with a live lease (paused, blocked, failed, completed or cancelled), after sending every event up to that point. It also closes at 110 s, under the 120 s Cloud Run timeout, and the client reconnects with the last `id`. A run that stopped with its write-through broken ends with `stream.error` `TRACE_INCOMPLETE` (`04` 2.3).
- `Last-Event-ID` that is not a non-negative integer gives 400 `VALIDATION_ERROR`. A value above the last sequence is accepted and sends nothing until a new event arrives.

## 4. Routes

### 4.1 `GET /api/arc/session`

Reads the session record `arc_sessions/{sid}` (`04` 2.5), creating it on the first read. Safe to call repeatedly. It does not resume a run (decision D5).

- Auth: cookie session, flag check, rate limit. GET, so no origin check.
- Request: no body; no query string (an unknown query key is 400).

```ts
type SessionResponse = {
  ok: true;
  session: {
    authorizationMode: "HACKATHON_DEMO";
    identityLabel: "Demo session, simulated";
    expiresAt: IsoTime;                      // sessionExpiresAt, from the cookie
    activeLots: { lotId: string; stage: LotStage; currentJobId: string | null; currentRevision: number }[];   // at most 5, from lot_heads
    jobIds: string[];                        // at most 20, newest last
    activeTaskRunId: TaskRunId | null;
    resumable: boolean;                      // true when activeTaskRunId has a step that POST .../resume would continue
    turnCount: number;
  };
};
type LotStage = "order_review" | "conditions" | "planning" | "draft_review" | "approval_pending" | "approved" | "held";   // 04 2.7
```

```json
{ "ok": true, "session": { "authorizationMode": "HACKATHON_DEMO", "identityLabel": "Demo session, simulated",
  "expiresAt": "2026-11-24T11:30:00.000Z",
  "activeLots": [{ "lotId": "LOT-HACK-3f0c9a1e5b7d4c2a8e6f1b0d9c7a5e34-a1b2c3d4e5f6", "stage": "draft_review", "currentJobId": "JOB-HACK-3f0c9a1e5b7d4c2a8e6f1b0d9c7a5e34-0123456789abcdef0123456789abcdef01234567", "currentRevision": 1 }],
  "jobIds": ["JOB-HACK-3f0c9a1e5b7d4c2a8e6f1b0d9c7a5e34-0123456789abcdef0123456789abcdef01234567"],
  "activeTaskRunId": null, "resumable": false, "turnCount": 3 } }
```

Errors: section 1.2 only. `503 SERVICE_UNAVAILABLE` when Firestore is unreachable.

Never returned: `sessionId`, `version`, `recentTurnIds` (the router's history, not a client concern), conditions values (read them with `GET /lots/:lotId`, the dashboard's route).

### 4.2 `GET /api/arc/runs/:taskRunId`

Task-run state, so the client can draw the step list after a reload or a dropped stream.

- Auth: cookie session, flag check, rate limit. The run's `sessionId` must equal the cookie's session, otherwise 404 `NOT_FOUND`.
- Path: `taskRunId` is a UUID; anything else is 400 `VALIDATION_ERROR`.

```ts
type RunResponse = { ok: true; run: RunView };
```

```json
{ "ok": true, "run": { "taskRunId": "b1c2d3e4-f5a6-4b7c-8d9e-0a1b2c3d4e5f", "kind": "lot_preparation",
  "lotId": "LOT-HACK-3f0c9a1e5b7d4c2a8e6f1b0d9c7a5e34-a1b2c3d4e5f6", "status": "WAITING_FOR_USER", "lastSequence": 9, "resumable": false,
  "updatedAt": "2026-11-24T09:41:12.000Z",
  "steps": [
    { "stepId": "read_order", "tool": "read_order", "label": "Reading the order", "status": "SUCCEEDED", "attempt": 0, "waitingFor": null, "errorCode": null, "retrySafe": null, "resultRef": { "kind": "po_review", "id": "7d2f0a3c-1b4e-4c8a-9e6d-5f3a2b1c0d9e" }, "startedAt": "2026-11-24T09:40:01.000Z", "finishedAt": "2026-11-24T09:40:09.000Z" },
    { "stepId": "confirm_conditions", "tool": "set_conditions", "label": "Saving the conditions", "status": "WAITING_FOR_USER", "attempt": 0, "waitingFor": "confirm_conditions", "errorCode": null, "retrySafe": null, "resultRef": null, "startedAt": "2026-11-24T09:41:10.000Z", "finishedAt": null }
  ] } }
```

Errors: 400, 401, 404 `NOT_FOUND`, 404 `ARC_NOT_ENABLED`, 429, 503 (section 1.2). An expired run (past `expiresAt`, even if TTL has not deleted it) is 404 `NOT_FOUND`.

### 4.3 `POST /api/arc/runs/:taskRunId/resume`

Continues the first unfinished step after a restart or a dropped connection (`04` 3.4). Work only advances inside a request, so this request runs the step.

- Auth: cookie session, same-origin, rate limit. Ownership as in 4.2.
- Request body: none, or `{}`. Any key is 400 `VALIDATION_ERROR` (strict).
- Request header: `Accept: text/event-stream, application/json`.

Two success responses:

```ts
// 200, application/json: nothing to resume
type ResumeNoopResponse = { ok: true; resumed: false; reason: "COMPLETED" | "WAITING_FOR_USER" | "BLOCKED" | "FAILED" | "CANCELLED" | "RUNNING_ELSEWHERE"; run: RunView };
// 200, text/event-stream: a step was resumed. Same frames as section 3, starting after run.lastSequence.
```

```json
{ "ok": true, "resumed": false, "reason": "WAITING_FOR_USER", "run": { "taskRunId": "b1c2d3e4-f5a6-4b7c-8d9e-0a1b2c3d4e5f", "kind": "lot_preparation", "lotId": "LOT-HACK-3f0c9a1e5b7d4c2a8e6f1b0d9c7a5e34-a1b2c3d4e5f6", "status": "WAITING_FOR_USER", "lastSequence": 9, "resumable": false, "updatedAt": "2026-11-24T09:41:12.000Z", "steps": [] } }
```

(`steps` is shortened in this example only. The real response lists every step.)

`RUNNING_ELSEWHERE` means a step holds a live lease in another request, for example a second tab. It is a 200 with that reason and not an error, because the client's right move is to follow `GET .../events` (`04` 3.4 item 5, spec AC11.8). The stream route returns 409 `IN_PROGRESS` only for a turn (section 4.4).

A step whose command cannot be replayed (for example, its PO review expired) becomes BLOCKED and is sent as `step.blocked` in the stream (`04` 3.4 item 4).

Errors: 400, 401, 403, 404 (`NOT_FOUND`, `ARC_NOT_ENABLED`), 429, 503. Budget blocks arrive as events.

### 4.4 `POST /api/arc/turns`

One Arc turn (ADR-0007 items 10 to 12, `04` 3.3).

- Auth: cookie session, same-origin, rate limit.
- Request header: `Accept: text/event-stream`.

```ts
type TurnRequest = {                         // strict: any other key is 400 VALIDATION_ERROR
  clientTurnId: ClientTurnId;                // UUID made by the client; a retry of the same turn reuses it
  input:
    | { kind: "action"; actionId: string; params?: Record<string, string | number | boolean> }   // button or chip; params at most 2 KiB when serialised
    | { kind: "text"; text: string };        // 1 to 1,000 characters after trimming
};
```

```json
{ "clientTurnId": "6f1c2a44-8b0e-4d51-9c7a-3e5d1b7f0a21", "input": { "kind": "text", "text": "What is the R2 of the crack model?" } }
```

`actionId` values are the fixed plans in `config/arc.json` (ARC-M2-03). An `actionId` not in that list is 400 `VALIDATION_ERROR` with issue code `unknown_action`. The server validates `params` against the action's own strict schema.

Actions that take `params` (ARC-M3-01; `src/arc/action-params.js`). Every other action takes none, and any key it is sent is 400. An unknown or extra key is 400 before a turn is claimed.

| `actionId` | `params` | Steps | Ends with |
|---|---|---|---|
| `read_sample_order` | `{ sampleId: "PO1" \| "PO2" \| "PO3" \| "PO4" \| "PO5" }` | `read_order` | `step.waiting_for_user` `confirm_order` |
| `confirm_order` | `{ reviewId: Uuid; lineIndex: number }` (0 to 99) | `confirm_order` | `step.waiting_for_user` `confirm_conditions` |
| `confirm_conditions` | `{ lotId: string; runDate: "YYYY-MM-DD"; shift: "DAY" \| "NIGHT"; ambientRhPct; ambientTempC; paperMoisturePct; paperMoistureSource: "confirmed" \| "example"; sfSpeedMpm; rollTempC; gumApplication: "LOW" \| "MED" \| "HIGH"; gumViscositySec; pastingPressure: "LOW" \| "MED" \| "HIGH"; dryingHours; printSpeedSpm }` | `confirm_conditions`, `plan_lot` | `step.waiting_for_user` `approve` |

- `read_sample_order` reads the server's own copy of the sample with the order context New Lot sends for it (`SAMPLE_ORDER_CONTEXT`). The review ID is derived from the step's effect key, so a resumed step finds the stored review and does not call Gemini again.
- `confirm_order` reads the stored review of this session and takes the item code, quantity and order ID from it. The line must be matched to one catalog item and have a quantity. It opens a lot (`LOT-HACK-<sessionId>-<12 hex>`, derived from the effect key) at stage `conditions` and adds it to the session's `activeLots`.
- `confirm_conditions` works on the lot named in `lotId`, the lot on the card the person pressed. The lot must be in this session's `activeLots`; any other lot, including another session's, ends the turn with `run.failed` `LOT_NOT_FOUND` before anything is saved or planned. It saves the five conditions through the command behind `PUT /lots/:lotId/conditions`, labelled "Confirmed by operator", or "Example value" for paper moisture kept at the 7.3% example (any other value with `example` is refused). It then runs `plan_lot`, the command behind `POST /jobs`, with the planned settings from `params` and the order the server rebuilds from the lot and the stored review: item, quantity, line, review fingerprint, order context, and the file read again from the sample the review came from. The job is added to the session's `jobIds`. Paper moisture planned at the example value is frozen in the revision as "Example value", not "Confirmed by operator"; `POST /jobs` takes the same optional `paperMoistureSource` field.
- Each plan, from Arc or from `POST /jobs`, counts against a limit of lots planned per demo session per IST day (`lotPlans.perSessionPerDay` in `GEMINI_BUDGET_LIMITS`, 10 when unset), checked in Firestore before anything is written or planned. A repeat of a request already counted (same job request identity, as on a replay or resume) is not counted again. Over the limit, `plan_lot` ends with `step.blocked` `PLAN_DAILY_LIMIT_REACHED`, and `POST /jobs` answers 429 with that code and `retryAfterSeconds` to the next IST midnight. The limit applies where the budget store is configured (`USTAAD_GEMINI_BUDGET_POLICY=budget-v2`).
- `GET /lots/:lotId` now also returns `lot.order`: the confirmed catalog item code and quantity, or null before an order is confirmed. The order ID is not returned.
- `confirm_order` refuses a review of any file that is not an approved sample (`ORDER_SAMPLE_REQUIRED`) before it opens a lot.
- No typed text, suggestion text, router output or order content can run `confirm_order` or `confirm_conditions`: they are never declared to Gemini, never in its allowed names, and a suggestion that names an action with `params` goes to the router like any message. Approval stays `POST /jobs/:id/approve`, called only by the Approve button.

Responses:

| Case | Status | Body |
|---|---|---|
| Accepted: new turn | 200 | Event stream (section 3). Response header `Arc-Turn: accepted` |
| Replayed: same `clientTurnId`, same input fingerprint, record `complete` | 200 | The stored events in `eventRange` replayed as a stream, then closed. Response header `Arc-Turn: replayed`. No Gemini attempt. A turn with no task run replays one unstored `answer` frame (`sequence: 0`) |
| Rejected: same `clientTurnId`, different input | 409 | `CONFLICT` |
| Rejected: same `clientTurnId`, in progress with a live lease | 409 | `IN_PROGRESS` with `Retry-After: 5`. The client follows `GET .../events` when it knows the `taskRunId`, or reads the turn (section 5.3) |
| Same `clientTurnId`, in progress with an expired lease | 200 | The retry takes over the lease and runs the turn again: `Arc-Turn: accepted` |
| Same `clientTurnId`, record `failed` | 200 | Replayed as above; the stored events end in `step.failed`, `step.blocked` or `run.failed`. A new attempt needs a new `clientTurnId` (this is how Retry works for a turn) |
| Invalid | 400 | `VALIDATION_ERROR` |
| Other | | Section 1.2 |

```json
{ "ok": false, "error": { "code": "CONFLICT", "message": "This turn ID was used with different input." } }
```

```json
{ "ok": false, "error": { "code": "IN_PROGRESS", "message": "This turn is still running.", "retryAfterSeconds": 5 } }
```

The turn claim, the validation and the replay are decided before the stream opens, so every 4xx and 5xx above is a JSON body, and a 200 always carries a stream. A failure after the stream has opened is an event (`step.failed`, `run.failed`) or `stream.error`, never a changed status code. A turn is bounded by the 120 s Cloud Run timeout (ADR-0011 consequences); at the limit the server sends `stream.error` `REQUEST_TIMEOUT`, and the turn record's lease expires so a retry can take over.

The stream ends as described in section 3.3. An `answer` event means the turn record holds the text; read it with `GET /api/arc/turns/:clientTurnId` (section 5.3).

### 4.5 `GET /api/arc/runs/:taskRunId/events`

Replays and follows a run's events (section 3.4).

- Auth: cookie session, flag check, rate limit. Ownership as in 4.2.
- Header: `Last-Event-ID` (optional). Query: none.
- 200: event stream. 404: `NOT_FOUND` for a run that is not the caller's (section 1.2), `TRACE_NOT_FOUND` when the run exists but its trace head does not (`04` 2.3 residual case). 400: bad `Last-Event-ID` or path.

### 4.6 `GET /api/arc/turns` and `GET /api/arc/turns/:clientTurnId`

New in this addendum, for the history panel (G9) and the answer read (section 5). They share the path of the POST route. Amends I1 by two read routes (decision D1).

### 4.7 `GET /api/arc/reviews/:reviewId`

The stored order review behind a `read_order` step, for the review card (ARC-M3-01, decision D13).

- Auth: cookie session, flag check, rate limit. The review must belong to the cookie's session; a missing, expired or other-session review is 404 `NOT_FOUND`. A path that is not a UUID, or any query key, is 400. A review store fault is 503 `SERVICE_UNAVAILABLE`.

```ts
type ReviewResponse = { ok: true; review: {
  reviewId: Uuid; expiresAt: IsoTime;
  readByGemini: boolean;                     // set by code from the extraction record
  lines: { lineIndex: number; sourcePage: number | null; itemCode: string | null; quantity: number | null;
    status: "MATCHED" | "AMBIGUOUS" | "UNKNOWN_CODE" | "MISSING_ITEM_CODE" | "MISSING_QTY" | "MALFORMED" }[];
} };
```

`itemCode` is the catalog item for a matched line and null otherwise. The buyer, PO number, delivery date, operator context and any item code the catalog did not match are never returned (section 5.2).

## 5. Reading answers and history

### 5.1 Design

The `answer` event carries a reference, as I8 requires (`resultRef.kind: "turn"`, `id` equal to `clientTurnId`). The text and values are read from the turn record through one route, which serves three needs with one code path: the answer under a live turn, a reload, and the history list.

`TurnView` is built by code from `arc_sessions/{sid}/turns/{clientTurnId}` (`04` 2.5a). The answer card is rendered again from `summary.resultRefs` at read time, as 2.5a says. Nothing is copied into the turn record except the checked `answerText`.

```ts
type TurnView = {
  clientTurnId: ClientTurnId;
  taskRunId: TaskRunId | null;
  status: "in_progress" | "complete" | "failed";          // recordStatus
  createdAt: IsoTime;
  input: { kind: "text"; text: string } | { kind: "action"; actionId: string };   // typed text as entered; params are not returned
  answer: AnswerView | null;                              // null while in progress, or when the turn ended with no answer
  errorCode: string | null;                               // set when status is "failed" (decision D3)
};

type AnswerView = {
  text: string | null;                                    // answerText: checked writer text or template text
  generatedByGemini: boolean;                             // true only when summary.writerOutcome is "shown"; set by code, never by the model
  writerOutcome: "not_called" | "shown" | "fallback";     // from the turn summary
  blocks: AnswerBlock[];                                  // re-rendered from resultRefs, at most 8
};
```

`generatedByGemini` is the chip "Generated by Gemini" (spec section 5, G17). It is false for template answers, the template fallback, refusals, "insufficient data" and every button path (ARC-M2-05 AC). The plan explanation and photo diagnosis carry their own chip on their own blocks (`block.generatedByGemini`).

```ts
type Label = string;                                      // exact chip text from spec section 5, set by code from the command response
type Suggestion = { actionId: string; label: string };    // fixed copy; an action the client posts as input.kind "action"

type AnswerBlock = { blockId: string } & (
  | { kind: "value"; title: string; value: string | number | null; unit: string | null;
      labels: Label[]; note: string | null }              // null value with the label "Missing", never 0
  | { kind: "chart"; title: string; series: { name: string; value: number; unit: string | null; labels: Label[] }[];
      labels: Label[]; note: string | null }              // for example the five model scores with "Modeled, tested on 219 lots"
  | { kind: "no_data"; missing: string; alternatives: Suggestion[] }              // missing text is the dictionary's (ADR-0009)
  | { kind: "refusal"; suggestions: Suggestion[] }                                // fixed copy; at most three
  | { kind: "follow_ups"; suggestions: Suggestion[] }
  | { kind: "reference"; ref: ResultRef; labels: Label[]; generatedByGemini: boolean }   // a job, lot, photo or po_review the client reads with its existing route
  | { kind: "unavailable"; ref: ResultRef; errorCode: string }                    // the source record has expired or cannot be read
);
```

Rules:

- Labels come from command responses and the dictionary in code (`05` section 4), never from model text. The chip strings are the spec section 5 strings.
- A `reference` block names a record; the client reads the record with the dashboard route that already serves it (`GET /jobs/:id`, `GET /lots/:lotId`, `GET /jobs/:id/card.pdf`, the approved-photo routes). This avoids a second copy of job and lot data in Arc responses (one source of truth, CLAUDE.md section 4).
- `value`, `chart`, `no_data`, `refusal` and `follow_ups` are the fields the designs need (`Arc-Answer-Value`, `Arc-Answer-Chart`, `Arc-No-Data`, `Arc-Out-Of-Scope`). The data engineer (ARC-M4-04) may add fields to a block kind, never a new way to read it, and the type above is the version the frontend builds against.
- `unavailable` replaces a block when its source has expired; the card is never shown from stale memory (CLAUDE.md section 3: no value without its source).

### 5.2 What is never returned

By any route in this file: prompts, router or writer instructions, tool arguments and raw tool results, model output other than the checked `answerText`, PO file text, order-derived free text (buyer name, addresses, notes; the list is in `05` section 4), `params` of an action, effect keys, argument hashes, lease owners and tokens, `inputFingerprint`, `ownerToken`, session IDs, secrets, signing keys, the pitch reserve code and any budget counter. The turn's `input.text` is the user's own typed text, returned to that session only (it is stored for 7 days, `04` 2.5a).

### 5.3 Routes

**`GET /api/arc/turns/:clientTurnId`**

- Auth: cookie session, flag check, rate limit. The turn must be under the cookie's session, otherwise 404 `NOT_FOUND` (also for an expired turn).
- Response: `{ ok: true, turn: TurnView }`. While `status` is `in_progress` the answer is `null`; the client waits for the `answer` event or reads again after `Retry-After`.

```json
{ "ok": true, "turn": { "clientTurnId": "6f1c2a44-8b0e-4d51-9c7a-3e5d1b7f0a21", "taskRunId": "c4d5e6f7-0a1b-4c2d-8e3f-5a6b7c8d9e0f",
  "status": "complete", "createdAt": "2026-11-24T09:44:30.000Z", "errorCode": null,
  "input": { "kind": "text", "text": "What is the R2 of the crack model?" },
  "answer": { "text": "The crack model scores an R2 of 0.640 on the 219 September holdout lots. It is a modeled result, not a measured one.",
    "generatedByGemini": true, "writerOutcome": "shown",
    "blocks": [{ "blockId": "b1", "kind": "chart", "title": "R2 per model, September holdout", "labels": ["Modeled, tested on 219 lots"], "note": "They come from modeled history, not measured production.",
      "series": [{ "name": "Crack", "value": 0.64, "unit": null, "labels": ["Modeled, tested on 219 lots"] }] }] } } }
```

(The example shows one series entry. A real chart block lists the five model scores from `config/model-acceptance.json`.)

**`GET /api/arc/turns`**

History for the clock icon (G9).

- Query: `limit` (integer 1 to 20, default 10) and `before` (an opaque cursor from a previous response). Any other key is 400.
- Order: newest first, by `createdAt`, then `clientTurnId`.
- Bounds: only this session's turns, which live at most 7 days and in practice at most the 2 h session. At most 20 per page. The list response carries no `blocks`, so a page stays small (at most about 20 KiB); the client reads one turn in full with the route above when the user opens it.

```ts
type TurnListResponse = {
  ok: true;
  turns: (Omit<TurnView, "answer"> & { answer: { text: string | null; generatedByGemini: boolean } | null })[];
  nextBefore: string | null;                // null on the last page
};
```

```json
{ "ok": true, "turns": [{ "clientTurnId": "6f1c2a44-8b0e-4d51-9c7a-3e5d1b7f0a21", "taskRunId": null, "status": "complete", "createdAt": "2026-11-24T09:44:30.000Z", "errorCode": null,
  "input": { "kind": "text", "text": "Can you order me a pizza?" },
  "answer": { "text": "I can only answer questions about Momentum, its lots, data, models, defects and job cards.", "generatedByGemini": false } }],
  "nextBefore": null }
```

Each page uses one Firestore query scoped to the parent path, with a single-field order that Firestore indexes by default. No composite index is required. A page with a requested size of N reads at most N + 1 documents. The extra document is read only to determine whether another page exists, and it is never returned in the response. Reading does not use the Gemini budget.

## 6. Failure modes the client must handle

| Situation | Signal | Client |
|---|---|---|
| Arc not enabled | 404 `ARC_NOT_ENABLED` | Designed "not connected" state (section 7) |
| Cookie missing or expired | 401 `DEMO_SESSION_REQUIRED` | Start a session with `POST /api/auth/demo-session`, then repeat the request once |
| Origin check fails | 403 `ORIGIN_REQUIRED` | Developer error; show the generic failure string |
| Rate limited | 429 `RATE_LIMIT_EXCEEDED`, `Retry-After` | Wait, then repeat. Turn requests reuse the same `clientTurnId` |
| Firestore down | 503 `SERVICE_UNAVAILABLE` | "Arc could not read or save its records. Nothing was changed. Try again." (G2 string) |
| Stream drops | Connection closes with no terminal event | Section 3.4 |
| Two tabs | 409 `IN_PROGRESS`, or resume reason `RUNNING_ELSEWHERE` | Follow `GET .../events`; both tabs show the same events |
| Gemini cap reached | `step.blocked` with a `BUDGET_*` code | G2 string; buttons that need no Gemini call stay enabled |
| Retry after a failed step | New `clientTurnId`, same action | The `attempt` of the step rises (`04` 3.3) |
| Order review expired, missing or another session's | `step.blocked` or `run.failed` with `ORDER_REVIEW_EXPIRED` | "This order review has expired. Read the order again." |
| Line not matched to one catalog item with a quantity | `step.blocked` with `ORDER_LINE_NOT_CONFIRMABLE` | "This line is not matched to one catalog item with a quantity, so Arc cannot confirm it. Read the order again or use New Lot." |
| Stored review not read from an approved sample | `run.failed` with `ORDER_SAMPLE_REQUIRED` | "Arc reads the approved sample orders only. Choose PO1 to PO5." |
| No confirmed order in the session, or a `lotId` this session does not hold | `run.failed` with `LOT_NOT_FOUND` or `CONFIRMATION_REQUIRED` | "Arc has no lot in this session yet. Read an order and confirm it first." or "Confirm the order and the conditions first." |
| Session's daily plan limit reached | `step.blocked` with `PLAN_DAILY_LIMIT_REACHED` (Arc); 429 with the same code (`POST /jobs`) | "This session has planned as many lots as it can today. Planning opens again at midnight IST (02:30 in Singapore)." No Retry |
| Plan request clashes with an earlier one under the same key | `step.failed` with `CONFLICT` from `plan_lot` | "These values clash with an earlier plan for the same step. Press Confirm conditions again." (not the turn route's reused-turn words) |
| Lot changed while the draft was prepared | `step.failed` with `REVISION_CONFLICT` | "The lot changed while this draft was being prepared. Plan the lot again." |
| Lot outside this demo session | `step.failed` with `DEMO_SCOPE_REQUIRED` | "This lot belongs to another demo session, so Arc cannot use it here." |

Retry behaviour on the server: a turn or resume is idempotent by `clientTurnId` and by effect key, so a repeated request replays and spends nothing. Quotas: the per-IP limiter (`04` 5.4), the Gemini budget (`04` 5.2) and the 1,000-character text limit. Cost per day at demo load: these routes add Firestore reads and writes only. At the 20 events per J1 run that `ADR-0011` estimates (not measured) and about 10 runs, the estimate is a few hundred small writes a day; the Firestore quota and the cost are not checked here, and M2-08 measures the writes. Rollback: set `USTAAD_ENABLE_ARC` off; the routes then answer 404 `ARC_NOT_ENABLED` and the dashboard is unaffected (`04` 3.5 step 9).

## 7. "Not connected" behaviour

When `USTAAD_ENABLE_ARC` is not `true`:

- Every `/api/arc/*` route, including unknown paths under the prefix, returns `404` with `{ "ok": false, "error": { "code": "ARC_NOT_ENABLED", "message": "Arc is not enabled on this deployment." } }`.
- The flag check runs before authentication, so the client sees the state without a session cookie, and no Firestore read or write happens.
- The client treats `ARC_NOT_ENABLED` from `GET /api/arc/session` (its first call) as the designed "not connected" state, keeps the dashboard working, and does not poll. It checks again only when the panel is opened.
- Arc enabled but its stores not configured (Firestore flags off or unreachable) is 503 `SERVICE_UNAVAILABLE`, a different state with different words ("could not read or save its records"), because the cause and the user's next step differ (`04` 3.1 fail closed).
- The mic button is unaffected: it is disabled in code until a voice backend exists (CLAUDE.md section 4).

## 8. Decisions made where the earlier documents were silent

For founder review. Each has the alternative rejected.

| # | Decision | Rejected alternative and why |
|---|---|---|
| D1 | Two read routes, `GET /api/arc/turns` (list) and `GET /api/arc/turns/:clientTurnId` (one). They amend I1 by adding two read routes under the same prefix. | `GET /api/arc/session/turns...` as the caller first suggested: a longer path for the same thing, and it mixes the session record with the turn subcollection. Returning turns inside `GET /api/arc/session`: the response would grow with history and have no pagination. |
| D2 | The `answer` event carries a reference only; the client reads the turn once. A turn that makes no tool step has no task run, stores no events, and sends one unstored `answer` frame with `sequence: 0`. | Embedding the answer in the event: it would need the text in the stored event (breaks I8) or a second render path for live and for replay. Creating a task run for every turn: a refusal would write a run, a trace head and events for nothing, and `RunKind` has no kind for it. Cost of D2: one extra GET per answer, small against the per-IP limit proposed in `04` 5.4 (300 per minute). |
| D3 | The turn record gains one nullable field, `errorCode` (max 64 characters), set when `recordStatus` is `failed`. This is the only stored-field change in this file, additive, in ARC-M2-01. | Reusing `summary.fallbackReason`: `summary` is null while a turn has no summary, and a blocked turn has none. A replay of a blocked turn without a task run would then have no code to show. |
| D4 | `POST /api/arc/turns` always answers 200 with a stream once the claim succeeds. Replay is the same stream with `Arc-Turn: replayed`. Pre-stream failures are JSON. | Returning JSON for a replay: the client would need two readers for one request. Changing the status code after the stream opens: HTTP does not allow it. |
| D5 | `GET /api/arc/session` reports `resumable` and does not resume. The client posts `.../resume`. | `04` 3.4 item 2 says a `GET /api/arc/session` with `activeTaskRunId` set also triggers a resume. Both positions: (a) `04` 3.4: the session read advances the run, one fewer client call; (b) this file: a GET that spends Gemini attempts and writes is not safe to repeat, prefetch or retry, and the client cannot see what it started. This file follows (b). Needs a founder decision (section 9) because it changes `04` 3.4. |
| D6 | `POST .../resume` returns a stream when it resumes a step and JSON (`resumed: false` with a reason) when there is nothing to resume or another request holds the step. | A 409 for the second tab: the second tab's right move is to follow the events, which is not a failure. A JSON response that waits for the work: up to 120 s with no progress shown. |
| D7 | Streams close after the last event of the turn (paused, blocked, failed or complete). The client reads the last event to know why. No extra `stream.end` event. | A new terminal event type: ADR-0011 owns the list, and the existing events already say where the turn stopped. |
| D8 | `retryAfterSeconds` is computed when the event is sent and is not stored, so a replay of a `BUDGET_RATE_LIMITED` block omits it. | Adding it to `ArcEventDocSchema`: a stored schema change for a value that is only useful live. |
| D9 | Unknown, expired and other-session runs and turns all return 404 `NOT_FOUND`. | 403 for other-session IDs: it confirms the ID exists. |
| D10 | Flag off is 404 `ARC_NOT_ENABLED`, checked before authentication. | 503: it reads as a transient fault and invites retries. 404 with the default body: no stable `code` for the UI. |
| D11 | The turn list returns no `blocks`; the single-turn route returns them. | Blocks in the list: a page of 20 would re-render up to 160 result references for a panel that shows one line each. |
| D12 | `actionId` shape and `params` limits are fixed here (string; scalar values; at most 2 KiB); the action list lives in `config/arc.json` (M2-03). | Free-form `params` objects: they would reach the strict per-action schema without a size bound. |
| D13 | ARC-M3-01: one more read route, `GET /api/arc/reviews/:reviewId`, returns the stored review's lines to the review card. Amends I1. | Reading the lines from the `read_order` result in the client: no event or turn read carries a tool result (section 5.2), so the client never had them. A `reference` block with the lines: blocks are rebuilt on every turn read, and a review expires after 30 minutes. |
| D14 | ARC-M3-01: `confirm_conditions` takes flat params (`lotId`, the five conditions, `paperMoistureSource` and the seven settings), as D12 requires. `lotId` names the lot on the card and must be one this session holds. | The build packet's nested `{ conditions, sources, levers }`: nested objects are refused by the turn route's params schema (D12). The fields and their meaning are the same. Planning the session's newest lot without a `lotId` (the first build): with two lots open, a press on lot A's card planned lot B (QA, M3-01 fix round). |
| D15 | ARC-M3-01: a fixed action that hands over to the person adds one step that runs no tool and is sent only as `step.waiting_for_user`; the turn ends with `answer` and no `run.completed`. | Marking the last tool step as waiting: it succeeded, and its result reference would be lost. Ending with `run.completed`: the run is paused for the person, not finished. |

## 9. Items for a founder decision

1. **D5 against `04` 3.4 item 2.** Should `GET /api/arc/session` resume a run (the existing text) or only report `resumable` (this file's choice)? Recommendation: report only. If the founders keep the existing text, delete `resumable` from `SessionResponse` and the session read gains write effects that M2-01 must test for double-run.
2. **D3.** Approve the one additive field on the turn record (`errorCode`). If not approved, a blocked turn that has no task run cannot be replayed with its reason.
3. **D1.** Confirm that adding two GET routes to the list in I1 is acceptable.

## 10. Route-to-ticket map

Checked against `tickets/M2-tool-registry-and-orchestration.md` and `tickets/M6-arc-ui.md`.

| Route | Implemented by | Consumed by |
|---|---|---|
| `GET /api/arc/session` | ARC-M2-01 (store and route) | ARC-M6-02 (panel opens, reads it), ARC-M6-03 (active lot, resume) |
| `GET /api/arc/runs/:taskRunId` | ARC-M2-01 (task-run store and route) | ARC-M6-03 (step list after reload) |
| `POST /api/arc/turns` | ARC-M2-01 (validation, session scope, turn record, 409 cases), ARC-M2-03 (turn runner and stream), ARC-M2-05 (answer text and checks) | ARC-M6-02 (send box, chips), ARC-M6-03, ARC-M6-04 |
| `GET /api/arc/turns`, `GET /api/arc/turns/:clientTurnId` | ARC-M2-01 (turn read and pagination), ARC-M2-05 (`AnswerView` and blocks, the Gemini flag) | ARC-M6-02 (history clock, G9), ARC-M6-04 (answer, refusal, no-data screens) |
| `GET /api/arc/runs/:taskRunId/events` | ARC-M2-06 | ARC-M6-03 (loading and failure states), ARC-M6-02 (reconnect) |
| `POST /api/arc/runs/:taskRunId/resume` | ARC-M2-06 | ARC-M6-03 |
| `GET /api/arc/reviews/:reviewId` | ARC-M3-01 | ARC-M3-01 (Arc-Lot-Review card) |
| Flag off: `ARC_NOT_ENABLED` | ARC-M2-01 | ARC-M6-02 (not-connected state) |

Contradictions found in the tickets and fixed by minimal edits in this branch:

1. `ARC-M2-01` said the session job list is "newest first"; `04` 2.5 says "newest last, oldest dropped". The ticket now follows `04`.
2. `ARC-M2-01` AC said a replayed `clientTurnId` "returns the stored events", but the events store and replay belong to `ARC-M2-06` (which depends on M1-07). The ticket now covers the 409 cases and the replay of the turn record, and M2-06 covers event replay.
3. `ARC-M6-02` needs the session and turn read routes (history clock, G9) but depended only on M6-01; `ARC-M6-04` needs the answer read from `ARC-M2-05`, and `ARC-M6-03` needs the session and run reads from `ARC-M2-01`. Dependencies are added.
4. No ticket owned the history list and single-turn read. They are now in `ARC-M2-01` and `ARC-M2-05`.
