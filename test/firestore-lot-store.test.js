import assert from "node:assert/strict";
import test from "node:test";
import { createFirestoreLotStore } from "../src/google-cloud/firestore-lot-store.js";
import { fromFirestoreFields } from "../src/google-cloud/firestore-rest.js";
import { LotHeadDocSchema, LotRevisionDocSchema } from "../src/state-schemas.js";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";

const sessionId = "a".repeat(32);
const lotId = `LOT-HACK-${sessionId}-${"b".repeat(12)}`;
const jobOne = `JOB-HACK-${sessionId}-${"1".repeat(40)}`;
const jobTwo = `JOB-HACK-${sessionId}-${"2".repeat(40)}`;
const fingerprintOne = "c".repeat(64);
const fingerprintTwo = "d".repeat(64);
const requestFingerprint = "e".repeat(64);
const NOW = Date.UTC(2026, 11, 4, 5, 0, 0);
const DOCS = "projects/prepagent-hack/databases/(default)/documents";

const value = (field, number, unit, sourceDetail = "typed") => ({
  field, value: number, unit, provenance: "operator_entry", sourceDetail,
  label: sourceDetail === "confirmed" ? "Confirmed by operator" : "Entered by operator",
  confirmed: sourceDetail === "confirmed", enteredByRole: "Supervisor session",
});
const moisture = (number) => value("paperMoisturePct", number, "%");
const humidity = (number) => value("ambientRhPct", number, "% RH");

function setup(options = {}) {
  const firestore = fakeFirestore(options);
  const clock = { now: NOW };
  const store = createFirestoreLotStore({
    projectId: "prepagent-hack",
    fetchImpl: firestore.fetchImpl,
    tokenProvider: async () => "test-token",
    now: () => clock.now,
  });
  const read = (collection, id) => {
    const doc = firestore.docs.get(`${DOCS}/${collection}/${id}`);
    return doc ? fromFirestoreFields(doc.fields) : undefined;
  };
  const commits = () => firestore.calls.filter((call) => call.path.endsWith(":commit")).length;
  return { firestore, store, clock, read, commits };
}

async function planned(context, { job = jobOne, conditions = [moisture(8.5)], fingerprint = fingerprintOne } = {}) {
  const registered = await context.store.registerPending({
    lotId, ownerSessionId: sessionId, jobId: job, requestFingerprint, conditions,
  });
  await context.store.makeCurrent({ lotId, jobId: job, revisionFingerprint: fingerprint });
  return registered;
}

