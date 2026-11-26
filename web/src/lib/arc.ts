// Client for the /api/arc routes. Types mirror src/arc/routes.js and src/arc/run-view.js;
// docs/arc/delivery/06-arc-wire-contract.md describes them, and where the two differ the code wins.
import { ensureSession, getJson, renewSession } from "./api";

export type WaitingFor = "confirm_order" | "confirm_conditions" | "choose_line" | "approve";
export type StepStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "BLOCKED" | "WAITING_FOR_USER" | "SKIPPED";
export type RunStatus = "RUNNING" | "WAITING_FOR_USER" | "BLOCKED" | "FAILED" | "COMPLETED" | "CANCELLED";
export type RunKind = "lot_preparation" | "photo_check" | "history_search" | "data_question";
export type ResultRef = { kind: "po_review" | "job" | "lot" | "trace" | "card" | "turn" | "metric" | "photo"; id: string };
export type LotStage = "order_review" | "conditions" | "planning" | "draft_review" | "approval_pending" | "approved" | "held";

export type StepView = {
  stepId: string; tool: string; label: string; status: StepStatus; attempt: number;
  waitingFor: WaitingFor | null; errorCode: string | null; retrySafe: boolean | null;
  resultRef: ResultRef | null; startedAt: string | null; finishedAt: string | null;
};
export type RunView = {
  taskRunId: string; kind: RunKind; lotId: string | null; status: RunStatus; steps: StepView[];
  lastSequence: number; resumable: boolean; updatedAt: string;
};

export type ArcSession = {
  authorizationMode: "HACKATHON_DEMO";
  identityLabel: string;
  expiresAt: string;
  activeLots: { lotId: string; stage: LotStage; currentJobId: string | null; currentRevision: number }[];
  jobIds: string[];
  activeTaskRunId: string | null;
  resumable: boolean;
  turnCount: number;
};

export type Suggestion = { actionId: string; label: string };

/** Answer blocks as src/arc/answer-blocks.js builds them. Labels are chip text set by code, never by the model. */
export type AnswerBlock = { blockId: string } & (
  | { kind: "value"; title: string; value: string | number | null; unit: string | null; labels: string[]; note: string | null }
  | { kind: "chart"; title: string; series: { name: string; value: number; unit: string | null; labels: string[] }[]; labels: string[]; note: string | null }
  | { kind: "no_data"; missing: string; alternatives: Suggestion[] }
  | { kind: "refusal"; suggestions: Suggestion[] }
  | { kind: "follow_ups"; suggestions: Suggestion[] }
  | { kind: "reference"; ref: ResultRef; labels: string[]; generatedByGemini: boolean }
  | { kind: "unavailable"; ref: ResultRef; errorCode: string }
);
export type AnswerBlockKind = AnswerBlock["kind"];

export type AnswerView = {
  text: string | null;
  /** True only when the server's stored writer outcome is "shown". */
  generatedByGemini: boolean;
  writerOutcome: "not_called" | "shown" | "fallback";
  blocks: AnswerBlock[];
};

export type TurnInput = { kind: "text"; text: string } | { kind: "action"; actionId: string; params?: Record<string, string | number | boolean> };
type StoredInput = { kind: "text"; text: string } | { kind: "action"; actionId: string };

export type TurnView = {
  clientTurnId: string;
  taskRunId: string | null;
  status: "in_progress" | "complete" | "failed";
  createdAt: string;
  input: StoredInput;
  answer: AnswerView | null;
  errorCode: string | null;
};
export type TurnListItem = Omit<TurnView, "answer"> & { answer: { text: string | null; generatedByGemini: boolean } | null };
export type TurnList = { turns: TurnListItem[]; nextBefore: string | null };

type EventBase = { sequence: number; clientTurnId: string };
type StepEventBase = EventBase & { stepId: string; tool: string; label: string };
export type ArcEvent =
  | (EventBase & { type: "run.started"; taskRunId: string; kind: RunKind })
  | (StepEventBase & { type: "step.started" })
  | (StepEventBase & { type: "step.succeeded"; resultRef: ResultRef | null })
  | (StepEventBase & { type: "step.failed"; errorCode: string; retrySafe: boolean })
  | (StepEventBase & { type: "step.blocked"; errorCode: string; retrySafe: boolean; retryAfterSeconds?: number })
  | (StepEventBase & { type: "step.waiting_for_user"; waitingFor: WaitingFor })
  | (EventBase & { type: "answer"; resultRef: { kind: "turn"; id: string } })
  | (EventBase & { type: "run.completed" })
  | (EventBase & { type: "run.failed"; errorCode: string })
  | { type: "stream.error"; code: "TRACE_INCOMPLETE" | "SERVICE_UNAVAILABLE" | "REQUEST_TIMEOUT" };

