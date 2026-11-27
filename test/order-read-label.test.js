import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readOrder } from "../src/commands/read-order.js";
import { createPdfOrderExtractionService } from "../src/google-cloud/order-extraction-service.js";
import { createPurchaseOrderReviewService } from "../src/purchase-order-review.js";
import { createConfiguredServicePorts, createServicePorts } from "../src/service-ports.js";

const purchaseOrder = await readFile(new URL("./fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf", import.meta.url));
const pdfFile = () => new File([purchaseOrder], "order.pdf", { type: "application/pdf" });
const orderProfile = {
  customerId: "CUSTOMER-TEST-42", boxStyle: "RSC", lengthMm: 520, widthMm: 360, heightMm: 260, ply: 3,
  fluteProfile: "B", topLinerGsm: 125, fluteGsm: 115, innerLinerGsm: 125, linerBf: 18, inkColors: 2, inkCoveragePct: 40,
};

function commandDeps(servicePorts, executionMode) {
  const published = [];
  return {
    published,
    deps: {
      servicePorts,
      executionMode,
      liveStore: { publish: async (record) => { published.push(record); } },
      purchaseOrderPolicy: { acceptRealOrders: false, extractionAdapterConfigured: true, syntheticOnly: true },
    },
  };
}

test("mock order reading never labels its event or response as Gemini", async (t) => {
  // src/mock-agents.js reads the demo flag from process.env rather than from its caller.
  const saved = { K_SERVICE: process.env.K_SERVICE, USTAAD_ENABLE_DEMO_MODE: process.env.USTAAD_ENABLE_DEMO_MODE };
  delete process.env.K_SERVICE;
  process.env.USTAAD_ENABLE_DEMO_MODE = "true";
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const { deps, published } = commandDeps(createConfiguredServicePorts({ env: { USTAAD_ENABLE_DEMO_MODE: "true" } }), "demo");

  const response = await readOrder({ fields: { file: pdfFile(), orderId: "TEST-PO-LABEL" } }, deps);

  assert.equal(response.ok, true, JSON.stringify(response.error));
  assert.equal(response.source, "mock-demo");
  assert.equal(published.length, 1);
  assert.equal(published[0].event.type, "order.read");
  assert.match(published[0].event.text, /Sample output, no model call/);
  assert.doesNotMatch(JSON.stringify(published), /gemini/i);
  assert.doesNotMatch(JSON.stringify(response), /gemini/i);
});

test("order reading through a Vertex client keeps the Gemini label", async () => {
  const extractOrder = createPdfOrderExtractionService({
    storage: {
      createObjectName: () => "orders/label.pdf",
      upload: async () => ({ gcsUri: "gs://test-bucket/orders/label.pdf" }),
      delete: async () => {},
    },
    gemini: { generateJson: async () => ({ lines: [{ itemCode: "SKU-TEST-42", quantity: 100, sourcePage: 1 }] }) },
    itemCatalog: { getOrderProfile: async ({ itemCode, quantity }) => ({ ...orderProfile, itemCode, quantity }) },
  });
  const review = createPurchaseOrderReviewService({
    extractOrder,
    resolveOrderLine: async ({ itemCode, quantity }) => ({
      status: "MATCHED", candidates: [], resolvedItemCode: itemCode, orderProfile: { ...orderProfile, itemCode, quantity },
    }),
  });
  const { deps, published } = commandDeps(createServicePorts({ extractOrder, extractOrderForReview: review.extractForReview }), "live-service");

  const response = await readOrder({ fields: { file: pdfFile(), orderId: "TEST-PO-LABEL" } }, deps);

  assert.equal(response.ok, true, JSON.stringify(response.error));
  assert.equal(response.source, "vertex-gemini");
  assert.equal(published.length, 1);
  assert.equal(published[0].event.text, "Order TEST-PO-LABEL read by Gemini · 1 line");
});