test("saving conditions creates the lot head and writes documents that match their schemas", async () => {
  const context = setup();
  const saved = await context.store.saveConditions({
    lotId, ownerSessionId: sessionId, conditions: [moisture(8.5)], byRole: "Supervisor session",
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.superseded, null);
  const head = LotHeadDocSchema.parse(context.read("lot_heads", lotId));
  assert.equal(head.currentRevision, 0);
  assert.equal(head.currentJobId, null);
  assert.equal(head.stage, "conditions");
  assert.equal(head.version, 0);
  assert.deepEqual(head.draftConditions.map((entry) => entry.value), [8.5]);
  assert.equal(Date.parse(head.expiresAt) - NOW, 30 * 24 * 60 * 60 * 1000);
});

test("a second save replaces the draft conditions and bumps the head version", async () => {
  const context = setup();
  const base = { lotId, ownerSessionId: sessionId, byRole: "Supervisor session" };
  await context.store.saveConditions({ ...base, conditions: [moisture(8.5)] });
  await context.store.saveConditions({ ...base, conditions: [moisture(9), humidity(60)] });
  const head = context.read("lot_heads", lotId);
  assert.equal(head.version, 1);
  assert.deepEqual(head.draftConditions.map((entry) => entry.field), ["paperMoisturePct", "ambientRhPct"]);
});

test("another session cannot save to an existing lot", async () => {
  const context = setup();
  await context.store.saveConditions({ lotId, ownerSessionId: sessionId, conditions: [moisture(8.5)], byRole: "Supervisor session" });
  const stranger = await context.store.saveConditions({
    lotId, ownerSessionId: "f".repeat(32), conditions: [moisture(9)], byRole: "Supervisor session",
  });
  assert.deepEqual(stranger, { ok: false, code: "LOT_OWNER_MISMATCH" });
  assert.equal(context.read("lot_heads", lotId).draftConditions[0].value, 8.5);
});

test("registering a revision numbers it from the head and a retry reuses the pending record", async () => {
  const context = setup();
  const first = await context.store.registerPending({
    lotId, ownerSessionId: sessionId, jobId: jobOne, requestFingerprint, conditions: [moisture(8.5)],
  });
  assert.equal(first.revision.number, 1);
  assert.equal(first.revision.status, "PENDING");
  assert.equal(first.revision.revisionFingerprint, null);
  const retry = await context.store.registerPending({
    lotId, ownerSessionId: sessionId, jobId: jobOne, requestFingerprint, conditions: [moisture(8.5)],
  });
  assert.equal(retry.revision.number, 1);
  assert.equal(retry.reused, true);
  assert.equal(context.read("lot_heads", lotId).currentRevision, 1);
  const second = await context.store.registerPending({
    lotId, ownerSessionId: sessionId, jobId: jobTwo, requestFingerprint, conditions: [moisture(10)],
  });
  assert.equal(second.revision.number, 2);
  const stored = LotRevisionDocSchema.parse(context.read("lot_revisions", jobOne));
  assert.equal(Date.parse(stored.expiresAt) - Date.parse(stored.createdAt), 180 * 24 * 60 * 60 * 1000);
});

test("a retry of a failed plan makes the same revision PENDING again", async () => {
  const context = setup();
  const args = { lotId, ownerSessionId: sessionId, jobId: jobOne, requestFingerprint, conditions: [moisture(8.5)] };
  await context.store.registerPending(args);
  await context.store.markFailed({ lotId, jobId: jobOne });
  const retry = await context.store.registerPending(args);
  assert.equal(retry.reused, true);
  assert.equal(retry.revision.status, "PENDING");
  assert.equal(retry.revision.number, 1);
  assert.equal(context.read("lot_revisions", jobOne).status, "PENDING");
});

test("a retry with another request fingerprint for the same job is refused", async () => {
  const context = setup();
  await context.store.registerPending({ lotId, ownerSessionId: sessionId, jobId: jobOne, requestFingerprint, conditions: [moisture(8.5)] });
  const result = await context.store.registerPending({
    lotId, ownerSessionId: sessionId, jobId: jobOne, requestFingerprint: "9".repeat(64), conditions: [moisture(8.5)],
  });
  assert.deepEqual(result, { ok: false, code: "REVISION_CONFLICT" });
});

test("making a revision current supersedes the previous current one in the same commit", async () => {
  const context = setup();
  await planned(context);
  await context.store.registerPending({ lotId, ownerSessionId: sessionId, jobId: jobTwo, requestFingerprint, conditions: [moisture(10)] });
  const before = context.commits();
  const made = await context.store.makeCurrent({ lotId, jobId: jobTwo, revisionFingerprint: fingerprintTwo });
  assert.equal(made.ok, true);
  assert.equal(context.commits() - before, 1);
  assert.equal(context.read("lot_revisions", jobOne).status, "SUPERSEDED");
  assert.equal(context.read("lot_revisions", jobOne).supersededBy, jobTwo);
  const current = context.read("lot_revisions", jobTwo);
  assert.equal(current.status, "CURRENT");
  assert.equal(current.revisionFingerprint, fingerprintTwo);
  const head = context.read("lot_heads", lotId);
  assert.equal(head.currentJobId, jobTwo);
  assert.equal(head.stage, "draft_review");
});

test("making a revision current twice is a replay, and only a pending revision can become current", async () => {
  const context = setup();
  await planned(context);
  const replay = await context.store.makeCurrent({ lotId, jobId: jobOne, revisionFingerprint: fingerprintOne });
  assert.equal(replay.ok, true);
  const other = await context.store.makeCurrent({ lotId, jobId: jobOne, revisionFingerprint: fingerprintTwo });
  assert.deepEqual(other, { ok: false, code: "REVISION_CONFLICT" });
  const missing = await context.store.makeCurrent({ lotId, jobId: jobTwo, revisionFingerprint: fingerprintTwo });
  assert.deepEqual(missing, { ok: false, code: "REVISION_NOT_REGISTERED" });
});

test("a failed plan marks its pending revision FAILED and never replaces the current one", async () => {
  const context = setup();
  await planned(context);
  await context.store.registerPending({ lotId, ownerSessionId: sessionId, jobId: jobTwo, requestFingerprint, conditions: [moisture(10)] });
  await context.store.markFailed({ lotId, jobId: jobTwo });
  assert.equal(context.read("lot_revisions", jobTwo).status, "FAILED");
  assert.equal(context.read("lot_revisions", jobOne).status, "CURRENT");
  assert.equal(context.read("lot_heads", lotId).currentJobId, jobOne);
});

test("a changed condition supersedes the current draft in one commit and records what changed", async () => {
  const context = setup();
  await planned(context);
  const before = context.commits();
  const saved = await context.store.saveConditions({
    lotId, ownerSessionId: sessionId, conditions: [moisture(10.8)], byRole: "Supervisor session",
  });
  assert.equal(context.commits() - before, 1);
  assert.equal(saved.ok, true);
  assert.equal(saved.superseded.jobId, jobOne);
  assert.equal(saved.superseded.number, 1);
  const revision = context.read("lot_revisions", jobOne);
  assert.equal(revision.status, "SUPERSEDED");
  assert.equal(revision.supersededBy, null);
  assert.deepEqual(revision.supersededReason, {
    field: "paperMoisturePct", from: 8.5, to: 10.8, provenance: "operator_entry", byRole: "Supervisor session",
  });
  assert.equal(revision.conditions[0].value, 8.5);
  assert.equal(context.read("lot_heads", lotId).draftConditions[0].value, 10.8);
});

test("saving the same values again leaves the current draft in place", async () => {
  const context = setup();
  await planned(context);
  const saved = await context.store.saveConditions({
    lotId, ownerSessionId: sessionId, conditions: [moisture(8.5)], byRole: "Supervisor session",
  });
  assert.equal(saved.superseded, null);
  assert.equal(context.read("lot_revisions", jobOne).status, "CURRENT");
});

test("a source or label change with the same value does not supersede", async () => {
  const context = setup();
  await planned(context);
  const saved = await context.store.saveConditions({
    lotId, ownerSessionId: sessionId, conditions: [value("paperMoisturePct", 8.5, "%", "confirmed")], byRole: "Supervisor session",
  });
  assert.equal(saved.superseded, null);
  assert.equal(context.read("lot_revisions", jobOne).status, "CURRENT");
});

test("a condition added after planning supersedes the draft", async () => {
  const context = setup();
  await planned(context);
  const saved = await context.store.saveConditions({
    lotId, ownerSessionId: sessionId, conditions: [moisture(8.5), humidity(70)], byRole: "Supervisor session",
  });
  assert.equal(saved.superseded.reason.field, "ambientRhPct");
  assert.equal(saved.superseded.reason.from, "not set");
  assert.equal(context.read("lot_revisions", jobOne).status, "SUPERSEDED");
});

test("an edit cannot supersede a revision that is being approved", async () => {
  const context = setup();
  await planned(context);
  await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne });
  const before = structuredClone(context.read("lot_heads", lotId));
  const saved = await context.store.saveConditions({
    lotId, ownerSessionId: sessionId, conditions: [moisture(10.8)], byRole: "Supervisor session",
  });
  assert.deepEqual(saved, { ok: false, code: "APPROVAL_IN_PROGRESS" });
  assert.equal(context.read("lot_revisions", jobOne).status, "APPROVING");
  assert.deepEqual(context.read("lot_heads", lotId), before);
});

