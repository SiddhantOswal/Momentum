# 04. Technical design: Arc on the v2 backend

Status: Approved with the plan on 2026-11-23, M0. Amended 2026-11-23 for the M0 gate, round 1 (`reviews/M0-review.md`). Author role: solutions architect. Date: 2026-11-23. Based on `origin/v2` at `eb6eab9`; first written on `arc/m0-discovery`.

Inputs: `01`, `02` (C8, C11, C12, C16, C17, C20, section 11), `03-discovery-audit.md`, `data/data-audit.md`, `data/stale-claims.md`, ADR-0001, and the V5 contracts and policies as a baseline (not quoted). Where the founder brief differs from V5 the brief wins: approval is a checkbox plus Approve inside Arc, identity stays a labelled demo session, and the mic button is shown but disabled.

Decisions are in ADR-0002 to ADR-0006. The AI architect owns ADR-0007 to ADR-0011 (orchestration and tool registry, model choice, grounded query layer, guardrails, streaming). This document is the source for the state contracts those ADRs build on: the interface decisions (3.0), the records in section 2, effect keys and the turn record (3.3) and the budget check API (5.2). `05-ai-design.md` and ADR-0007 follow it.

No code, git state or cloud resource was changed for this document. Cloud reads were `describe`, `list`, `get-iam-policy`, one Firestore document `GET` (counter fields only) and two `gcloud logging read` queries summarised without client addresses (section 0).

## 0. New evidence gathered for this design

| # | Read | Finding |
|---|---|---|
| E1 | `gcloud logging read` for `momentum`, `httpRequest.status=429`, 14 days | 64 responses, all on 2026-11-20, all on `momentum-v2be-6`, all with the platform message "The request was aborted after waiting too long for an available instance". Three distinct clients. None came from the app's per-IP limiter, which also covers none of the paths hit (`/app/`, `/favicon.ico`, fonts). This is instance saturation at the old max of 2, not rate limiting. |
| E2 | Same log, app error `CLIENT_IP_UNAVAILABLE` or limiter text | None in 14 days. The limiter key source (socket address versus client) is still NOT VERIFIED from logs; section 5.4 gives the check. |
| E3 | `gcloud run services describe momentum` | Image in the project's Artifact Registry repository in `asia-south1`; 31 env vars, 2 from Secret Manager; no min instances; service-level max above the 6 proposed in 5.6; CPU throttled; startup boost off; timeout 120 s; 1 vCPU, 1 GiB; execution environment annotation not set (platform default). |
| E4 | `gcloud firestore fields ttls list` | No TTL policies exist on `(default)`. |
| E5 | Firestore `gemini_daily_usage/2026-11-23` | Not found (no attempts yet today). 21 and 22 November returned a transient 503; not retried further. |
| E6 | Code: `src/job-idempotency.js` `createJobRequestIdentity` | **The request fingerprint ignores conditions.** `index.mjs:1117` passes `conditions`, but the function only hashes file, operator fields, item confirmation, review fingerprint, shift and levers. Two `POST /jobs` calls that differ only in moisture, humidity, temperature or run date get the same fingerprint. Without an `Idempotency-Key` they get the same job ID, and the second call replays the first job. Both clients work around it by minting a new key when conditions change (`web/src/screens/Lots.tsx:146-147`, `src/ui/workflow.js:1347-1357`). This breaks AC1.16 at the server and must be fixed before Arc calls `/jobs`. |
| E7 | Code: `src/google-cloud/firestore-gemini-attempt-store.js` `decodeCount` | **The shared counter rejects a day document written under a different cap.** `decodeCount` throws `GEMINI_USAGE_POLICY_MISMATCH` unless the stored `configuredCap` equals the caller's limit. `momentum` now uses 300 and `prepagent` 100, and both write `gemini_daily_usage/<day>`. Whichever service makes the first attempt of the day locks the other out of Gemini until midnight IST. Not yet observed live (E5: no document since the cap change). If `prepagent` is used first on 4 December, `momentum` cannot call Gemini that day. |
| E8 | Code: `src/service-ports.js:72-76` `readOptimizerQueryBudget` | Default is `RISK_PREDICTION_MAX_BYTES_BILLED` (80 MiB, line 67). Only 80 or 100 MiB are accepted. Production works because the env var is 100 MiB. |
| E9 | Code: `index.mjs:1228` `/jobs/:id/approve`; `job-card-service.js:107` `approveJob` | Approve takes only the job ID. Any DRAFT with this session's prefix is approvable, including one an input change has made out of date. Neither client sends a body (`Lots.tsx:265`, `workflow.js:1522`). |

## 1. Target architecture

### 1.1 Components

Everything runs in the existing `momentum` Cloud Run service in `asia-south1`. No new service, database or provider (ADR-0001).

| Component | Where | New or reused |
|---|---|---|
| Hono app, auth, timeout, body limit, rate limit | `index.mjs`, `src/request-guardrails.js` | Reused. Rate-limit key fixed (5.4) |
| **Command layer** | `src/commands/*.js` | **New, by extraction.** The validation and orchestration now inline in `index.mjs` route handlers moves into plain functions. Dashboard routes parse HTTP and call them; Arc tools call the same functions in process. No logic is copied |
| Arc area | `src/arc/` | **New.** `routes.js` (Hono sub-app at `/api/arc`), `session-store.js`, `task-run-store.js`, `tools/` (adapters over `src/commands`, shape per ADR-0007), `budget.js` client of 5.2 |
| Durable stores | `src/google-cloud/firestore-*.js` | `firestore-idempotency-store.js` reused and wired; new `firestore-po-review-store.js`, `firestore-trace-store.js`, `firestore-lot-revision-store.js`, `firestore-budget-store.js`, `firestore-weather-store.js`. All use one shared REST helper, `firestore-rest.js`, extracted from the two existing adapters (value codecs, `beginTransaction`, `commit` with preconditions, `rollback`). No new npm package |
| State schemas | `src/state-schemas.js` | **New**, zod 4, same style as `src/schemas.js` (section 2) |
| Conditions | `src/conditions/` | **New** `ConditionsSource` implementations (section 6) around the reused `createConditionGuard` |
| BigQuery | dataset `prepagent` | Reused unchanged: `job_sheets` stays the record of DRAFT and APPROVED JobSheet records, `lots`, `items`, models, `impact_lots_v2`. Read-only views P3 to P5 belong to the AI architect's grounded query ADR (ADR-0009) |
| Firestore `(default)` | Native, asia-south1 | Reused. New collections in section 2. PITR and delete protection stay off (no change proposed; see ADR-0002 consequences) |
| Cloud Storage | `prepagent-hack-data` | Reused for POs, photos and job card PDFs |
| Vertex AI Gemini | `gemini-3.5-flash`, `asia-south1` | Reused through `withDailyGeminiCallCap`, whose store becomes the budget store (ADR-0004) |
| Secret Manager | demo signing key, weather key; pitch reserve code | Reused, plus one new secret for the pitch reserve (5.2, ADR-0004) |

### 1.2 Command functions Arc reuses

Arc calls these and nothing else for business effects. The left column is the new command entry point (a thin extraction); the right column is the existing function that does the work. Arc tool names are the registry names in `05-ai-design.md` section 1.

| Command (new file:function) | Existing function it wraps | Used by |
|---|---|---|
| `src/commands/authorize.js:authorizeSupervisor` | `index.mjs:requireSupervisor` (moved, unchanged logic), `src/hackathon-demo-auth.js:createHackathonDemoAuthenticator().authenticate`, `src/user-session-auth.js:canApprove` | Every route, every Arc turn. The principal, and so the session ID, comes only from the signed cookie |
| `src/commands/read-order.js:readOrder` | `src/purchase-order-file.js:identifyPurchaseOrderMimeType`, `src/synthetic-po-allowlist.js:isApprovedSyntheticPurchaseOrder`, `src/purchase-order-review.js:createPurchaseOrderReviewService().extractForReview` (via `servicePorts.extractOrderForReview`) | `POST /orders/extract`, Arc `read_order` |
| `src/commands/plan-lot.js:planLot` | the `/jobs` handler body after multipart parsing (`index.mjs:954-1150`), `src/job-idempotency.js:createJobRequestIdentity`, `src/hackathon-demo-auth.js:demoJobIdentity`, `src/job-draft-persistence.js:createJobSubmissionHandler` → `createIdempotentJobService` → `createPersistableJobCreator` → `src/job-coordinator.js:createJobCoordinator` (`confirmPurchaseOrderReview`, condition guard, `predictRisk`, `optimizeRisk`, `findSimilarRuns`, `explainRisk`) → `src/google-cloud/job-sheet-repository.js:createDraft` | `POST /jobs`, Arc `plan_lot` |
| `src/commands/get-job.js:getJob` | `src/stored-job-sheet-lookup.js:createStoredJobSheetLookup` | `GET /jobs/:id`, Arc `get_job` |
| `src/commands/approve-job.js:approveJob` | `src/google-cloud/job-card-service.js:approveJob` → `job-sheet-repository.js:approve` | `POST /jobs/:id/approve` **only**. Not exposed to any Arc tool (section 4) |
| `src/commands/get-card.js:getCard` | `job-card-service.js:getJobCard` | `GET /jobs/:id/card.pdf`, Arc `get_job_card` (receipt check) |
| `src/commands/update-conditions.js:updateLotConditions` | new lot-revision store (2.7), `src/condition-guard.js:isWithinRange`, `paperMoistureIssue` | NEW `PUT /lots/:lotId/conditions`, Arc `set_conditions` (unconfirmed drafts only; Confirm conditions stays a button) |
| `src/commands/read-weather.js:readWeather` | `src/google-cloud/weather-service.js:createWeatherProviderFromEnv` behind the shared cache (6.3) | `GET /conditions/weather`, condition guard, Arc `get_weather` |
| `src/commands/photos.js:listApprovedPhotos`, `classifyApprovedPhoto`, `diagnoseUploadedPhoto` | `approved-photo-service.js:list`, `classify`; `defect-diagnosis-service.js:diagnose` plus `findSeenBefore` (the `/evidence/diagnose-photo` handler body) | `/evidence/*`, Arc `list_approved_photos`, `diagnose_approved_photo`; upload stays a button path |
| `src/commands/history.js:findSeenBefore` | `risk-evidence-service.js:createSeenBeforeService` | `POST /evidence/seen-before`, Arc `search_defect_history` |
| `src/commands/status.js:modelScores`, `impactSummary` | `src/model-acceptance.js:getModelAcceptanceSummary`; `impact-summary-service.js` | `/api/status`, `/impact/summary`, Arc `get_status`, `query_metric` (ADR-0009) |

