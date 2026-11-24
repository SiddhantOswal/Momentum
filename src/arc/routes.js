/**
 * The `/api/arc` sub-app (wire contract `06-arc-wire-contract.md`, ARC-M2-01).
 *
 * Owned here: the session read, the run read, the turn claim with its 409 and
 * replay cases, and the two turn reads. The turn runner (ARC-M2-03) and the
 * stored-event replay, event stream and resume (ARC-M2-06) plug in through
 * `runTurn` and `readEvents`; nothing for those routes is mounted yet.
 *
 * Order of checks: the global body limit and per-IP limiter run before this
 * app, then the flag (404 before any auth), same-origin on writes (403),
 * the cookie (401) and finally validation and the route's own checks.
 */

import { createHash } from "node:crypto";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import { authorizeSupervisor } from "../commands/authorize.js";
import { validationFailure } from "../commands/validation.js";
import { isDemoPrincipal } from "../hackathon-demo-auth.js";
import { FirestoreRestError } from "../google-cloud/firestore-rest.js";
import { SESSION_COOKIE } from "../user-session-auth.js";
import { canonicalJson } from "./canonical-json.js";
import { isRunResumable, runView, turnView } from "./run-view.js";

const DEMO_COOKIE = "__Host-ustaad-demo";
const PRINCIPAL_KEY = "arcPrincipal";
const MAX_BODY_BYTES = 16 * 1024;
const MAX_PARAMS_BYTES = 2048;
const IN_PROGRESS_RETRY_SECONDS = 5;
const RunIdSchema = z.string().uuid();
const TurnIdSchema = z.string().uuid();
const ActionIdSchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);

const TurnRequestSchema = z.object({
  clientTurnId: TurnIdSchema,
  input: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("action"),
      actionId: ActionIdSchema,
      params: z.record(z.string().max(64), z.union([z.string().max(MAX_PARAMS_BYTES), z.number().finite(), z.boolean()]))
        .superRefine((params, ctx) => {
          if (Object.hasOwn(params, "sessionId")) ctx.addIssue({ code: "unrecognized_keys", keys: ["sessionId"] });
        })
        .refine((params) => Buffer.byteLength(JSON.stringify(params)) <= MAX_PARAMS_BYTES, "params must be at most 2 KiB")
        .optional(),
    }).strict(),
    z.object({ kind: z.literal("text"), text: z.string().trim().min(1).max(1000) }).strict(),
  ]),
}).strict();

const ListQuerySchema = z.object({
  limit: z.string().regex(/^\d{1,2}$/).transform(Number).pipe(z.number().int().min(1).max(20)).optional(),
  before: z.string().min(1).max(256).optional(),
}).strict();
const EmptyQuerySchema = z.object({}).strict();

function errorBody(code, message, extra = {}) {
  return { ok: false, error: { code, message, ...extra } };
}

function issuesFrom(error) {
  return error.issues.flatMap((issue) => {
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => ({
        field: [...issue.path, key].join("."),
        path: [...issue.path, key],
        code: issue.code,
        message: `Unrecognized key: ${key}`,
      }));
    }
    return [{ field: issue.path.join(".") || "root", path: issue.path, code: issue.code, message: issue.message }];
  });
}

function parse(schema, input, message) {
  const parsed = schema.safeParse(input);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, failure: validationFailure(issuesFrom(parsed.error), message) };
}

