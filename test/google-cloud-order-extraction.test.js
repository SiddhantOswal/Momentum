import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  createCloudStorageClient,
  CloudStorageError,
} from "../src/google-cloud/storage-client.js";
import {
  createVertexGeminiClient,
  VertexGeminiError,
} from "../src/google-cloud/vertex-gemini-client.js";
import { createPdfOrderExtractionService } from "../src/google-cloud/order-extraction-service.js";
import {
  buildItemLookupSql,
  buildItemResolutionSql,
  createItemCatalogService,
} from "../src/google-cloud/item-catalog-service.js";
import { createConfiguredServicePorts } from "../src/service-ports.js";
import { OrderExtractionApiResponseSchema } from "../src/schemas.js";
import { jobSheetFixture } from "./fixtures/job-sheet.js";

const syntheticPoResults = JSON.parse(readFileSync(
  fileURLToPath(new URL("../../docs/synthetic_POs/expected_results.json", import.meta.url)),
  "utf8",
));

const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { "Content-Type": "application/json" },
});

test("Cloud Storage adapter makes bounded create-only media upload requests", async () => {
  let request;
  const storage = createCloudStorageClient({
    bucket: "prepagent-hack-data",
    tokenProvider: async () => "test-token",
    fetchImpl: async (url, options) => {
      request = { url: new URL(url), options };
      return jsonResponse({ name: "orders/test.pdf", generation: "42" });
    },
  });

  const result = await storage.upload({
    name: "orders/test.pdf",
    contentType: "application/pdf",
    bytes: new Uint8Array([37, 80, 68, 70]),
  });

  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.equal(request.url.searchParams.get("uploadType"), "media");
  assert.equal(request.url.searchParams.get("name"), "orders/test.pdf");
  assert.equal(request.url.searchParams.get("ifGenerationMatch"), "0");
  assert.equal(result.gcsUri, "gs://prepagent-hack-data/orders/test.pdf");
  assert.equal(result.generation, "42");
});

test("Cloud Storage adapter rejects oversized and unsafe upload inputs before network", async () => {
  let called = false;
  const storage = createCloudStorageClient({
    bucket: "prepagent-hack-data",
    tokenProvider: async () => "test-token",
    fetchImpl: async () => { called = true; return jsonResponse({}); },
    maxObjectBytes: 8,
  });
  await assert.rejects(
    storage.upload({ name: "../secret", contentType: "application/pdf", bytes: new Uint8Array([1]) }),
    CloudStorageError,
  );
  await assert.rejects(
    storage.upload({ name: "orders/big.pdf", contentType: "application/pdf", bytes: new Uint8Array(9) }),
    CloudStorageError,
  );
  assert.equal(called, false);
});

test("Vertex Gemini adapter sends GCS PDF and structured JSON request", async () => {
  let request;
  let usage;
  const gemini = createVertexGeminiClient({
    projectId: "prepagent-hack",
    location: "asia-south1",
    model: "gemini-3.5-flash",
    tokenProvider: async () => "test-token",
    fetchImpl: async (url, options) => {
      request = { url: String(url), options, body: JSON.parse(options.body) };
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: '{"itemCode":"SKU-1","quantity":25}' }] } }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5, totalTokenCount: 17, ignored: "value" },
      });
    },
  });

  const result = await gemini.generateJson({
    fileUri: "gs://prepagent-hack-data/orders/test.pdf",
    mimeType: "application/pdf",
    prompt: "Extract fields",
    responseSchema: { type: "OBJECT", properties: { itemCode: { type: "STRING" }, quantity: { type: "INTEGER" } } },
    onUsage: (metadata) => { usage = metadata; },
  });
  assert.deepEqual(result, { itemCode: "SKU-1", quantity: 25 });
  assert.deepEqual(usage, { promptTokenCount: 12, candidatesTokenCount: 5, totalTokenCount: 17 });
  assert.match(request.url, /:generateContent$/);
  assert.deepEqual(request.body.contents[0].parts[0].fileData, {
    fileUri: "gs://prepagent-hack-data/orders/test.pdf",
    mimeType: "application/pdf",
  });
  assert.equal(request.body.generationConfig.responseMimeType, "application/json");
  assert.deepEqual(request.body.generationConfig.responseSchema.properties, {
    itemCode: { type: "STRING" }, quantity: { type: "INTEGER" },
  });
});

test("Vertex Gemini adapter rejects invalid responses and unsafe GCS URIs", async () => {
  let called = false;
  const gemini = createVertexGeminiClient({
    projectId: "prepagent-hack",
    location: "asia-south1",
    model: "gemini-3.5-flash",
    tokenProvider: async () => "test-token",
    fetchImpl: async () => { called = true; return jsonResponse({}); },
  });
  await assert.rejects(
    gemini.generateJson({ fileUri: "gs://bucket/../secret.pdf", mimeType: "application/pdf", prompt: "x", responseSchema: {} }),
    VertexGeminiError,
  );
  assert.equal(called, false);
});

