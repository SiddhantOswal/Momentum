import assert from "node:assert/strict";
import test from "node:test";
import {
  createFirestorePoReviewStore,
  MAX_PO_REVIEW_DOCUMENT_BYTES,
} from "../src/google-cloud/firestore-po-review-store.js";
import { createFakeFirestore } from "./fixtures/fake-firestore.js";

const REVIEW_ID = "6f1c2b9e-3d4a-4f5b-8c7d-9e0a1b2c3d4e";
const SESSION_ID = "a".repeat(32);

function reviewDoc(overrides = {}) {
  return {
    schemaVersion: 1,
    createdAt: "2026-12-04T04:00:00.000Z",
    updatedAt: "2026-12-04T04:00:00.000Z",
    expiresAt: "2026-12-05T04:00:00.000Z",
    reviewId: REVIEW_ID,
    ownerSessionId: SESSION_ID,
    reviewFingerprint: "b".repeat(64),
    fileDigest: "c".repeat(64),
    operatorFields: { orderId: "PO-TEST-42", paperType: "RECYCLED" },
    result: {
      ok: true,
      agent: "extractOrder",
      source: "mock-demo",
      isRealModelPrediction: false,
      purchaseOrderDocument: { poNumber: "PO-TEST-42", buyer: "CUSTOMER-TEST-42" },
      documentMissingFields: [],
      lines: [{
        lineIndex: 0,
        sourcePage: 1,
        extractedItemCode: "SKU-TEST-42",
        quantity: 100,
        status: "MATCHED",
        catalogStatus: "MATCHED",
        candidates: [],
        resolvedItemCode: "SKU-TEST-42",
      }],
      missingFields: [],
      needsClarification: false,
    },
    reviewExpiresAt: "2026-12-04T04:30:00.000Z",
    ...overrides,
  };
}

function store(fake, options = {}) {
  return createFirestorePoReviewStore({
    projectId: "prepagent-hack",
    fetchImpl: fake.fetchImpl,
    tokenProvider: async () => "test-token",
    ...options,
  });
}

test("a review written through one store client is read back by another", async () => {
  const fake = createFakeFirestore();
  await store(fake).create(reviewDoc());

  const read = await store(fake).get(REVIEW_ID);
  assert.deepEqual(read, reviewDoc());

  const [write] = fake.calls;
  assert.equal(write.method, "POST");
  assert.ok(write.url.endsWith(`/documents/po_reviews?documentId=${REVIEW_ID}`));
  for (const field of ["createdAt", "updatedAt", "expiresAt", "reviewExpiresAt"]) {
    assert.ok(write.body.fields[field].timestampValue, `${field} is stored as a Timestamp for the TTL policy`);
  }
});

test("a missing review reads as null and a malformed review ID makes no request", async () => {
  const fake = createFakeFirestore();
  assert.equal(await store(fake).get(REVIEW_ID), null);
  assert.equal(await store(fake).get("not-a-review-id"), null);
  assert.equal(fake.calls.length, 1);
});

test("a stored review that fails its schema is SERVICE_UNAVAILABLE, never absent", async () => {
  const fake = createFakeFirestore();
  await store(fake).create(reviewDoc());
  const stored = fake.documents.get(fake.documentName("po_reviews", REVIEW_ID));
  stored.fields.ownerSessionId = { stringValue: "not-a-session" };

  await assert.rejects(store(fake).get(REVIEW_ID), { name: "FirestoreRestError", code: "SERVICE_UNAVAILABLE" });

  stored.fields.ownerSessionId = { stringValue: SESSION_ID };
  stored.fields.reviewExpiresAt = { timestampValue: "half past four" };
  await assert.rejects(store(fake).get(REVIEW_ID), { code: "SERVICE_UNAVAILABLE" });
});

test("a document returned under another name is SERVICE_UNAVAILABLE", async () => {
  const fake = createFakeFirestore();
  await store(fake).create(reviewDoc());
  const stored = fake.documents.get(fake.documentName("po_reviews", REVIEW_ID));
  fake.documents.set(fake.documentName("po_reviews", REVIEW_ID), { ...stored, name: fake.documentName("po_reviews", "other") });

  await assert.rejects(store(fake).get(REVIEW_ID), { code: "SERVICE_UNAVAILABLE" });
});

test("an invalid review is not written", async () => {
  const fake = createFakeFirestore();
  await assert.rejects(store(fake).create(reviewDoc({ ownerSessionId: "someone" })), { code: "SERVICE_UNAVAILABLE" });
  assert.equal(fake.calls.length, 0);
});

test("a review over 256 KiB is rejected before any request", async () => {
  const fake = createFakeFirestore();
  const oversized = reviewDoc();
  oversized.result.purchaseOrderDocument.buyer = "B".repeat(MAX_PO_REVIEW_DOCUMENT_BYTES);

  await assert.rejects(store(fake).create(oversized), { name: "FirestoreRestError", code: "DOCUMENT_TOO_LARGE" });
  assert.equal(fake.calls.length, 0);
  assert.equal(MAX_PO_REVIEW_DOCUMENT_BYTES, 256 * 1024);
});

test("an existing review is never overwritten", async () => {
  const fake = createFakeFirestore();
  await store(fake).create(reviewDoc());
  await assert.rejects(store(fake).create(reviewDoc({ ownerSessionId: "d".repeat(32) })), { code: "SERVICE_UNAVAILABLE" });
  assert.equal((await store(fake).get(REVIEW_ID)).ownerSessionId, SESSION_ID);
});

test("Firestore errors, network failures and a missing token are SERVICE_UNAVAILABLE or identity errors", async () => {
  const failing = { fetchImpl: async () => ({ status: 503, ok: false, json: async () => ({ error: { status: "UNAVAILABLE" } }) }) };
  await assert.rejects(store(failing).get(REVIEW_ID), { code: "SERVICE_UNAVAILABLE" });
  await assert.rejects(store(failing).create(reviewDoc()), { code: "SERVICE_UNAVAILABLE" });

  const offline = { fetchImpl: async () => { throw new TypeError("fetch failed"); } };
  await assert.rejects(store(offline).get(REVIEW_ID), { code: "SERVICE_UNAVAILABLE" });

  const fake = createFakeFirestore();
  await assert.rejects(store(fake, { tokenProvider: async () => "" }).get(REVIEW_ID), { code: "CLOUD_IDENTITY_UNAVAILABLE" });
  await assert.rejects(
    store(fake, { tokenProvider: async () => { throw new Error("metadata server unreachable"); } }).get(REVIEW_ID),
    { code: "CLOUD_IDENTITY_UNAVAILABLE" },
  );
  assert.equal(fake.calls.length, 0);
});

test("a caller cancellation propagates as an AbortError", async () => {
  const fake = createFakeFirestore();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(store(fake).get(REVIEW_ID, { signal: controller.signal }), { name: "AbortError" });
});

test("construction validates its configuration and makes no request", () => {
  const fake = createFakeFirestore();
  assert.throws(() => createFirestorePoReviewStore({ projectId: "Bad Project", fetchImpl: fake.fetchImpl }), TypeError);
  assert.throws(() => store(fake, { timeoutMs: 0 }), TypeError);
  assert.equal(fake.calls.length, 0);
});
