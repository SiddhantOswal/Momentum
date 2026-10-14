import assert from "node:assert/strict";
import test from "node:test";
import { jobSheetFixture } from "./fixtures/job-sheet.js";
import { createTraceRegistry } from "../src/trace-registry.js";
import { createJobCoordinator } from "../src/job-coordinator.js";

function traceIdFactory() {
  let sequence = 0;
  return () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
}

function input(overrides = {}) {
  return {
    file: { arrayBuffer: async () => new ArrayBuffer(1) },
    operatorFields: {
      orderId: jobSheetFixture.order.orderId,
      paperType: jobSheetFixture.order.paperType,
      paperSupplier: jobSheetFixture.order.paperSupplier,
    },
    operatorItemConfirmation: {
      itemCode: jobSheetFixture.order.itemCode,
      quantity: jobSheetFixture.order.quantity,
    },
    shift: jobSheetFixture.conditions.shift,
    levers: jobSheetFixture.baseline.levers,
    conditionsConfirmed: true,
    ...overrides,
  };
}

const acceptedTestProvenance = {
  readingId: "READ-OFFLINE-TEST-001",
  timestamp: "2026-10-11T11:59:00.000Z",
  plantId: "PLANT-01",
  source: "simulated",
  recordedSource: "pubsub-bq-subscription",
  retrievedAt: "2026-10-11T12:00:00.000Z",
  ageSeconds: 60,
  freshness: "fresh",
};

function services(overrides = {}) {
  const calls = [];
  return {
    calls,
    extractOrder: async (request) => {
      calls.push(["extractOrder", request]);
      return {
        ok: true,
        orderProfile: jobSheetFixture.order,
        missingFields: [],
        needsClarification: false,
      };
    },
    currentConditions: async (request) => {
      calls.push(["getConditions", request]);
      return { ok: true, data: jobSheetFixture.conditions, provenance: acceptedTestProvenance };
    },
    predictRisk: async (request) => {
      calls.push(["predictRisk", request]);
      return { ok: true, ...jobSheetFixture.baseline.risk };
    },
    optimizeRisk: async (request) => {
      calls.push(["optimizeRisk", request]);
      return {
        ok: false,
        error: { code: "SERVICE_UNAVAILABLE", message: "Om's optimizer SQL is not configured." },
      };
    },
    ...overrides,
  };
}

test("job coordinator executes verified stages in order and traces the first unavailable Om tool", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const ports = services();
  const prepareJob = createJobCoordinator({ services: ports, traceRegistry });

  const result = await prepareJob(input());

  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "optimizeLevers");
  assert.deepEqual(result.completedStages, ["extractOrder", "getConditions", "predictRisk"]);
  assert.deepEqual(ports.calls.map(([name]) => name), [
    "extractOrder", "getConditions", "predictRisk", "optimizeRisk",
  ]);
  assert.equal(ports.calls[1][1].shift, "DAY");
  assert.equal(ports.calls[2][1].order.itemCode, jobSheetFixture.order.itemCode);

  const events = traceRegistry.getEventsAfter(result.runId);
  assert.deepEqual(events.map((event) => event.type), [
    "run.started",
    "tool.started", "tool.succeeded",
    "tool.started", "tool.succeeded",
    "tool.started", "tool.succeeded",
    "tool.started", "tool.unavailable",
    "run.failed",
  ]);
  assert.deepEqual(events.filter((event) => event.tool).map((event) => event.tool), [
    "extractOrder", "extractOrder", "getConditions", "getConditions",
    "predictRisk", "predictRisk", "optimizeLevers", "optimizeLevers",
  ]);
});

