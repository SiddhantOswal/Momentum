import assert from "node:assert/strict";
import test from "node:test";
import { getJob } from "../src/commands/get-job.js";
import { createFirestoreLotStore } from "../src/google-cloud/firestore-lot-store.js";
import { createHackathonDemoAuthenticator } from "../src/hackathon-demo-auth.js";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";

const authenticator = createHackathonDemoAuthenticator({
  mode: "HACKATHON_DEMO", signingKey: "a".repeat(64), syntheticOnly: true, auditEnabled: true,
});

function setup({ enabled = true, failReads = false } = {}) {
  const firestore = fakeFirestore({ failReads });
  const store = createFirestoreLotStore({
    projectId: "prepagent-hack", fetchImpl: firestore.fetchImpl, tokenProvider: async () => "token",
  });
  const principal = authenticator.authenticate(authenticator.issue()).principal;
  const jobId = `JOB-HACK-${principal.sessionId}-${"1".repeat(40)}`;
  const lotId = `LOT-HACK-${principal.sessionId}-${"b".repeat(12)}`;
  const deps = {
    principal, signal: undefined,
    lotRevisions: { enabled, enforceGuard: false, store },
    lookupStoredJobSheet: async () => ({ ok: true, jobSheet: { jobId, status: "DRAFT" } }),
  };
  return { firestore, store, principal, jobId, lotId, deps };
}

test("a stored job carries its revision block when lot revisions are on", async () => {
  const { store, principal, jobId, lotId, deps } = setup();
  await store.registerPending({ lotId, ownerSessionId: principal.sessionId, jobId, requestFingerprint: "e".repeat(64), conditions: [] });
  await store.makeCurrent({ lotId, jobId, revisionFingerprint: "c".repeat(64) });
  const result = await getJob({ jobId }, deps);
  assert.equal(result.ok, true);
  assert.deepEqual(result.revision, { lotId, number: 1, fingerprint: "c".repeat(64), status: "CURRENT" });
});

test("a draft made before lot revisions has no revision block", async () => {
  const { deps, jobId } = setup();
  const result = await getJob({ jobId }, deps);
  assert.equal(result.ok, true);
  assert.equal("revision" in result, false);
});

test("the revision block is left out when the feature is off or there is no demo session", async () => {
  const off = setup({ enabled: false });
  assert.equal("revision" in await getJob({ jobId: off.jobId }, off.deps), false);
  assert.equal(off.firestore.calls.length, 0);
  const anonymous = setup();
  assert.equal("revision" in await getJob({ jobId: anonymous.jobId }, { ...anonymous.deps, principal: undefined }), false);
  assert.equal(anonymous.firestore.calls.length, 0);
});

test("a Firestore outage does not hide the stored job, and the missing block keeps approval closed", async () => {
  const { deps, jobId } = setup({ failReads: true });
  const result = await getJob({ jobId }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.jobSheet.jobId, jobId);
  assert.equal("revision" in result, false);
});

test("a failed lookup is returned as it is", async () => {
  const { deps, jobId } = setup();
  const failure = { ok: false, error: { code: "NOT_FOUND", message: "No stored job." } };
  assert.deepEqual(await getJob({ jobId }, { ...deps, lookupStoredJobSheet: async () => failure }), failure);
});
