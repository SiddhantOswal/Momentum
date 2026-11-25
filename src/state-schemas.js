import { z } from "zod";
import {
  JobIdSchema,
  OrderExtractionApiResponseSchema,
  OrderOperatorFieldsSchema,
  TimestampSchema,
} from "./schemas.js";
import { TraceEventSchema } from "./trace-registry.js";

export const STATE_SCHEMA_VERSION = 1;

// Firestore stores these as Timestamps so the TTL policy on expiresAt applies.
export const BASE_TIMESTAMP_FIELDS = Object.freeze(["createdAt", "updatedAt", "expiresAt"]);

export const Sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const SessionIdSchema = z.string().regex(/^[a-f0-9]{32}$/);
export const LotIdSchema = z.string().regex(/^LOT-HACK-[a-f0-9]{32}-[a-f0-9]{12}$/);
// demoJobIdentity in hackathon-demo-auth.js builds this format.
export const DemoJobIdSchema = z.string().regex(/^JOB-HACK-[a-f0-9]{32}-[a-f0-9]{40}$/);
export const StepIdSchema = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
export const ToolNameSchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
// arc1.<taskRunId>.<stepId>.<attempt>.<argsHash16>; at most 97 characters, inside the 128 the Idempotency-Key check allows.
export const EffectKeySchema = z.string().regex(/^arc1\.[a-f0-9]{32}\.[a-z][a-z0-9_]{0,39}\.[0-3]\.[a-f0-9]{16}$/);
// A keyed hash of the client address; a raw address is never stored.
export const IpKeySchema = z.string().regex(/^[a-f0-9]{16}$/);
export const WaitingForSchema = z.enum(["confirm_order", "confirm_conditions", "choose_line", "approve"]);
// A pointer only; results stay in their own stores.
export const ResultRefSchema = z.object({
  kind: z.enum(["po_review", "job", "lot", "trace", "card", "turn", "metric", "photo"]),
  id: z.string().min(1).max(160),
}).strict();

const uuid = z.string().uuid();

const base = {
  schemaVersion: z.literal(STATE_SCHEMA_VERSION),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  expiresAt: TimestampSchema,
};

export const PoReviewDocSchema = z.object({
  ...base,
  reviewId: uuid,
  ownerSessionId: SessionIdSchema,
  reviewFingerprint: Sha256HexSchema,
  fileDigest: Sha256HexSchema,
  operatorFields: OrderOperatorFieldsSchema,
  result: OrderExtractionApiResponseSchema,
  reviewExpiresAt: TimestampSchema,
}).strict();

export const IdempotencyDocSchema = z.object({
  ...base,
  keyHash: Sha256HexSchema,
  scope: z.enum(["jobs", "po_review", "lot_conditions", "explanation"]),
  fingerprint: Sha256HexSchema,
  // For scope "jobs" this is the job ID; for the other scopes, the result ID.
  jobId: z.string().min(1).max(160),
  ownerToken: uuid,
  recordStatus: z.enum(["in_progress", "complete"]),
  // Epoch milliseconds, as the adapter writes them; the lease arithmetic uses these.
  claimedAt: z.number().int(),
  leaseExpiresAt: z.number().int(),
  completedAt: z.number().int().optional(),
}).strict();

export const TraceHeadDocSchema = z.object({
  ...base,
  runId: uuid,
  ownerSessionId: SessionIdSchema,
  kind: z.enum(["job_preparation", "arc_task_run"]),
  // "incomplete": the write-through stopped, so the stored events end at lastSequence and the run's end is unknown.
  status: z.enum(["running", "completed", "failed", "cancelled", "incomplete"]),
  lastSequence: z.number().int().nonnegative(),
  jobId: JobIdSchema.optional(),
  geminiAttempts: z.number().int().nonnegative(),
}).strict();

export const TraceEventDocSchema = TraceEventSchema.extend(base);

export const ArcEventTypeSchema = z.enum(["run.started", "step.started", "step.succeeded", "step.failed",
  "step.blocked", "step.waiting_for_user", "answer", "run.completed", "run.failed"]);