test("job coordinator uses supervisor-confirmed manual conditions without querying a sensor adapter", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  let predictionRequest;
  const ports = services({
    currentConditions: async () => { throw new Error("manual input should bypass sensor lookup"); },
    predictRisk: async (request) => {
      predictionRequest = request;
      return { ok: true, ...jobSheetFixture.baseline.risk, modelAcceptance: { status: "accepted" } };
    },
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry })(input({
    manualConditions: {
      runDate: "2026-10-14",
      shift: "DAY",
      ambientRhPct: 70,
      ambientTempC: 29,
      paperMoisturePct: 9,
    },
    conditionsConfirmed: true,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "optimizeLevers");
  assert.deepEqual(predictionRequest.conditions, {
    shift: "DAY", ambientRhPct: 70, ambientTempC: 29, paperMoisturePct: 9,
  });
  assert.equal(ports.calls.some(([name]) => name === "getConditions"), false);
});

test("job coordinator blocks real model results without accepted version-linked evidence", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const ports = services({
    predictRisk: async () => ({
      ok: true,
      source: "bigquery-ml",
      isRealModelPrediction: true,
      ...jobSheetFixture.baseline.risk,
      modelProvenance: { outputs: [{ defect: "WARP", resource: "prepagent.m_warp", modelVersion: null }] },
      modelAcceptance: { status: "blocked", requiredR2: 0.6 },
    }),
    optimizeRisk: async () => {
      assert.fail("Optimization must not run for an unaccepted live model set.");
    },
  });

  const result = await createJobCoordinator({ services: ports, traceRegistry })(input());
  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "modelAcceptance");
  assert.deepEqual(result.completedStages, ["extractOrder", "getConditions", "predictRisk"]);
  assert.equal(result.modelAcceptance.status, "blocked");
  assert.equal(result.modelProvenance.outputs[0].modelVersion, null);
  assert.equal(traceRegistry.getRun(result.runId).status, "failed");
});

test("job coordinator assembles a validated draft and closes the trace after all supplied services succeed", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const optimization = {
    baseline: jobSheetFixture.baseline,
    best: jobSheetFixture.recommended,
    changes: [],
    savings: jobSheetFixture.savings,
    note: "The optimizer contract is provisional.",
  };
  const evidence = [{
    lotId: "LOT-SYNTHETIC-001",
    orderId: "PO-SYNTHETIC-001",
    runDate: jobSheetFixture.conditions.runDate,
    primaryDefect: "WARP",
    ratesPct: jobSheetFixture.baseline.risk.ratesPct,
    levers: jobSheetFixture.baseline.levers,
  }];
  let explanationRequest;
  const ports = services({
    optimizeRisk: async () => ({ ok: true, ...optimization }),
    findSimilarRuns: async () => ({ ok: true, evidence }),
    explainRisk: async (request) => {
      explanationRequest = request;
      return { ok: true, explanation: "Synthetic explanation from the test service." };
    },
  });

  const result = await createJobCoordinator({
    services: ports,
    traceRegistry,
    plantId: "PLANT-01",
  })(input());

  assert.equal(result.ok, true);
  assert.equal(result.jobSheet.status, "DRAFT");
  assert.equal(result.jobSheet.plantId, "PLANT-01");
  assert.equal(result.jobSheet.order.orderId, jobSheetFixture.order.orderId);
  assert.deepEqual(result.jobSheet.evidence, evidence);
  assert.match(result.jobSheet.explanation, /^Savings are optimizer-reported estimates, not verified production outcomes\. The optimizer contract is provisional\. Synthetic explanation from the test service\.$/);
  assert.deepEqual(explanationRequest.prediction, jobSheetFixture.baseline.risk);
  assert.deepEqual(explanationRequest.evidence, evidence);
  assert.deepEqual(result.completedStages, [
    "extractOrder", "getConditions", "predictRisk", "optimizeLevers",
    "findSimilarRuns", "explainRisk", "generateJobSheet",
  ]);
  assert.equal(traceRegistry.getRun(result.runId).status, "completed");
  const events = traceRegistry.getEventsAfter(result.runId);
  assert.deepEqual(events.filter((event) => event.type === "tool.started").map((event) => event.tool), [
    "extractOrder", "getConditions", "predictRisk", "optimizeLevers",
    "findSimilarRuns", "explainRisk", "generateJobSheet",
  ]);
  assert.equal(events.at(-1).type, "run.completed");
});

