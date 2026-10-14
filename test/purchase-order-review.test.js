import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createPurchaseOrderReviewService } from "../src/purchase-order-review.js";
import { jobSheetFixture } from "./fixtures/job-sheet.js";
import { createJobCoordinator } from "../src/job-coordinator.js";
import { createTraceRegistry } from "../src/trace-registry.js";

const expectedOrders = JSON.parse(readFileSync(
  new URL("../docs/synthetic_POs/expected_results.json", import.meta.url),
  "utf8",
));
const multilineOrder = expectedOrders.find((order) => order.file.startsWith("PO2_"));
const ambiguousOrder = expectedOrders.find((order) => order.file.startsWith("PO4_"));
const bytes = new Uint8Array([37, 80, 68, 70, 45, 49]);
const operatorFields = {
  orderId: multilineOrder.poNumber,
  paperType: "RECYCLED",
  paperSupplier: "SUPPLIER-OPERATOR-CONFIRMED",
};

function resultFor(expected, orderId = expected.poNumber) {
  return {
    ok: true,
    agent: "extractOrder",
    source: "mock-demo",
    isRealModelPrediction: false,
    purchaseOrderDocument: {
      poNumber: expected.poNumber,
      buyer: expected.buyer,
      deliveryDate: expected.deliveryDate,
    },
    documentMissingFields: [],
    lines: expected.lines.map((line, lineIndex) => ({
      lineIndex,
      sourcePage: 1,
      ...(line.itemCode === null ? {} : { extractedItemCode: line.itemCode }),
      ...(line.quantity === null ? {} : { quantity: line.quantity }),
      status: line.status,
      catalogStatus: ["MATCHED", "AMBIGUOUS", "UNKNOWN_CODE"].includes(line.status)
        ? line.status
        : line.status === "MISSING_QTY" ? "MATCHED" : undefined,
      candidates: line.candidates,
      ...(line.resolvedItemCode === null ? {} : { resolvedItemCode: line.resolvedItemCode }),
      ...(line.status === "MATCHED" ? {
        orderProfile: {
          ...jobSheetFixture.order,
          orderId,
          itemCode: line.resolvedItemCode,
          quantity: line.quantity,
          paperType: operatorFields.paperType,
          paperSupplier: operatorFields.paperSupplier,
        },
      } : {}),
    })),
    lineSelectionRequired: expected.lines.length > 1,
    missingFields: [],
    needsClarification: expected.lines.length > 1 ||
      expected.lines.some((line) => line.status !== "MATCHED"),
  };
}

function setup(expected = multilineOrder, options = {}) {
  const resolutionCalls = [];
  let extractionCalls = 0;
  const service = createPurchaseOrderReviewService({
    extractOrder: async (request) => {
      extractionCalls += 1;
      assert.equal(request.signal?.aborted, false);
      return resultFor(expected, request.operatorFields.orderId);
    },
    resolveOrderLine: async ({ itemCode, selectedItemCode, quantity }) => {
      resolutionCalls.push({ itemCode, selectedItemCode, quantity });
      const resolvedCode = selectedItemCode ?? itemCode;
      const sourceLine = expected.lines.find((line) => line.itemCode === itemCode);
      const candidates = sourceLine?.candidates ?? [];
      if (candidates.length && !candidates.includes(selectedItemCode)) {
        return { status: "AMBIGUOUS", candidates };
      }
      const knownCodes = expected.lines.flatMap((line) =>
        [line.resolvedItemCode, ...line.candidates].filter(Boolean));
      if (!knownCodes.includes(resolvedCode)) {
        return { status: "UNKNOWN_CODE", candidates: [] };
      }
      return {
        status: candidates.length ? "AMBIGUOUS" : "MATCHED",
        candidates,
        resolvedItemCode: resolvedCode,
        orderProfile: {
          ...jobSheetFixture.order,
          itemCode: resolvedCode,
          quantity,
        },
      };
    },
    ...options,
  });
  return { service, resolutionCalls, get extractionCalls() { return extractionCalls; } };
}

