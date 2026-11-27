import assert from "node:assert/strict";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import test from "node:test";
import { authorizeSupervisor } from "../src/commands/authorize.js";
import { createFirestoreTraceStore } from "../src/google-cloud/firestore-trace-store.js";
import { createHackathonDemoAuthenticator } from "../src/hackathon-demo-auth.js";
import { createTraceRoutes } from "../src/trace-routes.js";
import { createTraceRegistry, createWriteThroughTraceRegistry } from "../src/trace-registry.js";
import { createFakeFirestore, FAKE_PROJECT_ID } from "./fixtures/fake-firestore.js";
const AUDIENCE = "https://momentum.example";

function createApp(registry) {
  const app = new Hono();
  app.route("/api/runs", createTraceRoutes(registry));
  return app;
}

test("SSE route rejects malformed and unavailable run subscriptions", async () => {
  const app = createApp(createTraceRegistry());
  const malformed = await app.request("/api/runs/not-a-uuid/events");
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, "VALIDATION_ERROR");

  const missing = await app.request("/api/runs/8a2ff660-17a9-493a-8a70-703ef8952bb1/events");
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "TRACE_NOT_FOUND");
});

test("SSE route replays and forwards ordered events until the real run becomes terminal", async () => {
  const registry = createTraceRegistry();
  const app = createApp(registry);
  const runId = registry.startRun();
  const response = await app.request(`/api/runs/${runId}/events`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  assert.equal(response.headers.get("cache-control"), "no-cache");

  const bodyPromise = response.text();
  await new Promise((resolve) => setImmediate(resolve));
  const started = registry.startTool(runId, "predictRisk");
  registry.finishTool(runId, started.toolCallId, "unavailable", "SERVICE_UNAVAILABLE");
  registry.finishRun(runId, "failed");
  const body = await bodyPromise;

  assert.match(body, /event: run\.started/);
  assert.match(body, /event: tool\.started/);
  assert.match(body, /event: tool\.unavailable/);
  assert.match(body, /event: run\.failed/);
  assert.match(body, new RegExp(`id: ${runId}:4`));
  assert.doesNotMatch(body, /secret|token|orderProfile|ratesPct/);
  assert.equal(registry.subscriberCount(runId), 0);
});

test("SSE route replays from Last-Event-ID and rejects expired cursors", async () => {
  const registry = createTraceRegistry({ maxEventsPerRun: 2 });
  const app = createApp(registry);
  const runId = registry.startRun();
  const first = registry.startTool(runId, "getConditions");
  registry.finishTool(runId, first.toolCallId, "failed", "TOOL_ERROR");
  registry.finishRun(runId, "failed");

  const replay = await app.request(`/api/runs/${runId}/events`, {
    headers: { "Last-Event-ID": `${runId}:2` },
  });
  assert.equal(replay.status, 200);
  const replayBody = await replay.text();
  assert.doesNotMatch(replayBody, /event: run\.started/);
  assert.match(replayBody, /event: tool\.failed/);
  assert.match(replayBody, /event: run\.failed/);

  const invalid = await app.request(`/api/runs/${runId}/events`, {
    headers: { "Last-Event-ID": "8a2ff660-17a9-493a-8a70-703ef8952bb1:1" },
  });
  assert.equal(invalid.status, 400);
});

test("SSE route does not duplicate events emitted during replay setup", async () => {
  const registry = createTraceRegistry();
  const runId = registry.startRun();
  let eventReadCount = 0;
  const racingRegistry = {
    getRun: registry.getRun,
    getEventsAfter(requestedRunId, sequence) {
      eventReadCount += 1;
      if (eventReadCount === 2) {
        const started = registry.startTool(runId, "predictRisk");
        registry.finishTool(runId, started.toolCallId, "succeeded");
        registry.finishRun(runId, "completed");
      }
      return registry.getEventsAfter(requestedRunId, sequence);
    },
    subscribe: registry.subscribe,
  };
  const app = createApp(racingRegistry);

  const response = await app.request(`/api/runs/${runId}/events`);
  const body = await response.text();

  assert.equal((body.match(/event: tool\.started/g) || []).length, 1);
  assert.equal((body.match(/event: tool\.succeeded/g) || []).length, 1);
  assert.equal((body.match(/event: run\.completed/g) || []).length, 1);
});

test("SSE subscriptions isolate runs and clean up after disconnect", async () => {
  const registry = createTraceRegistry();
  const app = createApp(registry);
  const runId = registry.startRun();
  const controller = new AbortController();
  const response = await app.request(`/api/runs/${runId}/events`, {
    signal: controller.signal,
  });
  const reader = response.body.getReader();
  await reader.read();
  assert.equal(registry.subscriberCount(runId), 1);
  await reader.cancel();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(registry.subscriberCount(runId), 0);

  const otherRun = registry.startRun();
  const otherEvents = registry.getEventsAfter(otherRun);
  assert.equal(otherEvents.some((event) => event.runId === runId), false);
});

const demoAuth = createHackathonDemoAuthenticator({
  mode: "HACKATHON_DEMO",
  signingKey: "a".repeat(64),
  syntheticOnly: true,
  auditEnabled: true,
});

function demoSession() {
  const token = demoAuth.issue(AUDIENCE);
  return { cookie: `__Host-ustaad-demo=${token}`, sessionId: demoAuth.authenticate(token, AUDIENCE).principal.sessionId };
}

// One Cloud Run instance: its own in-memory registry, the shared store, and
// the same authorization middleware index.mjs puts in front of /api/runs.
function createInstance(fake, { routeOptions = {}, durable = true } = {}) {
  const store = createFirestoreTraceStore({
    projectId: FAKE_PROJECT_ID,
    fetchImpl: fake.fetchImpl,
    tokenProvider: async () => "fake-access-token",
  });
  const traces = createWriteThroughTraceRegistry({ registry: createTraceRegistry(), store, log: () => {} });
  const app = new Hono();
  app.use("/api/runs/*", async (c, next) => {
    const result = await authorizeSupervisor({
      method: c.req.method,
      path: c.req.path,
      demoCookie: getCookie(c, "__Host-ustaad-demo"),
      requestUrl: c.req.url,
    }, {
      hackathonAuth: demoAuth,
      traceOwners: new Map(),
      ...(durable ? { traceOwnerLookup: traces.ownerOf } : {}),
      isSameOrigin: () => true, sessionAudience: () => AUDIENCE,
    });
    if (!result.ok) return c.json({ ok: false, error: result.error }, result.status);
    return next();
  });
  app.route("/api/runs", durable
    ? createTraceRoutes(traces.registry, { store, ...routeOptions })
    : createTraceRoutes(traces.registry));
  return { app, traces, store };
}

async function finishedRunOn(instance, ownerSessionId) {
  const { registry } = instance.traces;
  const runId = registry.startRun();
  const tool = registry.startTool(runId, "predictRisk");
  registry.finishTool(runId, tool.toolCallId, "succeeded");
  registry.finishRun(runId, "completed");
  await instance.traces.claimOwner(runId, ownerSessionId);
  return runId;
}

test("a second instance replays a run from the shared store exactly as the first instance does", async () => {
  const fake = createFakeFirestore();
  const first = createInstance(fake);
  const second = createInstance(fake);
  const owner = demoSession();
  const runId = await finishedRunOn(first, owner.sessionId);

  const local = await first.app.request(`/api/runs/${runId}/events`, { headers: { Cookie: owner.cookie } });
  const remote = await second.app.request(`/api/runs/${runId}/events`, { headers: { Cookie: owner.cookie } });
  assert.equal(remote.status, 200);
  assert.match(remote.headers.get("content-type"), /text\/event-stream/);
  const localBody = await local.text();
  const remoteBody = await remote.text();
  assert.equal(remoteBody, localBody);
  assert.deepEqual([...remoteBody.matchAll(/^id: (.+)$/gm)].map((match) => match[1]),
    [1, 2, 3, 4].map((sequence) => `${runId}:${sequence}`));
  assert.deepEqual([...remoteBody.matchAll(/^event: (.+)$/gm)].map((match) => match[1]),
    ["run.started", "tool.started", "tool.succeeded", "run.completed"]);
});

test("a second instance resumes from the same Last-Event-ID cursor", async () => {
  const fake = createFakeFirestore();
  const first = createInstance(fake);
  const second = createInstance(fake);
  const owner = demoSession();
  const runId = await finishedRunOn(first, owner.sessionId);

  const resumed = await second.app.request(`/api/runs/${runId}/events`, {
    headers: { Cookie: owner.cookie, "Last-Event-ID": `${runId}:2` },
  });
  assert.equal(resumed.status, 200);
  const body = await resumed.text();
  assert.deepEqual([...body.matchAll(/^id: (.+)$/gm)].map((match) => match[1]), [`${runId}:3`, `${runId}:4`]);
  assert.doesNotMatch(body, /event: run\.started/);

  const ahead = await second.app.request(`/api/runs/${runId}/events`, {
    headers: { Cookie: owner.cookie, "Last-Event-ID": `${runId}:5` },
  });
  assert.equal(ahead.status, 400);
  assert.equal((await ahead.json()).error.code, "TRACE_INVALID_CURSOR");
});

test("another session gets 404 for a run on either instance", async () => {
  const fake = createFakeFirestore();
  const first = createInstance(fake);
  const second = createInstance(fake);
  const owner = demoSession();
  const stranger = demoSession();
  const runId = await finishedRunOn(first, owner.sessionId);

  for (const instance of [first, second]) {
    const response = await instance.app.request(`/api/runs/${runId}/events`, { headers: { Cookie: stranger.cookie } });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, "TRACE_NOT_FOUND");
  }
  const unknown = await second.app.request("/api/runs/8a2ff660-17a9-493a-8a70-703ef8952bb1/events", {
    headers: { Cookie: owner.cookie },
  });
  assert.equal(unknown.status, 404);
});