test("Vertex Gemini adapter supports bounded function-calling requests", async () => {
  let request;
  const gemini = createVertexGeminiClient({
    projectId: "prepagent-hack",
    location: "asia-south1",
    model: "gemini-3.5-flash",
    tokenProvider: async () => "test-token",
    fetchImpl: async (url, options) => {
      request = { url: String(url), body: JSON.parse(options.body) };
      return jsonResponse({ candidates: [{ content: { role: "model", parts: [{ text: "ok" }] } }] });
    },
  });
  const contents = [{ role: "user", parts: [{ text: "Prepare the order." }] }];
  const tools = [{ functionDeclarations: [{ name: "getConditions", parameters: { type: "OBJECT" } }] }];

  const result = await gemini.generateContent({ contents, tools });
  assert.deepEqual(result, { role: "model", parts: [{ text: "ok" }] });
  assert.match(request.url, /:generateContent$/);
  assert.deepEqual(request.body.contents, contents);
  assert.deepEqual(request.body.tools, tools);
  assert.deepEqual(request.body.toolConfig, { functionCallingConfig: { mode: "AUTO" } });
  assert.equal(request.body.generationConfig.temperature, 0);
  assert.equal(request.body.generationConfig.maxOutputTokens, 2048);
});

test("PDF extraction service uploads, validates partial fields, and returns traceable model output", async () => {
  const calls = [];
  const service = createPdfOrderExtractionService({
    storage: {
      createObjectName: () => "orders/test.pdf",
      upload: async (request) => { calls.push({ operation: "upload", request }); return { gcsUri: "gs://prepagent-hack-data/orders/test.pdf" }; },
      delete: async (request) => { calls.push({ operation: "delete", request }); },
    },
    gemini: {
      generateJson: async (request) => { calls.push({ operation: "extract", request }); return { lines: [{ itemCode: "SKU-1", quantity: 25, sourcePage: 1 }] }; },
    },
    itemCatalog: {
      getOrderProfile: async ({ itemCode, quantity }) => ({
        itemCode, quantity, customerId: "CUST-1", boxStyle: "RSC", lengthMm: 1392,
        widthMm: 420, heightMm: 0, ply: 5, fluteProfile: "BC", topLinerGsm: 125,
        fluteGsm: 115, innerLinerGsm: 125, linerBf: 18, inkColors: 0, inkCoveragePct: 0,
      }),
    },
  });

  const result = await service({
    file: { size: 5, name: "test.pdf", type: "application/pdf", arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer },
  });

  assert.deepEqual(calls.map(({ operation }) => operation), ["upload", "extract"]);
  assert.equal(calls[0].request.contentType, "application/pdf");
  assert.equal(calls[1].request.fileUri, "gs://prepagent-hack-data/orders/test.pdf");
  assert.equal(result.source, "vertex-gemini");
  assert.equal(result.isRealModelPrediction, true);
  assert.equal(result.needsClarification, true);
  assert.equal(result.orderProfile.lengthMm, 1392);
  assert.equal(result.orderProfile.heightMm, 0);
  assert.deepEqual(result.missingFields, ["orderId", "paperType", "paperSupplier"]);
  assert.equal(OrderExtractionApiResponseSchema.safeParse(result).success, true);
});

test("PDF extraction merges only operator-confirmed order and loaded-paper fields", async () => {
  const calls = [];
  const service = createPdfOrderExtractionService({
    storage: {
      createObjectName: () => "orders/operator-context.pdf",
      upload: async () => ({ gcsUri: "gs://prepagent-hack-data/orders/operator-context.pdf" }),
      delete: async () => {},
    },
    gemini: {
      generateJson: async () => ({ lines: [{ itemCode: "SKU-1", quantity: 25, sourcePage: 1 }] }),
    },
    itemCatalog: {
      getOrderProfile: async ({ itemCode, quantity }) => {
        calls.push({ itemCode, quantity });
        return {
          itemCode, quantity, customerId: "CUST-1", boxStyle: "RSC", lengthMm: 1392,
          widthMm: 420, heightMm: 0, ply: 5, fluteProfile: "BC", topLinerGsm: 125,
          fluteGsm: 115, innerLinerGsm: 125, linerBf: 18, inkColors: 0, inkCoveragePct: 0,
        };
      },
    },
  });

  const result = await service({
    file: { size: 5, name: "test.pdf", type: "application/pdf", arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer },
    operatorFields: { orderId: "PO-2042", paperType: "RECYCLED", paperSupplier: "SUP-D" },
  });

  assert.deepEqual(calls, [{ itemCode: "SKU-1", quantity: 25 }]);
  assert.equal(result.orderProfile.orderId, "PO-2042");
  assert.equal(result.orderProfile.paperType, "RECYCLED");
  assert.equal(result.orderProfile.paperSupplier, "SUP-D");
  assert.deepEqual(result.operatorProvidedFields, ["orderId", "paperType", "paperSupplier"]);
  assert.deepEqual(result.missingFields, []);
  assert.deepEqual(result.documentMissingFields, ["poNumber", "buyer", "deliveryDate"]);
  assert.equal(result.needsClarification, true);
  assert.equal(OrderExtractionApiResponseSchema.safeParse(result).success, true);
});

