import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseJsonl } from "../tools/ml/lot-files.mjs";
import { fitBandMeans, predictHoldout, rhBand } from "../tools/ml/naive-reference.mjs";

const NAIVE = fileURLToPath(new URL("../tools/ml/naive-reference.mjs", import.meta.url));
const EVALUATE = fileURLToPath(new URL("../tools/ml/evaluate.mjs", import.meta.url));

function file(name, rows) {
  return { name, path: `${name}.jsonl`, sha256: `sha-${name}`, entries: parseJsonl(rows.map((row) => JSON.stringify(row)).join("\n"), name) };
}

// Eight training lots, two per band. Lots on an edge (50 and 85) belong to the lower band,
// as in sql/model_v2_training.sql.
const TRAIN = [
  [40, 1, 0.1], [50, 3, 0.3],
  [60, 2, 0.2], [70, 4, 0.6],
  [80, 5, 0.5], [85, 7, 0.9],
  [90, 8, 1.0], [98, 10, 1.4],
].map(([rh, warp, crack], index) => ({ lotId: `T${index + 1}`, unit: "pp", split: "train", source: "generated", ambientRhPct: rh, rates: { WARP: warp, CRACK: crack } }));

const HOLDOUT = [50, 50.1, 85, 85.5].map((rh, index) => ({ lotId: `H${index + 1}`, unit: "pp", split: "holdout", source: "generated", ambientRhPct: rh, rates: { WARP: 100, CRACK: 100 } }));

test("RH bands use the training SQL edges", () => {
  assert.deepEqual([0, 50, 50.01, 70, 70.5, 85, 85.01, 100].map(rhBand), [
    "RH_LE50", "RH_LE50", "RH_50_70", "RH_50_70", "RH_70_85", "RH_70_85", "RH_GT85", "RH_GT85",
  ]);
});

test("the reference predicts each holdout lot's training band mean and never reads holdout labels", () => {
  const fit = fitBandMeans(file("train", TRAIN), ["WARP", "CRACK"]);
  assert.equal(fit.bands.RH_LE50.trainingLots, 2);
  // Band means: WARP (1+3)/2, (2+4)/2, (5+7)/2, (8+10)/2.
  const predictions = predictHoldout(fit, file("holdout", HOLDOUT));
  assert.deepEqual(predictions.map((row) => [row.lotId, row.rhBand, row.rates.WARP]), [
    ["H1", "RH_LE50", 2],
    ["H2", "RH_50_70", 3],
    ["H3", "RH_70_85", 6],
    ["H4", "RH_GT85", 9],
  ]);
  assert.ok(Math.abs(predictions[3].rates.CRACK - 1.2) < 1e-12);
  for (const row of predictions) {
    assert.equal(row.unit, "pp");
    assert.equal(row.provenance, "model_estimate");
  }
});

test("refuses a holdout lot that is also in the training file", () => {
  const fit = fitBandMeans(file("train", TRAIN), ["WARP"]);
  assert.throws(() => predictHoldout(fit, file("holdout", [...HOLDOUT, { lotId: "T3", ambientRhPct: 60 }])), { code: "LEAKAGE", message: /T3/ });
});

test("refuses a holdout lot whose band has no training lots", () => {
  const fit = fitBandMeans(file("train", TRAIN.filter((row) => row.ambientRhPct <= 85)), ["WARP"]);
  assert.equal(fit.bands.RH_GT85.means, null);
  assert.throws(() => predictHoldout(fit, file("holdout", HOLDOUT)), { code: "EMPTY_BAND", message: /lot H4 is in RH_GT85/ });
});

test("refuses training rows with a bad RH, unit or label", () => {
  const noRh = TRAIN.map((row, index) => (index === 0 ? { ...row, ambientRhPct: undefined } : row));
  assert.throws(() => fitBandMeans(file("train", noRh), ["WARP"]), { code: "MISSING_RH" });
  const highRh = TRAIN.map((row, index) => (index === 0 ? { ...row, ambientRhPct: 140 } : row));
  assert.throws(() => fitBandMeans(file("train", highRh), ["WARP"]), { code: "RH_OUT_OF_RANGE" });
  const fraction = TRAIN.map((row, index) => (index === 0 ? { ...row, unit: "fraction" } : row));
  assert.throws(() => fitBandMeans(file("train", fraction), ["WARP"]), { code: "UNIT_MISMATCH" });
  assert.throws(() => fitBandMeans(file("train", TRAIN), ["WARP", "PRINT"]), { code: "MISSING_LABEL", message: /no PRINT rate/ });
});

test("the command output feeds the evaluator as the naive file", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "arc-ml-naive-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const write = (name, rows) => {
    writeFileSync(join(dir, name), rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
    return join(dir, name);
  };
  const holdout = HOLDOUT.map((row, index) => ({ ...row, rates: { WARP: [2, 3, 6, 9][index] + 0.5, CRACK: 1 } }));
  const train = write("train.jsonl", TRAIN);
  const labels = write("holdout.jsonl", holdout);
  const naivePath = join(dir, "naive.jsonl");
  const fitted = spawnSync(process.execPath, [NAIVE, "--train", train, "--holdout", labels, "--out", naivePath, "--targets", "WARP"], { encoding: "utf8" });
  assert.equal(fitted.status, 0, fitted.stderr);
  assert.equal(JSON.parse(fitted.stdout).bands.RH_GT85.means.WARP, 9);
  assert.equal(readFileSync(naivePath, "utf8").trim().split("\n").length, 4);

  const predictions = write("model.jsonl", holdout.map(({ lotId, rates }) => ({ lotId, unit: "pp", rates: { WARP: rates.WARP } })));
  const out = join(dir, "report.json");
  const scored = spawnSync(process.execPath, [
    EVALUATE, "--labels", labels, "--candidate", predictions, "--incumbent", predictions, "--naive", naivePath,
    "--model-id", "m", "--dataset-id", "d", "--split-id", "s", "--targets", "WARP", "--out", out,
  ], { encoding: "utf8" });
  assert.equal(scored.status, 0, scored.stderr);
  // Every holdout rate sits 0.5 above its band mean, so the naive reference is off by -0.5 on each lot.
  const naiveRow = JSON.parse(readFileSync(out, "utf8")).rows.find((row) => row.role === "naive");
  assert.equal(naiveRow.maePp, 0.5);
  assert.equal(naiveRow.biasPp, -0.5);

  const leaked = spawnSync(process.execPath, [NAIVE, "--train", train, "--holdout", train, "--out", naivePath, "--targets", "WARP,CRACK"], { encoding: "utf8" });
  assert.equal(leaked.status, 1);
  assert.match(leaked.stderr, /^naive-reference: LEAKAGE: /);
});
