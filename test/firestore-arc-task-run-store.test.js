import assert from "node:assert/strict";
import test from "node:test";
import { createFirestoreArcTaskRunStore } from "../src/google-cloud/firestore-arc-task-run-store.js";
import { createFakeFirestore, FAKE_PROJECT_ID } from "./fixtures/fake-firestore.js";

const SID = "a".repeat(32);
const RUN_ID = "b1c2d3e4-f5a6-4b7c-8d9e-0a1b2c3d4e5f";
const NOW = Date.parse("2026-11-24T09:00:00.000Z");

function storeOver(fake, options = {}) {
  return createFirestoreArcTaskRunStore({
    projectId: FAKE_PROJECT_ID,
    fetchImpl: fake.fetchImpl,
    tokenProvider: async () => "fake-access-token",
    now: () => NOW,
    ...options,
  });
}

function step(overrides = {}) {
  return {
    stepId: "read_order", tool: "read_order", status: "PENDING", argsHash: null, idempotencyKey: null,
    attempt: 0, leaseOwner: null, leaseExpiresAt: null, resultRef: null, waitingFor: null, errorCode: null,
    startedAt: null, finishedAt: null, ...overrides,
  };
}

function newRun(overrides = {}) {
  return { taskRunId: RUN_ID, sessionId: SID, kind: "lot_preparation", lotId: null, status: "RUNNING", steps: [step()], ...overrides };
}

test("create stores a run with a 30 day expiry and version 0", async () => {
  const fake = createFakeFirestore();
  const run = await storeOver(fake).create(newRun());
  assert.equal(run.version, 0);
  assert.equal(run.createdAt, "2026-11-24T09:00:00.000Z");
  const stored = fake.documents.get(`arc_task_runs/${RUN_ID}`).fields;
  assert.equal(stored.expiresAt.timestampValue, "2026-12-24T09:00:00.000Z");
  assert.equal(stored.sessionId.stringValue, SID);
});

test("create never replaces an existing run", async () => {
  const fake = createFakeFirestore();
  const store = storeOver(fake);
  await store.create(newRun());
  assert.deepEqual(await store.create(newRun({ kind: "data_question" })), null);
  assert.equal((await store.get(RUN_ID)).kind, "lot_preparation");
});

test("create refuses a run that breaks its schema, such as a waiting step without waitingFor", async () => {
  const fake = createFakeFirestore();
  await assert.rejects(
    storeOver(fake).create(newRun({ steps: [step({ status: "WAITING_FOR_USER" })] })),
    { code: "SERVICE_UNAVAILABLE" },
  );
  assert.equal(fake.documents.size, 0);
});

test("get returns the run, null for an unknown or malformed ID, and null once past its expiry", async () => {
  const fake = createFakeFirestore();
  const clock = { now: NOW };
  const store = storeOver(fake, { now: () => clock.now });
  await store.create(newRun());
  assert.equal((await store.get(RUN_ID)).taskRunId, RUN_ID);
  assert.equal(await store.get("c1c2d3e4-f5a6-4b7c-8d9e-0a1b2c3d4e5f"), null);
  assert.equal(await store.get("not-a-uuid"), null);
  clock.now += 31 * 24 * 60 * 60 * 1000;
  assert.equal(await store.get(RUN_ID), null);
});

test("save bumps the version and refuses a stale writer", async () => {
  const fake = createFakeFirestore();
  const store = storeOver(fake);
  const created = await store.create(newRun());
  const saved = await store.save({ ...created, steps: [step({ status: "RUNNING", startedAt: "2026-11-24T09:00:01.000Z" })] });
  assert.equal(saved.ok, true);
  assert.equal(saved.run.version, 1);
  const stale = await store.save({ ...created, status: "FAILED" });
  assert.deepEqual(stale, { ok: false, code: "VERSION_CONFLICT" });
  const stored = await store.get(RUN_ID);
  assert.equal(stored.status, "RUNNING");
  assert.equal(stored.steps[0].status, "RUNNING");
});

test("two instances saving the same version: one wins and the other is told to re-read", async () => {
  const fake = createFakeFirestore();
  const created = await storeOver(fake).create(newRun());
  const results = await Promise.all([
    storeOver(fake).save({ ...created, status: "WAITING_FOR_USER", steps: [step({ status: "WAITING_FOR_USER", waitingFor: "confirm_order" })] }),
    storeOver(fake).save({ ...created, status: "BLOCKED", steps: [step({ status: "BLOCKED", errorCode: "BUDGET_DAY_EXHAUSTED" })] }),
  ]);
  assert.deepEqual(results.map((result) => result.ok).sort(), [false, true]);
  assert.equal((await storeOver(fake).get(RUN_ID)).version, 1);
});

test("save cannot move a run to another session", async () => {
  const fake = createFakeFirestore();
  const store = storeOver(fake);
  const created = await store.create(newRun());
  const moved = await store.save({ ...created, sessionId: "c".repeat(32) });
  assert.deepEqual(moved, { ok: false, code: "SESSION_MISMATCH" });
  assert.equal((await store.get(RUN_ID)).sessionId, SID);
});

test("a Firestore fault is SERVICE_UNAVAILABLE, never an absent run", async () => {
  const down = createFakeFirestore({ failWhen: () => true });
  await assert.rejects(storeOver(down).get(RUN_ID), { code: "SERVICE_UNAVAILABLE" });
  const fake = createFakeFirestore();
  await storeOver(fake).create(newRun());
  fake.documents.get(`arc_task_runs/${RUN_ID}`).fields.kind = { stringValue: "unknown_kind" };
  await assert.rejects(storeOver(fake).get(RUN_ID), { code: "SERVICE_UNAVAILABLE" });
});
