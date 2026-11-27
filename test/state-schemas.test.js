import assert from "node:assert/strict";
import test from "node:test";
import {
  ArcEventDocSchema,
  ArcSessionDocSchema,
  ArcTaskRunDocSchema,
  ArcTurnDocSchema,
  BASE_TIMESTAMP_FIELDS,
  budgetCounterId,
  BudgetCounterDocSchema,
  BudgetReservationDocSchema,
  EffectKeySchema,
  IdempotencyDocSchema,
  LotHeadDocSchema,
  LotRevisionDocSchema,
  PoReviewDocSchema,
  ProvenancedValueSchema,
  TaskStepSchema,
  TraceEventDocSchema,
  TraceHeadDocSchema,
  WaitingForSchema,
  WeatherCacheDocSchema,
  WeatherObservationDocSchema,
} from "../src/state-schemas.js";
import { encodeDocument, parseDocument } from "../src/google-cloud/firestore-rest.js";

const SID = "0123456789abcdef0123456789abcdef";
const OTHER_SID = "fedcba9876543210fedcba9876543210";
const UUID_A = "6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d";
const UUID_B = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const HASH = "a".repeat(64);
const LOT_ID = `LOT-HACK-${SID}-0123456789ab`;
const JOB_ID = `JOB-HACK-${SID}-${"b".repeat(40)}`;
const IP_KEY = "0123456789abcdef";

const base = {
  schemaVersion: 1,
  createdAt: "2026-12-04T04:00:00.000Z",
  updatedAt: "2026-12-04T04:00:00.000Z",
  expiresAt: "2026-12-11T04:00:00.000Z",
};

function rejects(schema, document, path) {
  const result = schema.safeParse(document);
  assert.equal(result.success, false, `expected rejection at ${path?.join(".") ?? "(any)"}`);
  if (path) {
    assert.ok(
      result.error.issues.some((issue) => issue.path.join(".") === path.join(".")),
      `no issue at ${path.join(".")}: ${JSON.stringify(result.error.issues)}`,
    );
  }
}

function accepts(schema, document) {
  const result = schema.safeParse(document);
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
}

const poReview = {
  ...base,
  reviewId: UUID_A,
  ownerSessionId: SID,
  reviewFingerprint: HASH,
  fileDigest: "c".repeat(64),
  operatorFields: { orderId: "PO-1" },
  result: {
    ok: true,
    agent: "extractOrder",
    source: "mock-demo",
    isRealModelPrediction: false,
    missingFields: [],
    needsClarification: false,
  },
  reviewExpiresAt: "2026-12-04T04:30:00.000Z",
};

test("po_reviews document", () => {
  accepts(PoReviewDocSchema, poReview);
  rejects(PoReviewDocSchema, { ...poReview, ownerSessionId: "demo:abc" }, ["ownerSessionId"]);
  rejects(PoReviewDocSchema, { ...poReview, result: { ...poReview.result, needsClarification: true } }, ["result"]);
  rejects(PoReviewDocSchema, { ...poReview, rawText: "Buyer: someone" });
  rejects(PoReviewDocSchema, { ...poReview, schemaVersion: 2 }, ["schemaVersion"]);
  rejects(PoReviewDocSchema, { ...poReview, expiresAt: "2026-12-11" }, ["expiresAt"]);
});

const idempotency = {
  ...base,
  keyHash: HASH,
  scope: "jobs",
  fingerprint: "d".repeat(64),
  jobId: JOB_ID,
  ownerToken: UUID_A,
  recordStatus: "in_progress",
  claimedAt: 1_764_820_800_000,
  leaseExpiresAt: 1_764_820_930_000,
};

test("idempotency document", () => {
  accepts(IdempotencyDocSchema, idempotency);
  accepts(IdempotencyDocSchema, { ...idempotency, recordStatus: "complete", completedAt: 1_764_820_900_000 });
  rejects(IdempotencyDocSchema, { ...idempotency, scope: "arc_turn" }, ["scope"]);
  rejects(IdempotencyDocSchema, { ...idempotency, leaseExpiresAt: "2026-12-04T04:02:10Z" }, ["leaseExpiresAt"]);
  rejects(IdempotencyDocSchema, { ...idempotency, ownerToken: "owner-token-1" }, ["ownerToken"]);
});

const traceHead = {
  ...base,
  runId: UUID_A,
  ownerSessionId: SID,
  kind: "arc_task_run",
  status: "running",
  lastSequence: 0,
  geminiAttempts: 0,
};