test("job coordinator blocks an optimizer baseline that disagrees with the prediction", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  let downstreamCalls = 0;
  const ports = services({
    optimizeRisk: async () => ({
      ok: true,
      baseline: {
        ...jobSheetFixture.baseline,
        risk: { ...jobSheetFixture.baseline.risk, scrapCost: 123 },
      },
      best: jobSheetFixture.recommended,
      changes: [],
      savings: jobSheetFixture.savings,
    }),
    findSimilarRuns: async () => {
      downstreamCalls += 1;
      return { ok: true, evidence: [] };
    },
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry })(input());

  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "optimizeLevers");
  assert.equal(result.error.issues[0].code, "prediction_baseline_mismatch");
  assert.deepEqual(result.completedStages, ["extractOrder", "getConditions", "predictRisk"]);
  assert.equal(downstreamCalls, 0);
});

test("job coordinator blocks optimizer settings and change lists that disagree with the validated plan", async (t) => {
  await t.test("planned baseline mismatch", async () => {
    const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
    const ports = services({
      optimizeRisk: async () => ({
        ok: true,
        baseline: {
          ...jobSheetFixture.baseline,
          levers: { ...jobSheetFixture.baseline.levers, rollTempC: 160 },
        },
        best: jobSheetFixture.recommended,
        changes: [],
        savings: jobSheetFixture.savings,
      }),
    });
    const result = await createJobCoordinator({ services: ports, traceRegistry })(input());
    assert.equal(result.blockedAt, "optimizeLevers");
    assert.equal(result.error.issues[0].code, "prediction_baseline_mismatch");
  });

  await t.test("unsubstantiated change entry", async () => {
    const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
    const ports = services({
      optimizeRisk: async () => ({
        ok: true,
        baseline: jobSheetFixture.baseline,
        best: jobSheetFixture.recommended,
        changes: [{
          lever: "rollTempC",
          from: 160,
          to: 165,
          reason: "Not represented by the recommended settings.",
        }],
        savings: jobSheetFixture.savings,
      }),
    });
    const result = await createJobCoordinator({ services: ports, traceRegistry })(input());
    assert.equal(result.blockedAt, "optimizeLevers");
    assert.equal(result.error.issues[0].code, "prediction_baseline_mismatch");
  });
});

test("job coordinator blocks internally inconsistent predicted rates before optimization", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  let optimizationCalls = 0;
  const ports = services({
    predictRisk: async () => ({
      ok: true,
      ...jobSheetFixture.baseline.risk,
      totalScrapPct: 6,
    }),
    optimizeRisk: async () => {
      optimizationCalls += 1;
      return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Not expected." } };
    },
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry })(input());

  assert.equal(result.blockedAt, "predictRisk");
  assert.equal(result.error.issues[0].code, "risk_summary_mismatch");
  assert.deepEqual(result.completedStages, ["extractOrder", "getConditions"]);
  assert.equal(optimizationCalls, 0);
});

test("job coordinator blocks malformed historical evidence before explanation", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  let explanationCalls = 0;
  const ports = services({
    optimizeRisk: async () => ({
      ok: true,
      baseline: jobSheetFixture.baseline,
      best: jobSheetFixture.recommended,
      changes: [],
      savings: jobSheetFixture.savings,
    }),
    findSimilarRuns: async () => ({ ok: true, evidence: [{ lotId: "not enough evidence" }] }),
    explainRisk: async () => {
      explanationCalls += 1;
      return { ok: true, explanation: "Should not be called." };
    },
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry })(input());

  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "findSimilarRuns");
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.deepEqual(result.completedStages, [
    "extractOrder", "getConditions", "predictRisk", "optimizeLevers",
  ]);
  assert.equal(explanationCalls, 0);
});

