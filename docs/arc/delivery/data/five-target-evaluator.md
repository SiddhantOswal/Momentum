# Five-target evaluator (ARC-ML-01)

Owner: data engineer. Written 2026-11-25. Code: `tools/ml/evaluate.mjs`, `tools/ml/naive-reference.mjs`, `tools/ml/lot-files.mjs`. Tests: `test/ml-evaluate.test.js`, `test/ml-naive-reference.test.js`.

The evaluator scores a candidate model against the incumbent and a training-only naive reference on the same lots, for each of WARP, DELAM, STRENGTH, PRINT and CRACK. It reads local files only. It makes no network or cloud calls and writes nothing except the `--out` file.

## Commands

```
node tools/ml/naive-reference.mjs --train train.jsonl --holdout holdout.jsonl --out naive.jsonl

node tools/ml/evaluate.mjs --labels holdout.jsonl \
  --candidate m2.jsonl --incumbent m.jsonl --naive naive.jsonl \
  --model-id <id> --dataset-id <id> --split-id <id> --out report.json \
  [--targets WARP,PRINT] [--min-lots N] [--seed N] [--resamples N]
```

Exit codes: 0 scored, 1 refused (code and reason on stderr), 2 usage error. `--targets` defaults to all five.

## Input files

JSONL, one object per line. Blank lines are skipped and unknown fields are ignored. Rates are scrap rates in percentage points, the same scale as `rate_*_pct` in `prepagent.lots`, and `unit` must be `"pp"` on every row of every file.

Labels (also the training file for the naive reference):

```
{"lotId":"L-0001","unit":"pp","split":"holdout-2026-10","source":"generated","ambientRhPct":82.5,"rates":{"WARP":1.42,"DELAM":0.88,"STRENGTH":0.31,"PRINT":0.57,"CRACK":0.22}}
```

`split` and `source` are optional. `source` records where the label came from (`generated`, `measured`) and is counted into every output row as `labelSources`, with `unspecified` for rows that lack it. `ambientRhPct` is needed only by the naive reference.

Predictions (candidate, incumbent, naive):

```
{"lotId":"L-0001","unit":"pp","rates":{"WARP":1.20,"DELAM":0.95,"STRENGTH":0.28,"PRINT":0.61,"CRACK":0.30}}
```

Lot IDs should be pseudonymous. The evaluator copies them into error messages but not into the report.

## Output

`--out` gets one JSON report: the three identifiers, unit, targets, `--min-lots`, path, SHA-256 and row count of each input file, label lot count with source and split counts, the bootstrap settings, `rows` and `comparisons`. Every row and comparison carries `modelId`, `datasetId` and `splitId` exactly as given. One metric row:

```
{"modelId":"m2","datasetId":"lots-gen","splitId":"holdout-2026-10","target":"WARP","role":"candidate","predictionsFile":"m2.jsonl","labelSources":{"generated":219},"lots":219,"r2":0.47,"r2NullReason":null,"maePp":0.32,"rmsePp":0.41,"medianAbsErrorPp":0.25,"p90AbsErrorPp":0.66,"biasPp":0.02}
```

(The values in this example are illustrative, not a run result.) The command also prints a short table to stdout.

## Metric definitions

Error is predicted minus actual, per lot.

| Field | Definition |
|---|---|
| `lots` | Lots scored for the target |
| `r2` | 1 minus (sum of squared errors / sum of squared deviations of the actual rates from their holdout mean). `null` when every actual rate is identical, with `r2NullReason` saying so; the other metrics are still reported |
| `maePp` | Mean absolute error |
| `rmsePp` | Square root of the mean squared error |
| `medianAbsErrorPp`, `p90AbsErrorPp` | 50th and 90th percentile of absolute error, linear interpolation between order statistics (Hyndman and Fan type 7, the numpy and R default) |
| `biasPp` | Mean of predicted minus actual; positive means the model over-predicts |
| `maeDeltaPp` | Mean over lots of (candidate absolute error minus reference absolute error) |
| `squaredErrorDeltaPp2` | Mean over lots of (candidate squared error minus reference squared error), in pp² |