test("traces head document", () => {
  accepts(TraceHeadDocSchema, traceHead);
  accepts(TraceHeadDocSchema, { ...traceHead, kind: "job_preparation", jobId: JOB_ID });
  rejects(TraceHeadDocSchema, { ...traceHead, kind: "chat" }, ["kind"]);
  rejects(TraceHeadDocSchema, { ...traceHead, lastSequence: -1 }, ["lastSequence"]);
});

test("job preparation trace event document keeps the registry event shape", () => {
  const event = {
    ...base,
    id: `${UUID_A}:1`,
    runId: UUID_A,
    sequence: 1,
    occurredAt: "2026-12-04T04:00:00.000Z",
    type: "run.completed",
  };
  accepts(TraceEventDocSchema, event);
  rejects(TraceEventDocSchema, { ...event, schemaVersion: undefined }, ["schemaVersion"]);
  rejects(TraceEventDocSchema, { ...event, answerText: "hello" });
});

const arcEvent = {
  ...base,
  sequence: 3,
  type: "step.waiting_for_user",
  clientTurnId: UUID_B,
  stepId: "plan_lot",
  tool: "plan_lot",
  waitingFor: "approve",
  errorCode: null,
  resultRef: { kind: "job", id: JOB_ID },
};

test("arc task-run event document", () => {
  accepts(ArcEventDocSchema, arcEvent);
  accepts(ArcEventDocSchema, { ...arcEvent, type: "answer", stepId: null, tool: null, waitingFor: null, resultRef: { kind: "turn", id: UUID_B } });
  rejects(ArcEventDocSchema, { ...arcEvent, sequence: 0 }, ["sequence"]);
  rejects(ArcEventDocSchema, { ...arcEvent, type: "tool.started" }, ["type"]);
  rejects(ArcEventDocSchema, { ...arcEvent, resultRef: { kind: "answer_text", id: "x" } }, ["resultRef", "kind"]);
  rejects(ArcEventDocSchema, { ...arcEvent, text: "The plan is ready." });
});

test("arc event: waitingFor is set exactly on step.waiting_for_user", () => {
  accepts(ArcEventDocSchema, { ...arcEvent, type: "step.waiting_for_user", waitingFor: "confirm_conditions" });
  rejects(ArcEventDocSchema, { ...arcEvent, type: "step.waiting_for_user", waitingFor: null }, ["waitingFor"]);
  rejects(ArcEventDocSchema, { ...arcEvent, type: "step.succeeded", waitingFor: "approve" }, ["waitingFor"]);
});

test("waitingFor enum is fixed to the four user waits", () => {
  assert.deepEqual(WaitingForSchema.options, ["confirm_order", "confirm_conditions", "choose_line", "approve"]);
  rejects(WaitingForSchema, "approve_job");
});

const counter = {
  ...base,
  pool: "live",
  scope: "session_minute",
  subject: SID,
  window: "202612040930",
  units: 2,
  limit: 6,
  policyVersion: "budget-v2",
};
counter.counterId = budgetCounterId(counter);

test("budget counter document", () => {
  assert.equal(counter.counterId, `live_session_minute_${SID}_202612040930`);
  accepts(BudgetCounterDocSchema, counter);
  const day = { ...counter, scope: "day", subject: "all", window: "20261204" };
  accepts(BudgetCounterDocSchema, { ...day, counterId: budgetCounterId(day) });
  const ipHour = { ...counter, pool: "eval", scope: "mint_ip_hour", subject: IP_KEY, window: "2026120409" };
  accepts(BudgetCounterDocSchema, { ...ipHour, counterId: budgetCounterId(ipHour) });

  rejects(BudgetCounterDocSchema, { ...counter, counterId: `live:session_minute:${SID}:202612040930` }, ["counterId"]);
  rejects(BudgetCounterDocSchema, { ...counter, counterId: `live_session_minute_${OTHER_SID}_202612040930` }, ["counterId"]);
  const wrongSubject = { ...counter, subject: IP_KEY };
  rejects(BudgetCounterDocSchema, { ...wrongSubject, counterId: budgetCounterId(wrongSubject) }, ["subject"]);
  const wrongWindow = { ...counter, window: "20261204" };
  rejects(BudgetCounterDocSchema, { ...wrongWindow, counterId: budgetCounterId(wrongWindow) }, ["window"]);
  rejects(BudgetCounterDocSchema, { ...counter, policyVersion: "ist-attempts-v1" }, ["policyVersion"]);
});

const reservation = {
  ...base,
  keyHash: HASH,
  pool: "live",
  sessionId: SID,
  ipKey: IP_KEY,
  purpose: "arc_router",
  dayWindow: "20261204",
  units: 1,
  usedPitchReserve: false,
  evalSuite: null,
};