export const ArcEventDocSchema = z.object({
  ...base,
  // The server-sent event ID and the Last-Event-ID cursor.
  sequence: z.number().int().positive(),
  type: ArcEventTypeSchema,
  clientTurnId: uuid,
  stepId: StepIdSchema.nullable(),
  tool: ToolNameSchema.nullable(),
  waitingFor: WaitingForSchema.nullable(),
  errorCode: z.string().max(64).nullable(),
  // An answer event points at its turn; the text is stored only there.
  resultRef: ResultRefSchema.nullable(),
}).strict().superRefine((event, ctx) => {
  // The event carries the same waitingFor as the step that entered WAITING_FOR_USER.
  if ((event.type === "step.waiting_for_user") !== (event.waitingFor !== null)) {
    ctx.addIssue({ code: "custom", path: ["waitingFor"], message: "waitingFor is set exactly on step.waiting_for_user events" });
  }
});

// Each scope maps to [subject kind, number of digits in its IST window].
export const BUDGET_COUNTER_SHAPE = Object.freeze({
  day: ["all", 8],
  session_day: ["session", 8],
  ip_day: ["ip", 8],
  minute: ["all", 12],
  session_minute: ["session", 12],
  mint_ip_hour: ["ip", 10],
  claim_ip_hour: ["ip", 10],
  // Rupee spend per IST day (founder decision F2); units are micro-rupees, not attempts.
  cost_day: ["all", 8],
});
const BUDGET_SUBJECT = { all: /^all$/, session: /^[a-f0-9]{32}$/, ip: /^[a-f0-9]{16}$/ };

// Underscores only: a colon is not allowed in the counter ID.
export function budgetCounterId({ pool, scope, subject, window }) {
  return `${pool}_${scope}_${subject}_${window}`;
}

export const BudgetCounterDocSchema = z.object({
  ...base,
  counterId: z.string().regex(/^(live|eval)_[a-z_]{3,16}_(all|[a-f0-9]{16}|[a-f0-9]{32})_(\d{8}|\d{10}|\d{12})$/),
  pool: z.enum(["live", "eval"]),
  scope: z.enum(Object.keys(BUDGET_COUNTER_SHAPE)),
  subject: z.string(),
  window: z.string().regex(/^\d{8}(\d{2}|\d{4})?$/),
  units: z.number().int().nonnegative(),
  // Informational. Enforcement reads config, so a limit can change mid-day without locking other callers out.
  limit: z.number().int().positive(),
  policyVersion: z.literal("budget-v2"),
}).strict().superRefine((doc, ctx) => {
  const [kind, digits] = BUDGET_COUNTER_SHAPE[doc.scope];
  if (!BUDGET_SUBJECT[kind].test(doc.subject)) {
    ctx.addIssue({ code: "custom", path: ["subject"], message: `scope ${doc.scope} needs a ${kind} subject` });
  }
  if (doc.window.length !== digits) {
    ctx.addIssue({ code: "custom", path: ["window"], message: `scope ${doc.scope} needs a ${digits}-digit window` });
  }
  if (doc.counterId !== budgetCounterId(doc)) {
    ctx.addIssue({ code: "custom", path: ["counterId"], message: "counterId must be built by budgetCounterId" });
  }
});

export const BudgetPurposeSchema = z.enum(["order_extraction", "explanation", "photo_classification",
  "photo_diagnosis", "arc_router", "arc_answer_writer"]);

export const BudgetReservationDocSchema = z.object({
  ...base,
  keyHash: Sha256HexSchema,
  pool: z.enum(["live", "eval"]),
  sessionId: SessionIdSchema.nullable(),
  ipKey: IpKeySchema.nullable(),
  purpose: BudgetPurposeSchema,
  dayWindow: z.string().regex(/^\d{8}$/),
  units: z.number().int().positive(),
  usedPitchReserve: z.boolean(),
  evalSuite: z.string().regex(/^[a-z][a-z-]{2,31}$/).nullable(),
}).strict().superRefine((doc, ctx) => {
  if ((doc.pool === "eval") !== (doc.evalSuite !== null)) {
    ctx.addIssue({ code: "custom", path: ["evalSuite"], message: "evalSuite is required in the eval pool and absent in the live pool" });
  }
});

// IDs that list_samples and list_approved_photos returned in this session. They are what a later
// turn may name, so they carry no text beyond the ID shape. photo-NN matches PhotoClassificationRequestSchema.
export const DiscoveredIdsSchema = z.object({
  sampleIds: z.array(z.string().regex(/^PO[1-9]$/)).max(5),
  photoIds: z.array(z.string().regex(/^photo-\d{2}$/)).max(10),
}).strict();

