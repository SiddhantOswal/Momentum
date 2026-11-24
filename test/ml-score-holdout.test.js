import assert from "node:assert/strict";
import test from "node:test";
import { buildQuery, INPUT_COLUMNS, labelRows, lotsParameter, MODEL_SETS } from "../tools/ml/score-holdout.mjs";

const lot = Object.fromEntries(INPUT_COLUMNS.map(([name, type]) => [name, type === "STRING" ? `${name}-x` : 1.5]));
Object.assign(lot, {
  lot_id: "HLD-000001", dataset: "holdout-2026-10-11", label: "generated", ambient_rh_pct: 61.4,
  rate_warp_pct: 2.687, rate_delam_pct: 1.075, rate_strength_pct: 0.772, rate_print_pct: 4.145, rate_crack_pct: 0.79,
});

test("the query reads every target model of one set and nothing from a table", () => {
  const sql = buildQuery("prepagent", MODEL_SETS.m2);
  for (const name of ["warp", "delam", "strength", "print", "crack"]) {
    assert.match(sql, new RegExp(`MODEL \`prepagent\\.m2_${name}\``));
  }
  assert.doesNotMatch(sql, /m_warp/);
  assert.match(sql, /FROM UNNEST\(@lots\)/);
  assert.doesNotMatch(sql, /prepagent\.lots|INSERT|CREATE|MERGE|UPDATE|DELETE/i);
});

test("labels never reach the model input", () => {
  const names = INPUT_COLUMNS.map(([name]) => name);
  for (const forbidden of ["rate_warp_pct", "rate_delam_pct", "rate_strength_pct", "rate_print_pct", "rate_crack_pct", "total_scrap_kg", "scrap_cost", "primary_defect"]) {
    assert.equal(names.includes(forbidden), false, forbidden);
  }
  const parameter = lotsParameter([lot]);
  assert.deepEqual(Object.keys(parameter.parameterValue.arrayValues[0].structValues), names);
});

test("a lot with a missing input is refused, not sent with a gap", () => {
  const { box_style: _dropped, ...partial } = lot;
  assert.throws(() => lotsParameter([partial]), /box_style is missing/);
});

test("labels keep the generated source and the percentage-point unit", () => {
  const [row] = labelRows([lot]);
  assert.equal(row.source, "generated");
  assert.equal(row.unit, "pp");
  assert.equal(row.split, "holdout-2026-10-11");
  assert.deepEqual(row.rates, { WARP: 2.687, DELAM: 1.075, STRENGTH: 0.772, PRINT: 4.145, CRACK: 0.79 });
});