export type ArcFailure = { ok: false; status: number | null; code: string; message: string; retryAfterSeconds?: number };
export type ArcResult<T> = { ok: true; data: T } | ArcFailure;

const NETWORK_FAILURE: ArcFailure = { ok: false, status: null, code: "NETWORK", message: "Momentum could not be reached." };

async function failureFrom(response: Response): Promise<ArcFailure> {
  const body = await response.json().catch(() => undefined);
  const header = Number(response.headers.get("Retry-After"));
  const retryAfterSeconds = body?.error?.retryAfterSeconds ?? (Number.isFinite(header) && header > 0 ? header : undefined);
  return {
    ok: false, status: response.status, code: body?.error?.code ?? `HTTP_${response.status}`,
    message: body?.error?.message ?? `Request failed (${response.status})`, ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  };
}

// The demo cookie can expire between calls; a 401 opens a new session and repeats the request once (contract section 6).
async function arcFetch(path: string, init: RequestInit = {}): Promise<Response | ArcFailure> {
  await ensureSession();
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...init });
    } catch {
      return NETWORK_FAILURE;
    }
    if (response.status === 401 && attempt === 0) {
      await renewSession();
      continue;
    }
    return response;
  }
}

async function arcGet<T>(path: string, signal?: AbortSignal): Promise<ArcResult<T>> {
  const response = await arcFetch(path, { signal, headers: { Accept: "application/json" } });
  if (!(response instanceof Response)) return response;
  if (!response.ok) return failureFrom(response);
  const body = await response.json().catch(() => undefined);
  return body?.ok === true ? { ok: true, data: body as T } : { ok: false, status: response.status, code: "INVALID_RESPONSE", message: "Unexpected response." };
}

export async function getArcSession(signal?: AbortSignal): Promise<ArcResult<ArcSession>> {
  const result = await arcGet<{ session: ArcSession }>("/api/arc/session", signal);
  return result.ok ? { ok: true, data: result.data.session } : result;
}

export async function getRun(taskRunId: string, signal?: AbortSignal): Promise<ArcResult<RunView>> {
  const result = await arcGet<{ run: RunView }>(`/api/arc/runs/${encodeURIComponent(taskRunId)}`, signal);
  return result.ok ? { ok: true, data: result.data.run } : result;
}

export async function getTurn(clientTurnId: string, signal?: AbortSignal): Promise<ArcResult<TurnView>> {
  const result = await arcGet<{ turn: TurnView }>(`/api/arc/turns/${encodeURIComponent(clientTurnId)}`, signal);
  return result.ok ? { ok: true, data: result.data.turn } : result;
}

/** A stored order review as GET /api/arc/reviews/:reviewId returns it: catalog-matched lines only carry an item code. */
export type OrderReviewLine = {
  lineIndex: number; sourcePage: number | null; itemCode: string | null; quantity: number | null;
  status: "MATCHED" | "AMBIGUOUS" | "UNKNOWN_CODE" | "MISSING_ITEM_CODE" | "MISSING_QTY" | "MALFORMED";
};
export type OrderReview = { reviewId: string; expiresAt: string; readByGemini: boolean; lines: OrderReviewLine[] };

export async function getOrderReview(reviewId: string, signal?: AbortSignal): Promise<ArcResult<OrderReview>> {
  const result = await arcGet<{ review: OrderReview }>(`/api/arc/reviews/${encodeURIComponent(reviewId)}`, signal);
  return result.ok ? { ok: true, data: result.data.review } : result;
}

export async function listTurns({ limit = 10, before }: { limit?: number; before?: string } = {}, signal?: AbortSignal): Promise<ArcResult<TurnList>> {
  const query = new URLSearchParams({ limit: String(limit), ...(before ? { before } : {}) });
  const result = await arcGet<TurnList>(`/api/arc/turns?${query}`, signal);
  return result.ok ? { ok: true, data: { turns: result.data.turns, nextBefore: result.data.nextBefore } } : result;
}

