import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Hono } from "hono";
import { createArcRoutes } from "../src/arc/routes.js";
import { createHackathonDemoAuthenticator } from "../src/hackathon-demo-auth.js";
import { createFirestoreArcSessionStore } from "../src/google-cloud/firestore-arc-session-store.js";
import { createFirestoreArcTaskRunStore } from "../src/google-cloud/firestore-arc-task-run-store.js";
import { applicationOrigin, isSameApplicationOrigin } from "../src/request-origin.js";
import { createFakeFirestore, FAKE_PROJECT_ID } from "./fixtures/fake-firestore.js";

// The requests below go to http://localhost, so that is the origin a session must be issued for.
const AUDIENCE = "http://localhost";
const COOKIE_NAME = "__Host-ustaad-demo";
const hackathonAuth = createHackathonDemoAuthenticator({
  mode: "HACKATHON_DEMO", signingKey: "a".repeat(64), syntheticOnly: true, auditEnabled: true,
});
const commandDeps = {
  hackathonAuth,
  executionMode: "live-service",
  traceOwners: new Map(),
  isSameOrigin: ({ origin, requestUrl }) => isSameApplicationOrigin({ origin, requestUrl }),
  sessionAudience: (requestUrl) => applicationOrigin({ requestUrl }),
};
const ACTIONS = ["open_last_card", "plan_lot"];
const BUYER = "Zephyr Kartonagen GmbH";

function newSession() {
  const cookie = hackathonAuth.issue(AUDIENCE);
  return { cookie: `${COOKIE_NAME}=${cookie}`, sessionId: hackathonAuth.authenticate(cookie, AUDIENCE).principal.sessionId };
}

function build({ enabled = true, fake = createFakeFirestore(), runTurn, readEvents, lotStore, actionIds = ACTIONS } = {}) {
  const options = { projectId: FAKE_PROJECT_ID, fetchImpl: fake.fetchImpl, tokenProvider: async () => "fake-access-token" };
  const sessionStore = createFirestoreArcSessionStore(options);
  const taskRunStore = createFirestoreArcTaskRunStore(options);
  const app = new Hono();
  app.route("/api/arc", createArcRoutes({ enabled, commandDeps, sessionStore, taskRunStore, lotStore, actionIds, runTurn, readEvents }));
  return { app, fake, sessionStore, taskRunStore };
}