The extraction is mechanical and is the first backend ticket: move a handler body into a function with the signature `(input, { principal, signal }) => result`, keep the route as parser plus call, and keep every existing route test green with no assertion change. A parity test then calls each command once through HTTP and once in process with the same input and compares the results field by field, which is O3 at the unit level.

### 1.3 Routes

Existing routes keep their paths and responses. Changes:

| Route | Change |
|---|---|
| `POST /jobs` | Optional `lotId` field. Response gains `revision: { lotId, number, fingerprint, status }`. Optional per-field `conditionSources` (C20, 6.4) |
| `GET /jobs/:id` | Response gains the same `revision` block |
| `POST /jobs/:id/approve` | JSON body `{ reviewConfirmed: true, revisionFingerprint }` (section 4) |
| NEW `PUT /lots/:lotId/conditions` | Save conditions in progress with provenance; supersedes the current draft if an input changed |
| NEW `GET /lots/:lotId` | Lot head and revision list, for "Next for you", J3 and J8 |
| `POST /api/auth/demo-session` | Issuing a new session is rate-limited per IP (5.2). A request with a valid cookie reuses it, as today |
| NEW `POST /api/auth/pitch-claim` | Exchanges the pitch reserve code for a signed pitch claim in the cookie (5.2) |
| NEW `POST /api/arc/turns` | One Arc turn. Body `{ clientTurnId, input }`; no `sessionId` (3.0 I2). Streaming per ADR-0011 |
| NEW `GET /api/arc/session`, `GET /api/arc/runs/:taskRunId`, `POST /api/arc/runs/:taskRunId/resume` | Session state, task-run state, resume after restart (3.4) |
| NEW `GET /api/arc/runs/:taskRunId/events` | Server-sent events for a task run, replayed from `Last-Event-ID` (2.3, ADR-0011) |
| `GET /api/status` | Reports `idempotencyScope: "shared-firestore"`, `durableIdempotencyConfigured: true` when wired, budget remaining (5.2 `peek`) and the flag set |

All new routes use `authorizeSupervisor`, same-origin on non-GET, and the rate limiter. `/lots/*` and `/api/arc/*` are scoped to the demo session the same way `/jobs/:id` is (`demoOwnsJob`): lot IDs carry the session ID.

### 1.4 Sequence: J1 through Arc, button path

1. Client opens Arc. `GET /api/arc/session` reads `arc_sessions/{sid}` (created on first read) and the active lot, if any.
2. User picks PO1 and presses Read. The client posts to `/orders/extract` (the same request the dashboard sends). `readOrder` reserves one budget unit (5.2), calls Gemini, writes `po_reviews/{reviewId}` and returns `reviewId` and `reviewFingerprint`.
3. User confirms the order. Client calls `PUT /lots/{lotId}/conditions` with the weather pre-fill (observation ID attached), the 7.3% example and typed values. The server creates `lot_heads/{lotId}` in a transaction.
4. User presses Confirm conditions. Client posts `/jobs` with `lotId`, `reviewId`, the conditions with sources and an `Idempotency-Key`. `planLot` claims `idempotency/{keyHash}`, registers a PENDING revision, runs the coordinator (one explanation attempt, one retry on failure), MERGEs the DRAFT, marks the revision CURRENT and completes the claim. Trace events go to `traces/{runId}`.
5. Client reads the draft with `GET /jobs/:id`, shows the approval card and keeps `revision.fingerprint`.
6. User ticks the box and presses Approve. The client button handler posts `{ reviewConfirmed: true, revisionFingerprint }`. The guard checks the revision, marks it APPROVING, `approveJob` writes the job card PDF and the BigQuery approval, and the revision becomes APPROVED.
7. Client calls `GET /jobs/:id/card.pdf` and shows the receipt.

On the typed path, step 3 and step 4 can be started from a message. Gemini routes the message to a tool, and the tool calls the same command with a tool-call idempotency key (3.3). Step 6 has no typed path.

### 1.5 Sequence: J8 replaced revision

1. Rev 1 is CURRENT. The user edits moisture (form or message). `updateLotConditions` runs one transaction: it writes the new draft conditions, sees that they differ from Rev 1's frozen conditions, and sets Rev 1 to SUPERSEDED with `supersededReason` (field, old and new value, source, session role).
2. Any approve call for Rev 1 now returns 409 `REVISION_SUPERSEDED` with the current state.
3. Plan again: `/jobs` with the new conditions has a new fingerprint (after the E6 fix), so it gets a new key and job ID, and becomes Rev 2.

## 2. Data contracts

All documents live in Firestore `(default)`. Every document, including the idempotency, budget, turn and event documents, has the base fields: `schemaVersion`, server `createdAt` and `updatedAt`, and an `expiresAt` Timestamp for the TTL policy (ADR-0002). Each store parses with these schemas on read and on write, and treats a parse failure as `SERVICE_UNAVAILABLE`, never as absence. Proposed file: `src/state-schemas.js`.

```js
import { z } from "zod";
import { JobIdSchema, TimestampSchema, DateSchema, OrderExtractionApiResponseSchema,
  OrderOperatorFieldsSchema } from "./schemas.js";
import { TraceEventSchema } from "./trace-registry.js";

const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/);
const sessionId = z.string().regex(/^[a-f0-9]{32}$/);
const uuid = z.string().uuid();
const lotId = z.string().regex(/^LOT-HACK-[a-f0-9]{32}-[a-f0-9]{12}$/);
const demoJobId = z.string().regex(/^JOB-HACK-[a-f0-9]{32}-[a-f0-9]{40}$/);   // demoJobIdentity format
const stepId = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
const toolName = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const effectKey = z.string().regex(/^arc1\.[a-f0-9]{32}\.[a-z][a-z0-9_]{0,39}\.[0-3]\.[a-f0-9]{16}$/);   // 3.3
const ipKey = z.string().regex(/^[a-f0-9]{16}$/);   // 5.2; never a raw address
const WaitingForSchema = z.enum(["confirm_order", "confirm_conditions", "choose_line", "approve"]);
const ResultRefSchema = z.object({          // pointer only; results stay in their own stores
  kind: z.enum(["po_review", "job", "lot", "trace", "card", "turn", "metric", "photo"]),
  id: z.string().min(1).max(160),
}).strict();
const base = {
  schemaVersion: z.literal(1),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  expiresAt: TimestampSchema,
};
```

### 2.0 Retention

One TTL policy per collection group on `expiresAt` (migration step 0, 3.5). TTL deletion can lag (3.1), so code also checks the logical expiry.

| Collection group | `expiresAt` | Logical expiry checked in code |
|---|---|---|
| `po_reviews` | createdAt + 24 h | `reviewExpiresAt`, 30 min |
| `idempotency` | claimedAt + 7 days | `leaseExpiresAt` |
| `traces` | createdAt + 30 days | none |
| `trace_events` (under `traces`) | createdAt + 30 days | none |
| `budget_counters` | day scopes: window + 35 days; hour and minute scopes: window + 1 day | the window in the counter ID |
| `budget_reservations` | createdAt + 7 days | none |
| `arc_sessions` | sessionExpiresAt + 7 days | `sessionExpiresAt` |
| `turns` (under `arc_sessions`) | createdAt + 7 days | `leaseExpiresAt` while in progress |
| `arc_task_runs` | createdAt + 30 days | each step's `leaseExpiresAt` |
| `lot_heads` | updatedAt + 30 days | none |
| `lot_revisions` | createdAt + 180 days | `approvingLeaseExpiresAt` |
| `weather_observations` | fetchedAt + 90 days | 60 min for C20 (6.4) |
| `weather_cache` | fetchedAt + 1 day | 10 min |

The trace event subcollection is `trace_events`, not `events`, because a TTL policy applies to every collection with that ID and the live feed already has a top-level `events` collection (`live-store.js:60-61`).

### 2.1 `po_reviews/{reviewId}` (replaces the Map in `purchase-order-review.js:45`)

```js
export const PoReviewDocSchema = z.object({
  ...base,
  reviewId: uuid,
  ownerSessionId: sessionId,                // new: a review is usable only by its session
  reviewFingerprint: sha256Hex,
  fileDigest: sha256Hex,
  operatorFields: OrderOperatorFieldsSchema,
  result: OrderExtractionApiResponseSchema, // bounded: the store rejects a serialized doc over 256 KiB
  reviewExpiresAt: TimestampSchema,         // createdAt + 30 min, checked in code
}).strict();
```

### 2.2 `idempotency/{keyHash}`

