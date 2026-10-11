import assert from "node:assert/strict";
import test from "node:test";
import { createTraceRegistry, TraceRegistryError } from "../src/trace-registry.js";

test("trace registry records an ordered lifecycle without capturing operation payloads", () => {
  const registry = createTraceRegistry();
  const runId = registry.startRun();
  const started = registry.startTool(runId, "predictRisk");
  const succeeded = registry.finishTool(runId, started.toolCallId, "succeeded");
  const completed = registry.finishRun(runId, "completed");
  const events = registry.getEventsAfter(runId);

  assert.deepEqual(events.map(({ type, sequence }) => [type, sequence]), [
    ["run.started", 1],
    ["tool.started", 2],
    ["tool.succeeded", 3],
    ["run.completed", 4],
  ]);
  assert.equal(started.toolCallId, succeeded.toolCallId);
  assert.equal(completed.id, `${runId}:4`);
  assert.equal(Object.hasOwn(succeeded, "result"), false);
  assert.equal(Object.hasOwn(succeeded, "secret"), false);
  assert.equal(registry.getRun(runId).status, "completed");
});

test("trace lifecycle validates tool names, outcomes, active calls, and sanitized error codes", () => {
  const registry = createTraceRegistry();
  const runId = registry.startRun();
  assert.throws(() => registry.startTool(runId, "unknownTool"), TraceRegistryError);
  const started = registry.startTool(runId, "extractOrder");
  assert.throws(() => registry.finishRun(runId, "completed"), /tool calls are active/);

  assert.throws(
    () => registry.finishTool(runId, started.toolCallId, "failed", "secret token"),
    /sanitized error code/
  );
  const failed = registry.finishTool(
    runId,
    started.toolCallId,
    "failed",
    "SERVICE_UNAVAILABLE"
  );
  assert.equal(failed.errorCode, "SERVICE_UNAVAILABLE");
  assert.equal(Object.hasOwn(failed, "message"), false);
  registry.finishRun(runId, "failed");
  assert.throws(() => registry.startTool(runId, "getConditions"), /already terminal/);
});

test("concurrent runs retain independent ordered events and subscriptions", () => {
  const registry = createTraceRegistry();
  const firstRun = registry.startRun();
  const secondRun = registry.startRun();
  const firstEvents = [];
  const stop = registry.subscribe(firstRun, (event) => firstEvents.push(event));
  const secondTool = registry.startTool(secondRun, "getConditions");
  registry.finishTool(secondRun, secondTool.toolCallId, "unavailable", "SERVICE_UNAVAILABLE");
  registry.finishRun(secondRun, "failed");
  const firstTool = registry.startTool(firstRun, "extractOrder");
  registry.finishTool(firstRun, firstTool.toolCallId, "succeeded");
  registry.finishRun(firstRun, "completed");
  stop();

  assert.deepEqual(firstEvents.map(({ runId }) => runId), Array(3).fill(firstRun));
  assert.equal(registry.getEventsAfter(secondRun).some((event) => event.runId === firstRun), false);
  assert.equal(registry.subscriberCount(firstRun), 0);
});

test("trace retention and replay bounds are enforced", () => {
  let now = 1_000;
  const registry = createTraceRegistry({
    maxRuns: 2,
    maxEventsPerRun: 2,
    retentionMs: 10,
    now: () => now,
  });
  const runId = registry.startRun();
  const tool = registry.startTool(runId, "getConditions");
  registry.finishTool(runId, tool.toolCallId, "failed", "TOOL_ERROR");
  assert.throws(() => registry.getEventsAfter(runId, 0), /expired from the replay window/);
  registry.finishRun(runId, "failed");
  now += 11;
  assert.throws(() => registry.getRun(runId), /not found or has expired/);
});

test("trace registry bounds listeners and active run capacity", () => {
  const registry = createTraceRegistry({ maxRuns: 1, maxSubscribersPerRun: 1 });
  const runId = registry.startRun();
  const unsubscribe = registry.subscribe(runId, () => {});
  assert.throws(() => registry.subscribe(runId, () => {}), /subscriber limit/);
  assert.throws(() => registry.startRun(), /no capacity/);
  unsubscribe();
  const call = registry.startTool(runId, "generateJobSheet");
  registry.finishTool(runId, call.toolCallId, "unavailable", "SERVICE_UNAVAILABLE");
  registry.finishRun(runId, "failed");
  assert.doesNotThrow(() => registry.startRun());
});
