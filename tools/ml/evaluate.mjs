// Five-target evaluator (ARC-ML-01). Scores a candidate model against the
// incumbent and a training-only naive reference on the same lots, per target,
// and refuses inputs that would make the comparison unfair or meaningless.
// Local files only: no network and no cloud calls.
//
// Usage:
//   node tools/ml/evaluate.mjs --labels holdout.jsonl \
//     --candidate m2.jsonl --incumbent m.jsonl --naive naive.jsonl \
//     --model-id m2_2026-11-19 --dataset-id lots-gen-20261010 --split-id holdout-2026-10 \
//     --out report.json [--targets WARP,PRINT] [--min-lots 200] [--seed N] [--resamples N]
//
// Exit codes: 0 scored, 1 refused (code and reason on stderr), 2 usage error.
// Formats, metric definitions and refusal codes: docs/arc/delivery/data/five-target-evaluator.md
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  checkLotIds,
  checkUnits,
  RATE_UNIT,
  readLotFile,
  readRates,
  RefusalError,
  parseTargets,
  TARGETS,
} from "./lot-files.mjs";

export const ROLES = Object.freeze(["candidate", "incumbent", "naive"]);
export const REFERENCES = Object.freeze(["incumbent", "naive"]);

// Fixed so a rerun on the same files gives the same intervals. The value is
// the date ARC-ML-01 was written; any fixed value would do.
export const DEFAULT_SEED = 20261125;
// With 2,000 resamples each 2.5% tail of the percentile interval rests on 50
// bootstrap means.
export const DEFAULT_RESAMPLES = 2000;
// Two lots is the smallest set on which R² and a resample are defined. Release
// runs should pass a larger --min-lots chosen before the holdout is opened.
export const DEFAULT_MIN_LOTS = 2;

