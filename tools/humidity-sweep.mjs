// Humidity sweep: predicts all five defects for one item across ambient RH
// 40 -> 95 %RH (step 5) in ONE read-only BigQuery ML query, with every other
// input fixed, and reports the largest jump between adjacent steps per defect.
// It reuses predict.sql's spec/input/ML.PREDICT CTEs so the sweep exercises the
// same model inputs the service sends.
//
// Usage: node tools/humidity-sweep.mjs --run [--output docs/evidence/humidity-sweep.json]
// Without --run it prints the SQL and parameters only (no cloud call).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

export const DEFECTS = Object.freeze(["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"]);
export const SWEEP = Object.freeze({ fromPct: 40, toPct: 95, stepPct: 5 });
// A 5-point RH step that moves one defect's predicted scrap rate by more than
// this many percentage points is reported as abrupt.
export const DEFAULT_ABRUPT_JUMP_PP = 1.0;
// 80 MiB: the same ceiling the service uses for predict.sql (5 models + item table).
export const MAX_BYTES_BILLED = 80 * 1024 * 1024;

// PO1 (TEST-CLA/PO/2026/1047, item PKBX0041 x 1300) acceptance inputs.
export const PO1_INPUTS = Object.freeze({
  item_code: "PKBX0041",
  quantity: 1300,
  paper_type: "RECYCLED",
  paper_supplier: "SUP-D",
  shift: "DAY",
  ambient_temp_c: 26,
  paper_moisture_pct: 10.8,
  sf_speed_mpm: 48,
  roll_temp_c: 162,
  gum_application: "HIGH",
  gum_viscosity_sec: 32,
  pasting_pressure: "MED",
  drying_hours: 5,
  print_speed_spm: 60,
});
const PARAMETER_TYPES = Object.freeze({
  item_code: "STRING", quantity: "INT64", paper_type: "STRING", paper_supplier: "STRING", shift: "STRING",
  ambient_temp_c: "FLOAT64", paper_moisture_pct: "FLOAT64", sf_speed_mpm: "FLOAT64", roll_temp_c: "FLOAT64",
  gum_application: "STRING", gum_viscosity_sec: "FLOAT64", pasting_pressure: "STRING", drying_hours: "FLOAT64",
  print_speed_spm: "FLOAT64",
});

/** Rewrites predict.sql so its rh_scenarios CTE becomes the sweep grid and it returns one row per RH. */
export function buildSweepSql(predictSql, sweep = SWEEP) {
  const scenarioStart = predictSql.indexOf("rh_scenarios AS (");
  const inputStart = predictSql.indexOf("\ninput AS (");
  const ratesStart = predictSql.indexOf("\n-- One pass over the three rows");
  if (scenarioStart < 0 || inputStart < scenarioStart || ratesStart < inputStart ||
      !predictSql.includes("scenario_rates AS (")) {
    throw new Error("predict.sql no longer has the rh_scenarios/input/scenario_rates structure this sweep expects.");
  }
  for (const value of [sweep.fromPct, sweep.toPct, sweep.stepPct]) {
    if (!Number.isInteger(value) || value <= 0 || value > 100) throw new Error("Sweep bounds must be integers in 1..100.");
  }
  const grid = `rh_scenarios AS (
  SELECT FORMAT('RH_%d', v) AS rh_scenario, CAST(v AS FLOAT64) AS rh
  FROM UNNEST(GENERATE_ARRAY(${sweep.fromPct}, ${sweep.toPct}, ${sweep.stepPct})) AS v
),`;
  const body = predictSql.slice(inputStart, ratesStart).replace(/,\s*$/, "");
  return `-- humidity-sweep: predict.sql inputs and models, RH ${sweep.fromPct}..${sweep.toPct} step ${sweep.stepPct}
${predictSql.slice(0, scenarioStart)}${grid}${body}
SELECT
  ambient_rh_pct AS rh_pct,
  ROUND(r_warp, 4) AS rate_warp,
  ROUND(r_delam, 4) AS rate_delam,
  ROUND(r_strength, 4) AS rate_strength,
  ROUND(r_print, 4) AS rate_print,
  ROUND(r_crack, 4) AS rate_crack
FROM scenario_rates
ORDER BY rh_pct
`;
}

export function bqParameterArgs(inputs = PO1_INPUTS) {
  return Object.entries(inputs).map(([name, value]) => `--parameter=${name}:${PARAMETER_TYPES[name]}:${value}`);
}

