import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { planLot } from "../src/commands/plan-lot.js";
import { createFirestoreLotStore } from "../src/google-cloud/firestore-lot-store.js";
import { fromFirestoreFields } from "../src/google-cloud/firestore-rest.js";
import { createHackathonDemoAuthenticator } from "../src/hackathon-demo-auth.js";
import { revisionFingerprint } from "../src/revision-fingerprint.js";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";
import { jobSheetFixture } from "./fixtures/job-sheet.js";

const purchaseOrder = await readFile(new URL("./fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf", import.meta.url));
const authenticator = createHackathonDemoAuthenticator({
  mode: "HACKATHON_DEMO", signingKey: "a".repeat(64), syntheticOnly: true, auditEnabled: true,
});
const DOCS = "projects/prepagent-hack/databases/(default)/documents";

function jobFields(overrides = {}) {
  return {
    file: new File([purchaseOrder], "order.pdf", { type: "application/pdf" }),
    orderId: "TEST-PO-1", paperType: "VIRGIN", paperSupplier: "SUPPLIER-TEST",
    confirmedItemCode: "SKU-TEST-42", confirmedQuantity: "100", confirmedLineIndex: "1",
    shift: "DAY", runDate: "2026-10-15", ambientRhPct: "64", ambientTempC: "26", paperMoisturePct: "8.5",
    conditionsConfirmed: "true", sfSpeedMpm: "40", rollTempC: "165", gumApplication: "MED", gumViscositySec: "40",
    pastingPressure: "MED", dryingHours: "6", printSpeedSpm: "50",
    ...overrides,
  };
}

function setup({ enabled = true, failReads = false, submit } = {}) {
  const firestore = fakeFirestore({ failReads });
  const store = createFirestoreLotStore({
    projectId: "prepagent-hack", fetchImpl: firestore.fetchImpl, tokenProvider: async () => "token",
  });
  const principal = authenticator.authenticate(authenticator.issue()).principal;
  const seen = [];
  const read = (collection, id) => {
    const doc = firestore.docs.get(`${DOCS}/${collection}/${id}`);
    return doc ? fromFirestoreFields(doc.fields) : undefined;
  };
  const submitJob = async (input) => {
    seen.push(input);
    return submit
      ? submit(input, { read })
      : { ok: true, durable: true, jobSheet: { ...structuredClone(jobSheetFixture), jobId: input.identity.jobId } };
  };
  const deps = {
    principal, signal: new AbortController().signal, submitJob,
    liveStore: { publish: async () => {} },
    hackathonAuth: { enabled: true }, demoMode: false, executionMode: "offline",
    purchaseOrderPolicy: { acceptRealOrders: false, extractionAdapterConfigured: false, syntheticOnly: false },
    lotRevisions: { enabled, enforceGuard: false, store },
  };
  const plan = (fields = jobFields(), key = "plan-key-0001") => planLot({ fields, idempotencyKey: key }, deps);
  return { firestore, principal, seen, read, plan, deps };
}

test("planning registers a PENDING revision first and makes it CURRENT after the draft is stored", async () => {
  let pendingBeforeSubmit;
  const context = setup({
    submit: async (input, { read }) => {
      const lotId = `LOT-HACK-${context.principal.sessionId}-${input.identity.keyHash.slice(0, 12)}`;
      pendingBeforeSubmit = read("lot_revisions", input.identity.jobId)?.status;
      assert.equal(read("lot_heads", lotId)?.stage, "planning");
      return { ok: true, durable: true, jobSheet: { ...structuredClone(jobSheetFixture), jobId: input.identity.jobId } };
    },
  });
  const result = await context.plan();
  assert.equal(result.ok, true);
  assert.equal(pendingBeforeSubmit, "PENDING");
  const stored = context.read("lot_revisions", result.jobSheet.jobId);
  assert.equal(stored.status, "CURRENT");
  assert.equal(stored.number, 1);
  assert.deepEqual(result.revision, {
    lotId: stored.lotId, number: 1, fingerprint: stored.revisionFingerprint, status: "CURRENT",
  });
  assert.equal(stored.revisionFingerprint, revisionFingerprint({
    jobSheet: result.jobSheet, lotId: stored.lotId, number: 1, requestFingerprint: stored.requestFingerprint, conditions: stored.conditions,
  }));
  assert.deepEqual(stored.conditions.map((entry) => [entry.field, entry.value]), [
    ["runDate", "2026-10-15"], ["shift", "DAY"], ["ambientRhPct", 64], ["ambientTempC", 26], ["paperMoisturePct", 8.5],
  ]);
  assert.ok(stored.conditions.every((entry) => entry.provenance === "operator_entry" && entry.confirmed === true));
  assert.equal(context.read("lot_heads", stored.lotId).currentJobId, result.jobSheet.jobId);
});

test("a second plan for the same lot with a changed condition replaces Rev 1", async () => {
  const context = setup();
  const lotId = `LOT-HACK-${context.principal.sessionId}-${"c".repeat(12)}`;
  const first = await context.plan(jobFields({ lotId }), "key-rev-one-01");
  const second = await context.plan(jobFields({ lotId, paperMoisturePct: "10.8" }), "key-rev-two-01");
  assert.equal(first.ok && second.ok, true);
  assert.equal(second.revision.number, 2);
  assert.equal(context.read("lot_revisions", first.jobSheet.jobId).status, "SUPERSEDED");
  assert.equal(context.read("lot_revisions", first.jobSheet.jobId).supersededBy, second.jobSheet.jobId);
  assert.equal(context.read("lot_revisions", second.jobSheet.jobId).status, "CURRENT");
  assert.notEqual(first.revision.fingerprint, second.revision.fingerprint);
});