/** Splits a text/event-stream body into events. Comment lines (keep-alive) are skipped. */
export function parseEventFrames(text: string): { events: ArcEvent[]; rest: string } {
  const frames = text.replace(/\r\n/g, "\n").split("\n\n");
  const rest = frames.pop() ?? "";
  const events: ArcEvent[] = [];
  for (const frame of frames) {
    const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (!data) continue;
    try { events.push(JSON.parse(data) as ArcEvent); } catch { /* A malformed frame is skipped; the turn read below is the source of truth. */ }
  }
  return { events, rest };
}

/** Posts one turn and reads its event stream to the end. A 200 always carries a stream; every refusal is JSON. */
export async function postTurn(
  body: { clientTurnId: string; input: TurnInput },
  onEvent: (event: ArcEvent) => void,
  signal?: AbortSignal,
): Promise<ArcResult<{ events: ArcEvent[]; replayed: boolean }>> {
  const response = await arcFetch("/api/arc/turns", {
    method: "POST", signal, body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Accept: "text/event-stream, application/json" },
  });
  if (!(response instanceof Response)) return response;
  if (!response.ok) return failureFrom(response);
  const events: ArcEvent[] = [];
  const take = (list: ArcEvent[]) => { for (const event of list) { events.push(event); onEvent(event); } };
  if (!response.body) {
    take(parseEventFrames(await response.text() + "\n\n").events);
  } else {
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const parsed = parseEventFrames(buffer + value);
        buffer = parsed.rest;
        take(parsed.events);
      }
    } catch {
      // A dropped connection ends the read; the caller decides from the events received so far.
    }
    take(parseEventFrames(buffer + "\n\n").events);
  }
  return { ok: true, data: { events, replayed: response.headers.get("Arc-Turn") === "replayed" } };
}

export const newTurnId = () => crypto.randomUUID();

const TERMINAL = new Set(["run.completed", "run.failed", "answer"]);
const STOPPED = new Set(["step.failed", "step.blocked", "step.waiting_for_user", "run.failed"]);

/**
 * How a stopped turn may be tried again, or null when it may not.
 * - "new_turn": the server marked the step safe to repeat, so Try again sends the input under a
 *   new clientTurnId and the step's attempt rises (contract section 6).
 * - "same_turn": the stream ended before the turn did (stream.error or a dropped connection), so
 *   Try again re-posts the same clientTurnId; the server replays it, or takes it over once its
 *   lease has expired, and never runs it twice (sections 3.3, 3.4 and 4.4).
 * `at` holds Try again back until a rate-limit wait is over (epoch milliseconds).
 */
export type Retry = { mode: "new_turn" | "same_turn"; at?: number } | null;

export type TurnOutcome =
  | { kind: "answer"; turn: TurnView }
  | { kind: "stopped"; code: string; words: string; retry: Retry }
  | { kind: "not_connected" }
  | { kind: "error"; code: string; words: string };

/** One step as the screens need it, from the live events or from the run read. */
export type StepState = {
  stepId: string; tool: string; status: StepStatus; resultRef: ResultRef | null;
  errorCode: string | null; retrySafe: boolean | null; waitingFor: WaitingFor | null;
};

const EVENT_STATUS: Partial<Record<ArcEvent["type"], StepStatus>> = {
  "step.started": "RUNNING", "step.succeeded": "SUCCEEDED", "step.failed": "FAILED",
  "step.blocked": "BLOCKED", "step.waiting_for_user": "WAITING_FOR_USER",
};

export function stepsFromEvents(events: ArcEvent[]): StepState[] {
  const steps = new Map<string, StepState>();
  for (const event of events) {
    const status = EVENT_STATUS[event.type];
    if (!status || !("stepId" in event)) continue;
    const step: StepState = steps.get(event.stepId) ?? {
      stepId: event.stepId, tool: event.tool, status, resultRef: null, errorCode: null, retrySafe: null, waitingFor: null,
    };
    step.status = status;
    if (event.type === "step.succeeded") step.resultRef = event.resultRef;
    if (event.type === "step.failed" || event.type === "step.blocked") { step.errorCode = event.errorCode; step.retrySafe = event.retrySafe; }
    if (event.type === "step.waiting_for_user") step.waitingFor = event.waitingFor;
    steps.set(event.stepId, step);
  }
  return [...steps.values()];
}