test("an approved revision stays approved when conditions change afterwards", async () => {
  const context = setup();
  await planned(context);
  await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne });
  await context.store.finishApproval({ jobId: jobOne, approved: true });
  const saved = await context.store.saveConditions({
    lotId, ownerSessionId: sessionId, conditions: [moisture(10.8)], byRole: "Supervisor session",
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.superseded, null);
  assert.equal(context.read("lot_revisions", jobOne).status, "APPROVED");
});

test("two saves racing to create one head both land, the loser after a retry", async () => {
  const context = setup({ commitBarrier: 2 });
  const results = await Promise.all([
    context.store.saveConditions({ lotId, ownerSessionId: sessionId, conditions: [moisture(9)], byRole: "Supervisor session" }),
    context.store.saveConditions({ lotId, ownerSessionId: sessionId, conditions: [moisture(9.5)], byRole: "Supervisor session" }),
  ]);
  assert.deepEqual(results.map((result) => result.ok), [true, true]);
  assert.equal(context.read("lot_heads", lotId).version, 1);
  assert.equal(context.commits(), 3);
});

test("getLot returns the head and its current revision, and nothing for another session", async () => {
  const context = setup();
  assert.equal(await context.store.getLot({ lotId, ownerSessionId: sessionId }), null);
  await planned(context);
  const lot = await context.store.getLot({ lotId, ownerSessionId: sessionId });
  assert.equal(lot.head.currentJobId, jobOne);
  assert.equal(lot.revision.status, "CURRENT");
  assert.equal(await context.store.getLot({ lotId, ownerSessionId: "f".repeat(32) }), null);
});

