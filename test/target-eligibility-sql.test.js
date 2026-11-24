import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const TARGETS = ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"];

function executable(name) {
  return readFileSync(new URL(`../sql/${name}`, import.meta.url), "utf8").replace(/--[^\n]*/g, "");
}

// Removes every allowed use of r_<target>; anything left means a rate reaches a
// total, a cost or the primary defect without passing through its use-class gate.
function ungatedRateUses(sql, allowed) {
  let rest = sql;
  for (const pattern of allowed) rest = rest.replace(pattern, " ");
  return TARGETS.flatMap((target) => rest.match(new RegExp(`\\br_${target.toLowerCase()}\\b`, "g")) ?? []);
}

function assertGateFlags(sql) {
  for (const target of TARGETS) {
    assert.match(sql, new RegExp(`'${target}' IN UNNEST\\(@optimizer_targets\\) AS u_${target.toLowerCase()}`),
      `${target} is gated by the bound @optimizer_targets parameter`);
  }
}

const gatePatterns = TARGETS.flatMap((target) => {
  const key = target.toLowerCase();
  return [
    new RegExp(`IF\\(e\\.u_${key}, r_${key}, 0\\)`, "g"),
    new RegExp(`IF\\(e\\.u_${key}, r_${key}, -1\\) AS k_${key}`, "g"),
    new RegExp(`ROUND\\(r_${key}, 3\\) AS rate_${key}_pct`, "g"),
  ];
});

test("optimize.sql counts only optimizer targets in the objective, totals and primary defect", () => {
  const sql = executable("optimize.sql");
  assertGateFlags(sql);
  const ungated = ungatedRateUses(sql, [
    ...gatePatterns,
    /GREATEST\(pw\.v, 0\) AS r_warp, GREATEST\(pd\.v, 0\) AS r_delam, GREATEST\(ps\.v, 0\) AS r_strength,/,
    /IF\(g\.ink_colors = 0, 0, GREATEST\(pp\.v, 0\)\) AS r_print, GREATEST\(pc\.v, 0\) AS r_crack,/,
  ]);
  assert.deepEqual(ungated, []);
  assert.match(sql, /quantity \* box_weight_kg \* total_pct \/ 100 \* pl\.cost_per_kg AS scrap_cost/);
  assert.match(sql, /CASE GREATEST\(k_warp, k_delam, k_strength, k_print, k_crack\)/);
  assert.match(sql, /ROUND\(scrap_cost \+ penalty, 0\) AS total_cost/);
  assert.match(sql, /ORDER BY total_cost, n_changes,/);
});

test("predict.sql totals and primary defect cover only optimizer targets and still return every rate", () => {
  const sql = executable("predict.sql");
  assertGateFlags(sql);
  const ungated = ungatedRateUses(sql, [
    ...gatePatterns,
    /GREATEST\(w\.v, 0\) AS r_warp|GREATEST\(d\.v, 0\) AS r_delam|GREATEST\(st\.v, 0\) AS r_strength/g,
    /IF\(i\.ink_colors = 0, 0, GREATEST\(p\.v, 0\)\) AS r_print|GREATEST\(c\.v, 0\) AS r_crack/g,
    /MAX\(IF\(rh_scenario = 'CENTRAL', r_\w+, NULL\)\) AS r_\w+/g,
    /MIN\(r_\w+\) AS \w+_low, MAX\(r_\w+\) AS \w+_high/g,
  ]);
  assert.deepEqual(ungated, []);
  assert.match(sql, /ROUND\(counted_pct, 2\) AS total_scrap_pct/);
  assert.match(sql, /ROUND\(quantity \* box_weight_kg \* counted_pct \/ 100 \* pl\.cost_per_kg, 0\) AS scrap_cost/);
  // The per-defect fallback and the humidity sweep reuse everything before `w  AS (`; the gate must stay after it.
  const raw = readFileSync(new URL("../sql/predict.sql", import.meta.url), "utf8");
  assert.ok(raw.indexOf("@optimizer_targets", raw.indexOf("\nw  AS (")) > 0);
  assert.equal(raw.slice(0, raw.indexOf("\nw  AS (")).replace(/--[^\n]*/g, "").includes("@optimizer_targets"), false);
});

test("no query spells out the target set; it always arrives as the bound parameter", () => {
  for (const name of ["optimize.sql", "predict.sql"]) {
    const sql = executable(name);
    assert.doesNotMatch(sql, /\[\s*'(?:WARP|DELAM|STRENGTH|PRINT|CRACK)'/, `${name} has no literal target list`);
    assert.doesNotMatch(sql, /\{\{|\$\{/, `${name} has no template placeholders`);
  }
});
