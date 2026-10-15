import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createRiskOptimizationService as createRiskOptimizationServiceImpl,
  decodeOptimizationResult,
  RiskOptimizationError,
} from "../src/google-cloud/risk-optimization-service.js";
import { acceptedModelSetFixture } from "./fixtures/accepted-model-set.js";

// Isolated model-evidence test double only; never use for a cloud acceptance claim.
function createRiskOptimizationService(options = {}) {
  return createRiskOptimizationServiceImpl({ modelAcceptance: acceptedModelSetFixture, ...options });
}

// 23 columns as per optimize.sql schema
const COLUMNS = [
  "kind", "n_changes",
  "sf_speed_mpm", "roll_temp_c", "gum_application", "gum_viscosity_sec",
  "pasting_pressure", "drying_hours", "print_speed_spm",
  "rate_warp_pct", "rate_delam_pct", "rate_strength_pct", "rate_print_pct", "rate_crack_pct",
  "total_scrap_pct", "scrap_kg", "scrap_cost",
  "penalty", "total_cost", "currency", "primary_defect",
  "savings_kg", "savings_cost",
];

const STRING_COLUMNS = new Set([
  "kind", "gum_application", "pasting_pressure", "currency", "primary_defect",
]);
const fields = COLUMNS.map((name) => ({
  name,
  type: STRING_COLUMNS.has(name) ? "STRING" : name === "n_changes" ? "INTEGER" : "FLOAT",
}));

function makeRow(values) {
  return { f: values.map((v) => ({ v: v === null ? null : String(v) })) };
}

// PKBX0041 BASELINE from the supplied SQL's live output.
const BASELINE_VALUES = [
  "BASELINE", 0,
  48, 162, "HIGH", 32, "MED", 5, 60,
  3.423, 2.98, 1.167, 1.828, 0.778,
  10.18, 100.4, 5351,
  0, 5351, "INR", "WARP",
  0, 0,
];

// BEST from the supplied SQL: roll 170, gum MED, viscosity 35.
const BEST_VALUES = [
  "BEST", 3,
  48, 170, "MED", 35, "MED", 5, 60,
  2.419, 2.376, 1.245, 1.721, 0.657,
  8.42, 83, 4426,
  0, 4426, "INR", "WARP",
  17.4, 925,
];

function twoRowResult() {
  return {
    schema: { fields },
    rows: [makeRow(BASELINE_VALUES), makeRow(BEST_VALUES)],
  };
}

const input = {
  order: {
    itemCode: "PKBX0041",
    quantity: 1300,
    paperType: "RECYCLED",
    paperSupplier: "SUP-D",
    orderId: "PO-ACCEPT-001",
    customerId: "C-1",
    boxStyle: "RSC",
    lengthMm: 400, widthMm: 300, heightMm: 250, ply: 5, fluteProfile: "BC",
    topLinerGsm: 180, fluteGsm: 150, innerLinerGsm: 180, linerBf: 24,
    inkColors: 2, inkCoveragePct: 15,
  },
  conditions: {
    runDate: "2026-10-12",
    shift: "DAY",
    ambientRhPct: 86,
    ambientTempC: 26,
    paperMoisturePct: 10.8,
  },
  conditionsConfirmed: true,
  levers: {
    sfSpeedMpm: 48,
    rollTempC: 162,
    gumApplication: "HIGH",
    gumViscositySec: 32,
    pastingPressure: "MED",
    dryingHours: 5,
    printSpeedSpm: 60,
  },
};

test("optimization service requires a bigquery client", () => {
  assert.throws(
    () => createRiskOptimizationService({ projectId: "prepagent-hack" }),
    { name: "TypeError" }
  );
});

test("optimization service requires a valid project ID", () => {
  assert.throws(
    () => createRiskOptimizationService({
      bigquery: { query: async () => {} },
      projectId: "bad id!",
    }),
    { name: "TypeError" }
  );
});

test("optimization service requires verified optimizer SQL containing ML.PREDICT", () => {
  assert.throws(
    () => createRiskOptimizationService({
      bigquery: { query: async () => {} },
      sql: "SELECT 1",
    }),
    { name: "TypeError" }
  );
});