test("budget reservation document", () => {
  accepts(BudgetReservationDocSchema, reservation);
  accepts(BudgetReservationDocSchema, { ...reservation, pool: "eval", evalSuite: "prompt-injection" });
  rejects(BudgetReservationDocSchema, { ...reservation, pool: "eval" }, ["evalSuite"]);
  rejects(BudgetReservationDocSchema, { ...reservation, evalSuite: "grounding" }, ["evalSuite"]);
  rejects(BudgetReservationDocSchema, { ...reservation, ipKey: "203.0.113.7" }, ["ipKey"]);
  rejects(BudgetReservationDocSchema, { ...reservation, units: 0 }, ["units"]);
});

const session = {
  ...base,
  sessionId: SID,
  authorizationMode: "HACKATHON_DEMO",
  identityLabel: "Demo session, simulated",
  sessionExpiresAt: "2026-12-04T06:00:00.000Z",
  activeLotIds: [LOT_ID],
  jobIds: [JOB_ID],
  activeTaskRunId: UUID_A,
  recentTurnIds: [UUID_B],
  turnCount: 1,
  version: 3,
};

test("arc session document", () => {
  accepts(ArcSessionDocSchema, session);
  accepts(ArcSessionDocSchema, { ...session, activeLotIds: [], jobIds: [], activeTaskRunId: null, recentTurnIds: [] });
  rejects(ArcSessionDocSchema, { ...session, jobIds: [`JOB-HACK-${OTHER_SID}-${"b".repeat(40)}`] }, ["jobIds", 0]);
  rejects(ArcSessionDocSchema, { ...session, activeLotIds: [`LOT-HACK-${OTHER_SID}-0123456789ab`] }, ["activeLotIds", 0]);
  rejects(ArcSessionDocSchema, { ...session, activeLotIds: Array(6).fill(LOT_ID) }, ["activeLotIds"]);
  rejects(ArcSessionDocSchema, { ...session, jobIds: Array(21).fill(JOB_ID) }, ["jobIds"]);
  rejects(ArcSessionDocSchema, { ...session, recentTurnIds: Array(5).fill(UUID_B) }, ["recentTurnIds"]);
  rejects(ArcSessionDocSchema, { ...session, identityLabel: "Supervisor" }, ["identityLabel"]);
});

const turn = {
  ...base,
  clientTurnId: UUID_B,
  sessionId: SID,
  taskRunId: UUID_A,
  recordStatus: "complete",
  ownerToken: UUID_A,
  leaseExpiresAt: "2026-12-04T04:02:10.000Z",
  inputFingerprint: HASH,
  input: { kind: "text", text: "Why is warp risk high on this lot?" },
  answerText: "Warp risk is high because paper moisture is above the model range.",
  summary: {
    intent: "explain_risk",
    tools: ["get_job"],
    resultRefs: [{ kind: "job", id: JOB_ID }],
    attempts: 1,
    writerOutcome: "shown",
    fallbackReason: null,
    versions: { prompt: "router-v1", model: "gemini-3.5-flash" },
  },
  eventRange: { first: 4, last: 7 },
  errorCode: null,
};

test("arc turn document", () => {
  accepts(ArcTurnDocSchema, turn);
  accepts(ArcTurnDocSchema, {
    ...turn, recordStatus: "in_progress", taskRunId: null, answerText: null, summary: null, eventRange: null,
    input: { kind: "action", actionId: "plan_lot", paramsHash: HASH },
  });
  rejects(ArcTurnDocSchema, { ...turn, input: { kind: "text", text: "x".repeat(1001) } }, ["input", "text"]);
  rejects(ArcTurnDocSchema, { ...turn, input: { kind: "voice", audio: "..." } }, ["input", "kind"]);
  rejects(ArcTurnDocSchema, { ...turn, summary: { ...turn.summary, toolResults: [{ risk: "HIGH" }] } }, ["summary"]);
  rejects(ArcTurnDocSchema, { ...turn, summary: { ...turn.summary, attempts: 3 } }, ["summary", "attempts"]);
  rejects(ArcTurnDocSchema, { ...turn, prompt: "You are Arc" });
  rejects(ArcTurnDocSchema, { ...turn, answerText: "x".repeat(1201) }, ["answerText"]);
  accepts(ArcTurnDocSchema, { ...turn, recordStatus: "failed", errorCode: "BUDGET_DAY_EXHAUSTED" });
  rejects(ArcTurnDocSchema, { ...turn, errorCode: "x".repeat(65) }, ["errorCode"]);
  const { errorCode, ...withoutErrorCode } = turn;
  rejects(ArcTurnDocSchema, withoutErrorCode, ["errorCode"]);
});

