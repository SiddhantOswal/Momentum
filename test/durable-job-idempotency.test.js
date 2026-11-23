import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { planLot } from "../src/commands/plan-lot.js";
import { getStatus } from "../src/commands/status.js";
import { createJobSubmissionHandler } from "../src/job-draft-persistence.js";
import {
  createJobRequestIdentity,
  InMemoryIdempotencyStore,
  selectJobIdempotencyStore,
} from "../src/job-idempotency.js";
import { createConfiguredServicePorts, createServicePorts } from "../src/service-ports.js";
import modelAcceptanceConfig from "../config/model-acceptance.json" with { type: "json" };
import { createFakeFirestore } from "./fixtures/fake-firestore.js";
import { jobSheetFixture } from "./fixtures/job-sheet.js";

const START = Date.parse("2026-12-04T04:00:00.000Z");
const CLIENT_KEY = "arc-retry-0001";
const FLAG_ON = { PROJECT_ID: "prepagent-hack", USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY: "true" };
const purchaseOrder = await readFile(new URL("./fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf", import.meta.url));

function clockAt(start) {
  let current = start;
  return { now: () => current, advance: (ms) => { current += ms; } };
}

// Stands in for the job_sheets table. It appends on every write, as two
// concurrent MERGEs can, so a second write shows up as a second row.
function fakeJobSheets() {
  const rows = [];
  return {
    rows,
    createDraftJobSheet: async ({ jobSheet, jobId, plantId }) => {
      const row = structuredClone({ ...jobSheet, jobId, plantId });
      rows.push(row);
      return row;
    },
    getStoredJobSheet: async ({ jobId }) => {
      const matches = rows.filter((row) => row.jobId === jobId);
      if (matches.length > 1) return { ok: false, error: { code: "JOB_SHEET_NOT_UNIQUE", message: "duplicate" } };
      return matches.length === 1 ? structuredClone(matches[0]) : null;
    },
  };
}

// One Cloud Run instance: its own service ports and Firestore client, sharing
// the fake database and job_sheets table with every other instance.
function startInstance({ fake, env = FLAG_ON, sheets, clock, gemini, holdPlanning }) {
  const servicePorts = createConfiguredServicePorts({
    env,
    fetchImpl: fake.fetchImpl,
    tokenProvider: async () => "test-token",
  });
  const idempotency = selectJobIdempotencyStore({
    jobIdempotency: servicePorts.jobIdempotency,
    jobSheetPersistenceAvailable: true,
    demoMode: false,
  });
  // The coordinator's explanation step is the Gemini attempt a replay must not repeat.
  const prepareJob = async ({ jobId }) => {
    gemini.attempts += 1;
    if (holdPlanning) await holdPlanning();
    return { ok: true, jobSheet: { ...structuredClone(jobSheetFixture), jobId, status: "DRAFT" } };
  };
  const submitJob = createJobSubmissionHandler({
    prepareJob,
    createDraftJobSheet: sheets.createDraftJobSheet,
    getStoredJobSheet: sheets.getStoredJobSheet,
    draftPersistenceEnabled: true,
    storedJobLookupEnabled: true,
    plantId: "PLANT-01",
    store: idempotency.store,
    leaseMs: idempotency.leaseMs,
    now: clock.now,
  });
  return { idempotency, submitJob };
}

function jobFields() {
  return {
    file: new File([purchaseOrder], "order.pdf", { type: "application/pdf" }),
    orderId: "TEST-PO-1", paperType: "VIRGIN", paperSupplier: "SUPPLIER-TEST",
    confirmedItemCode: "SKU-TEST-42", confirmedQuantity: "100", confirmedLineIndex: "1",
    shift: "DAY", runDate: "2026-10-15", ambientRhPct: "64", ambientTempC: "26", paperMoisturePct: "8.5",
    conditionsConfirmed: "true", sfSpeedMpm: "40", rollTempC: "165", gumApplication: "MED", gumViscositySec: "40",
    pastingPressure: "MED", dryingHours: "6", printSpeedSpm: "50",
  };
}

function plan(instance) {
  return planLot({ fields: jobFields(), idempotencyKey: CLIENT_KEY }, {
    principal: { uid: "supervisor" },
    signal: new AbortController().signal,
    submitJob: instance.submitJob,
    liveStore: { publish: async () => {} },
    hackathonAuth: { enabled: false },
    demoMode: false,
    executionMode: "offline",
    purchaseOrderPolicy: { acceptRealOrders: false, extractionAdapterConfigured: false, syntheticOnly: false },
  });
}

const identity = createJobRequestIdentity({
  idempotencyKey: CLIENT_KEY,
  fileBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
  operatorFields: { orderId: "TEST-PO-1", paperType: "VIRGIN", paperSupplier: "SUPPLIER-TEST" },
  operatorItemConfirmation: { itemCode: "SKU-TEST-42", quantity: 100 },
  shift: "DAY",
  levers: jobSheetFixture.baseline.levers,
  conditions: jobSheetFixture.conditions,
}).identity;

