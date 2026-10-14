/**
 * Offline idempotency guardrail tests.
 *
 * All tests use InMemoryIdempotencyStore and deterministic offline fixtures.
 * No cloud calls, no live persistence, no live model calls are made here.
 * These tests are explicitly distinguished from verification against a real
 * shared-store adapter, which remains a future integration task.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createJobRequestIdentity,
  createIdempotentJobService,
  InMemoryIdempotencyStore,
} from "../src/job-idempotency.js";

// ---------------------------------------------------------------------------
// Deterministic test fixtures
// ---------------------------------------------------------------------------

const VALID_FILE_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const DIFFERENT_FILE_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2e]); // %PDF.

const OPERATOR_FIELDS = {
  orderId: "PO-IDEMPOTENCY-001",
  paperType: "VIRGIN",
  paperSupplier: "SUPPLIER-A",
};
const DIFFERENT_OPERATOR_FIELDS = {
  orderId: "PO-IDEMPOTENCY-002",
  paperType: "RECYCLED",
  paperSupplier: "SUPPLIER-B",
};
const OPERATOR_ITEM_CONFIRMATION = {
  itemCode: "ITEM-IDEMPOTENCY-001",
  quantity: 250,
};

const SHIFT = "DAY";
const LEVERS = {
  sfSpeedMpm: 40,
  rollTempC: 165,
  gumApplication: "MED",
  gumViscositySec: 40,
  pastingPressure: "MED",
  dryingHours: 6,
  printSpeedSpm: 50,
};
const DIFFERENT_LEVERS = { ...LEVERS, rollTempC: 180 };

const CLIENT_KEY = "client-idempotency-key-001";

function makeIdentity(overrides = {}) {
  return createJobRequestIdentity({
    fileBytes: VALID_FILE_BYTES,
    operatorFields: OPERATOR_FIELDS,
    operatorItemConfirmation: OPERATOR_ITEM_CONFIRMATION,
    shift: SHIFT,
    levers: LEVERS,
    ...overrides,
  });
}

function makeJobResult(overrides = {}) {
  return {
    ok: true,
    runId: "test-run-id",
    completedStages: ["extractOrder"],
    jobSheet: { jobId: "JOB-PLACEHOLDER", status: "DRAFT" },
    durable: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Section A: createJobRequestIdentity
// ---------------------------------------------------------------------------

test("createJobRequestIdentity: returns deterministic keyHash and fingerprint for same inputs", () => {
  const r1 = makeIdentity();
  const r2 = makeIdentity();
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r1.identity.keyHash, r2.identity.keyHash);
  assert.equal(r1.identity.fingerprint, r2.identity.fingerprint);
  assert.equal(r1.identity.jobId, r2.identity.jobId);
});

test("createJobRequestIdentity: client key produces different keyHash than fingerprint-derived key", () => {
  const rClient = makeIdentity({ idempotencyKey: CLIENT_KEY });
  const rDerived = makeIdentity();
  assert.equal(rClient.ok, true);
  assert.equal(rDerived.ok, true);
  assert.notEqual(rClient.identity.keyHash, rDerived.identity.keyHash);
  // but the fingerprint (request hash) should match since inputs are the same
  assert.equal(rClient.identity.fingerprint, rDerived.identity.fingerprint);
});

test("createJobRequestIdentity: different PO content produces different fingerprint", () => {
  const r1 = makeIdentity();
  const r2 = makeIdentity({ fileBytes: DIFFERENT_FILE_BYTES });
  assert.notEqual(r1.identity.fingerprint, r2.identity.fingerprint);
});

test("createJobRequestIdentity: item confirmation is part of the request fingerprint", () => {
  const confirmed = makeIdentity();
  const changedConfirmation = makeIdentity({
    operatorItemConfirmation: { ...OPERATOR_ITEM_CONFIRMATION, quantity: 251 },
  });
  assert.notEqual(confirmed.identity.fingerprint, changedConfirmation.identity.fingerprint);
});

test("createJobRequestIdentity: selected PO line is part of the request fingerprint", () => {
  const firstLine = makeIdentity({
    operatorItemConfirmation: { ...OPERATOR_ITEM_CONFIRMATION, lineIndex: 0 },
  });
  const secondLine = makeIdentity({
    operatorItemConfirmation: { ...OPERATOR_ITEM_CONFIRMATION, lineIndex: 1 },
  });
  assert.notEqual(firstLine.identity.fingerprint, secondLine.identity.fingerprint);
});

test("createJobRequestIdentity: reviewed extraction content is part of the request fingerprint", () => {
  const firstReview = makeIdentity({ purchaseOrderReviewFingerprint: "a".repeat(64) });
  const changedReview = makeIdentity({ purchaseOrderReviewFingerprint: "b".repeat(64) });
  assert.notEqual(firstReview.identity.fingerprint, changedReview.identity.fingerprint);
});

test("createJobRequestIdentity: rejects invalid idempotency key (space in key)", () => {
  const r = makeIdentity({ idempotencyKey: "invalid key with space" });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "VALIDATION_ERROR");
});

test("createJobRequestIdentity: rejects idempotency key longer than 128 chars", () => {
  const r = makeIdentity({ idempotencyKey: "x".repeat(129) });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "VALIDATION_ERROR");
});

test("createJobRequestIdentity: rejects missing fileBytes", () => {
  const r = createJobRequestIdentity({
    operatorFields: OPERATOR_FIELDS,
    shift: SHIFT,
    levers: LEVERS,
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "VALIDATION_ERROR");
});

test("createJobRequestIdentity: rejects invalid shift", () => {
  const r = makeIdentity({ shift: "EVENING" });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "VALIDATION_ERROR");
});

test("createJobRequestIdentity: jobId is JOB- prefix followed by 40 hex chars from keyHash", () => {
  const r = makeIdentity();
  assert.equal(r.ok, true);
  assert.match(r.identity.jobId, /^JOB-[a-f0-9]{40}$/);
  assert.equal(r.identity.jobId, `JOB-${r.identity.keyHash.slice(0, 40)}`);
});

test("createJobRequestIdentity: does not expose raw file bytes in output", () => {
  const r = makeIdentity();
  const serialized = JSON.stringify(r);
  // Should not contain the raw file bytes as base64 or as numbers
  assert.ok(!serialized.includes("37,80,68,70,45")); // decimal bytes
});

// ---------------------------------------------------------------------------
// Section B: InMemoryIdempotencyStore
// ---------------------------------------------------------------------------

test("InMemoryIdempotencyStore: claim returns claimed with correct ownerToken", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const { identity } = makeIdentity();
  const result = await store.claim({
    keyHash: identity.keyHash,
    fingerprint: identity.fingerprint,
    jobId: identity.jobId,
    ownerToken: "token-1",
    claimedAt: Date.now(),
    leaseExpiresAt: Date.now() + 30_000,
  });
  assert.equal(result.status, "claimed");
  assert.equal(result.ownerToken, "token-1");
});

test("InMemoryIdempotencyStore: second claim returns in_progress while lease is active", async () => {
  const now = Date.now();
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const { identity } = makeIdentity();
  await store.claim({
    keyHash: identity.keyHash,
    fingerprint: identity.fingerprint,
    jobId: identity.jobId,
    ownerToken: "token-1",
    claimedAt: now,
    leaseExpiresAt: now + 30_000,
  });
  const second = await store.claim({
    keyHash: identity.keyHash,
    fingerprint: identity.fingerprint,
    jobId: identity.jobId,
    ownerToken: "token-2",
    claimedAt: now + 100,
    leaseExpiresAt: now + 30_100,
  });
  assert.equal(second.status, "in_progress");
});

test("InMemoryIdempotencyStore: returns conflict for same key with different fingerprint", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const { identity: id1 } = makeIdentity();
  const { identity: id2 } = makeIdentity({ fileBytes: DIFFERENT_FILE_BYTES });
  await store.claim({
    keyHash: id1.keyHash,
    fingerprint: id1.fingerprint,
    jobId: id1.jobId,
    ownerToken: "token-1",
    claimedAt: Date.now(),
    leaseExpiresAt: Date.now() + 30_000,
  });
  const conflictResult = await store.claim({
    keyHash: id1.keyHash,  // same key hash (would need same client key to get same keyHash)
    fingerprint: id2.fingerprint, // different fingerprint
    jobId: id2.jobId,
    ownerToken: "token-2",
    claimedAt: Date.now(),
    leaseExpiresAt: Date.now() + 30_000,
  });
  assert.equal(conflictResult.status, "conflict");
});

test("InMemoryIdempotencyStore: complete then re-claim returns complete status", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const { identity } = makeIdentity();
  const now = Date.now();
  await store.claim({
    keyHash: identity.keyHash,
    fingerprint: identity.fingerprint,
    jobId: identity.jobId,
    ownerToken: "token-1",
    claimedAt: now,
    leaseExpiresAt: now + 30_000,
  });
  await store.complete({
    keyHash: identity.keyHash,
    fingerprint: identity.fingerprint,
    jobId: identity.jobId,
    ownerToken: "token-1",
    completedAt: now + 5_000,
  });
  const replay = await store.claim({
    keyHash: identity.keyHash,
    fingerprint: identity.fingerprint,
    jobId: identity.jobId,
    ownerToken: "token-2",
    claimedAt: now + 6_000,
    leaseExpiresAt: now + 36_000,
  });
  assert.equal(replay.status, "complete");
});

test("InMemoryIdempotencyStore: release allows re-claim by another caller", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const { identity } = makeIdentity();
  const now = Date.now();
  await store.claim({
    keyHash: identity.keyHash,
    fingerprint: identity.fingerprint,
    jobId: identity.jobId,
    ownerToken: "token-1",
    claimedAt: now,
    leaseExpiresAt: now + 30_000,
  });
  await store.release({ keyHash: identity.keyHash, ownerToken: "token-1" });
  const second = await store.claim({
    keyHash: identity.keyHash,
    fingerprint: identity.fingerprint,
    jobId: identity.jobId,
    ownerToken: "token-2",
    claimedAt: now + 1_000,
    leaseExpiresAt: now + 31_000,
  });
  assert.equal(second.status, "claimed");
});

test("InMemoryIdempotencyStore: release by non-owner is a no-op (owner can still complete)", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const { identity } = makeIdentity();
  const now = Date.now();
  await store.claim({
    keyHash: identity.keyHash,
    fingerprint: identity.fingerprint,
    jobId: identity.jobId,
    ownerToken: "token-1",
    claimedAt: now,
    leaseExpiresAt: now + 30_000,
  });
  await store.release({ keyHash: identity.keyHash, ownerToken: "intruder-token" });
  const record = store.inspect(identity.keyHash);
  assert.equal(record.status, "in_progress");
});

test("InMemoryIdempotencyStore: expired lease allows re-claim", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const { identity } = makeIdentity();
  const past = Date.now() - 60_000;
  await store.claim({
    keyHash: identity.keyHash,
    fingerprint: identity.fingerprint,
    jobId: identity.jobId,
    ownerToken: "token-1",
    claimedAt: past,
    leaseExpiresAt: past + 1_000, // already expired
  });
  // Now re-claim with a fresh timestamp that is after the expiry
  const second = await store.claim({
    keyHash: identity.keyHash,
    fingerprint: identity.fingerprint,
    jobId: identity.jobId,
    ownerToken: "token-2",
    claimedAt: Date.now(),
    leaseExpiresAt: Date.now() + 30_000,
  });
  assert.equal(second.status, "claimed");
});

test("InMemoryIdempotencyStore: clear removes all records", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const { identity } = makeIdentity();
  await store.claim({
    keyHash: identity.keyHash,
    fingerprint: identity.fingerprint,
    jobId: identity.jobId,
    ownerToken: "token-1",
    claimedAt: Date.now(),
    leaseExpiresAt: Date.now() + 30_000,
  });
  store.clear();
  assert.equal(store.inspect(identity.keyHash), undefined);
});

// ---------------------------------------------------------------------------
// Section C: createIdempotentJobService — same key / same request returns same job
// ---------------------------------------------------------------------------

test("createIdempotentJobService: same key and same request returns same job on retry", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  let createCount = 0;
  const idResult = makeIdentity({ idempotencyKey: CLIENT_KEY });
  assert.equal(idResult.ok, true);
  const expectedJobResult = makeJobResult({ jobSheet: { jobId: idResult.identity.jobId, status: "DRAFT" } });

  const createIdempotently = createIdempotentJobService({
    store,
    leaseMs: 30_000,
    createJob: async ({ jobId }) => {
      createCount++;
      return { ...expectedJobResult, jobSheet: { ...expectedJobResult.jobSheet, jobId } };
    },
    loadJob: async ({ jobId }) => expectedJobResult,
  });

  // First call — should create the job
  const first = await createIdempotently({ identity: idResult.identity, request: {} });
  assert.equal(first.ok, true);
  assert.equal(createCount, 1);

  // Second call with same identity — should replay, not re-create
  const second = await createIdempotently({ identity: idResult.identity, request: {} });
  assert.equal(second.ok, true);
  assert.equal(createCount, 1, "createJob must not be called again for a complete record");
  assert.equal(second.jobSheet?.jobId ?? second.jobSheet?.jobId, expectedJobResult.jobSheet.jobId);
});

// ---------------------------------------------------------------------------
// Section D: Conflict — same key, different request
// ---------------------------------------------------------------------------

test("createIdempotentJobService: same client key with different request returns CONFLICT", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const id1 = makeIdentity({ idempotencyKey: CLIENT_KEY });
  // Simulate a different request fingerprint by using different file bytes but same client key
  // Both use CLIENT_KEY so keyHash is the same; fingerprint will differ
  const id2 = makeIdentity({
    idempotencyKey: CLIENT_KEY,
    fileBytes: DIFFERENT_FILE_BYTES,
  });
  assert.equal(id1.ok, true);
  assert.equal(id2.ok, true);
  // Both have same keyHash (same client key) but different fingerprints
  assert.equal(id1.identity.keyHash, id2.identity.keyHash);
  assert.notEqual(id1.identity.fingerprint, id2.identity.fingerprint);

  const createIdempotently = createIdempotentJobService({
    store,
    leaseMs: 30_000,
    createJob: async ({ jobId }) => makeJobResult({ jobSheet: { jobId, status: "DRAFT" } }),
    loadJob: async () => null,
  });

  // First call succeeds and completes
  const first = await createIdempotently({ identity: id1.identity, request: {} });
  assert.equal(first.ok, true);

  // Second call with same keyHash but different fingerprint — CONFLICT
  const second = await createIdempotently({ identity: id2.identity, request: {} });
  assert.equal(second.ok, false);
  assert.equal(second.error.code, "CONFLICT");
});

// ---------------------------------------------------------------------------
// Section E: Concurrent duplicate requests — only one job created
// ---------------------------------------------------------------------------

test("createIdempotentJobService: concurrent requests with same key only create one job", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  let createCount = 0;
  const idResult = makeIdentity({ idempotencyKey: CLIENT_KEY });

  let resolveCreate;
  const createBarrier = new Promise((resolve) => { resolveCreate = resolve; });

  const createIdempotently = createIdempotentJobService({
    store,
    leaseMs: 30_000,
    createJob: async ({ jobId }) => {
      createCount++;
      await createBarrier; // hold the first caller while the second tries to claim
      return makeJobResult({ jobSheet: { jobId, status: "DRAFT" } });
    },
    loadJob: async () => null,
  });

  // Start first call — it claims and starts creating
  const firstPromise = createIdempotently({ identity: idResult.identity, request: {} });

  // Start second call before first finishes — should get in_progress
  const secondPromise = createIdempotently({ identity: idResult.identity, request: {} });

  // Unblock the first
  resolveCreate();
  const [first, second] = await Promise.all([firstPromise, secondPromise]);

  assert.equal(first.ok, true);
  assert.equal(createCount, 1, "createJob should only be called once");

  // Second gets in_progress — caller must retry after the first completes
  assert.equal(second.ok, false);
  assert.equal(second.error.code, "IDEMPOTENCY_IN_PROGRESS");
});

// ---------------------------------------------------------------------------
// Section F: Retry after failure — released claim can be retried
// ---------------------------------------------------------------------------

test("createIdempotentJobService: failed job creation releases the claim so it can be retried", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  let attempt = 0;
  const idResult = makeIdentity({ idempotencyKey: CLIENT_KEY });

  const createIdempotently = createIdempotentJobService({
    store,
    leaseMs: 30_000,
    createJob: async ({ jobId }) => {
      attempt++;
      if (attempt === 1) {
        // First attempt fails
        return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Extraction unavailable." } };
      }
      // Second attempt succeeds
      return makeJobResult({ jobSheet: { jobId, status: "DRAFT" } });
    },
    loadJob: async () => null,
  });

  const first = await createIdempotently({ identity: idResult.identity, request: {} });
  // First attempt: createJob failed — claim is released
  assert.equal(first.ok, false);
  assert.equal(attempt, 1);
  // The claim should be released (no record in store)
  assert.equal(store.inspect(idResult.identity.keyHash), undefined);

  const second = await createIdempotently({ identity: idResult.identity, request: {} });
  assert.equal(second.ok, true);
  assert.equal(attempt, 2);
});

test("createIdempotentJobService: in-progress (not-durable) result releases claim for retry", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const idResult = makeIdentity({ idempotencyKey: CLIENT_KEY });

  const createIdempotently = createIdempotentJobService({
    store,
    leaseMs: 30_000,
    createJob: async ({ jobId }) => {
      // Returns ok:true but durable:false — no persistence adapter
      return { ok: true, runId: "r1", jobSheet: { jobId, status: "DRAFT" } };
    },
    loadJob: async () => null,
  });

  const result = await createIdempotently({ identity: idResult.identity, request: {} });
  // Without durable:true the service releases and returns SERVICE_UNAVAILABLE
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  // Claim should be released
  assert.equal(store.inspect(idResult.identity.keyHash), undefined);
});

// ---------------------------------------------------------------------------
// Section G: Separate service instances sharing the same fake store
// ---------------------------------------------------------------------------

test("createIdempotentJobService: two service instances sharing a store behave idempotently", async () => {
  // Simulates two application replicas sharing the same backend store.
  // In production this store would be a real shared persistence adapter.
  const sharedStore = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  let createCalls = 0;
  const idResult = makeIdentity({ idempotencyKey: CLIENT_KEY });
  const expectedResult = makeJobResult({ jobSheet: { jobId: idResult.identity.jobId, status: "DRAFT" } });

  function makeInstance() {
    return createIdempotentJobService({
      store: sharedStore,
      leaseMs: 30_000,
      createJob: async ({ jobId }) => {
        createCalls++;
        return { ...expectedResult, jobSheet: { ...expectedResult.jobSheet, jobId } };
      },
      loadJob: async () => expectedResult,
    });
  }

  const instance1 = makeInstance();
  const instance2 = makeInstance();

  // Instance 1 creates the job
  const result1 = await instance1({ identity: idResult.identity, request: {} });
  assert.equal(result1.ok, true);
  assert.equal(createCalls, 1);

  // Instance 2 retries — should replay, not re-create
  const result2 = await instance2({ identity: idResult.identity, request: {} });
  assert.equal(result2.ok, true);
  assert.equal(createCalls, 1, "Second instance must not re-create the job");
});

// ---------------------------------------------------------------------------
// Section H: Missing/absent key — fingerprint-derived key is used
// ---------------------------------------------------------------------------

test("createJobRequestIdentity: request without client key uses fingerprint-derived key", () => {
  const r = makeIdentity(); // no idempotencyKey
  assert.equal(r.ok, true);
  assert.match(r.identity.keyHash, /^[a-f0-9]{64}$/);
  assert.match(r.identity.fingerprint, /^[a-f0-9]{64}$/);
  // keyHash must be deterministic for same request
  const r2 = makeIdentity();
  assert.equal(r.identity.keyHash, r2.identity.keyHash);
});

test("createIdempotentJobService: missing client key falls back to fingerprint-based idempotency", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  let createCount = 0;
  const idResult = makeIdentity(); // no idempotencyKey
  assert.equal(idResult.ok, true);

  const createIdempotently = createIdempotentJobService({
    store,
    leaseMs: 30_000,
    createJob: async ({ jobId }) => {
      createCount++;
      return makeJobResult({ jobSheet: { jobId, status: "DRAFT" } });
    },
    loadJob: async ({ jobId }) => makeJobResult({ jobSheet: { jobId, status: "DRAFT" } }),
  });

  const first = await createIdempotently({ identity: idResult.identity, request: {} });
  assert.equal(first.ok, true);
  assert.equal(createCount, 1);

  const second = await createIdempotently({ identity: idResult.identity, request: {} });
  assert.equal(second.ok, true);
  assert.equal(createCount, 1);
});

// ---------------------------------------------------------------------------
// Section I: Backward compatibility — createIdempotentJobService not required
// ---------------------------------------------------------------------------

test("createIdempotentJobService: returns SERVICE_UNAVAILABLE when store is missing", async () => {
  // Simulates the case where no store is configured — the route should fall back
  const createIdempotently = createIdempotentJobService({
    // store omitted
    leaseMs: 30_000,
    createJob: async () => makeJobResult(),
    loadJob: async () => null,
  });
  const idResult = makeIdentity();
  const result = await createIdempotently({ identity: idResult.identity, request: {} });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
});

test("createIdempotentJobService: invalid identity returns VALIDATION_ERROR not an exception", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const createIdempotently = createIdempotentJobService({
    store,
    leaseMs: 30_000,
    createJob: async () => makeJobResult(),
    loadJob: async () => null,
  });
  const result = await createIdempotently({ identity: { keyHash: "not-valid", fingerprint: "not-valid", jobId: "bad" }, request: {} });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
});

test("createIdempotentJobService: AbortError propagates rather than being swallowed", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const controller = new AbortController();
  const idResult = makeIdentity({ idempotencyKey: CLIENT_KEY });

  const createIdempotently = createIdempotentJobService({
    store,
    leaseMs: 30_000,
    createJob: async ({ signal }) => {
      controller.abort();
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    },
    loadJob: async () => null,
  });

  await assert.rejects(
    () => createIdempotently({ identity: idResult.identity, request: {}, signal: controller.signal }),
    { name: "AbortError" }
  );
  // Claim is released after abort
  assert.equal(store.inspect(idResult.identity.keyHash), undefined);
});

// ---------------------------------------------------------------------------
// Section J: loadJob error handling
// ---------------------------------------------------------------------------

test("createIdempotentJobService: loadJob failure returns SERVICE_UNAVAILABLE on replay", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const idResult = makeIdentity({ idempotencyKey: CLIENT_KEY });

  const createIdempotently = createIdempotentJobService({
    store,
    leaseMs: 30_000,
    createJob: async ({ jobId }) => makeJobResult({ jobSheet: { jobId, status: "DRAFT" } }),
    loadJob: async () => { throw new Error("storage read error"); },
  });

  // First call — creates and completes
  await createIdempotently({ identity: idResult.identity, request: {} });

  // Second call — complete record exists but loadJob throws
  const replay = await createIdempotently({ identity: idResult.identity, request: {} });
  assert.equal(replay.ok, false);
  assert.equal(replay.error.code, "SERVICE_UNAVAILABLE");
});

test("createIdempotentJobService: an unconfirmed durable completion is not reported as success", async () => {
  const idResult = makeIdentity({ idempotencyKey: CLIENT_KEY });
  const calls = [];
  const createIdempotently = createIdempotentJobService({
    store: {
      claim: async ({ ownerToken }) => ({ status: "claimed", ownerToken }),
      complete: async () => { calls.push("complete"); return false; },
      release: async () => { calls.push("release"); return true; },
    },
    leaseMs: 30_000,
    createJob: async ({ jobId }) => ({
      ok: true,
      durable: true,
      jobId,
      jobSheet: { jobId, status: "DRAFT" },
    }),
    loadJob: async () => null,
  });

  const result = await createIdempotently({ identity: idResult.identity, request: {} });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  assert.match(result.error.message, /claim could not be completed/);
  assert.deepEqual(calls, ["complete"]);
});

// ---------------------------------------------------------------------------
// Section K: Key/fingerprint isolation — different client keys don't share slots
// ---------------------------------------------------------------------------

test("createIdempotentJobService: different client keys create independent slots", async () => {
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  let createCount = 0;

  const createIdempotently = createIdempotentJobService({
    store,
    leaseMs: 30_000,
    createJob: async ({ jobId }) => {
      createCount++;
      return makeJobResult({ jobSheet: { jobId, status: "DRAFT" } });
    },
    loadJob: async ({ jobId }) => makeJobResult({ jobSheet: { jobId, status: "DRAFT" } }),
  });

  const id1 = makeIdentity({ idempotencyKey: "key-a" });
  const id2 = makeIdentity({ idempotencyKey: "key-b" });
  assert.equal(id1.ok, true);
  assert.equal(id2.ok, true);
  assert.notEqual(id1.identity.keyHash, id2.identity.keyHash);

  await createIdempotently({ identity: id1.identity, request: {} });
  await createIdempotently({ identity: id2.identity, request: {} });

  assert.equal(createCount, 2, "Each key should create its own job");
});
