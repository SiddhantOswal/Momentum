import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import conditionRanges from "../config/condition-ranges.json" with { type: "json" };
import {
  buildDefectQueries,
  createRiskPredictionService as createRiskPredictionServiceImpl,
  decodeRiskPredictionResult,
  DEFECT_MODELS,
} from "../src/google-cloud/risk-prediction-service.js";
import { BigQueryReadError, createBigQueryReadClient } from "../src/google-cloud/bigquery-read-client.js";
import { createConditionGuard, seasonalValue } from "../src/condition-guard.js";
import {
  GuardedRiskPredictionRequestSchema,
  RiskPredictionApiResponseSchema,
  RiskPredictionRequestSchema,
} from "../src/schemas.js";
import { acceptedModelSetFixture } from "./fixtures/accepted-model-set.js";

const predictSql = readFileSync(new URL("../sql/predict.sql", import.meta.url), "utf8");
const defectSql = readFileSync(new URL("../sql/predict_defect.sql", import.meta.url), "utf8");
const DEFECTS = ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"];

function createService(options = {}) {
  return createRiskPredictionServiceImpl({
    modelAcceptance: acceptedModelSetFixture,
    conditionGuard: createConditionGuard({ now: () => new Date("2026-11-20T06:00:00.000Z") }),
    ...options,
  });
}

// PO1 / PKBX0041 acceptance inputs (TEST-CLA/PO/2026/1047).
const input = {
  order: { itemCode: "PKBX0041", quantity: 1300, paperType: "RECYCLED", paperSupplier: "SUP-D" },
  conditions: { shift: "DAY", ambientRhPct: 86, ambientTempC: 26, paperMoisturePct: 10.8 },
  conditionsConfirmed: true,
  levers: { sfSpeedMpm: 48, rollTempC: 162, gumApplication: "HIGH", gumViscositySec: 32, pastingPressure: "MED", dryingHours: 5, printSpeedSpm: 60 },
};

const baseFields = [
  ["item_code", "STRING"], ["rate_warp_pct", "FLOAT"], ["rate_delam_pct", "FLOAT"],
  ["rate_strength_pct", "FLOAT"], ["rate_print_pct", "FLOAT"], ["rate_crack_pct", "FLOAT"],
  ["total_scrap_pct", "FLOAT"], ["total_scrap_kg", "FLOAT"], ["scrap_cost", "FLOAT"],
  ["currency", "STRING"], ["primary_defect", "STRING"],
];
const bandFields = [
  "rh_band_low_pct", "rh_band_high_pct",
  ...DEFECTS.flatMap((defect) => [`rate_${defect.toLowerCase()}_low_pct`, `rate_${defect.toLowerCase()}_high_pct`]),
].map((name) => [name, "FLOAT"]);
// PO1 rates; totals over the four optimizer targets (crack is advisory), 986.2 kg of board at Rs 53.3 per kg.
const centralValues = ["PKBX0041", "3.423", "2.98", "1.167", "1.828", "0.778", "9.4", "92.7", "4940", "INR", "WARP"];
const { targetUse } = acceptedModelSetFixture;
// Test values for the RH 81..91 band around the PO1 central row.
const bandValues = ["81", "91", "2.737", "4.116", "2.98", "2.98", "0.894", "1.167", "1.828", "2.239", "0.759", "0.821"];

function combinedResult({ withBand = true, values } = {}) {
  const fields = withBand ? [...baseFields, ...bandFields] : baseFields;
  const row = values ?? (withBand ? [...centralValues, ...bandValues] : centralValues);
  return {
    schema: { fields: fields.map(([name, type]) => ({ name, type })) },
    rows: [{ f: row.map((v) => ({ v })) }],
  };
}

const defectFieldDefs = [
  ["item_code", "STRING"], ["defect", "STRING"], ["rate_pct", "FLOAT"], ["rate_low_pct", "FLOAT"],
  ["rate_high_pct", "FLOAT"], ["rh_band_low_pct", "FLOAT"], ["rh_band_high_pct", "FLOAT"],
  ["lot_board_kg", "FLOAT"], ["cost_per_kg", "FLOAT"], ["currency", "STRING"],
].map(([name, type]) => ({ name, type }));
const defectRates = {
  WARP: ["3.423", "2.737", "4.116"],
  DELAM: ["2.98", "2.98", "2.98"],
  STRENGTH: ["1.167", "0.894", "1.167"],
  PRINT: ["1.828", "1.828", "2.239"],
  CRACK: ["0.778", "0.759", "0.821"],
};
function defectResult(defect) {
  return {
    schema: { fields: defectFieldDefs },
    rows: [{ f: ["PKBX0041", defect, ...defectRates[defect], "81", "91", "986.2", "53.3", "INR"].map((v) => ({ v })) }],
  };
}

