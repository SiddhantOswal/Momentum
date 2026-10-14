import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createJobCardService } from "../src/google-cloud/job-card-service.js";
import { mapJobSheetFromBigQuery, mapJobSheetToBigQuery } from "../src/bigquery-mapper.js";
import { createJobCoordinator } from "../src/job-coordinator.js";
import { createPurchaseOrderReviewService } from "../src/purchase-order-review.js";
import {
  createJobRequestIdentity,
  InMemoryIdempotencyStore,
} from "../src/job-idempotency.js";
import { createJobSubmissionHandler } from "../src/job-draft-persistence.js";
import { renderJobSheetPdf } from "../src/job-sheet-pdf.js";
import { jobSheetFixture } from "./fixtures/job-sheet.js";
import { createTraceRegistry } from "../src/trace-registry.js";

const expectedOrders = JSON.parse(readFileSync(
  new URL("../../docs/synthetic_POs/expected_results.json", import.meta.url),
  "utf8",
));
const po1Expected = expectedOrders.find((order) => order.file === "PO1_ClientA_single_B1047.pdf");
const pdf = new Uint8Array(readFileSync(
  new URL("../../docs/synthetic_POs/PO1_ClientA_single_B1047.pdf", import.meta.url),
));
const po1Order = {
  ...jobSheetFixture.order,
  orderId: `TEST-${po1Expected.poNumber}`,
  itemCode: po1Expected.lines[0].resolvedItemCode,
  quantity: po1Expected.lines[0].quantity,
};
const itemConfirmation = { itemCode: po1Order.itemCode, quantity: po1Order.quantity };
const operatorFields = {
  orderId: po1Order.orderId,
  paperType: "RECYCLED",
  paperSupplier: "SUP-D",
};
const conditions = {
  ...jobSheetFixture.conditions,
  shift: "DAY",
};
const conditionsProvenance = {
  readingId: "READ-TEST-PO1-001",
  timestamp: "2026-10-14T11:59:00.000Z",
  plantId: "PLANT-01",
  source: "simulated",
  recordedSource: "offline test adapter",
  retrievedAt: "2026-10-14T12:00:00.000Z",
  ageSeconds: 60,
  freshness: "fresh",
};

function createPreparationServices(calls, purchaseOrderReview) {
  return {
    extractOrder: async () => {
      assert.fail("Job preparation must consume the existing PO review without extracting again.");
    },
    confirmPurchaseOrderReview: async (request) => {
      calls.push("confirmPurchaseOrderReview");
      return purchaseOrderReview.confirmReview(request);
    },
    currentConditions: async () => {
      calls.push("getConditions");
      return { ok: true, data: conditions, provenance: conditionsProvenance };
    },
    predictRisk: async () => {
      calls.push("predictRisk");
      return { ok: true, ...jobSheetFixture.baseline.risk };
    },
    optimizeRisk: async ({ order }) => {
      calls.push("optimizeLevers");
      assert.equal("purchaseOrderLineIndex" in order, false);
      return {
        ok: true,
        baseline: jobSheetFixture.baseline,
        best: jobSheetFixture.recommended,
        changes: [],
        savings: jobSheetFixture.savings,
      };
    },
    findSimilarRuns: async () => {
      calls.push("findSimilarRuns");
      return {
        ok: true,
        evidence: [{
          lotId: "LOT-TEST-PO1-001",
          orderId: "TEST-CLA/PO/2026/1047",
          runDate: conditions.runDate,
          primaryDefect: "WARP",
          levers: jobSheetFixture.baseline.levers,
        }],
      };
    },
    explainRisk: async () => {
      calls.push("explainRisk");
      return { ok: true, explanation: "Injected test explanation; not a production result." };
    },
  };
}