test("PO1 extraction schema carries the model-read document identifiers and verifies the operator order ID", async () => {
  const expectedDocument = {
    poNumber: "CLA/PO/2026/1047",
    buyer: "Client A Industries Pvt. Ltd.",
    deliveryDate: "20-10-2026",
  };
  let modelRequest;
  const service = createPdfOrderExtractionService({
    storage: {
      createObjectName: () => "orders/po1.pdf",
      upload: async () => ({ gcsUri: "gs://prepagent-hack-data/orders/po1.pdf" }),
      delete: async () => {},
    },
    gemini: {
      generateJson: async (request) => {
        modelRequest = request;
        return { ...expectedDocument, lines: [{ itemCode: "PKBX0041", quantity: 1300, sourcePage: 1 }] };
      },
    },
    itemCatalog: {
      getOrderProfile: async ({ itemCode, quantity }) => ({
        itemCode,
        quantity,
        customerId: "CUSTOMER-TEST-42",
        boxStyle: "RSC",
        lengthMm: 520,
        widthMm: 360,
        heightMm: 260,
        ply: 3,
        fluteProfile: "B",
        topLinerGsm: 125,
        fluteGsm: 115,
        innerLinerGsm: 125,
        linerBf: 18,
        inkColors: 2,
        inkCoveragePct: 40,
      }),
    },
  });
  const result = await service({
    file: { size: 5, name: "test.pdf", type: "application/pdf", arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer },
    operatorFields: {
      orderId: expectedDocument.poNumber,
      paperType: "RECYCLED",
      paperSupplier: "SUP-D",
    },
  });

  assert.deepEqual(result.purchaseOrderDocument, expectedDocument);
  assert.equal(result.orderProfile.itemCode, "PKBX0041");
  assert.equal(result.orderProfile.quantity, 1300);
  assert.match(modelRequest.prompt, /purchase-order number/);
  assert.deepEqual(modelRequest.responseSchema.properties.lines, {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        itemCode: { type: "STRING" },
        quantity: { type: "INTEGER" },
        sourcePage: { type: "INTEGER" },
      },
    },
  });
  assert.match(modelRequest.prompt, /every line item/);
  assert.match(modelRequest.prompt, /1-based page number/);
  assert.equal(result.lines[0].status, "MATCHED");
  assert.equal(result.lines[0].sourcePage, 1);
  assert.equal(OrderExtractionApiResponseSchema.safeParse(result).success, true);
});

test("synthetic PO fixtures preserve one document and classify every line against expected results", async () => {
  const profileFor = (itemCode, quantity) => ({
    ...jobSheetFixture.order,
    itemCode,
    ...(quantity === undefined ? { quantity: undefined } : { quantity }),
  });

  for (const expected of syntheticPoResults) {
    const service = createPdfOrderExtractionService({
      storage: {
        createObjectName: () => `orders/${expected.file}.test`,
        upload: async () => ({ gcsUri: `gs://prepagent-hack-data/orders/${expected.file}` }),
        delete: async () => {},
      },
      gemini: {
        generateJson: async () => ({
          poNumber: expected.poNumber,
          buyer: expected.buyer,
          deliveryDate: expected.deliveryDate,
          lines: expected.lines.map((line) => ({
            itemCode: line.itemCode,
            ...(line.quantity === null ? {} : { quantity: line.quantity }),
            sourcePage: 1,
          })),
        }),
      },
      itemCatalog: {
        resolveOrderLine: async ({ itemCode, quantity, selectedItemCode }) => {
          const expectedLine = expected.lines.find((line) => line.itemCode === itemCode);
          if (expectedLine.status === "UNKNOWN_CODE") {
            return { status: "UNKNOWN_CODE", candidates: [] };
          }
          if (expectedLine.status === "AMBIGUOUS") {
            const resolved = selectedItemCode && expectedLine.candidates.includes(selectedItemCode);
            return {
              status: "AMBIGUOUS",
              candidates: expectedLine.candidates,
              ...(resolved ? {
                resolvedItemCode: selectedItemCode,
                orderProfile: profileFor(selectedItemCode, quantity),
              } : {}),
            };
          }
          return {
            status: "MATCHED",
            candidates: [],
            resolvedItemCode: itemCode,
            orderProfile: profileFor(itemCode, quantity),
          };
        },
      },
    });
    const result = await service({
      file: expected.file.endsWith(".jpg")
        ? {
          size: 3,
          name: expected.file,
          type: "image/jpeg",
          arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff]).buffer,
        }
        : {
          size: 5,
          name: expected.file,
          type: "application/pdf",
          arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer,
        },
    });

    assert.equal(result.ok, true, expected.file);
    assert.equal(result.purchaseOrderDocument.poNumber, expected.poNumber);
    assert.equal(result.lines.length, expected.lines.length);
    assert.equal(result.lineSelectionRequired, expected.lines.length > 1);
    assert.deepEqual(result.lines.map((line) => ({
      itemCode: line.extractedItemCode,
      quantity: line.quantity ?? null,
      status: line.status,
      resolvedItemCode: line.resolvedItemCode ?? null,
      candidates: line.candidates,
    })), expected.lines.map((line) => ({
      itemCode: line.itemCode,
      quantity: line.quantity,
      status: line.status,
      resolvedItemCode: line.resolvedItemCode,
      candidates: line.candidates,
    })));
    assert.equal(OrderExtractionApiResponseSchema.safeParse(result).success, true);
  }
});

