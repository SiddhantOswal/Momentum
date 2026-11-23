import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { planLot } from "../src/commands/plan-lot.js";
import { readOrder } from "../src/commands/read-order.js";
import { createFirestorePoReviewStore } from "../src/google-cloud/firestore-po-review-store.js";
import { createPurchaseOrderReviewService } from "../src/purchase-order-review.js";
import { createConfiguredServicePorts } from "../src/service-ports.js";
import { createFakeFirestore } from "./fixtures/fake-firestore.js";
import { jobSheetFixture } from "./fixtures/job-sheet.js";

const SESSION_A = "a".repeat(32);
const SESSION_B = "b".repeat(32);
const START = Date.parse("2026-12-04T04:00:00.000Z");
const REVIEW_TTL_MS = 30 * 60 * 1000;
const bytes = new Uint8Array([37, 80, 68, 70, 45, 49]);
const operatorFields = { orderId: "CLA/PO/2026/1052", paperType: "RECYCLED", paperSupplier: "SUPPLIER-OPERATOR-CONFIRMED" };
const sourceLines = [["PKBX0089", 6000], ["PKBX0092", 800], ["PKBX0026", 1200]];

function extractionResult({ buyer = "Client A Industries Pvt. Ltd." } = {}) {
  return {
    ok: true,
    agent: "extractOrder",
    source: "mock-demo",
    isRealModelPrediction: false,
    purchaseOrderDocument: { poNumber: operatorFields.orderId, buyer, deliveryDate: "24-10-2026" },
    documentMissingFields: [],
    lines: sourceLines.map(([itemCode, quantity], lineIndex) => ({
      lineIndex,
      sourcePage: 1,
      extractedItemCode: itemCode,
      quantity,
      status: "MATCHED",
      catalogStatus: "MATCHED",
      candidates: [],
      resolvedItemCode: itemCode,
    })),
    lineSelectionRequired: true,
    missingFields: [],
    needsClarification: true,
  };
}

function createClock(start = START) {
  let current = start;
  return { now: () => current, advance: (ms) => { current += ms; } };
}

let nextId = 0;
function reviewIdFactory() {
  nextId += 1;
  return `6f1c2b9e-3d4a-4f5b-8c7d-${String(nextId).padStart(12, "0")}`;
}

// One "instance": its own service and its own store client, sharing only the fake database.
function instance(fake, { clock = createClock(), durable = true, extraction = extractionResult } = {}) {
  const counts = { extractions: 0 };
  const service = createPurchaseOrderReviewService({
    extractOrder: async () => {
      counts.extractions += 1;
      return extraction();
    },
    resolveOrderLine: async ({ itemCode, quantity }) => ({
      status: "MATCHED",
      candidates: [],
      resolvedItemCode: itemCode,
      orderProfile: { ...jobSheetFixture.order, itemCode, quantity },
    }),
    now: clock.now,
    idFactory: reviewIdFactory,
    ...(durable ? {
      reviewStore: createFirestorePoReviewStore({
        projectId: "prepagent-hack",
        fetchImpl: fake.fetchImpl,
        tokenProvider: async () => "test-token",
      }),
    } : {}),
  });
  return { service, counts };
}

function read(service, { ownerSessionId = SESSION_A, fileBytes = bytes } = {}) {
  return service.extractForReview({
    file: { arrayBuffer: async () => fileBytes.buffer },
    operatorFields,
    ownerSessionId,
    signal: new AbortController().signal,
  });
}

function confirm(service, reviewed, values = {}) {
  return service.confirmReview({
    reviewId: reviewed.reviewId,
    reviewFingerprint: reviewed.reviewFingerprint,
    fileBytes: bytes,
    operatorFields,
    lineIndex: 1,
    itemCode: "PKBX0092",
    quantity: 800,
    confirmedSourceLine: true,
    ownerSessionId: SESSION_A,
    signal: new AbortController().signal,
    ...values,
  });
}

function assertStale(result) {
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.equal(result.error.issues[0].code, "stale_review");
}

test("a review read on instance A is confirmed on instance B without a second extraction", async () => {
  const fake = createFakeFirestore();
  const a = instance(fake);
  const b = instance(fake);

  const reviewed = await read(a.service);
  assert.equal(reviewed.ok, true);
  const confirmed = await confirm(b.service, reviewed);

  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.selectedLineIndex, 1);
  assert.equal(confirmed.orderProfile.itemCode, "PKBX0092");
  assert.equal(confirmed.orderProfile.quantity, 800);
  assert.equal(confirmed.lines[1].confirmedQuantity, 800);
  assert.equal(a.counts.extractions, 1);
  assert.equal(b.counts.extractions, 0);

  const stored = fake.documents.get(fake.documentName("po_reviews", reviewed.reviewId));
  assert.equal(stored.fields.ownerSessionId.stringValue, SESSION_A);
  assert.equal(stored.fields.reviewExpiresAt.timestampValue, new Date(START + REVIEW_TTL_MS).toISOString());
  assert.equal(stored.fields.expiresAt.timestampValue, new Date(START + 24 * 60 * 60 * 1000).toISOString());
});

