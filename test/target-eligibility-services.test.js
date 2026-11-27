import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRiskOptimizationService } from "../src/google-cloud/risk-optimization-service.js";
import { createRiskPredictionService } from "../src/google-cloud/risk-prediction-service.js";
import { RiskPredictionApiResponseSchema } from "../src/schemas.js";

// The committed acceptance record: crack advisory, the other four optimizer.
const active = JSON.parse(readFileSync(new URL("../config/model-acceptance.json", import.meta.url), "utf8"));
const DEFECTS = ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"];
const LEVERS = ["sf_speed_mpm", "roll_temp_c", "gum_application", "gum_viscosity_sec",
  "pasting_pressure", "drying_hours", "print_speed_spm"];
const LOT_BOARD_KG = 986.2;
const COST_PER_KG = 53.3;

function withUseClass(defect, useClass) {
  const record = structuredClone(active);
  record.targetUse[defect].useClass = useClass;
  return record;
}

const input = {
  order: {
    orderId: "PO-ML03-1", itemCode: "PKBX0041", customerId: "C-1", boxStyle: "RSC",
    lengthMm: 400, widthMm: 300, heightMm: 250, ply: 5, fluteProfile: "BC",
    topLinerGsm: 180, fluteGsm: 150, innerLinerGsm: 180, linerBf: 24,
    paperType: "RECYCLED", paperSupplier: "SUP-D", inkColors: 2, inkCoveragePct: 15, quantity: 1300,
  },
  conditions: { runDate: "2026-10-12", shift: "DAY", ambientRhPct: 86, ambientTempC: 26, paperMoisturePct: 10.8 },
  conditionsConfirmed: true,
  levers: { sfSpeedMpm: 48, rollTempC: 162, gumApplication: "HIGH", gumViscositySec: 32, pastingPressure: "MED", dryingHours: 5, printSpeedSpm: 60 },
};
const planned = { sf_speed_mpm: 48, roll_temp_c: 162, gum_application: "HIGH", gum_viscosity_sec: 32,
  pasting_pressure: "MED", drying_hours: 5, print_speed_spm: 60 };

const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

// Stands in for optimize.sql: the same objective, change limit and tie-break
// order, and it learns which targets count only from the bound parameter.
function fakeOptimizer(candidates, requests = []) {
  return {
    async query(request) {
      requests.push(request);
      const counted = request.parameters.optimizer_targets.value;
      const scored = candidates.map(({ levers, rates }) => {
        const row = { ...planned, ...levers };
        const totalPct = counted.reduce((sum, defect) => sum + rates[defect], 0);
        const scrapKg = LOT_BOARD_KG * totalPct / 100;
        const scrapCost = scrapKg * COST_PER_KG;
        const penalty = 200 * Math.max(row.drying_hours - planned.drying_hours, 0) +
          60 * Math.max(planned.sf_speed_mpm - row.sf_speed_mpm, 0) +
          30 * Math.max(planned.print_speed_spm - row.print_speed_spm, 0);
        const keyed = Object.fromEntries(DEFECTS.map((defect) => [defect, counted.includes(defect) ? rates[defect] : -1]));
        return {
          ...row,
          n_changes: LEVERS.filter((lever) => row[lever] !== planned[lever]).length,
          rates,
          total_scrap_pct: round(totalPct, 2),
          scrap_kg: round(scrapKg, 1),
          scrap_cost: round(scrapCost, 0),
          penalty: round(penalty, 0),
          total_cost: round(scrapCost + penalty, 0),
          primary_defect: DEFECTS.find((defect) => keyed[defect] === Math.max(...Object.values(keyed))),
        };
      });
      const baseline = scored.find((row) => row.n_changes === 0);
      const order = ["total_cost", "n_changes", ...LEVERS];
      const best = scored.filter((row) => row.n_changes <= 3).sort((left, right) => {
        for (const key of order) {
          if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
        }
        return 0;
      })[0];
      const toRow = (kind, row, savingsKg, savingsCost) => ({ f: [
        kind, row.n_changes, ...LEVERS.map((lever) => row[lever]),
        ...DEFECTS.map((defect) => row.rates[defect]),
        row.total_scrap_pct, row.scrap_kg, row.scrap_cost, row.penalty, row.total_cost,
        "INR", row.primary_defect, savingsKg, savingsCost,
      ].map((value) => ({ v: String(value) })) });
      const names = ["kind", "n_changes", ...LEVERS, ...DEFECTS.map((d) => `rate_${d.toLowerCase()}_pct`),
        "total_scrap_pct", "scrap_kg", "scrap_cost", "penalty", "total_cost", "currency", "primary_defect",
        "savings_kg", "savings_cost"];
      const strings = new Set(["kind", "gum_application", "pasting_pressure", "currency", "primary_defect"]);
      return {
        schema: { fields: names.map((name) => ({
          name, type: strings.has(name) ? "STRING" : name === "n_changes" ? "INTEGER" : "FLOAT",
        })) },
        rows: [
          toRow("BASELINE", baseline, 0, 0),
          toRow("BEST", best, round(baseline.scrap_kg - best.scrap_kg, 1), round(baseline.total_cost - best.total_cost, 0)),
        ],
      };
    },
  };
}