test("job coordinator propagates stored conditions and provenance without changing values", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const optimization = {
    baseline: jobSheetFixture.baseline,
    best: jobSheetFixture.recommended,
    changes: [],
    savings: jobSheetFixture.savings,
  };
  const conditions = {
    ...jobSheetFixture.conditions,
    ambientRhPct: 61.5,
    ambientTempC: 24.2,
    paperMoisturePct: 8.3,
  };
  const provenance = {
    readingId: "READ-LIVE-TEST-001",
    timestamp: "2026-10-14T06:30:00.000Z",
    plantId: "PLANT-01",
    source: "simulated",
    recordedSource: "pubsub-bq-subscription",
    retrievedAt: "2026-10-14T06:31:00.000Z",
    ageSeconds: 60,
    freshness: "fresh",
  };
  let predictionRequest;
  let optimizationRequest;
  const ports = services({
    currentConditions: async () => ({ ok: true, data: conditions, provenance }),
    predictRisk: async (request) => {
      predictionRequest = request;
      return { ok: true, ...jobSheetFixture.baseline.risk };
    },
    optimizeRisk: async (request) => {
      optimizationRequest = request;
      return { ok: true, ...optimization };
    },
    findSimilarRuns: async () => ({ ok: true, evidence: [] }),
    explainRisk: async () => ({ ok: true, explanation: "Test-only injected explanation." }),
  });

  const result = await createJobCoordinator({
    services: ports,
    traceRegistry,
    plantId: "PLANT-01",
  })(input());

  assert.equal(result.ok, true);
  assert.deepEqual(predictionRequest.conditions, {
    shift: conditions.shift,
    ambientRhPct: 61.5,
    ambientTempC: 24.2,
    paperMoisturePct: 8.3,
  });
  assert.deepEqual(optimizationRequest.conditions, conditions);
  assert.deepEqual(result.conditions, {
    ...conditions, conditionSource: "simulated-sensor", supervisorConfirmed: true, provenance,
  });
  assert.deepEqual(result.jobSheet.conditions, {
    ...conditions, conditionSource: "simulated-sensor", supervisorConfirmed: true, provenance,
  });
});

test("job coordinator blocks unverified sensor sources but not stale simulated readings", async (t) => {
  for (const [name, provenance] of [
    ["unverified", { ...acceptedTestProvenance, source: "unverified" }],
    ["live marker", { ...acceptedTestProvenance, source: "live" }],
    ["missing", undefined],
  ]) {
    await t.test(name, async () => {
      const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
      const ports = services({
        currentConditions: async () => ({
          ok: true,
          data: jobSheetFixture.conditions,
          ...(provenance === undefined ? {} : { provenance }),
        }),
      });
      const result = await createJobCoordinator({ services: ports, traceRegistry })(input());

      assert.equal(result.ok, false);
      assert.equal(result.blockedAt, "getConditions");
      assert.equal(result.error.issues[0].code, "sensor_conditions_unverified");
      assert.equal(ports.calls.some(([name]) => name === "predictRisk"), false);
      assert.equal(traceRegistry.getRun(result.runId).status, "failed");
    });
  }
});

test("job coordinator rejects empty explanation output before JobSheet generation", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const ports = services({
    optimizeRisk: async () => ({
      ok: true,
      baseline: jobSheetFixture.baseline,
      best: jobSheetFixture.recommended,
      changes: [],
      savings: jobSheetFixture.savings,
    }),
    findSimilarRuns: async () => ({ ok: true, evidence: [] }),
    explainRisk: async () => ({ ok: true, explanation: "   " }),
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry })(input());

  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "explainRisk");
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.ok(result.error.issues.some((issue) => issue.field === "explanation"));
  assert.equal(traceRegistry.getRun(result.runId).status, "failed");
});

test("job coordinator stops after extraction when the authoritative item profile needs clarification", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const ports = services({
    extractOrder: async () => ({
      ok: true,
      orderProfile: { itemCode: "SKU-TEST-42", quantity: 100 },
      missingFields: ["boxStyle", "customerId"],
      needsClarification: true,
    }),
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry })(input());

  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "extractOrder");
  assert.deepEqual(result.error.issues.map((issue) => issue.field), ["boxStyle", "customerId"]);
  assert.deepEqual(ports.calls.map(([name]) => name), []);
  assert.deepEqual(traceRegistry.getEventsAfter(result.runId).map((event) => event.type), [
    "run.started", "tool.started", "tool.succeeded", "run.failed",
  ]);
});

