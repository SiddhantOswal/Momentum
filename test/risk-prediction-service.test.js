import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRiskPredictionService as createRiskPredictionServiceImpl } from "../src/google-cloud/risk-prediction-service.js";
import { createConfiguredServicePorts } from "../src/service-ports.js";
import { acceptedModelSetFixture } from "./fixtures/accepted-model-set.js";

// A local acceptance fixture only; it is not evidence about deployed models.
function createRiskPredictionService(options = {}) {
  return createRiskPredictionServiceImpl({ modelAcceptance: acceptedModelSetFixture, ...options });
}

const fields = [
  ["item_code", "STRING"], ["rate_warp_pct", "FLOAT"], ["rate_delam_pct", "FLOAT"],
  ["rate_strength_pct", "FLOAT"], ["rate_print_pct", "FLOAT"], ["rate_crack_pct", "FLOAT"],
  ["total_scrap_pct", "FLOAT"], ["total_scrap_kg", "FLOAT"], ["scrap_cost", "FLOAT"],
  ["currency", "STRING"], ["primary_defect", "STRING"],
].map(([name, type]) => ({ name, type }));

function resultRow() {
  return {
    schema: { fields },
    rows: [{ f: [
      { v: "PKBX0041" }, { v: "3.423" }, { v: "2.98" }, { v: "1.167" }, { v: "1.828" },
      { v: "0.778" }, { v: "10.18" }, { v: "100.4" }, { v: "5351" }, { v: "INR" }, { v: "WARP" },
    ] }],
  };
}

// PKBX0041 acceptance input from the supplied SQL handoff.
const input = {
  order: {
    orderId: "PO-1", itemCode: "PKBX0041", customerId: "C-1", boxStyle: "RSC",
    lengthMm: 400, widthMm: 300, heightMm: 250, ply: 5, fluteProfile: "BC",
    topLinerGsm: 180, fluteGsm: 150, innerLinerGsm: 180, linerBf: 24,
    paperType: "RECYCLED", paperSupplier: "SUP-D", inkColors: 2, inkCoveragePct: 15, quantity: 1300,
  },
  conditions: { runDate: "2026-10-12", shift: "DAY", ambientRhPct: 86, ambientTempC: 26, paperMoisturePct: 10.8 },
  levers: { sfSpeedMpm: 48, rollTempC: 162, gumApplication: "HIGH", gumViscositySec: 32, pastingPressure: "MED", dryingHours: 5, printSpeedSpm: 60 },
};