export const ArcSessionDocSchema = z.object({
  ...base,
  sessionId: SessionIdSchema,
  authorizationMode: z.literal("HACKATHON_DEMO"),
  identityLabel: z.literal("Demo session, simulated"),
  sessionExpiresAt: TimestampSchema,
  activeLotIds: z.array(LotIdSchema).max(5),
  // Newest last. The router may choose only from these job IDs.
  jobIds: z.array(DemoJobIdSchema).max(20),
  // Absent on records written before this field existed; readers treat that as empty.
  discovered: DiscoveredIdsSchema.optional(),
  activeTaskRunId: uuid.nullable(),
  // Oldest first; their summaries are the router's history.
  recentTurnIds: z.array(uuid).max(4),
  turnCount: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
}).strict().superRefine((doc, ctx) => {
  doc.jobIds.forEach((id, index) => {
    if (!id.startsWith(`JOB-HACK-${doc.sessionId}-`)) {
      ctx.addIssue({ code: "custom", path: ["jobIds", index], message: "job belongs to another session" });
    }
  });
  doc.activeLotIds.forEach((id, index) => {
    if (!id.startsWith(`LOT-HACK-${doc.sessionId}-`)) {
      ctx.addIssue({ code: "custom", path: ["activeLotIds", index], message: "lot belongs to another session" });
    }
  });
});

export const ArcTurnInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("action"), actionId: ToolNameSchema, paramsHash: Sha256HexSchema }).strict(),
  z.object({ kind: z.literal("text"), text: z.string().min(1).max(1000) }).strict(),
]);

export const ArcTurnSummarySchema = z.object({
  intent: z.string().max(64).nullable(),
  tools: z.array(ToolNameSchema).max(4),
  resultRefs: z.array(ResultRefSchema).max(8),
  attempts: z.number().int().min(0).max(2),
  writerOutcome: z.enum(["not_called", "shown", "fallback"]),
  fallbackReason: z.string().max(64).nullable(),
  // Prompt, model and config versions.
  versions: z.record(z.string().max(48), z.string().max(48)),
}).strict();

// Never holds tool results, prompts or order-derived text; the card under an answer is rebuilt from resultRefs.
export const ArcTurnDocSchema = z.object({
  ...base,
  clientTurnId: uuid,
  sessionId: SessionIdSchema,
  taskRunId: uuid.nullable(),
  recordStatus: z.enum(["in_progress", "complete", "failed"]),
  ownerToken: uuid,
  leaseExpiresAt: TimestampSchema,
  // The same clientTurnId with a different input is a 409.
  inputFingerprint: Sha256HexSchema,
  input: ArcTurnInputSchema,
  answerText: z.string().max(1200).nullable(),
  // An expired execution lease can move without changing an attempt's reservation.
  reservationOwnerToken: uuid.optional(),
  summary: ArcTurnSummarySchema.nullable(),
  eventRange: z.object({ first: z.number().int().positive(), last: z.number().int().positive() }).strict().nullable(),
  // Set when recordStatus is "failed", so a turn without a task run can still replay its reason (wire contract D3).
  errorCode: z.string().max(64).nullable(),
}).strict();

export const StepStatusSchema = z.enum(["PENDING", "RUNNING", "SUCCEEDED", "FAILED",
  "BLOCKED", "WAITING_FOR_USER", "SKIPPED"]);

export const TaskStepSchema = z.object({
  stepId: StepIdSchema,
  tool: ToolNameSchema,
  status: StepStatusSchema,
  argsHash: Sha256HexSchema.nullable(),
  // Null only for read-only tools that spend no Gemini attempt.
  idempotencyKey: EffectKeySchema.nullable(),
  attempt: z.number().int().nonnegative().max(3),
  leaseOwner: uuid.nullable(),
  reservationOwner: uuid.optional(),
  geminiAttempts: z.number().int().nonnegative().optional(),
  leaseExpiresAt: TimestampSchema.nullable(),
  resultRef: ResultRefSchema.nullable(),
  waitingFor: WaitingForSchema.nullable(),
  errorCode: z.string().max(64).nullable(),
  startedAt: TimestampSchema.nullable(),
  finishedAt: TimestampSchema.nullable(),
}).strict().superRefine((step, ctx) => {
  if ((step.status === "WAITING_FOR_USER") !== (step.waitingFor !== null)) {
    ctx.addIssue({ code: "custom", path: ["waitingFor"], message: "waitingFor is set exactly when the step waits for the user" });
  }
});