function requireEmptyQuery(c, next) {
  const query = parse(EmptyQuerySchema, c.req.queries(), "This route takes no query string.");
  return query.ok ? next() : c.json(query.failure, 400);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// Only a hash of an action's params is stored; typed text is the user's own and is kept as entered.
function storedInput(input) {
  if (input.kind === "text") return { stored: { kind: "text", text: input.text }, fingerprint: sha256(canonicalJson({ kind: "text", text: input.text })) };
  const paramsHash = sha256(canonicalJson(input.params ?? {}));
  return {
    stored: { kind: "action", actionId: input.actionId, paramsHash },
    fingerprint: sha256(canonicalJson({ kind: "action", actionId: input.actionId, paramsHash })),
  };
}

function frame(event) {
  const id = event.sequence > 0 ? `id: ${event.sequence}\n` : "";
  return `${id}event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function streamOf(events, headers) {
  return new Response(events.map(frame).join(""), {
    status: 200,
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

// A turn that made no tool step stores no events; its stream is one frame with no id (contract section 3.3).
function unstoredReplay(turn) {
  const base = { sequence: 0, clientTurnId: turn.clientTurnId };
  return [turn.recordStatus === "failed"
    ? { ...base, type: "run.failed", errorCode: turn.errorCode }
    : { ...base, type: "answer", resultRef: { kind: "turn", id: turn.clientTurnId } }];
}

export function createArcRoutes({
  enabled,
  commandDeps,
  sessionStore,
  taskRunStore,
  lotStore,
  actionIds = [],
  runTurn,
  readEvents,
  now = Date.now,
} = {}) {
  const app = new Hono();
  const knownActions = new Set(actionIds);
  const storesConfigured = Boolean(sessionStore && taskRunStore);
  const json = (c, status, body) => c.json(body, status);
  const fail = (c, status, code, message, extra) => json(c, status, errorBody(code, message, extra));
  const storesUnavailable = (c) => fail(c, 503, "SERVICE_UNAVAILABLE", "Arc could not read or save its records. Nothing was changed.");

  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    if (enabled !== true) return fail(c, 404, "ARC_NOT_ENABLED", "Arc is not enabled on this deployment.");
    return next();
  });

  app.use("*", async (c, next) => {
    if (c.req.method !== "GET" && !commandDeps.isSameOrigin({ origin: c.req.header("Origin"), requestUrl: c.req.url })) {
      return fail(c, 403, "ORIGIN_REQUIRED", "A same-origin request is required.");
    }
    const result = await authorizeSupervisor({
      method: c.req.method,
      path: c.req.path,
      sessionCookie: getCookie(c, SESSION_COOKIE),
      demoCookie: getCookie(c, DEMO_COOKIE),
      authorization: c.req.header("Authorization"),
      origin: c.req.header("Origin"),
      requestUrl: c.req.url,
    }, commandDeps);
    if (!result.ok) return json(c, result.status, { ok: false, error: result.error });
    if (!isDemoPrincipal(result.principal)) {
      return fail(c, 503, "DEMO_AUTHORIZATION_NOT_CONFIGURED", "Arc needs the hackathon demo session.");
    }
    c.set(PRINCIPAL_KEY, result.principal);
    return next();
  });

  app.onError((error, c) => {
    if (error instanceof FirestoreRestError) return storesUnavailable(c);
    console.error(JSON.stringify({ event: "arc_route_error", name: error?.name, code: error?.code }));
    return fail(c, 500, "INTERNAL_ERROR", "Arc could not complete the request.");
  });

  const principalOf = (c) => c.get(PRINCIPAL_KEY);
  const singleValues = (query) => Object.fromEntries(Object.entries(query).map(([key, values]) => [key, values.length === 1 ? values[0] : values]));

  async function ownedRun(c) {
    const id = RunIdSchema.safeParse(c.req.param("taskRunId"));
    if (!id.success) {
      return { response: json(c, 400, validationFailure([{ field: "taskRunId", path: ["taskRunId"], code: "invalid_format", message: "The run ID must be a UUID." }])) };
    }
    if (!storesConfigured) return { response: storesUnavailable(c) };
    const run = await taskRunStore.get(id.data);
    // Another session's run answers like a missing one, so IDs cannot be probed.
    if (run === null || run.sessionId !== principalOf(c).sessionId) {
      return { response: fail(c, 404, "NOT_FOUND", "The run was not found or has expired.") };
    }
    return { run };
  }

  app.get("/session", requireEmptyQuery, async (c) => {
    if (!storesConfigured) return storesUnavailable(c);
    const principal = principalOf(c);
    const session = await sessionStore.getOrCreate({
      sessionId: principal.sessionId,
      sessionExpiresAt: new Date(principal.expiresAt * 1000).toISOString(),
    });
    const activeLots = [];
    for (const lotId of lotStore ? session.activeLotIds : []) {
      const lot = await lotStore.getLot({ lotId, ownerSessionId: session.sessionId });
      if (lot) activeLots.push({ lotId, stage: lot.head.stage, currentJobId: lot.head.currentJobId, currentRevision: lot.head.currentRevision });
    }
    let resumable = false;
    if (session.activeTaskRunId) {
      const run = await taskRunStore.get(session.activeTaskRunId);
      resumable = run !== null && run.sessionId === session.sessionId && isRunResumable(run, now());
    }
    return c.json({
      ok: true,
      session: {
        authorizationMode: session.authorizationMode,
        identityLabel: session.identityLabel,
        expiresAt: session.sessionExpiresAt,
        activeLots,
        jobIds: session.jobIds,
        activeTaskRunId: session.activeTaskRunId,
        resumable,
        turnCount: session.turnCount,
      },
    });
  });

  app.get("/runs/:taskRunId", requireEmptyQuery, async (c) => {
    const owned = await ownedRun(c);
    if (owned.response) return owned.response;
    return c.json({ ok: true, run: runView(owned.run, { instant: now() }) });
  });

  app.post("/turns", requireEmptyQuery, bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => fail(c, 413, "PAYLOAD_TOO_LARGE", "The request body is too large."),
  }), async (c) => {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return json(c, 400, validationFailure([{ field: "body", path: [], code: "invalid_json", message: "Request body must be valid JSON." }]));
    }
    const request = parse(TurnRequestSchema, body, "The turn request is not valid.");
    if (!request.ok) return json(c, 400, request.failure);
    const { clientTurnId, input } = request.data;
    if (input.kind === "action" && !knownActions.has(input.actionId)) {
      return json(c, 400, validationFailure([{ field: "input.actionId", path: ["input", "actionId"], code: "unknown_action", message: "This action is not available." }]));
    }
    if (!storesConfigured) return storesUnavailable(c);
    const principal = principalOf(c);
    const { stored, fingerprint } = storedInput(input);
    await sessionStore.getOrCreate({ sessionId: principal.sessionId, sessionExpiresAt: new Date(principal.expiresAt * 1000).toISOString() });
    // Without a runner a new turn cannot be served, so none is recorded; a stored turn can still be replayed or refused.
    const claim = await sessionStore.claimTurn({
      sessionId: principal.sessionId, clientTurnId, input: stored, inputFingerprint: fingerprint,
      createIfAbsent: typeof runTurn === "function",
    });

    if (claim.outcome === "absent") {
      return fail(c, 503, "SERVICE_UNAVAILABLE", "Arc cannot run new turns on this deployment yet.");
    }
    if (claim.outcome === "conflict") return fail(c, 409, "CONFLICT", "This turn ID was used with different input.");
    if (claim.outcome === "in_progress") {
      c.header("Retry-After", String(IN_PROGRESS_RETRY_SECONDS));
      return fail(c, 409, "IN_PROGRESS", "This turn is still running.", { retryAfterSeconds: IN_PROGRESS_RETRY_SECONDS });
    }
    if (claim.outcome === "replay") {
      let events;
      if (claim.turn.taskRunId === null) events = unstoredReplay(claim.turn);
      else if (typeof readEvents === "function") events = await readEvents({ sessionId: principal.sessionId, turn: claim.turn });
      else return fail(c, 503, "SERVICE_UNAVAILABLE", "Arc cannot replay this turn's events on this deployment yet.");
      return streamOf(events, { "Arc-Turn": "replayed" });
    }

    let response;
    try {
      response = await runTurn({
        sessionId: principal.sessionId, principal, turn: claim.turn, input, signal: c.req.raw.signal,
      });
    } catch (error) {
      await sessionStore.failTurn({
        sessionId: principal.sessionId, clientTurnId, ownerToken: claim.turn.ownerToken, errorCode: "SERVICE_UNAVAILABLE",
      }).catch(() => undefined);
      throw error;
    }
    const headers = new Headers(response.headers);
    headers.set("Arc-Turn", "accepted");
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  });

  app.get("/turns", async (c) => {
    const query = parse(ListQuerySchema, singleValues(c.req.queries()), "The history query is not valid.");
    if (!query.ok) return json(c, 400, query.failure);
    if (!storesConfigured) return storesUnavailable(c);
    const page = await sessionStore.listTurns({
      sessionId: principalOf(c).sessionId, limit: query.data.limit ?? 10, before: query.data.before,
    });
    if (page.ok === false) {
      return json(c, 400, validationFailure([{ field: "before", path: ["before"], code: "invalid_cursor", message: "The cursor is not valid." }]));
    }
    return c.json({ ok: true, turns: page.turns.map((turn) => turnView(turn, { withBlocks: false })), nextBefore: page.nextBefore });
  });

  app.get("/turns/:clientTurnId", requireEmptyQuery, async (c) => {
    const id = TurnIdSchema.safeParse(c.req.param("clientTurnId"));
    if (!id.success) {
      return json(c, 400, validationFailure([{ field: "clientTurnId", path: ["clientTurnId"], code: "invalid_format", message: "The turn ID must be a UUID." }]));
    }
    if (!storesConfigured) return storesUnavailable(c);
    const turn = await sessionStore.getTurn(principalOf(c).sessionId, id.data);
    if (turn === null) return fail(c, 404, "NOT_FOUND", "The turn was not found or has expired.");
    if (turn.recordStatus === "in_progress") c.header("Retry-After", String(IN_PROGRESS_RETRY_SECONDS));
    return c.json({ ok: true, turn: turnView(turn) });
  });

  // A mounted sub-app does not use its own notFound handler, so the catch-all is a route.
  app.all("*", (c) => fail(c, 404, "NOT_FOUND", "This Arc route does not exist."));

  return app;
}