test("the owner check fails closed when the shared store cannot answer", async () => {
  let down = false;
  const fake = createFakeFirestore({ failWhen: () => down });
  const first = createInstance(fake);
  const second = createInstance(fake);
  const owner = demoSession();
  const runId = await finishedRunOn(first, owner.sessionId);
  down = true;

  const remote = await second.app.request(`/api/runs/${runId}/events`, { headers: { Cookie: owner.cookie } });
  assert.equal(remote.status, 503);
  assert.equal((await remote.json()).error.code, "SERVICE_UNAVAILABLE");
  const local = await first.app.request(`/api/runs/${runId}/events`, { headers: { Cookie: owner.cookie } });
  assert.equal(local.status, 200, "the instance that ran the trace serves it from memory");
  assert.match(await local.text(), /event: run\.completed/);
});

test("the owner check rejects on its own failure even when the route could read the run", async () => {
  let headReadsToFail = 0;
  const fake = createFakeFirestore({
    failWhen: ({ method, path }) => method === "GET" && path.startsWith("traces/") && headReadsToFail-- > 0,
  });
  const first = createInstance(fake);
  const second = createInstance(fake);
  const owner = demoSession();
  const runId = await finishedRunOn(first, owner.sessionId);
  const callsBefore = fake.calls.length;
  headReadsToFail = 1;

  const remote = await second.app.request(`/api/runs/${runId}/events`, { headers: { Cookie: owner.cookie } });
  assert.equal(remote.status, 503);
  assert.deepEqual((await remote.json()).error, {
    code: "SERVICE_UNAVAILABLE",
    message: "Trace ownership could not be checked.",
  });
  assert.deepEqual(fake.calls.slice(callsBefore).map(({ method, path }) => [method, path]), [["GET", `traces/${runId}`]],
    "the route never reads the run after the owner lookup fails");
});

