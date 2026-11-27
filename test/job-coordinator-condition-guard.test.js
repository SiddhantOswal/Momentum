import assert from "node:assert/strict";
import test from "node:test";
import { jobSheetFixture } from "./fixtures/job-sheet.js";
import { createTraceRegistry } from "../src/trace-registry.js";
import { createJobCoordinator } from "../src/job-coordinator.js";
import { createConditionGuard, seasonalValue } from "../src/condition-guard.js";

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
    shift: "DAY",
    levers: jobSheetFixture.baseline.levers,
    conditionsConfirmed: true,
    ...overrides,
  };
}

const manual = { runDate: "2026-07-14", shift: "DAY", ambientRhPct: 86, ambientTempC: 26, paperMoisturePct: 10.8 };

function services(overrides = {}) {
  const calls = [];
  return {
    calls,
    extractOrder: async (request) => {
      calls.push(["extractOrder", request]);
      return { ok: true, orderProfile: jobSheetFixture.order, missingFields: [], needsClarification: false };
    },
    currentConditions: async () => { throw new Error("manual conditions bypass the sensor lookup"); },
    predictRisk: async (request) => {
      calls.push(["predictRisk", request]);
      return { ok: true, ...jobSheetFixture.baseline.risk };
    },
    optimizeRisk: async (request) => {
      calls.push(["optimizeRisk", request]);
      return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Optimizer is not configured." } };
    },
    ...overrides,
  };
}

test("coordinator reports plant condition sources and normal confidence for in-range readings", async () => {
  const ports = services();
  const result = await createJobCoordinator({ services: ports, traceRegistry: createTraceRegistry({ idFactory: traceIdFactory() }) })(
    input({ manualConditions: manual }),
  );
  assert.equal(result.blockedAt, "optimizeLevers");
  assert.deepEqual(result.conditionSources, { ambientRhPct: "plant", ambientTempC: "plant", paperMoisturePct: "plant" });
  assert.equal(result.confidence, "normal");
  assert.equal(result.conditionNotes, undefined);
  const prediction = ports.calls.find(([name]) => name === "predictRisk")[1];
  assert.deepEqual(prediction.conditions, { shift: "DAY", ambientRhPct: 86, ambientTempC: 26, paperMoisturePct: 10.8 });
});

test("a failed humidity reading is replaced before prediction instead of skewing all five models", async () => {
  const ports = services();
  let weatherCalls = 0;
  const conditionGuard = createConditionGuard({
    weatherProvider: async () => { weatherCalls += 1; return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "off" } }; },
  });
  const result = await createJobCoordinator({
    services: ports,
    traceRegistry: createTraceRegistry({ idFactory: traceIdFactory() }),
    conditionGuard,
  })(input({ manualConditions: { ...manual, ambientRhPct: undefined } }));

  assert.equal(weatherCalls, 1);
  const prediction = ports.calls.find(([name]) => name === "predictRisk")[1];
  assert.equal(prediction.conditions.ambientRhPct, seasonalValue("ambientRhPct", 7));
  assert.equal(prediction.conditions.ambientTempC, 26);
  assert.equal(prediction.conditions.paperMoisturePct, 10.8);
  assert.equal(result.conditions.ambientRhPct, seasonalValue("ambientRhPct", 7));
  assert.deepEqual(result.conditionSources, { ambientRhPct: "seasonal", ambientTempC: "plant", paperMoisturePct: "plant" });
  assert.equal(result.confidence, "reduced");
  assert.match(result.conditionNotes[0], /Humidity reading is missing; used the typical July value/);
});

test("a sensor humidity value outside the recorded range uses the weather reading", async () => {
  const ports = services({
    currentConditions: async () => ({
      ok: true,
      data: { ...manual, ambientRhPct: 99.9 },
      provenance: {
        readingId: "READ-TEST-001",
        timestamp: "2026-07-14T05:59:00.000Z",
        plantId: "PLANT-01",
        source: "simulated",
        recordedSource: "pubsub-bq-subscription",
        retrievedAt: "2026-07-14T06:00:00.000Z",
        ageSeconds: 60,
        freshness: "fresh",
      },
    }),
  });
  const result = await createJobCoordinator({
    services: ports,
    traceRegistry: createTraceRegistry({ idFactory: traceIdFactory() }),
    conditionGuard: createConditionGuard({ weatherProvider: async () => ({ ok: true, ambientRhPct: 81, ambientTempC: 29 }) }),
  })(input());
  const prediction = ports.calls.find(([name]) => name === "predictRisk")[1];
  assert.equal(prediction.conditions.ambientRhPct, 81);
  assert.equal(result.conditionSources.ambientRhPct, "weather");
  assert.equal(result.confidence, "reduced");
});

