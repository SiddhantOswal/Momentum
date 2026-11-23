import assert from "node:assert/strict";
import test from "node:test";
import { approveJob } from "../src/commands/approve-job.js";
import { createFirestoreLotStore } from "../src/google-cloud/firestore-lot-store.js";
import { FirestoreRestError, fromFirestoreFields } from "../src/google-cloud/firestore-rest.js";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";

const sessionId = "a".repeat(32);
const lotId = `LOT-HACK-${sessionId}-${"b".repeat(12)}`;
const jobOne = `JOB-HACK-${sessionId}-${"1".repeat(40)}`;
const jobTwo = `JOB-HACK-${sessionId}-${"2".repeat(40)}`;
const fingerprintOne = "c".repeat(64);
const fingerprintTwo = "d".repeat(64);
const DOCS = "projects/prepagent-hack/databases/(default)/documents";
const moisture = (value) => ({
  field: "paperMoisturePct", value, unit: "%", provenance: "operator_entry", sourceDetail: "typed",
  label: "Entered by operator", confirmed: false,
});

function setup({ enforceGuard = true, approve, failReads = false, withStore = true } = {}) {
  const firestore = fakeFirestore({ failReads });
  const store = createFirestoreLotStore({
    projectId: "prepagent-hack", fetchImpl: firestore.fetchImpl, tokenProvider: async () => "token",
  });
  const calls = [];
  const logs = [];
  const deps = {
    principal: undefined,
    signal: undefined,
    servicePorts: {
      approveJob: async (request) => {
        calls.push(request);
        return approve ? approve(request) : { ok: true, jobSheet: { jobId: request.jobId, status: "APPROVED", order: { itemCode: "SKU" } } };
      },
    },
    liveStore: { publish: async () => {} },
    executionMode: "demo",
    newCorrelationId: () => "corr-test",
    now: Date.now,
    log: (line) => logs.push(line),
    lotRevisions: { enabled: true, enforceGuard, store: withStore ? store : undefined },
  };
  const read = (collection, id) => {
    const doc = firestore.docs.get(`${DOCS}/${collection}/${id}`);
    return doc ? fromFirestoreFields(doc.fields) : undefined;
  };
  const planned = async (job = jobOne, fingerprint = fingerprintOne, value = 8.5) => {
    await store.registerPending({ lotId, ownerSessionId: sessionId, jobId: job, requestFingerprint: "e".repeat(64), conditions: [moisture(value)] });
    await store.makeCurrent({ lotId, jobId: job, revisionFingerprint: fingerprint });
  };
  const approve_ = (body, job = jobOne, overrides = {}) => approveJob({ jobId: job, lang: "en", currency: "INR", body }, { ...deps, ...overrides });
  return { firestore, store, calls, logs, deps, read, planned, approve: approve_ };
}

const valid = { reviewConfirmed: true, revisionFingerprint: fingerprintOne };

test("with the guard off the body is ignored and approval behaves as before", async () => {
  const context = setup({ enforceGuard: false });
  for (const body of [undefined, {}, { reviewConfirmed: false }, "nonsense"]) {
    const result = await context.approve(body);
    assert.equal(result.ok, true);
  }
  assert.equal(context.calls.length, 4);
  assert.equal(context.firestore.calls.length, 0);
});

test("a missing or false confirmation is a 400 and never reaches approval", async () => {
  const context = setup();
  await context.planned();
  for (const body of [undefined, null, "yes", [], {}, { revisionFingerprint: fingerprintOne },
    { reviewConfirmed: false, revisionFingerprint: fingerprintOne },
    { reviewConfirmed: "true", revisionFingerprint: fingerprintOne },
    { reviewConfirmed: 1, revisionFingerprint: fingerprintOne }]) {
    const result = await context.approve(body);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.status, 400);
    assert.equal(result.error.code, "REVIEW_CONFIRMATION_REQUIRED");
  }
  assert.equal(context.calls.length, 0);
  assert.equal(context.read("lot_revisions", jobOne).status, "CURRENT");
});

test("a confirmation without a well-formed fingerprint, or with extra keys, is a validation error", async () => {
  const context = setup();
  await context.planned();
  for (const body of [
    { reviewConfirmed: true },
    { reviewConfirmed: true, revisionFingerprint: "abc" },
    { reviewConfirmed: true, revisionFingerprint: fingerprintOne.toUpperCase() },
    { reviewConfirmed: true, revisionFingerprint: fingerprintOne, approvedBy: "someone" },
  ]) {
    const result = await context.approve(body);
    assert.equal(result.error.code, "VALIDATION_ERROR", JSON.stringify(body));
  }
  assert.equal(context.calls.length, 0);
});