async function review(service, fileBytes = bytes, fields = operatorFields) {
  return service.extractForReview({
    file: { arrayBuffer: async () => fileBytes.buffer },
    operatorFields: fields,
    signal: new AbortController().signal,
  });
}

for (const expected of expectedOrders) {
  test(`approved fixture ${expected.file} extracts and reviews each expected line once`, async () => {
    const inputBytes = new Uint8Array(readFileSync(
      new URL(`../docs/synthetic_POs/${expected.file}`, import.meta.url),
    ));
    const fields = {
      orderId: expected.poNumber,
      paperType: "RECYCLED",
      paperSupplier: "SUPPLIER-OPERATOR-CONFIRMED",
    };
    const harness = setup(expected);
    const result = await review(harness.service, inputBytes, fields);
    assert.equal(result.ok, true);
    assert.equal(result.purchaseOrderDocument.poNumber, expected.poNumber);
    assert.deepEqual(result.lines.map((line) => ({
      itemCode: line.extractedItemCode ?? null,
      quantity: line.quantity ?? null,
      status: line.status,
      resolvedItemCode: line.resolvedItemCode ?? null,
      candidates: line.candidates,
    })), expected.lines);
    assert.equal(harness.extractionCalls, 1);
    assert.equal(result.isRealModelPrediction, false, "fixture assertions use an isolated extraction test double");
  });
}

function confirmation(reviewResult, values = {}) {
  return {
    reviewId: reviewResult.reviewId,
    reviewFingerprint: reviewResult.reviewFingerprint,
    fileBytes: bytes,
    operatorFields,
    lineIndex: 1,
    itemCode: "PKBX0092",
    quantity: 800,
    confirmedSourceLine: true,
    ...values,
  };
}

test("review extraction returns all fixture-backed lines and document metadata after one extraction", async () => {
  const harness = setup();
  const result = await review(harness.service);

  assert.equal(result.ok, true);
  assert.equal(result.purchaseOrderDocument.poNumber, multilineOrder.poNumber);
  assert.equal(result.purchaseOrderDocument.buyer, multilineOrder.buyer);
  assert.equal(result.purchaseOrderDocument.deliveryDate, multilineOrder.deliveryDate);
  assert.equal(result.lines.length, 3);
  assert.deepEqual(result.lines.map(({ extractedItemCode, quantity, status }) =>
    ({ itemCode: extractedItemCode, quantity, status })), multilineOrder.lines.map((line) => ({
    itemCode: line.itemCode,
    quantity: line.quantity,
    status: line.status,
  })));
  assert.equal(typeof result.reviewId, "string");
  assert.match(result.reviewFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(harness.extractionCalls, 1);
});

test("review confirmation reuses extraction, binds the exact source line and catalog profile", async () => {
  const harness = setup();
  const reviewed = await review(harness.service);
  assert.equal(reviewed.source, "mock-demo");
  assert.equal(reviewed.isRealModelPrediction, false);
  const resolved = await harness.service.confirmReview(confirmation(reviewed));

  assert.equal(harness.extractionCalls, 1);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.selectedLineIndex, 1);
  assert.equal(resolved.lines.length, 3);
  assert.equal(resolved.lines[0].status, "MATCHED");
  assert.equal(resolved.lines[1].extractedItemCode, "PKBX0092");
  assert.equal(resolved.lines[1].confirmedItemCode, "PKBX0092");
  assert.equal(resolved.lines[1].confirmedQuantity, 800);
  assert.equal(resolved.orderProfile.itemCode, "PKBX0092");
  assert.equal(resolved.orderProfile.quantity, 800);
  assert.deepEqual(harness.resolutionCalls, [{
    itemCode: "PKBX0092",
    selectedItemCode: undefined,
    quantity: 800,
  }]);
});