test("a second instance follows a run that is still running until it ends", async () => {
  const fake = createFakeFirestore();
  const first = createInstance(fake);
  const second = createInstance(fake, { routeOptions: { pollIntervalMs: 5 } });
  const owner = demoSession();
  const { registry } = first.traces;
  const runId = registry.startRun();
  await first.traces.claimOwner(runId, owner.sessionId);

  const response = await second.app.request(`/api/runs/${runId}/events`, { headers: { Cookie: owner.cookie } });
  assert.equal(response.status, 200);
  const bodyPromise = response.text();
  const tool = registry.startTool(runId, "getConditions");
  registry.finishTool(runId, tool.toolCallId, "unavailable", "SERVICE_UNAVAILABLE");
  registry.finishRun(runId, "failed");
  await first.traces.flush(runId);
  const body = await bodyPromise;

  assert.deepEqual([...body.matchAll(/^event: (.+)$/gm)].map((match) => match[1]),
    ["run.started", "tool.started", "tool.unavailable", "run.failed"]);
});

function failEventWrite(sequence) {
  const pattern = new RegExp(`^traces/[0-9a-f-]{36}/trace_events/${sequence}$`);
  return ({ method, path }) => method === "PATCH" && pattern.test(path);
}

function streamErrorCodes(body) {
  return [...body.matchAll(/^event: stream\.error\ndata: (.+)$/gm)].map((match) => JSON.parse(match[1]).error.code);
}

