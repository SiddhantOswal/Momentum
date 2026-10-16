import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createRiskExplanationService,
  createSeenBeforeService,
  createSimilarRunsService,
} from "../src/google-cloud/risk-evidence-service.js";

import { VertexGeminiError } from "../src/google-cloud/vertex-gemini-client.js";
const query = (name) => readFileSync(new URL(`../sql/${name}`, import.meta.url), "utf8");
const order = {
  orderId: "PO-1", itemCode: "PKBX0041", customerId: "C-1", boxStyle: "RSC",
  lengthMm: 400, widthMm: 300, heightMm: 250, ply: 5, fluteProfile: "BC",
  topLinerGsm: 180, fluteGsm: 150, innerLinerGsm: 180, linerBf: 24,
  paperType: "RECYCLED", paperSupplier: "SUP-D", inkColors: 2, inkCoveragePct: 15, quantity: 1300,
};
const conditions = {
  runDate: "2026-10-12", shift: "DAY", ambientRhPct: 86, ambientTempC: 26, paperMoisturePct: 10.8,
};
const planned = {
  sfSpeedMpm: 48, rollTempC: 162, gumApplication: "HIGH", gumViscositySec: 32,
  pastingPressure: "MED", dryingHours: 5, printSpeedSpm: 60,
};
const prediction = {
  ratesPct: { WARP: 3.423, DELAM: 2.98, STRENGTH: 1.167, PRINT: 1.828, CRACK: 0.778 },
  totalScrapPct: 10.18,
  totalScrapKg: 100.4,
  scrapCost: 5351,
  currency: "INR",
  primaryDefect: "WARP",
};
const optimizedRisk = {
  ratesPct: { WARP: 3.42, DELAM: 2, STRENGTH: 1, PRINT: 1, CRACK: 0.5 },
  totalScrapPct: 7.92,
  totalScrapKg: 80,
  scrapCost: 4000,
  currency: "INR",
  primaryDefect: "WARP",
};
const optimization = {
  baseline: { levers: planned, risk: prediction },
  best: {
    levers: { ...planned, rollTempC: 170, gumApplication: "MED", gumViscositySec: 35 },
    risk: optimizedRisk,
  },
  changes: [],
  savings: { kg: 20.4, inr: 1351 },
};
const historicalEvidence = [{
  lotId: "LOT-1",
  orderId: "PO-HIST-1",
  runDate: "2026-09-20",
  itemCode: "PKBX0041",
  description: "B1047",
  shift: "DAY",
  ambientRhPct: 86,
  paperType: "RECYCLED",
  paperSupplier: "SUP-D",
  levers: planned,
  totalScrapPct: 8.85,
  totalScrapKg: 85.2,
  scrapCost: 3834,
  currency: "INR",
  primaryDefect: "WARP",
  distance: 0.12,
  operatorNote: "Operator note",
}];
const explanationColumns = [
  "defect", "predicted_pct", "typical_pct", "driver_rank", "driver", "attribution_pts",
];
const explanationRows = [
  ["WARP", "3.42", "1.35", "1", "ambient_rh_pct", "0.9"],
  ["DELAM", "2", "1.1", "1", "gum_application", "0.4"],
  ["STRENGTH", "1", "0.7", "1", "pasting_pressure", "0.2"],
  ["PRINT", "1", "0.6", "1", "ink_colors", "0.1"],
  ["CRACK", "0.5", "0.3", "1", "drying_hours", "0.2"],
];
const similarColumns = [
  "lot_id", "order_id", "run_date", "item_code", "description", "shift",
  "ambient_rh_pct", "paper_type", "paper_supplier", "sf_speed_mpm", "roll_temp_c",
  "gum_application", "gum_viscosity_sec", "pasting_pressure", "drying_hours",
  "print_speed_spm", "total_scrap_pct", "total_scrap_kg", "scrap_cost",
  "currency", "primary_defect", "distance", "operator_note",
];
function bigqueryResult(columns, values) {
  return {
    schema: { fields: columns.map((name) => ({ name })) },
    rows: values.map((row) => ({ f: row.map((value) => ({ v: value })) })),
  };
}