test("ambiguous fixture requires a returned candidate and resolves only the chosen candidate", async () => {
  const fields = { ...operatorFields, orderId: ambiguousOrder.poNumber };
  const harness = setup(ambiguousOrder);
  const reviewed = await review(harness.service, bytes, fields);
  const line = reviewed.lines[0];

  assert.equal(line.status, "AMBIGUOUS");
  assert.deepEqual(line.candidates, ["PKBX0242-TOPS", "PKBX0242-BOTS"]);
  const rejected = await harness.service.confirmReview(confirmation(reviewed, {
    operatorFields: fields,
    lineIndex: 0,
    itemCode: "PKBX0242-OTHER",
    quantity: 400,
  }));
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.issues[0].code, "catalog_candidate_required");

  const accepted = await harness.service.confirmReview(confirmation(reviewed, {
    operatorFields: fields,
    lineIndex: 0,
    itemCode: "PKBX0242-TOPS",
    quantity: 400,
  }));
  assert.equal(accepted.ok, true);
  assert.equal(accepted.lines[0].resolvedItemCode, "PKBX0242-TOPS");
  assert.deepEqual(accepted.lines[0].candidates, ["PKBX0242-TOPS", "PKBX0242-BOTS"]);
  assert.equal(accepted.lines[0].confirmedQuantity, 400);
});

test("unknown or unresolved catalog codes cannot be confirmed, while an explicit source correction is revalidated", async () => {
  const expected = expectedOrders.find((order) => order.file.startsWith("PO5_"));
  const fields = { ...operatorFields, orderId: expected.poNumber };
  const harness = setup(expected);
  const reviewed = await review(harness.service, bytes, fields);
  assert.equal(reviewed.lines[1].status, "UNKNOWN_CODE");
  assert.equal(reviewed.lines[1].candidates.length, 0);

  const unknown = await harness.service.confirmReview(confirmation(reviewed, {
    operatorFields: fields,
    lineIndex: 1,
    itemCode: "UNKNOWN-CODE",
    quantity: 500,
  }));
  assert.equal(unknown.ok, false);
  assert.equal(unknown.error.issues[0].code, "catalog_item_not_found");

  const corrected = await harness.service.confirmReview(confirmation(reviewed, {
    operatorFields: fields,
    lineIndex: 1,
    itemCode: "PKBX0119",
    quantity: 500,
  }));
  assert.equal(corrected.ok, true);
  assert.equal(corrected.lines[1].extractedItemCode, "PKBX0999");
  assert.equal(corrected.lines[1].confirmedItemCode, "PKBX0119");
  assert.equal(corrected.lines[1].confirmedQuantity, 500);
});

test("missing quantity can be explicitly corrected and a missing confirmation is rejected", async () => {
  const expected = expectedOrders.find((order) => order.file.startsWith("PO5_"));
  const fields = { ...operatorFields, orderId: expected.poNumber };
  const harness = setup(expected);
  const reviewed = await review(harness.service, bytes, fields);
  assert.equal(reviewed.lines[2].status, "MISSING_QTY");
  assert.equal(reviewed.lines[2].catalogStatus, "MATCHED");
  assert.equal(reviewed.lines[2].quantity, undefined);

  const unconfirmed = await harness.service.confirmReview(confirmation(reviewed, {
    operatorFields: fields,
    lineIndex: 2,
    itemCode: "PKBX0120",
    quantity: 725,
    confirmedSourceLine: false,
  }));
  assert.equal(unconfirmed.ok, false);
  assert.equal(unconfirmed.error.issues[0].code, "confirmation_required");

  const corrected = await harness.service.confirmReview(confirmation(reviewed, {
    operatorFields: fields,
    lineIndex: 2,
    itemCode: "PKBX0120",
    quantity: 725,
  }));
  assert.equal(corrected.ok, true);
  assert.equal(corrected.lines[2].confirmedQuantity, 725);
  assert.equal(corrected.orderProfile.quantity, 725);
});