// PENDING and SKIPPED steps never started, so no screen is drawn for them (contract section 3.2).
export function stepsFromRun(run: RunView): StepState[] {
  return run.steps.filter((step) => step.status !== "PENDING" && step.status !== "SKIPPED")
    .map(({ stepId, tool, status, resultRef, errorCode, retrySafe, waitingFor }) => ({ stepId, tool, status, resultRef, errorCode, retrySafe, waitingFor }));
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The answer event only points at the turn record (contract section 5.1); the text is read from it.
async function readAnswer(clientTurnId: string): Promise<TurnOutcome> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const turn = await getTurn(clientTurnId);
    if (!turn.ok) return failureOutcome(turn);
    if (turn.data.status === "complete") return { kind: "answer", turn: turn.data };
    if (turn.data.status === "failed") {
      const code = turn.data.errorCode ?? "SERVICE_UNAVAILABLE";
      return { kind: "stopped", code, words: arcWords(code), retry: null };
    }
    await pause(1000 * (attempt + 1));
  }
  return { kind: "error", code: "IN_PROGRESS", words: arcWords("TURN_STILL_RUNNING") };
}

function failureOutcome(failure: ArcFailure): TurnOutcome {
  if (failure.code === "ARC_NOT_ENABLED") return { kind: "not_connected" };
  return { kind: "error", code: failure.code, words: arcWords(failure.code, failure.retryAfterSeconds) };
}

// The budget's own wait when the event carries it; a replayed event does not (contract D8), so a minute, as the words say.
const RATE_LIMIT_WAIT_SECONDS = 60;

function stepRetry(errorCode: string, retrySafe: boolean, retryAfterSeconds?: number): Retry {
  if (!retrySafe) return null;
  if (errorCode !== "BUDGET_RATE_LIMITED") return { mode: "new_turn" };
  return { mode: "new_turn", at: Date.now() + (retryAfterSeconds ?? RATE_LIMIT_WAIT_SECONDS) * 1000 };
}

// A CONFLICT from a step is the plan's idempotency check, not the turn route's reused-turn conflict.
const stepWords = (code: string, retryAfterSeconds?: number) => arcWords(code === "CONFLICT" ? "PLAN_CONFLICT" : code, retryAfterSeconds);

function stoppedOutcome(event: ArcEvent): TurnOutcome {
  switch (event.type) {
    case "step.failed": return { kind: "stopped", code: event.errorCode, words: stepWords(event.errorCode), retry: stepRetry(event.errorCode, event.retrySafe) };
    case "run.failed": return { kind: "stopped", code: event.errorCode, words: arcWords(event.errorCode), retry: null };
    case "step.blocked": return {
      kind: "stopped", code: event.errorCode, words: stepWords(event.errorCode, event.retryAfterSeconds),
      retry: stepRetry(event.errorCode, event.retrySafe, event.retryAfterSeconds),
    };
    case "step.waiting_for_user": return { kind: "stopped", code: event.waitingFor, words: WAITING_WORDS[event.waitingFor], retry: null };
    case "stream.error": return { kind: "stopped", code: event.code, words: arcWords(event.code), retry: { mode: "same_turn" } };
    default: return { kind: "error", code: "UNKNOWN", words: arcWords("UNKNOWN") };
  }
}

/**
 * One turn from send to answer: post, follow the stream, then read the stored answer.
 * A stream that drops before a terminal event is posted again with the same clientTurnId,
 * which the server replays instead of running twice (contract sections 3.4 and 4.4).
 * `onEvent` sees every event, so the caller can draw the step cards as they change.
 */
export async function askArc(input: TurnInput, onEvent: (event: ArcEvent) => void, clientTurnId: string = newTurnId()): Promise<TurnOutcome> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const posted = await postTurn({ clientTurnId, input }, onEvent);
    if (!posted.ok) {
      if (posted.code === "IN_PROGRESS") return readAnswer(clientTurnId);
      return failureOutcome(posted);
    }
    const { events } = posted.data;
    if (events.some((event) => event.type === "answer")) return readAnswer(clientTurnId);
    // stream.error means the server stopped following the turn, not that the turn ended, so it is not re-posted here.
    const last = [...events].reverse().find((event) => STOPPED.has(event.type) || event.type === "stream.error");
    if (last) return stoppedOutcome(last);
    if (events.some((event) => TERMINAL.has(event.type))) return readAnswer(clientTurnId);
  }
  return { kind: "stopped", code: "STREAM_DROPPED", words: arcWords("STREAM_DROPPED"), retry: { mode: "same_turn" } };
}