export const ArcTaskRunDocSchema = z.object({
  ...base,
  taskRunId: uuid,
  sessionId: SessionIdSchema,
  kind: z.enum(["lot_preparation", "photo_check", "history_search", "data_question"]),
  lotId: LotIdSchema.nullable(),
  status: z.enum(["RUNNING", "WAITING_FOR_USER", "BLOCKED", "FAILED", "COMPLETED", "CANCELLED"]),
  steps: z.array(TaskStepSchema).min(1).max(16),
  version: z.number().int().nonnegative(),
}).strict();

export const ProvenancedValueSchema = z.object({
  field: z.enum(["ambientRhPct", "ambientTempC", "paperMoisturePct", "runDate", "shift"]),
  value: z.union([z.number().finite(), z.string().min(1).max(16)]),
  unit: z.enum(["% RH", "°C", "%", "date", "shift"]),
  provenance: z.enum(["operator_entry", "public_weather_record", "synthetic_example",
    "dataset_seasonal", "plant_sensor", "simulated_sensor"]),
  sourceDetail: z.enum(["typed", "confirmed", "example", "weather", "seasonal_typical", "sensor"]),
  // Chip text, set by code from the product spec.
  label: z.string().min(1).max(80),
  observationId: z.string().uuid().optional(),
  observedAt: TimestampSchema.optional(),
  enteredByRole: z.enum(["Operator session", "Supervisor session"]).optional(),
  confirmed: z.boolean(),
}).strict().superRefine((value, ctx) => {
  const weather = value.provenance === "public_weather_record";
  if (weather && (value.observationId === undefined || value.observedAt === undefined)) {
    ctx.addIssue({ code: "custom", path: ["observationId"], message: "a public weather record needs its observationId and observedAt" });
  }
  if (!weather && value.observationId !== undefined) {
    ctx.addIssue({ code: "custom", path: ["observationId"], message: "only a public weather record carries an observationId" });
  }
});

export const LotHeadDocSchema = z.object({
  ...base,
  lotId: LotIdSchema,
  ownerSessionId: SessionIdSchema,
  reviewId: uuid.nullable(),
  orderRef: z.object({
    orderId: z.string(),
    itemCode: z.string(),
    quantity: z.number().int().positive(),
    // The review line the operator confirmed; part of the job identity, so Arc plans with the same line.
    lineIndex: z.number().int().nonnegative().optional(),
  }).strict().nullable(),
  draftConditions: z.array(ProvenancedValueSchema).max(5),
  conditionsFingerprint: Sha256HexSchema.nullable(),
  // 0 means the lot has never been planned.
  currentRevision: z.number().int().nonnegative(),
  currentJobId: JobIdSchema.nullable(),
  stage: z.enum(["order_review", "conditions", "planning", "draft_review",
    "approval_pending", "approved", "held"]),
  version: z.number().int().nonnegative(),
}).strict();

export const LotRevisionDocSchema = z.object({
  ...base,
  jobId: JobIdSchema,
  lotId: LotIdSchema,
  number: z.number().int().positive(),
  status: z.enum(["PENDING", "CURRENT", "SUPERSEDED", "APPROVING", "APPROVED", "FAILED"]),
  // The createJobRequestIdentity fingerprint.
  requestFingerprint: Sha256HexSchema,
  revisionFingerprint: Sha256HexSchema.nullable(),
  // Frozen when the revision is registered.
  conditions: z.array(ProvenancedValueSchema).max(5),
  supersededBy: JobIdSchema.nullable(),
  supersededReason: z.object({
    field: z.string(),
    from: z.union([z.number(), z.string()]),
    to: z.union([z.number(), z.string()]),
    provenance: z.string(),
    byRole: z.string(),
  }).strict().nullable(),
  approvingLeaseExpiresAt: TimestampSchema.nullable(),
  approvedAt: TimestampSchema.nullable(),
}).strict();

export const WeatherObservationDocSchema = z.object({
  ...base,
  observationId: uuid,
  observedAt: TimestampSchema,
  fetchedAt: TimestampSchema,
  locationName: z.literal("Pune"),
  latitude: z.number(),
  longitude: z.number(),
  ambientRhPct: z.number().min(0).max(100),
  ambientTempC: z.number().finite(),
  // Checked against config/condition-ranges.json.
  withinModelRange: z.boolean(),
  provider: z.literal("google-maps-platform-weather"),
  provenance: z.literal("public_weather_record"),
  label: z.literal("Public weather record, not a plant sensor."),
}).strict();

// weather_cache/pune: the shared 10-minute cache.
export const WeatherCacheDocSchema = z.object({
  ...base,
  observationId: uuid,
  previousObservationId: uuid.nullable(),
  fetchedAt: TimestampSchema,
}).strict();