test("fixture-backed PO1 review flows through draft persistence, approval, and job-card retrieval", async () => {
  const calls = [];
  let extractionCalls = 0;
  const purchaseOrderReview = createPurchaseOrderReviewService({
    extractOrder: async ({ operatorFields: confirmed }) => {
      extractionCalls += 1;
      assert.deepEqual(confirmed, operatorFields);
      return {
        ok: true,
        agent: "extractOrder",
        source: "mock-demo",
        isRealModelPrediction: false,
        purchaseOrderDocument: {
          poNumber: po1Expected.poNumber,
          buyer: po1Expected.buyer,
          deliveryDate: po1Expected.deliveryDate,
        },
        documentMissingFields: [],
        lines: po1Expected.lines.map((line, lineIndex) => ({
          lineIndex,
          sourcePage: 1,
          extractedItemCode: line.itemCode,
          quantity: line.quantity,
          status: line.status,
          catalogStatus: line.status,
          candidates: line.candidates,
          resolvedItemCode: line.resolvedItemCode,
          orderProfile: {
            ...jobSheetFixture.order,
            ...operatorFields,
            itemCode: line.resolvedItemCode,
            quantity: line.quantity,
          },
        })),
        lineSelectionRequired: po1Expected.lines.length > 1,
        missingFields: [],
        needsClarification: po1Expected.lines.length > 1 ||
          po1Expected.lines.some((line) => line.status !== "MATCHED"),
      };
    },
    resolveOrderLine: async ({ itemCode, quantity }) => ({
      status: "MATCHED",
      candidates: [],
      resolvedItemCode: itemCode,
      orderProfile: {
        ...jobSheetFixture.order,
        ...operatorFields,
        itemCode,
        quantity,
      },
    }),
  });
  const reviewedOrder = await purchaseOrderReview.extractForReview({
    file: {
      size: pdf.byteLength,
      name: po1Expected.file,
      type: "application/pdf",
      arrayBuffer: async () => pdf.slice().buffer,
    },
    operatorFields,
  });
  assert.equal(reviewedOrder.ok, true);
  assert.equal(reviewedOrder.source, "mock-demo");
  assert.equal(reviewedOrder.isRealModelPrediction, false);
  assert.deepEqual(reviewedOrder.purchaseOrderDocument, {
    poNumber: po1Expected.poNumber,
    buyer: po1Expected.buyer,
    deliveryDate: po1Expected.deliveryDate,
  });
  assert.equal(reviewedOrder.lines.length, po1Expected.lines.length);
  assert.equal(reviewedOrder.lines[0].extractedItemCode, po1Expected.lines[0].itemCode);
  assert.equal(reviewedOrder.lines[0].quantity, po1Expected.lines[0].quantity);
  assert.equal(reviewedOrder.lines[0].sourcePage, 1);
  assert.equal(extractionCalls, 1);
  const stored = new Map();
  const objectStore = new Map();
  let objectSequence = 0;
  const traceRegistry = createTraceRegistry({
    idFactory: (() => {
      let sequence = 0;
      return () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
    })(),
  });
  const prepareJob = createJobCoordinator({
    services: createPreparationServices(calls, purchaseOrderReview),
    traceRegistry,
    plantId: "PLANT-01",
  });
  const request = {
    file: { arrayBuffer: async () => pdf.slice().buffer },
    operatorFields,
    operatorItemConfirmation: { ...itemConfirmation, lineIndex: 0 },
    purchaseOrderReview: {
      reviewId: reviewedOrder.reviewId,
      reviewFingerprint: reviewedOrder.reviewFingerprint,
      confirmedSourceLine: true,
    },
    shift: conditions.shift,
    levers: jobSheetFixture.baseline.levers,
    conditionsConfirmed: true,
  };
  const identityResult = createJobRequestIdentity({
    fileBytes: pdf,
    operatorFields,
    operatorItemConfirmation: request.operatorItemConfirmation,
    shift: request.shift,
    levers: request.levers,
    conditionsConfirmed: request.conditionsConfirmed,
    purchaseOrderReviewFingerprint: reviewedOrder.reviewFingerprint,
  });
  assert.equal(identityResult.ok, true);

  const submitJob = createJobSubmissionHandler({
    prepareJob,
    createDraftJobSheet: async ({ jobSheet, jobId, plantId }) => {
      const row = mapJobSheetToBigQuery(
        { ...jobSheet, jobId },
        {
          plantId,
          createdAt: "2026-10-14T12:00:00.000Z",
          savingsCost: jobSheet.savings.inr,
          currency: jobSheet.baseline.risk.currency,
          approvedAt: null,
          cardUri: null,
        },
      );
      const record = mapJobSheetFromBigQuery(row);
      stored.set(jobId, record);
      return record;
    },
    getStoredJobSheet: async ({ jobId }) => stored.get(jobId) ?? null,
    draftPersistenceEnabled: true,
    storedJobLookupEnabled: true,
    plantId: "PLANT-01",
    store: new InMemoryIdempotencyStore({ leaseMs: 30_000 }),
    leaseMs: 30_000,
  });

  const draftResult = await submitJob({
    identity: identityResult.identity,
    request,
  });
  assert.equal(draftResult.ok, true, JSON.stringify(draftResult));
  assert.equal(draftResult.durable, true);
  assert.equal(draftResult.jobSheet.status, "DRAFT");
  assert.equal(draftResult.jobSheet.order.orderId, operatorFields.orderId);
  assert.equal(draftResult.jobSheet.order.purchaseOrderLineIndex, 0);
  assert.equal(draftResult.jobSheet.order.purchaseOrderSourcePage, 1);
  assert.equal(draftResult.jobSheet.order.itemCode, po1Expected.lines[0].resolvedItemCode);
  assert.equal(draftResult.jobSheet.order.quantity, po1Expected.lines[0].quantity);
  assert.equal(draftResult.purchaseOrderLines.length, 1);
  assert.equal(draftResult.purchaseOrderLines[0].lineIndex, 0);
  assert.equal(draftResult.purchaseOrderLines[0].sourcePage, 1);
  assert.equal(draftResult.purchaseOrderLines[0].confirmedItemCode, po1Expected.lines[0].resolvedItemCode);
  assert.equal(draftResult.purchaseOrderLines[0].confirmedQuantity, po1Expected.lines[0].quantity);
  assert.deepEqual(draftResult.conditions.provenance, conditionsProvenance);
  assert.deepEqual(draftResult.jobSheet.conditions.provenance, conditionsProvenance);
  assert.equal(extractionCalls, 1);
  assert.deepEqual(calls, [
    "confirmPurchaseOrderReview", "getConditions", "predictRisk", "optimizeLevers",
    "findSimilarRuns", "explainRisk",
  ]);

  const repository = {
    get: async (jobId) => stored.get(jobId) ?? null,
    approve: async ({ jobId, cardUri }) => {
      const current = stored.get(jobId);
      if (!current || current.status !== "DRAFT") {
        return { ok: false, error: { code: "CONFLICT", message: "Only a stored DRAFT can be approved." } };
      }
      const approved = {
        ...current,
        status: "APPROVED",
        approvedAt: "2026-10-14T12:01:00.000Z",
        cardUri,
      };
      stored.set(jobId, approved);
      return { ok: true, data: approved };
    },
  };
  const cards = createJobCardService({
    repository,
    storage: {
      upload: async ({ name, bytes }) => {
        const generation = String(++objectSequence);
        const gcsUri = `gs://test-bucket/${name}`;
        objectStore.set(gcsUri, { bytes, generation });
        return { name, generation, gcsUri };
      },
      download: async ({ name }) => {
        const gcsUri = `gs://test-bucket/${name}`;
        const object = objectStore.get(gcsUri);
        return { contentType: "application/pdf", bytes: object.bytes };
      },
      delete: async ({ name }) => {
        objectStore.delete(`gs://test-bucket/${name}`);
        return { deleted: true };
      },
    },
    renderPdf: async (jobSheet) => {
      assert.equal(jobSheet.order.purchaseOrderLineIndex, 0);
      assert.equal(jobSheet.order.purchaseOrderSourcePage, 1);
      return renderJobSheetPdf(jobSheet);
    },
    bucket: "test-bucket",
  });

  const retrievedDraft = await repository.get(draftResult.jobId);
  assert.equal(retrievedDraft.order.orderId, operatorFields.orderId);
  assert.equal(retrievedDraft.order.purchaseOrderLineIndex, 0);
  assert.equal(retrievedDraft.order.purchaseOrderSourcePage, 1);
  assert.equal(retrievedDraft.status, "DRAFT");
  assert.deepEqual(retrievedDraft.conditions.provenance, conditionsProvenance);
  const approval = await cards.approveJob({ jobId: draftResult.jobId });
  assert.equal(approval.ok, true);
  assert.equal(approval.jobSheet.status, "APPROVED");
  assert.equal(approval.jobSheet.order.orderId, operatorFields.orderId);

  const card = await cards.getJobCard({ jobId: draftResult.jobId });
  assert.equal(card.ok, true);
  assert.equal(card.filename, `${draftResult.jobId}.pdf`);
  assert.equal(Buffer.from(card.bytes).toString("ascii", 0, 5), "%PDF-");
  assert.equal((await repository.get(draftResult.jobId)).cardUri, cardUriForStored(stored, draftResult.jobId));
});

function cardUriForStored(records, jobId) {
  return records.get(jobId)?.cardUri;
}