test("predict.sql predicts RH-5 and RH+5 in the same job, clamped to the recorded humidity range, with the 15 inputs and the target set", () => {
  const { min, max } = conditionRanges.fields.ambientRhPct;
  assert.match(predictSql, new RegExp(`GREATEST\\(CAST\\(@ambient_rh_pct AS FLOAT64\\) - 5, ${min.toFixed(1)}\\)`));
  assert.match(predictSql, new RegExp(`LEAST\\(CAST\\(@ambient_rh_pct AS FLOAT64\\) \\+ 5, ${max.toFixed(1)}\\)`));
  // Still one ML.PREDICT per model, one statement, central-row totals.
  for (const { model } of Object.values(DEFECT_MODELS)) {
    assert.equal(predictSql.split(`MODEL ${model},`).length - 1, 1, model);
  }
  assert.match(predictSql, /MAX\(IF\(rh_scenario = 'CENTRAL', r_warp, NULL\)\) AS r_warp/);
  const parameters = new Set(predictSql.replace(/--[^\n]*/g, "").match(/@[a-z_]+/g));
  assert.deepEqual([...parameters].sort(), [
    "@ambient_rh_pct", "@ambient_temp_c", "@drying_hours", "@gum_application", "@gum_viscosity_sec",
    "@item_code", "@optimizer_targets", "@paper_moisture_pct", "@paper_supplier", "@paper_type", "@pasting_pressure",
    "@print_speed_spm", "@quantity", "@roll_temp_c", "@sf_speed_mpm", "@shift",
  ]);
});

test("decoder keeps the legacy result shape and adds an optional humidity band", () => {
  const legacy = decodeRiskPredictionResult(combinedResult({ withBand: false }), "PKBX0041", targetUse);
  assert.equal(legacy.humidityBand, undefined);
  assert.equal(legacy.risk.totalScrapPct, 9.4);

  const banded = decodeRiskPredictionResult(combinedResult(), "PKBX0041", targetUse);
  assert.deepEqual(banded.risk, legacy.risk);
  assert.deepEqual(banded.humidityBand, {
    ambientRhPct: { low: 81, high: 91 },
    ratesPct: {
      WARP: { low: 2.737, high: 4.116 },
      DELAM: { low: 2.98, high: 2.98 },
      STRENGTH: { low: 0.894, high: 1.167 },
      PRINT: { low: 1.828, high: 2.239 },
      CRACK: { low: 0.759, high: 0.821 },
    },
  });

  const outside = [...centralValues, ...bandValues];
  outside[11 + 2] = "3.5"; // WARP low above the central 3.423
  assert.throws(() => decodeRiskPredictionResult(combinedResult({ values: outside }), "PKBX0041", targetUse),
    (error) => error instanceof BigQueryReadError && /humidity band/.test(error.message));
});

test("prediction response carries the humidity band, condition sources and normal confidence", async () => {
  let request;
  const service = createService({ bigquery: { query: async (value) => { request = value; return combinedResult(); } } });
  const response = await service(input);
  assert.equal(response.ok, true);
  assert.equal(request.sql, predictSql);
  assert.equal(Object.keys(request.parameters).length, 16);
  assert.deepEqual(request.parameters.optimizer_targets, {
    type: "ARRAY<STRING>", value: ["WARP", "DELAM", "STRENGTH", "PRINT"],
  });
  assert.equal(response.totalScrapPct, 9.4);
  assert.equal(response.primaryDefect, "WARP");
  assert.deepEqual(response.humidityBand.ratesPct.WARP, { low: 2.737, high: 4.116 });
  assert.deepEqual(response.conditionSources, { ambientRhPct: "plant", ambientTempC: "plant", paperMoisturePct: "plant" });
  assert.equal(response.confidence, "normal");
  assert.equal(response.partial, undefined);
  assert.equal(response.unavailableDefects, undefined);
  assert.equal(response.conditionNotes, undefined);
});