test("a run whose copy stopped short says so on another instance instead of 404", async () => {
  const fake = createFakeFirestore({ failWhen: failEventWrite(2) });
  const first = createInstance(fake);
  const second = createInstance(fake);
  const owner = demoSession();
  const runId = await finishedRunOn(first, owner.sessionId);

  const response = await second.app.request(`/api/runs/${runId}/events`, { headers: { Cookie: owner.cookie } });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.deepEqual([...body.matchAll(/^id: (.+)$/gm)].map((match) => match[1]), [`${runId}:1`]);
  assert.deepEqual(streamErrorCodes(body), ["TRACE_INCOMPLETE"]);
  assert.doesNotMatch(body, /event: run\.completed/);

  const resumed = await second.app.request(`/api/runs/${runId}/events`, {
    headers: { Cookie: owner.cookie, "Last-Event-ID": `${runId}:3` },
  });
  assert.equal(resumed.status, 200, "a cursor from the first instance's memory gets the same answer");
  assert.deepEqual(streamErrorCodes(await resumed.text()), ["TRACE_INCOMPLETE"]);
});

test("a second instance following a run ends with TRACE_INCOMPLETE when the copy stops mid-run", async () => {
  const fake = createFakeFirestore({ failWhen: failEventWrite(3) });
  const first = createInstance(fake);
  const second = createInstance(fake, { routeOptions: { pollIntervalMs: 5, maxStreamMs: 2000 } });
  const owner = demoSession();
  const { registry } = first.traces;
  const runId = registry.startRun();
  await first.traces.claimOwner(runId, owner.sessionId);

  const response = await second.app.request(`/api/runs/${runId}/events`, { headers: { Cookie: owner.cookie } });
  assert.equal(response.status, 200);
  const bodyPromise = response.text();
  const tool = registry.startTool(runId, "getConditions");
  registry.finishTool(runId, tool.toolCallId, "succeeded");
  registry.finishRun(runId, "completed");
  await first.traces.flush(runId);
  const startedWaiting = Date.now();
  const body = await bodyPromise;

  assert.deepEqual([...body.matchAll(/^event: (.+)$/gm)].map((match) => match[1]),
    ["run.started", "tool.started", "stream.error"]);
  assert.deepEqual(streamErrorCodes(body), ["TRACE_INCOMPLETE"]);
  assert.ok(Date.now() - startedWaiting < 1000, "the stream ends on the marker, not at maxStreamMs");
});

test("without the durable store a run from another instance stays unknown and unowned runs keep the 403", async () => {
  const fake = createFakeFirestore();
  const first = createInstance(fake);
  const second = createInstance(fake, { durable: false });
  const owner = demoSession();
  const runId = await finishedRunOn(first, owner.sessionId);
  const callsBefore = fake.calls.length;

  const response = await second.app.request(`/api/runs/${runId}/events`, { headers: { Cookie: owner.cookie } });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "DEMO_SCOPE_REQUIRED");
  assert.equal(fake.calls.length, callsBefore);

  const unguarded = new Hono();
  unguarded.route("/api/runs", createTraceRoutes(createTraceRegistry()));
  const missing = await unguarded.request(`/api/runs/${runId}/events`);
  assert.equal(missing.status, 404);
  assert.equal(fake.calls.length, callsBefore);
});