const step = {
  stepId: "plan_lot",
  tool: "plan_lot",
  status: "RUNNING",
  argsHash: HASH,
  idempotencyKey: `arc1.${"e".repeat(32)}.plan_lot.0.${"f".repeat(16)}`,
  attempt: 0,
  leaseOwner: UUID_A,
  leaseExpiresAt: "2026-12-04T04:02:10.000Z",
  resultRef: null,
  waitingFor: null,
  errorCode: null,
  startedAt: "2026-12-04T04:00:00.000Z",
  finishedAt: null,
};

test("task step: waitingFor is set exactly while the step waits for the user", () => {
  accepts(TaskStepSchema, step);
  accepts(TaskStepSchema, { ...step, status: "WAITING_FOR_USER", waitingFor: "approve" });
  rejects(TaskStepSchema, { ...step, status: "WAITING_FOR_USER" }, ["waitingFor"]);
  rejects(TaskStepSchema, { ...step, status: "SUCCEEDED", waitingFor: "confirm_order" }, ["waitingFor"]);
  rejects(TaskStepSchema, { ...step, status: "DONE" }, ["status"]);
  rejects(TaskStepSchema, { ...step, attempt: 4 }, ["attempt"]);
});

test("effect key format matches 3.3 and stays within the Idempotency-Key limit", () => {
  const longest = `arc1.${"e".repeat(32)}.${"s".repeat(40)}.3.${"f".repeat(16)}`;
  accepts(EffectKeySchema, longest);
  assert.equal(longest.length, 97);
  rejects(EffectKeySchema, `arc1.${"e".repeat(32)}.plan_lot.4.${"f".repeat(16)}`);
  rejects(EffectKeySchema, `arc1.${UUID_A}.plan_lot.0.${"f".repeat(16)}`);
  rejects(EffectKeySchema, `arcturn1.${"e".repeat(32)}`);
});

const taskRun = {
  ...base,
  taskRunId: UUID_A,
  sessionId: SID,
  kind: "lot_preparation",
  lotId: LOT_ID,
  status: "RUNNING",
  steps: [step],
  version: 0,
};

test("arc task run document", () => {
  accepts(ArcTaskRunDocSchema, taskRun);
  accepts(ArcTaskRunDocSchema, { ...taskRun, kind: "data_question", lotId: null });
  rejects(ArcTaskRunDocSchema, { ...taskRun, steps: [] }, ["steps"]);
  rejects(ArcTaskRunDocSchema, { ...taskRun, steps: Array(17).fill(step) }, ["steps"]);
  rejects(ArcTaskRunDocSchema, { ...taskRun, steps: [{ ...step, status: "WAITING_FOR_USER" }] }, ["steps", 0, "waitingFor"]);
  rejects(ArcTaskRunDocSchema, { ...taskRun, status: "APPROVED" }, ["status"]);
});

const operatorMoisture = {
  field: "paperMoisturePct",
  value: 7.3,
  unit: "%",
  provenance: "operator_entry",
  sourceDetail: "typed",
  label: "Typed by operator",
  enteredByRole: "Operator session",
  confirmed: true,
};
const weatherRh = {
  field: "ambientRhPct",
  value: 78,
  unit: "% RH",
  provenance: "public_weather_record",
  sourceDetail: "weather",
  label: "Public weather record, not a plant sensor",
  observationId: UUID_A,
  observedAt: "2026-12-04T03:45:00.000Z",
  confirmed: false,
};

test("provenanced value: observationId goes with public weather records only", () => {
  accepts(ProvenancedValueSchema, operatorMoisture);
  accepts(ProvenancedValueSchema, weatherRh);
  rejects(ProvenancedValueSchema, { ...weatherRh, observationId: undefined }, ["observationId"]);
  rejects(ProvenancedValueSchema, { ...weatherRh, observedAt: undefined }, ["observationId"]);
  rejects(ProvenancedValueSchema, { ...operatorMoisture, observationId: UUID_A }, ["observationId"]);
  rejects(ProvenancedValueSchema, { ...operatorMoisture, provenance: "sensor_feed" }, ["provenance"]);
  rejects(ProvenancedValueSchema, { ...operatorMoisture, value: Number.NaN }, ["value"]);
});

const lotHead = {
  ...base,
  lotId: LOT_ID,
  ownerSessionId: SID,
  reviewId: UUID_A,
  orderRef: { orderId: "PO-1", itemCode: "PKBX0041", quantity: 5000 },
  draftConditions: [operatorMoisture, weatherRh],
  conditionsFingerprint: HASH,
  currentRevision: 1,
  currentJobId: JOB_ID,
  stage: "draft_review",
  version: 2,
};

