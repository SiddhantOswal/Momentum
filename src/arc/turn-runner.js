import { createHash } from "node:crypto";
import { z } from "zod";
import arcConfig from "../../config/arc.json" with { type: "json" };
import { arcModelSettings } from "../arc-model-settings.js";
import { geminiUsageFailure, withDailyGeminiCallCap } from "../daily-gemini-call-cap.js";
import { runAsGeminiCaller } from "../gemini-caller-context.js";
import { unavailable } from "../google-cloud/firestore-arc-client.js";
import { TURN_LEASE_MS } from "../google-cloud/firestore-arc-session-store.js";
import { demoOwnsJob, demoOwnsLot } from "../hackathon-demo-auth.js";
import { IpKeySchema, ResultRefSchema, ToolNameSchema } from "../state-schemas.js";
import { answerBlocks } from "./answer-blocks.js";
import { checkGrounding, checkWriterText } from "./answer-checks.js";
import { UNCHECKED_TEXT, factsFor, metricRef, renderTemplate as renderAnswerTemplate } from "./answer-render.js";
import { canonicalJson } from "./canonical-json.js";
import { retrySafe, stepLabel } from "./run-view.js";
import { createToolRegistry } from "./tools/index.js";
import { noArgs } from "./tools/policy.js";
import { turnStream } from "./turn-stream.js";

export { arcConfig };

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const uuidPart = (id) => id.replaceAll("-", "");
const answerRef = (id) => ({ kind: "turn", id });
const iso = (time) => new Date(time).toISOString();
const turnError = (code) => Object.assign(new Error(code), { code });
const safeCode = (value) => typeof value === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(value) ? value : "SERVICE_UNAVAILABLE";
const callSchema = z.strictObject({ name: ToolNameSchema, args: z.record(z.string(), z.unknown()) });
const replySchema = z.object({
  code: z.enum(["reply_out_of_scope", "ask_clarification", "explain_cannot_approve"]),
  args: z.record(z.string(), z.unknown()).optional(),
}).strict();
const answerTextSchema = z.string().trim().min(1).max(1200);
const writerSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("shown"), text: answerTextSchema }),
  z.object({ outcome: z.literal("fallback"), reason: z.string() }),
]);
const dataTools = new Set(["query_metric", "get_status", "get_lot", "get_weather", "search_defect_history"]);
const discoveryTools = new Set(["list_samples", "list_approved_photos"]);
const runKinds = new Map([
  ["list_samples", "lot_preparation"], ["read_order", "lot_preparation"], ["set_conditions", "lot_preparation"],
  ["plan_lot", "lot_preparation"], ["list_next_actions", "lot_preparation"],
  ["list_approved_photos", "photo_check"], ["diagnose_approved_photo", "photo_check"],
  ["search_defect_history", "history_search"],
]);
const blockedErrors = new Set(["CONFIRMATION_REQUIRED", "LOT_NOT_FOUND", "IN_PROGRESS", "GEMINI_CALL_REPLAYED",
  "REVISION_SUPERSEDED", "REVISION_FINGERPRINT_MISMATCH", "APPROVAL_IN_PROGRESS"]);