const optimizerRates = { WARP: 2.4, DELAM: 2.3, STRENGTH: 1.2, PRINT: 1.7 };
// Two candidates, one change each, with identical optimizer-target rates; only
// their crack term differs. Candidate B sorts first on a tie (roll 162 < 170).
function candidates({ crackA, crackB }) {
  return [
    { levers: {}, rates: { WARP: 3.4, DELAM: 3.0, STRENGTH: 1.2, PRINT: 1.8, CRACK: 0.8 } },
    { levers: { roll_temp_c: 170 }, rates: { ...optimizerRates, CRACK: crackA } },
    { levers: { gum_application: "MED" }, rates: { ...optimizerRates, CRACK: crackB } },
  ];
}
const SQL = "-- optimize.sql\nSELECT ML.PREDICT(MODEL prepagent.m2_warp, (SELECT 1)) FROM prepagent.items";

async function chosenLevers(modelAcceptance, crack) {
  const service = createRiskOptimizationService({ bigquery: fakeOptimizer(candidates(crack)), sql: SQL, modelAcceptance });
  const result = await service(input);
  assert.equal(result.ok, true, result.error?.message);
  return result;
}

test("an advisory target cannot change the chosen settings: swapping only the crack term keeps the recommendation", async () => {
  const lowCrackOnA = await chosenLevers(active, { crackA: 0.2, crackB: 1.5 });
  const lowCrackOnB = await chosenLevers(active, { crackA: 1.5, crackB: 0.2 });
  assert.deepEqual(lowCrackOnA.best.levers, lowCrackOnB.best.levers);
  assert.deepEqual(lowCrackOnA.changes.map((change) => change.lever), ["gumApplication"]);
  assert.deepEqual(lowCrackOnA.savings, lowCrackOnB.savings);
});

test("the same fixture does move the recommendation when crack is counted, so the check above can fail", async () => {
  const counted = withUseClass("CRACK", "optimizer");
  const lowCrackOnA = await chosenLevers(counted, { crackA: 0.2, crackB: 1.5 });
  const lowCrackOnB = await chosenLevers(counted, { crackA: 1.5, crackB: 0.2 });
  assert.notDeepEqual(lowCrackOnA.best.levers, lowCrackOnB.best.levers);
  assert.deepEqual(lowCrackOnA.changes.map((change) => change.lever), ["rollTempC"]);
});

test("optimization response carries the use class per target and keeps advisory crack out of the totals", async () => {
  const requests = [];
  const service = createRiskOptimizationService({
    bigquery: fakeOptimizer(candidates({ crackA: 9.5, crackB: 9.5 }), requests), sql: SQL, modelAcceptance: active,
  });
  const result = await service(input);
  assert.equal(result.ok, true, result.error?.message);
  assert.deepEqual(requests[0].parameters.optimizer_targets, {
    type: "ARRAY<STRING>", value: ["WARP", "DELAM", "STRENGTH", "PRINT"],
  });
  for (const profile of [result.baseline, result.best]) {
    assert.deepEqual(profile.risk.targetUse, active.targetUse);
  }
  assert.equal(result.best.risk.ratesPct.CRACK, 9.5, "advisory crack is still returned");
  assert.equal(result.best.risk.totalScrapPct, 7.6, "the total covers the four optimizer targets only");
  assert.equal(result.best.risk.primaryDefect, "WARP", "the highest rate is crack, but it is not an optimizer target");
});

test("an abstain target is neither returned as a number nor used by the optimizer", async () => {
  const requests = [];
  const service = createRiskOptimizationService({
    bigquery: fakeOptimizer(candidates({ crackA: 1.537, crackB: 1.537 }), requests),
    sql: SQL,
    modelAcceptance: withUseClass("CRACK", "abstain"),
  });
  const result = await service(input);
  assert.equal(result.ok, true, result.error?.message);
  assert.deepEqual(requests[0].parameters.optimizer_targets.value, ["WARP", "DELAM", "STRENGTH", "PRINT"]);
  assert.equal(result.best.risk.targetUse.CRACK.useClass, "abstain");
  assert.equal(Object.hasOwn(result.best.risk.ratesPct, "CRACK"), false);
  assert.equal(Object.hasOwn(result.baseline.risk.ratesPct, "CRACK"), false);
  assert.doesNotMatch(JSON.stringify(result), /1\.537/);
});