test("ambiguous catalog line resolves only to a candidate explicitly selected by the operator", async () => {
  const chosen = "PKBX0242-TOPS";
  const service = createPdfOrderExtractionService({
    storage: {
      createObjectName: () => "orders/ambiguous.pdf",
      upload: async () => ({ gcsUri: "gs://prepagent-hack-data/orders/ambiguous.pdf" }),
      delete: async () => {},
    },
    gemini: {
      generateJson: async () => ({
        poNumber: "CLQ/PUR/0915",
        lines: [{ itemCode: "PKBX0242", quantity: 400, sourcePage: 1 }],
      }),
    },
    itemCatalog: {
      resolveOrderLine: async ({ itemCode, quantity, selectedItemCode }) => ({
        status: "AMBIGUOUS",
        candidates: ["PKBX0242-TOPS", "PKBX0242-BOTS"],
        ...(selectedItemCode === chosen ? {
          resolvedItemCode: chosen,
          orderProfile: { ...jobSheetFixture.order, itemCode: chosen, quantity },
        } : {}),
      }),
    },
  });

  const unresolved = await service({
    file: { size: 5, name: "test.pdf", type: "application/pdf", arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer },
  });
  const selected = await service({
    file: { size: 5, name: "test.pdf", type: "application/pdf", arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer },
    selectedLineIndex: 0,
    confirmedItemCode: chosen,
  });

  assert.deepEqual(unresolved.lines[0].candidates, ["PKBX0242-TOPS", "PKBX0242-BOTS"]);
  assert.equal(unresolved.lines[0].resolvedItemCode, undefined);
  assert.equal(selected.lines[0].status, "AMBIGUOUS");
  assert.equal(selected.lines[0].resolvedItemCode, chosen);
  assert.equal(selected.lines[0].orderProfile.itemCode, chosen);
});

test("failed Gemini extraction removes the uploaded PDF and reports only a safe failure code", async () => {
  let deleted;
  const service = createPdfOrderExtractionService({
    storage: {
      createObjectName: () => "orders/failed.pdf",
      upload: async () => ({
        gcsUri: "gs://prepagent-hack-data/orders/failed.pdf",
        generation: "17",
      }),
      delete: async (request) => { deleted = request; },
    },
    gemini: {
      generateJson: async () => {
        throw new VertexGeminiError("VERTEX_GENERATION_FAILED", "provider response detail must not escape");
      },
    },
    itemCatalog: { getOrderProfile: async () => assert.fail("catalog must not run after Gemini fails") },
  });

  const result = await service({
    file: { size: 5, name: "test.pdf", type: "application/pdf", arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer },
  });

  assert.deepEqual(deleted, { name: "orders/failed.pdf", generation: "17" });
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  assert.match(result.error.message, /Vertex AI failed \(VERTEX_GENERATION_FAILED\)/);
  assert.doesNotMatch(result.error.message, /provider response detail/);
});

