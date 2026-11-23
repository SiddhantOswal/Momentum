import assert from "node:assert/strict";
import test from "node:test";
import { getLot } from "../src/commands/get-lot.js";
import { updateLotConditions } from "../src/commands/update-conditions.js";
import { createFirestoreLotStore } from "../src/google-cloud/firestore-lot-store.js";
import { fromFirestoreFields } from "../src/google-cloud/firestore-rest.js";
import { createHackathonDemoAuthenticator } from "../src/hackathon-demo-auth.js";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";

const authenticator = createHackathonDemoAuthenticator({
  mode: "HACKATHON_DEMO", signingKey: "a".repeat(64), syntheticOnly: true, auditEnabled: true,
});
const principalFor = () => authenticator.authenticate(authenticator.issue()).principal;
const lotFor = (principal, suffix = "b") => `LOT-HACK-${principal.sessionId}-${suffix.repeat(12)}`;
const DOCS = "projects/prepagent-hack/databases/(default)/documents";

function setup({ enabled = true, failReads = false } = {}) {
  const firestore = fakeFirestore({ failReads });
  const store = createFirestoreLotStore({
    projectId: "prepagent-hack", fetchImpl: firestore.fetchImpl, tokenProvider: async () => "token",
  });
  const principal = principalFor();
  const deps = { principal, lotRevisions: { enabled, enforceGuard: false, store } };
  const read = (collection, id) => {
    const doc = firestore.docs.get(`${DOCS}/${collection}/${id}`);
    return doc ? fromFirestoreFields(doc.fields) : undefined;
  };
  return { firestore, store, principal, deps, read, lotId: lotFor(principal) };
}

const typed = (field, value) => ({ field, value, source: "typed" });

test("conditions are saved with provenance set by the server, not the client", async () => {
  const { deps, lotId, read } = setup();
  const result = await updateLotConditions({ lotId, body: { conditions: [
    typed("paperMoisturePct", 8.5),
    { field: "ambientRhPct", value: 62, source: "confirmed" },
    { field: "shift", value: "DAY", source: "typed" },
  ] } }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.superseded, null);
  const [moisture, humidity, shift] = read("lot_heads", lotId).draftConditions;
  assert.deepEqual([moisture.label, moisture.provenance, moisture.confirmed, moisture.unit],
    ["Entered by operator", "operator_entry", false, "%"]);
  assert.deepEqual([humidity.label, humidity.confirmed, humidity.unit], ["Confirmed by operator", true, "% RH"]);
  assert.deepEqual([shift.value, shift.unit], ["DAY", "shift"]);
  assert.equal(moisture.enteredByRole, "Supervisor session");
});

test("the example moisture value keeps its example label", async () => {
  const { deps, lotId, read } = setup();
  await updateLotConditions({ lotId, body: { conditions: [{ field: "paperMoisturePct", value: 7.3, source: "example" }] } }, deps);
  const [stored] = read("lot_heads", lotId).draftConditions;
  assert.deepEqual([stored.provenance, stored.label, stored.sourceDetail], ["synthetic_example", "Example value", "example"]);
  assert.equal(stored.enteredByRole, undefined);
});

test("a changed condition supersedes the planned draft and says what changed", async () => {
  const { deps, lotId, read, store, principal } = setup();
  const jobId = `JOB-HACK-${principal.sessionId}-${"1".repeat(40)}`;
  const entry = {
    field: "paperMoisturePct", value: 8.5, unit: "%", provenance: "operator_entry", sourceDetail: "typed",
    label: "Entered by operator", confirmed: false, enteredByRole: "Supervisor session",
  };
  await store.registerPending({ lotId, ownerSessionId: principal.sessionId, jobId, requestFingerprint: "e".repeat(64), conditions: [entry] });
  await store.makeCurrent({ lotId, jobId, revisionFingerprint: "c".repeat(64) });
  const result = await updateLotConditions({ lotId, body: { conditions: [typed("paperMoisturePct", 10.8)] } }, deps);
  assert.equal(result.ok, true);
  assert.deepEqual(result.superseded, {
    jobId, number: 1,
    reason: { field: "paperMoisturePct", from: 8.5, to: 10.8, provenance: "operator_entry", byRole: "Supervisor session" },
  });
  assert.equal(read("lot_revisions", jobId).status, "SUPERSEDED");
});

test("an edit during approval is refused with 409", async () => {
  const { deps, lotId, store, principal } = setup();
  const jobId = `JOB-HACK-${principal.sessionId}-${"1".repeat(40)}`;
  const entry = {
    field: "paperMoisturePct", value: 8.5, unit: "%", provenance: "operator_entry", sourceDetail: "typed",
    label: "Entered by operator", confirmed: false,
  };
  await store.registerPending({ lotId, ownerSessionId: principal.sessionId, jobId, requestFingerprint: "e".repeat(64), conditions: [entry] });
  await store.makeCurrent({ lotId, jobId, revisionFingerprint: "c".repeat(64) });
  await store.beginApproval({ jobId, revisionFingerprint: "c".repeat(64) });
  const result = await updateLotConditions({ lotId, body: { conditions: [typed("paperMoisturePct", 10.8)] } }, deps);
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(result.error.code, "APPROVAL_IN_PROGRESS");
});