test("optimization and prediction fail closed before BigQuery when a target has no use class", async () => {
  const unlabelled = structuredClone(active);
  delete unlabelled.targetUse.CRACK;
  let queries = 0;
  const bigquery = { query: async () => { queries += 1; throw new Error("must not run"); } };
  const optimized = await createRiskOptimizationService({ bigquery, sql: SQL, modelAcceptance: unlabelled })(input);
  const predicted = await createRiskPredictionService({ bigquery, modelAcceptance: unlabelled })(input);
  for (const response of [optimized, predicted]) {
    assert.equal(response.ok, false);
    assert.equal(response.error.code, "SERVICE_UNAVAILABLE");
    assert.match(response.error.message, /use class/);
  }
  assert.equal(queries, 0);
});

// Stands in for predict.sql: totals and the primary defect over the bound target set, band columns included.
function fakePrediction(rates, { band = 0.1, requests = [], includeAllInTotal = false } = {}) {
  return {
    async query(request) {
      requests.push(request);
      if (!request.parameters.optimizer_targets) throw new Error("per-defect fallback is not part of this fixture");
      const counted = includeAllInTotal ? DEFECTS : request.parameters.optimizer_targets.value;
      const totalPct = counted.reduce((sum, defect) => sum + rates[defect], 0);
      const keyed = Object.fromEntries(DEFECTS.map((defect) => [defect, counted.includes(defect) ? rates[defect] : -1]));
      const names = ["item_code", ...DEFECTS.map((d) => `rate_${d.toLowerCase()}_pct`), "total_scrap_pct",
        "total_scrap_kg", "scrap_cost", "currency", "primary_defect", "rh_band_low_pct", "rh_band_high_pct",
        ...DEFECTS.flatMap((d) => [`rate_${d.toLowerCase()}_low_pct`, `rate_${d.toLowerCase()}_high_pct`])];
      const values = ["PKBX0041", ...DEFECTS.map((defect) => rates[defect]), round(totalPct, 2),
        round(LOT_BOARD_KG * totalPct / 100, 1), round(LOT_BOARD_KG * totalPct / 100 * COST_PER_KG, 0), "INR",
        DEFECTS.find((defect) => keyed[defect] === Math.max(...Object.values(keyed))), 81, 91,
        ...DEFECTS.flatMap((defect) => [round(rates[defect] - band, 3), round(rates[defect] + band, 3)])];
      const strings = new Set(["item_code", "currency", "primary_defect"]);
      return {
        schema: { fields: names.map((name) => ({ name, type: strings.has(name) ? "STRING" : "FLOAT" })) },
        rows: [{ f: values.map((value) => ({ v: String(value) })) }],
      };
    },
  };
}

test("prediction response carries the use class per target and returns advisory crack outside the totals", async () => {
  const requests = [];
  const rates = { WARP: 3.423, DELAM: 2.98, STRENGTH: 1.167, PRINT: 1.828, CRACK: 4.5 };
  const response = await createRiskPredictionService({ bigquery: fakePrediction(rates, { requests }), modelAcceptance: active })(input);
  assert.equal(response.ok, true, response.error?.message);
  assert.equal(RiskPredictionApiResponseSchema.safeParse(response).success, true);
  assert.deepEqual(requests[0].parameters.optimizer_targets.value, ["WARP", "DELAM", "STRENGTH", "PRINT"]);
  assert.deepEqual(response.targetUse, active.targetUse);
  assert.equal(response.ratesPct.CRACK, 4.5);
  assert.equal(response.totalScrapPct, 9.4);
  assert.equal(response.primaryDefect, "WARP");
  assert.deepEqual(response.humidityBand.ratesPct.CRACK, { low: 4.4, high: 4.6 });

  const { targetUse: _dropped, ...withoutUseClass } = response;
  assert.equal(RiskPredictionApiResponseSchema.safeParse(withoutUseClass).success, false,
    "the strict response schema requires the use classes");
});

test("prediction refuses a row whose totals still include an advisory target", async () => {
  const rates = { WARP: 3.423, DELAM: 2.98, STRENGTH: 1.167, PRINT: 1.828, CRACK: 0.778 };
  const response = await createRiskPredictionService({
    bigquery: fakePrediction(rates, { includeAllInTotal: true }), modelAcceptance: active,
  })(input);
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "SERVICE_UNAVAILABLE");
});