const WAITING_WORDS: Record<WaitingFor, string> = {
  confirm_order: "Arc is waiting for you to confirm the order.",
  confirm_conditions: "Arc is waiting for you to confirm the conditions.",
  choose_line: "Arc is waiting for you to choose the order line.",
  approve: "The job card is ready for your review. Only you can approve it.",
};

const DAY_LIMIT = "Arc has used today's Gemini limit. Buttons still work. The limit resets at midnight IST (02:30 in Singapore).";
const VERTEX_UNUSABLE = "Gemini's reply could not be used. Try again.";

// Strings from 05-ai-design.md section 6 (G2) and the wire contract section 6. The server's
// own message is for logs; the UI always shows these words.
const WORDS: Record<string, string> = {
  VERTEX_UNAVAILABLE: "Arc could not reach Gemini. Try again.",
  VERTEX_GENERATION_FAILED: "Gemini did not answer this time. Try again.",
  VERTEX_INVALID_RESPONSE: VERTEX_UNUSABLE,
  VERTEX_INVALID_JSON: VERTEX_UNUSABLE,
  VERTEX_EMPTY_RESPONSE: VERTEX_UNUSABLE,
  VERTEX_OUTPUT_TRUNCATED: VERTEX_UNUSABLE,
  GEMINI_SAFETY_BLOCKED: "Gemini blocked this message, so Arc did not act on it. Rephrase it, or use the buttons.",
  // 05 section 6 wrote "within 60 s", but a turn may run 120 s (config/arc.json requestTimeoutMs), so no figure is shown.
  REQUEST_TIMEOUT: "This step did not finish in time. Your confirmed inputs are kept. Try again.",
  BIGQUERY_UNAVAILABLE: "The data could not be read. Try again.",
  SERVICE_UNAVAILABLE: "Arc could not read or save its records. Nothing was changed. Try again.",
  TRACE_INCOMPLETE: "Arc could not read or save its records. Nothing was changed. Try again.",
  CLOUD_STORAGE_UNAVAILABLE: "The file store could not be reached. Nothing was changed. Try again.",
  GEMINI_DAILY_CAP_EXCEEDED: DAY_LIMIT,
  BUDGET_DAY_EXHAUSTED: DAY_LIMIT,
  BUDGET_RESERVED_FOR_PITCH: DAY_LIMIT,
  BUDGET_COST_EXHAUSTED: DAY_LIMIT,
  BUDGET_SESSION_EXHAUSTED: "This session has used its Gemini limit for today. Buttons still work.",
  BUDGET_IP_EXHAUSTED: "This network has used its Gemini limit for today. Buttons still work.",
  BUDGET_UNAVAILABLE: "Arc could not check its Gemini limit, so it did not call Gemini. Buttons still work. Try again.",
  BUDGET_TURN_EXHAUSTED: "This message has used all the Gemini calls one message can make. Buttons still work. Send a new message to continue.",
  GEMINI_CALL_REPLAYED: "This step was interrupted, and Arc stopped so it would not call Gemini twice. Nothing new was saved. Send your message again.",
  REVISION_SUPERSEDED: "This revision was replaced. Open the current revision to approve it.",
  REVISION_FINGERPRINT_MISMATCH: "This revision was replaced. Open the current revision to approve it.",
  REVISION_NOT_REGISTERED: "This draft has no registered revision. Plan the lot again to approve it.",
  REVIEW_CONFIRMATION_REQUIRED: "Tick the box to confirm you reviewed this card, then press Approve.",
  MODEL_ACCEPTANCE_REQUIRED: "Approval is closed until the five models have their acceptance record.",
  SUPERVISOR_AUTHORIZATION_REQUIRED: "This session cannot approve job cards.",
  CONFIRMATION_REQUIRED: "Confirm the order and the conditions first.",
  LOT_NOT_FOUND: "Arc has no lot in this session yet. Read an order and confirm it first.",
  ORDER_REVIEW_EXPIRED: "This order review has expired. Read the order again.",
  ORDER_LINE_NOT_CONFIRMABLE: "This line is not matched to one catalog item with a quantity, so Arc cannot confirm it. Read the order again or use New Lot.",
  ORDER_SAMPLE_REQUIRED: "Arc reads the approved sample orders only. Choose PO1 to PO5.",
  PLAN_DAILY_LIMIT_REACHED: "This session has planned as many lots as it can today. Planning opens again at midnight IST (02:30 in Singapore).",
  PLAN_CONFLICT: "These values clash with an earlier plan for the same step. Press Confirm conditions again.",
  REVISION_CONFLICT: "The lot changed while this draft was being prepared. Plan the lot again.",
  DEMO_SCOPE_REQUIRED: "This lot belongs to another demo session, so Arc cannot use it here.",
  TOOL_RESULT_TOO_LARGE: "That result was too large for Arc to show. Ask for less at once.",
  VALIDATION_ERROR: "Arc could not turn that into a step it can run. Rephrase it, or use the buttons.",
  APPROVAL_IN_PROGRESS: "This step is already running in another tab. Arc will show the result here.",
  IN_PROGRESS: "This step is already running in another tab. Arc will show the result here.",
  TURN_STILL_RUNNING: "Arc is still working on this message. Open past work in a moment to see the answer.",
  DEMO_SESSION_REQUIRED: "Arc could not open a demo session. Reload the page and try again.",
  DEMO_AUTHORIZATION_NOT_CONFIGURED: "Arc needs a demo session, and this deployment cannot start one.",
  NOT_FOUND: "That Arc record was not found or has expired.",
  CONFLICT: "This message was already sent with different words. Send it again.",
  PAYLOAD_TOO_LARGE: "That message is too long. Keep it under 1,000 characters.",
  NETWORK: "Can't reach Momentum. Check the connection and try again.",
  STREAM_DROPPED: "The connection dropped before Arc answered. Try again.",
};