test("optimization fails closed before BigQuery when model acceptance evidence is absent", async () => {
  let queryCalled = false;
  const service = createRiskOptimizationServiceImpl({
    bigquery: { query: async () => { queryCalled = true; return twoRowResult(); } },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  const response = await service(input);
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "SERVICE_UNAVAILABLE");
  assert.equal(response.modelAcceptance.status, "prototype-thresholds-met");
  assert.equal(queryCalled, false);
});

test("optimization service sends all 15 named parameters in correct order", async () => {
  let capturedRequest;
  const service = createRiskOptimizationService({
    bigquery: {
      query: async (req) => {
        capturedRequest = req;
        return twoRowResult();
      },
    },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });

  await service(input);

  const paramKeys = Object.keys(capturedRequest.parameters);
  assert.deepEqual(paramKeys, [
    "item_code", "quantity", "paper_type", "paper_supplier", "shift",
    "ambient_rh_pct", "ambient_temp_c", "paper_moisture_pct",
    "sf_speed_mpm", "roll_temp_c", "gum_application", "gum_viscosity_sec",
    "pasting_pressure", "drying_hours", "print_speed_spm",
  ]);
  assert.equal(capturedRequest.parameters.item_code, "PKBX0041");
  assert.equal(capturedRequest.parameters.quantity.type, "INT64");
  assert.equal(capturedRequest.parameters.quantity.value, 1300);
  assert.equal(capturedRequest.parameters.sf_speed_mpm.type, "FLOAT64");
  assert.equal(capturedRequest.parameters.gum_application, "HIGH");
  assert.equal(capturedRequest.parameters.pasting_pressure, "MED");
});

test("blank planned levers use and label Om's approved plant-standard values", async () => {
  const baseline = [...BASELINE_VALUES];
  baseline[2] = 42;
  baseline[3] = 168;
  baseline[4] = "MED";
  baseline[5] = 40;
  baseline[6] = "MED";
  baseline[7] = 6;
  baseline[8] = 55;
  const best = [...baseline];
  best[0] = "BEST";
  let captured;
  const service = createRiskOptimizationService({
    bigquery: { query: async (request) => {
      captured = request;
      return { schema: { fields }, rows: [makeRow(baseline), makeRow(best)] };
    } },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  const result = await service({ ...input, levers: {} });
  assert.equal(result.ok, true, result.error?.message);
  assert.deepEqual(result.plantStandardLeversUsed, [
    "sfSpeedMpm", "rollTempC", "gumApplication", "gumViscositySec",
    "pastingPressure", "dryingHours", "printSpeedSpm",
  ]);
  assert.equal(result.planBaselineLabel, "plant standard for blank levers");
  assert.equal(captured.parameters.sf_speed_mpm.value, 42);
  assert.equal(captured.parameters.roll_temp_c.value, 168);
  assert.equal(captured.parameters.gum_application, "MED");
});

test("optimization service returns BASELINE and BEST with changes list", async () => {
  const service = createRiskOptimizationService({
    bigquery: { query: async () => twoRowResult() },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });

  const result = await service(input);

  assert.equal(result.ok, true);
  assert.equal(result.agent, "optimizeLevers");
  assert.equal(result.source, "bigquery-ml");
  assert.equal(result.isRealModelPrediction, true);

  // Baseline matches the supplied SQL's live result.
  assert.equal(result.baseline.risk.totalScrapPct, 10.18);
  assert.equal(result.baseline.risk.scrapCost, 5351);
  assert.equal(result.baseline.levers.gumApplication, "HIGH");
  assert.equal(result.baseline.levers.dryingHours, 5);

  // Best row
  assert.equal(result.best.risk.scrapCost, 4426);
  assert.equal(result.best.levers.gumApplication, "MED");
  assert.equal(result.best.levers.rollTempC, 170);
  assert.equal(result.best.levers.gumViscositySec, 35);
  assert.equal(result.best.levers.dryingHours, 5);

  // Changes: roll temperature, gum application and viscosity.
  assert.equal(result.changes.length, 3);
  const changedLevers = result.changes.map((c) => c.lever).sort();
  assert.deepEqual(changedLevers, ["gumApplication", "gumViscositySec", "rollTempC"]);
  assert.ok(result.changes.every((change) =>
    change.reason.includes("not a causal effect estimate") &&
    !/\b(?:causes?|reduces?|increases?)\b/i.test(change.reason)));

  // Savings from BEST row
  assert.equal(result.savings.kg, 17.4);
  assert.equal(result.savings.inr, 925);
  assert.equal(result.savings.percent, (925 / 5351) * 100);
  assert.match(result.note, /Predicted savings compare this recommendation with the supervisor's plan/);
});

test("optimization requires the baseline to preserve planned settings and BEST to use the documented grid", async () => {
  const changedBaseline = twoRowResult();
  changedBaseline.rows[0].f[3].v = "160";
  const baselineService = createRiskOptimizationService({
    bigquery: { query: async () => changedBaseline },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  assert.equal((await baselineService(input)).ok, false);

  const offGridResult = twoRowResult();
  offGridResult.rows[1].f[3].v = "169";
  const gridService = createRiskOptimizationService({
    bigquery: { query: async () => offGridResult },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  assert.equal((await gridService(input)).ok, false);
});

test("optimization rejects a penalty that does not match the documented slowing-down formula", () => {
  const inconsistentPenalty = twoRowResult();
  inconsistentPenalty.rows[1].f[17].v = "1";
  inconsistentPenalty.rows[1].f[18].v = "4427";
  inconsistentPenalty.rows[1].f[22].v = "924";
  assert.throws(
    () => decodeOptimizationResult(inconsistentPenalty, { plannedLevers: input.levers }),
    { code: "OPT_PENALTY_MISMATCH" },
  );
});

test("optimization validates complete production inputs before querying", async () => {
  let queryCount = 0;
  const service = createRiskOptimizationService({
    bigquery: { query: async () => { queryCount += 1; return twoRowResult(); } },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  const result = await service({ ...input, levers: { ...input.levers, rollTempC: 190 } });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.equal(queryCount, 0);
});

test("optimization identifies BASELINE and BEST by kind, not unspecified row order", () => {
  const result = decodeOptimizationResult({
    schema: { fields },
    rows: [makeRow(BEST_VALUES), makeRow(BASELINE_VALUES)],
  });
  assert.equal(result.baseline.risk.scrapCost, 5351);
  assert.equal(result.best.risk.scrapCost, 4426);
  assert.equal(result.savings.inr, 925);
});

test("optimization accepts a valid BEST result with zero changes", () => {
  const unchangedBest = [...BASELINE_VALUES];
  unchangedBest[0] = "BEST";
  unchangedBest[21] = 0;
  unchangedBest[22] = 0;
  const result = decodeOptimizationResult({
    schema: { fields },
    rows: [makeRow(BASELINE_VALUES), makeRow(unchangedBest)],
  });
  assert.deepEqual(result.changes, []);
  assert.equal(result.savings.kg, 0);
  assert.equal(result.savings.inr, 0);
  assert.equal(result.savings.percent, 0);
  assert.equal(result.note, "Your plan is already the best option we found");
});

test("PKBX0041 baseline matches supplied SQL prediction and the optimizer's baseline", async () => {
  const service = createRiskOptimizationService({
    bigquery: { query: async () => twoRowResult() },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  const result = await service(input);
  assert.equal(result.ok, true);
  assert.equal(result.baseline.risk.scrapCost, 5351);
  assert.equal(result.baseline.risk.totalScrapPct, 10.18);
});

test("optimization rejects output with an incorrect BigQuery type", async () => {
  const incorrectFields = fields.map((field, index) =>
    index === 1 ? { ...field, type: "STRING" } : field
  );
  const service = createRiskOptimizationService({
    bigquery: {
      query: async () => ({
        schema: { fields: incorrectFields },
        rows: [makeRow(BASELINE_VALUES), makeRow(BEST_VALUES)],
      }),
    },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  const result = await service(input);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
});

test("optimization service rejects query returning wrong row count", async () => {
  const service = createRiskOptimizationService({
    bigquery: {
      query: async () => ({
        schema: { fields },
        rows: [makeRow(BASELINE_VALUES)],
      }),
    },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  const result = await service(input);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  assert.ok(result.error.message.includes("2 rows"));
});

test("optimization service rejects duplicate BASELINE rows", async () => {
  const service = createRiskOptimizationService({
    bigquery: {
      query: async () => ({
        schema: { fields },
        rows: [makeRow(BASELINE_VALUES), makeRow(BASELINE_VALUES)],
      }),
    },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  const result = await service(input);
  assert.equal(result.ok, false);
  assert.ok(result.error.message.includes("BEST"));
});

test("optimization service rejects BEST with n_changes > 3", async () => {
  const tooManyChanges = [...BEST_VALUES];
  tooManyChanges[1] = 4; // n_changes = 4
  const service = createRiskOptimizationService({
    bigquery: {
      query: async () => ({
        schema: { fields },
        rows: [makeRow(BASELINE_VALUES), makeRow(tooManyChanges)],
      }),
    },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  const result = await service(input);
  assert.equal(result.ok, false);
  assert.ok(result.error.message.includes("n_changes") || result.error.message.includes("4"));
});

test("optimization service rejects savings that do not reconcile with optimizer row deltas", async () => {
  const invalidBest = [...BEST_VALUES];
  invalidBest[22] = 900;
  const service = createRiskOptimizationService({
    bigquery: {
      query: async () => ({
        schema: { fields },
        rows: [makeRow(BASELINE_VALUES), makeRow(invalidBest)],
      }),
    },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  const result = await service(input);
  assert.equal(result.ok, false);
  assert.match(result.error.message, /savings/i);
});

test("optimization service rejects currencies that its INR savings contract cannot represent", async () => {
  const unsupportedBest = [...BEST_VALUES];
  unsupportedBest[19] = "USD";
  const service = createRiskOptimizationService({
    bigquery: {
      query: async () => ({
        schema: { fields },
        rows: [makeRow(BASELINE_VALUES), makeRow(unsupportedBest)],
      }),
    },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  const result = await service(input);
  assert.equal(result.ok, false);
  assert.match(result.error.message, /currency/i);
});

test("optimization service returns SERVICE_UNAVAILABLE on query failure", async () => {
  const service = createRiskOptimizationService({
    bigquery: {
      query: async () => { throw new Error("Network error"); },
    },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  const result = await service(input);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
});

test("optimization service returns VALIDATION_ERROR when inputs are missing", async () => {
  const service = createRiskOptimizationService({
    bigquery: { query: async () => twoRowResult() },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  const result = await service({ order: input.order });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.ok(result.error.issues.some((i) => i.field === "conditions"));
  assert.equal(result.error.issues.some((i) => i.field === "levers"), false);
});

test("optimization service rethrows AbortError", async () => {
  const abortError = new DOMException("Aborted", "AbortError");
  const service = createRiskOptimizationService({
    bigquery: {
      query: async () => { throw abortError; },
    },
    sql: "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m_warp, (SELECT 1)) FROM prepagent.items",
  });
  await assert.rejects(() => service(input), { name: "AbortError" });
});

test("optimize.sql file exists and references ML.PREDICT and optimize.sql header", () => {
  const sql = readFileSync(new URL("../sql/optimize.sql", import.meta.url), "utf8");
  assert.ok(sql.includes("ML.PREDICT"), "optimize.sql must reference ML.PREDICT");
  assert.ok(/--[^\n]*optimize\.sql/i.test(sql), "optimize.sql must have header comment");
  assert.ok(sql.includes("BASELINE"), "optimize.sql must return BASELINE row");
  assert.ok(sql.includes("BEST"),     "optimize.sql must return BEST row");
  assert.ok(sql.includes("n_changes"), "optimize.sql must return n_changes");
  assert.ok(sql.includes("savings_kg"), "optimize.sql must return savings_kg");
  assert.ok(sql.includes("savings_cost"), "optimize.sql must return savings_cost");
  assert.match(sql, /ORDER BY total_cost, n_changes, sf_speed_mpm, roll_temp_c, gum_application,\s*gum_viscosity_sec, pasting_pressure, drying_hours, print_speed_spm/);
  assert.match(sql, /cost_per_kg/);
  assert.match(sql, /ASSERT EXISTS\(SELECT 1 FROM prepagent\.items WHERE item_code = @item_code\)\s+AS 'Item not found in item master'/);
  assert.match(sql, /ASSERT EXISTS\(SELECT 1 FROM prepagent\.plants WHERE plant_id = 'PLANT-01'\)\s+AS 'Plant settings missing'/);
  assert.match(sql, /200 \* GREATEST\(drying_hours - CAST\(@drying_hours AS FLOAT64\), 0\)/);
  assert.match(sql, /60 \* GREATEST\(CAST\(@sf_speed_mpm AS FLOAT64\) - sf_speed_mpm, 0\)/);
  assert.match(sql, /30 \* GREATEST\(CAST\(@print_speed_spm AS FLOAT64\) - print_speed_spm, 0\)/);
  assert.match(sql, /1300, RECYCLED/);
  assert.match(sql, /5351/);
  assert.match(sql, /925/);
});