test("every guard branch of the conditions command refuses before writing", async () => {
  const { deps, lotId, firestore, principal } = setup();
  const refusals = [
    ["lot revisions off", { lotId, body: { conditions: [typed("paperMoisturePct", 8)] } }, setup({ enabled: false }).deps, 503, "SERVICE_UNAVAILABLE"],
    ["no demo session", { lotId, body: { conditions: [typed("paperMoisturePct", 8)] } }, { ...deps, principal: undefined }, 403, "DEMO_SCOPE_REQUIRED"],
    ["another session's lot", { lotId: lotFor(principalFor()), body: { conditions: [typed("paperMoisturePct", 8)] } }, deps, 403, "DEMO_SCOPE_REQUIRED"],
    ["malformed lot ID", { lotId: "LOT-1", body: { conditions: [typed("paperMoisturePct", 8)] } }, deps, 400, "VALIDATION_ERROR"],
    ["empty list", { lotId, body: { conditions: [] } }, deps, 400, "VALIDATION_ERROR"],
    ["body sessionId", { lotId, body: { sessionId: principal.sessionId, conditions: [typed("paperMoisturePct", 8)] } }, deps, 400, "VALIDATION_ERROR"],
    ["not an object", { lotId, body: [] }, deps, 400, "VALIDATION_ERROR"],
    ["unknown field", { lotId, body: { conditions: [typed("speed", 8)] } }, deps, 400, "VALIDATION_ERROR"],
    ["duplicate field", { lotId, body: { conditions: [typed("paperMoisturePct", 8), typed("paperMoisturePct", 9)] } }, deps, 400, "VALIDATION_ERROR"],
    ["weather source", { lotId, body: { conditions: [{ field: "ambientRhPct", value: 60, source: "weather" }] } }, deps, 400, "VALIDATION_ERROR"],
    ["client-supplied label", { lotId, body: { conditions: [{ ...typed("paperMoisturePct", 8), label: "From dataset" }] } }, deps, 400, "VALIDATION_ERROR"],
    ["text for a number", { lotId, body: { conditions: [typed("paperMoisturePct", "8")] } }, deps, 400, "VALIDATION_ERROR"],
    ["humidity over 100", { lotId, body: { conditions: [typed("ambientRhPct", 101)] } }, deps, 400, "VALIDATION_ERROR"],
    ["moisture outside the plant range", { lotId, body: { conditions: [typed("paperMoisturePct", 19)] } }, deps, 400, "VALIDATION_ERROR"],
    ["bad shift", { lotId, body: { conditions: [typed("shift", "EVENING")] } }, deps, 400, "VALIDATION_ERROR"],
    ["bad date", { lotId, body: { conditions: [typed("runDate", "04/12/2026")] } }, deps, 400, "VALIDATION_ERROR"],
    ["example on humidity", { lotId, body: { conditions: [{ field: "ambientRhPct", value: 60, source: "example" }] } }, deps, 400, "VALIDATION_ERROR"],
  ];
  for (const [name, input, context, status, code] of refusals) {
    const result = await updateLotConditions(input, context);
    assert.equal(result.ok, false, name);
    assert.equal(result.status ?? 400, status, name);
    assert.equal(result.error.code, code, name);
  }
  assert.equal(firestore.calls.length, 0);
});

test("a Firestore outage returns 503 and does not fall back to memory", async () => {
  const { deps, lotId } = setup({ failReads: true });
  const result = await updateLotConditions({ lotId, body: { conditions: [typed("paperMoisturePct", 8)] } }, deps);
  assert.equal(result.status, 503);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
});

test("getLot returns the saved head and no revision before the first plan", async () => {
  const { deps, lotId } = setup();
  await updateLotConditions({ lotId, body: { conditions: [typed("paperMoisturePct", 8.5)] } }, deps);
  const result = await getLot({ lotId }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.lot.stage, "conditions");
  assert.equal(result.lot.draftConditions[0].value, 8.5);
  assert.equal(result.revision, null);
});

test("getLot refuses a missing lot, a foreign lot, a malformed ID and a disabled feature", async () => {
  const { deps, lotId } = setup();
  const missing = await getLot({ lotId }, deps);
  assert.deepEqual([missing.status, missing.error.code], [404, "LOT_NOT_FOUND"]);
  const foreign = await getLot({ lotId: lotFor(principalFor()) }, deps);
  assert.deepEqual([foreign.status, foreign.error.code], [403, "DEMO_SCOPE_REQUIRED"]);
  const malformed = await getLot({ lotId: "nope" }, deps);
  assert.equal(malformed.error.code, "VALIDATION_ERROR");
  const off = await getLot({ lotId }, setup({ enabled: false }).deps);
  assert.deepEqual([off.status, off.error.code], [503, "SERVICE_UNAVAILABLE"]);
});
