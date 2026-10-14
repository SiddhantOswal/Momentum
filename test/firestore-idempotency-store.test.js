/**
 * Offline tests for FirestoreIdempotencyStore.
 *
 * All tests use a fake fetch and fake token provider — no live Firestore
 * calls, no cloud mutations, no live tokens.
 *
 * These tests verify:
 *   - Adapter construction and validation
 *   - Firestore REST API request structure (URL, method, body shape)
 *   - claim: new document → claimed
 *   - claim: existing complete document → complete
 *   - claim: existing in_progress with active lease → in_progress
 *   - claim: existing in_progress with expired lease → delete+create → claimed
 *   - claim: existing document with different fingerprint → conflict
 *   - claim: 409 race condition → re-read and determine status
 *   - complete: updates only recordStatus and completedAt fields
 *   - complete: non-owner token is a no-op
 *   - release: deletes document if owned
 *   - release: non-owner token is a no-op
 *   - release: complete record is not deleted
 *   - Token unavailable → throws FirestoreIdempotencyError
 *   - Network error → throws FirestoreIdempotencyError
 *   - AbortError propagates
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createIdempotentJobService } from "../src/job-idempotency.js";
import {
  createFirestoreIdempotencyStore,
  FirestoreIdempotencyError,
} from "../src/google-cloud/firestore-idempotency-store.js";

// ---------------------------------------------------------------------------
// Test utilities
// ---------------------------------------------------------------------------

const PROJECT_ID = "prepagent-hack";
const KEY_HASH = "a".repeat(64);
const FINGERPRINT = "b".repeat(64);
const JOB_ID = `JOB-${"a".repeat(40)}`;
const OWNER_TOKEN = "owner-token-1";
const NOW = 1_700_000_000_000; // fixed ms timestamp
const LEASE_EXPIRES = NOW + 30_000;

function fakeToken() {
  return async () => "fake-access-token";
}

/** Build a Firestore document body with the given fields as plain JS values. */
function firestoreDoc(fields) {
  const mapped = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => {
      if (typeof v === "string") return [k, { stringValue: v }];
      if (typeof v === "boolean") return [k, { booleanValue: v }];
      if (typeof v === "number" && Number.isInteger(v)) return [k, { integerValue: String(v) }];
      if (typeof v === "number") return [k, { doubleValue: v }];
      if (v === null) return [k, { nullValue: null }];
      return [k, v];
    })
  );
  return JSON.stringify({ fields: mapped, updateTime: "2026-10-14T12:00:00.000Z" });
}

function inProgressDoc(overrides = {}) {
  return firestoreDoc({
    keyHash: KEY_HASH,
    fingerprint: FINGERPRINT,
    jobId: JOB_ID,
    ownerToken: OWNER_TOKEN,
    recordStatus: "in_progress",
    claimedAt: NOW,
    leaseExpiresAt: LEASE_EXPIRES,
    ...overrides,
  });
}

function completeDoc() {
  return firestoreDoc({
    keyHash: KEY_HASH,
    fingerprint: FINGERPRINT,
    jobId: JOB_ID,
    ownerToken: OWNER_TOKEN,
    recordStatus: "complete",
    claimedAt: NOW,
    leaseExpiresAt: LEASE_EXPIRES,
    completedAt: NOW + 5_000,
  });
}

/**
 * Build a fake fetch that responds in sequence to the calls made during a
 * claim/complete/release lifecycle. Each entry in `responses` is used once
 * in order.
 */
function fakeSequence(responses) {
  let index = 0;
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options?.method ?? "GET", body: options?.body });
    const r = responses[index++];
    if (!r) throw new Error(`fakeSequence: unexpected call #${index} to ${url}`);
    return {
      ok: r.status < 400,
      status: r.status,
      json: async () => r.body,
    };
  };
  return { fetchImpl, calls };
}

function makeStore(fetchImpl) {
  return createFirestoreIdempotencyStore({
    projectId: PROJECT_ID,
    fetchImpl,
    tokenProvider: fakeToken(),
  });
}