function taskRunIdFor(sessionId, clientTurnId) {
  const digest = sha256(`arc-run-v1:${sessionId}:${clientTurnId}`);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-8${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function initialStep({ name }, index) {
  return {
    stepId: `step_${index + 1}`, tool: name, status: "PENDING", attempt: 0,
    argsHash: null, idempotencyKey: null, leaseOwner: null, leaseExpiresAt: null,
    resultRef: null, waitingFor: null, errorCode: null, startedAt: null, finishedAt: null,
  };
}

function dataReturned(tool, result) {
  if (!result?.ok || result.insufficientData || result.status === "insufficient_data") return false;
  switch (tool) {
    case "get_status": return result.modelAcceptance?.models?.some(({ r2 }) => Number.isFinite(r2));
    case "get_lot": return Boolean(result.lot);
    case "get_weather": return Number.isFinite(result.ambientRhPct) && Number.isFinite(result.ambientTempC);
    case "search_defect_history": return result.caseCount > 0;
    case "query_metric": return true;
    default: return false;
  }
}

function resultReference(tool, args, result, principal) {
  let ref;
  if (tool === "diagnose_approved_photo" && args.photoId === result.photoId) ref = { kind: "photo", id: args.photoId };
  if (tool === "get_job_card") ref = { kind: "card", id: args.jobId };
  if (tool === "read_order" && z.uuid().safeParse(result.reviewId).success) ref = { kind: "po_review", id: result.reviewId };
  const jobId = args.jobId ?? result.jobId ?? result.jobSheet?.jobId;
  if (["get_job", "plan_lot"].includes(tool) && demoOwnsJob(principal, jobId)) ref = { kind: "job", id: jobId };
  const lotId = result.lot?.lotId;
  if (["get_lot", "set_conditions"].includes(tool) && demoOwnsLot(principal, lotId)) ref = { kind: "lot", id: lotId };
  const parsed = ResultRefSchema.safeParse(ref ?? metricRef(tool, args, result));
  return parsed.success ? parsed.data : null;
}

function eventView(run, event) {
  const { sequence, type, clientTurnId, stepId, tool, errorCode, waitingFor, resultRef, retryAfterSeconds } = event;
  const base = { sequence, type, clientTurnId };
  if (type === "run.started") return { ...base, taskRunId: run.taskRunId, kind: run.kind };
  if (type === "run.failed") return { ...base, errorCode };
  if (type === "answer") return { ...base, resultRef };
  if (!tool) return base;
  const step = { ...base, stepId, tool, label: stepLabel(tool) };
  if (type === "step.succeeded") return { ...step, resultRef };
  if (type === "step.waiting_for_user") return { ...step, waitingFor };
  if (type === "step.failed" || type === "step.blocked") return {
    ...step, errorCode, retrySafe: retrySafe(errorCode),
    ...(errorCode === "BUDGET_RATE_LIMITED" && Number.isSafeInteger(retryAfterSeconds) ? { retryAfterSeconds } : {}),
  };
  return step;
}

/**
 * The model ports each dispatch one request and report provider usage via onUsage.
 * readModelEffect resolves the checked result by its reservation key. readToolEffect
 * resolves a command result by its session and effect key, never by model-supplied ID.
 * renderReply and renderTemplate supply code-written copy. Writer text is checked
 * here against the same turn's facts before it is stored, so a writer port cannot
 * put an unchecked number or ID in front of the user.
 */
export function createArcTurnRunner({
  sessionStore, taskRunStore, eventStore, lotStore, deps, config = arcConfig, now = Date.now,
  preRoute, router, writer, renderReply, renderTemplate = renderAnswerTemplate,
  attemptStore, geminiCap, readModelEffect, readToolEffect, log = () => {},
}) {
  const actionIds = Object.keys(config.actions);
  const generate = ({ role, request, reservationKey, signal, onUsage }) =>
    (role === "router" ? router : writer)({ ...request, reservationKey, signal, onUsage });
  const gemini = attemptStore && withDailyGeminiCallCap({
    generateContent: generate, generateJson: generate,
  }, geminiCap, { store: attemptStore });
  const routerSchema = z.object({
    calls: z.array(callSchema).max(config.maxFunctionCalls),
    reply: replySchema.optional(),
  });

  function validateAction({ params }) {
    return noArgs.safeParse(params ?? {});
  }

  function runTurn({ principal, ipKey, session, turn, input, signal, startedAt = performance.now() }) {
    const requestTimeoutMs = Math.max(0, config.requestTimeoutMs - (performance.now() - startedAt));
    return turnStream((send, activeSignal) => execute({
      principal, ipKey, session, turn, input, signal: activeSignal, send,
    }), { requestTimeoutMs, keepAliveMs: config.keepAliveMs, signal });
  }

  async function execute({ principal, ipKey, session, turn, input, signal, send }) {
    const { sessionId, clientTurnId, ownerToken } = turn;
    const owned = { sessionId, clientTurnId, ownerToken, signal };
    const taskRunId = taskRunIdFor(sessionId, clientTurnId);
    const base = { clientTurnId };
    const modelOwner = turn.reservationOwnerToken ?? ownerToken;
    const turnKey = `arcturn1.${uuidPart(clientTurnId)}.${uuidPart(modelOwner).slice(0, 12)}`;
    let attempts = 0;
    let run;
    let sequence = 0;

    async function model(role, request) {
      signal.throwIfAborted();
      if (!gemini || !IpKeySchema.safeParse(ipKey).success) throw turnError("BUDGET_UNAVAILABLE");
      if (attempts >= config.maxModelCalls) throw turnError("VALIDATION_ERROR");
      const reservationKey = `${turnKey}.${role === "router" ? 0 : 1}`;
      try {
        return await runAsGeminiCaller({
          principal, ipKey, nextReservationKey: () => reservationKey, onReservation: () => { attempts += 1; },
        }, () =>
          gemini.generateContent({ role, request, reservationKey, signal }));
      } catch (error) {
        if (error?.code !== "GEMINI_CALL_REPLAYED") throw error;
        const effect = await readModelEffect?.({ sessionId, role, reservationKey, signal });
        if (effect == null) throw error;
        return effect;
      }
    }

    const countAttempts = () => run.steps.reduce((total, step) => total + (step.geminiAttempts ?? 0), attempts);

    async function stageEvent(type, fields = {}, deferHead = false) {
      signal.throwIfAborted();
      const event = { ...base, sequence: ++sequence, type, ...fields };
      try {
        await eventStore.append(run, event, { signal, geminiAttempts: countAttempts(), deferHead });
      } catch (error) {
        if (signal.aborted) throw error;
        throw turnError("TRACE_INCOMPLETE");
      }
      return eventView(run, event);
    }

    async function emit(type, fields) { send(await stageEvent(type, fields)); }

    async function publishLast(frame) {
      if (!run) return;
      try {
        await eventStore.publish(run, frame, { signal, geminiAttempts: countAttempts() });
      } catch (error) {
        if (signal.aborted) throw error;
        throw turnError("TRACE_INCOMPLETE");
      }
    }

    async function complete(answerText, summary, outcome) {
      signal.throwIfAborted();
      const answer = { ...base, sequence: 0, type: "answer", resultRef: answerRef(clientTurnId) };
      // Stage terminal frames first so a committed turn can always replay.
      // Publish them only after the turn is readable.
      const frames = run ? [await stageEvent("answer", { resultRef: answer.resultRef }, true),
        await stageEvent("run.completed", {}, true)] : [answer];
      const saved = await sessionStore.completeTurn({
        ...owned, answerText, taskRunId: run?.taskRunId ?? null,
        eventRange: run ? { first: 1, last: sequence } : null, summary: {
          intent: summary.intent ?? null, tools: summary.tools ?? [], resultRefs: summary.resultRefs ?? [],
          attempts, writerOutcome: outcome?.outcome ?? "not_called",
          fallbackReason: outcome?.outcome === "fallback" ? safeCode(outcome.reason) : null,
          versions: { config: config.version, ...summary.versions },
        },
      });
      if (!saved.ok) throw unavailable("The Arc turn lease changed.");
      await publishLast(frames.at(-1));
      for (const frame of frames) send(frame);
    }

    async function fail(errorCode, step, retryAfterSeconds) {
      signal.throwIfAborted();
      const frame = run
        ? await stageEvent(step ? (step.status === "BLOCKED" ? "step.blocked" : "step.failed") : "run.failed", {
          errorCode, ...(step && { stepId: step.stepId, tool: step.tool, retryAfterSeconds }),
        }, true)
        : { ...base, sequence: 0, type: "run.failed", errorCode };
      const saved = await sessionStore.failTurn({
        ...owned, errorCode, taskRunId: run?.taskRunId ?? null, eventRange: run ? { first: 1, last: sequence } : null,
      });
      if (!saved.ok) throw unavailable("The Arc turn lease changed.");
      await publishLast(frame);
      send(frame);
    }

    const normalizedText = input.kind === "text" ? input.text.normalize("NFKC") : undefined;
    const actionId = input.kind === "action" ? input.actionId
      : Object.hasOwn(config.suggestions, normalizedText) ? config.suggestions[normalizedText] : null;
    const fixed = actionId !== null ? config.actions[actionId] : null;
    if (!fixed) {
      const stopped = await preRoute?.({ text: normalizedText, signal });
      if (stopped) return complete(answerTextSchema.parse(stopped.text), { intent: stopped.intent });
      if (typeof router !== "function") return fail("SERVICE_UNAVAILABLE");
    }

    const activeLotId = session.activeLotIds.at(-1);
    const loadedLot = activeLotId && lotStore ? await lotStore.getLot({
      lotId: activeLotId, ownerSessionId: sessionId, signal,
    }) : null;
    const lot = loadedLot?.head;
    const context = { lot, signal, source: fixed ? "code" : "model" };
    const registry = createToolRegistry({ principal, ipKey, session, deps });
    let calls = fixed?.calls;
    let reply;
    if (!fixed) {
      const history = (await Promise.all(session.recentTurnIds.filter((id) => id !== clientTurnId)
        .slice(-config.maxHistoryTurns).map((id) => sessionStore.getTurn(sessionId, id, { signal }))))
        .filter((entry) => entry?.summary).map(({ summary }) => summary);
      const allowedFunctionNames = registry.allowedFunctionNames(context);
      let routed;
      try {
        routed = await model("router", {
          text: normalizedText, history, allowedFunctionNames,
          declarations: registry.declarations().map(({ functionDeclarations }) => ({
            functionDeclarations: functionDeclarations.filter(({ name }) => allowedFunctionNames.includes(name)),
          })),
        });
      } catch (error) {
        const usage = geminiUsageFailure(error);
        if (usage && usage.error.code !== "GEMINI_CALL_REPLAYED") return complete(usage.error.message, {});
        return fail(safeCode(error?.budgetCode ?? error?.code));
      }
      const parsed = routerSchema.safeParse(routed);
      if (!parsed.success) return fail("VALIDATION_ERROR");
      ({ calls, reply } = parsed.data);
      if (calls.length + Number(Boolean(reply)) > config.maxFunctionCalls ||
          calls.some(({ name, args }) => !allowedFunctionNames.includes(name) ||
          !registry.tools[name].schema().safeParse(args).success)) return fail("VALIDATION_ERROR");
    }

    if ((!calls.length && !reply) || calls.length > config.maxToolSteps ||
        calls.some(({ name }) => !Object.hasOwn(registry.tools, name)) ||
        calls.filter(({ name }) => registry.tools[name].spendsGemini).length > config.maxMeteredToolSteps) {
      return fail("VALIDATION_ERROR");
    }
    const replyText = reply && await renderReply?.(reply);
    if (reply && !answerTextSchema.safeParse(replyText).success) return fail("VALIDATION_ERROR");
    if (!calls.length) return complete(replyText, { intent: reply.code });

    const kind = fixed?.kind ?? calls.map(({ name }) => runKinds.get(name)).find(Boolean) ?? "data_question";
    run = await taskRunStore.get(taskRunId, { signal });
    if (!run) {
      run = await taskRunStore.create({
        taskRunId, sessionId, kind, lotId: lot?.lotId ?? null, status: "RUNNING", steps: calls.map(initialStep),
      }, { signal });
      if (!run) throw unavailable("The Arc task run already exists.");
    }
    if (run.sessionId !== sessionId || run.kind !== kind || run.lotId !== (lot?.lotId ?? null) ||
        run.steps.length !== calls.length || run.steps.some(({ tool }, index) => tool !== calls[index].name)) {
      throw unavailable("The stored Arc plan does not match the turn.");
    }
    if (session.activeTaskRunId !== taskRunId) await sessionStore.setActiveTaskRun({ sessionId, taskRunId, signal });
    await emit("run.started");

    async function saveStep(index, step, status = "RUNNING") {
      const steps = run.steps.with(index, step);
      const saved = await taskRunStore.save({ ...run, steps, status }, { signal });
      if (!saved.ok) throw unavailable("The Arc step changed.");
      run = saved.run;
    }

    async function executeStep(name, args, step, maxGeminiAttempts, onReservation) {
      let result;
      try {
        result = await registry.execute(name, args, { ...context, step: { ...step, taskRunId }, maxGeminiAttempts, onReservation });
      } catch (error) {
        if (signal.aborted) throw error;
        result = { ok: false, error: { code: error?.code, budgetCode: error?.budgetCode, retryAfterSeconds: error?.retryAfterSeconds } };
      }
      if (result?.error?.code === "GEMINI_CALL_REPLAYED" && step.idempotencyKey) {
        result = await readToolEffect?.({ sessionId, tool: name, key: step.idempotencyKey, signal }) ?? result;
      }
      signal.throwIfAborted();
      return boundResult(result);
    }

    function boundResult(result) {
      return Buffer.byteLength(JSON.stringify(result ?? null)) <= config.maxToolResultBytes
        ? result : { ok: false, error: { code: "TOOL_RESULT_TOO_LARGE" } };
    }

    const discoveredKind = { list_samples: "sampleIds", list_approved_photos: "photoIds" };
    async function rememberDiscovered(name) {
      const kind = discoveredKind[name];
      if (!kind) return;
      const ids = registry.discovered()[kind];
      if (canonicalJson(ids) === canonicalJson(session.discovered?.[kind] ?? [])) return;
      await sessionStore.recordDiscovered({ sessionId, kind, ids, signal });
    }

    // Facts are the projected results the template, the writer and the checks share.
    const data = [];
    let writable = false;
    let unlabelled = false;
    function collect(name, args, result, ref) {
      const facts = factsFor({ tool: name, args, result });
      if (facts) data.push(facts);
      if (facts && dataReturned(name, result)) writable = true;
      if (facts && !answerBlocks.rebuildable(ref)) unlabelled = true;
    }
    const wantsWriter = !fixed && !reply && calls.some(({ name }) => dataTools.has(name)) &&
      !calls.some(({ name }) => name === "get_job" || name === "get_job_card");
    for (const [index, { name, args }] of calls.entries()) {
      signal.throwIfAborted();
      const tool = registry.tools[name];
      let step = run.steps[index];
      const argsParsed = tool.schema().safeParse(args);
      const fields = { stepId: step.stepId, tool: name };
      const argsHash = argsParsed.success ? sha256(canonicalJson(argsParsed.data)) : null;
      if (step.argsHash !== null && step.argsHash !== argsHash) throw unavailable("The Arc step arguments changed.");

      if (step.status === "SUCCEEDED") {
        await emit("step.started", fields);
        await emit("step.succeeded", { ...fields, resultRef: step.resultRef });
        if (discoveryTools.has(name) || dataTools.has(name)) {
          const result = boundResult(await registry.execute(name, argsParsed.data, context));
          if (result?.ok) await rememberDiscovered(name);
          collect(name, argsParsed.data, result, step.resultRef);
        }
        continue;
      }
      if (step.status === "BLOCKED" || step.status === "FAILED") {
        if (step.startedAt !== null) await emit("step.started", fields);
        return fail(step.errorCode, step);
      }
      if (step.status === "RUNNING" && Date.parse(step.leaseExpiresAt) > now()) {
        throw unavailable("Another request is running this Arc step.");
      }
      const blocked = !argsParsed.success ? { error: { code: "VALIDATION_ERROR" } }
        : tool.spendsGemini && !gemini ? { error: { code: "BUDGET_UNAVAILABLE" } }
        : tool.precondition(context);
      if (blocked) {
        if (step.startedAt !== null) await emit("step.started", fields);
        const errorCode = safeCode(blocked.error.code);
        step = { ...step, status: "BLOCKED", errorCode, finishedAt: iso(now()) };
        await saveStep(index, step, "BLOCKED");
        return fail(errorCode, step);
      }

      step = {
        ...step, argsHash, status: "RUNNING", idempotencyKey: tool.key({ ...step, taskRunId }, argsParsed.data),
        reservationOwner: step.reservationOwner ?? step.leaseOwner ?? ownerToken,
        leaseOwner: ownerToken, leaseExpiresAt: iso(now() + TURN_LEASE_MS), startedAt: step.startedAt ?? iso(now()),
      };
      await saveStep(index, step);
      await emit("step.started", fields);
      let geminiAttempts = 0;
      const maxGeminiAttempts = config.maxGeminiAttempts - attempts - (wantsWriter ? 1 : 0);
      const result = await executeStep(name, argsParsed.data, step, maxGeminiAttempts, () => { geminiAttempts += 1; });
      step = { ...step, geminiAttempts };
      if (!result?.ok) {
        const errorCode = safeCode(result?.error?.budgetCode ?? result?.error?.code);
        const status = errorCode.startsWith("BUDGET_") || blockedErrors.has(errorCode) ? "BLOCKED" : "FAILED";
        step = { ...step, status, errorCode, finishedAt: iso(now()) };
        await saveStep(index, step, status);
        return fail(errorCode, step, result?.error?.retryAfterSeconds);
      }
      step = { ...step, status: "SUCCEEDED", resultRef: resultReference(name, argsParsed.data, result, principal), finishedAt: iso(now()) };
      await saveStep(index, step);
      await rememberDiscovered(name);
      await emit("step.succeeded", { ...fields, resultRef: step.resultRef });
      collect(name, argsParsed.data, result, step.resultRef);
    }

    const summary = {
      intent: actionId ?? reply?.code ?? kind,
      tools: run.steps.map(({ tool }) => tool),
      resultRefs: run.steps.flatMap(({ resultRef }) => resultRef ? [resultRef] : []),
    };
    let template = answerTextSchema.parse(await renderTemplate({ ...summary, data, replyText }));
    // The template meets the same grounding rule as the writer; the reply line is fixed copy from config.
    const unchecked = Boolean(checkGrounding(template, replyText ? [...data, { fixedCopy: replyText }] : data));
    if (unchecked) {
      log({ event: "arc_answer_fallback", reason: "TEMPLATE_UNCHECKED" });
      template = UNCHECKED_TEXT;
      summary.resultRefs = [];
    }
    let outcome;
    const insufficient = data.some(({ status }) => status === "insufficient_data");
    // A value whose card cannot be rebuilt later (weather, BigQuery reads) would sit under the written
    // text with no label, so the template, which states its labels in words, is shown instead.
    if (wantsWriter && writable && !insufficient && !unchecked && unlabelled) {
      outcome = { outcome: "fallback", reason: "LABEL_NOT_REBUILDABLE" };
      log({ event: "arc_answer_fallback", reason: outcome.reason });
    } else if (wantsWriter && writable && !insufficient && !unchecked && typeof writer === "function") {
      const { settingsVersion, promptVersion } = arcModelSettings.generation("writer");
      summary.versions = { models: settingsVersion, ...(promptVersion && { writer: promptVersion }) };
      try {
        const parsed = writerSchema.safeParse(await model("writer", { question: normalizedText, data }));
        if (!parsed.success) outcome = { outcome: "fallback", reason: "INVALID_WRITER_RESULT" };
        else if (parsed.data.outcome === "fallback") outcome = parsed.data;
        else {
          const reason = checkWriterText(parsed.data.text, data);
          outcome = reason ? { outcome: "fallback", reason } : parsed.data;
        }
      } catch (error) {
        outcome = { outcome: "fallback", reason: safeCode(error?.budgetCode ?? error?.code) };
      }
      if (outcome.outcome === "fallback") log({ event: "arc_answer_fallback", reason: safeCode(outcome.reason) });
    }
    const saved = await taskRunStore.save({ ...run, status: "COMPLETED" }, { signal });
    if (!saved.ok) throw unavailable("The Arc run changed.");
    run = saved.run;
    await complete(outcome?.text ?? template, summary, outcome);
  }

  async function readEvents({ sessionId, turn, signal }) {
    const range = turn.eventRange;
    if (!range || range.first !== 1 || range.last > config.maxToolSteps * 2 + 3) throw unavailable("The Arc event range is invalid.");
    const run = await taskRunStore.get(turn.taskRunId, { signal });
    if (!run || run.sessionId !== sessionId) throw unavailable("The Arc task run was not found.");
    const events = await eventStore.read(run, { ...range, signal });
    if (events.some(({ clientTurnId }) => clientTurnId !== turn.clientTurnId)) throw unavailable("The Arc events belong to a different turn.");
    return events.map((event) => eventView(run, event));
  }

  return Object.freeze({ actionIds, validateAction, runTurn, readEvents, readLastSequence: eventStore.lastSequence });
}