test("similar-runs query binds only its two named inputs and preserves SQL evidence", async () => {
  let request;
  const service = createSimilarRunsService({
    bigquery: {
      query: async (value) => {
        request = value;
        return bigqueryResult(similarColumns, [[
          "LOT-1", "PO-1", "2026-09-20", "PKBX0041", "B1047", "DAY", "86",
          "RECYCLED", "SUP-D", "48", "170", "MED", "35", "MED", "5", "60",
          "8.85", "85.2", "3834", "INR", "WARP", "0.12", "Operator note",
        ]]);
      },
    },
    sql: query("similar_runs.sql"),
  });
  const result = await service({ order, conditions });

  assert.deepEqual(request.parameters, {
    item_code: "PKBX0041",
    ambient_rh_pct: { type: "FLOAT64", value: 86 },
  });
  assert.equal(request.sql, query("similar_runs.sql"));
  assert.match(request.sql, /WHERE l\.ply = t\.ply AND l\.flute_profile = t\.flute_profile/);
  assert.match(request.sql, /ORDER BY c\.distance, c\.run_date DESC\s+LIMIT 5/);
  assert.equal(result.ok, true);
  assert.equal(result.evidence[0].totalScrapPct, 8.85);
  assert.equal(result.evidence[0].levers.gumApplication, "MED");
  assert.equal(result.evidence[0].operatorNote, "Operator note");
  assert.equal("ratesPct" in result.evidence[0], false);
});

test("similar-runs query fails closed on a result schema mismatch", async () => {
  const service = createSimilarRunsService({
    bigquery: { query: async () => bigqueryResult(["wrong"], []) },
    sql: query("similar_runs.sql"),
  });
  assert.equal((await service({ order, conditions })).error.code, "SERVICE_UNAVAILABLE");
});

test("similar-runs preserves an empty result and rejects malformed historical rows", async () => {
  const emptyService = createSimilarRunsService({
    bigquery: { query: async () => bigqueryResult(similarColumns, []) },
    sql: query("similar_runs.sql"),
  });
  assert.deepEqual(await emptyService({ order, conditions }), {
    ok: true,
    agent: "findSimilarRuns",
    source: "bigquery",
    evidence: [],
  });

  const invalidRow = [
    "LOT-1", "PO-1", "2026-09-31", "PKBX0041", "B1047", "UNKNOWN", "86",
    "RECYCLED", "SUP-D", "48", "170", "MED", "35", "MED", "5", "60",
    "8.85", "85.2", "3834", "INR", "WARP", "0.12", "Operator note",
  ];
  const invalidService = createSimilarRunsService({
    bigquery: { query: async () => bigqueryResult(similarColumns, [invalidRow]) },
    sql: query("similar_runs.sql"),
  });
  assert.equal((await invalidService({ order, conditions })).ok, false);
});