/** Plain words for an Arc error code. `retryAfterSeconds` comes from the server, never from model text. */
export function arcWords(code: string, retryAfterSeconds?: number): string {
  if (code === "BUDGET_RATE_LIMITED") {
    return retryAfterSeconds
      ? `Too many typed messages in one minute. Wait ${retryAfterSeconds} s, or use the buttons.`
      : "Too many typed messages in one minute. Wait a minute, or use the buttons.";
  }
  if (code === "RATE_LIMIT_EXCEEDED") {
    return retryAfterSeconds
      ? `Too many requests from this network. Try again in ${retryAfterSeconds} s.`
      : "Too many requests from this network. Try again in a minute.";
  }
  return WORDS[code] ?? "Arc could not complete the request. Try again.";
}

type GeminiBudget = { available: boolean; remaining?: { day: number | null; session: number | null; ip: number | null } };
type StatusBody = { runtimeAvailability?: { geminiBudget?: GeminiBudget } };

/**
 * Gemini calls this caller can still make today, from /api/status (gap B7). The smallest of
 * the day, session and network counters applies. Null when the server does not report it.
 */
export async function geminiCallsLeftToday(signal?: AbortSignal): Promise<number | null> {
  await ensureSession();
  const status = await getJson<StatusBody>("/api/status", signal);
  const budget = status.ok ? status.data.runtimeAvailability?.geminiBudget : undefined;
  if (!budget?.available || !budget.remaining) return null;
  const counts = [budget.remaining.day, budget.remaining.session, budget.remaining.ip].filter((n): n is number => typeof n === "number");
  return counts.length ? Math.min(...counts) : null;
}

/*
 * Records an answer points at. A reference block names a record and the client reads it with
 * the dashboard route that already serves it (contract section 5.1), so Arc and the dashboard
 * show the same stored job, lot and photo list. Field names mirror src/schemas.js and
 * src/state-schemas.js.
 */