test("missing humidity is replaced by the seasonal value before the query and flagged as reduced confidence", async () => {
  let request;
  const service = createService({ bigquery: { query: async (value) => { request = value; return combinedResult(); } } });
  const { ambientRhPct: _missing, ...conditions } = input.conditions;
  const response = await service({ ...input, conditions: { ...conditions, runDate: "2026-11-20" } });
  assert.equal(response.ok, true);
  assert.equal(request.parameters.ambient_rh_pct.value, seasonalValue("ambientRhPct", 11));
  assert.equal(request.parameters.ambient_temp_c.value, 26);
  assert.deepEqual(response.conditionSources, { ambientRhPct: "seasonal", ambientTempC: "plant", paperMoisturePct: "plant" });
  assert.equal(response.confidence, "reduced");
  assert.match(response.conditionNotes[0], /typical November value/);
});

test("out-of-range paper moisture returns a plain VALIDATION_ERROR before any query", async () => {
  let queried = false;
  const service = createService({ bigquery: { query: async () => { queried = true; return combinedResult(); } } });
  const response = await service({ ...input, conditions: { ...input.conditions, paperMoisturePct: 16 } });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "VALIDATION_ERROR");
  assert.match(response.error.message, /Paper moisture reading 16% is outside the plant's recorded range/);
  assert.equal(queried, false);
});

test("per-defect fallback SQL uses only the fixed model whitelist and predict.sql's shared input", () => {
  const queries = buildDefectQueries(predictSql, defectSql);
  const prefix = predictSql.slice(0, predictSql.indexOf("\nw  AS ("));
  for (const defect of DEFECTS) {
    const sql = queries[defect];
    assert.ok(sql.startsWith(prefix), defect);
    assert.equal(sql.includes("{{"), false);
    const models = sql.match(/MODEL\s+[\w.]+/g);
    assert.deepEqual(models, [`MODEL ${DEFECT_MODELS[defect].model}`]);
    assert.ok(sql.includes(DEFECT_MODELS[defect].predictedColumn));
  }
  assert.equal(buildDefectQueries("-- predict.sql legacy\nSELECT ML.PREDICT", defectSql), undefined);
});

test("per-defect fallback queries pass the read-only BigQuery client guard", async () => {
  const sent = [];
  const client = createBigQueryReadClient({
    projectId: "prepagent-hack",
    location: "asia-south1",
    tokenProvider: async () => "test-token",
    fetchImpl: async (_url, options) => {
      sent.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ jobComplete: true, totalRows: "0", schema: { fields: [] }, rows: [], jobReference: { jobId: "t" } }) };
    },
  });
  for (const sql of [predictSql, ...Object.values(buildDefectQueries(predictSql, defectSql))]) {
    await client.query({ sql, parameters: { item_code: "PKBX0041", defect: "WARP" } });
  }
  assert.equal(sent.length, 6);
});

test("when the combined query fails, one failing model gives a flagged partial result from the other four", async () => {
  const calls = [];
  const service = createService({
    bigquery: {
      query: async ({ sql, parameters }) => {
        calls.push(parameters.defect ?? "combined");
        if (sql === predictSql) throw new BigQueryReadError("BIGQUERY_JOB_FAILED", "Model m_crack failed.");
        if (parameters.defect === "CRACK") throw new BigQueryReadError("BIGQUERY_JOB_FAILED", "Model m_crack failed.");
        return defectResult(parameters.defect);
      },
    },
  });
  const response = await service(input);
  assert.equal(response.ok, true);
  assert.deepEqual(calls.sort(), ["CRACK", "DELAM", "PRINT", "STRENGTH", "WARP", "combined"]);
  assert.equal(response.partial, true);
  assert.deepEqual(response.unavailableDefects, ["CRACK"]);
  assert.deepEqual(response.totalsCover, ["WARP", "DELAM", "STRENGTH", "PRINT"]);
  assert.deepEqual(response.ratesPct, { WARP: 3.423, DELAM: 2.98, STRENGTH: 1.167, PRINT: 1.828 });
  // Totals use only the four available defects: 9.398% of 986.2 kg at 53.3 per kg.
  assert.equal(response.totalScrapPct, 9.4);
  assert.equal(response.totalScrapKg, 92.7);
  assert.equal(response.scrapCost, 4940);
  assert.equal(response.primaryDefect, "WARP");
  assert.equal(response.humidityBand.ratesPct.CRACK, undefined);
  assert.deepEqual(response.humidityBand.ratesPct.STRENGTH, { low: 0.894, high: 1.167 });
  assert.equal(response.confidence, "normal");
});