test("an approval is refused for an unregistered, pending or failed revision", async () => {
  const context = setup();
  const missing = await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne });
  assert.deepEqual(missing, { ok: false, code: "REVISION_NOT_REGISTERED" });
  await context.store.registerPending({ lotId, ownerSessionId: sessionId, jobId: jobOne, requestFingerprint, conditions: [moisture(8.5)] });
  assert.deepEqual(await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne }),
    { ok: false, code: "REVISION_NOT_REGISTERED" });
  await context.store.markFailed({ lotId, jobId: jobOne });
  assert.deepEqual(await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne }),
    { ok: false, code: "REVISION_NOT_REGISTERED" });
});

test("a superseded revision is refused and names the current one", async () => {
  const context = setup();
  await planned(context);
  await context.store.registerPending({ lotId, ownerSessionId: sessionId, jobId: jobTwo, requestFingerprint, conditions: [moisture(10)] });
  await context.store.makeCurrent({ lotId, jobId: jobTwo, revisionFingerprint: fingerprintTwo });
  const refused = await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne });
  assert.deepEqual(refused, { ok: false, code: "REVISION_SUPERSEDED", currentJobId: jobTwo, currentRevision: 2 });
  assert.equal(context.read("lot_revisions", jobOne).status, "SUPERSEDED");
});

test("a revision superseded by an edit is refused before any re-plan", async () => {
  const context = setup();
  await planned(context);
  await context.store.saveConditions({ lotId, ownerSessionId: sessionId, conditions: [moisture(10.8)], byRole: "Supervisor session" });
  const refused = await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne });
  assert.equal(refused.code, "REVISION_SUPERSEDED");
  assert.equal(refused.currentJobId, null);
});

test("a stale or wrong fingerprint is refused and leaves the revision current", async () => {
  const context = setup();
  await planned(context);
  const refused = await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintTwo });
  assert.deepEqual(refused, { ok: false, code: "REVISION_FINGERPRINT_MISMATCH" });
  assert.equal(context.read("lot_revisions", jobOne).status, "CURRENT");
});