function submit(instance) {
  return instance.submitJob({ identity, request: {}, signal: new AbortController().signal });
}

function claimDocument(fake, keyHash) {
  const stored = fake.documents.get(fake.documentName("idempotency", keyHash));
  return stored && Object.fromEntries(Object.entries(stored.fields)
    .map(([key, value]) => [key, value.stringValue ?? value.integerValue ?? value.timestampValue]));
}

function gate() {
  let open;
  const opened = new Promise((resolve) => { open = resolve; });
  let entered;
  const reached = new Promise((resolve) => { entered = resolve; });
  return { open, reached, wait: async () => { entered(); await opened; } };
}

test("with the flag on, a retry after a restart replays the stored job and spends no Gemini attempt", async () => {
  const fake = createFakeFirestore();
  const sheets = fakeJobSheets();
  const clock = clockAt(START);
  const gemini = { attempts: 0 };

  const first = await plan(startInstance({ fake, sheets, clock, gemini }));
  assert.equal(first.ok, true);
  assert.equal(gemini.attempts, 1);

  clock.advance(60_000);
  const restarted = startInstance({ fake, sheets, clock, gemini });
  const replay = await plan(restarted);

  assert.equal(replay.ok, true);
  assert.equal(replay.jobSheet.jobId, first.jobSheet.jobId);
  assert.deepEqual(replay.jobSheet, sheets.rows[0], "the replay is the stored row");
  assert.equal(gemini.attempts, 1, "the replay must not run the coordinator again");
  assert.equal(sheets.rows.length, 1);
  const keyHash = createHash("sha256").update(`ustaad-jobs:v3:client:${CLIENT_KEY}`).digest("hex");
  assert.equal(first.jobSheet.jobId, `JOB-${keyHash.slice(0, 40)}`, "the key prefix is v3");
  const claim = claimDocument(fake, keyHash);
  assert.equal(claim.recordStatus, "complete");
  assert.equal(claim.scope, "jobs");
  assert.equal(Number(claim.leaseExpiresAt) - Number(claim.claimedAt), 130_000);
});

test("two concurrent submissions on two instances produce one job and one job_sheets row", async () => {
  const fake = createFakeFirestore();
  const sheets = fakeJobSheets();
  const clock = clockAt(START);
  const gemini = { attempts: 0 };
  const planning = gate();
  const a = startInstance({ fake, sheets, clock, gemini, holdPlanning: planning.wait });
  const b = startInstance({ fake, sheets, clock, gemini, holdPlanning: planning.wait });

  const racing = [submit(a), submit(b)];
  await planning.reached;
  const loser = await Promise.race(racing);
  assert.equal(loser.error?.code, "IDEMPOTENCY_IN_PROGRESS", "the loser answers while the winner is still planning");
  planning.open();
  const results = await Promise.all(racing);

  assert.equal(results.filter((result) => result.ok === true).length, 1);
  assert.deepEqual(results.filter((result) => result.ok !== true).map((result) => result.error.code),
    ["IDEMPOTENCY_IN_PROGRESS"]);
  assert.equal(gemini.attempts, 1);
  assert.equal(sheets.rows.length, 1);

  const retry = await submit(b);
  assert.equal(retry.ok, true);
  assert.equal(retry.jobSheet.jobId, identity.jobId);
  assert.equal(sheets.rows.length, 1);
  assert.notEqual((await sheets.getStoredJobSheet({ jobId: identity.jobId }))?.ok, false,
    "the stored job must stay unique");
});

test("a lease that expires mid-run is fenced: the late finisher writes nothing and cannot complete", async () => {
  const fake = createFakeFirestore();
  const sheets = fakeJobSheets();
  const clock = clockAt(START);
  const gemini = { attempts: 0 };
  const slow = gate();
  const a = startInstance({ fake, sheets, clock, gemini, holdPlanning: slow.wait });
  const b = startInstance({ fake, sheets, clock, gemini });

  const late = submit(a);
  await slow.reached;
  clock.advance(130_001);
  const takeover = await submit(b);
  assert.equal(takeover.ok, true);
  const takeoverOwner = claimDocument(fake, identity.keyHash).ownerToken;

  slow.open();
  const lateResult = await late;
  assert.equal(lateResult.ok, false);
  assert.equal(lateResult.error.code, "IDEMPOTENCY_IN_PROGRESS");
  assert.equal(sheets.rows.length, 1, "the fenced owner must not reach the job_sheets write");
  const claim = claimDocument(fake, identity.keyHash);
  assert.equal(claim.recordStatus, "complete");
  assert.equal(claim.ownerToken, takeoverOwner);
  assert.equal(gemini.attempts, 2, "a re-run after lease expiry is a counted attempt (design 3.2)");
});