/** Converts bq --format=json rows into [{ rhPct, WARP, ... }]. */
export function parseBqRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("The sweep query returned no rows.");
  return rows.map((row) => {
    const point = { rhPct: Number(row.rh_pct) };
    for (const defect of DEFECTS) point[defect] = Number(row[`rate_${defect.toLowerCase()}`]);
    if (!Object.values(point).every(Number.isFinite)) throw new Error("The sweep query returned a non-numeric value.");
    return point;
  });
}

/**
 * For each defect: the largest absolute change between adjacent RH steps,
 * where it happens, the defect's overall range, and whether the jump is abrupt.
 */
export function analyzeSweep(points, { abruptJumpPp = DEFAULT_ABRUPT_JUMP_PP } = {}) {
  if (!Array.isArray(points) || points.length < 2) throw new Error("At least two sweep points are required.");
  const sorted = [...points].sort((a, b) => a.rhPct - b.rhPct);
  const defects = {};
  for (const defect of DEFECTS) {
    let largest = { fromRhPct: sorted[0].rhPct, toRhPct: sorted[1].rhPct, jumpPp: 0, signedJumpPp: 0 };
    let largestRaw = 0;
    for (let index = 1; index < sorted.length; index += 1) {
      const signed = sorted[index][defect] - sorted[index - 1][defect];
      // Compare rounded jumps so float noise cannot reorder equal steps.
      if (round(Math.abs(signed)) > largestRaw) {
        largestRaw = round(Math.abs(signed));
        largest = {
          fromRhPct: sorted[index - 1].rhPct,
          toRhPct: sorted[index].rhPct,
          jumpPp: round(Math.abs(signed)),
          signedJumpPp: round(signed),
        };
      }
    }
    const values = sorted.map((point) => point[defect]);
    const rangePp = round(Math.max(...values) - Math.min(...values));
    defects[defect] = {
      largestJump: largest,
      minPct: round(Math.min(...values)),
      maxPct: round(Math.max(...values)),
      rangePp,
      jumpShareOfRange: rangePp === 0 ? 0 : round(largest.jumpPp / rangePp),
      abrupt: largest.jumpPp > abruptJumpPp,
    };
  }
  const abruptDefects = DEFECTS.filter((defect) => defects[defect].abrupt);
  return { abruptJumpPp, defects, abruptDefects, anyAbrupt: abruptDefects.length > 0 };
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

function runSweep({ outputFile }) {
  const predictSql = readFileSync(new URL("../sql/predict.sql", import.meta.url), "utf8");
  const sql = buildSweepSql(predictSql);
  const env = {
    ...process.env,
    CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON ?? "/opt/homebrew/opt/python@3.13/bin/python3.13",
  };
  const stdout = execFileSync("bq", [
    "--project_id=prepagent-hack",
    "--location=asia-south1",
    "--format=json",
    "query",
    "--nouse_legacy_sql",
    `--maximum_bytes_billed=${MAX_BYTES_BILLED}`,
    ...bqParameterArgs(),
    // bq parses an argument starting with "--" as a flag, so drop the leading comment lines.
    sql.replace(/^(?:\s*--[^\n]*\n)+/, ""),
  ], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 });
  const points = parseBqRows(JSON.parse(stdout));
  const analysis = analyzeSweep(points);
  const report = {
    kind: "humidity-sweep",
    generatedAt: new Date().toISOString(),
    source: {
      query: "sql/predict.sql spec/input/ML.PREDICT CTEs with the RH rows replaced by the sweep grid (tools/humidity-sweep.mjs)",
      project: "prepagent-hack",
      location: "asia-south1",
      maximumBytesBilled: MAX_BYTES_BILLED,
      models: ["prepagent.m2_warp", "prepagent.m2_delam", "prepagent.m2_strength", "prepagent.m2_print", "prepagent.m2_crack"],
    },
    inputs: { order: "TEST-CLA/PO/2026/1047 (PO1)", ...PO1_INPUTS, ambientRhPct: SWEEP },
    points,
    analysis,
  };
  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output");
  const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : "docs/evidence/humidity-sweep.json";
  if (!args.includes("--run")) {
    const predictSql = readFileSync(new URL("../sql/predict.sql", import.meta.url), "utf8");
    console.log(buildSweepSql(predictSql));
    console.log(bqParameterArgs().join("\n"));
  } else {
    const report = runSweep({ outputFile });
    console.log(JSON.stringify(report.analysis, null, 2));
  }
}