test("a current revision the head no longer points at is refused as a mismatch", async () => {
  const context = setup();
  await planned(context);
  const key = `${DOCS}/lot_heads/${lotId}`;
  const head = context.firestore.docs.get(key);
  head.fields.currentJobId = { stringValue: jobTwo };
  const refused = await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne });
  assert.deepEqual(refused, { ok: false, code: "REVISION_FINGERPRINT_MISMATCH" });
});

test("a valid approval moves to APPROVING with a 130 second lease, and a second caller waits", async () => {
  const context = setup();
  await planned(context);
  const begun = await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne });
  assert.deepEqual(begun, { ok: true, alreadyApproved: false });
  const revision = context.read("lot_revisions", jobOne);
  assert.equal(revision.status, "APPROVING");
  assert.equal(Date.parse(revision.approvingLeaseExpiresAt), NOW + 130_000);
  assert.deepEqual(await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne }),
    { ok: false, code: "APPROVAL_IN_PROGRESS" });
});

test("an expired approval lease can be taken over", async () => {
  const context = setup();
  await planned(context);
  await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne });
  context.clock.now = NOW + 131_000;
  const again = await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne });
  assert.equal(again.ok, true);
  assert.equal(Date.parse(context.read("lot_revisions", jobOne).approvingLeaseExpiresAt), NOW + 131_000 + 130_000);
});

test("finishing an approval records APPROVED or returns the revision to CURRENT", async () => {
  const context = setup();
  await planned(context);
  await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne });
  await context.store.finishApproval({ jobId: jobOne, approved: false });
  const reverted = context.read("lot_revisions", jobOne);
  assert.equal(reverted.status, "CURRENT");
  assert.equal(reverted.approvingLeaseExpiresAt, null);
  await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne });
  await context.store.finishApproval({ jobId: jobOne, approved: true });
  const approved = context.read("lot_revisions", jobOne);
  assert.equal(approved.status, "APPROVED");
  assert.equal(Date.parse(approved.approvedAt), NOW);
  assert.equal(context.read("lot_heads", lotId).stage, "approved");
});

test("an approved revision passes the guard again so the stored result can be returned", async () => {
  const context = setup();
  await planned(context);
  await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne });
  await context.store.finishApproval({ jobId: jobOne, approved: true });
  assert.deepEqual(await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne }),
    { ok: true, alreadyApproved: true });
  assert.deepEqual(await context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintTwo }),
    { ok: false, code: "REVISION_FINGERPRINT_MISMATCH" });
});

test("a Firestore outage fails closed with SERVICE_UNAVAILABLE", async () => {
  const context = setup({ failReads: true });
  await assert.rejects(
    context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne }),
    { code: "SERVICE_UNAVAILABLE" },
  );
  await assert.rejects(
    context.store.saveConditions({ lotId, ownerSessionId: sessionId, conditions: [moisture(8.5)], byRole: "Supervisor session" }),
    { code: "SERVICE_UNAVAILABLE" },
  );
});

test("a stored document that fails its schema is a fault, never an absent revision", async () => {
  const context = setup();
  await planned(context);
  context.firestore.docs.get(`${DOCS}/lot_revisions/${jobOne}`).fields.status = { stringValue: "BOGUS" };
  await assert.rejects(
    context.store.beginApproval({ jobId: jobOne, revisionFingerprint: fingerprintOne }),
    { code: "SERVICE_UNAVAILABLE" },
  );
});

test("inputs are validated before any request is made", async () => {
  const context = setup();
  await assert.rejects(context.store.saveConditions({ lotId: "LOT-1", ownerSessionId: sessionId, conditions: [], byRole: "Supervisor session" }), TypeError);
  await assert.rejects(context.store.beginApproval({ jobId: jobOne, revisionFingerprint: "short" }), TypeError);
  assert.equal(context.firestore.calls.length, 0);
});
