import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  bootstrapInterval,
  DEFAULT_RESAMPLES,
  DEFAULT_SEED,
  evaluate,
  formatTable,
} from "../tools/ml/evaluate.mjs";
import { parseJsonl } from "../tools/ml/lot-files.mjs";

const EVALUATE = fileURLToPath(new URL("../tools/ml/evaluate.mjs", import.meta.url));
const IDS = { modelId: "m2-test", datasetId: "fixture-4-lots", splitId: "holdout-fixture" };

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${message ?? ""} expected ${expected}, got ${actual}`);
}

function file(name, rows) {
  const text = rows.map((row) => (typeof row === "string" ? row : JSON.stringify(row))).join("\n");
  return { name, path: `${name}.jsonl`, sha256: `sha-${name}`, entries: parseJsonl(text, name) };
}

function labelRows(warp, extra = {}) {
  return warp.map((value, index) => ({ lotId: `L${index + 1}`, unit: "pp", split: "holdout", source: "generated", rates: { WARP: value }, ...extra }));
}

function predictionRows(warp) {
  return warp.map((value, index) => ({ lotId: `L${index + 1}`, unit: "pp", rates: { WARP: value } }));
}

// Four lots, WARP only. Errors are predicted minus actual:
// candidate [0.5, 0, 0, 1], incumbent [1, 0, -1, -2], naive [1.5, 0.5, -0.5, -1.5].
const ACTUAL = [1, 2, 3, 4];
const CANDIDATE = [1.5, 2, 3, 5];
const INCUMBENT = [2, 2, 2, 2];
const NAIVE = [2.5, 2.5, 2.5, 2.5];

function fixture(overrides = {}) {
  return {
    labels: file("labels", labelRows(ACTUAL)),
    predictions: {
      candidate: file("candidate", predictionRows(CANDIDATE)),
      incumbent: file("incumbent", predictionRows(INCUMBENT)),
      naive: file("naive", predictionRows(NAIVE)),
    },
    ...IDS,
    targets: ["WARP"],
    ...overrides,
  };
}

function withPrediction(role, rows) {
  const base = fixture();
  return { ...base, predictions: { ...base.predictions, [role]: file(role, rows) } };
}

function row(report, role, target = "WARP") {
  return report.rows.find((entry) => entry.role === role && entry.target === target);
}

function comparison(report, reference, target = "WARP") {
  return report.comparisons.find((entry) => entry.reference === reference && entry.target === target);
}

test("per-model metrics match the hand-computed values", () => {
  const report = evaluate(fixture());
  // Actual mean 2.5, total sum of squares 2.25 + 0.25 + 0.25 + 2.25 = 5.
  const candidate = row(report, "candidate");
  assert.equal(candidate.lots, 4);
  close(candidate.r2, 1 - 1.25 / 5); // squared errors 0.25 + 0 + 0 + 1
  assert.equal(candidate.r2NullReason, null);
  close(candidate.maePp, 0.375);
  close(candidate.rmsePp, Math.sqrt(0.3125));
  // Sorted absolute errors [0, 0, 0.5, 1]: the median sits halfway between 0 and 0.5,
  // the 90th percentile at position 0.9 * 3 = 2.7, so 0.5 + 0.7 * (1 - 0.5).
  close(candidate.medianAbsErrorPp, 0.25);
  close(candidate.p90AbsErrorPp, 0.85);
  // Positive bias: the candidate over-predicts on average.
  close(candidate.biasPp, 0.375);

  const incumbent = row(report, "incumbent");
  close(incumbent.r2, 1 - 6 / 5);
  close(incumbent.maePp, 1);
  close(incumbent.rmsePp, Math.sqrt(1.5));
  close(incumbent.medianAbsErrorPp, 1);
  close(incumbent.p90AbsErrorPp, 1.7);
  close(incumbent.biasPp, -0.5);

  const naive = row(report, "naive");
  close(naive.r2, 0);
  close(naive.maePp, 1);
  close(naive.rmsePp, Math.sqrt(1.25));
  close(naive.medianAbsErrorPp, 1);
  close(naive.p90AbsErrorPp, 1.5);
  close(naive.biasPp, 0);
});

test("paired deltas are candidate minus reference with an interval inside the per-lot range", () => {
  const report = evaluate(fixture());
  const vsIncumbent = comparison(report, "incumbent");
  assert.equal(vsIncumbent.lots, 4);
  // Per-lot absolute-error differences [-0.5, 0, -1, -1]; squared [-0.75, 0, -1, -3].
  close(vsIncumbent.maeDeltaPp, -0.625);
  close(vsIncumbent.squaredErrorDeltaPp2, -1.1875);
  const vsNaive = comparison(report, "naive");
  // Absolute [-1, -0.5, -0.5, -0.5]; squared [-2, -0.25, -0.25, -1.25].
  close(vsNaive.maeDeltaPp, -0.625);
  close(vsNaive.squaredErrorDeltaPp2, -0.9375);

  const [low, high] = vsIncumbent.maeDeltaCi95Pp;
  assert.ok(low >= -1 && low <= -0.625 && high >= -0.625 && high <= 0, `interval ${low}, ${high}`);
  assert.ok(low < high);
  const [sqLow, sqHigh] = vsNaive.squaredErrorDeltaCi95Pp2;
  assert.ok(sqLow >= -2 && sqLow < sqHigh && sqHigh <= -0.25, `interval ${sqLow}, ${sqHigh}`);
});

test("a constant per-lot difference gives a zero-width interval at that difference", () => {
  const report = evaluate(withPrediction("incumbent", predictionRows(CANDIDATE.map((value) => value + 0.25))));
  // The candidate over-predicts or is exact on every lot, so adding 0.25 to it makes the
  // incumbent's absolute error exactly 0.25 larger on each lot.
  assert.deepEqual(comparison(report, "incumbent").maeDeltaCi95Pp, [-0.25, -0.25]);
});

test("R2 is null with a reason when every holdout rate is the same; other metrics still report", () => {
  const report = evaluate({ ...fixture(), labels: file("labels", labelRows([2, 2, 2, 2])) });
  const candidate = row(report, "candidate");
  assert.equal(candidate.r2, null);
  assert.match(candidate.r2NullReason, /variance is zero/);
  close(candidate.maePp, (0.5 + 0 + 1 + 3) / 4);
  close(candidate.biasPp, (-0.5 + 0 + 1 + 3) / 4);
});

test("every row and comparison carries the model, dataset and split identifiers", () => {
  const report = evaluate(fixture({ targets: ["WARP", "PRINT"], labels: file("labels", ACTUAL.map((value, index) => ({ lotId: `L${index + 1}`, unit: "pp", source: "generated", rates: { WARP: value, PRINT: value } }))), predictions: {
    candidate: file("candidate", CANDIDATE.map((value, index) => ({ lotId: `L${index + 1}`, unit: "pp", rates: { WARP: value, PRINT: value } }))),
    incumbent: file("incumbent", INCUMBENT.map((value, index) => ({ lotId: `L${index + 1}`, unit: "pp", rates: { WARP: value, PRINT: value } }))),
    naive: file("naive", NAIVE.map((value, index) => ({ lotId: `L${index + 1}`, unit: "pp", rates: { WARP: value, PRINT: value } }))),
  } }));
  assert.equal(report.rows.length, 6);
  assert.equal(report.comparisons.length, 4);
  for (const entry of [...report.rows, ...report.comparisons]) {
    assert.equal(entry.modelId, IDS.modelId);
    assert.equal(entry.datasetId, IDS.datasetId);
    assert.equal(entry.splitId, IDS.splitId);
    assert.deepEqual(entry.labelSources, { generated: 4 });
  }
  assert.deepEqual(report.inputs.labels, { path: "labels.jsonl", sha256: "sha-labels", rows: 4 });
  assert.deepEqual(report.bootstrap, { method: "lot bootstrap, percentile interval", generator: "mulberry32", seed: DEFAULT_SEED, resamples: DEFAULT_RESAMPLES, interval: 0.95 });
  assert.match(formatTable(report), /PRINT\s+naive\s+4\s+0\.0000\s+1\.0000/);
});

function spreadFixture(seed, targets = ["WARP", "PRINT"]) {
  // 30 lots with uneven errors, so different resamples give different means.
  const ids = Array.from({ length: 30 }, (_, index) => `L${index + 1}`);
  const rates = (shift) => ids.map((lotId, index) => ({ lotId, unit: "pp", rates: { WARP: ((index * 7) % 11) / 10 + shift, PRINT: ((index * 5) % 13) / 10 + shift } }));
  const actual = rates(0);
  const candidate = actual.map((entry, index) => ({ ...entry, rates: { WARP: entry.rates.WARP + ((index * 3) % 5) / 20, PRINT: entry.rates.PRINT - ((index * 2) % 7) / 20 } }));
  return {
    labels: file("labels", actual),
    predictions: { candidate: file("candidate", candidate), incumbent: file("incumbent", rates(0.2)), naive: file("naive", rates(-0.3)) },
    ...IDS,
    targets,
    seed,
  };
}

test("the bootstrap is deterministic for a seed, moves with the seed and ignores target order", () => {
  const first = evaluate(spreadFixture(DEFAULT_SEED));
  const again = evaluate(spreadFixture(DEFAULT_SEED));
  assert.deepEqual(again.comparisons, first.comparisons);
  const otherSeed = evaluate(spreadFixture(7));
  assert.notDeepEqual(comparison(otherSeed, "incumbent").maeDeltaCi95Pp, comparison(first, "incumbent").maeDeltaCi95Pp);
  assert.equal(comparison(otherSeed, "incumbent").maeDeltaPp, comparison(first, "incumbent").maeDeltaPp);
  const reordered = evaluate(spreadFixture(DEFAULT_SEED, ["PRINT", "WARP"]));
  assert.deepEqual(comparison(reordered, "naive", "WARP"), comparison(first, "naive", "WARP"));
});

test("the bootstrap interval matches the normal approximation on a large even sample", () => {
  // 200 lots alternating 0 and 1: mean 0.5, standard error sqrt(0.25 / 200) = 0.0354,
  // so a 95% interval of about 0.5 -/+ 1.96 * 0.0354 = [0.431, 0.569].
  const differences = Array.from({ length: 200 }, (_, index) => index % 2);
  const [low, high] = bootstrapInterval(differences, { seed: DEFAULT_SEED, resamples: DEFAULT_RESAMPLES });
  assert.ok(Math.abs(low - 0.4307) < 0.015, `low ${low}`);
  assert.ok(Math.abs(high - 0.5693) < 0.015, `high ${high}`);
});

test("refuses a label row without a rate for a target", () => {
  const rows = labelRows(ACTUAL);
  delete rows[2].rates.WARP;
  assert.throws(() => evaluate({ ...fixture(), labels: file("labels", rows) }), { code: "MISSING_LABEL", message: /labels line 3 \(lot L3\): no WARP rate/ });
  rows[2].rates.WARP = null;
  assert.throws(() => evaluate({ ...fixture(), labels: file("labels", rows) }), { code: "MISSING_LABEL" });
});

test("refuses a prediction row without a rate for a target", () => {
  const rows = predictionRows(NAIVE);
  rows[0].rates = {};
  assert.throws(() => evaluate(withPrediction("naive", rows)), { code: "MISSING_PREDICTION", message: /naive line 1 \(lot L1\): no WARP rate/ });
});

test("refuses a row without a unit", () => {
  const rows = labelRows(ACTUAL);
  delete rows[1].unit;
  assert.throws(() => evaluate({ ...fixture(), labels: file("labels", rows) }), { code: "MISSING_UNIT", message: /labels line 2/ });
});

test("refuses a file whose unit is not percentage points", () => {
  const rows = predictionRows(CANDIDATE).map((entry) => ({ ...entry, unit: "fraction" }));
  assert.throws(() => evaluate(withPrediction("candidate", rows)), { code: "UNIT_MISMATCH", message: /candidate line 1 \(lot L1\): unit "fraction" does not match "pp"/ });
});

test("refuses duplicate lot IDs in the labels and in a prediction file", () => {
  const labels = labelRows(ACTUAL);
  labels[3].lotId = "L1";
  assert.throws(() => evaluate({ ...fixture(), labels: file("labels", labels) }), { code: "DUPLICATE_LOT", message: /labels lot L1 appears on lines 1 and 4/ });
  const rows = predictionRows(INCUMBENT);
  rows.push({ ...rows[0] });
  assert.throws(() => evaluate(withPrediction("incumbent", rows)), { code: "DUPLICATE_LOT", message: /incumbent lot L1/ });
});

test("refuses non-finite and non-numeric values", () => {
  // JSON has no Infinity literal, but 1e999 parses to it.
  const text = labelRows(ACTUAL).map((entry) => JSON.stringify(entry));
  text[1] = text[1].replace('"WARP":2', '"WARP":1e999');
  assert.throws(() => evaluate({ ...fixture(), labels: file("labels", text) }), { code: "NON_FINITE", message: /labels line 2 \(lot L2\) WARP/ });
  const rows = predictionRows(CANDIDATE);
  rows[0].rates.WARP = "1.5";
  assert.throws(() => evaluate(withPrediction("candidate", rows)), { code: "NON_FINITE", message: /candidate line 1 \(lot L1\) WARP: "1.5"/ });
});

test("refuses a prediction file whose lot set differs from the labels", () => {
  const missing = predictionRows(CANDIDATE).slice(0, 3);
  assert.throws(() => evaluate(withPrediction("candidate", missing)), { code: "UNPAIRED", message: /candidate lot set differs from the labels: missing 1 \(L4\), not in labels 0/ });
  const swapped = predictionRows(INCUMBENT);
  swapped[3].lotId = "L9";
  assert.throws(() => evaluate(withPrediction("incumbent", swapped)), { code: "UNPAIRED", message: /missing 1 \(L4\), not in labels 1 \(L9\)/ });
});

test("refuses a target with fewer lots than --min-lots", () => {
  assert.throws(() => evaluate(fixture({ minLots: 5 })), { code: "TOO_FEW_LOTS", message: /WARP has 4 lots; --min-lots is 5/ });
  assert.equal(evaluate(fixture({ minLots: 4 })).labels.lots, 4);
});

test("refuses labels that mix splits", () => {
  const rows = labelRows(ACTUAL);
  rows[0].split = "train";
  assert.throws(() => evaluate({ ...fixture(), labels: file("labels", rows) }), { code: "MIXED_SPLIT" });
});

test("refuses rows without a lot ID and lines that are not JSON objects", () => {
  const rows = labelRows(ACTUAL);
  rows[0].lotId = "";
  assert.throws(() => evaluate({ ...fixture(), labels: file("labels", rows) }), { code: "MISSING_LOT_ID" });
  assert.throws(() => file("labels", ['{"lotId": "L1",']), { code: "BAD_JSON", message: /labels line 1/ });
  assert.throws(() => file("labels", ["[1, 2]"]), { code: "BAD_JSON" });
});

test("refuses to run without model, dataset and split identifiers", () => {
  assert.throws(() => evaluate(fixture({ splitId: " " })), { code: "USAGE", message: /--split-id is required/ });
});

function writeJsonl(dir, name, rows) {
  const path = join(dir, name);
  writeFileSync(path, rows.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
  return path;
}

test("the command writes the JSON report, prints the table and exits non-zero on refusal", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "arc-ml-evaluate-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const args = [
    "--labels", writeJsonl(dir, "labels.jsonl", labelRows(ACTUAL)),
    "--candidate", writeJsonl(dir, "candidate.jsonl", predictionRows(CANDIDATE)),
    "--incumbent", writeJsonl(dir, "incumbent.jsonl", predictionRows(INCUMBENT)),
    "--naive", writeJsonl(dir, "naive.jsonl", predictionRows(NAIVE)),
    "--model-id", IDS.modelId, "--dataset-id", IDS.datasetId, "--split-id", IDS.splitId,
    "--targets", "WARP",
    "--out", join(dir, "out", "report.json"),
  ];
  const ok = spawnSync(process.execPath, [EVALUATE, ...args], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /m2-test \| fixture-4-lots \| holdout-fixture \| 4 lots \| unit pp/);
  assert.match(ok.stdout, /WARP\s+candidate\s+4\s+0\.7500\s+0\.3750\s+0\.5590\s+0\.2500\s+0\.8500\s+0\.3750\n/);
  const report = JSON.parse(readFileSync(join(dir, "out", "report.json"), "utf8"));
  close(row(report, "candidate").maePp, 0.375);
  assert.match(report.inputs.labels.sha256, /^[0-9a-f]{64}$/);

  const refused = spawnSync(process.execPath, [EVALUATE, ...args, "--min-lots", "10"], { encoding: "utf8" });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /^evaluate: TOO_FEW_LOTS: /);

  const usage = spawnSync(process.execPath, [EVALUATE, ...args.slice(2)], { encoding: "utf8" });
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /USAGE: --labels is required/);
});