test("job coordinator stops when operator confirmation differs from extracted item and quantity", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const ports = services();
  const result = await createJobCoordinator({ services: ports, traceRegistry })(
    input({ operatorItemConfirmation: { itemCode: "OTHER-ITEM", quantity: 999 } })
  );

  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "extractOrder");
  assert.equal(result.error.issues[0].code, "extracted_item_mismatch");
  assert.deepEqual(ports.calls.map(([name]) => name), ["extractOrder"]);
});

test("job coordinator blocks a matched PO line with no source-page provenance", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const extractionCalls = [];
  const ports = services({
    extractOrder: async () => {
      extractionCalls.push("extractOrder");
      return {
        ok: true,
        lines: [{
          lineIndex: 0,
          extractedItemCode: jobSheetFixture.order.itemCode,
          resolvedItemCode: jobSheetFixture.order.itemCode,
          quantity: jobSheetFixture.order.quantity,
          status: "MATCHED",
          candidates: [],
          orderProfile: jobSheetFixture.order,
        }],
        missingFields: [],
        needsClarification: false,
      };
    },
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry })(
    input({
      operatorItemConfirmation: {
        itemCode: jobSheetFixture.order.itemCode,
        quantity: jobSheetFixture.order.quantity,
        lineIndex: 0,
      },
    })
  );

  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "extractOrder");
  assert.equal(result.error.issues[0].code, "source_page_missing");
  assert.deepEqual(extractionCalls, ["extractOrder"]);
  assert.equal(ports.calls.some(([name]) => name === "getConditions"), false);
});

test("job coordinator validates the selected line while retaining unresolved sibling lines", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const selectedOrder = {
    ...jobSheetFixture.order,
    itemCode: "SKU-LINE-2",
    quantity: 200,
  };
  let extractionRequest;
  let predictionRequest;
  const ports = services({
    extractOrder: async (request) => {
      extractionRequest = request;
      return {
        ok: true,
        orderProfile: selectedOrder,
        purchaseOrderDocument: { poNumber: "PO-MULTI-001" },
        lines: [
          {
            lineIndex: 0,
            sourcePage: 1,
            extractedItemCode: "SKU-UNKNOWN",
            quantity: 100,
            status: "UNKNOWN_CODE",
            candidates: [],
          },
          {
            lineIndex: 1,
            sourcePage: 1,
            extractedItemCode: "SKU-LINE-2",
            resolvedItemCode: "SKU-LINE-2",
            quantity: 200,
            status: "MATCHED",
            candidates: [],
            orderProfile: selectedOrder,
          },
        ],
        missingFields: [],
        needsClarification: true,
        lineSelectionRequired: false,
        selectedLineIndex: 1,
      };
    },
    predictRisk: async (request) => {
      predictionRequest = request;
      return { ok: true, ...jobSheetFixture.baseline.risk };
    },
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry })(
    input({
      operatorItemConfirmation: { itemCode: "SKU-LINE-2", quantity: 200, lineIndex: 1 },
    })
  );

  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "optimizeLevers");
  assert.equal(extractionRequest.selectedLineIndex, 1);
  assert.equal(extractionRequest.confirmedItemCode, "SKU-LINE-2");
  assert.equal(predictionRequest.order.itemCode, "SKU-LINE-2");
  assert.equal(result.purchaseOrderDocument.poNumber, "PO-MULTI-001");
  assert.equal(result.purchaseOrderLines[0].status, "UNKNOWN_CODE");
});