test("risk prediction runs the supplied model SQL with exact named parameters and maps its row", async () => {
  let request;
  const service = createRiskPredictionService({
    bigquery: { query: async (value) => { request = value; return resultRow(); } },
  });
  const response = await service(input);

  assert.equal(request.sql, readFileSync(new URL("../sql/predict.sql", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(request.parameters), [
    "item_code", "quantity", "paper_type", "paper_supplier", "shift", "ambient_rh_pct",
    "ambient_temp_c", "paper_moisture_pct", "sf_speed_mpm", "roll_temp_c", "gum_application",
    "gum_viscosity_sec", "pasting_pressure", "drying_hours", "print_speed_spm",
  ]);
  assert.equal(response.ok, true);
  assert.equal(response.source, "bigquery-ml");
  assert.equal(response.isRealModelPrediction, true);
  assert.equal(response.modelAcceptance.status, "accepted");
  assert.equal(response.modelAcceptance.prototypeThresholdsMet, true);
  assert.equal(response.modelAcceptance.completeAcceptanceEvidenceAvailable, true);
  assert.deepEqual(response.modelAcceptance.requiredR2, {
    WARP: 0.6, DELAM: 0.6, STRENGTH: 0.45, PRINT: 0.6, CRACK: 0.3,
  });
  assert.equal(response.modelProvenance.outputs.length, 5);
  assert.equal(response.modelProvenance.currentModelVersionsLinked, true);
  assert.deepEqual(response.modelProvenance.outputs.map(({ defect }) => defect), [
    "WARP", "DELAM", "STRENGTH", "PRINT", "CRACK",
  ]);
  assert.equal(response.itemCode, "PKBX0041");
  assert.equal(response.ratesPct.WARP, 3.423);
  assert.equal(response.ratesPct.DELAM, 2.98);
  assert.equal(response.ratesPct.STRENGTH, 1.167);
  assert.equal(response.ratesPct.PRINT, 1.828);
  assert.equal(response.ratesPct.CRACK, 0.778);
  assert.equal(response.totalScrapPct, 10.18);
  assert.equal(response.totalScrapKg, 100.4);
  assert.equal(response.scrapCost, 5351);
  assert.equal(response.currency, "INR");
  assert.equal(response.primaryDefect, "WARP");
});

test("risk prediction fails closed before querying when only historical thresholds are met", async () => {
  let queryCalled = false;
  const service = createRiskPredictionServiceImpl({
    modelAcceptance: (await import("../config/model-acceptance.json", { with: { type: "json" } })).default,
    bigquery: { query: async () => { queryCalled = true; return resultRow(); } },
  });
  const response = await service(input);
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "SERVICE_UNAVAILABLE");
  assert.equal(response.modelAcceptance.status, "prototype-thresholds-met");
  assert.equal(response.modelAcceptance.completeAcceptanceEvidenceAvailable, false);
  assert.equal(queryCalled, false);
});

test("PKBX0041 fixture matches the supplied SQL's live prediction result", async () => {
  const service = createRiskPredictionService({
    bigquery: { query: async () => resultRow() },
  });
  const response = await service(input);

  assert.equal(response.ok, true);
  assert.equal(response.itemCode, "PKBX0041");

  assert.equal(response.totalScrapPct, 10.18);
  assert.equal(response.totalScrapKg, 100.4);
  assert.equal(response.scrapCost, 5351);
  assert.equal(response.primaryDefect, "WARP");
  assert.equal(response.currency, "INR");
});

test("PKBX0041 acceptance: all 15 parameters bound with correct names and types", async () => {
  let captured;
  const service = createRiskPredictionService({
    bigquery: { query: async (req) => { captured = req; return resultRow(); } },
  });
  await service(input);

  // All 15 required parameter names
  const keys = Object.keys(captured.parameters);
  assert.equal(keys.length, 15);
  assert.equal(captured.parameters.item_code, "PKBX0041");
  assert.equal(captured.parameters.shift, "DAY");
  assert.equal(captured.parameters.paper_type, "RECYCLED");
  assert.equal(captured.parameters.paper_supplier, "SUP-D");
  // Numeric levers use explicit types
  assert.equal(captured.parameters.sf_speed_mpm.type, "FLOAT64");
  assert.equal(captured.parameters.sf_speed_mpm.value, 48);
  assert.equal(captured.parameters.roll_temp_c.type, "FLOAT64");
  assert.equal(captured.parameters.roll_temp_c.value, 162);
  assert.equal(captured.parameters.gum_application, "HIGH");
  assert.equal(captured.parameters.gum_viscosity_sec.type, "FLOAT64");
  assert.equal(captured.parameters.gum_viscosity_sec.value, 32);
  assert.equal(captured.parameters.pasting_pressure, "MED");
  assert.equal(captured.parameters.drying_hours.type, "FLOAT64");
  assert.equal(captured.parameters.drying_hours.value, 5);
  assert.equal(captured.parameters.print_speed_spm.type, "FLOAT64");
  assert.equal(captured.parameters.print_speed_spm.value, 60);
});

test("risk prediction reports missing plant/model output without inventing a result", async () => {
  const service = createRiskPredictionService({ bigquery: { query: async () => ({ schema: { fields }, rows: [] }) } });
  assert.deepEqual(await service(input), {
    ok: false,
    error: { code: "NOT_FOUND", message: "No prediction was returned for this item and plant." },
  });
});

test("risk prediction returns SERVICE_UNAVAILABLE on query failure", async () => {
  const service = createRiskPredictionService({
    bigquery: { query: async () => { throw new Error("Network failure"); } },
  });
  const result = await service(input);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
});

test("risk prediction rethrows AbortError", async () => {
  const abortError = new DOMException("Aborted", "AbortError");
  const service = createRiskPredictionService({
    bigquery: { query: async () => { throw abortError; } },
  });
  await assert.rejects(() => service(input), { name: "AbortError" });
});

test("risk prediction rejects schema mismatch in query result", async () => {
  const wrongFields = [{ name: "wrong_field", type: "STRING" }];
  const service = createRiskPredictionService({
    bigquery: { query: async () => ({ schema: { fields: wrongFields }, rows: [] }) },
  });
  const result = await service(input);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
});

test("risk prediction rejects incompatible output types, duplicate rows, and another item code", async () => {
  const wrongType = resultRow();
  wrongType.schema.fields = fields.map((field, index) =>
    index === 1 ? { ...field, type: "STRING" } : field
  );
  const wrongTypeService = createRiskPredictionService({
    bigquery: { query: async () => wrongType },
  });
  assert.equal((await wrongTypeService(input)).error.code, "SERVICE_UNAVAILABLE");

  const duplicateRows = resultRow();
  duplicateRows.rows.push(duplicateRows.rows[0]);
  const duplicateService = createRiskPredictionService({
    bigquery: { query: async () => duplicateRows },
  });
  assert.equal((await duplicateService(input)).error.code, "SERVICE_UNAVAILABLE");

  const otherItem = resultRow();
  otherItem.rows[0].f[0].v = "PKBX0089";
  const otherItemService = createRiskPredictionService({
    bigquery: { query: async () => otherItem },
  });
  assert.equal((await otherItemService(input)).error.code, "SERVICE_UNAVAILABLE");
});

test("risk prediction rejects inconsistent totals and invalid defect probabilities", async () => {
  const inconsistentTotal = resultRow();
  inconsistentTotal.rows[0].f[6].v = "11";
  const totalService = createRiskPredictionService({
    bigquery: { query: async () => inconsistentTotal },
  });
  assert.equal((await totalService(input)).error.code, "SERVICE_UNAVAILABLE");

  const invalidProbability = resultRow();
  invalidProbability.rows[0].f[1].v = "26";
  const probabilityService = createRiskPredictionService({
    bigquery: { query: async () => invalidProbability },
  });
  assert.equal((await probabilityService(input)).error.code, "SERVICE_UNAVAILABLE");

  const missingRate = resultRow();
  missingRate.rows[0].f[1].v = null;
  const missingRateService = createRiskPredictionService({
    bigquery: { query: async () => missingRate },
  });
  assert.equal((await missingRateService(input)).error.code, "SERVICE_UNAVAILABLE");

  const wrongPrimary = resultRow();
  wrongPrimary.rows[0].f[10].v = "DELAM";
  const wrongPrimaryService = createRiskPredictionService({
    bigquery: { query: async () => wrongPrimary },
  });
  assert.equal((await wrongPrimaryService(input)).error.code, "SERVICE_UNAVAILABLE");
});

test("risk prediction stays disabled unless explicitly enabled at runtime", () => {
  const ports = createConfiguredServicePorts({
    env: { GOOGLE_CLOUD_PROJECT: "prepagent-hack" },
    modelConfig: { projectId: "prepagent-hack", location: "asia-south1", modelCallsEnabled: false },
    bucketConfig: {},
    tokenProvider: async () => "test-token",
  });
  assert.equal(ports.availability.predictRisk, false);
});

test("live optimizer stays unconfigured until an owner-approved contract ID and version are explicit", () => {
  const shared = {
    PROJECT_ID: "prepagent-hack",
    REGION: "asia-south1",
    USTAAD_ENABLE_RISK_PREDICTION: "true",
  };
  const options = {
    modelConfig: { modelCallsEnabled: false },
    bucketConfig: {},
    tokenProvider: async () => "test-token",
    fetchImpl: async () => { throw new Error("No service request is expected."); },
  };
  const pending = createConfiguredServicePorts({ env: shared, ...options });
  assert.equal(pending.availability.predictRisk, true);
  assert.equal(pending.availability.optimizeRisk, false);

  const approved = createConfiguredServicePorts({
    env: {
      ...shared,
      USTAAD_OPTIMIZER_CONTRACT_STATUS: "approved",
      USTAAD_OPTIMIZER_CONTRACT_VERSION: "om-decision-v1",
    },
    ...options,
  });
  assert.equal(approved.availability.optimizeRisk, true);
});

test("Cloud Run deployment variables construct risk adapter with its isolated byte ceiling", async () => {
  let request;
  const ports = createConfiguredServicePorts({
    env: {
      PROJECT_ID: "prepagent-hack",
      REGION: "asia-south1",
      BUCKET: "prepagent-hack-data",
      VERTEX_LOCATION: "asia-south1",
      GEMINI_MODEL: "gemini-3.5-flash",
      USTAAD_ENABLE_LIVE_MODEL_CALLS: "true",
      USTAAD_ENABLE_RISK_PREDICTION: "true",
    },
    modelConfig: { modelCallsEnabled: true },
    bucketConfig: {},
    modelAcceptance: acceptedModelSetFixture,
    tokenProvider: async () => "unused-test-token",
    fetchImpl: async (_url, init) => {
      request = JSON.parse(init.body);
      return new Response(JSON.stringify({
        jobComplete: true,
        jobReference: { jobId: "unit-test-job", location: "asia-south1" },
        schema: { fields },
        rows: resultRow().rows,
        totalRows: "1",
        totalBytesProcessed: "73400320",
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(ports.availability.extractOrder, true);
  assert.equal(ports.availability.predictRisk, true);
  assert.equal(ports.availability.optimizeRisk, false,
    "prediction opt-in alone must not activate the unresolved optimizer contract");
  const response = await ports.predictRisk(input);
  assert.equal(response.ok, true);
  assert.equal(request.maximumBytesBilled, String(80 * 1024 * 1024));
});

test("risk prediction runs the supplied model SQL with exact named parameters and maps its row", async () => {
  let request;
  const service = createRiskPredictionService({
    bigquery: { query: async (value) => { request = value; return resultRow(); } },
  });
  const response = await service(input);

  assert.equal(request.sql, readFileSync(new URL("../sql/predict.sql", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(request.parameters), [
    "item_code", "quantity", "paper_type", "paper_supplier", "shift", "ambient_rh_pct",
    "ambient_temp_c", "paper_moisture_pct", "sf_speed_mpm", "roll_temp_c", "gum_application",
    "gum_viscosity_sec", "pasting_pressure", "drying_hours", "print_speed_spm",
  ]);
  assert.equal(response.ok, true);
  assert.equal(response.source, "bigquery-ml");
  assert.equal(response.isRealModelPrediction, true);
  assert.equal(response.itemCode, "PKBX0041");
  assert.equal(response.ratesPct.WARP, 3.423);
  assert.equal(response.totalScrapPct, 10.18);
  assert.equal(response.totalScrapKg, 100.4);
  assert.equal(response.scrapCost, 5351);
  assert.equal(response.currency, "INR");
  assert.equal(response.primaryDefect, "WARP");
});

test("risk prediction reports missing plant/model output without inventing a result", async () => {
  const service = createRiskPredictionService({ bigquery: { query: async () => ({ schema: { fields }, rows: [] }) } });
  assert.deepEqual(await service(input), {
    ok: false,
    error: { code: "NOT_FOUND", message: "No prediction was returned for this item and plant." },
  });
});

test("risk prediction stays disabled unless explicitly enabled at runtime", () => {
  const ports = createConfiguredServicePorts({
    env: { GOOGLE_CLOUD_PROJECT: "prepagent-hack" },
    modelConfig: { projectId: "prepagent-hack", location: "asia-south1", modelCallsEnabled: false },
    bucketConfig: {},
    tokenProvider: async () => "test-token",
  });
  assert.equal(ports.availability.predictRisk, false);
});

test("Cloud Run deployment variables construct risk adapter with its isolated byte ceiling", async () => {
  let request;
  const ports = createConfiguredServicePorts({
    env: {
      PROJECT_ID: "prepagent-hack",
      REGION: "asia-south1",
      BUCKET: "prepagent-hack-data",
      VERTEX_LOCATION: "asia-south1",
      GEMINI_MODEL: "gemini-3.5-flash",
      USTAAD_ENABLE_LIVE_MODEL_CALLS: "true",
      USTAAD_ENABLE_RISK_PREDICTION: "true",
    },
    modelConfig: { modelCallsEnabled: true },
    bucketConfig: {},
    tokenProvider: async () => "unused-test-token",
    fetchImpl: async (_url, init) => {
      request = JSON.parse(init.body);
      return new Response(JSON.stringify({
        jobComplete: true,
        jobReference: { jobId: "unit-test-job", location: "asia-south1" },
        schema: { fields },
        rows: resultRow().rows,
        totalRows: "1",
        totalBytesProcessed: "73400320",
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(ports.availability.extractOrder, true);
  assert.equal(ports.availability.predictRisk, true);
  const response = await ports.predictRisk(input);
  assert.equal(response.ok, true);
  assert.equal(request.maximumBytesBilled, String(80 * 1024 * 1024));
});