test("a failed plan marks its revision FAILED and returns the original failure", async () => {
  const context = setup({ submit: async () => ({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "No model." } }) });
  const result = await context.plan();
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  const [revisionName] = [...context.firestore.docs.keys()].filter((name) => name.includes("/lot_revisions/"));
  assert.equal(fromFirestoreFields(context.firestore.docs.get(revisionName).fields).status, "FAILED");
});

test("a condition edited while the plan runs leaves the draft SUPERSEDED and the plan reports a conflict", async () => {
  const context = setup({
    submit: async (input) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await context.deps.lotRevisions.store.saveConditions({
        lotId: `LOT-HACK-${context.principal.sessionId}-${input.identity.keyHash.slice(0, 12)}`,
        ownerSessionId: context.principal.sessionId, byRole: "Supervisor session",
        conditions: [{
          field: "paperMoisturePct", value: 10.8, unit: "%", provenance: "operator_entry", sourceDetail: "typed",
          label: "Entered by operator", confirmed: false,
        }],
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true, durable: true, jobSheet: { ...structuredClone(jobSheetFixture), jobId: input.identity.jobId } };
    },
  });
  const result = await context.plan();
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  const [name] = [...context.firestore.docs.keys()].filter((key) => key.includes("/lot_revisions/"));
  assert.equal(fromFirestoreFields(context.firestore.docs.get(name).fields).status, "SUPERSEDED");
});

test("a retry of the same request reuses the revision and returns the same fingerprint", async () => {
  const context = setup();
  const first = await context.plan();
  const retry = await context.plan();
  assert.equal(retry.revision.fingerprint, first.revision.fingerprint);
  assert.equal(retry.revision.number, 1);
  assert.equal(retry.revision.status, "CURRENT");
});

test("a retry after the draft was replaced reports the revision as SUPERSEDED, not an error", async () => {
  const context = setup();
  const first = await context.plan();
  await context.deps.lotRevisions.store.saveConditions({
    lotId: first.revision.lotId, ownerSessionId: context.principal.sessionId, byRole: "Supervisor session",
    conditions: [{
      field: "paperMoisturePct", value: 10.8, unit: "%", provenance: "operator_entry", sourceDetail: "typed",
      label: "Entered by operator", confirmed: false,
    }],
  });
  const retry = await context.plan();
  assert.equal(retry.ok, true);
  assert.equal(retry.revision.status, "SUPERSEDED");
});

test("an explicit lot ID must belong to the session and be well formed, and nothing is planned otherwise", async () => {
  const context = setup();
  const foreign = await context.plan(jobFields({ lotId: `LOT-HACK-${"f".repeat(32)}-${"b".repeat(12)}` }));
  assert.equal(foreign.ok, false);
  assert.equal(foreign.status, 403);
  const malformed = await context.plan(jobFields({ lotId: "LOT-1" }));
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error.code, "VALIDATION_ERROR");
  assert.equal(context.seen.length, 0);
});

test("a Firestore outage stops the plan before any job is created", async () => {
  const context = setup({ failReads: true });
  const result = await context.plan();
  assert.equal(result.status, 503);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  assert.equal(context.seen.length, 0);
});

test("with lot revisions off, planning makes no lot records and returns no revision block", async () => {
  const context = setup({ enabled: false });
  const result = await context.plan(jobFields({ lotId: `LOT-HACK-${context.principal.sessionId}-${"c".repeat(12)}` }));
  assert.equal(result.ok, true);
  assert.equal("revision" in result, false);
  assert.equal(context.firestore.calls.length, 0);
});

test("a session without a demo principal plans as before and gets no revision", async () => {
  const context = setup();
  const result = await planLot({ fields: jobFields(), idempotencyKey: "plain-key-0001" }, {
    ...context.deps, principal: { uid: "supervisor" }, hackathonAuth: { enabled: false },
  });
  assert.equal(result.ok, true);
  assert.equal("revision" in result, false);
  assert.equal(context.firestore.calls.length, 0);
});

test("two lots planned with the same inputs get different jobs, with or without lot revisions", async () => {
  for (const enabled of [true, false]) {
    const context = setup({ enabled });
    const lotFor = (suffix) => `LOT-HACK-${context.principal.sessionId}-${suffix.repeat(12)}`;
    const first = await context.plan(jobFields({ lotId: lotFor("c") }), "plan-key-lot-c1");
    const second = await context.plan(jobFields({ lotId: lotFor("d") }), "plan-key-lot-d1");
    assert.equal(first.ok && second.ok, true);
    assert.notEqual(first.jobSheet.jobId, second.jobSheet.jobId);
    // The same inputs and the same key in one lot still name one job.
    const again = await context.plan(jobFields({ lotId: lotFor("d") }), "plan-key-lot-d1");
    assert.equal(again.jobSheet.jobId, second.jobSheet.jobId);
  }
});

test("one client key reused for a second lot carries a different request fingerprint", async () => {
  const context = setup({ enabled: false });
  const lotFor = (suffix) => `LOT-HACK-${context.principal.sessionId}-${suffix.repeat(12)}`;
  await context.plan(jobFields({ lotId: lotFor("c") }), "one-key-two-lots");
  await context.plan(jobFields({ lotId: lotFor("d") }), "one-key-two-lots");
  assert.equal(context.seen[0].identity.keyHash, context.seen[1].identity.keyHash);
  assert.notEqual(context.seen[0].identity.fingerprint, context.seen[1].identity.fingerprint);
});