test("job coordinator blocks unresolved selected PO lines without starting conditions or prediction", async () => {
  for (const status of ["UNKNOWN_CODE", "MISSING_ITEM_CODE", "MISSING_QTY"]) {
    const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
    const calls = [];
    const ports = services({
      extractOrder: async () => {
        calls.push("extractOrder");
        return {
          ok: true,
          lines: [{
            lineIndex: 0,
            sourcePage: 1,
            extractedItemCode: status === "MISSING_ITEM_CODE" ? undefined : "SKU-UNRESOLVED",
            quantity: status === "MISSING_QTY" ? undefined : 100,
            status,
            candidates: [],
          }],
          selectedLineIndex: 0,
          missingFields: [],
          needsClarification: true,
          lineSelectionRequired: false,
        };
      },
      currentConditions: async () => {
        calls.push("getConditions");
        return { ok: true, data: jobSheetFixture.conditions };
      },
    });
    const result = await createJobCoordinator({ services: ports, traceRegistry })(
      input({ operatorItemConfirmation: { itemCode: "SKU-UNRESOLVED", quantity: 100 } })
    );

    assert.equal(result.ok, false);
    assert.equal(result.blockedAt, "extractOrder");
    assert.equal(result.error.issues[0].code, `line_${status.toLowerCase()}`);
    assert.equal(result.purchaseOrderLines[0].status, status);
    assert.deepEqual(calls, ["extractOrder"]);
  }
});

test("job coordinator requires a line selection for a multi-line purchase order", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const calls = [];
  const ports = services({
    extractOrder: async () => {
      calls.push("extractOrder");
      return {
        ok: true,
        lines: [
          { lineIndex: 0, sourcePage: 1, extractedItemCode: "SKU-1", quantity: 100, status: "MATCHED", candidates: [] },
          { lineIndex: 1, sourcePage: 1, extractedItemCode: "SKU-2", quantity: 200, status: "MATCHED", candidates: [] },
        ],
        missingFields: [],
        needsClarification: true,
        lineSelectionRequired: true,
      };
    },
    currentConditions: async () => {
      calls.push("getConditions");
      return { ok: true, data: jobSheetFixture.conditions };
    },
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry })(
    input({ operatorItemConfirmation: { itemCode: "SKU-1", quantity: 100 } })
  );

  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "extractOrder");
  assert.equal(result.error.issues[0].code, "line_selection_required");
  assert.equal(result.purchaseOrderLines.length, 2);
  assert.deepEqual(calls, ["extractOrder"]);
});

test("job coordinator rejects stale confirmation for a different selected line", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const calls = [];
  const selectedOrder = { ...jobSheetFixture.order, itemCode: "SKU-LINE-2", quantity: 200 };
  const ports = services({
    extractOrder: async () => {
      calls.push("extractOrder");
      return {
        ok: true,
        lines: [
          { lineIndex: 0, sourcePage: 1, extractedItemCode: "SKU-LINE-1", quantity: 100, status: "MATCHED", candidates: [] },
          {
            lineIndex: 1,
            sourcePage: 1,
            extractedItemCode: "SKU-LINE-2",
            resolvedItemCode: "SKU-LINE-2",
            quantity: 200,
            status: "MATCHED",
            candidates: [],
            orderProfile: selectedOrder,
          },
        ],
        orderProfile: selectedOrder,
        selectedLineIndex: 1,
        missingFields: [],
        needsClarification: false,
      };
    },
    currentConditions: async () => {
      calls.push("getConditions");
      return { ok: true, data: jobSheetFixture.conditions };
    },
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry })(
    input({ operatorItemConfirmation: { itemCode: "SKU-LINE-1", quantity: 100, lineIndex: 1 } })
  );

  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "extractOrder");
  assert.equal(result.error.issues[0].code, "extracted_line_mismatch");
  assert.deepEqual(calls, ["extractOrder"]);
});

test("job coordinator permits only an explicitly selected catalog candidate for an ambiguous line", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const selectedCode = "PKBX0242-TOPS";
  const selectedOrder = { ...jobSheetFixture.order, itemCode: selectedCode, quantity: 400 };
  let predictionRequest;
  const ports = services({
    extractOrder: async ({ selectedLineIndex, confirmedItemCode }) => ({
      ok: true,
      orderProfile: selectedOrder,
      selectedLineIndex,
      lines: [{
        lineIndex: 0,
        sourcePage: 1,
        extractedItemCode: "PKBX0242",
        resolvedItemCode: confirmedItemCode,
        quantity: 400,
        status: "AMBIGUOUS",
        candidates: ["PKBX0242-TOPS", "PKBX0242-BOTS"],
        orderProfile: selectedOrder,
      }],
      missingFields: [],
      needsClarification: true,
      lineSelectionRequired: false,
    }),
    predictRisk: async (request) => {
      predictionRequest = request;
      return { ok: true, ...jobSheetFixture.baseline.risk };
    },
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry })(
    input({
      operatorItemConfirmation: { itemCode: selectedCode, quantity: 400, lineIndex: 0 },
    })
  );

  assert.equal(result.blockedAt, "optimizeLevers");
  assert.equal(predictionRequest.order.itemCode, selectedCode);
});