function claimArgs(overrides = {}) {
  return {
    keyHash: KEY_HASH,
    fingerprint: FINGERPRINT,
    jobId: JOB_ID,
    ownerToken: OWNER_TOKEN,
    claimedAt: NOW,
    leaseExpiresAt: LEASE_EXPIRES,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Section A: Construction
// ---------------------------------------------------------------------------

test("FirestoreIdempotencyStore: rejects invalid projectId", () => {
  assert.throws(
    () => createFirestoreIdempotencyStore({ projectId: "INVALID PROJECT", fetchImpl: fetch }),
    TypeError
  );
});

test("FirestoreIdempotencyStore: rejects missing fetchImpl", () => {
  assert.throws(
    () => createFirestoreIdempotencyStore({ projectId: PROJECT_ID, fetchImpl: "not-a-function" }),
    TypeError
  );
});

test("FirestoreIdempotencyStore: constructs successfully with valid parameters", () => {
  const store = createFirestoreIdempotencyStore({
    projectId: PROJECT_ID,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    tokenProvider: fakeToken(),
  });
  assert.equal(typeof store.claim, "function");
  assert.equal(typeof store.complete, "function");
  assert.equal(typeof store.release, "function");
});

// ---------------------------------------------------------------------------
// Section B: claim — new document (404 → POST 201 → claimed)
// ---------------------------------------------------------------------------

test("FirestoreIdempotencyStore: claim on absent document creates and returns claimed", async () => {
  const { fetchImpl, calls } = fakeSequence([
    { status: 404, body: { error: { code: 404 } } },           // GET — not found
    { status: 200, body: {} },                                  // POST createDocument
  ]);
  const store = makeStore(fetchImpl);
  const result = await store.claim(claimArgs());
  assert.equal(result.status, "claimed");
  assert.equal(result.ownerToken, OWNER_TOKEN);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[1].method, "POST");
  assert.match(calls[1].url, /documentId=/);
  const posted = JSON.parse(calls[1].body);
  assert.equal(posted.fields.recordStatus.stringValue, "in_progress");
  assert.equal(posted.fields.ownerToken.stringValue, OWNER_TOKEN);
  assert.equal(posted.fields.keyHash.stringValue, KEY_HASH);
});

// ---------------------------------------------------------------------------
// Section C: claim — existing complete document
// ---------------------------------------------------------------------------

test("FirestoreIdempotencyStore: claim on complete document returns complete", async () => {
  const { fetchImpl } = fakeSequence([
    { status: 200, body: JSON.parse(completeDoc()) },
  ]);
  const result = await makeStore(fetchImpl).claim(claimArgs());
  assert.equal(result.status, "complete");
});

// ---------------------------------------------------------------------------
// Section D: claim — existing in_progress with active lease
// ---------------------------------------------------------------------------

test("FirestoreIdempotencyStore: claim on in_progress active-lease returns in_progress", async () => {
  const { fetchImpl } = fakeSequence([
    { status: 200, body: JSON.parse(inProgressDoc()) },
  ]);
  const result = await makeStore(fetchImpl).claim(claimArgs({ claimedAt: NOW + 100 }));
  assert.equal(result.status, "in_progress");
});

// ---------------------------------------------------------------------------
// Section E: claim — expired lease (re-claim path)
// ---------------------------------------------------------------------------

test("FirestoreIdempotencyStore: claim on expired lease deletes then creates — returns claimed", async () => {
  const expiredDoc = inProgressDoc({ leaseExpiresAt: NOW - 1 }); // expired before claimedAt
  const { fetchImpl, calls } = fakeSequence([
    { status: 200, body: JSON.parse(expiredDoc) },  // GET — exists but expired
    { status: 200, body: {} },                       // DELETE — remove stale record
    { status: 200, body: {} },                       // POST — new claim
  ]);
  const result = await makeStore(fetchImpl).claim(claimArgs());
  assert.equal(result.status, "claimed");
  assert.equal(calls[1].method, "DELETE");
  assert.equal(new URL(calls[1].url).searchParams.get("currentDocument.updateTime"), "2026-10-14T12:00:00.000Z");
  assert.equal(calls[2].method, "POST");
});

test("FirestoreIdempotencyStore: expired-lease delete cannot remove a concurrently renewed claim", async () => {
  const renewed = JSON.parse(inProgressDoc({
    ownerToken: "new-owner",
    leaseExpiresAt: NOW + 60_000,
  }));
  const { fetchImpl, calls } = fakeSequence([
    { status: 200, body: JSON.parse(inProgressDoc({ leaseExpiresAt: NOW - 1 })) },
    { status: 400, body: { error: { status: "FAILED_PRECONDITION" } } },
    { status: 200, body: renewed },
  ]);
  const result = await makeStore(fetchImpl).claim(claimArgs());
  assert.deepEqual(result, { status: "in_progress" });
  assert.deepEqual(calls.map((call) => call.method), ["GET", "DELETE", "GET"]);
});

// ---------------------------------------------------------------------------
// Section F: claim — conflict (same keyHash, different fingerprint)
// ---------------------------------------------------------------------------

test("FirestoreIdempotencyStore: claim with different fingerprint returns conflict", async () => {
  const docWithDifferentFingerprint = inProgressDoc({ fingerprint: "c".repeat(64) });
  const { fetchImpl } = fakeSequence([
    { status: 200, body: JSON.parse(docWithDifferentFingerprint) },
  ]);
  const result = await makeStore(fetchImpl).claim(claimArgs());
  assert.equal(result.status, "conflict");
});

// ---------------------------------------------------------------------------
// Section G: claim — 409 race condition
// ---------------------------------------------------------------------------

test("FirestoreIdempotencyStore: 409 on create triggers re-read and returns in_progress", async () => {
  const { fetchImpl, calls } = fakeSequence([
    { status: 404, body: {} },                                   // initial GET — absent
    { status: 409, body: { error: { code: 409 } } },             // POST — race conflict
    { status: 200, body: JSON.parse(inProgressDoc()) },          // re-read GET
  ]);
  const result = await makeStore(fetchImpl).claim(claimArgs({ claimedAt: NOW + 100 }));
  assert.equal(result.status, "in_progress");
  assert.equal(calls[2].method, "GET");
});

test("FirestoreIdempotencyStore: 409 on create with complete re-read returns complete", async () => {
  const { fetchImpl } = fakeSequence([
    { status: 404, body: {} },
    { status: 409, body: {} },
    { status: 200, body: JSON.parse(completeDoc()) },
  ]);
  const result = await makeStore(fetchImpl).claim(claimArgs());
  assert.equal(result.status, "complete");
});

// ---------------------------------------------------------------------------
// Section H: complete
// ---------------------------------------------------------------------------

test("FirestoreIdempotencyStore: complete sends PATCH with only status and completedAt fields", async () => {
  const { fetchImpl, calls } = fakeSequence([
    { status: 200, body: JSON.parse(inProgressDoc()) },  // GET to verify ownership
    { status: 200, body: {} },                            // PATCH
  ]);
  const completed = await makeStore(fetchImpl).complete({
    keyHash: KEY_HASH,
    fingerprint: FINGERPRINT,
    jobId: JOB_ID,
    ownerToken: OWNER_TOKEN,
    completedAt: NOW + 5_000,
  });
  assert.equal(calls[1].method, "PATCH");
  const patchUrl = new URL(calls[1].url);
  assert.equal(patchUrl.searchParams.get("currentDocument.updateTime"), "2026-10-14T12:00:00.000Z");
  assert.deepEqual(patchUrl.searchParams.getAll("updateMask.fieldPaths"), ["recordStatus", "completedAt"]);
  const patched = JSON.parse(calls[1].body);
  assert.equal(patched.fields.recordStatus.stringValue, "complete");
  assert.equal(patched.fields.completedAt.integerValue, String(NOW + 5_000));
  assert.equal(completed, true);
});

test("FirestoreIdempotencyStore: complete with wrong ownerToken is a no-op (only GET issued)", async () => {
  const { fetchImpl, calls } = fakeSequence([
    { status: 200, body: JSON.parse(inProgressDoc()) },
  ]);
  await makeStore(fetchImpl).complete({
    keyHash: KEY_HASH,
    fingerprint: FINGERPRINT,
    jobId: JOB_ID,
    ownerToken: "wrong-token",
    completedAt: NOW + 5_000,
  });
  assert.equal(calls.length, 1, "only the GET should have been issued");
});

test("FirestoreIdempotencyStore: complete on absent record is a no-op", async () => {
  const { fetchImpl, calls } = fakeSequence([
    { status: 404, body: {} },
  ]);
  await makeStore(fetchImpl).complete({
    keyHash: KEY_HASH, fingerprint: FINGERPRINT, jobId: JOB_ID,
    ownerToken: OWNER_TOKEN, completedAt: NOW,
  });
  assert.equal(calls.length, 1);
});

test("FirestoreIdempotencyStore: completion cannot overwrite a newer owner's claim", async () => {
  const newerOwner = JSON.parse(inProgressDoc({ ownerToken: "new-owner" }));
  const { fetchImpl, calls } = fakeSequence([
    { status: 200, body: JSON.parse(inProgressDoc()) },
    { status: 400, body: { error: { status: "FAILED_PRECONDITION" } } },
    { status: 200, body: newerOwner },
  ]);
  const completed = await makeStore(fetchImpl).complete({
    keyHash: KEY_HASH,
    fingerprint: FINGERPRINT,
    jobId: JOB_ID,
    ownerToken: OWNER_TOKEN,
    completedAt: NOW + 5_000,
  });
  assert.equal(completed, false);
  assert.deepEqual(calls.map((call) => call.method), ["GET", "PATCH", "GET"]);
});

test("FirestoreIdempotencyStore: release cannot delete a newer owner's claim", async () => {
  const { fetchImpl, calls } = fakeSequence([
    { status: 200, body: JSON.parse(inProgressDoc()) },
    { status: 400, body: { error: { status: "FAILED_PRECONDITION" } } },
  ]);
  const released = await makeStore(fetchImpl).release({ keyHash: KEY_HASH, ownerToken: OWNER_TOKEN });
  assert.equal(released, false);
  assert.equal(calls[1].method, "DELETE");
  assert.equal(new URL(calls[1].url).searchParams.get("currentDocument.updateTime"), "2026-10-14T12:00:00.000Z");
});

test("FirestoreIdempotencyStore: unexpected conditional-write failure is surfaced", async () => {
  const { fetchImpl } = fakeSequence([
    { status: 200, body: JSON.parse(inProgressDoc()) },
    { status: 500, body: {} },
  ]);
  await assert.rejects(
    () => makeStore(fetchImpl).complete({
      keyHash: KEY_HASH,
      fingerprint: FINGERPRINT,
      jobId: JOB_ID,
      ownerToken: OWNER_TOKEN,
      completedAt: NOW + 5_000,
    }),
    (error) => error instanceof FirestoreIdempotencyError && error.code === "FIRESTORE_UNAVAILABLE",
  );
});

// ---------------------------------------------------------------------------
// Section I: release
// ---------------------------------------------------------------------------

test("FirestoreIdempotencyStore: release deletes document when owner matches", async () => {
  const { fetchImpl, calls } = fakeSequence([
    { status: 200, body: JSON.parse(inProgressDoc()) },
    { status: 200, body: {} },
  ]);
  await makeStore(fetchImpl).release({ keyHash: KEY_HASH, ownerToken: OWNER_TOKEN });
  assert.equal(calls[1].method, "DELETE");
  assert.equal(new URL(calls[1].url).searchParams.get("currentDocument.updateTime"), "2026-10-14T12:00:00.000Z");
});

test("FirestoreIdempotencyStore: release with wrong ownerToken is a no-op", async () => {
  const { fetchImpl, calls } = fakeSequence([
    { status: 200, body: JSON.parse(inProgressDoc()) },
  ]);
  await makeStore(fetchImpl).release({ keyHash: KEY_HASH, ownerToken: "wrong" });
  assert.equal(calls.length, 1, "DELETE must not be issued for a non-owner token");
});

test("FirestoreIdempotencyStore: release does not delete a complete record", async () => {
  const { fetchImpl, calls } = fakeSequence([
    { status: 200, body: JSON.parse(completeDoc()) },
  ]);
  await makeStore(fetchImpl).release({ keyHash: KEY_HASH, ownerToken: OWNER_TOKEN });
  assert.equal(calls.length, 1, "DELETE must not be issued for a complete record");
});

test("FirestoreIdempotencyStore: release on absent record is a no-op", async () => {
  const { fetchImpl, calls } = fakeSequence([
    { status: 404, body: {} },
  ]);
  await makeStore(fetchImpl).release({ keyHash: KEY_HASH, ownerToken: OWNER_TOKEN });
  assert.equal(calls.length, 1);
});

// ---------------------------------------------------------------------------
// Section J: Error handling
// ---------------------------------------------------------------------------

test("FirestoreIdempotencyStore: unavailable token throws FirestoreIdempotencyError", async () => {
  const store = createFirestoreIdempotencyStore({
    projectId: PROJECT_ID,
    fetchImpl: async () => { throw new Error("should not be called"); },
    tokenProvider: async () => "",
  });
  await assert.rejects(
    () => store.claim(claimArgs()),
    (err) => err instanceof FirestoreIdempotencyError && err.code === "CLOUD_IDENTITY_UNAVAILABLE"
  );
});

test("FirestoreIdempotencyStore: network error on GET throws FirestoreIdempotencyError", async () => {
  const store = createFirestoreIdempotencyStore({
    projectId: PROJECT_ID,
    fetchImpl: async () => { throw new Error("ECONNREFUSED"); },
    tokenProvider: fakeToken(),
  });
  await assert.rejects(
    () => store.claim(claimArgs()),
    (err) => err instanceof FirestoreIdempotencyError && err.code === "FIRESTORE_UNAVAILABLE"
  );
});

test("FirestoreIdempotencyStore: AbortError propagates from fetch", async () => {
  const abortErr = new Error("aborted");
  abortErr.name = "AbortError";
  const store = createFirestoreIdempotencyStore({
    projectId: PROJECT_ID,
    fetchImpl: async () => { throw abortErr; },
    tokenProvider: fakeToken(),
  });
  await assert.rejects(
    () => store.claim(claimArgs()),
    { name: "AbortError" }
  );
});

test("FirestoreIdempotencyStore: unexpected GET status throws FirestoreIdempotencyError", async () => {
  const { fetchImpl } = fakeSequence([
    { status: 500, body: { error: { code: 500 } } },
  ]);
  await assert.rejects(
    () => makeStore(fetchImpl).claim(claimArgs()),
    (err) => err instanceof FirestoreIdempotencyError && err.code === "FIRESTORE_UNAVAILABLE"
  );
});

function firestoreBackend() {
  const documents = new Map();
  let version = 0;
  const encode = (fields) => Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if (typeof value === "string") return [key, { stringValue: value }];
    if (typeof value === "number") return [key, { integerValue: String(value) }];
    return [key, value];
  }));
  const decode = (fields) => Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if (value.stringValue !== undefined) return [key, value.stringValue];
    if (value.integerValue !== undefined) return [key, Number(value.integerValue)];
    return [key, value];
  }));
  const fetchImpl = async (rawUrl, options = {}) => {
    const url = new URL(rawUrl);
    const method = options.method ?? "GET";
    const documentId = method === "POST"
      ? url.searchParams.get("documentId")
      : decodeURIComponent(url.pathname.split("/").at(-1));
    const current = documents.get(documentId);
    const requestedVersion = url.searchParams.get("currentDocument.updateTime");
    const response = (status, body = {}) => ({ status, ok: status < 400, json: async () => body });

    if (method === "GET") return current ? response(200, current) : response(404);
    if (method === "POST") {
      if (current) return response(409);
      const body = JSON.parse(options.body);
      const document = { fields: body.fields, updateTime: `version-${++version}` };
      documents.set(documentId, document);
      return response(201, document);
    }
    if (method === "DELETE") {
      if (!current) return response(404);
      if (current.updateTime !== requestedVersion) return response(409);
      documents.delete(documentId);
      return response(200);
    }
    if (method === "PATCH") {
      if (!current) return response(404);
      if (current.updateTime !== requestedVersion) return response(409);
      const patch = JSON.parse(options.body);
      const document = {
        fields: { ...current.fields, ...patch.fields },
        updateTime: `version-${++version}`,
      };
      documents.set(documentId, document);
      return response(200, document);
    }
    return response(405);
  };
  return { documents, fetchImpl, encode, decode };
}