test("explanation links attribution to the prediction, optimizer best settings and historical evidence", async () => {
  let queryRequest;
  let geminiRequest;
  const service = createRiskExplanationService({
    bigquery: {
      query: async (value) => {
        queryRequest = value;
        return bigqueryResult(explanationColumns, explanationRows);
      },
    },
    gemini: {
      generateContent: async (value) => {
        geminiRequest = value;
        return { parts: [{ text: "Humidity at 86% is a leading risk driver. WARP is predicted at 3.42%, compared with a typical 1.35%. The positive 0.9-point attribution indicates elevated risk under these conditions." }] };
      },
    },
    sql: query("explain.sql"),
  });
  const result = await service({
    order,
    conditions,
    prediction,
    optimization,
    evidence: historicalEvidence,
  });

  assert.equal(result.ok, true);
  assert.equal(queryRequest.parameters.roll_temp_c.value, 170);
  assert.equal(queryRequest.parameters.gum_application, "MED");
  assert.equal(queryRequest.parameters.ambient_rh_pct.type, "FLOAT64");
  assert.equal(geminiRequest.tools, undefined);
  assert.equal(geminiRequest.maxOutputTokens, 8192);
  assert.equal(result.rows[0].driver, "ambient_rh_pct");
  assert.match(geminiRequest.contents[0].parts[0].text, /historicalEvidence/);
  assert.match(geminiRequest.contents[0].parts[0].text, /not as proof of cause and effect/);
  assert.deepEqual(result.evidenceRefs, [{ lotId: "LOT-1", orderId: "PO-HIST-1", runDate: "2026-09-20" }]);

  const unsupported = createRiskExplanationService({
    bigquery: {
      query: async () => bigqueryResult(explanationColumns, explanationRows),
    },
    gemini: {
      generateContent: async () => ({
        parts: [{ text: "Humidity increases the risk. WARP is predicted at 3.42%. The savings are 781 rupees." }],
      }),
    },
    sql: query("explain.sql"),
  });
  const rejected = await unsupported({
    order,
    conditions,
    prediction,
    optimization,
    evidence: historicalEvidence,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "SERVICE_UNAVAILABLE");

  // A provider answer cut off at the token limit fails closed, never reaching the evidence checks.
  const truncated = createRiskExplanationService({
    bigquery: { query: async () => bigqueryResult(explanationColumns, explanationRows) },
    gemini: { generateContent: async () => { throw new VertexGeminiError("VERTEX_OUTPUT_TRUNCATED", "Vertex AI stopped at the output token limit."); } },
    sql: query("explain.sql"),
  });
  const cutOff = await truncated({ order, conditions, prediction, optimization, evidence: historicalEvidence });
  assert.equal(cutOff.ok, false);
  assert.equal(cutOff.error.code, "SERVICE_UNAVAILABLE");
});

test("explanation fails closed when evidence or prediction linkage is invalid", async () => {
  let modelCalls = 0;
  const service = createRiskExplanationService({
    bigquery: { query: async () => bigqueryResult(explanationColumns, explanationRows) },
    gemini: {
      generateContent: async () => {
        modelCalls += 1;
        return { parts: [{ text: "Humidity at 86% changes risk. WARP is predicted at 3.42%. Attribution is positive at 0.9 points." }] };
      },
    },
    sql: query("explain.sql"),
  });
  const missingEvidence = await service({ order, conditions, prediction, optimization });
  assert.equal(missingEvidence.ok, false);

  const malformedEvidence = await service({
    order, conditions, prediction, optimization, evidence: [{ lotId: "unvalidated" }],
  });
  assert.equal(malformedEvidence.ok, false);

  const mismatchedPrediction = await service({
    order,
    conditions,
    prediction: { ...prediction, ratesPct: { ...prediction.ratesPct, WARP: 4 } },
    optimization,
    evidence: historicalEvidence,
  });
  assert.equal(mismatchedPrediction.ok, false);
  assert.equal(modelCalls, 0);
});

test("explanation rejects malformed attribution and a prediction for another best result", async () => {
  const invalidRows = explanationRows.map((row) => [...row]);
  invalidRows[0][4] = "unrecognized_feature";
  const invalidAttribution = createRiskExplanationService({
    bigquery: { query: async () => bigqueryResult(explanationColumns, invalidRows) },
    gemini: { generateContent: async () => ({ parts: [{ text: "unused" }] }) },
    sql: query("explain.sql"),
  });
  assert.equal((await invalidAttribution({
    order, conditions, prediction, optimization, evidence: historicalEvidence,
  })).ok, false);

  const mismatchedRows = explanationRows.map((row) => [...row]);
  mismatchedRows[0][1] = "4";
  const mismatchedAttribution = createRiskExplanationService({
    bigquery: { query: async () => bigqueryResult(explanationColumns, mismatchedRows) },
    gemini: { generateContent: async () => ({ parts: [{ text: "unused" }] }) },
    sql: query("explain.sql"),
  });
  assert.equal((await mismatchedAttribution({
    order, conditions, prediction, optimization, evidence: historicalEvidence,
  })).ok, false);

  const missingDefect = createRiskExplanationService({
    bigquery: { query: async () => bigqueryResult(explanationColumns, explanationRows.slice(0, -1)) },
    gemini: { generateContent: async () => ({ parts: [{ text: "unused" }] }) },
    sql: query("explain.sql"),
  });
  assert.equal((await missingDefect({
    order, conditions, prediction, optimization, evidence: historicalEvidence,
  })).ok, false);
});

test("explanation rejects generated causal claims about attribution", async () => {
  for (const text of [
    "Humidity at 86% causes WARP risk. WARP is predicted at 3.42%. A positive 0.9-point attribution is present.",
    "Humidity at 86% increases the predicted WARP rate. WARP is predicted at 3.42%. A positive 0.9-point attribution is present.",
  ]) {
    const service = createRiskExplanationService({
      bigquery: { query: async () => bigqueryResult(explanationColumns, explanationRows) },
      gemini: { generateContent: async () => ({ parts: [{ text }] }) },
      sql: query("explain.sql"),
    });
    const result = await service({
      order, conditions, prediction, optimization, evidence: historicalEvidence,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  }
});

test("seen-before validates the recognized defect and maps historical aggregates", async () => {
  let request;
  const leverFields = [
    ["lots", "INT64", "12"], ["avg_rate_pct", "FLOAT64", "1.1"],
    ["sf_speed_mpm", "FLOAT64", "40.8"], ["roll_temp_c", "FLOAT64", "169"],
    ["gum_application", "STRING", "MED"], ["gum_viscosity_sec", "FLOAT64", "40.7"],
    ["pasting_pressure", "STRING", "MED"], ["drying_hours", "FLOAT64", "5"],
    ["print_speed_spm", "FLOAT64", "60"],
  ];
  const service = createSeenBeforeService({
    bigquery: {
      query: async (value) => {
        request = value;
        return {
          schema: {
            fields: [
              { name: "defect", type: "STRING" },
              { name: "n_cases", type: "INT64" },
              { name: "avg_rate_when_main", type: "FLOAT64" },
              { name: "cost_when_main", type: "FLOAT64" },
              {
                name: "good_runs",
                type: "RECORD",
                fields: leverFields.map(([name, type]) => ({ name, type })),
              },
              {
                name: "bad_runs",
                type: "RECORD",
                fields: leverFields.map(([name, type]) => ({ name, type })),
              },
              { name: "notes", type: "STRING", mode: "REPEATED" },
            ],
          },
          rows: [{
            f: [
              { v: "DELAM" }, { v: "775" }, { v: "2.81" }, { v: "280063" },
              { v: { f: leverFields.map(([, , value]) => ({ v: value })) } },
              { v: null },
              { v: [{ v: "Use medium gum." }] },
            ],
          }],
        };
      },
    },
    sql: query("seen_before.sql"),
  });
  const signal = new AbortController().signal;
  const result = await service({ defect: "DELAM", ambientRhPct: 86, signal });

  assert.deepEqual(request.parameters, {
    defect: "DELAM",
    ambient_rh_pct: { type: "FLOAT64", value: 86 },
  });
  assert.equal(request.signal, signal);
  assert.equal(result.ok, true);
  assert.equal(result.caseCount, 775);
  assert.equal(result.avgRateWhenMain, 2.81);
  assert.equal(result.costWhenMain, 280063);
  assert.equal(result.goodRuns.gumApplication, "MED");
  assert.equal(result.badRuns, null);
  assert.deepEqual(result.notes, ["Use medium gum."]);
  assert.equal((await service({ defect: "NONE", ambientRhPct: 86 })).ok, false);
});

test("explanation grounds original change values against the exact supplied prompt", async () => {
  const service = createRiskExplanationService({
    bigquery: { query: async () => bigqueryResult(explanationColumns, explanationRows) },
    gemini: { generateContent: async () => ({ parts: [{ text:
      "The reviewed roll temperature changes from 162 to 170, while gum viscosity changes from 32 to 35. WARP is predicted at 3.42%. These model predictions are not proof of cause and effect."
    }] }) },
    sql: query("explain.sql"),
  });
  const result = await service({ order, conditions, prediction, optimization: {
    ...optimization,
    changes: [
      { lever: "rollTempC", from: 162, to: 170, reason: "Lowest modeled cost candidate." },
      { lever: "gumViscositySec", from: 32, to: 35, reason: "Lowest modeled cost candidate." },
    ],
  }, evidence: [] });
  assert.equal(result.ok, true);
});

test("explanation rejects assertions that source records are verified real-world outcomes", async () => {
  for (const text of [
    "WARP is predicted at 3.42%. The source records represent actual observed outcomes. Attribution is an association.",
    "Humidity at 86% is resulting in WARP risk. WARP is predicted at 3.42%. Attribution is an association.",
  ]) {
    const service = createRiskExplanationService({
      bigquery: { query: async () => bigqueryResult(explanationColumns, explanationRows) },
      gemini: { generateContent: async () => ({ parts: [{ text }] }) },
      sql: query("explain.sql"),
    });
    const result = await service({ order, conditions, prediction, optimization, evidence: historicalEvidence });
    assert.equal(result.ok, false);
  }
});