test("job coordinator rejects missing operator and process inputs before starting a traced run", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const ports = services();
  const result = await createJobCoordinator({ services: ports, traceRegistry })(input({
    operatorFields: { orderId: "PO-TEST-42" },
    shift: undefined,
    levers: undefined,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.ok(result.error.issues.some((issue) => issue.field === "paperType"));
  assert.ok(result.error.issues.some((issue) => issue.field === "shift"));
  assert.ok(result.error.issues.some((issue) => issue.path[0] === "levers"));
  assert.deepEqual(ports.calls, []);
});

test("job coordinator stops downstream stages when stored conditions are unavailable", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const ports = services({
    currentConditions: async () => ({
      ok: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "No stored sensor reading." },
    }),
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry })(input());

  assert.equal(result.blockedAt, "getConditions");
  assert.deepEqual(ports.calls.map(([name]) => name), ["extractOrder"]);
  const events = traceRegistry.getEventsAfter(result.runId);
  assert.deepEqual(events.map((event) => event.type), [
    "run.started", "tool.started", "tool.succeeded", "tool.started",
    "tool.unavailable", "run.failed",
  ]);
});

test("job coordinator stops before optimization when prediction output is malformed", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  let optimizerCalls = 0;
  const ports = services({
    predictRisk: async () => ({
      ok: true,
      ratesPct: { WARP: 0, DELAM: 0, STRENGTH: 0, PRINT: 0 },
      totalScrapPct: 0,
      totalScrapKg: 0,
      scrapCost: 0,
      currency: "INR",
      primaryDefect: "WARP",
    }),
    optimizeRisk: async () => {
      optimizerCalls += 1;
      return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "not expected" } };
    },
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry })(input());

  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "predictRisk");
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.equal(optimizerCalls, 0);
  assert.deepEqual(result.completedStages, ["extractOrder", "getConditions"]);
});

test("job coordinator sanitizes unexpected service exceptions and closes the run", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const ports = services({
    currentConditions: async () => { throw new Error("private provider response detail"); },
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry })(input());

  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "getConditions");
  assert.doesNotMatch(JSON.stringify(result), /private provider response detail/);
  assert.deepEqual(traceRegistry.getEventsAfter(result.runId).map((event) => [event.type, event.errorCode]), [
    ["run.started", undefined],
    ["tool.started", undefined],
    ["tool.succeeded", undefined],
    ["tool.started", undefined],
    ["tool.failed", "TOOL_ERROR"],
    ["run.failed", undefined],
  ]);
});

test("job coordinator records cancellation without leaving an active tool or run", async () => {
  const traceRegistry = createTraceRegistry({ idFactory: traceIdFactory() });
  const controller = new AbortController();
  const ports = services({
    currentConditions: async () => {
      controller.abort();
      const error = new Error("cancelled");
      error.name = "AbortError";
      throw error;
    },
  });
  const prepareJob = createJobCoordinator({ services: ports, traceRegistry });

  await assert.rejects(prepareJob(input({ signal: controller.signal })), { name: "AbortError" });
  const events = traceRegistry.getEventsAfter("00000000-0000-4000-8000-000000000001");
  assert.deepEqual(events.map((event) => [event.type, event.errorCode]), [
    ["run.started", undefined],
    ["tool.started", undefined],
    ["tool.succeeded", undefined],
    ["tool.started", undefined],
    ["tool.failed", "CANCELLED"],
    ["run.cancelled", undefined],
  ]);
  assert.equal(traceRegistry.getRun(events[0].runId).status, "cancelled");
});