test("an owner whose lease ran out is fenced even when nobody re-claimed, and the key can run again", async () => {
  const fake = createFakeFirestore();
  const sheets = fakeJobSheets();
  const clock = clockAt(START);
  const gemini = { attempts: 0 };
  const slow = gate();
  const a = startInstance({ fake, sheets, clock, gemini, holdPlanning: slow.wait });

  const late = submit(a);
  await slow.reached;
  clock.advance(130_000);
  slow.open();
  const lateResult = await late;

  assert.equal(lateResult.ok, false);
  assert.equal(lateResult.error.code, "IDEMPOTENCY_IN_PROGRESS");
  assert.equal(sheets.rows.length, 0);
  assert.equal(claimDocument(fake, identity.keyHash), undefined, "the stale owner releases its own claim");

  const retry = await submit(startInstance({ fake, sheets, clock, gemini }));
  assert.equal(retry.ok, true);
  assert.equal(sheets.rows.length, 1);
});

test("an owner check that cannot reach Firestore writes nothing", async () => {
  const fake = createFakeFirestore();
  let firestoreDown = false;
  const flaky = { fetchImpl: async (url, options) => {
    if (firestoreDown) throw new Error("ECONNRESET");
    return fake.fetchImpl(url, options);
  } };
  const sheets = fakeJobSheets();
  const instance = startInstance({ fake: flaky, sheets, clock: clockAt(START), gemini: { attempts: 0 },
    holdPlanning: async () => { firestoreDown = true; } });

  const result = await submit(instance);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  assert.equal(sheets.rows.length, 0);
});

test("with the flag on and Firestore unreachable, job creation fails closed before planning", async () => {
  const sheets = fakeJobSheets();
  const gemini = { attempts: 0 };
  const unreachable = { fetchImpl: async () => { throw new Error("ECONNREFUSED"); } };
  const instance = startInstance({ fake: unreachable, sheets, clock: clockAt(START), gemini });

  const result = await submit(instance);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  assert.equal(gemini.attempts, 0);
  assert.equal(sheets.rows.length, 0);
});

test("with the flag off, /jobs keeps the process-local store and never calls Firestore", async () => {
  for (const value of [undefined, "false", "TRUE", "1"]) {
    const fake = createFakeFirestore();
    const sheets = fakeJobSheets();
    const gemini = { attempts: 0 };
    const env = { PROJECT_ID: "prepagent-hack", ...(value === undefined ? {} : { USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY: value }) };
    const instance = startInstance({ fake, env, sheets, clock: clockAt(START), gemini });

    assert.ok(instance.idempotency.store instanceof InMemoryIdempotencyStore);
    assert.equal(instance.idempotency.leaseMs, 30_000);
    assert.equal(instance.idempotency.scope, "process-local");
    assert.equal((await plan(instance)).ok, true);
    assert.equal((await plan(instance)).ok, true);
    assert.equal(gemini.attempts, 1);
    assert.equal(fake.calls.length, 0);

    const otherInstance = startInstance({ fake, env, sheets, clock: clockAt(START), gemini });
    await plan(otherInstance);
    assert.equal(gemini.attempts, 2, "flag off: a second instance does not see the first one's claim");
  }
});

test("the flag on without a Firestore store leaves job creation unavailable instead of falling back to memory", () => {
  for (const demoMode of [false, true]) {
    const idempotency = selectJobIdempotencyStore({
      jobIdempotency: { durableRequested: true, store: undefined },
      jobSheetPersistenceAvailable: true,
      demoMode,
    });
    assert.equal(idempotency.store, undefined);
    assert.equal(idempotency.scope, "unavailable");
  }
});

test("status reports the shared Firestore scope only when the durable store is in use", () => {
  const baseDeps = {
    env: {},
    servicePorts: createServicePorts(),
    executionMode: "offline",
    hackathonAuth: { enabled: false, configured: false },
    supervisorAuthenticator: { enabled: false, configured: false },
    approvalAuthorizationConfigured: false,
    jobSheetPersistenceAvailable: true,
    jobCreationAvailable: false,
    modelAcceptanceConfig,
  };
  const shared = getStatus({}, { ...baseDeps, idempotencyStore: {}, idempotencyScope: "shared-firestore" });
  for (const section of [shared.runtimeAvailability, shared.integrations]) {
    assert.equal(section.durableIdempotencyConfigured, true);
    assert.equal(section.idempotencyScope, "shared-firestore");
  }
  const local = getStatus({}, { ...baseDeps, idempotencyStore: new InMemoryIdempotencyStore() });
  for (const section of [local.runtimeAvailability, local.integrations]) {
    assert.equal(section.durableIdempotencyConfigured, false);
    assert.equal(section.idempotencyScope, "process-local");
  }
});