test("unexpected PO extraction errors log only a redacted diagnostic", async () => {
  const logs = [];
  const originalConsoleError = console.error;
  const service = createPdfOrderExtractionService({
    storage: {
      createObjectName: () => "orders/failed.pdf",
      upload: async () => ({ gcsUri: "gs://prepagent-hack-data/orders/failed.pdf" }),
      delete: async () => {},
    },
    gemini: {
      generateJson: async () => {
        throw new Error("sensitive purchase order or provider details");
      },
    },
    itemCatalog: { getOrderProfile: async () => assert.fail("catalog must not run after Gemini fails") },
  });

  try {
    console.error = (message) => logs.push(message);
    const result = await service({
      file: { size: 5, name: "test.pdf", type: "application/pdf", arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
    assert.match(result.error.message, /extraction failed \(INTEGRATION_ERROR\)/);
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(JSON.parse(logs[0]), {
    event: "order_extraction_failed",
    stage: "extraction",
    code: "INTEGRATION_ERROR",
    errorType: "Error",
  });
  assert.doesNotMatch(logs[0], /sensitive purchase order or provider details/);
});

test("PO extraction rejects an operator order ID that differs from the extracted PO number", async () => {
  const service = createPdfOrderExtractionService({
    storage: {
      createObjectName: () => "orders/mismatch.pdf",
      upload: async () => ({ gcsUri: "gs://prepagent-hack-data/orders/mismatch.pdf" }),
      delete: async () => {},
    },
    gemini: { generateJson: async () => ({ poNumber: "CLA/PO/2026/1047", lines: [{}] }) },
    itemCatalog: { getOrderProfile: async () => assert.fail("no item lookup without an item code") },
  });
  const result = await service({
    file: { size: 5, name: "test.pdf", type: "application/pdf", arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer },
    operatorFields: { orderId: "OTHER-PO", paperType: "RECYCLED", paperSupplier: "SUP-D" },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.issues[0].code, "purchase_order_mismatch");
});

test("PO extraction preserves invalid delivery dates as missing metadata for operator review", async () => {
  const service = createPdfOrderExtractionService({
    storage: {
      createObjectName: () => "orders/invalid-date.pdf",
      upload: async () => ({ gcsUri: "gs://prepagent-hack-data/orders/invalid-date.pdf" }),
      delete: async () => {},
    },
    gemini: { generateJson: async () => ({ deliveryDate: "31-02-2026", lines: [{}] }) },
    itemCatalog: { getOrderProfile: async () => assert.fail("a line without an item code must not query the catalog") },
  });
  const result = await service({
    file: { size: 5, name: "test.pdf", type: "application/pdf", arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.documentMissingFields, ["poNumber", "buyer", "deliveryDate"]);
  assert.equal(result.lines[0].status, "MALFORMED");
  assert.ok(result.lines[0].validationIssues.includes("SOURCE_PAGE_MISSING"));
});

test("invalid operator order context is rejected before storage, Gemini, or BigQuery", async () => {
  const service = createPdfOrderExtractionService({
    storage: {
      createObjectName: () => assert.fail("invalid form data must be rejected before upload"),
      upload: async () => assert.fail("invalid form data must be rejected before upload"),
      delete: async () => assert.fail("invalid form data must be rejected before upload"),
    },
    gemini: { generateJson: async () => assert.fail("Gemini must not be called") },
    itemCatalog: { getOrderProfile: async () => assert.fail("BigQuery must not be called") },
  });

  const result = await service({
    file: { size: 5, name: "test.pdf", type: "application/pdf", arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer },
    operatorFields: { orderId: "PO-2042", paperType: "UNKNOWN", paperSupplier: "SUP-D" },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.equal(result.error.issues[0].field, "paperType");
});

test("PDF extraction service rejects oversized input before reading or uploading", async () => {
  let read = false;
  const service = createPdfOrderExtractionService({
    storage: {
      createObjectName: () => "orders/test.pdf",
      upload: async () => assert.fail("must not upload"),
      delete: async () => assert.fail("must not delete"),
    },
    gemini: { generateJson: async () => assert.fail("must not invoke Gemini") },
    itemCatalog: { getOrderProfile: async () => assert.fail("must not look up catalog") },
  });
  const result = await service({ file: { size: 10 * 1024 * 1024 + 1, arrayBuffer: async () => { read = true; } } });
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.equal(read, false);
});

test("PDF extraction reports omitted PO fields for clarification without guessing or querying catalog", async () => {
  const service = createPdfOrderExtractionService({
    storage: {
      createObjectName: () => "orders/test.pdf",
      upload: async () => ({ gcsUri: "gs://prepagent-hack-data/orders/test.pdf" }),
      delete: async () => {},
    },
    gemini: { generateJson: async () => ({ lines: [{ quantity: 25 }] }) },
    itemCatalog: { getOrderProfile: async () => assert.fail("item lookup needs an extracted item code") },
  });
  const result = await service({
    file: { size: 5, name: "test.pdf", type: "application/pdf", arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer },
  });

  assert.equal(result.orderProfile, undefined);
  assert.equal(result.lines[0].status, "MALFORMED");
  assert.equal(result.lines[0].quantity, 25);
  assert.ok(result.lines[0].validationIssues.includes("SOURCE_PAGE_MISSING"));
  assert.deepEqual(result.missingFields, []);
  assert.deepEqual(result.documentMissingFields, ["poNumber", "buyer", "deliveryDate"]);
  assert.equal(result.needsClarification, true);
});

test("PDF extraction holds a matched line when source-page provenance is absent or invalid", async (t) => {
  for (const [name, sourcePage, expectedIssue] of [
    ["absent", undefined, "SOURCE_PAGE_MISSING"],
    ["invalid", 0, "SOURCE_PAGE_INVALID"],
  ]) {
    await t.test(name, async () => {
      const service = createPdfOrderExtractionService({
        storage: {
          createObjectName: () => "orders/page-provenance.pdf",
          upload: async () => ({ gcsUri: "gs://prepagent-hack-data/orders/page-provenance.pdf" }),
          delete: async () => {},
        },
        gemini: {
          generateJson: async () => ({
            lines: [{
              itemCode: "PKBX0041",
              quantity: 1300,
              ...(sourcePage === undefined ? {} : { sourcePage }),
            }],
          }),
        },
        itemCatalog: {
          resolveOrderLine: async ({ itemCode, quantity }) => ({
            status: "MATCHED",
            candidates: [],
            resolvedItemCode: itemCode,
            orderProfile: { ...jobSheetFixture.order, itemCode, quantity },
          }),
        },
      });
      const result = await service({
        file: {
          size: 5,
          name: "test.pdf",
          type: "application/pdf",
          arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer,
        },
      });

      assert.equal(result.ok, true);
      assert.equal(result.lines[0].status, "MALFORMED");
      assert.ok(result.lines[0].validationIssues.includes(expectedIssue));
      assert.equal(result.lines[0].sourcePage, undefined);
      assert.equal(result.needsClarification, true);
    });
  }
});

test("PDF extraction preserves malformed source lines and invalid document metadata for operator review", async () => {
  const service = createPdfOrderExtractionService({
    storage: {
      createObjectName: () => "orders/malformed.pdf",
      upload: async () => ({ gcsUri: "gs://prepagent-hack-data/orders/malformed.pdf" }),
      delete: async () => {},
    },
    gemini: {
      generateJson: async () => ({
        poNumber: "PO-MALFORMED",
        buyer: "Buyer from supplied source",
        deliveryDate: "31-02-2026",
        lines: [null, { itemCode: "PKBX0041", quantity: "1300" }],
      }),
    },
    itemCatalog: {
      resolveOrderLine: async ({ itemCode, quantity }) => ({
        status: "MATCHED",
        candidates: [],
        resolvedItemCode: itemCode,
        orderProfile: { ...jobSheetFixture.order, itemCode, quantity },
      }),
    },
  });
  const result = await service({
    file: {
      size: 5,
      name: "malformed.pdf",
      type: "application/pdf",
      arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45]).buffer,
    },
    operatorFields: {
      orderId: "PO-MALFORMED",
      paperType: "RECYCLED",
      paperSupplier: "SUP-D",
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.documentMissingFields, ["deliveryDate"]);
  assert.equal(result.lines.length, 2);
  assert.equal(result.lines[0].status, "MALFORMED");
  assert.deepEqual(result.lines[0].validationIssues, ["LINE_INVALID"]);
  assert.equal(result.lines[1].status, "MALFORMED");
  assert.equal(result.lines[1].catalogStatus, "MATCHED");
  assert.deepEqual(result.lines[1].validationIssues, [
    "QUANTITY_INVALID",
    "SOURCE_PAGE_MISSING",
  ]);
  assert.equal(result.lines[1].quantity, undefined);
  assert.equal(result.needsClarification, true);
  assert.equal(OrderExtractionApiResponseSchema.safeParse(result).success, true);
});

test("item catalog uses a bounded parameterized lookup and maps only matching source fields", async () => {
  let request;
  const fields = [
    ["item_code", "STRING", "SKU-1"], ["customer_id", "STRING", "CUST-1"],
    ["box_style", "STRING", "RSC"], ["length_mm", "INT64", "1392"],
    ["width_mm", "INT64", "420"], ["height_mm", "INT64", "0"], ["ply", "INT64", "5"],
    ["flute_profile", "STRING", "BC"], ["top_liner_gsm", "INT64", "125"],
    ["flute_gsm", "INT64", "115"], ["inner_liner_gsm", "INT64", "125"],
    ["liner_bf", "INT64", "18"], ["ink_colors", "INT64", "0"],
    ["ink_coverage_pct", "FLOAT64", "0"],
  ];
  const catalog = createItemCatalogService({
    bigquery: {
      query: async (value) => {
        request = value;
        return {
          schema: { fields: fields.map(([name, type]) => ({ name, type })) },
          rows: [{ f: fields.map(([, , value]) => ({ v: value })) }],
        };
      },
    },
  });

  const result = await catalog.getOrderProfile({ itemCode: " SKU-1 ", quantity: 30 });
  assert.equal(request.sql, buildItemLookupSql("prepagent-hack"));
  assert.deepEqual(request.parameters, { itemCode: "SKU-1" });
  assert.equal(result.itemCode, "SKU-1");
  assert.equal(result.quantity, 30);
  assert.equal(result.lengthMm, 1392);
  assert.equal(result.heightMm, 0);
  assert.equal(result.paperType, undefined);
  assert.equal(result.paperSupplier, undefined);
  assert.equal(result.orderId, undefined);
});

test("item catalog decodes BigQuery REST INTEGER and FLOAT field types", async () => {
  const fields = [
    ["item_code", "STRING", "SKU-1"], ["customer_id", "STRING", "CUST-1"],
    ["box_style", "STRING", "RSC"], ["length_mm", "INTEGER", "1392"],
    ["width_mm", "INTEGER", "420"], ["height_mm", "INTEGER", "260"],
    ["ply", "INTEGER", "5"], ["flute_profile", "STRING", "BC"],
    ["top_liner_gsm", "INTEGER", "125"], ["flute_gsm", "INTEGER", "115"],
    ["inner_liner_gsm", "INTEGER", "125"], ["liner_bf", "INTEGER", "18"],
    ["ink_colors", "INTEGER", "2"], ["ink_coverage_pct", "FLOAT", "40"],
  ];
  const catalog = createItemCatalogService({
    bigquery: {
      query: async () => ({
        schema: { fields: fields.map(([name, type]) => ({ name, type })) },
        rows: [{ f: fields.map(([, , value]) => ({ v: value })) }],
      }),
    },
  });

  const result = await catalog.getOrderProfile({ itemCode: "SKU-1", quantity: 30 });

  assert.equal(result.lengthMm, 1392);
  assert.equal(result.widthMm, 420);
  assert.equal(result.heightMm, 260);
  assert.equal(result.ply, 5);
  assert.equal(result.topLinerGsm, 125);
  assert.equal(result.fluteGsm, 115);
  assert.equal(result.innerLinerGsm, 125);
  assert.equal(result.linerBf, 18);
  assert.equal(result.inkColors, 2);
  assert.equal(result.inkCoveragePct, 40);
});

test("item catalog preserves ambiguous candidates and resolves only the selected catalog code", async () => {
  const fields = [
    ["item_code", "STRING"], ["customer_id", "STRING"], ["box_style", "STRING"],
    ["length_mm", "INT64"], ["width_mm", "INT64"], ["height_mm", "INT64"],
    ["ply", "INT64"], ["flute_profile", "STRING"], ["top_liner_gsm", "INT64"],
    ["flute_gsm", "INT64"], ["inner_liner_gsm", "INT64"], ["liner_bf", "INT64"],
    ["ink_colors", "INT64"], ["ink_coverage_pct", "FLOAT64"],
  ];
  const valuesFor = (itemCode) => [
    itemCode, "CUST-1", "RSC", "520", "360", "260", "3", "B", "125",
    "115", "125", "18", "2", "40",
  ];
  let request;
  const catalog = createItemCatalogService({
    bigquery: {
      query: async (value) => {
        request = value;
        return {
          schema: { fields: fields.map(([name, type]) => ({ name, type })) },
          rows: ["PKBX0242-BOTS", "PKBX0242-TOPS"].map((itemCode) => ({
            f: valuesFor(itemCode).map((v) => ({ v })),
          })),
        };
      },
    },
  });

  const result = await catalog.resolveOrderLine({
    itemCode: "PKBX0242",
    quantity: 400,
    selectedItemCode: "PKBX0242-TOPS",
  });

  assert.equal(request.sql, buildItemResolutionSql("prepagent-hack"));
  assert.match(request.sql, /STARTS_WITH\(item_code, CONCAT\(@itemCode, '-'\)\)/);
  assert.deepEqual(request.parameters, { itemCode: "PKBX0242" });
  assert.deepEqual(result.candidates, ["PKBX0242-BOTS", "PKBX0242-TOPS"]);
  assert.equal(result.status, "AMBIGUOUS");
  assert.equal(result.resolvedItemCode, "PKBX0242-TOPS");
  assert.equal(result.orderProfile.itemCode, "PKBX0242-TOPS");
  assert.equal(result.orderProfile.quantity, 400);
});

test("configured ports require both manifest and runtime opt-in", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; throw new Error("unexpected network call"); };
  const common = {
    env: { USTAAD_ENABLE_LIVE_MODEL_CALLS: "true" },
    fetchImpl,
    tokenProvider: async () => "test-token",
  };
  const disabled = createConfiguredServicePorts({
    ...common,
    modelConfig: { projectId: "prepagent-hack", location: "asia-south1", testModel: "gemini-3.5-flash", modelCallsEnabled: false },
    bucketConfig: { bucket: { name: "prepagent-hack-data" } },
  });
  assert.equal((await disabled.extractOrder()).error.code, "SERVICE_UNAVAILABLE");
  assert.equal(called, false);

  const cloudStorage = createConfiguredServicePorts({
    ...common,
    env: { USTAAD_ENABLE_JOB_STORAGE: "true", USTAAD_ENABLE_BIGQUERY_WRITES: "true" },
    modelConfig: { projectId: "prepagent-hack", location: "asia-south1", testModel: "gemini-3.5-flash", modelCallsEnabled: false },
    bucketConfig: { bucket: { name: "prepagent-hack-data" } },
  });
  assert.equal(typeof cloudStorage.createDraftJobSheet, "function");
  assert.equal(typeof cloudStorage.getStoredJobSheet, "function");
  assert.equal(typeof cloudStorage.approveJob, "function");
  assert.equal(typeof cloudStorage.getJobCard, "function");
  assert.equal(called, false);
});

test("live model configuration fails closed except for the exact runtime opt-in", async () => {
  for (const runtimeFlag of [undefined, "", "false", "TRUE", "1"]) {
    let providerCalled = false;
    const ports = createConfiguredServicePorts({
      env: { USTAAD_ENABLE_LIVE_MODEL_CALLS: runtimeFlag },
      modelConfig: {
        projectId: "prepagent-hack",
        location: "asia-south1",
        testModel: "gemini-3.5-flash",
        modelCallsEnabled: true,
      },
      bucketConfig: { bucket: { name: "prepagent-hack-data" } },
      tokenProvider: async () => {
        providerCalled = true;
        return "test-token";
      },
      fetchImpl: async () => {
        providerCalled = true;
        throw new Error("disabled model configuration must not make a request");
      },
    });

    assert.equal(ports.availability.extractOrder, false, `flag=${String(runtimeFlag)}`);
    assert.equal((await ports.extractOrder()).error.code, "SERVICE_UNAVAILABLE");
    assert.equal(providerCalled, false, `flag=${String(runtimeFlag)}`);
  }
});

test("enabled model configuration reaches the Vertex adapter through offline extraction wiring", async () => {
  const calls = [];
  const catalogFields = [
    ["item_code", "STRING"], ["customer_id", "STRING"], ["box_style", "STRING"],
    ["length_mm", "INT64"], ["width_mm", "INT64"], ["height_mm", "INT64"],
    ["ply", "INT64"], ["flute_profile", "STRING"], ["top_liner_gsm", "INT64"],
    ["flute_gsm", "INT64"], ["inner_liner_gsm", "INT64"], ["liner_bf", "INT64"],
    ["ink_colors", "INT64"], ["ink_coverage_pct", "FLOAT64"],
  ];
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), method: options.method ?? "GET" });

    if (url.hostname === "storage.googleapis.com") {
      return jsonResponse({ name: url.searchParams.get("name"), generation: "1" });
    }
    if (url.hostname.endsWith("aiplatform.googleapis.com")) {
      return jsonResponse({
        candidates: [{
          content: {
            role: "model",
            parts: [{ text: JSON.stringify({ lines: [{ itemCode: "SKU-1", quantity: 25, sourcePage: 1 }] }) }],
          },
        }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 8, totalTokenCount: 18 },
      });
    }
    if (url.hostname === "bigquery.googleapis.com") {
      return jsonResponse({
        jobComplete: true,
        totalRows: "1",
        schema: { fields: catalogFields.map(([name, type]) => ({ name, type })) },
        rows: [{
          f: ["SKU-1", "CUST-1", "RSC", "520", "360", "260", "3", "B", "125", "115",
            "125", "18", "4", "52"].map((v) => ({ v })),
        }],
      });
    }
    throw new Error(`Unexpected mocked request to ${url.hostname}`);
  };
  const ports = createConfiguredServicePorts({
    env: {
      PROJECT_ID: "prepagent-hack",
      REGION: "asia-south1",
      BUCKET: "prepagent-hack-data",
      VERTEX_LOCATION: "asia-south1",
      GEMINI_MODEL: "gemini-3.5-flash",
      USTAAD_ENABLE_LIVE_MODEL_CALLS: "true",
    },
    modelConfig: {
      projectId: "prepagent-hack",
      location: "asia-south1",
      testModel: "gemini-3.5-flash",
      modelCallsEnabled: true,
    },
    bucketConfig: { bucket: { name: "prepagent-hack-data" } },
    tokenProvider: async () => "offline-test-token",
    fetchImpl,
  });

  const result = await ports.extractOrder({
    file: {
      size: 9,
      name: "synthetic-order.pdf",
      type: "application/pdf",
      arrayBuffer: async () => new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10]).buffer,
    },
    operatorFields: {
      orderId: "PO-SYNTHETIC-001",
      paperType: "RECYCLED",
      paperSupplier: "SUPPLIER-SYNTHETIC",
    },
  });

  assert.equal(ports.availability.extractOrder, true);
  assert.equal(result.ok, true);
  assert.equal(result.source, "vertex-gemini");
  assert.equal(result.orderProfile.itemCode, "SKU-1");
  assert.equal(result.orderProfile.quantity, 25);
  assert.ok(calls.some(({ url }) => url.includes("aiplatform.googleapis.com") &&
    url.endsWith(":generateContent")));
  assert.equal(calls.filter(({ url }) => url.includes("aiplatform.googleapis.com")).length, 1);
  assert.ok(calls.some(({ url }) => url.includes("bigquery.googleapis.com")));
  assert.ok(calls.some(({ url }) => url.includes("storage.googleapis.com")));
});

test("similar-run SQL is available under its read gate without enabling Gemini", () => {
  const ports = createConfiguredServicePorts({
    env: {
      PROJECT_ID: "prepagent-hack",
      REGION: "asia-south1",
      USTAAD_PLANT_ID: "PLANT-01",
      USTAAD_ENABLE_RISK_PREDICTION: "true",
      USTAAD_ENABLE_HISTORICAL_EVIDENCE: "true",
      USTAAD_ENABLE_LIVE_MODEL_CALLS: "false",
    },
    modelConfig: {
      projectId: "prepagent-hack",
      location: "asia-south1",
      testModel: "gemini-3.5-flash",
      modelCallsEnabled: false,
    },
    bucketConfig: { bucket: { name: "prepagent-hack-data" } },
  });

  assert.equal(ports.availability.findSimilarRuns, true);
  assert.equal(ports.availability.findSeenBefore, true);
  assert.equal(ports.availability.explainRisk, false);
  assert.equal(ports.availability.extractOrder, false);
});