export type Defect = "WARP" | "DELAM" | "STRENGTH" | "PRINT" | "CRACK";
export type LeverKey = "sfSpeedMpm" | "rollTempC" | "gumApplication" | "gumViscositySec" | "pastingPressure" | "dryingHours" | "printSpeedSpm";
export type RiskView = {
  ratesPct: Partial<Record<Defect, number>>; totalScrapPct?: number; totalScrapKg: number;
  scrapCost: number; currency: string; primaryDefect: Defect;
};
export type StoredJob = {
  jobId: string; createdAt: string; status: "DRAFT" | "APPROVED" | "RUN" | "CLOSED";
  order: { orderId: string; itemCode: string; quantity: number; ply?: number; fluteProfile?: string; paperType?: string };
  conditions: { runDate: string; shift: string; ambientRhPct: number; ambientTempC: number; paperMoisturePct: number; conditionSource?: string; supervisorConfirmed?: boolean };
  baseline: { levers: Record<LeverKey, number | string>; risk: RiskView };
  recommended: { levers: Record<LeverKey, number | string>; risk: RiskView };
  changes: { lever: LeverKey; from: number | string; to: number | string; reason: string }[];
  explanation: string;
  savings: { kg: number; amount: number; currency: string };
  approvedAt: string | null;
  cardUri: string | null;
  approvalAudit?: { authorizationMode?: string; decidedAt: string } | null;
};
export type RevisionStatus = "PENDING" | "CURRENT" | "SUPERSEDED" | "APPROVING" | "APPROVED" | "FAILED";
/** Present only while lot revisions are on; without its fingerprint a draft cannot be approved. */
export type RevisionBlock = { lotId: string; number: number; fingerprint: string | null; status: RevisionStatus };
export type JobRecord = { jobSheet: StoredJob; revision?: RevisionBlock };

export type DraftCondition = {
  field: "ambientRhPct" | "ambientTempC" | "paperMoisturePct" | "runDate" | "shift";
  value: number | string; unit: string; provenance: string; sourceDetail: string; label: string;
  observedAt?: string; enteredByRole?: string; confirmed: boolean;
};
export type LotRecord = {
  lot: {
    lotId: string; stage: LotStage; currentRevision: number; currentJobId: string | null;
    /** The confirmed catalog item and quantity, once an order line is confirmed. */
    order?: { itemCode: string; quantity: number } | null;
    draftConditions: DraftCondition[]; updatedAt: string;
  };
  revision: null | {
    jobId: string; number: number; status: RevisionStatus; fingerprint: string | null; supersededBy: string | null;
    supersededReason: { field: string; from: number | string; to: number | string; provenance: string; byRole: string } | null;
  };
};

export type ApprovedPhoto = { id: string; label: string };
export type SettingsSummary = {
  lots: number; avgRatePct: number; sfSpeedMpm: number; rollTempC: number; gumApplication: string;
  gumViscositySec: number; pastingPressure: string; dryingHours: number; printSpeedSpm: number;
};
export type DefectHistory = {
  defect: Defect; caseCount: number; avgRateWhenMain: number; costWhenMain: number;
  goodRuns: SettingsSummary | null; badRuns: SettingsSummary | null;
};

async function arcSend<T>(path: string, body: unknown): Promise<ArcResult<T>> {
  const response = await arcFetch(path, {
    method: "POST", body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Accept: "application/json" },
  });
  if (!(response instanceof Response)) return response;
  if (!response.ok) return failureFrom(response);
  const parsed = await response.json().catch(() => undefined);
  return parsed?.ok === true ? { ok: true, data: parsed as T } : { ok: false, status: response.status, code: "INVALID_RESPONSE", message: "Unexpected response." };
}

export const getJobRecord = (jobId: string, signal?: AbortSignal) =>
  arcGet<JobRecord>(`/jobs/${encodeURIComponent(jobId)}`, signal);

export const getLotRecord = (lotId: string, signal?: AbortSignal) =>
  arcGet<LotRecord>(`/lots/${encodeURIComponent(lotId)}`, signal);

export const jobCardPdfPath = (jobId: string) => `/jobs/${encodeURIComponent(jobId)}/card.pdf`;

/**
 * The approval request. Approval stays a human step (CLAUDE.md section 4): the only caller is
 * the Approve button on the approval card, after the reviewer ticks its box. The server's
 * guard needs both fields and rejects a fingerprint that is not the current revision's.
 */
export function approveJobCard(jobId: string, revisionFingerprint: string) {
  return arcSend<{ jobSheet: StoredJob; cardUri?: string }>(`/jobs/${encodeURIComponent(jobId)}/approve`, {
    reviewConfirmed: true, revisionFingerprint,
  });
}

export async function listApprovedPhotos(signal?: AbortSignal): Promise<ArcResult<ApprovedPhoto[]>> {
  const result = await arcGet<{ photos: ApprovedPhoto[] }>("/evidence/approved-photos", signal);
  return result.ok ? { ok: true, data: result.data.photos } : result;
}

/** The findSeenBefore command the search_defect_history tool runs, read through its dashboard route with no Gemini call. */
export const searchDefectHistory = (request: { defect: Defect; ambientRhPct: number }) =>
  arcSend<DefectHistory>("/evidence/seen-before", request);