function send(app, method, path, { session, body, origin = "http://localhost", headers = {} } = {}) {
  return app.request(`http://localhost${path}`, {
    method,
    headers: {
      ...(session ? { Cookie: session.cookie } : {}),
      ...(method === "POST" ? { "Content-Type": "application/json", Origin: origin } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}

const textTurn = (text, clientTurnId = randomUUID()) => ({ clientTurnId, input: { kind: "text", text } });
const streamResponse = (frame = "event: answer\ndata: {}\n\n") => new Response(frame, { headers: { "Content-Type": "text/event-stream" } });

function runnerSpy() {
  const calls = [];
  const runTurn = async (turn) => { calls.push(turn); return streamResponse(); };
  return { runTurn, calls };
}

async function finish(sessionStore, session, clientTurnId, input, fingerprint, answerText = "Done.") {
  const claim = await sessionStore.claimTurn({ sessionId: session.sessionId, clientTurnId, input, inputFingerprint: fingerprint });
  await sessionStore.completeTurn({ sessionId: session.sessionId, clientTurnId, ownerToken: claim.turn.ownerToken, taskRunId: null, answerText, summary: null, eventRange: null });
}

test("with USTAAD_ENABLE_ARC off every route and unknown path is 404 ARC_NOT_ENABLED, before auth and without touching Firestore", async () => {
  const { app, fake } = build({ enabled: false });
  const requests = [
    ["GET", "/api/arc/session"], ["GET", "/api/arc"], ["GET", "/api/arc/nothing/here"],
    ["GET", `/api/arc/runs/${randomUUID()}`], ["POST", `/api/arc/runs/${randomUUID()}/resume`],
    ["POST", "/api/arc/turns"], ["GET", "/api/arc/turns"], ["GET", `/api/arc/turns/${randomUUID()}`],
  ];
  for (const [method, path] of requests) {
    const response = await send(app, method, path, { origin: "https://elsewhere.example" });
    assert.equal(response.status, 404, `${method} ${path}`);
    assert.equal((await response.json()).error.code, "ARC_NOT_ENABLED", `${method} ${path}`);
    assert.equal(response.headers.get("cache-control"), "no-store", `${method} ${path}`);
  }
  assert.equal(fake.calls.length, 0);
});

test("without the signed cookie every Arc route is 401 DEMO_SESSION_REQUIRED", async () => {
  const { app, fake } = build();
  const requests = [
    ["GET", "/api/arc/session"], ["GET", `/api/arc/runs/${randomUUID()}`], ["GET", "/api/arc/turns"],
    ["GET", `/api/arc/turns/${randomUUID()}`], ["POST", "/api/arc/turns", textTurn("hello")],
  ];
  for (const [method, path, body] of requests) {
    const response = await send(app, method, path, { body });
    assert.equal(response.status, 401, `${method} ${path}`);
    assert.equal((await response.json()).error.code, "DEMO_SESSION_REQUIRED");
  }
  const forged = await send(app, "GET", "/api/arc/session", { session: { cookie: `${COOKIE_NAME}=abc.def` } });
  assert.equal(forged.status, 401);
  assert.equal(fake.calls.length, 0);
});

test("a session issued for another origin is 401 DEMO_SESSION_REQUIRED on every Arc route", async () => {
  const { app, fake } = build();
  const elsewhere = { cookie: `${COOKIE_NAME}=${hackathonAuth.issue("https://arc-test---momentum.example")}` };
  for (const [method, path, body] of [
    ["GET", "/api/arc/session"], ["GET", "/api/arc/turns"], ["POST", "/api/arc/turns", textTurn("hello")],
  ]) {
    const response = await send(app, method, path, { session: elsewhere, body });
    assert.equal(response.status, 401, `${method} ${path}`);
    assert.equal((await response.json()).error.code, "DEMO_SESSION_REQUIRED");
  }
  assert.equal(fake.calls.length, 0);
  assert.equal((await send(app, "GET", "/api/arc/session", { session: newSession() })).status, 200);
});

test("a POST without a same-origin Origin is 403 ORIGIN_REQUIRED, even before the cookie is checked", async () => {
  const { app } = build();
  const session = newSession();
  for (const origin of ["https://elsewhere.example", ""]) {
    for (const asUser of [session, undefined]) {
      const response = await send(app, "POST", "/api/arc/turns", { session: asUser, body: textTurn("hello"), origin });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, "ORIGIN_REQUIRED");
    }
  }
});

test("a sessionId in a body or query string is 400 VALIDATION_ERROR and never read", async () => {
  const { app, fake } = build({ runTurn: runnerSpy().runTurn });
  const session = newSession();
  const other = newSession();
  const body = { ...textTurn("hello"), sessionId: other.sessionId };
  const posted = await send(app, "POST", "/api/arc/turns", { session, body });
  assert.equal(posted.status, 400);
  const failure = await posted.json();
  assert.equal(failure.error.code, "VALIDATION_ERROR");
  assert.deepEqual(failure.error.issues.map((issue) => issue.field), ["sessionId"]);
  const nested = await send(app, "POST", "/api/arc/turns", { session, body: { ...textTurn("hello"), input: { kind: "text", text: "hi", sessionId: other.sessionId } } });
  assert.equal(nested.status, 400);
  const action = await send(app, "POST", "/api/arc/turns", {
    session,
    body: { clientTurnId: randomUUID(), input: { kind: "action", actionId: "plan_lot", params: { sessionId: other.sessionId } } },
  });
  assert.equal(action.status, 400);
  assert.equal((await action.json()).error.code, "VALIDATION_ERROR");
  for (const path of [`/api/arc/session?sessionId=${other.sessionId}`, `/api/arc/turns?sessionId=${other.sessionId}`]) {
    const response = await send(app, "GET", path, { session });
    assert.equal(response.status, 400, path);
    assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
  }
  assert.equal(fake.documents.size, 0);
});

test("run and turn detail and turn submission reject a query sessionId before reading Firestore", async (t) => {
  const { app, fake, taskRunStore } = build({ runTurn: runnerSpy().runTurn });
  const session = newSession();
  const body = textTurn("hello");
  const taskRunId = randomUUID();
  await taskRunStore.create({
    taskRunId, sessionId: session.sessionId, kind: "data_question", lotId: null, status: "RUNNING",
    steps: [{
      stepId: "query_metric", tool: "query_metric", status: "PENDING", argsHash: "a".repeat(64),
      idempotencyKey: null, attempt: 0, leaseOwner: null, leaseExpiresAt: null,
      resultRef: null, waitingFor: null, errorCode: null, startedAt: null, finishedAt: null,
    }],
  });
  const accepted = await send(app, "POST", "/api/arc/turns", { session, body });
  assert.equal(accepted.status, 200);
  await accepted.text();
  for (const [method, path, requestBody] of [
    ["GET", `/api/arc/runs/${taskRunId}`],
    ["GET", `/api/arc/turns/${body.clientTurnId}`],
    ["POST", "/api/arc/turns", body],
  ]) {
    await t.test(`${method} ${path}`, async () => {
      const callsBefore = fake.calls.length;
      const response = await send(app, method, `${path}?sessionId=${session.sessionId}`, { session, body: requestBody });
      assert.equal(response.status, 400);
      const failure = await response.json();
      assert.equal(failure.error.code, "VALIDATION_ERROR");
      assert.deepEqual(failure.error.issues.map((issue) => issue.field), ["sessionId"]);
      assert.equal(fake.calls.length, callsBefore);
    });
  }
});

test("GET /session creates the record once and returns only the fields the contract lists", async () => {
  const { app, fake } = build();
  const session = newSession();
  const first = await (await send(app, "GET", "/api/arc/session", { session })).json();
  const second = await (await send(app, "GET", "/api/arc/session", { session })).json();
  assert.deepEqual(second, first);
  assert.equal(first.ok, true);
  assert.deepEqual(Object.keys(first.session).sort(), ["activeLots", "activeTaskRunId", "authorizationMode", "expiresAt", "identityLabel", "jobIds", "resumable", "turnCount"]);
  assert.equal(first.session.identityLabel, "Demo session, simulated");
  assert.deepEqual(first.session.jobIds, []);
  assert.equal(first.session.turnCount, 0);
  assert.equal(JSON.stringify(first).includes(session.sessionId), false);
  assert.equal(fake.calls.filter((call) => call.method === "POST").length, 1);
  const response = await send(app, "GET", "/api/arc/session", { session });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("the session job list keeps the newest 20 IDs, newest last", async () => {
  const { app, sessionStore } = build();
  const session = newSession();
  await send(app, "GET", "/api/arc/session", { session });
  const ids = Array.from({ length: 23 }, (_, n) => `JOB-HACK-${session.sessionId}-${String(n).padStart(40, "0")}`);
  for (const jobId of ids) await sessionStore.recordJob({ sessionId: session.sessionId, jobId });
  const { session: view } = await (await send(app, "GET", "/api/arc/session", { session })).json();
  assert.deepEqual(view.jobIds, ids.slice(3));
  assert.equal(view.jobIds.at(-1), ids.at(-1));
});

test("active lots come from the lot heads and resumable reflects the active run", async () => {
  const session = newSession();
  const lotId = `LOT-HACK-${session.sessionId}-a1b2c3d4e5f6`;
  const lotStore = {
    async getLot({ lotId: id, ownerSessionId }) {
      assert.equal(ownerSessionId, session.sessionId);
      return id === lotId ? { head: { lotId, stage: "draft_review", currentJobId: null, currentRevision: 1, draftConditions: [{ secret: "not for the client" }] }, revision: null } : null;
    },
  };
  const { app, sessionStore, taskRunStore } = build({ lotStore });
  await send(app, "GET", "/api/arc/session", { session });
  await sessionStore.recordLot({ sessionId: session.sessionId, lotId });
  const taskRunId = randomUUID();
  await taskRunStore.create({
    taskRunId, sessionId: session.sessionId, kind: "lot_preparation", lotId, status: "RUNNING",
    steps: [{ stepId: "read_order", tool: "read_order", status: "PENDING", argsHash: null, idempotencyKey: null, attempt: 0, leaseOwner: null, leaseExpiresAt: null, resultRef: null, waitingFor: null, errorCode: null, startedAt: null, finishedAt: null }],
  });
  await sessionStore.setActiveTaskRun({ sessionId: session.sessionId, taskRunId });
  const { session: view } = await (await send(app, "GET", "/api/arc/session", { session })).json();
  assert.deepEqual(view.activeLots, [{ lotId, stage: "draft_review", currentJobId: null, currentRevision: 1 }]);
  assert.equal(view.activeTaskRunId, taskRunId);
  assert.equal(view.resumable, true);
});

test("a task run is readable by its own session only; another session and an unknown run both get 404 NOT_FOUND", async () => {
  const { app, taskRunStore } = build();
  const owner = newSession();
  const stranger = newSession();
  const taskRunId = randomUUID();
  await taskRunStore.create({
    taskRunId, sessionId: owner.sessionId, kind: "data_question", lotId: null, status: "COMPLETED",
    steps: [{ stepId: "query_metric", tool: "query_metric", status: "SUCCEEDED", argsHash: "a".repeat(64), idempotencyKey: null, attempt: 0, leaseOwner: randomUUID(), leaseExpiresAt: "2026-11-24T09:00:00.000Z", resultRef: { kind: "metric", id: "r2" }, waitingFor: null, errorCode: null, startedAt: "2026-11-24T09:00:00.000Z", finishedAt: "2026-11-24T09:00:01.000Z" }],
  });
  const mine = await send(app, "GET", `/api/arc/runs/${taskRunId}`, { session: owner });
  assert.equal(mine.status, 200);
  const { run } = await mine.json();
  assert.equal(run.steps[0].label, "Reading the data");
  assert.equal(run.lastSequence, 0);
  const text = JSON.stringify(run);
  for (const hidden of ["leaseOwner", "leaseExpiresAt", "idempotencyKey", "argsHash", "version", "sessionId", owner.sessionId]) {
    assert.equal(text.includes(hidden), false, hidden);
  }
  for (const id of [taskRunId, randomUUID()]) {
    const response = await send(app, "GET", `/api/arc/runs/${id}`, { session: stranger });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, "NOT_FOUND");
  }
  const malformed = await send(app, "GET", "/api/arc/runs/not-a-uuid", { session: owner });
  assert.equal(malformed.status, 400);
});

test("a new turn is claimed, handed to the runner once, and marked accepted", async () => {
  const spy = runnerSpy();
  const { app, sessionStore } = build({ runTurn: spy.runTurn });
  const session = newSession();
  const body = textTurn("What is the R2 of the crack model?");
  const response = await send(app, "POST", "/api/arc/turns", { session, body });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("arc-turn"), "accepted");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(spy.calls.length, 1);
  assert.equal(spy.calls[0].sessionId, session.sessionId);
  assert.equal(spy.calls[0].turn.clientTurnId, body.clientTurnId);
  assert.equal(spy.calls[0].input.text, "What is the R2 of the crack model?");
  assert.equal((await sessionStore.get(session.sessionId)).turnCount, 1);
});

test("a replayed clientTurnId returns the stored result, does not call the runner and spends nothing", async () => {
  const spy = runnerSpy();
  const { app, sessionStore, fake } = build({ runTurn: spy.runTurn });
  const session = newSession();
  const body = textTurn("What is the R2 of the crack model?");
  await send(app, "POST", "/api/arc/turns", { session, body });
  const stored = await sessionStore.getTurn(session.sessionId, body.clientTurnId);
  await sessionStore.completeTurn({ sessionId: session.sessionId, clientTurnId: body.clientTurnId, ownerToken: stored.ownerToken, taskRunId: null, answerText: "The crack model scores an R2 of 0.640.", summary: null, eventRange: null });
  const documentsBefore = JSON.stringify([...fake.documents.entries()]);
  const callsBefore = fake.calls.length;

  const replay = await send(app, "POST", "/api/arc/turns", { session, body });
  assert.equal(replay.status, 200);
  assert.equal(replay.headers.get("arc-turn"), "replayed");
  assert.match(replay.headers.get("content-type"), /^text\/event-stream/);
  const frame = await replay.text();
  assert.match(frame, /^event: answer\n/);
  assert.equal(frame.includes("\nid:"), false);
  const data = JSON.parse(/data: (.+)\n/.exec(frame)[1]);
  assert.deepEqual(data, { sequence: 0, type: "answer", clientTurnId: body.clientTurnId, resultRef: { kind: "turn", id: body.clientTurnId } });
  assert.equal(spy.calls.length, 1);
  assert.equal(JSON.stringify([...fake.documents.entries()]), documentsBefore);
  assert.equal(fake.calls.slice(callsBefore).every((call) => call.method === "GET"), true);
});

test("a failed turn replays its stored error code and a new attempt needs a new clientTurnId", async () => {
  const spy = runnerSpy();
  const { app, sessionStore } = build({ runTurn: spy.runTurn });
  const session = newSession();
  const body = textTurn("What is the R2 of the crack model?");
  await send(app, "POST", "/api/arc/turns", { session, body });
  const stored = await sessionStore.getTurn(session.sessionId, body.clientTurnId);
  await sessionStore.failTurn({ sessionId: session.sessionId, clientTurnId: body.clientTurnId, ownerToken: stored.ownerToken, errorCode: "BUDGET_DAY_EXHAUSTED" });
  const read = await send(app, "GET", `/api/arc/turns/${body.clientTurnId}`, { session });
  assert.equal(read.status, 200);
  assert.equal(read.headers.has("retry-after"), false);
  const { turn } = await read.json();
  assert.equal(turn.status, "failed");
  assert.equal(turn.errorCode, "BUDGET_DAY_EXHAUSTED");
  const replay = await send(app, "POST", "/api/arc/turns", { session, body });
  assert.equal(replay.headers.get("arc-turn"), "replayed");
  assert.deepEqual(JSON.parse(/data: (.+)\n/.exec(await replay.text())[1]), { sequence: 0, type: "run.failed", clientTurnId: body.clientTurnId, errorCode: "BUDGET_DAY_EXHAUSTED" });
  assert.equal(spy.calls.length, 1);
});

test("a replay of a turn with a task run is read from the stored events and carries their ids", async () => {
  const session = newSession();
  const clientTurnId = randomUUID();
  const events = [
    { sequence: 1, type: "run.started", clientTurnId, taskRunId: randomUUID(), kind: "data_question" },
    { sequence: 2, type: "answer", clientTurnId, resultRef: { kind: "turn", id: clientTurnId } },
  ];
  const readEvents = async ({ turn }) => { assert.equal(turn.clientTurnId, clientTurnId); return events; };
  const withHook = build({ readEvents, runTurn: runnerSpy().runTurn });
  const body = textTurn("How many lots ran last week?", clientTurnId);
  await send(withHook.app, "POST", "/api/arc/turns", { session, body });
  const stored = await withHook.sessionStore.getTurn(session.sessionId, clientTurnId);
  await withHook.sessionStore.completeTurn({ sessionId: session.sessionId, clientTurnId, ownerToken: stored.ownerToken, taskRunId: randomUUID(), answerText: "Four.", summary: null, eventRange: { first: 1, last: 2 } });
  const replay = await send(withHook.app, "POST", "/api/arc/turns", { session, body });
  const text = await replay.text();
  assert.deepEqual([...text.matchAll(/^id: (\d+)$/gm)].map((match) => match[1]), ["1", "2"]);

  const withoutHook = build({ fake: withHook.fake, runTurn: runnerSpy().runTurn });
  const unavailable = await send(withoutHook.app, "POST", "/api/arc/turns", { session, body });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("cache-control"), "no-store");
  assert.equal((await unavailable.json()).error.code, "SERVICE_UNAVAILABLE");
});

test("the same clientTurnId with different input is 409 CONFLICT and the runner is not called again", async () => {
  const spy = runnerSpy();
  const { app } = build({ runTurn: spy.runTurn });
  const session = newSession();
  const clientTurnId = randomUUID();
  await send(app, "POST", "/api/arc/turns", { session, body: textTurn("first question", clientTurnId) });
  const conflict = await send(app, "POST", "/api/arc/turns", { session, body: textTurn("another question", clientTurnId) });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error.code, "CONFLICT");
  assert.equal(spy.calls.length, 1);
});

test("a turn still running under a live lease is 409 IN_PROGRESS with Retry-After 5", async () => {
  const spy = runnerSpy();
  const { app } = build({ runTurn: spy.runTurn });
  const session = newSession();
  const body = textTurn("first question");
  await send(app, "POST", "/api/arc/turns", { session, body });
  const again = await send(app, "POST", "/api/arc/turns", { session, body });
  assert.equal(again.status, 409);
  assert.equal(again.headers.get("retry-after"), "5");
  const failure = await again.json();
  assert.equal(failure.error.code, "IN_PROGRESS");
  assert.equal(failure.error.retryAfterSeconds, 5);
  assert.equal(spy.calls.length, 1);
});

test("the same typed text with different surrounding whitespace is the same turn", async () => {
  const spy = runnerSpy();
  const { app } = build({ runTurn: spy.runTurn });
  const session = newSession();
  const clientTurnId = randomUUID();
  await send(app, "POST", "/api/arc/turns", { session, body: textTurn("hello there", clientTurnId) });
  const again = await send(app, "POST", "/api/arc/turns", { session, body: textTurn("  hello there \n", clientTurnId) });
  assert.equal(again.status, 409);
  assert.equal((await again.json()).error.code, "IN_PROGRESS");
});

test("without a turn runner a new turn is 503 and nothing is stored, but a stored turn still replays", async () => {
  const { app, sessionStore, fake } = build();
  const session = newSession();
  const body = textTurn("hello");
  const refused = await send(app, "POST", "/api/arc/turns", { session, body });
  assert.equal(refused.status, 503);
  assert.equal(refused.headers.get("cache-control"), "no-store");
  assert.equal((await refused.json()).error.code, "SERVICE_UNAVAILABLE");
  assert.equal([...fake.documents.keys()].some((path) => path.includes("/turns/")), false);

  const fingerprint = "b".repeat(64);
  const id = randomUUID();
  await sessionStore.getOrCreate({ sessionId: session.sessionId, sessionExpiresAt: new Date(Date.now() + 3600_000).toISOString() });
  const seeded = await sessionStore.claimTurn({ sessionId: session.sessionId, clientTurnId: id, input: { kind: "action", actionId: "open_last_card", paramsHash: fingerprint }, inputFingerprint: fingerprint });
  await sessionStore.completeTurn({ sessionId: session.sessionId, clientTurnId: id, ownerToken: seeded.turn.ownerToken, taskRunId: null, answerText: "ok", summary: null, eventRange: null });
  const read = await send(app, "GET", `/api/arc/turns/${id}`, { session });
  assert.equal(read.status, 200);
});

test("turn requests that break the schema are 400 and store nothing", async () => {
  const { app, fake } = build({ runTurn: runnerSpy().runTurn });
  const session = newSession();
  const id = randomUUID();
  const cases = [
    ["not JSON", "{nope"],
    ["an array", []],
    ["no clientTurnId", { input: { kind: "text", text: "hi" } }],
    ["clientTurnId not a UUID", { clientTurnId: "turn-1", input: { kind: "text", text: "hi" } }],
    ["empty text", { clientTurnId: id, input: { kind: "text", text: "   " } }],
    ["text over 1,000 characters", { clientTurnId: id, input: { kind: "text", text: "x".repeat(1001) } }],
    ["unknown input kind", { clientTurnId: id, input: { kind: "voice", audio: "..." } }],
    ["unknown top-level key", { clientTurnId: id, input: { kind: "text", text: "hi" }, extra: 1 }],
    ["nested params", { clientTurnId: id, input: { kind: "action", actionId: "plan_lot", params: { a: { b: 1 } } } }],
    ["params over 2 KiB", { clientTurnId: id, input: { kind: "action", actionId: "plan_lot", params: { note: "y".repeat(2100) } } }],
  ];
  for (const [name, body] of cases) {
    const response = await send(app, "POST", "/api/arc/turns", { session, body });
    assert.equal(response.status, 400, name);
    assert.equal((await response.json()).error.code, "VALIDATION_ERROR", name);
  }
  const unknown = await send(app, "POST", "/api/arc/turns", { session, body: { clientTurnId: id, input: { kind: "action", actionId: "approve_job" } } });
  assert.equal(unknown.status, 400);
  assert.equal((await unknown.json()).error.issues[0].code, "unknown_action");
  assert.equal(fake.documents.size, 0);
});

test("an oversized body is 413 before it is parsed", async () => {
  const { app } = build({ runTurn: runnerSpy().runTurn });
  const response = await send(app, "POST", "/api/arc/turns", { session: newSession(), body: JSON.stringify({ pad: "x".repeat(40_000) }) });
  assert.equal(response.status, 413);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "PAYLOAD_TOO_LARGE");
});