test("prediction drops an abstain target from rates and band, and the fallback never queries it", async () => {
  const requests = [];
  const rates = { WARP: 3.423, DELAM: 2.98, STRENGTH: 1.167, PRINT: 1.828, CRACK: 1.537 };
  const modelAcceptance = withUseClass("CRACK", "abstain");
  const response = await createRiskPredictionService({ bigquery: fakePrediction(rates, { requests }), modelAcceptance })(input);
  assert.equal(response.ok, true, response.error?.message);
  assert.equal(Object.hasOwn(response.ratesPct, "CRACK"), false);
  assert.equal(Object.hasOwn(response.humidityBand.ratesPct, "CRACK"), false);
  assert.doesNotMatch(JSON.stringify(response), /1\.537|1\.637|1\.437/);

  const fallbackRequests = [];
  const fallback = await quietly(() =>
    createRiskPredictionService({ bigquery: perDefectOnly(rates, fallbackRequests), modelAcceptance })(input));
  assert.equal(fallback.ok, true, fallback.error?.message);
  assert.deepEqual(fallbackRequests.slice(1).map((request) => request.parameters.defect), ["WARP", "DELAM", "STRENGTH", "PRINT"]);
  assert.ok(fallbackRequests.slice(1).every((request) => !("optimizer_targets" in request.parameters)));
  assert.equal(Object.hasOwn(fallback.ratesPct, "CRACK"), false);
  assert.equal(fallback.totalScrapPct, 9.4);
});

function perDefectOnly(rates, requests = []) {
  return {
    async query(request) {
      requests.push(request);
      if (request.parameters.optimizer_targets) throw new Error("combined job failed");
      const defect = request.parameters.defect;
      return {
        schema: { fields: ["item_code", "defect", "rate_pct", "rate_low_pct", "rate_high_pct", "rh_band_low_pct",
          "rh_band_high_pct", "lot_board_kg", "cost_per_kg", "currency"].map((name) => ({
          name, type: ["item_code", "defect", "currency"].includes(name) ? "STRING" : "FLOAT",
        })) },
        rows: [{ f: ["PKBX0041", defect, rates[defect], rates[defect], rates[defect], 81, 91, LOT_BOARD_KG, COST_PER_KG, "INR"]
          .map((value) => ({ v: String(value) })) }],
      };
    },
  };
}

async function quietly(run) {
  const logged = console.error;
  console.error = () => {};
  try { return await run(); } finally { console.error = logged; }
}

test("the per-defect fallback leaves advisory crack out of the total and the primary defect, even when it is highest", async () => {
  const rates = { WARP: 3.423, DELAM: 2.98, STRENGTH: 1.167, PRINT: 1.828, CRACK: 6.5 };
  const response = await quietly(() => createRiskPredictionService({ bigquery: perDefectOnly(rates), modelAcceptance: active })(input));
  assert.equal(response.ok, true, response.error?.message);
  assert.equal(response.partial, undefined);
  assert.equal(response.ratesPct.CRACK, 6.5, "advisory crack is still returned");
  assert.equal(response.totalScrapPct, 9.4);
  assert.equal(response.totalScrapKg, round(LOT_BOARD_KG * 9.398 / 100, 1));
  assert.equal(response.scrapCost, Math.round(LOT_BOARD_KG * 9.398 / 100 * COST_PER_KG));
  assert.equal(response.primaryDefect, "WARP");
});

test("a partial fallback result covers only the available optimizer targets", async () => {
  const rates = { WARP: 3.423, DELAM: 2.98, STRENGTH: 1.167, PRINT: 1.828, CRACK: 6.5 };
  const flaky = perDefectOnly(rates);
  const bigquery = { query: async (request) => {
    if (request.parameters.defect === "WARP") throw new Error("warp model down");
    return flaky.query(request);
  } };
  const response = await quietly(() => createRiskPredictionService({ bigquery, modelAcceptance: active })(input));
  assert.equal(response.ok, true, response.error?.message);
  assert.equal(response.partial, true);
  assert.deepEqual(response.unavailableDefects, ["WARP"]);
  assert.deepEqual(response.totalsCover, ["DELAM", "STRENGTH", "PRINT"]);
  assert.equal(response.totalScrapPct, 5.98);
  assert.equal(response.primaryDefect, "DELAM");
});

test("the optimizer refuses a row that names advisory crack as the primary defect", async () => {
  const optimizer = fakeOptimizer(candidates({ crackA: 9, crackB: 9 }));
  const bigquery = { query: async (request) => {
    const result = await optimizer.query(request);
    const primary = result.schema.fields.findIndex((field) => field.name === "primary_defect");
    for (const row of result.rows) row.f[primary].v = "CRACK";
    return result;
  } };
  const result = await createRiskOptimizationService({ bigquery, sql: SQL, modelAcceptance: active })(input);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  assert.match(result.error.message, /primary_defect/);
});