test("changed file, stale extraction fingerprint, changed operator context and invalid line indices are rejected", async (t) => {
  const harness = setup();
  const reviewed = await review(harness.service);
  await t.test("changed file", async () => {
    const changed = await harness.service.confirmReview(confirmation(reviewed, {
      fileBytes: new Uint8Array([...bytes, 0]),
    }));
    assert.equal(changed.ok, false);
    assert.equal(changed.error.issues[0].code, "stale_review");
  });
  await t.test("changed extraction fingerprint", async () => {
    const changed = await harness.service.confirmReview(confirmation(reviewed, {
      reviewFingerprint: "0".repeat(64),
    }));
    assert.equal(changed.ok, false);
    assert.equal(changed.error.issues[0].code, "stale_review");
  });
  await t.test("changed operator context", async () => {
    const changed = await harness.service.confirmReview(confirmation(reviewed, {
      operatorFields: { ...operatorFields, paperSupplier: "OTHER-SUPPLIER" },
    }));
    assert.equal(changed.ok, false);
    assert.equal(changed.error.issues[0].code, "stale_review");
  });
  await t.test("invalid line index", async () => {
    const changed = await harness.service.confirmReview(confirmation(reviewed, { lineIndex: 8 }));
    assert.equal(changed.ok, false);
    assert.equal(changed.error.issues[0].code, "line_index_out_of_range");
  });
});

test("missing document fields remain explicit in the review response", async () => {
  const missingMetadata = {
    ...resultFor(multilineOrder),
    purchaseOrderDocument: {},
    documentMissingFields: ["poNumber", "buyer", "deliveryDate"],
  };
  const harness = setup(multilineOrder, {
    extractOrder: async () => missingMetadata,
  });
  const reviewed = await review(harness.service);
  assert.deepEqual(reviewed.documentMissingFields, ["poNumber", "buyer", "deliveryDate"]);
  assert.deepEqual(reviewed.purchaseOrderDocument, {});
});

test("the coordinator receives only the backend-confirmed reviewed line without repeating extraction", async () => {
  const harness = setup();
  const reviewed = await review(harness.service);
  const calls = [];
  const services = {
    extractOrder: async () => assert.fail("Reviewed preparation must not repeat extraction."),
    confirmPurchaseOrderReview: async (request) => {
      calls.push(request);
      return harness.service.confirmReview({
        ...request,
        fileBytes: bytes,
        operatorFields,
      });
    },
    currentConditions: async () => ({
      ok: true,
      data: jobSheetFixture.conditions,
      provenance: {
        readingId: "READ-OFFLINE-REVIEW-001",
        timestamp: "2026-10-14T11:59:00.000Z",
        plantId: "PLANT-01",
        source: "simulated",
        recordedSource: "offline test adapter",
        retrievedAt: "2026-10-14T12:00:00.000Z",
        ageSeconds: 60,
        freshness: "fresh",
      },
    }),
    predictRisk: async () => ({ ok: true, ...jobSheetFixture.baseline.risk }),
    optimizeRisk: async () => ({
      ok: true,
      baseline: jobSheetFixture.baseline,
      best: jobSheetFixture.baseline,
      changes: [],
      savings: { kg: 0, inr: 0 },
    }),
    findSimilarRuns: async () => ({ ok: true, evidence: [] }),
    explainRisk: async () => ({ ok: true, explanation: "Review-backed test explanation." }),
  };
  const prepareJob = createJobCoordinator({
    services,
    traceRegistry: createTraceRegistry(),
    plantId: "PLANT-01",
  });
  const prepared = await prepareJob({
    file: { arrayBuffer: async () => bytes.buffer },
    operatorFields,
    operatorItemConfirmation: { itemCode: "PKBX0092", quantity: 800, lineIndex: 1 },
    purchaseOrderReview: {
      reviewId: reviewed.reviewId,
      reviewFingerprint: reviewed.reviewFingerprint,
      confirmedSourceLine: true,
    },
    shift: "DAY",
    levers: jobSheetFixture.baseline.levers,
    conditionsConfirmed: true,
  });

  assert.equal(prepared.ok, true);
  assert.equal(prepared.jobSheet.order.orderId, multilineOrder.poNumber);
  assert.equal(prepared.jobSheet.order.itemCode, "PKBX0092");
  assert.equal(prepared.jobSheet.order.quantity, 800);
  assert.equal(prepared.purchaseOrderLines.length, 3);
  assert.equal(prepared.purchaseOrderLines[0].extractedItemCode, "PKBX0089");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].lineIndex, 1);
  assert.equal(calls[0].itemCode, "PKBX0092");
  assert.equal(calls[0].quantity, 800);
  assert.equal(calls[0].confirmedSourceLine, true);
  assert.equal(harness.extractionCalls, 1);
});
