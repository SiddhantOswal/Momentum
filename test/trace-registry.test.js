import assert from "node:assert/strict";
import test from "node:test";
import {
  configureDurableTraces,
  createTraceRegistry,
  createWriteThroughTraceRegistry,
  TraceRegistryError,
} from "../src/trace-registry.js";

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

function recordingStore({ failOn = () => false } = {}) {
  const events = [];
  const heads = [];
  return {
    events,
    heads,
    async appendEvent(event) {
      await new Promise((resolve) => setImmediate(resolve));
      if (failOn("event", event)) throw Object.assign(new Error(`write failed for ${event.runId}`), { code: "SERVICE_UNAVAILABLE" });
      events.push(event);
    },
    async writeHead(head) {
      if (failOn("head", head)) throw Object.assign(new Error("head failed"), { code: "SERVICE_UNAVAILABLE" });
      heads.push(head);
    },
    async readHead(runId) {
      return heads.filter((head) => head.runId === runId).at(-1) ?? null;
    },
  };
}

const OWNER = "c".repeat(32);

test("write-through registry copies each event in order and writes the owner head after them", async () => {
  const store = recordingStore();
  const durable = createWriteThroughTraceRegistry({ registry: createTraceRegistry(), store, log: () => {} });
  const runId = durable.registry.startRun();
  const tool = durable.registry.startTool(runId, "predictRisk");
  durable.registry.finishTool(runId, tool.toolCallId, "succeeded");
  durable.registry.finishRun(runId, "completed");
  await durable.claimOwner(runId, OWNER);

  assert.deepEqual(store.events, durable.registry.getEventsAfter(runId));
  assert.deepEqual(store.events.map(({ sequence }) => sequence), [1, 2, 3, 4]);
  assert.equal(store.heads.length, 1);
  assert.deepEqual(store.heads[0], {
    runId,
    ownerSessionId: OWNER,
    status: "completed",
    lastSequence: 4,
    createdAt: store.events[0].occurredAt,
  });
  assert.equal(await durable.ownerOf(runId), OWNER);
});

test("write-through registry keeps the head in step with events added after the owner is known", async () => {
  const store = recordingStore();
  const durable = createWriteThroughTraceRegistry({ registry: createTraceRegistry(), store, log: () => {} });
  const runId = durable.registry.startRun();
  await durable.claimOwner(runId, OWNER);
  const tool = durable.registry.startTool(runId, "getConditions");
  durable.registry.finishTool(runId, tool.toolCallId, "failed", "TOOL_ERROR");
  durable.registry.finishRun(runId, "failed");
  await durable.flush(runId);

  assert.deepEqual(store.heads.map(({ status, lastSequence }) => [status, lastSequence]), [
    ["running", 1],
    ["running", 2],
    ["running", 3],
    ["failed", 4],
  ]);
});

test("a Firestore failure during write-through leaves the run working and logs no content", async () => {
  const logged = [];
  const store = recordingStore({ failOn: (kind, value) => kind === "event" && value.sequence === 2 });
  const durable = createWriteThroughTraceRegistry({ registry: createTraceRegistry(), store, log: (record) => logged.push(record) });
  const runId = durable.registry.startRun();
  const tool = durable.registry.startTool(runId, "extractOrder");
  const finished = durable.registry.finishTool(runId, tool.toolCallId, "succeeded");
  durable.registry.finishRun(runId, "completed");
  await durable.claimOwner(runId, OWNER);

  assert.equal(finished.sequence, 3);
  assert.equal(durable.registry.getRun(runId).status, "completed");
  assert.deepEqual(store.events.map(({ sequence }) => sequence), [1], "later events are not written past a gap");
  assert.deepEqual(store.heads.map(({ status, lastSequence }) => [status, lastSequence]), [["incomplete", 1]],
    "the only head written says the stored copy ends at the gap");
  assert.deepEqual(logged, [{ event: "trace_store_write_failed", operation: "event", code: "SERVICE_UNAVAILABLE" }]);
  assert.doesNotMatch(JSON.stringify(logged), new RegExp(runId));
  assert.equal(await durable.ownerOf(runId), OWNER, "the instance that ran the trace still knows its owner");
});