test("no free text from a request is stored beyond the user's own typed text: action params are hashed, not kept", async () => {
  const { app, fake } = build({ runTurn: runnerSpy().runTurn });
  const session = newSession();
  const body = { clientTurnId: randomUUID(), input: { kind: "action", actionId: "plan_lot", params: { buyer: BUYER, notes: "Hafenstrasse 12" } } };
  const response = await send(app, "POST", "/api/arc/turns", { session, body });
  assert.equal(response.status, 200);
  const everything = JSON.stringify([...fake.documents.values()]);
  assert.equal(everything.includes("Zephyr"), false);
  assert.equal(everything.includes("Hafenstrasse"), false);
  const stored = fake.documents.get(`arc_sessions/${session.sessionId}/turns/${body.clientTurnId}`).fields;
  assert.deepEqual(Object.keys(stored.input.mapValue.fields).sort(), ["actionId", "kind", "paramsHash"]);
});

test("another session cannot read or replay a turn: the turn is 404 NOT_FOUND and the ID is free to use", async () => {
  const { app, sessionStore } = build({ runTurn: runnerSpy().runTurn });
  const owner = newSession();
  const stranger = newSession();
  const clientTurnId = randomUUID();
  await send(app, "POST", "/api/arc/turns", { session: owner, body: textTurn("owner question", clientTurnId) });
  const read = await send(app, "GET", `/api/arc/turns/${clientTurnId}`, { session: stranger });
  assert.equal(read.status, 404);
  assert.equal((await read.json()).error.code, "NOT_FOUND");
  const list = await (await send(app, "GET", "/api/arc/turns", { session: stranger })).json();
  assert.deepEqual(list.turns, []);
  const reuse = await send(app, "POST", "/api/arc/turns", { session: stranger, body: textTurn("stranger question", clientTurnId) });
  assert.equal(reuse.headers.get("arc-turn"), "accepted");
  assert.equal((await sessionStore.getTurn(owner.sessionId, clientTurnId)).input.text, "owner question");
});

