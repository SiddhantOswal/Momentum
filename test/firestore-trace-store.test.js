import assert from "node:assert/strict";
import test from "node:test";
import { createFirestoreTraceStore } from "../src/google-cloud/firestore-trace-store.js";
import { FirestoreRestError } from "../src/google-cloud/firestore-rest.js";
import { createTraceRegistry } from "../src/trace-registry.js";
import { createFakeFirestore, FAKE_PROJECT_ID } from "./fixtures/fake-firestore.js";

const SESSION_ID = "a".repeat(32);
const NOW = Date.parse("2026-11-23T08:00:00.000Z");

function storeOver(fake, options = {}) {
  return createFirestoreTraceStore({
    projectId: FAKE_PROJECT_ID,
    fetchImpl: fake.fetchImpl,
    tokenProvider: async () => "fake-access-token",
    now: () => NOW,
    ...options,
  });
}

function finishedRun() {
  const registry = createTraceRegistry({ now: () => NOW });
  const runId = registry.startRun();
  const tool = registry.startTool(runId, "predictRisk");
  registry.finishTool(runId, tool.toolCallId, "succeeded");
  registry.finishRun(runId, "completed");
  return { runId, events: registry.getEventsAfter(runId) };
}

test("trace store writes events under trace_events and a second store reads them in order", async () => {
  const fake = createFakeFirestore();
  const { runId, events } = finishedRun();
  const writer = storeOver(fake);
  for (const event of events) await writer.appendEvent(event);
  await writer.writeHead({ runId, ownerSessionId: SESSION_ID, status: "completed", lastSequence: 4, createdAt: events[0].occurredAt });

  assert.deepEqual([...fake.documents.keys()].sort(), [
    `traces/${runId}`,
    ...[1, 2, 3, 4].map((sequence) => `traces/${runId}/trace_events/${sequence}`),
  ].sort());
  assert.equal([...fake.documents.keys()].some((path) => path.startsWith("events/") || path.includes("/events/")), false);
  const stored = fake.documents.get(`traces/${runId}/trace_events/2`).fields;
  assert.equal(stored.expiresAt.timestampValue, "2026-12-23T08:00:00.000Z");
  assert.equal(stored.occurredAt.stringValue, events[1].occurredAt);
  assert.equal(fake.calls.every((call) => call.authorization === "Bearer fake-access-token"), true);

  const reader = storeOver(fake);
  const head = await reader.readHead(runId);
  assert.equal(head.ownerSessionId, SESSION_ID);
  assert.equal(head.status, "completed");
  assert.equal(head.lastSequence, 4);
  assert.equal(head.kind, "job_preparation");
  assert.deepEqual(await reader.readEventsAfter(runId, 0), events);
  assert.deepEqual((await reader.readEventsAfter(runId, 2)).map(({ sequence }) => sequence), [3, 4]);
  assert.deepEqual(await reader.readEventsAfter(runId, 4), []);
});

test("trace store pages through events and keeps their sequence", async () => {
  const fake = createFakeFirestore();
  const { runId, events } = finishedRun();
  const store = storeOver(fake, { pageSize: 2 });
  for (const event of events) await store.appendEvent(event);
  assert.deepEqual((await store.readEventsAfter(runId, 1)).map(({ sequence }) => sequence), [2, 3, 4]);
  assert.equal(fake.calls.filter((call) => call.path.endsWith(":runQuery")).length, 2);
});

test("trace store asks Firestore for ascending sequence, whatever order the events were written in", async () => {
  const fake = createFakeFirestore();
  const { runId, events } = finishedRun();
  const store = storeOver(fake, { pageSize: 2 });
  for (const event of [...events].reverse()) await store.appendEvent(event);
  assert.deepEqual(await store.readEventsAfter(runId, 0), events);
  const queries = fake.calls.filter((call) => call.path.endsWith(":runQuery"));
  assert.equal(queries.length, 3);
  for (const { body } of queries) {
    assert.deepEqual(body.structuredQuery.orderBy, [{ field: { fieldPath: "sequence" }, direction: "ASCENDING" }]);
  }
});

test("trace store treats a repeated event write as already stored and never overwrites it", async () => {
  const fake = createFakeFirestore();
  const { events } = finishedRun();
  const store = storeOver(fake);
  await store.appendEvent(events[0]);
  const path = `traces/${events[0].runId}/trace_events/1`;
  const before = fake.documents.get(path);
  await store.appendEvent(events[0]);
  assert.equal(fake.documents.get(path), before);
  assert.equal(fake.calls.filter((call) => call.method === "PATCH" && call.path === path)
    .every((call) => call.search.includes("currentDocument.exists=false")), true);
});

test("trace store reports a missing run as absent and a damaged one as unavailable", async () => {
  const fake = createFakeFirestore();
  const { runId, events } = finishedRun();
  const store = storeOver(fake);
  assert.equal(await store.readHead(runId), null);
  assert.equal(await store.readHead("not-a-uuid"), null);
  assert.equal(fake.calls.some((call) => call.path.includes("not-a-uuid")), false);

  await store.writeHead({ runId, ownerSessionId: SESSION_ID, status: "running", lastSequence: 1, createdAt: events[0].occurredAt });
  fake.documents.get(`traces/${runId}`).fields.ownerSessionId = { stringValue: "not a session" };
  await assert.rejects(store.readHead(runId), (error) => error instanceof FirestoreRestError && error.code === "SERVICE_UNAVAILABLE");

  for (const event of events) await store.appendEvent(event);
  fake.documents.delete(`traces/${runId}/trace_events/2`);
  await assert.rejects(store.readEventsAfter(runId, 0), (error) => error.code === "SERVICE_UNAVAILABLE");
});

test("trace store validates before writing and maps transport failures", async () => {
  const { runId, events } = finishedRun();
  const quiet = createFakeFirestore();
  const store = storeOver(quiet);
  await assert.rejects(store.appendEvent({ ...events[0], message: "order text" }), (error) => error.code === "SERVICE_UNAVAILABLE");
  await assert.rejects(store.writeHead({ runId, ownerSessionId: "bad", status: "completed", lastSequence: 4, createdAt: events[0].occurredAt }),
    (error) => error.code === "SERVICE_UNAVAILABLE");
  assert.equal(quiet.calls.length, 0);

  const down = createFakeFirestore({ failWhen: () => true });
  await assert.rejects(storeOver(down).appendEvent(events[0]), (error) => error.code === "SERVICE_UNAVAILABLE");
  await assert.rejects(storeOver(down).readHead(runId), (error) => error.code === "SERVICE_UNAVAILABLE");

  const noIdentity = storeOver(quiet, { tokenProvider: async () => "" });
  await assert.rejects(noIdentity.readHead(runId), (error) => error.code === "CLOUD_IDENTITY_UNAVAILABLE");
  assert.throws(() => createFirestoreTraceStore({ projectId: "x", fetchImpl: quiet.fetchImpl }), TypeError);
});