Written by `firestore-idempotency-store.js` with `collection: "idempotency"`. Adapter changes: write the base fields (the adapter's `toFirestoreValue` has no timestamp type today, so one is added), write `scope`, and accept an injected lease.

```js
export const IdempotencyDocSchema = z.object({
  ...base,
  keyHash: sha256Hex,                       // document ID
  scope: z.enum(["jobs", "po_review", "lot_conditions", "explanation"]),
  fingerprint: sha256Hex,
  jobId: z.string().min(1).max(160),        // existing field name; scope "jobs": the job ID, otherwise the result ID
  ownerToken: uuid,
  recordStatus: z.enum(["in_progress", "complete"]),
  claimedAt: z.number().int(),              // epoch ms, as the adapter writes today; the lease arithmetic uses these
  leaseExpiresAt: z.number().int(),
  completedAt: z.number().int().optional(),
}).strict();
```

For scope `jobs`, `keyHash` is the existing `demoJobIdentity` HMAC. For the other scopes it is SHA-256 of `<scope>.v1.<sessionId>.<key>`. Arc turns do not use this collection (2.5a).

### 2.3 `traces/{runId}` and `traces/{runId}/trace_events/{sequence}`

Write-through copy of the in-memory registry (`src/trace-registry.js`), so a run survives a restart and its owner check works on any instance (replaces `demoTraceOwners`, `index.mjs:84`). For Arc, `runId` is the task-run ID, and `GET /api/arc/runs/:taskRunId/events` reads this subcollection.

```js
export const TraceHeadDocSchema = z.object({
  ...base,
  runId: uuid,                              // for kind "arc_task_run": the taskRunId
  ownerSessionId: sessionId,
  kind: z.enum(["job_preparation", "arc_task_run"]),
  status: z.enum(["running", "completed", "failed", "cancelled", "incomplete"]),
  lastSequence: z.number().int().nonnegative(),
  jobId: JobIdSchema.optional(),
  geminiAttempts: z.number().int().nonnegative(),  // reservations made inside this run
}).strict();

export const TraceEventDocSchema = TraceEventSchema.extend(base);   // kind "job_preparation"; event shape unchanged

export const ArcEventDocSchema = z.object({ // kind "arc_task_run"
  ...base,
  sequence: z.number().int().positive(),    // the SSE id and the Last-Event-ID cursor
  type: z.enum(["run.started", "step.started", "step.succeeded", "step.failed", "step.blocked",
    "step.waiting_for_user", "answer", "run.completed", "run.failed"]),   // ADR-0011 owns this list
  clientTurnId: uuid,
  stepId: stepId.nullable(),
  tool: toolName.nullable(),
  waitingFor: WaitingForSchema.nullable(),
  errorCode: z.string().max(64).nullable(),
  resultRef: ResultRefSchema.nullable(),    // an "answer" event points at its turn; the text is stored only there
}).strict();
```

`incomplete` is set when an event write-through fails. Later writes for that run stop, so the stored events stay a gap-free prefix, and the head is written once as `incomplete` with `lastSequence` at the last stored event. If the owner is not known yet, the head is written when the owner is claimed. A store-backed reader sends every stored event, then ends the stream with a terminal `stream.error` carrying `TRACE_INCOMPLETE`. The instance that ran the trace still serves it in full from memory.

Residual case: if the `incomplete` head write also fails, it is logged and not retried. Another instance then returns 404 `TRACE_NOT_FOUND` when the owner was claimed after the run, or ends the stream without a terminal event when the owner was claimed mid-run.

### 2.4 Budget: `budget_counters/{counterId}` and `budget_reservations/{keyHash}`

```js
const BUDGET_COUNTER_SHAPE = {              // scope: [subject kind, window digits]
  day: ["all", 8], session_day: ["session", 8], ip_day: ["ip", 8],
  minute: ["all", 12], session_minute: ["session", 12],
  mint_ip_hour: ["ip", 10], claim_ip_hour: ["ip", 10],
  cost_day: ["all", 8],                     // ARC-M1-08: rupee spend, units in micro-rupees
};
const SUBJECT = { all: /^all$/, session: /^[a-f0-9]{32}$/, ip: /^[a-f0-9]{16}$/ };

export function budgetCounterId({ pool, scope, subject, window }) {
  return `${pool}_${scope}_${subject}_${window}`;   // underscores only, no colons
}

export const BudgetCounterDocSchema = z.object({
  ...base,
  counterId: z.string().regex(/^(live|eval)_[a-z_]{3,16}_(all|[a-f0-9]{16}|[a-f0-9]{32})_(\d{8}|\d{10}|\d{12})$/),
  pool: z.enum(["live", "eval"]),
  scope: z.enum(Object.keys(BUDGET_COUNTER_SHAPE)),
  subject: z.string(),                      // "all", an IP key or a session ID
  window: z.string().regex(/^\d{8}(\d{2}|\d{4})?$/),   // IST: YYYYMMDD, YYYYMMDDHH or YYYYMMDDHHmm
  units: z.number().int().nonnegative(),
  limit: z.number().int().positive(),       // informational; enforcement reads config, so limits can change mid-day
  policyVersion: z.literal("budget-v2"),
}).strict().superRefine((doc, ctx) => {
  const [kind, digits] = BUDGET_COUNTER_SHAPE[doc.scope];
  if (!SUBJECT[kind].test(doc.subject)) ctx.addIssue({ code: "custom", path: ["subject"], message: `scope ${doc.scope} needs a ${kind} subject` });
  if (doc.window.length !== digits) ctx.addIssue({ code: "custom", path: ["window"], message: `scope ${doc.scope} needs a ${digits}-digit window` });
  if (doc.counterId !== budgetCounterId(doc)) ctx.addIssue({ code: "custom", path: ["counterId"], message: "counterId must be built by budgetCounterId" });
});

export const BudgetReservationDocSchema = z.object({
  ...base,
  keyHash: sha256Hex,                       // document ID: SHA-256 of pool, session and reservation key (5.2)
  pool: z.enum(["live", "eval"]),
  sessionId: sessionId.nullable(),
  ipKey: ipKey.nullable(),
  purpose: z.enum(["order_extraction", "explanation", "photo_classification",
    "photo_diagnosis", "arc_router", "arc_answer_writer"]),
  dayWindow: z.string().regex(/^\d{8}$/),
  units: z.number().int().positive(),
  usedPitchReserve: z.boolean(),
  evalSuite: z.string().regex(/^[a-z][a-z-]{2,31}$/).nullable(),   // a suite name from 05 section 7
}).strict().superRefine((doc, ctx) => {
  if ((doc.pool === "eval") !== (doc.evalSuite !== null)) ctx.addIssue({ code: "custom", path: ["evalSuite"], message: "evalSuite is required in the eval pool and absent in the live pool" });
});
```

The day window stays the Asia/Kolkata date, as today. Unlike the current counter, the stored `limit` is not a precondition, so two services or two revisions with different limits do not lock each other out (fixes E7 for every caller that moves to `budget-v2`).

### 2.5 `arc_sessions/{sessionId}`

One per demo session (`hackathon-demo-auth.js`, 2 h cookie). The document ID is the `sid` from the verified cookie. No request body or query string supplies it.

```js
export const ArcSessionDocSchema = z.object({
  ...base,
  sessionId,
  authorizationMode: z.literal("HACKATHON_DEMO"),
  identityLabel: z.literal("Demo session, simulated"),
  sessionExpiresAt: TimestampSchema,        // from the cookie's exp
  activeLotIds: z.array(lotId).max(5),      // "Next for you"; no collection query needed
  jobIds: z.array(demoJobId).max(20),       // newest last, oldest dropped; the only job IDs the router may choose from
  activeTaskRunId: uuid.nullable(),
  recentTurnIds: z.array(uuid).max(4),      // oldest first; their summaries are the router's history
  turnCount: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),  // optimistic concurrency
}).strict().superRefine((doc, ctx) => {
  doc.jobIds.forEach((id, i) => {
    if (!id.startsWith(`JOB-HACK-${doc.sessionId}-`)) ctx.addIssue({ code: "custom", path: ["jobIds", i], message: "job belongs to another session" });
  });
  doc.activeLotIds.forEach((id, i) => {
    if (!id.startsWith(`LOT-HACK-${doc.sessionId}-`)) ctx.addIssue({ code: "custom", path: ["activeLotIds", i], message: "lot belongs to another session" });
  });
});
```

### 2.5a `arc_sessions/{sessionId}/turns/{clientTurnId}`: turn record and transcript

One document per turn. It is the turn's idempotency record, its transcript entry and its summary, so there is no second store for any of them.

```js
export const ArcTurnDocSchema = z.object({
  ...base,
  clientTurnId: uuid,                       // document ID, generated by the client
  sessionId,                                // the parent session, from the cookie
  taskRunId: uuid.nullable(),
  recordStatus: z.enum(["in_progress", "complete", "failed"]),
  ownerToken: uuid,
  leaseExpiresAt: TimestampSchema,          // claim time + 130 s
  inputFingerprint: sha256Hex,              // canonical input; a different input under the same ID is a 409
  input: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("action"), actionId: toolName, paramsHash: sha256Hex }).strict(),
    z.object({ kind: z.literal("text"), text: z.string().min(1).max(1000) }).strict(),
  ]),
  answerText: z.string().max(1200).nullable(),   // the text shown: checked writer text or template text
  summary: z.object({                       // null while in progress
    intent: z.string().max(64).nullable(),
    tools: z.array(toolName).max(4),
    resultRefs: z.array(ResultRefSchema).max(8),
    attempts: z.number().int().min(0).max(2),
    writerOutcome: z.enum(["not_called", "shown", "fallback"]),
    fallbackReason: z.string().max(64).nullable(),
    versions: z.record(z.string().max(48), z.string().max(48)),   // prompt, model and config versions
  }).strict().nullable(),
  eventRange: z.object({ first: z.number().int().positive(), last: z.number().int().positive() }).nullable(),
}).strict();
```

What it never holds (SH-SE-3): tool results, prompts, model output other than the checked `answerText`, PO file text, and order-derived free text (buyer name, addresses, notes; the field list is in `05-ai-design.md` section 4). The card under an answer is rendered again from `resultRefs` when the transcript is read, and is not copied. Before writing `answerText`, the store rejects it if it contains any order-derived field of the session's review. Test requirement: a fixture extraction with a unique buyer name runs through J1 and a typed question about the buyer, and the test asserts that the name appears in no turn, task-run, trace or log record.

The typed text is stored as entered, for 7 days, so the transcript survives a reload. If a user pastes order text into the message box, it is stored with the turn. The transcript retention ticket (SH-SE-3) decides whether typed text is cleared when the session ends.

### 2.6 `arc_task_runs/{taskRunId}` (resumable)

A task run is one multi-step job Arc is doing for the user, such as J1 from read to receipt. Steps are explicit so a restart can continue at the first unfinished step.

```js
const StepStatusSchema = z.enum(["PENDING", "RUNNING", "SUCCEEDED", "FAILED",
  "BLOCKED", "WAITING_FOR_USER", "SKIPPED"]);

export const TaskStepSchema = z.object({
  stepId,                                    // e.g. "read_order", "plan_lot"
  tool: toolName,                            // registry name (05 section 1)
  status: StepStatusSchema,
  argsHash: sha256Hex.nullable(),            // canonical args, set when the step first runs
  idempotencyKey: effectKey.nullable(),      // 3.3; null only for read-only tools that spend no attempt
  attempt: z.number().int().nonnegative().max(3),
  leaseOwner: uuid.nullable(),
  leaseExpiresAt: TimestampSchema.nullable(),
  resultRef: ResultRefSchema.nullable(),
  waitingFor: WaitingForSchema.nullable(),   // set exactly while status is WAITING_FOR_USER
  errorCode: z.string().max(64).nullable(),
  startedAt: TimestampSchema.nullable(),
  finishedAt: TimestampSchema.nullable(),
}).strict().superRefine((step, ctx) => {
  if ((step.status === "WAITING_FOR_USER") !== (step.waitingFor !== null)) ctx.addIssue({ code: "custom", path: ["waitingFor"], message: "waitingFor is set exactly when the step waits for the user" });
});

export const ArcTaskRunDocSchema = z.object({
  ...base,
  taskRunId: uuid,
  sessionId,
  kind: z.enum(["lot_preparation", "photo_check", "history_search", "data_question"]),
  lotId: lotId.nullable(),
  status: z.enum(["RUNNING", "WAITING_FOR_USER", "BLOCKED", "FAILED", "COMPLETED", "CANCELLED"]),
  steps: z.array(TaskStepSchema).min(1).max(16),
  version: z.number().int().nonnegative(),
}).strict();
```

When a step enters `WAITING_FOR_USER`, the run emits the `step.waiting_for_user` event (ADR-0011) with the same `waitingFor` value. The `approve` wait is terminal for Arc: only the approve command, called from the client button, moves the lot forward. The run then records the outcome by reading the revision, not by calling approve.

`GET /api/arc/runs/:taskRunId/events` serves the run's trace (2.3). Read from the store, it ends at the run's terminal event, or with `stream.error` `TRACE_INCOMPLETE` when the head is `incomplete`.

### 2.7 Lots and revisions: `lot_heads/{lotId}` and `lot_revisions/{jobId}`

C8, C16 and C17 need two kinds of record: the lot in progress (conditions before planning, "Next for you", J3), and one record per planned draft. A revision's document ID is its job ID, so the approve guard needs one key read and no query.

```js
export const ProvenancedValueSchema = z.object({   // section 6
  field: z.enum(["ambientRhPct", "ambientTempC", "paperMoisturePct", "runDate", "shift"]),
  value: z.union([z.number().finite(), z.string().min(1).max(16)]),
  unit: z.enum(["% RH", "°C", "%", "date", "shift"]),
  provenance: z.enum(["operator_entry", "public_weather_record", "synthetic_example",
    "dataset_seasonal", "plant_sensor", "simulated_sensor"]),
  sourceDetail: z.enum(["typed", "confirmed", "example", "weather", "seasonal_typical", "sensor"]),
  label: z.string().min(1).max(80),          // chip text from 02 section 5, set by code
  observationId: z.string().uuid().optional(),
  observedAt: TimestampSchema.optional(),
  enteredByRole: z.enum(["Operator session", "Supervisor session"]).optional(),
  confirmed: z.boolean(),
}).strict().superRefine((v, ctx) => {
  const weather = v.provenance === "public_weather_record";
  if (weather && (v.observationId === undefined || v.observedAt === undefined)) {
    ctx.addIssue({ code: "custom", path: ["observationId"], message: "a public weather record needs its observationId and observedAt" });
  }
  if (!weather && v.observationId !== undefined) {
    ctx.addIssue({ code: "custom", path: ["observationId"], message: "only a public weather record carries an observationId" });
  }
});

export const LotHeadDocSchema = z.object({
  ...base,
  lotId,
  ownerSessionId: sessionId,
  reviewId: uuid.nullable(),
  orderRef: z.object({ orderId: z.string(), itemCode: z.string(), quantity: z.number().int().positive() }).nullable(),
  draftConditions: z.array(ProvenancedValueSchema).max(5),
  conditionsFingerprint: sha256Hex.nullable(),
  currentRevision: z.number().int().nonnegative(),   // 0 = never planned
  currentJobId: JobIdSchema.nullable(),
  stage: z.enum(["order_review", "conditions", "planning", "draft_review",
    "approval_pending", "approved", "held"]),
  version: z.number().int().nonnegative(),
}).strict();

export const LotRevisionDocSchema = z.object({
  ...base,
  jobId: JobIdSchema,                        // document ID
  lotId,
  number: z.number().int().positive(),       // Rev 1, Rev 2, ...
  status: z.enum(["PENDING", "CURRENT", "SUPERSEDED", "APPROVING", "APPROVED", "FAILED"]),
  requestFingerprint: sha256Hex,             // createJobRequestIdentity fingerprint (after E6 fix)
  revisionFingerprint: sha256Hex.nullable(), // set at CURRENT; see 4.2
  conditions: z.array(ProvenancedValueSchema).max(5),   // frozen copy
  supersededBy: JobIdSchema.nullable(),
  supersededReason: z.object({
    field: z.string(), from: z.union([z.number(), z.string()]), to: z.union([z.number(), z.string()]),
    provenance: z.string(), byRole: z.string(),
  }).nullable(),
  approvingLeaseExpiresAt: TimestampSchema.nullable(),
  approvedAt: TimestampSchema.nullable(),
}).strict();
```

BigQuery `job_sheets` stays the long-term record of each JobSheet; a revision document is workflow state. Lot ID format: `LOT-HACK-<sessionId>-<12 hex random>`, so `demoOwnsJob`-style prefix checks apply. Once named sign-in exists, the prefix becomes a plant or user scope; that is out of scope here.

### 2.8 Weather and condition records (data audit P1, P2)

P2 is `lot_heads.draftConditions` plus the frozen copy on each revision. P1:

```js
export const WeatherObservationDocSchema = z.object({   // weather_observations/{observationId}
  ...base,
  observationId: uuid,
  observedAt: TimestampSchema,
  fetchedAt: TimestampSchema,
  locationName: z.literal("Pune"),
  latitude: z.number(), longitude: z.number(),
  ambientRhPct: z.number().min(0).max(100),
  ambientTempC: z.number().finite(),
  withinModelRange: z.boolean(),            // config/condition-ranges.json
  provider: z.literal("google-maps-platform-weather"),
  provenance: z.literal("public_weather_record"),
  label: z.literal("Public weather record, not a plant sensor."),
}).strict();
```

`weather_cache/pune` holds `{ observationId, previousObservationId, fetchedAt }` and is the shared 10-minute cache (6.3). Only the server writes either collection; clients have no Firestore access.

## 3. Durability

### 3.0 Interface decisions (M0 gate)

These settle SH-CR-1 to 6 in `reviews/M0-review.md`. This document is the source for the state contracts; `05-ai-design.md` and ADR-0007 are aligned to it by the AI architect.

| # | Decision | Sections |
|---|---|---|
| I1 | Every Arc route is under `/api/arc/*`: `POST /api/arc/turns`, `GET /api/arc/session`, `GET /api/arc/runs/:taskRunId`, `GET /api/arc/runs/:taskRunId/events` (server-sent events, resumed with `Last-Event-ID`) and `POST /api/arc/runs/:taskRunId/resume` | 1.3 |
| I2 | The session ID comes only from the signed demo cookie. No Arc request body or query string carries `sessionId`; the strict request schemas reject one with 400 `VALIDATION_ERROR`. The turn body is `{ clientTurnId, input }` | 1.3, 2.5 |
| I3 | One turn idempotency record: `arc_sessions/{sessionId}/turns/{clientTurnId}`, created with an exists-false precondition. There is no `idempotency` record with scope `arc_turn` and no separate top-level turns collection | 2.5a, 3.3 |
| I4 | The transcript and the turn summaries live on that turn record: typed text (at most 1,000 characters), the shown answer text and the summary. No tool results, prompts, PO text or order-derived strings. TTL 7 days | 2.0, 2.5a |
| I5 | The session record holds `activeLotIds` (at most 5), `jobIds` (at most 20, this session's jobs only), `recentTurnIds` (at most 4, the router's history) and `activeTaskRunId` | 2.5 |
| I6 | Step states: `PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`, `BLOCKED`, `WAITING_FOR_USER`, `SKIPPED`. `waitingFor` is `confirm_order`, `confirm_conditions`, `choose_line`, `approve` or null. The `step.waiting_for_user` event (ADR-0011) fires when a step enters `WAITING_FOR_USER` | 2.6 |
| I7 | Every write tool, and every tool step that spends a Gemini attempt, uses the effect key `arc1.<taskRunId>.<stepId>.<attempt>.<argsHash16>`. Budget reservation keys add the claim owner and a call index to the effect key or the turn key `arcturn1.<clientTurnId>` | 3.3, 5.2 |
| I8 | Arc events are stored in `traces/{taskRunId}/trace_events/{sequence}` (trace kind `arc_task_run`). ADR-0011 owns the event types; an `answer` event stores the turn reference, not the text | 2.3 |
| I9 | Arc tool names are the registry names in `05-ai-design.md` section 1 | 1.2 |

### 3.1 Rules

- **External calls stay outside Firestore transactions.** Transactions only record intent or outcome. Gemini, BigQuery, Storage and Weather calls happen between transactions, and the next transaction reconciles. This is the same pattern `firestore-gemini-attempt-store.js` uses today.
- **Every effect has an idempotency key.** Same key and same fingerprint returns the existing result. Same key and different fingerprint returns 409 `CONFLICT`. A deliberate new operation gets a new key.
- **Optimistic concurrency.** Session, task-run and lot-head documents carry `version`; writes use the `currentDocument.updateTime` precondition, as the idempotency adapter already does. A lost race re-reads and re-decides. It never overwrites.
- **Fail closed.** When a durable flag is on and Firestore cannot be reached, the command returns `SERVICE_UNAVAILABLE` and does not fall back to memory. This matches the existing adapter's stated contract (`firestore-idempotency-store.js:18-22`) and the Gemini counter.
- **Logical expiry in code, deletion by TTL.** Firestore TTL deletes documents some time after `expiresAt` (Google states typically within 24 hours), so every read also checks the logical expiry field (`reviewExpiresAt`, `leaseExpiresAt`, `sessionExpiresAt`).

### 3.2 `POST /jobs` with durable idempotency and revisions

1. Build the identity with `createJobRequestIdentity`. **Fix E6 first:** add `runDate`, `ambientRhPct`, `ambientTempC`, `paperMoisturePct`, the per-field provenance and `lotId` to `canonicalRequest`, and bump the key prefix to `ustaad-jobs:v2:` so old and new identities cannot collide.
2. `idempotency` claim (set-if-absent). The lease rises from 30 s to **130 s**. It must exceed the 120 s Cloud Run request timeout, so that no request still running can lose its claim. With a 30 s lease, a slow plan (explanation retry plus optimizer) can outlive its lease, a retry on another instance can re-claim, and both run the MERGE. That is the concurrent-MERGE path to `JOB_SHEET_NOT_UNIQUE` (`job-sheet-repository.js:135-137`).
3. Fencing before the write: `createPersistableJobCreator` re-reads the claim and checks `ownerToken` immediately before `createDraftJobSheet`. A stale owner stops with `IDEMPOTENCY_IN_PROGRESS` and spends no BigQuery write.
4. Register a PENDING revision in one transaction: read `lot_heads/{lotId}`, write `lot_revisions/{jobId}` with `number = currentRevision + 1`, bump the head. If a PENDING revision for this job ID already exists (a retry), reuse it.
5. Run the coordinator and the MERGE (unchanged code).
6. Finalise in one transaction: revision becomes CURRENT with its `revisionFingerprint`; the previous CURRENT revision, if any, becomes SUPERSEDED with `supersededBy`; the head's `currentJobId` moves. Then `complete` the claim.
7. Failure anywhere before step 6 releases the claim (existing code) and marks the revision FAILED. A crash leaves the claim to expire and the revision PENDING; the next claim for the same key resumes at step 4 and reuses it. The approve guard rejects PENDING and FAILED revisions.

Remaining `JOB_SHEET_NOT_UNIQUE` risk: two different idempotency keys whose job IDs collide cannot happen (the job ID is derived from the key hash). Two owners for one key can now happen only if a BigQuery job outlives 130 s after its request was cancelled. The release preflight runs a read-only duplicate check (`SELECT job_id FROM prepagent.job_sheets GROUP BY job_id HAVING COUNT(*) > 1`, 10 MiB billed minimum). Existing duplicates, if any, are reported to the founders and not deleted (CLAUDE.md section 6).

Known cost of a retry after a crash in step 5: the coordinator runs again and spends one more explanation attempt. This is today's behaviour and is accepted; the budget counts it.

### 3.3 Effect keys and the turn record (interface for ADR-0007)

Every Arc tool step that has an effect or spends a Gemini attempt passes a key to the command it calls. The key is derived, not random, so a resumed step reuses it.

```
arc1.<taskRunId without dashes>.<stepId>.<attempt>.<argsHash first 16 hex>
```

- `taskRunId` 32 hex, `stepId` from the step record, `attempt` 0 to 3, `argsHash` = SHA-256 of the canonical JSON of the tool's validated arguments (keys sorted, numbers as parsed). The regex is `effectKey` in section 2.
- Always visible ASCII and at most 97 characters, so it passes the existing `visibleKey` check in `job-idempotency.js` (at most 128) and flows through `createJobRequestIdentity` → `demoJobIdentity` unchanged. The session HMAC in `demoJobIdentity` stops one session replaying another's key.
- The write tools in the registry today are `read_order`, `set_conditions`, `plan_lot` and `retry_explanation`. `plan_lot` sends the key as its `Idempotency-Key`. The other three claim `idempotency/{keyHash}` with scope `po_review`, `lot_conditions` or `explanation` (2.2). `diagnose_approved_photo` changes no state but spends an attempt on a cache miss, so it uses the key for its budget reservation. Any tool added later that writes or spends uses the same format; the `tool-registry` suite checks every registered key builder against `effectKey`.
- `attempt` increases only when the user asks to retry a FAILED step. A resume after a crash keeps the same attempt, so it replays rather than repeats.
- Read-only tools that spend no attempt (status, samples, weather, lot, stored job, card, approved-photo list, history, metrics) take no key; their cache rules are in 5.3.

**Turn record.** `POST /api/arc/turns` carries a client-generated `clientTurnId` (UUID). The server takes the session ID from the cookie and creates `arc_sessions/{sessionId}/turns/{clientTurnId}` with an exists-false precondition, `recordStatus: "in_progress"`, an owner token and a 130 s lease.

- Same ID, same input fingerprint, record complete: the server returns the stored answer and replays the stored events in `eventRange`. No Gemini attempt.
- Same ID, different input fingerprint: 409 `CONFLICT`.
- Same ID, in progress with a live lease: 409 `IN_PROGRESS`. With an expired lease, the retry takes over the lease and runs the turn again.

**Budget reservation keys.** A reservation key is the step's effect key, or `arcturn1.<clientTurnId without dashes>` for the router and answer-writer calls, followed by the first 12 hex digits of the claim owner UUID without dashes (the step's `leaseOwner` or the turn's `ownerToken`) and a call index: `<key>.<owner12>.<n>`. Dashboard requests build it the same way from the `idempotency` claim's `keyHash` and `ownerToken`; a request without an idempotency key gets a random reservation key. A repeat inside one claim replays and counts nothing. A re-run after a lease expiry has a new owner and is counted, because it makes a new provider call (3.2). A completed step or turn never reaches `reserve` again, because the command returns its stored result first.

### 3.4 Resume after an instance restart

Cloud Run throttles CPU outside requests, so there is no background worker. A task run advances only inside a request.

1. Each step is claimed with a lease (`leaseOwner`, `leaseExpiresAt` = now + 130 s) in a transaction on the task-run document, then executed, then finished in a second transaction.
2. When the client reconnects after a dropped stream, it reads `GET /api/arc/runs/:taskRunId/events` with `Last-Event-ID`. If the run has an unfinished step, or when Arc opens again, it calls `POST /api/arc/runs/:taskRunId/resume` (also triggered by `GET /api/arc/session` when `activeTaskRunId` is set).
3. Resume reads the run. A RUNNING step with an expired lease goes back to PENDING with the same attempt and idempotency key, then runs again. Because the key is the same, a step whose command finished replays: `/jobs` returns the stored job and `read_order` returns the stored review (looked up by key), with no new reservation. A step whose command had not finished runs again under a new lease owner, and its Gemini calls are counted (3.3, 5.2).
4. A step whose command replay is not possible (for example, its PO review expired) becomes BLOCKED with a code the UI maps to words, such as "Read the order again".
5. A RUNNING step with a live lease returns `IN_PROGRESS` to the second caller. Two tabs therefore cannot run one step twice.

### 3.5 Migration order and feature flags

Each step is one ticket and one deploy behind its flag. A flag off restores today's behaviour. Flags live in the checked-in env file (ADR-0006). TTL policies are created before the first write to each collection, with a change record (CLAUDE.md section 7).

| # | Change | Flag | Rollback |
|---|---|---|---|
| 0 | Firestore TTL policies on every collection group in 2.0: `po_reviews`, `idempotency`, `traces`, `trace_events`, `budget_counters`, `budget_reservations`, `arc_sessions`, `turns`, `arc_task_runs`, `lot_heads`, `lot_revisions`, `weather_observations`, `weather_cache` (field `expiresAt`) | none (cloud config) | `gcloud firestore fields ttls update expiresAt --collection-group=X --disable-ttl` |
| 1 | Extract `src/commands/`; extract `firestore-rest.js`; add `src/state-schemas.js` | none (no behaviour change) | revert commit |
| 2 | Fix E6 (fingerprint covers conditions); fix E8 (optimizer default 100 MiB) | none (bug fixes, tested) | revert commit |
| 3 | Wire `firestore-idempotency-store.js` for `/jobs`, lease 130 s, fencing | `USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY` (the name its header already documents) | flag off |
| 4 | Durable PO reviews | `USTAAD_ENABLE_DURABLE_PO_REVIEWS` | flag off (reviews in flight are lost, as today) |
| 5 | Durable traces, owner check from Firestore | `USTAAD_ENABLE_DURABLE_TRACES` | flag off |
| 6 | Budget store `budget-v2` replaces the day cap for `momentum`; session issuance limit; pitch claim | `USTAAD_GEMINI_BUDGET_POLICY=budget-v2`, limits in `GEMINI_BUDGET_LIMITS` | unset the flag; the old counter path is untouched |
| 7a | Lot heads and revisions written; `revision` block returned; clients send the approve body | `USTAAD_ENABLE_LOT_REVISIONS` | flag off |
| 7b | Approve guard enforced | `USTAAD_ENFORCE_APPROVE_GUARD` | flag off |
| 8 | Conditions sources with provenance; shared weather cache and observations | `USTAAD_ENABLE_CONDITION_PROVENANCE` | flag off |
| 9 | Arc routes and panel | `USTAAD_ENABLE_ARC` | flag off; dashboard unaffected |

7b ships only after 7a has run on the live revision, so neither client is ever blocked by a guard it cannot satisfy. Drafts created before 7a have no revision record; with 7b on, approving them returns `REVISION_NOT_REGISTERED`. All 13 stored JobSheet records are TEST- records (data audit), so this blocks no real work; the founders should know old drafts become read-only.

## 4. Approve guard

### 4.1 Request

```js
export const ApproveJobRequestSchema = z.object({
  reviewConfirmed: z.literal(true),
  revisionFingerprint: sha256Hex,
}).strict();
```

### 4.2 Revision fingerprint

`revisionFingerprint = sha256(canonical JSON of { jobId, lotId, number, requestFingerprint, conditions (frozen, with provenance), baseline, recommended, changes, explanation })`, computed from the stored DRAFT after the read-back in `createDraft`. It binds the approval to the exact content the user saw. It is returned in `POST /jobs` and `GET /jobs/:id` and is not a credential: the server recomputes everything it checks.

### 4.3 Guard sequence (`src/commands/approve-job.js`)

1. `authorizeSupervisor` and `canApprove`, as today.
2. Parse the body. Missing or false `reviewConfirmed` → 400 `REVIEW_CONFIRMATION_REQUIRED`.
3. Transaction: read `lot_revisions/{jobId}` and its lot head.
   - No document → 409 `REVISION_NOT_REGISTERED`.
   - `SUPERSEDED` → 409 `REVISION_SUPERSEDED` with `currentJobId` and `currentRevision`.
   - `APPROVING` with a live lease → 409 `APPROVAL_IN_PROGRESS`.
   - `APPROVED` → fall through to the existing idempotent approved path in `approveJob` (returns the stored card).
   - `CURRENT`, but `head.currentJobId !== jobId` or the fingerprint differs → 409 `REVISION_FINGERPRINT_MISMATCH`.
   - Otherwise set `APPROVING` with a 130 s lease.
4. Call the existing `approveJob` (PDF render, Storage upload, BigQuery approval update, read-back). Unchanged.
5. Transaction: success → `APPROVED`, head stage `approved`. Failure → back to `CURRENT`. A crash leaves `APPROVING` with an expired lease; the next approve or `GET /jobs/:id` reconciles from BigQuery, which is the record (APPROVED there → APPROVED here, otherwise CURRENT).
6. `updateLotConditions` refuses to supersede an `APPROVING` revision (409 `APPROVAL_IN_PROGRESS`), so an edit cannot slip between the check and the write.

### 4.4 No route for the model to approve

- Arc tools are in-process adapters in `src/arc/tools/`. None imports `src/commands/approve-job.js` or `servicePorts.approveJob`. A test parses every file under `src/arc/` and fails on either import, and a second test asserts the registered tool list (ADR-0007) contains no approve tool (AC1.5).
- Tools do not make HTTP calls back into the app, so a tool cannot reach `/jobs/:id/approve` through the network either. The tool runner has no generic fetch tool.
- The approval card is rendered by the client from the `revision` block. The model's text cannot add or tick a checkbox; the client renders the card from structured data only (ADR-0010 owns the rendering rule).
- `reviewConfirmed` is an assertion from the client, not proof that a person ticked the box. It makes O4 testable at the API and stops a bare call. The guarantee against the model is structural: no tool, no import, no generic HTTP. The approval stays a demo-session approval labelled simulated (`HACKATHON_APPROVAL_NOTE`).
- Both clients change: `Lots.tsx` (which has the checkbox) and the old dashboard (`workflow.js`, which needs the checkbox per Q9) send the body. Until Q9 is answered, 7b cannot be switched on without breaking the old dashboard's approve button.

## 5. Quotas and cost

### 5.1 Today

- `momentum`: 300 attempts per IST day, `prepagent`: 100, one shared document, and the cap-mismatch lockout in E7.
- No per-session or per-minute limit. One judge typing quickly can spend the whole day.
- Per-IP limit 60 per minute per instance, held in memory.

### 5.2 Budget check API (interface for ADR-0007 and ADR-0010)

`src/google-cloud/firestore-budget-store.js`:

```js
/**
 * reserve: one transaction over the counters in 2.4 plus the reservation document.
 * Counts attempts, not successes; no refunds.
 */
reserve({ principal, ipKey, purpose, units = 1, reservationKey, evalSuite = null, signal }) =>
  Promise<
    | { ok: true, reservationId, replayed: boolean, usedPitchReserve: boolean,
        remaining: { day, session, ip, minute }, reserveWindowActive: boolean }
    | { ok: false, code: "BUDGET_DAY_EXHAUSTED" | "BUDGET_SESSION_EXHAUSTED" | "BUDGET_IP_EXHAUSTED"
          | "BUDGET_RATE_LIMITED" | "BUDGET_SESSION_RATE_LIMITED" | "BUDGET_RESERVED_FOR_PITCH"
          | "BUDGET_COST_EXHAUSTED" | "BUDGET_WINDOW_BLOCKED" | "BUDGET_UNAVAILABLE",
        retryAfterSeconds?: number, remaining?: { day, session, ip, minute } }>

/** peek: read-only, no write; for /api/status and the Arc cap-reached state (G2). */
peek({ principal, ipKey, signal }) => Promise<{ day, session, ip, minute, reserveWindowActive, limits }>
```

- `principal` is the verified cookie principal from `authorizeSupervisor`: the session ID and any pitch claim come from it, never from a request field. `ipKey` is the first 16 hex of HMAC-SHA-256 over `ip.v1.<address>` with the demo signing key, where the address is the rate-limit key from 5.4. Raw addresses are never stored or logged.
- `reservationKey` is built as in 3.3. The same key returns `replayed: true` and counts nothing. A provider call that actually happens is always counted, because a re-run after a lease expiry has a new key.
- One reservation is one transaction over the day, session-day, IP-day, minute and session-minute counters plus the reservation document: 6 writes.
- `withDailyGeminiCallCap` keeps its role as the one wrapper around every Gemini call. Its `store` becomes an adapter whose `reserveAttempt` calls `reserve` with the `budget` context passed in the Gemini call arguments. Callers with no session (none today) are charged to the day and minute counters only.
- Codes added in ARC-M1-08: `BUDGET_SESSION_RATE_LIMITED` is the session-minute limit, so each limit has its own code (`BUDGET_RATE_LIMITED` stays the global minute limit). `BUDGET_COST_EXHAUSTED` means the day's rupee spend has reached `dayCostCapInr` (founder decision F2: ₹600 for `live`, ₹200 for `eval`). `BUDGET_WINDOW_BLOCKED` means an eval reservation fell inside one of the pool's `blockedWindows`.
- Rupee spend is kept on a `cost_day` counter (`<pool>_cost_day_all_<YYYYMMDD>`, units in micro-rupees). `reserve` reads it but does not write it. After each response, the wrapper prices `usageMetadata` with `config/gemini-prices.json` (ADR-0008 prices) and adds the cost to that counter. Calls still in flight when the cap is reached can take spend past it.
- Error mapping: `BUDGET_*_EXHAUSTED`, `BUDGET_*RATE_LIMITED`, `BUDGET_RESERVED_FOR_PITCH` and `BUDGET_WINDOW_BLOCKED` → 429 with the existing `GEMINI_DAILY_CAP_EXCEEDED` shape plus the new code, so current clients keep working. `BUDGET_UNAVAILABLE` → 503, no provider call.
- Limits come from one env var, `GEMINI_BUDGET_LIMITS` (JSON, validated with zod at start; invalid config blocks Gemini, as the current cap does). The flag `USTAAD_GEMINI_BUDGET_POLICY=budget-v2` only selects the store, so the two names stay distinct:

```json
{ "pool": "live",
  "dayLimit": 300, "sessionDayLimit": 40, "ipDayLimit": 120, "minuteLimit": 20, "sessionMinuteLimit": 6,
  "demoSessionMint": { "perIpPerHour": 30 },
  "pitchClaim": { "attemptsPerIpPerHour": 5 },
  "reserve": { "units": 80, "windowStart": "2026-12-04T00:00:00+08:00",
               "windowEnd": "2026-12-04T23:59:59+08:00", "grant": "pitch_reserve", "sessionDayLimit": 120 } }
```

Outside the reserve window, usable day units are `dayLimit - reserve.units`. Inside it, the reserved units are usable only by a session whose verified cookie carries the pitch claim (`pitch_reserve`); every other session still sees `dayLimit - reserve.units`. The values above are proposals; founders set them (decision F2). Per-turn Gemini use is in `05-ai-design.md` section 3: 1 attempt for a typed message, 2 for a typed data question, 0 for buttons and picked suggestions.

**Demo session issuance (BL-SE-1).** Minting new sessions would otherwise reset the per-session limit. `POST /api/auth/demo-session` now counts each new session on `live_mint_ip_hour_<ipKey>_<YYYYMMDDHH>` in a transaction before it issues the cookie. Above `demoSessionMint.perIpPerHour` it returns 429 `DEMO_SESSION_RATE_LIMITED` with `Retry-After` and no cookie. A request that already has a valid cookie reuses it, as today (`index.mjs:566`), and counts nothing. With the budget flag on and Firestore unavailable, the route returns 503 and issues nothing. The per-session limits bound one session, `ipDayLimit` bounds what one address can spend however many sessions it mints, and the day limit bounds everything. At the venue every judge may share one NAT address, so `ipDayLimit` is shared there; the pitch laptop does not depend on it (next paragraph).

**Pitch reserve credential.** The reserve is held on a server credential, not on session IDs.

1. A founder creates one Secret Manager secret, `arc-pitch-reserve-code` (32 random bytes, hex), with a change record first. The service reads it through `--update-secrets` as `ARC_PITCH_RESERVE_CODE`.
2. NEW `POST /api/auth/pitch-claim`, body `{ code }` (strict, at most 128 characters), same-origin, valid demo cookie required. Each attempt is counted on `live_claim_ip_hour_<ipKey>_<YYYYMMDDHH>` before the compare, at most `pitchClaim.attemptsPerIpPerHour`. The server compares the SHA-256 digests with `timingSafeEqual`. On a match it re-issues the cookie with the same `sid` and `exp` and a signed `grants: ["pitch_reserve"]` claim (cookie policy `HACKATHON_DEMO:v2`; `v1` cookies stay valid with no pitch claim). The code never appears in a URL, a response, a log line or the repository; the log line `arc_pitch_claim` records the outcome only. The pitch laptop enters it once in a password field (frontend ticket).
3. Inside the reserve window, a session with the pitch claim may spend the reserved units, uses `reserve.sessionDayLimit` instead of `sessionDayLimit`, and is not counted against `ipDayLimit`. Minute limits still apply.
4. The pitch claim changes the budget only. It gives no approval, no tool and no other capability, and the identity label stays "Demo session, simulated".
5. After 5 December the secret version is disabled and `reserve` is removed from the limits. Grants end with their 2 h cookies.

**Eval pool (SH-EV-S7).** Live eval suites run in a local process with the developer's gcloud credentials (`K_SERVICE` unset) and `"pool": "eval"`. Its counters are the `eval_*` documents, so a gate run never draws on the `live` pool. Config validation rejects `"pool": "eval"` when `K_SERVICE` is set, so no Cloud Run revision can serve from it.

```json
{ "pool": "eval",
  "dayLimit": 900, "sessionDayLimit": 900, "ipDayLimit": 900, "minuteLimit": 10, "sessionMinuteLimit": 10,
  "blockedWindows": [{ "start": "2026-12-04T00:00:00+08:00", "end": "2026-12-04T23:59:59+08:00" }] }
```

- The eval day limit is 900: one full live gate run (353 attempts, `05-ai-design.md` section 7.5), one full retry run (353), and the one-off M1 router comparison (about 130 router calls), 836 in total, plus a margin of 64 (about 8%) for estimate error. A day that needs more stops at the limit, and the remaining suites run on the next IST day. `minuteLimit` 10 keeps eval traffic to half of the live per-minute limit, because both draw on the same Vertex AI per-minute quota (to be confirmed at 30 or more per minute in ADR-0008). `blockedWindows` copies the pitch reserve window, so no eval run calls Gemini during it.
- Every eval reservation must carry `evalSuite` (schema in 2.4), and is logged as `arc_budget_reserve` with pool, suite, purpose, units and remaining day units. The gate report lists attempts per suite from a read-only query on `budget_reservations` (`pool == "eval"` and `dayWindow == <date>`, equality filters only, so no composite index).
- Cost: about $1.38 for a typical gate run, about $3.50 for a full eval day at the 900 limit at the eval-run rate ($1.38 per 353 attempts), and at most about $76 a day at the worst single-call cost of $0.084 (estimates, `05-ai-design.md` sections 3 and 7.5).

### 5.3 Caching

| What | Cache | Key | TTL | Invalidation |
|---|---|---|---|---|
| Weather | `weather_cache/pune` in Firestore plus a per-instance copy; every caller (route, condition guard, Arc) goes through `readWeather`. Fixes M7: the guard's provider is uncached today | location | 10 min | time only |
| Model scores | In process; the source is `config/model-acceptance.json` in the image | none | process lifetime | new revision |
| Impact summary | Existing 1 h module cache (`impact-summary-service.js:131`) | none | 1 h | time |
| Read-only Arc answers (button or suggestion path, no Gemini) | In process | `sessionId` + intent ID + params hash + source version (model-acceptance `evaluationId`, impact cache time, lot `version`) | 5 min | any source version change. Never keyed on question text alone, never shared across sessions |
| Typed-question answers | Not cached in M1. ADR-0009 may add this with the same key rule | n/a | n/a | n/a |

### 5.4 Per-IP rate limit behind Cloud Run

How the IP is read: `getSocketClientIp` (`request-guardrails.js:47-54`) uses `c.env.incoming.socket.remoteAddress`. On Cloud Run the container's TCP peer is Google's serving infrastructure, not the browser; the client address arrives in `X-Forwarded-For`. E1 and E2 show the limiter has not fired in 14 days, so logs cannot show which value it used. Status: NOT VERIFIED.

Fix:

1. On Cloud Run (`K_SERVICE` set), key on the **last** entry of `X-Forwarded-For`, which Google's front end appends. Earlier entries can be set by the client and are ignored. Off Cloud Run, keep the socket address.
2. Add a per-session key alongside it: `sessionId` when a valid demo cookie is present. Venue Wi-Fi puts every judge behind one NAT address, so per-IP alone at 60 per minute could block the pitch laptop because of other people's phones. Proposed: 300 per minute per IP, 60 per minute per session, both per instance, in memory. The limiter is abuse control; cost control is the Firestore budget, which is global.
3. Verification before the first load rehearsal, on a tagged no-traffic revision: a temporary structured log line with SHA-256 hashes (never raw addresses) of the socket address and of the last `X-Forwarded-For` entry, two requests from two networks (laptop Wi-Fi and phone hotspot). Pass: socket hashes equal, header hashes differ. The log line is removed before the release gate.
4. A load balancer added in front of the service later appends its own hop, so the last entry would become the balancer's address and every client would share one bucket. The key is therefore the entry at position `length - RATE_LIMIT_TRUSTED_HOPS`, default 1, set to the number of trusted proxies when a balancer is added. The exact header that balancer sends must be checked against its documentation at that time; it is not checked here. Test requirement: unit tests for 1 and 2 trusted hops, with client-supplied leading entries that must be ignored, and a missing or short header, which falls back to one shared `unknown` key. The preflight fails if a serverless network endpoint group points at `momentum` while `RATE_LIMIT_TRUSTED_HOPS` is 1.

### 5.5 Optimizer byte limit

Change the `readOptimizerQueryBudget` default to 100 MiB and keep the allowlist (80, 100 MiB). Add a test that fails if the default is below the bytes billed by the recorded PKBX0041 run, and a preflight line that prints the configured value. No change to the live env var.

### 5.6 Cloud Run for demo days (ADR-0006)

| Period | min instances | max instances (revision and service) | Notes |
|---|---|---|---|
| Now to 2 Dec (rehearsals) | 1 | 6 | Warm start for rehearsals; E1 shows saturation at 2 |
| 3 and 4 Dec | 2 | 6 | Two warm instances so a cold start never lands on stage |
| From 5 Dec | 0 | 4 | Back to scale to zero |

Concurrency stays 20, CPU 1, memory 1 GiB, timeout 120 s, session affinity on (no longer needed for correctness once reviews are durable, but harmless). Turn on startup CPU boost. The service-level max is set to 6, so a runaway loop cannot fan out further.

### 5.7 Cost per day at demo load

The Cloud Run, Firestore, BigQuery and Secret Manager prices below are NOT VERIFIED: no pricing page or calculator was read for this document. They must be checked in the Google Cloud pricing calculator for `asia-south1` before the release gate. ₹ uses the repository's fallback rate, 1 USD = ₹96.7 (`src/fx-fallback.json`, 0.01034, dated 2026-10-09). Demo load assumption (NOT MEASURED): 40 lots and 150 Arc turns on a rehearsal day.

| Item | Basis | Per day |
|---|---|---|
| Cloud Run, 1 idle min instance | 86,400 s × (1 vCPU × $0.0000025 + 1 GiB × $0.0000025) idle rate | about $0.43 (₹42) |
| Cloud Run, 2 idle min instances | double | about $0.86 (₹84) |
| Cloud Run, active time | about 2,000 request-seconds × $0.0000265 per vCPU-and-GiB second | under $0.10; inside the monthly free tier |
| Firestore | about 60 writes and 40 reads per lot, 6 writes per Gemini attempt, about 9 writes per Arc turn, 1 per new demo session: about 5,000 writes and 3,000 reads | inside the daily free tier (20,000 writes, 50,000 reads; NOT VERIFIED); ₹0 |
| Secret Manager | one new secret, one active version, one access per instance start | under ₹1 a day (NOT VERIFIED) |
| BigQuery | at most about 300 MiB billed per lot (predict, optimize at 90 MiB, similar runs, explanation) × 40 = about 12 GiB | about $0.07 (₹7) at $6.25 per TiB; inside the 1 TiB monthly free tier (both NOT VERIFIED) |
| Weather API | at most 144 calls (10-minute shared cache) | to confirm in Maps Platform pricing; small |
| Gemini, live pool | (2 or 3 per lot) + (1 or 2 per typed turn) attempts | about $0.035 to $0.07 per J1 lot (`05-ai-design.md` section 3, estimate); capped by `dayLimit` |
| Gemini, eval pool, gate days only | about 353 attempts per gate run | about $1.38 per run (estimate); capped at 900 attempts |

Total for the period excluding Gemini: 9 rehearsal days × (₹42 + ₹7) + 2 demo days × (₹84 + ₹7) ≈ ₹441 + ₹182 = **about ₹620**. The ₹5,000 budget alert is not a cap (C11).

**Billing credits.** Whether the project's credits apply to Vertex AI and Cloud Run must be confirmed by a founder in the Cloud console (Billing → Credits). `gcloud billing projects describe` shows only that billing is enabled (`billingEnabled: True`); the CLI cannot show credit scope.

## 6. Conditions source interface

### 6.1 Interface

```js
/**
 * @typedef {"operator_entry"|"synthetic_example"|"public_weather_record"|"dataset_seasonal"|"plant_sensor"} ConditionsSourceId
 * @typedef {object} ConditionsSource
 * @property {ConditionsSourceId} id
 * @property {ReadonlyArray<"ambientRhPct"|"ambientTempC"|"paperMoisturePct">} fields
 * @property {(req: { lotId?: string, runDate: string, shift: "DAY"|"NIGHT",
 *   signal?: AbortSignal }) => Promise<
 *     { ok: true, values: ProvenancedValue[] } |
 *     { ok: false, error: { code: "SOURCE_UNAVAILABLE"|"OUT_OF_RANGE"|"STALE", message: string } }>} read
 */
```

`ProvenancedValue` is `ProvenancedValueSchema` (2.7). Each source's ID is the provenance value it writes; `PlantSensorSource` also writes `simulated_sensor` for simulated rows. A source never invents a field it does not hold, and the `label` is set by the source in code, never by the model.

### 6.2 Implementations

| Source | Fields | Provenance and label | Notes |
|---|---|---|---|
| `OperatorEntrySource` (`operator_entry`) | all three, plus run date and shift | `operator_entry`; "Entered by operator" or "Confirmed by operator" | Reads `lot_heads.draftConditions` |
| `ExampleValueSource` (`synthetic_example`) | paper moisture only | `synthetic_example`; "Example value, not measured" | The 7.3% pre-fill. A constant in one place (`config/condition-defaults.json`), used only as a labelled pre-fill and never as a default for a blank field (AC1.17). Keeping it unchanged keeps the label (AC1.18) |
| `PuneWeatherSource` (`public_weather_record`) | humidity, temperature | `public_weather_record`; "Public weather record, not a plant sensor." plus "Pune, read at HH:MM" | Through `readWeather` and the shared cache; every reading is written to `weather_observations` (P1) and referenced by `observationId` |
| `DatasetSeasonalSource` (`dataset_seasonal`) | humidity, temperature | `dataset_seasonal`; "Seasonal typical value, not measured." | `condition-guard.js:seasonalValue` over `config/condition-ranges.json` |
| `PlantSensorSource` (`plant_sensor`, future) | any field the feed carries | `plant_sensor`; label to be designed | Reads the Pub/Sub → BigQuery `sensor_readings` route once a subscription exists; rejects readings older than 15 minutes with `STALE`; rows with `source = simulated` map to `simulated_sensor` and are never used for planning. Not built for the pitch. `GET /conditions/current` is not used for "today" (data audit finding 4) |

### 6.3 Resolution

The condition guard keeps its order (operator value, then weather, then seasonal for humidity and temperature; moisture from the operator or the labelled example only). The guard now receives the full `ProvenancedValue` list and stores it on the JobSheet record as `conditionProvenance`, beside the existing `conditionSources` (`plant`, `weather`, `seasonal`), which stays for compatibility with stored rows.

### 6.4 C20: a weather value sent by a client

`POST /jobs` and `PUT /lots/:lotId/conditions` accept a weather-sourced value only with an `observationId`, and the value must be the server's own cached reading. The server loads the observation from `weather_observations`, which only the server writes, and accepts the label only if the ID is the current or previous entry of `weather_cache/pune` (so `readWeather` produced it), the observation is less than 60 minutes old, and the value equals the stored reading. The stored value is the observation's, never the client's. Otherwise the client's value is stored as `operator_entry` ("Entered by operator"). An edited weather value is operator entry (AC1.19). Test requirement: a request with a made-up `observationId`, with a real but older observation, and with a real current observation and a changed value each stores `operator_entry`.

### 6.5 Domain sign-off needed

From the data audit: outdoor Pune weather as a stand-in for plant-floor ambient (P1 assumption a), and 7.3% as a realistic example moisture for Om's plant (P2). Both need Om before the demo shows them as anything other than labelled examples.

## 7. Deploy reproducibility (ADR-0006)

Today no deploy command exists in the repository, the `Dockerfile` does not build `web/`, and `public/app/` is gitignored, so the React bundle in the live image comes from someone's local build.

Proposed:

1. **Dockerfile, two stages.** Stage 1 (`node:22-slim`, same digest): `npm ci` and `npm run build` in `web/`, output to `public/app`. Stage 2: the current runtime stage plus `COPY --from=web /app/public/app ./public/app`. `.dockerignore` gains `**/node_modules`.
2. **Cloud Build smoke step** also fetches `/app/` and one hashed asset from the built image.
3. **Checked-in service config.** `ops/deploy/momentum.env.yaml` holds the non-secret env values; secrets stay `--update-secrets` references by name. `ops/deploy/momentum.flags` holds scaling, concurrency, affinity, CPU boost, timeout and resources. The first version is generated from the live service and diffed (names only for secret-backed vars) so the file starts equal to production.
4. **`ops/deploy/deploy.sh <tag>`**: refuses a dirty tree; builds with Cloud Build and tags the image with the commit SHA in `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/`; runs `gcloud run deploy momentum --image <sha image> --no-traffic --tag <tag>` with the checked-in env and flags; runs `tools/release-preflight.mjs` against the tagged URL; writes the preflight output under `docs/arc/delivery/changes/`; stops. It never moves traffic.
5. **Preflight additions:** `/app/` returns 200; `idempotencyScope` is `shared-firestore`; budget policy parses and `peek` works; approve-guard flag state as expected; optimizer bytes setting printed; duplicate `job_id` check (3.2); today's budget counters.
6. **Traffic shift** is a separate, manual command after the release gate: `gcloud run services update-traffic momentum --to-revisions <new>=100`. The previous revision keeps a tag (`prev-<date>`) and is not deleted. Rollback: `update-traffic --to-revisions <previous>=100`.

## 8. Failure modes

| Failure | Effect | Behaviour | Retry |
|---|---|---|---|
| Firestore unavailable | Durable commands cannot claim, read reviews or reserve budget | Fail closed with `SERVICE_UNAVAILABLE`; no Gemini call; dashboard read paths that do not need Firestore keep working | Client retry with the same key; no automatic server retry beyond the REST helper's ABORTED retry (max 3, as today) |
| Instance restart mid-plan | Claim and revision left in progress | Lease expiry (130 s), then resume replays with the same key (3.4) | One more explanation attempt, counted |
| Weather API down or out of range | No pre-fill | Fields show "Required"; guard falls back to seasonal with its label | Next cache refresh |
| Budget exhausted or reserved | Typed turns and model steps blocked | 429 with the reason; button paths without Gemini keep working | After the window, or founder raises the limit by env change (change record) |
| Demo session issuance limit reached | No new session from that address for up to an hour | 429 `DEMO_SESSION_RATE_LIMITED` with `Retry-After`; sessions already issued keep working | After the hour |
| Pitch reserve secret unreadable at start | Pitch claim unavailable | `POST /api/auth/pitch-claim` returns 503; the reserve stays unused and the rest of the day limit works | Fix the secret reference and deploy a new revision |
| Superseded draft approved by an old tab | Blocked | 409 `REVISION_SUPERSEDED` with the current revision | User reviews the new revision |
| BigQuery MERGE slower than the lease | Two owners | Fencing check before the write; duplicate check in preflight | n/a |
| Trace event write to Firestore fails | Stored trace stops short; other instances cannot show the rest | Head written once as `incomplete` (2.3); store-backed stream ends with `stream.error` `TRACE_INCOMPLETE`; the running instance serves the full trace from memory. If the head write also fails: 404 `TRACE_NOT_FOUND` or a stream that ends silently on other instances | None for the trace copy; the run itself is not affected |
| TTL deletes an expired review before the user returns | Review gone | Same as logical expiry: "Read the order again" | User re-reads (one attempt) |

## 9. Founder decisions this design needs

- **F1. `prepagent` and the shared counter (E7).** Options: (a) move `momentum` to `budget-v2` and leave `prepagent` on its own 100-attempt day counter, no longer shared; (b) turn Gemini off on `prepagent` until after 4 December; (c) set both to the same cap now. Recommendation: (b) if nobody needs `prepagent` for the finals, otherwise (a). Until one of these is done, using `prepagent` first on a day blocks `momentum`'s Gemini calls for that day.
- **F2. Budget numbers and the pitch reserve.** Proposed: day 300, session 40 per day, 120 per IP address per day (shared by everyone behind one venue address), 20 per minute global, 6 per minute per session, 30 new demo sessions per IP address per hour (judges at the venue may share one address, so this is set above the expected booth traffic), and 80 reserved on 4 December for sessions holding the pitch claim (120 per day for such a session). Eval pool: 900 a day, 10 per minute, blocked on 4 December. Confirm the numbers and the pitch slot time.
- **F3. Demo-day scaling and cost.** Min 1 from now to 2 December, min 2 on 3 and 4 December, max 6; about ₹620 for the period before Gemini. Approve?
- **F4. Billing credits.** A founder checks in the console that credits cover Vertex AI and Cloud Run.
- **F5. Old drafts.** With the approve guard on, the 4 existing DRAFT rows become read-only. Acceptable?
- Q9 (manual approval checkbox) blocks step 7b; it is already open in the spec.