test("GET /turns/:id returns the turn view, with the answer only once the turn is complete", async () => {
  const spy = runnerSpy();
  const { app, sessionStore } = build({ runTurn: spy.runTurn });
  const session = newSession();
  const body = textTurn("What is the R2 of the crack model?");
  await send(app, "POST", "/api/arc/turns", { session, body });
  const runningResponse = await send(app, "GET", `/api/arc/turns/${body.clientTurnId}`, { session });
  const { turn: running } = await runningResponse.json();
  assert.equal(running.status, "in_progress");
  assert.equal(running.answer, null);
  assert.equal(running.errorCode, null);
  assert.equal(runningResponse.headers.get("retry-after"), "5");
  const stored = await sessionStore.getTurn(session.sessionId, body.clientTurnId);
  await sessionStore.completeTurn({ sessionId: session.sessionId, clientTurnId: body.clientTurnId, ownerToken: stored.ownerToken, taskRunId: null, answerText: "The crack model scores an R2 of 0.640.", summary: { intent: "data_question", tools: [], resultRefs: [], attempts: 2, writerOutcome: "shown", fallbackReason: null, versions: {} }, eventRange: null });
  const completed = await send(app, "GET", `/api/arc/turns/${body.clientTurnId}`, { session });
  assert.equal(completed.headers.has("retry-after"), false);
  const { turn } = await completed.json();
  assert.equal(turn.errorCode, null);
  assert.deepEqual(turn.input, { kind: "text", text: "What is the R2 of the crack model?" });
  assert.deepEqual(turn.answer, { text: "The crack model scores an R2 of 0.640.", generatedByGemini: true, writerOutcome: "shown", blocks: [] });
  for (const hidden of ["ownerToken", "inputFingerprint", "leaseExpiresAt", "sessionId", "summary", "paramsHash"]) {
    assert.equal(JSON.stringify(turn).includes(hidden), false, hidden);
  }
  assert.equal((await send(app, "GET", "/api/arc/turns/not-a-uuid", { session })).status, 400);
  assert.equal((await send(app, "GET", `/api/arc/turns/${randomUUID()}`, { session })).status, 404);
});

