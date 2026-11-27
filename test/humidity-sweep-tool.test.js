import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  analyzeSweep,
  bqParameterArgs,
  buildSweepSql,
  DEFAULT_ABRUPT_JUMP_PP,
  MAX_BYTES_BILLED,
  parseBqRows,
} from "../tools/humidity-sweep.mjs";

// Fixed test data: WARP rises smoothly, DELAM has one 1.5-point step at 70 -> 75.
const points = [40, 45, 50, 55, 60, 65, 70, 75, 80].map((rhPct, index) => ({
  rhPct,
  WARP: 1 + index * 0.2,
  DELAM: rhPct >= 75 ? 3.5 : 2,
  STRENGTH: 1,
  PRINT: 1.8 - (rhPct === 60 ? 0.3 : 0),
  CRACK: 0.7,
}));

test("sweep analysis finds the largest adjacent jump per defect and flags only abrupt steps", () => {
  const analysis = analyzeSweep([...points].reverse());
  assert.equal(analysis.abruptJumpPp, DEFAULT_ABRUPT_JUMP_PP);
  assert.deepEqual(analysis.defects.WARP.largestJump.jumpPp, 0.2);
  assert.equal(analysis.defects.WARP.abrupt, false);
  assert.equal(analysis.defects.WARP.rangePp, 1.6);
  assert.deepEqual(analysis.defects.DELAM.largestJump, { fromRhPct: 70, toRhPct: 75, jumpPp: 1.5, signedJumpPp: 1.5 });
  assert.equal(analysis.defects.DELAM.jumpShareOfRange, 1);
  assert.equal(analysis.defects.DELAM.abrupt, true);
  assert.deepEqual(analysis.defects.STRENGTH.largestJump, { fromRhPct: 40, toRhPct: 45, jumpPp: 0, signedJumpPp: 0 });
  assert.equal(analysis.defects.STRENGTH.jumpShareOfRange, 0);
  // A dip is measured in both directions; the first of equal jumps is kept.
  assert.deepEqual(analysis.defects.PRINT.largestJump, { fromRhPct: 55, toRhPct: 60, jumpPp: 0.3, signedJumpPp: -0.3 });
  assert.deepEqual(analysis.abruptDefects, ["DELAM"]);
  assert.equal(analysis.anyAbrupt, true);

  const strict = analyzeSweep(points, { abruptJumpPp: 0.1 });
  assert.deepEqual(strict.abruptDefects, ["WARP", "DELAM", "PRINT"]);
  assert.throws(() => analyzeSweep(points.slice(0, 1)), /two sweep points/);
});

test("bq rows are parsed into numeric sweep points", () => {
  const parsed = parseBqRows([{ rh_pct: "40.0", rate_warp: "1.525", rate_delam: "1.923", rate_strength: "0.7146", rate_print: "1.9057", rate_crack: "0.6262" }]);
  assert.deepEqual(parsed, [{ rhPct: 40, WARP: 1.525, DELAM: 1.923, STRENGTH: 0.7146, PRINT: 1.9057, CRACK: 0.6262 }]);
  assert.throws(() => parseBqRows([]), /no rows/);
  assert.throws(() => parseBqRows([{ rh_pct: "40" }]), /non-numeric/);
});

test("sweep SQL reuses predict.sql's model inputs with the RH grid and a bounded, PO1-only parameter set", () => {
  const predictSql = readFileSync(new URL("../sql/predict.sql", import.meta.url), "utf8");
  const sql = buildSweepSql(predictSql);
  assert.match(sql, /GENERATE_ARRAY\(40, 95, 5\)/);
  assert.equal(sql.includes("@ambient_rh_pct AS FLOAT64"), false);
  assert.equal((sql.match(/ML\.PREDICT\(MODEL/g) ?? []).length, 5);
  assert.ok(sql.includes(predictSql.slice(predictSql.indexOf("\ninput AS ("), predictSql.indexOf("\nw  AS ("))));
  assert.equal(/\b(INSERT|UPDATE|DELETE|MERGE|CREATE|DROP)\b/i.test(sql.replace(/--[^\n]*/g, "")), false);
  assert.ok(MAX_BYTES_BILLED <= 80 * 1024 * 1024);
  const args = bqParameterArgs();
  assert.ok(args.includes("--parameter=item_code:STRING:PKBX0041"));
  assert.ok(args.includes("--parameter=paper_moisture_pct:FLOAT64:10.8"));
  assert.equal(args.some((arg) => arg.includes("ambient_rh_pct")), false);
  assert.throws(() => buildSweepSql("-- predict.sql\nSELECT 1"), /structure this sweep expects/);
});

// docs/evidence/ is git-ignored, so this check runs only where the recorded sweep exists.
const evidenceUrl = new URL("../docs/evidence/humidity-sweep.json", import.meta.url);
test("the recorded sweep evidence matches the analysis of its own points", { skip: !existsSync(evidenceUrl) }, () => {
  const evidence = JSON.parse(readFileSync(evidenceUrl, "utf8"));
  assert.equal(evidence.points.length, 12);
  assert.deepEqual(evidence.points.map((point) => point.rhPct), [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95]);
  assert.deepEqual(analyzeSweep(evidence.points), evidence.analysis);
});