test("a review expires after 30 minutes by its own clock, even while the document still exists", async () => {
  const fake = createFakeFirestore();
  const clock = createClock();
  const a = instance(fake, { clock });
  const b = instance(fake, { clock });
  const reviewed = await read(a.service);

  clock.advance(REVIEW_TTL_MS - 1);
  assert.equal((await confirm(b.service, reviewed)).ok, true);

  clock.advance(1);
  assertStale(await confirm(b.service, reviewed));
  assert.ok(fake.documents.has(fake.documentName("po_reviews", reviewed.reviewId)), "TTL deletion is only the backup");
});

test("only the session that read the order can use its review", async () => {
  const fake = createFakeFirestore();
  const a = instance(fake);
  const b = instance(fake);
  const reviewed = await read(a.service);

  assertStale(await confirm(b.service, reviewed, { ownerSessionId: SESSION_B }));
  assertStale(await confirm(b.service, reviewed, { ownerSessionId: undefined }));
  assert.equal((await confirm(b.service, reviewed)).ok, true);
});

test("a changed fingerprint is still rejected on another instance", async () => {
  const fake = createFakeFirestore();
  const reviewed = await read(instance(fake).service);

  assertStale(await confirm(instance(fake).service, reviewed, { reviewFingerprint: "f".repeat(64) }));
  assertStale(await confirm(instance(fake).service, reviewed, { fileBytes: new Uint8Array([1, 2, 3]) }));
  assert.equal((await confirm(instance(fake).service, reviewed)).ok, true);
});

test("a review over the 256 KiB document limit is refused and nothing is stored", async () => {
  const fake = createFakeFirestore();
  const a = instance(fake, { extraction: () => extractionResult({ buyer: "B".repeat(256 * 1024) }) });

  const result = await read(a.service);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.equal(result.error.issues[0].code, "review_too_large");
  assert.equal(result.reviewId, undefined);
  assert.equal(fake.documents.size, 0);
});

test("a stored review that cannot be parsed is SERVICE_UNAVAILABLE, not a stale review", async () => {
  const fake = createFakeFirestore();
  const reviewed = await read(instance(fake).service);
  const stored = fake.documents.get(fake.documentName("po_reviews", reviewed.reviewId));
  stored.fields.reviewFingerprint = { stringValue: "tampered" };

  const result = await confirm(instance(fake).service, reviewed);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
});

test("an unreachable store fails closed on read and on confirm", async () => {
  const down = { fetchImpl: async () => ({ status: 503, ok: false, json: async () => ({ error: { status: "UNAVAILABLE" } }) }) };
  const a = instance(down);

  const reviewed = await read(a.service);
  assert.equal(reviewed.ok, false);
  assert.equal(reviewed.error.code, "SERVICE_UNAVAILABLE");

  const confirmed = await confirm(a.service, { reviewId: reviewIdFactory(), reviewFingerprint: "e".repeat(64) });
  assert.equal(confirmed.ok, false);
  assert.equal(confirmed.error.code, "SERVICE_UNAVAILABLE");
});

test("a durable review needs a session before any extraction is spent", async () => {
  const fake = createFakeFirestore();
  const a = instance(fake);

  const result = await read(a.service, { ownerSessionId: null });

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.error.code, "DEMO_SESSION_REQUIRED");
  assert.equal(a.counts.extractions, 0);
  assert.equal(fake.calls.length, 0);
});

test("without the durable store, reviews stay on the instance that read them, as today", async () => {
  const fake = createFakeFirestore();
  const a = instance(fake, { durable: false });
  const b = instance(fake, { durable: false });

  const reviewed = await read(a.service, { ownerSessionId: null });
  assert.equal(reviewed.ok, true);
  assertStale(await confirm(b.service, reviewed));
  assert.equal((await confirm(a.service, reviewed, { ownerSessionId: undefined })).ok, true);
  assert.equal(fake.calls.length, 0);
});

const LIVE_EXTRACTION_ENV = {
  PROJECT_ID: "prepagent-hack",
  REGION: "asia-south1",
  BUCKET: "prepagent-hack-data",
  VERTEX_LOCATION: "asia-south1",
  GEMINI_MODEL: "gemini-3.5-flash",
  USTAAD_ENABLE_LIVE_MODEL_CALLS: "true",
  GEMINI_DAILY_ATTEMPT_CAP: "10",
  GEMINI_DAILY_ATTEMPT_TIMEZONE: "Asia/Kolkata",
};