Deltas are candidate minus reference, so a negative delta means the candidate has lower error. `docs/evidence/model-candidates-v2.json` reported the opposite sign (current minus candidate, positive means the candidate is better); keep that in mind when comparing the two.

## Bootstrap interval

Each delta has a 95% interval from a lot bootstrap: draw as many lots as the holdout has, with replacement, average the per-lot differences, repeat, and take the 2.5th and 97.5th percentiles of the averages (same type 7 interpolation).

- Generator: mulberry32, a 32-bit seeded generator written into the tool, because `Math.random` cannot be seeded and the tool takes no dependencies.
- Seed: 20261125 by default (the date this ticket was built; any fixed value would do). `--seed` overrides it.
- Resamples: 2,000 by default, so each 2.5% tail rests on 50 bootstrap means. `--resamples` overrides it.
- The generator restarts from the seed for every target and comparison, so an interval does not depend on which targets were requested or in what order.
- Resampling is by lot. Lots from the same purchase order, reel or line are treated as independent; a clustered bootstrap needs a group field that the label files do not carry yet.

## Refusals

The evaluator stops with exit code 1 and `evaluate: <CODE>: <reason>` on stderr. It never drops a bad row and carries on.

| Code | When |
|---|---|
| `BAD_JSON` | A line is not valid JSON or not a JSON object |
| `MISSING_LOT_ID` | `lotId` is absent or empty |
| `DUPLICATE_LOT` | A lot ID appears twice in one file |
| `MISSING_UNIT` | A row has no `unit` |
| `UNIT_MISMATCH` | A row's `unit` is not `"pp"` |
| `MISSING_LABEL` | A label row has no rate (absent or null) for a requested target |
| `MISSING_PREDICTION` | A prediction row has no rate for a requested target |
| `NON_FINITE` | A rate is not a finite number (for example a string, or `1e999`, which JSON reads as infinity) |
| `UNPAIRED` | A prediction file's lot set differs from the labels; the message lists missing and extra lots |
| `MIXED_SPLIT` | Label rows carry more than one `split` value |
| `TOO_FEW_LOTS` | Fewer lots than `--min-lots` (default 2, the smallest set on which R² and a resample are defined). Release runs should set it before the holdout is opened |
| `UNREADABLE_FILE` | An input file cannot be read |

The ticket text asked for a refusal on a zero-variance holdout. The tech lead's brief for this build asked instead for R² to be `null` with a reason while the error metrics are still reported, which is what the tool does. A run that needs R² can check `r2NullReason`.

## Naive reference

`naive-reference.mjs` fits the training-only RH-band mean that `docs/evidence/model-candidates-v2.json` reports as `referenceRhBandMean`: for each target, the mean training rate of each ambient RH band, predicted for every holdout lot in that band.

- Bands and edges are those of the `rh_band` feature in `sql/model_v2_training.sql` (config A, approved by Om on 2026-11-20 per that file): `RH_LE50` (RH <= 50), `RH_50_70` (<= 70), `RH_70_85` (<= 85), `RH_GT85`. A value on an edge belongs to the lower band.
- Only the training file's rates are read. Holdout rows need `lotId` and `ambientRhPct`; their rates are ignored.
- Each output row carries `unit: "pp"`, `rhBand`, `method: "training RH-band mean"` and `provenance: "model_estimate"`.
- Refusals: `LEAKAGE` when a holdout lot ID is also in the training file, `EMPTY_BAND` when a holdout lot falls in a band with no training lots (no fallback value is invented), `MISSING_RH`, `RH_OUT_OF_RANGE` (outside 0 to 100), plus the file checks above for the training rows.
- The command prints the band counts and means with the SHA-256 of both input files.

This tool does not reproduce the September 2026 numbers in `model-candidates-v2.json` by itself: that needs the training and holdout rows from `prepagent.lots`, which ARC-ML-02 exports.