test("a template answer and a refusal are not marked as generated by Gemini", async () => {
  const { app, sessionStore } = build();
  const session = newSession();
  await sessionStore.getOrCreate({ sessionId: session.sessionId, sessionExpiresAt: new Date(Date.now() + 3600_000).toISOString() });
  const id = randomUUID();
  await finish(sessionStore, session, id, { kind: "text", text: "Can you order me a pizza?" }, "c".repeat(64), "I can only answer questions about Momentum.");
  const { turn } = await (await send(app, "GET", `/api/arc/turns/${id}`, { session })).json();
  assert.equal(turn.answer.generatedByGemini, false);
  assert.equal(turn.answer.writerOutcome, "not_called");
});

test("GET /turns pages newest first without blocks and validates its query", async () => {
  const { app, sessionStore } = build();
  const session = newSession();
  await sessionStore.getOrCreate({ sessionId: session.sessionId, sessionExpiresAt: new Date(Date.now() + 3600_000).toISOString() });
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  for (const [index, id] of ids.entries()) {
    await finish(sessionStore, session, id, { kind: "text", text: `question ${index}` }, "d".repeat(64), `answer ${index}`);
    await new Promise((resolve) => setTimeout(resolve, 3));
  }
  const first = await (await send(app, "GET", "/api/arc/turns?limit=2", { session })).json();
  assert.deepEqual(first.turns.map((turn) => turn.clientTurnId), [ids[2], ids[1]]);
  assert.deepEqual(first.turns[0].answer, { text: "answer 2", generatedByGemini: false });
  assert.equal(typeof first.nextBefore, "string");
  const second = await (await send(app, "GET", `/api/arc/turns?limit=2&before=${first.nextBefore}`, { session })).json();
  assert.deepEqual(second.turns.map((turn) => turn.clientTurnId), [ids[0]]);
  assert.equal(second.nextBefore, null);
  for (const query of ["limit=0", "limit=21", "limit=abc", "limit=1.5", "before=garbage", "page=2"]) {
    const response = await send(app, "GET", `/api/arc/turns?${query}`, { session });
    assert.equal(response.status, 400, query);
    assert.equal((await response.json()).error.code, "VALIDATION_ERROR", query);
  }
});