function configuredPorts(env, fake) {
  return createConfiguredServicePorts({
    env: { ...LIVE_EXTRACTION_ENV, ...env },
    modelConfig: { projectId: "prepagent-hack", location: "asia-south1", testModel: "gemini-3.5-flash", modelCallsEnabled: true },
    bucketConfig: { bucket: { name: "prepagent-hack-data" } },
    tokenProvider: async () => "test-token",
    fetchImpl: fake.fetchImpl,
  });
}

const unknownReview = { reviewId: "6f1c2b9e-3d4a-4f5b-8c7d-ffffffffffff", reviewFingerprint: "e".repeat(64) };

test("USTAAD_ENABLE_DURABLE_PO_REVIEWS=true routes the configured review port to po_reviews", async () => {
  const fake = createFakeFirestore();
  const ports = configuredPorts({ USTAAD_ENABLE_DURABLE_PO_REVIEWS: "true" }, fake);

  assertStale(await confirm({ confirmReview: ports.confirmPurchaseOrderReview }, unknownReview));
  assert.deepEqual(fake.calls.map(({ method, url }) => [method, new URL(url).pathname]), [
    ["GET", "/v1/projects/prepagent-hack/databases/(default)/documents/po_reviews/6f1c2b9e-3d4a-4f5b-8c7d-ffffffffffff"],
  ]);
});

test("with the flag off or not exactly true, the configured review port never calls Firestore", async () => {
  for (const flag of [undefined, "false", "TRUE", "1"]) {
    const fake = createFakeFirestore();
    const ports = configuredPorts(flag === undefined ? {} : { USTAAD_ENABLE_DURABLE_PO_REVIEWS: flag }, fake);

    assertStale(await confirm({ confirmReview: ports.confirmPurchaseOrderReview }, unknownReview));
    assert.equal(fake.calls.length, 0, `flag=${String(flag)}`);
  }
});

const purchaseOrder = await readFile(new URL("./fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf", import.meta.url));
const offlineCommand = {
  signal: new AbortController().signal,
  liveStore: { publish: async () => {} },
  executionMode: "offline",
  purchaseOrderPolicy: { acceptRealOrders: false, extractionAdapterConfigured: false, syntheticOnly: false },
};

test("reading an order passes the caller's session to the review port", async () => {
  const requests = [];
  const servicePorts = { extractOrderForReview: async (request) => { requests.push(request); return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "stub" } }; } };
  const file = () => new File([purchaseOrder], "order.pdf", { type: "application/pdf" });

  await readOrder({ fields: { file: file() } }, { ...offlineCommand, servicePorts, principal: { sessionId: SESSION_A } });
  await readOrder({ fields: { file: file() } }, { ...offlineCommand, servicePorts, principal: { uid: "supervisor" } });

  assert.equal(requests[0].ownerSessionId, SESSION_A);
  assert.equal("ownerSessionId" in requests[1], false);
});

test("planning a reviewed lot carries the caller's session with the review reference", async () => {
  const submissions = [];
  const fields = {
    file: new File([purchaseOrder], "order.pdf", { type: "application/pdf" }),
    orderId: "TEST-PO-1", paperType: "VIRGIN", paperSupplier: "SUPPLIER-TEST",
    confirmedItemCode: "SKU-TEST-42", confirmedQuantity: "100", confirmedLineIndex: "1",
    reviewId: unknownReview.reviewId, reviewFingerprint: unknownReview.reviewFingerprint, confirmedSourceLine: "true",
    shift: "DAY", runDate: "2026-10-15", ambientRhPct: "64", ambientTempC: "26", paperMoisturePct: "8.5",
    conditionsConfirmed: "true", sfSpeedMpm: "40", rollTempC: "165", gumApplication: "MED", gumViscositySec: "40",
    pastingPressure: "MED", dryingHours: "6", printSpeedSpm: "50",
  };
  const deps = {
    ...offlineCommand,
    hackathonAuth: { enabled: false },
    demoMode: false,
    submitJob: async (submission) => { submissions.push(submission); return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "stub" } }; },
  };

  await planLot({ fields }, { ...deps, principal: { sessionId: SESSION_A } });
  await planLot({ fields }, { ...deps, principal: { uid: "supervisor" } });

  assert.deepEqual(submissions[0].request.purchaseOrderReview, {
    ...unknownReview, confirmedSourceLine: true, ownerSessionId: SESSION_A,
  });
  assert.deepEqual(submissions[1].request.purchaseOrderReview, { ...unknownReview, confirmedSourceLine: true });
});
