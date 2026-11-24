/**
 * Browser-facing views of stored Arc records (wire contract sections 2 and 5).
 * Internal fields (leases, keys, hashes, versions, session IDs) never leave here.
 */

// Fixed loading labels, one per tool (05 section 6, G1).
const STEP_LABELS = Object.freeze({
  read_order: "Reading the order",
  get_weather: "Checking the weather",
  set_conditions: "Saving the conditions",
  plan_lot: "Planning the lot",
  retry_explanation: "Writing the explanation",
  query_metric: "Reading the data",
  get_status: "Reading the data",
  search_defect_history: "Searching defect history",
  diagnose_approved_photo: "Checking the photo",
  get_job_card: "Checking the job card",
});
const FALLBACK_LABEL = "Working on this step";

// Error codes whose step can be repeated safely (05 section 6, last column). Anything not listed is not retry-safe.
const RETRY_SAFE_CODES = new Set([
  "VERTEX_UNAVAILABLE", "VERTEX_GENERATION_FAILED", "VERTEX_INVALID_RESPONSE", "VERTEX_INVALID_JSON",
  "VERTEX_EMPTY_RESPONSE", "VERTEX_OUTPUT_TRUNCATED", "REQUEST_TIMEOUT", "BIGQUERY_UNAVAILABLE",
  "SERVICE_UNAVAILABLE", "CLOUD_STORAGE_UNAVAILABLE", "BUDGET_UNAVAILABLE", "BUDGET_RATE_LIMITED",
]);

export const stepLabel = (tool) => STEP_LABELS[tool] ?? FALLBACK_LABEL;

export function isStepResumable(step, instant) {
  return step.status === "PENDING" ||
    (step.status === "RUNNING" && (step.leaseExpiresAt === null || Date.parse(step.leaseExpiresAt) <= instant));
}

export function isRunResumable(run, instant) {
  return run.status === "RUNNING" && run.steps.some((step) => isStepResumable(step, instant));
}

function stepView(step) {
  const failed = step.status === "FAILED" || step.status === "BLOCKED";
  return {
    stepId: step.stepId,
    tool: step.tool,
    label: stepLabel(step.tool),
    status: step.status,
    attempt: step.attempt,
    waitingFor: step.waitingFor,
    errorCode: step.errorCode,
    retrySafe: failed ? RETRY_SAFE_CODES.has(step.errorCode) : null,
    resultRef: step.resultRef,
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
  };
}

/** `lastSequence` is the last stored event (0 if none); the trace head owns it, so the caller passes it in. */
export function runView(run, { lastSequence = 0, instant }) {
  return {
    taskRunId: run.taskRunId,
    kind: run.kind,
    lotId: run.lotId,
    status: run.status,
    steps: run.steps.map(stepView),
    lastSequence,
    resumable: isRunResumable(run, instant),
    updatedAt: run.updatedAt,
  };
}

function inputView(input) {
  return input.kind === "text" ? { kind: "text", text: input.text } : { kind: "action", actionId: input.actionId };
}

// Blocks are rebuilt from resultRefs by ARC-M2-05; until then an answer carries its text and label only.
function answerView(turn, { withBlocks }) {
  if (turn.recordStatus !== "complete") return null;
  const writerOutcome = turn.summary?.writerOutcome ?? "not_called";
  const generatedByGemini = writerOutcome === "shown";
  return withBlocks
    ? { text: turn.answerText, generatedByGemini, writerOutcome, blocks: [] }
    : { text: turn.answerText, generatedByGemini };
}

export function turnView(turn, { withBlocks = true } = {}) {
  return {
    clientTurnId: turn.clientTurnId,
    taskRunId: turn.taskRunId,
    status: turn.recordStatus,
    createdAt: turn.createdAt,
    input: inputView(turn.input),
    answer: answerView(turn, { withBlocks }),
    errorCode: turn.errorCode,
  };
}