test("a Firestore outage is 503 SERVICE_UNAVAILABLE and never an empty session", async () => {
  const { app } = build({ fake: createFakeFirestore({ failWhen: () => true }) });
  const response = await send(app, "GET", "/api/arc/session", { session: newSession() });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "SERVICE_UNAVAILABLE");
});

test("an unknown path under the prefix is a JSON 404 once Arc is enabled", async () => {
  const { app } = build();
  const response = await send(app, "GET", "/api/arc/nothing", { session: newSession() });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "NOT_FOUND");
});

test("routes owned by ARC-M2-06 are not mounted yet", async () => {
  const { app } = build();
  const session = newSession();
  const id = randomUUID();
  assert.equal((await send(app, "GET", `/api/arc/runs/${id}/events`, { session })).status, 404);
  assert.equal((await send(app, "POST", `/api/arc/runs/${id}/resume`, { session, body: {} })).status, 404);
});

test("enabled without Firestore stores is 503 SERVICE_UNAVAILABLE, a different state from not enabled", async () => {
  const app = new Hono();
  app.route("/api/arc", createArcRoutes({ enabled: true, commandDeps }));
  const response = await send(app, "GET", "/api/arc/session", { session: newSession() });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "SERVICE_UNAVAILABLE");
});

test("missing Firestore stores do not bypass origin, cookie or request validation", async (t) => {
  const app = new Hono();
  app.route("/api/arc", createArcRoutes({ enabled: true, commandDeps }));
  for (const [status, code, method, path, options] of [
    [403, "ORIGIN_REQUIRED", "POST", "/api/arc/turns", { origin: "" }],
    [401, "DEMO_SESSION_REQUIRED", "POST", "/api/arc/turns", {}],
    [401, "DEMO_SESSION_REQUIRED", "GET", "/api/arc/session", {}],
    [400, "VALIDATION_ERROR", "POST", "/api/arc/turns", { session: newSession(), body: {} }],
  ]) {
    await t.test(`${method} ${path} returns ${code}`, async () => {
      const response = await send(app, method, path, options);
      assert.equal(response.status, status);
      assert.equal((await response.json()).error.code, code);
      assert.equal(response.headers.get("cache-control"), "no-store");
    });
  }
});