test("missing paper moisture is rejected before extraction with a plain message", async () => {
  const ports = services();
  const result = await createJobCoordinator({ services: ports, traceRegistry: createTraceRegistry({ idFactory: traceIdFactory() }) })(
    input({ manualConditions: { ...manual, paperMoisturePct: undefined } }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.equal(result.error.issues[0].field, "conditions.paperMoisturePct");
  assert.match(result.error.issues[0].message, /Paper moisture is missing\. Measure the paper reel/);
  assert.equal(ports.calls.length, 0);
});

test("out-of-range paper moisture stops at getConditions with a VALIDATION_ERROR and no prediction", async () => {
  const ports = services();
  const result = await createJobCoordinator({ services: ports, traceRegistry: createTraceRegistry({ idFactory: traceIdFactory() }) })(
    input({ manualConditions: { ...manual, paperMoisturePct: 18 } }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.equal(result.blockedAt, "getConditions");
  assert.match(result.error.message, /Paper moisture reading 18% is outside the plant's recorded range/);
  assert.equal(ports.calls.some(([name]) => name === "predictRisk"), false);
});

test("a partial prediction is shown but stops job preparation with a plain message", async () => {
  const { CRACK: _crack, ...fourRates } = jobSheetFixture.baseline.risk.ratesPct;
  const ports = services({
    predictRisk: async () => ({
      ok: true,
      ...jobSheetFixture.baseline.risk,
      ratesPct: fourRates,
      partial: true,
      unavailableDefects: ["CRACK"],
      totalsCover: Object.keys(fourRates),
    }),
  });
  const result = await createJobCoordinator({ services: ports, traceRegistry: createTraceRegistry({ idFactory: traceIdFactory() }) })(
    input({ manualConditions: manual }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  assert.equal(result.blockedAt, "predictRisk");
  assert.match(result.error.message, /The CRACK defect model is unavailable right now/);
  assert.deepEqual(result.partialPrediction.unavailableDefects, ["CRACK"]);
  assert.deepEqual(result.partialPrediction.ratesPct, fourRates);
  assert.equal(result.confidence, "normal");
  assert.equal(ports.calls.some(([name]) => name === "optimizeRisk"), false);
});

test("a completed job sheet records reduced confidence and the humidity band when a fallback was used", async () => {
  const humidityBand = {
    ambientRhPct: { low: 81, high: 91 },
    ratesPct: Object.fromEntries(Object.entries(jobSheetFixture.baseline.risk.ratesPct)
      .map(([defect, rate]) => [defect, { low: rate, high: rate }])),
  };
  const ports = services({
    currentConditions: async () => ({
      ok: true,
      data: { ...jobSheetFixture.conditions, ambientTempC: 60 },
      provenance: {
        readingId: "READ-TEST-002",
        timestamp: "2026-10-11T11:59:00.000Z",
        plantId: "PLANT-01",
        source: "simulated",
        recordedSource: "pubsub-bq-subscription",
        retrievedAt: "2026-10-11T12:00:00.000Z",
        ageSeconds: 60,
        freshness: "fresh",
      },
    }),
    predictRisk: async () => ({ ok: true, ...jobSheetFixture.baseline.risk, humidityBand }),
    optimizeRisk: async () => ({
      ok: true,
      baseline: jobSheetFixture.baseline,
      best: jobSheetFixture.recommended,
      changes: [],
      savings: jobSheetFixture.savings,
    }),
    findSimilarRuns: async () => ({ ok: true, evidence: [] }),
    explainRisk: async () => ({ ok: true, explanation: "Test-only explanation." }),
  });
  const result = await createJobCoordinator({
    services: ports,
    traceRegistry: createTraceRegistry({ idFactory: traceIdFactory() }),
    plantId: "PLANT-01",
  })(input({ shift: jobSheetFixture.conditions.shift }));

  assert.equal(result.ok, true);
  assert.equal(result.conditionSources.ambientTempC, "seasonal");
  assert.equal(result.confidence, "reduced");
  assert.deepEqual(result.humidityBand, humidityBand);
  assert.match(result.jobSheet.explanation, /^Reduced confidence: Temperature reading 60 °C is outside the plant's recorded range .*; used the typical October value of [\d.]+ °C\. Savings are/);
});