test("lot head document", () => {
  accepts(LotHeadDocSchema, lotHead);
  accepts(LotHeadDocSchema, { ...lotHead, reviewId: null, orderRef: null, draftConditions: [], conditionsFingerprint: null, currentRevision: 0, currentJobId: null, stage: "order_review" });
  rejects(LotHeadDocSchema, { ...lotHead, lotId: `LOT-${SID}` }, ["lotId"]);
  rejects(LotHeadDocSchema, { ...lotHead, stage: "running" }, ["stage"]);
  rejects(LotHeadDocSchema, { ...lotHead, draftConditions: [{ ...weatherRh, observationId: undefined }] }, ["draftConditions", 0, "observationId"]);
  rejects(LotHeadDocSchema, { ...lotHead, orderRef: { ...lotHead.orderRef, quantity: 0 } }, ["orderRef", "quantity"]);
});

const revision = {
  ...base,
  jobId: JOB_ID,
  lotId: LOT_ID,
  number: 1,
  status: "SUPERSEDED",
  requestFingerprint: HASH,
  revisionFingerprint: "d".repeat(64),
  conditions: [operatorMoisture],
  supersededBy: `JOB-HACK-${SID}-${"c".repeat(40)}`,
  supersededReason: { field: "paperMoisturePct", from: 7.3, to: 8.1, provenance: "operator_entry", byRole: "Operator session" },
  approvingLeaseExpiresAt: null,
  approvedAt: null,
};

test("lot revision document", () => {
  accepts(LotRevisionDocSchema, revision);
  accepts(LotRevisionDocSchema, { ...revision, status: "PENDING", revisionFingerprint: null, supersededBy: null, supersededReason: null });
  rejects(LotRevisionDocSchema, { ...revision, number: 0 }, ["number"]);
  rejects(LotRevisionDocSchema, { ...revision, status: "DRAFT" }, ["status"]);
  rejects(LotRevisionDocSchema, { ...revision, approvedAt: "yesterday" }, ["approvedAt"]);
});

const observation = {
  ...base,
  observationId: UUID_A,
  observedAt: "2026-12-04T03:45:00.000Z",
  fetchedAt: "2026-12-04T03:50:00.000Z",
  locationName: "Pune",
  latitude: 18.5204,
  longitude: 73.8567,
  ambientRhPct: 78,
  ambientTempC: 24.5,
  withinModelRange: true,
  provider: "google-maps-platform-weather",
  provenance: "public_weather_record",
  label: "Public weather record, not a plant sensor.",
};

test("weather observation document", () => {
  accepts(WeatherObservationDocSchema, observation);
  rejects(WeatherObservationDocSchema, { ...observation, provenance: "plant_sensor" }, ["provenance"]);
  rejects(WeatherObservationDocSchema, { ...observation, label: "Plant sensor" }, ["label"]);
  rejects(WeatherObservationDocSchema, { ...observation, ambientRhPct: 101 }, ["ambientRhPct"]);
  rejects(WeatherObservationDocSchema, { ...observation, locationName: "Mumbai" }, ["locationName"]);
});

test("weather cache document", () => {
  const cache = { ...base, observationId: UUID_A, previousObservationId: null, fetchedAt: "2026-12-04T03:50:00.000Z" };
  accepts(WeatherCacheDocSchema, cache);
  accepts(WeatherCacheDocSchema, { ...cache, previousObservationId: UUID_B });
  rejects(WeatherCacheDocSchema, { ...cache, ambientRhPct: 78 });
  rejects(WeatherCacheDocSchema, { ...cache, observationId: "latest" }, ["observationId"]);
});

test("a state document round-trips through the REST codec with Timestamp base fields", () => {
  const fields = encodeDocument(ArcSessionDocSchema, session, { timestamps: [...BASE_TIMESTAMP_FIELDS, "sessionExpiresAt"] });
  assert.deepEqual(fields.expiresAt, { timestampValue: "2026-12-11T04:00:00.000Z" });
  assert.deepEqual(fields.sessionExpiresAt, { timestampValue: "2026-12-04T06:00:00.000Z" });
  assert.deepEqual(parseDocument(ArcSessionDocSchema, { fields }), session);

  const tampered = { fields: { ...fields, jobIds: { arrayValue: { values: [{ stringValue: `JOB-HACK-${OTHER_SID}-${"b".repeat(40)}` }] } } } };
  assert.throws(() => parseDocument(ArcSessionDocSchema, tampered), { code: "SERVICE_UNAVAILABLE" });
});
