// Training-only RH-band mean: the naive reference reported as
// referenceRhBandMean in docs/evidence/model-candidates-v2.json. It predicts,
// for each holdout lot, the mean training rate of the lot's ambient RH band.
// Fitting reads the training file only, so the reference never sees a holdout
// label. Local files only: no network and no cloud calls.
//
// Usage:
//   node tools/ml/naive-reference.mjs --train train.jsonl --holdout holdout.jsonl \
//     --out naive.jsonl [--targets WARP,PRINT]
//
// Exit codes: 0 written, 1 refused (code and reason on stderr), 2 usage error.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  checkLotIds,
  checkUnits,
  finiteNumber,
  parseTargets,
  RATE_UNIT,
  readLotFile,
  readRates,
  RefusalError,
  TARGETS,
} from "./lot-files.mjs";

// Same edges and names as the rh_band feature in sql/model_v2_training.sql:
// an RH exactly on an edge belongs to the lower band.
export const RH_BANDS = Object.freeze([
  { band: "RH_LE50", upToPct: 50 },
  { band: "RH_50_70", upToPct: 70 },
  { band: "RH_70_85", upToPct: 85 },
  { band: "RH_GT85", upToPct: 100 },
]);

export function rhBand(rhPct) {
  return RH_BANDS.find(({ upToPct }) => rhPct <= upToPct).band;
}

function readRh(file) {
  const rhByLot = new Map();
  for (const { line, row } of file.entries) {
    const where = `${file.name} line ${line} (lot ${row.lotId}) ambientRhPct`;
    if (row.ambientRhPct === undefined || row.ambientRhPct === null) {
      throw new RefusalError("MISSING_RH", `${where} is missing`);
    }
    const rhPct = finiteNumber(row.ambientRhPct, where);
    if (rhPct < 0 || rhPct > 100) throw new RefusalError("RH_OUT_OF_RANGE", `${where} is ${rhPct}; expected 0 to 100`);
    rhByLot.set(row.lotId, rhPct);
  }
  return rhByLot;
}

// Returns { lotIds, bands: { RH_LE50: { trainingLots, means: { WARP: ... } }, ... } }.
// A band with no training lots has trainingLots 0 and means null.
export function fitBandMeans(train, targets = [...TARGETS]) {
  const lotIds = checkLotIds(train);
  checkUnits(train);
  const rhByLot = readRh(train);
  const rates = readRates(train, targets, "MISSING_LABEL");
  const bands = Object.fromEntries(RH_BANDS.map(({ band }) => [band, { trainingLots: 0, sums: Object.fromEntries(targets.map((t) => [t, 0])) }]));
  for (const [lotId, rhPct] of rhByLot) {
    const entry = bands[rhBand(rhPct)];
    entry.trainingLots += 1;
    for (const target of targets) entry.sums[target] += rates.get(lotId)[target];
  }
  return {
    lotIds: new Set(lotIds),
    bands: Object.fromEntries(
      Object.entries(bands).map(([band, { trainingLots, sums }]) => [
        band,
        {
          trainingLots,
          means: trainingLots === 0 ? null : Object.fromEntries(targets.map((t) => [t, sums[t] / trainingLots])),
        },
      ]),
    ),
  };
}

// Holdout rows need lotId and ambientRhPct only; their labels are not read.
export function predictHoldout(fit, holdout) {
  const holdoutIds = checkLotIds(holdout);
  const shared = holdoutIds.filter((lotId) => fit.lotIds.has(lotId));
  if (shared.length > 0) {
    throw new RefusalError(
      "LEAKAGE",
      `${shared.length} holdout lot(s) are also in the training file (${shared.slice(0, 5).join(", ")})`,
    );
  }
  const rhByLot = readRh(holdout);
  return holdoutIds.map((lotId) => {
    const band = rhBand(rhByLot.get(lotId));
    const { trainingLots, means } = fit.bands[band];
    if (trainingLots === 0) {
      throw new RefusalError("EMPTY_BAND", `lot ${lotId} is in ${band}, which has no training lots`);
    }
    return {
      lotId,
      unit: RATE_UNIT,
      rates: { ...means },
      rhBand: band,
      method: "training RH-band mean",
      provenance: "model_estimate",
    };
  });
}

export function runCli(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        train: { type: "string" },
        holdout: { type: "string" },
        out: { type: "string" },
        targets: { type: "string" },
      },
      strict: true,
    }));
  } catch (error) {
    throw new RefusalError("USAGE", error.message);
  }
  for (const flag of ["train", "holdout", "out"]) {
    if (!values[flag]) throw new RefusalError("USAGE", `--${flag} is required`);
  }
  const targets = parseTargets(values.targets);
  const train = readLotFile(values.train, "train");
  const holdout = readLotFile(values.holdout, "holdout");
  const fit = fitBandMeans(train, targets);
  const predictions = predictHoldout(fit, holdout);
  mkdirSync(dirname(values.out), { recursive: true });
  writeFileSync(values.out, predictions.map((row) => JSON.stringify(row)).join("\n") + "\n");
  return {
    train: { path: train.path, sha256: train.sha256, lots: fit.lotIds.size },
    holdout: { path: holdout.path, sha256: holdout.sha256, lots: predictions.length },
    out: values.out,
    bands: fit.bands,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(runCli(process.argv.slice(2)), null, 2));
  } catch (error) {
    console.error(`naive-reference: ${error instanceof RefusalError ? error.message : error.stack}`);
    process.exitCode = error instanceof RefusalError && error.code === "USAGE" ? 2 : 1;
  }
}