test("Firestore-backed idempotency survives service reconstruction and serializes concurrent claims", async () => {
  const backend = firestoreBackend();
  const store = () => createFirestoreIdempotencyStore({
    projectId: PROJECT_ID,
    fetchImpl: backend.fetchImpl,
    tokenProvider: fakeToken(),
  });
  const identity = {
    keyHash: KEY_HASH,
    fingerprint: FINGERPRINT,
    jobId: JOB_ID,
  };
  let createCount = 0;
  let finishCreate;
  const createBarrier = new Promise((resolve) => { finishCreate = resolve; });
  const storedJob = { ok: true, jobId: JOB_ID, durable: true, jobSheet: { jobId: JOB_ID, status: "DRAFT" } };
  const loadJob = async () => storedJob;
  const firstService = createIdempotentJobService({
    store: store(),
    leaseMs: 30_000,
    createJob: async () => {
      createCount += 1;
      await createBarrier;
      return storedJob;
    },
    loadJob,
  });
  const secondService = createIdempotentJobService({
    store: store(),
    leaseMs: 30_000,
    createJob: async () => { createCount += 1; return storedJob; },
    loadJob,
  });

  const firstPromise = firstService({ identity, request: {} });
  const concurrent = await secondService({ identity, request: {} });
  assert.equal(concurrent.ok, false);
  assert.equal(concurrent.error.code, "IDEMPOTENCY_IN_PROGRESS");
  finishCreate();
  const first = await firstPromise;
  assert.equal(first.ok, true);
  assert.equal(createCount, 1);

  const restartedService = createIdempotentJobService({
    store: store(),
    leaseMs: 30_000,
    createJob: async () => { createCount += 1; return storedJob; },
    loadJob,
  });
  const replay = await restartedService({ identity, request: {} });
  assert.deepEqual(replay, storedJob);
  assert.equal(createCount, 1);

  const conflict = await restartedService({
    identity: { ...identity, fingerprint: "c".repeat(64) },
    request: {},
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.error.code, "CONFLICT");
});

test("Firestore-backed idempotency releases failed work so the same request can retry", async () => {
  const backend = firestoreBackend();
  const store = createFirestoreIdempotencyStore({
    projectId: PROJECT_ID,
    fetchImpl: backend.fetchImpl,
    tokenProvider: fakeToken(),
  });
  const identity = { keyHash: KEY_HASH, fingerprint: FINGERPRINT, jobId: JOB_ID };
  let attempts = 0;
  const service = createIdempotentJobService({
    store,
    leaseMs: 30_000,
    createJob: async () => {
      attempts += 1;
      return attempts === 1
        ? { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "retry" } }
        : { ok: true, jobId: JOB_ID, durable: true, jobSheet: { jobId: JOB_ID, status: "DRAFT" } };
    },
    loadJob: async () => null,
  });

  assert.equal((await service({ identity, request: {} })).ok, false);
  const retry = await service({ identity, request: {} });
  assert.equal(retry.ok, true);
  assert.equal(attempts, 2);
});

// ---------------------------------------------------------------------------
// Section K: Correct Firestore REST URL structure
// ---------------------------------------------------------------------------

test("FirestoreIdempotencyStore: GET URL uses correct project/database/collection/document path", async () => {
  const { fetchImpl, calls } = fakeSequence([
    { status: 404, body: {} },
    { status: 200, body: {} },
  ]);
  await makeStore(fetchImpl).claim(claimArgs());
  // encodeURIComponent encodes parentheses: (default) → %28default%29
  const encodedDatabase = encodeURIComponent("(default)");
  const expectedBase = `https://firestore.googleapis.com/v1/projects/prepagent-hack/databases/${encodedDatabase}/documents/job_idempotency/${KEY_HASH}`;
  assert.equal(calls[0].url, expectedBase, "GET URL should point to the document by keyHash");
});

test("FirestoreIdempotencyStore: POST URL includes documentId query parameter equal to keyHash", async () => {
  const { fetchImpl, calls } = fakeSequence([
    { status: 404, body: {} },
    { status: 200, body: {} },
  ]);
  await makeStore(fetchImpl).claim(claimArgs());
  assert.match(calls[1].url, new RegExp(`documentId=${encodeURIComponent(KEY_HASH)}`));
});