test("an unregistered draft is refused with 409 REVISION_NOT_REGISTERED", async () => {
  const context = setup();
  const result = await context.approve(valid);
  assert.equal(result.status, 409);
  assert.equal(result.error.code, "REVISION_NOT_REGISTERED");
  assert.equal(context.calls.length, 0);
});

test("a superseded revision returns 409 REVISION_SUPERSEDED with the current revision", async () => {
  const context = setup();
  await context.planned();
  await context.planned(jobTwo, fingerprintTwo, 10.8);
  const result = await context.approve(valid);
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(result.error.code, "REVISION_SUPERSEDED");
  assert.equal(result.error.currentJobId, jobTwo);
  assert.equal(result.error.currentRevision, 2);
  assert.equal(context.calls.length, 0);
  assert.equal(context.read("lot_revisions", jobOne).status, "SUPERSEDED");
});

test("a stale fingerprint on a current revision returns 409 and leaves it approvable", async () => {
  const context = setup();
  await context.planned();
  const result = await context.approve({ reviewConfirmed: true, revisionFingerprint: fingerprintTwo });
  assert.equal(result.status, 409);
  assert.equal(result.error.code, "REVISION_FINGERPRINT_MISMATCH");
  assert.equal(context.calls.length, 0);
  assert.equal(context.read("lot_revisions", jobOne).status, "CURRENT");
});

test("a valid approval runs the unchanged approval once and records APPROVED", async () => {
  const context = setup();
  await context.planned();
  const result = await context.approve(valid);
  assert.equal(result.ok, true);
  assert.equal(context.calls.length, 1);
  assert.equal(context.calls[0].jobId, jobOne);
  assert.equal(context.read("lot_revisions", jobOne).status, "APPROVED");
  assert.equal(context.read("lot_heads", lotId).stage, "approved");
});

test("an approval that fails returns the revision to CURRENT so it can be tried again", async () => {
  const context = setup({ approve: async () => ({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Storage down." } }) });
  await context.planned();
  const result = await context.approve(valid);
  assert.equal(result.ok, false);
  assert.equal(context.read("lot_revisions", jobOne).status, "CURRENT");
  assert.equal(context.read("lot_revisions", jobOne).approvingLeaseExpiresAt, null);
});

test("an approval that throws returns the revision to CURRENT and rethrows", async () => {
  const context = setup({ approve: async () => { throw new Error("boom"); } });
  await context.planned();
  await assert.rejects(context.approve(valid), { message: "boom" });
  assert.equal(context.read("lot_revisions", jobOne).status, "CURRENT");
});

test("a second approval while one is in progress is refused with 409 APPROVAL_IN_PROGRESS", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const context = setup({ approve: async (request) => { await gate; return { ok: true, jobSheet: { jobId: request.jobId, status: "APPROVED", order: {} } }; } });
  await context.planned();
  const first = context.approve(valid);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const second = await context.approve(valid);
  assert.equal(second.status, 409);
  assert.equal(second.error.code, "APPROVAL_IN_PROGRESS");
  release();
  assert.equal((await first).ok, true);
  assert.equal(context.calls.length, 1);
});

test("an approved revision passes the guard again and returns the stored result through the unchanged path", async () => {
  const context = setup();
  await context.planned();
  await context.approve(valid);
  const again = await context.approve(valid);
  assert.equal(again.ok, true);
  assert.equal(context.calls.length, 2);
  assert.equal(context.read("lot_revisions", jobOne).status, "APPROVED");
});

test("a Firestore outage or a missing store fails closed with 503 and approves nothing", async () => {
  const down = setup({ failReads: true });
  const outage = await down.approve(valid);
  assert.equal(outage.status, 503);
  assert.equal(outage.error.code, "SERVICE_UNAVAILABLE");
  const missing = setup({ withStore: false });
  const noStore = await missing.approve(valid);
  assert.equal(noStore.status, 503);
  assert.equal(down.calls.length + missing.calls.length, 0);
});

test("an approver without the role is refused before the guard reads anything", async () => {
  const context = setup();
  const result = await context.approve(valid, jobOne, {
    userSessionAuth: { configured: true }, principal: { uid: "viewer", role: "viewer" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(context.firestore.calls.length, 0);
});

test("a failure to record APPROVED is logged without hiding the approval", async () => {
  const context = setup();
  await context.planned();
  const lotRevisions = {
    ...context.deps.lotRevisions,
    store: { ...context.deps.lotRevisions.store, finishApproval: async () => { throw new FirestoreRestError("SERVICE_UNAVAILABLE", "down"); } },
  };
  const result = await context.approve(valid, jobOne, { lotRevisions });
  assert.equal(result.ok, true);
  assert.match(context.logs.join("\n"), /ustaad_revision_state_not_recorded/);
});