// mulberry32: a small 32-bit generator. Built in here because Math.random
// cannot be seeded and the evaluator takes no dependencies.
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Linear interpolation between order statistics (Hyndman and Fan type 7, the
// numpy and R default), so the numbers can be checked with either tool.
export function quantile(sortedValues, p) {
  const position = (sortedValues.length - 1) * p;
  const below = Math.floor(position);
  const above = Math.ceil(position);
  return sortedValues[below] + (position - below) * (sortedValues[above] - sortedValues[below]);
}

function mean(values) {
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

export function errorMetrics(actual, predicted) {
  const lots = actual.length;
  const errors = predicted.map((value, index) => value - actual[index]);
  const absolute = errors.map(Math.abs).sort((a, b) => a - b);
  const squared = errors.map((error) => error * error);
  const mse = mean(squared);
  // Compare raw values: a mean of identical values can carry rounding error
  // and give a tiny non-zero variance.
  const zeroVariance = actual.every((value) => value === actual[0]);
  let r2 = null;
  let r2NullReason = null;
  if (zeroVariance) {
    r2NullReason = "holdout variance is zero: every actual rate is the same, so R² is undefined";
  } else {
    const actualMean = mean(actual);
    let totalSquares = 0;
    for (const value of actual) totalSquares += (value - actualMean) ** 2;
    r2 = 1 - (mse * lots) / totalSquares;
  }
  return {
    lots,
    r2,
    r2NullReason,
    maePp: mean(absolute),
    rmsePp: Math.sqrt(mse),
    medianAbsErrorPp: quantile(absolute, 0.5),
    p90AbsErrorPp: quantile(absolute, 0.9),
    biasPp: mean(errors),
  };
}

// Lot bootstrap: draw lots with replacement, average the per-lot differences,
// repeat, and take the 2.5th and 97.5th percentiles of those averages. The
// generator restarts from the seed for every call, so an interval does not
// depend on which targets or comparisons were computed before it.
export function bootstrapInterval(differences, { seed, resamples }) {
  const random = seededRandom(seed);
  const count = differences.length;
  const means = new Float64Array(resamples);
  for (let resample = 0; resample < resamples; resample += 1) {
    let sum = 0;
    for (let draw = 0; draw < count; draw += 1) sum += differences[Math.floor(random() * count)];
    means[resample] = sum / count;
  }
  means.sort();
  return [quantile(means, 0.025), quantile(means, 0.975)];
}

// Per-lot paired differences, candidate minus reference. A negative delta
// means the candidate's error is lower on these lots.
export function pairedDeltas(actual, candidate, reference, bootstrap) {
  const absolute = [];
  const squared = [];
  actual.forEach((value, index) => {
    const candidateError = candidate[index] - value;
    const referenceError = reference[index] - value;
    absolute.push(Math.abs(candidateError) - Math.abs(referenceError));
    squared.push(candidateError ** 2 - referenceError ** 2);
  });
  return {
    maeDeltaPp: mean(absolute),
    maeDeltaCi95Pp: bootstrapInterval(absolute, bootstrap),
    squaredErrorDeltaPp2: mean(squared),
    squaredErrorDeltaCi95Pp2: bootstrapInterval(squared, bootstrap),
  };
}

function countBy(entries, field) {
  const counts = {};
  for (const { row } of entries) {
    const key = row[field] === undefined || row[field] === null || row[field] === "" ? "unspecified" : String(row[field]);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function checkPairing(labelIds, file, ids) {
  const labelSet = new Set(labelIds);
  const fileSet = new Set(ids);
  const missing = labelIds.filter((lotId) => !fileSet.has(lotId));
  const extra = ids.filter((lotId) => !labelSet.has(lotId));
  if (missing.length === 0 && extra.length === 0) return;
  const show = (list) => `${list.length} (${list.slice(0, 5).join(", ")}${list.length > 5 ? ", ..." : ""})`;
  throw new RefusalError(
    "UNPAIRED",
    `${file.name} lot set differs from the labels: missing ${show(missing)}, not in labels ${show(extra)}`,
  );
}

function requireId(value, flag) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RefusalError("USAGE", `${flag} is required`);
  }
  return value;
}

// labels and each prediction file: { name, path, sha256, entries } as returned
// by readLotFile. Returns the full report; throws RefusalError on bad evidence.
export function evaluate({
  labels,
  predictions,
  modelId,
  datasetId,
  splitId,
  targets = [...TARGETS],
  minLots = DEFAULT_MIN_LOTS,
  seed = DEFAULT_SEED,
  resamples = DEFAULT_RESAMPLES,
}) {
  const ids = {
    modelId: requireId(modelId, "--model-id"),
    datasetId: requireId(datasetId, "--dataset-id"),
    splitId: requireId(splitId, "--split-id"),
  };
  if (!Number.isInteger(minLots) || minLots < 2) throw new RefusalError("USAGE", "--min-lots must be an integer of at least 2");
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RefusalError("USAGE", "--seed must be an integer from 0 to 4294967295");
  if (!Number.isInteger(resamples) || resamples < 1) throw new RefusalError("USAGE", "--resamples must be a positive integer");
  for (const role of ROLES) {
    if (!predictions[role]) throw new RefusalError("USAGE", `--${role} predictions file is required`);
  }

  const labelIds = checkLotIds(labels);
  checkUnits(labels);
  const splits = countBy(labels.entries, "split");
  if (Object.keys(splits).length > 1) {
    throw new RefusalError("MIXED_SPLIT", `${labels.name} mixes splits ${JSON.stringify(splits)}; evaluate one split at a time`);
  }
  const actualByLot = readRates(labels, targets, "MISSING_LABEL");

  const predictedByRole = {};
  for (const role of ROLES) {
    const file = predictions[role];
    const fileIds = checkLotIds(file);
    checkPairing(labelIds, file, fileIds);
    checkUnits(file);
    predictedByRole[role] = readRates(file, targets, "MISSING_PREDICTION");
  }

  if (labelIds.length < minLots) {
    throw new RefusalError(
      "TOO_FEW_LOTS",
      `${targets.join(", ")} ha${targets.length === 1 ? "s" : "ve"} ${labelIds.length} lots; --min-lots is ${minLots}`,
    );
  }

  const labelSources = countBy(labels.entries, "source");
  const bootstrap = { seed, resamples };
  const rows = [];
  const comparisons = [];
  for (const target of targets) {
    const actual = labelIds.map((lotId) => actualByLot.get(lotId)[target]);
    const predicted = {};
    for (const role of ROLES) {
      predicted[role] = labelIds.map((lotId) => predictedByRole[role].get(lotId)[target]);
      rows.push({
        ...ids,
        target,
        role,
        predictionsFile: predictions[role].path,
        labelSources,
        ...errorMetrics(actual, predicted[role]),
      });
    }
    for (const reference of REFERENCES) {
      comparisons.push({
        ...ids,
        target,
        candidate: "candidate",
        reference,
        lots: actual.length,
        labelSources,
        ...pairedDeltas(actual, predicted.candidate, predicted[reference], bootstrap),
      });
    }
  }

  const describe = (file) => ({ path: file.path, sha256: file.sha256, rows: file.entries.length });
  return {
    kind: "five-target-evaluation",
    ...ids,
    unit: RATE_UNIT,
    targets,
    minLots,
    inputs: {
      labels: describe(labels),
      ...Object.fromEntries(ROLES.map((role) => [role, describe(predictions[role])])),
    },
    labels: { lots: labelIds.length, sources: labelSources, splits },
    bootstrap: {
      method: "lot bootstrap, percentile interval",
      generator: "mulberry32",
      seed,
      resamples,
      interval: 0.95,
    },
    deltaDefinition: "candidate minus reference, per lot, averaged over lots; negative means the candidate has lower error",
    rows,
    comparisons,
  };
}

function format(value, digits = 4) {
  if (value === null) return "null";
  const text = value.toFixed(digits);
  // A tiny negative such as -1e-17 would print as -0.0000 and read as a sign.
  return Number(text) === 0 ? (0).toFixed(digits) : text;
}

export function formatTable(report) {
  const lines = [
    `${report.modelId} | ${report.datasetId} | ${report.splitId} | ${report.labels.lots} lots | unit ${report.unit}`,
    "target    role       lots  R2        MAE     RMSE    medAE   p90AE   bias",
  ];
  for (const row of report.rows) {
    lines.push(
      [
        row.target.padEnd(9),
        row.role.padEnd(10),
        String(row.lots).padStart(4),
        ` ${format(row.r2).padStart(8)}`,
        format(row.maePp).padStart(7),
        format(row.rmsePp).padStart(7),
        format(row.medianAbsErrorPp).padStart(7),
        format(row.p90AbsErrorPp).padStart(7),
        format(row.biasPp).padStart(7),
      ].join(" "),
    );
  }
  lines.push("", `Paired deltas, candidate minus reference, 95% lot-bootstrap interval (seed ${report.bootstrap.seed}, ${report.bootstrap.resamples} resamples)`);
  lines.push("target    vs         MAE delta [95% CI]              squared error delta [95% CI]");
  for (const row of report.comparisons) {
    const mae = `${format(row.maeDeltaPp)} [${format(row.maeDeltaCi95Pp[0])}, ${format(row.maeDeltaCi95Pp[1])}]`;
    const squared = `${format(row.squaredErrorDeltaPp2)} [${format(row.squaredErrorDeltaCi95Pp2[0])}, ${format(row.squaredErrorDeltaCi95Pp2[1])}]`;
    lines.push(`${row.target.padEnd(9)} ${row.reference.padEnd(10)} ${mae.padEnd(31)} ${squared}`);
  }
  return lines.join("\n");
}

function integerOption(text, flag, fallback) {
  if (text === undefined) return fallback;
  if (!/^\d+$/.test(text)) throw new RefusalError("USAGE", `${flag} must be a whole number; got "${text}"`);
  return Number(text);
}

export function runCli(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        labels: { type: "string" },
        candidate: { type: "string" },
        incumbent: { type: "string" },
        naive: { type: "string" },
        "model-id": { type: "string" },
        "dataset-id": { type: "string" },
        "split-id": { type: "string" },
        out: { type: "string" },
        targets: { type: "string" },
        "min-lots": { type: "string" },
        seed: { type: "string" },
        resamples: { type: "string" },
      },
      strict: true,
    }));
  } catch (error) {
    throw new RefusalError("USAGE", error.message);
  }
  for (const flag of ["labels", "candidate", "incumbent", "naive", "out"]) {
    if (!values[flag]) throw new RefusalError("USAGE", `--${flag} is required`);
  }
  const report = evaluate({
    labels: readLotFile(values.labels, "labels"),
    predictions: Object.fromEntries(ROLES.map((role) => [role, readLotFile(values[role], role)])),
    modelId: values["model-id"],
    datasetId: values["dataset-id"],
    splitId: values["split-id"],
    targets: parseTargets(values.targets),
    minLots: integerOption(values["min-lots"], "--min-lots", DEFAULT_MIN_LOTS),
    seed: integerOption(values.seed, "--seed", DEFAULT_SEED),
    resamples: integerOption(values.resamples, "--resamples", DEFAULT_RESAMPLES),
  });
  mkdirSync(dirname(values.out), { recursive: true });
  writeFileSync(values.out, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function exitCodeFor(error) {
  return error instanceof RefusalError && error.code === "USAGE" ? 2 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = runCli(process.argv.slice(2));
    console.log(formatTable(report));
  } catch (error) {
    console.error(`evaluate: ${error instanceof RefusalError ? error.message : error.stack}`);
    process.exitCode = exitCodeFor(error);
  }
}
