import assert from "node:assert/strict";
import { Hono } from "hono";
import test from "node:test";
import { createTraceRoutes } from "../src/trace-routes.js";
import { createTraceRegistry } from "../src/trace-registry.js";

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