test("when every per-defect query succeeds the fallback result is complete and unflagged", async () => {
  const service = createService({
    bigquery: {
      query: async ({ sql, parameters }) => {
        if (sql === predictSql) throw new Error("transient");
        return defectResult(parameters.defect);
      },
    },
  });
  const response = await service(input);
  assert.equal(response.ok, true);
  assert.equal(response.partial, undefined);
  assert.equal(Object.keys(response.ratesPct).length, 5);
  assert.equal(response.totalScrapPct, 9.4);
  assert.equal(response.primaryDefect, "WARP");
});

test("the fallback reports unavailable when no model answers and not found when the item is unknown", async () => {
  const failing = createService({ bigquery: { query: async () => { throw new BigQueryReadError("BIGQUERY_JOB_FAILED", "down"); } } });
  const unavailable = await failing(input);
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.error.code, "SERVICE_UNAVAILABLE");

  const unknownItem = createService({
    bigquery: {
      query: async ({ sql }) => {
        if (sql === predictSql) throw new BigQueryReadError("BIGQUERY_JOB_FAILED", "down");
        return { schema: { fields: defectFieldDefs }, rows: [] };
      },
    },
  });
  const notFound = await unknownItem(input);
  assert.equal(notFound.ok, false);
  assert.equal(notFound.error.code, "NOT_FOUND");
});

test("a cancelled combined query does not start the per-defect fallback", async () => {
  let calls = 0;
  const service = createService({
    bigquery: { query: async () => { calls += 1; throw new DOMException("Aborted", "AbortError"); } },
  });
  await assert.rejects(service(input), { name: "AbortError" });
  assert.equal(calls, 1);
});

test("response schema keeps complete results unchanged and requires partial results to be flagged", () => {
  const complete = {
    ok: true, agent: "predictRisk", source: "bigquery-ml", isRealModelPrediction: true, itemCode: "PKBX0041",
    ratesPct: { WARP: 3.423, DELAM: 2.98, STRENGTH: 1.167, PRINT: 1.828, CRACK: 0.778 },
    totalScrapPct: 9.4, totalScrapKg: 92.7, scrapCost: 4940, currency: "INR", primaryDefect: "WARP",
    targetUse: acceptedModelSetFixture.targetUse,
    modelProvenance: {
      query: "sql/predict.sql",
      outputs: acceptedModelSetFixture.models.map(({ defect, resource, r2, modelVersion, sampleCount }) =>
        ({ defect, resource, r2, modelVersion, sampleCount })),
      currentModelVersionsLinked: true,
    },
    modelAcceptance: {
      status: "accepted", requiredR2: { WARP: 0.6, DELAM: 0.6, STRENGTH: 0.45, PRINT: 0.6, CRACK: 0.3 },
      prototypeThresholdsMet: true, completeAcceptanceEvidenceAvailable: true, evaluationId: "e", evaluatedAt: "t",
      split: "s", linkedToCurrentResourceVersions: true, models: [], notes: [],
    },
  };
  assert.equal(RiskPredictionApiResponseSchema.safeParse(complete).success, true);
  const { CRACK: _crack, ...fourRates } = complete.ratesPct;
  assert.equal(RiskPredictionApiResponseSchema.safeParse({ ...complete, ratesPct: fourRates }).success, false);
  assert.equal(RiskPredictionApiResponseSchema.safeParse({
    ...complete, ratesPct: fourRates, unavailableDefects: ["CRACK"],
  }).success, false);
  assert.equal(RiskPredictionApiResponseSchema.safeParse({
    ...complete, ratesPct: fourRates, unavailableDefects: ["CRACK"], partial: true,
    totalsCover: ["WARP", "DELAM", "STRENGTH", "PRINT"],
  }).success, true);
  assert.equal(RiskPredictionApiResponseSchema.safeParse({
    ...complete, conditionSources: { ambientRhPct: "plant", ambientTempC: "plant", paperMoisturePct: "weather" },
  }).success, false);
});

test("the strict prediction request contract is unchanged; the HTTP route accepts missing humidity for the guard", () => {
  const { ambientRhPct: _missing, ...conditions } = input.conditions;
  assert.equal(RiskPredictionRequestSchema.safeParse({ ...input, conditions }).success, false);
  assert.equal(GuardedRiskPredictionRequestSchema.safeParse({ ...input, conditions }).success, true);
  assert.equal(GuardedRiskPredictionRequestSchema.safeParse({
    ...input, conditions: { ...input.conditions, ambientRhPct: null },
  }).success, true);
  assert.equal(GuardedRiskPredictionRequestSchema.safeParse({
    ...input, conditions: { ...input.conditions, ambientRhPct: "86" },
  }).success, false);
});