test("a second instance reads the owner from the shared store and an unknown run has none", async () => {
  const store = recordingStore();
  const first = createWriteThroughTraceRegistry({ registry: createTraceRegistry(), store, log: () => {} });
  const second = createWriteThroughTraceRegistry({ registry: createTraceRegistry(), store, log: () => {} });
  const runId = first.registry.startRun();
  first.registry.finishRun(runId, "cancelled");
  await first.claimOwner(runId, OWNER);

  assert.equal(await second.ownerOf(runId), OWNER);
  assert.equal(await second.ownerOf("8a2ff660-17a9-493a-8a70-703ef8952bb1"), null);
  await second.claimOwner(runId, "d".repeat(32));
  assert.equal(store.heads.length, 1, "an instance that did not run the trace writes no head");
  assert.equal(await first.ownerOf(runId), OWNER);
});

test("durable traces stay off unless the flag is exactly true", () => {
  const registry = createTraceRegistry();
  let created = 0;
  const createStore = () => {
    created += 1;
    return recordingStore();
  };
  for (const value of [undefined, "", "false", "TRUE", "1"]) {
    const configured = configureDurableTraces({ env: { USTAAD_ENABLE_DURABLE_TRACES: value }, registry, createStore });
    assert.equal(configured.registry, registry);
    assert.equal(configured.store, undefined);
    assert.equal(configured.claimOwner, undefined);
    assert.equal(configured.ownerOf, undefined);
  }
  assert.equal(created, 0);

  const enabled = configureDurableTraces({ env: { USTAAD_ENABLE_DURABLE_TRACES: "true" }, registry, createStore });
  assert.equal(created, 1);
  assert.notEqual(enabled.registry, registry);
  assert.equal(typeof enabled.claimOwner, "function");
  assert.equal(typeof enabled.ownerOf, "function");
});

test("a run whose event write failed before the owner was known gets an incomplete head on claim", async () => {
  const store = recordingStore({ failOn: (kind, value) => kind === "event" && value.sequence === 2 });
  const durable = createWriteThroughTraceRegistry({ registry: createTraceRegistry(), store, log: () => {} });
  const runId = durable.registry.startRun();
  const tool = durable.registry.startTool(runId, "extractOrder");
  durable.registry.finishTool(runId, tool.toolCallId, "succeeded");
  durable.registry.finishRun(runId, "completed");
  await durable.flush(runId);
  await durable.claimOwner(runId, OWNER);

  assert.deepEqual(store.heads, [{
    runId,
    ownerSessionId: OWNER,
    status: "incomplete",
    lastSequence: 1,
    createdAt: store.events[0].occurredAt,
  }]);
});

test("a run whose event write fails after the owner is known has its head marked incomplete", async () => {
  const store = recordingStore({ failOn: (kind, value) => kind === "event" && value.sequence === 3 });
  const logged = [];
  const durable = createWriteThroughTraceRegistry({ registry: createTraceRegistry(), store, log: (record) => logged.push(record) });
  const runId = durable.registry.startRun();
  await durable.claimOwner(runId, OWNER);
  const tool = durable.registry.startTool(runId, "getConditions");
  durable.registry.finishTool(runId, tool.toolCallId, "succeeded");
  durable.registry.finishRun(runId, "completed");
  await durable.flush(runId);

  assert.deepEqual(store.heads.map(({ status, lastSequence }) => [status, lastSequence]), [
    ["running", 1],
    ["running", 2],
    ["incomplete", 2],
  ]);
  assert.deepEqual(store.events.map(({ sequence }) => sequence), [1, 2]);
  assert.deepEqual(logged, [{ event: "trace_store_write_failed", operation: "event", code: "SERVICE_UNAVAILABLE" }]);
});

test("when the incomplete head cannot be written either, both failures are logged and the run still works", async () => {
  const store = recordingStore({ failOn: (kind, value) => (kind === "event" && value.sequence === 2) ||
    (kind === "head" && value.status === "incomplete") });
  const logged = [];
  const durable = createWriteThroughTraceRegistry({ registry: createTraceRegistry(), store, log: (record) => logged.push(record) });
  const runId = durable.registry.startRun();
  await durable.claimOwner(runId, OWNER);
  durable.registry.finishRun(runId, "failed");
  await durable.flush(runId);

  assert.equal(durable.registry.getRun(runId).status, "failed");
  assert.deepEqual(store.heads.map(({ status }) => status), ["running"]);
  assert.deepEqual(logged, [
    { event: "trace_store_write_failed", operation: "event", code: "SERVICE_UNAVAILABLE" },
    { event: "trace_store_write_failed", operation: "head", code: "SERVICE_UNAVAILABLE" },
  ]);
});
