# PKBX0041 optimizer reference case on the m2_* models

Owner: data engineer. Approved by the founders as a read-only task.
Written: 2026-11-22, before any query ran. Results are added below the plan once the queries have run.

## Final reference (awaiting Om sign-off)

**Model estimate on m2_* models, not a measured saving. Awaiting Om sign-off on ambient temperature and RH.**

Founder decision (2026-11-23): PKBX0041 stays the reference lot, and the m2 re-run figures are used as they came out, labelled as a model estimate. No search was made for a larger number. Ambient temperature was given provisionally as about 19 °C (the December to February band), to be checked against the modeled lots first. Everything in this section is read-only: one SELECT on `prepagent.lots` and one run of `sql/optimize.sql`, both with `--maximum_bytes_billed=104857600`, project `prepagent-hack`, location `asia-south1`, identity the founders' logged-in gcloud identity. No DDL, DML or destination table. Both jobs wrote only to BigQuery's anonymous cache dataset.

### Temperature and RH check

Query (scratch file, not committed, SHA-256 `48bd59b453a238343354706c3110696e856bf596ec30aad14edf579860fe2d3b`): the same band as Step 1 below (paper_moisture_pct 7.0 to 7.6% inclusive, all lots), restricted to `EXTRACT(MONTH FROM run_date) IN (12, 1, 2)`, returning `PERCENTILE_CONT` 25th, 50th and 75th percentiles of `ambient_temp_c` and `ambient_rh_pct`. Dry run: SELECT, 235,400 bytes.

Job `arc_pkbx0041_m2_t19_band_20261122T212915Z`: DONE, 235,400 bytes processed, 10,485,760 bytes billed (the minimum).

| Measure (moisture 7.0 to 7.6%, Dec to Feb) | Value |
|---|---|
| Lots | 364 (0 with a `TEST` lot ID prefix), run dates 2024-12-01 to 2026-02-28 |
| Temperature median / IQR | 18.35 °C / 14.35 to 23.8 °C |
| RH median / IQR | 43.15% / 38.8 to 47.1% |

The median temperature is 18.35 °C, which rounds to **18.5 °C** at 0.5 °C, not 19 °C. The monthly means in Step 1 (18.53, 19.26 and 19.0 °C) are slightly higher than the median because the distribution is skewed. As instructed, the run uses 18.5 °C. The winter RH median of 43.15% is 1.15 points from 42.0%, inside the 3-point limit, so no second job was run and RH stays at 42.0%. Recommended pairing: **7.3% moisture, 42.0% RH, 18.5 °C**. Source: modeled lot history in `prepagent.lots`, not plant sensor readings or public weather records.

### Optimizer run

Inputs: item PKBX0041, quantity 1300, paper RECYCLED, supplier SUP-D, shift DAY, paper moisture 7.3%, ambient RH 42.0%, ambient temperature 18.5 °C. Planned levers: single facer 48 m/min, roll 162 °C, gum HIGH, viscosity 32 s, pasting MED, drying 5 h, print 60 sheets/min. SQL `sql/optimize.sql`, SHA-256 `7ada7985c2c69d8f3e63985b427fb91f98cef87aff6f3c7844146536833c61fd` (unchanged since commit 312d120).

Dry run first: SCRIPT, 0 bytes (as for every earlier run, BigQuery does not estimate scripts). An earlier dry run attempt was rejected by BigQuery before validation ("Script query parameters not found") because zsh passed the parameter list as one argument. No job was created, and nothing was billed. The command was moved into a bash script with an argument array.

Job `arc_pkbx0041_m2_t19_rh420_t185_20261122T212952Z` (the `t19` prefix is the task label; the temperature used is 18.5 °C): SCRIPT, cap 104,857,600 bytes, DONE, 351,636 bytes processed, 94,371,840 bytes billed. Child jobs: ASSERT 1,273 bytes (10 MiB billed), ASSERT 10 bytes (10 MiB), SELECT 350,353 bytes (70 MiB). Both ASSERTs passed. The stored job parameters were read back with `bq show -j` and match the inputs above.

Total billed for this section: 104,857,600 bytes (100 MiB).

| Lever | Planned (baseline) | Recommended (best) | Changed |
|---|---|---|---|
| Single facer speed | 48 m/min | 48 m/min | no |
| Roll temperature | 162 °C | 170 °C | yes |
| Gum application | HIGH | MED | yes |
| Gum viscosity | 32 s | 45 s | yes |
| Pasting pressure | MED | MED | no |
| Drying time | 5 h | 5 h | no |
| Print speed | 60 sheets/min | 60 sheets/min | no |

Three of seven settings change (n_changes 3).

| Defect risk | Baseline | Best | Change (points) |
|---|---|---|---|
| Warp | 1.482% | 1.064% | −0.418 |
| Delamination | 1.779% | 1.740% | −0.039 |
| Strength | 0.743% | 0.738% | −0.005 |
| Print | 1.754% | 1.472% | −0.282 |
| Crack | 0.621% | 0.567% | −0.054 |

| Result | Baseline | Best |
|---|---|---|
| Total scrap | 6.38% | 5.58% |
| Scrap | 62.9 kg | 55.1 kg |
| Scrap cost | ₹3,355 | ₹2,934 |
| Slower-production allowance (penalty) | ₹0 | ₹0 |
| Total cost | ₹3,355 | ₹2,934 |
| Primary defect | DELAM | DELAM |
| **Reduction** | | **7.8 kg and ₹421** |

Checks: 62.9 − 55.1 = 7.8 and 3,355 − 2,934 = 421, matching `savings_kg` and `savings_cost`. The five rates sum to 6.379% and 5.581%, matching total_scrap_pct. scrap_cost / scrap_kg is ₹53.3/kg on both rows, as in all earlier runs. The penalty is ₹0, so the ₹421 is all scrap cost, and drying time is unchanged. All five risks fall, so there is no trade-off. The levers are the same as the 24.5 °C run in Step 2 below. Only the risk values move: baseline scrap goes from 61.9 to 62.9 kg.

Primary defect: DELAM at 1.779% is 0.025 points above PRINT at 1.754%, which is well inside model error (delam holdout MAE 0.50 points). The delam change of −0.039 points is also inside that error. Most of the reduction comes from warp and print. Copy should not put weight on which defect is "main".

### Current m2 model scores and versions

Scores from `config/model-acceptance.json` (status accepted, basis `OUT_OF_TIME_HOLDOUT_IMPROVEMENT`, owner decision D4-2026-11-20-OM by Om). Holdout `holdout-2026-09`: `prepagent.lots` run_date 2026-09-01 to 2026-09-30, non-TEST rows, 219 lots. The m2 models were trained on run_date < 2026-07-01 (4,710 lots). The October internal-split thresholds are kept for reference only and are not the acceptance test. Etags were read on 2026-11-22 (UTC) with `bq show --model` and match the config. All five are BOOSTED_TREE_REGRESSOR models in asia-south1, created on 2026-11-19. Each one's last-modified time is within one second of its creation time.

| Model | Holdout R² | MAE (points) | Replaces | Replaced model R² (same holdout) | Etag |
|---|---|---|---|---|---|
| prepagent.m2_warp | 0.4682 | 0.3169 | m_warp | 0.4021 | A/Eqthrx3yRauwn6d+tuyg== |
| prepagent.m2_delam | 0.5194 | 0.4989 | m_delam | 0.5003 | OAY9Gu/8TDh8/4c6mSwNqQ== |
| prepagent.m2_strength | 0.3880 | 0.1708 | m_strength | 0.2971 | wh1NhlSbKmBDWmdLOTP37w== |
| prepagent.m2_print | 0.6404 | 0.2616 | m_print | 0.6102 | k3lJWUVDttvsrv9VMCUNIg== |
| prepagent.m2_crack | 0.1081 | 0.1374 | m_crack | −0.0136 | 23cEQCbhScGie+kPs0qJ6w== |

The acceptance conditions still apply: a supervisor approves every recommendation, values are shown as predicted or estimated, and crack is shown as low confidence.

### Not edited yet

`README.md`, `DEMO_LOT` in `src/ui/workflow.js` and the design files in `docs/arc/design/` were deliberately left unchanged. They wait for Om's sign-off on 18.5 °C and 42.0% RH. The "Places that show the old case values" table at the end of this file lists the 24.5 °C figures in its "New value" column. Once Om signs off, those values should be replaced with this section's figures: 62.9 kg / ₹3,355 → 55.1 kg / ₹2,934, a reduction of 7.8 kg and ₹421, temperature 18.5 °C, and primary defect DELAM. The lever values in that table stay the same.

### For Om

1. Is 18.5 °C with 42.0% RH a realistic December to February day at the plant for 7.3% paper moisture? The 19 °C figure came from the monthly means; the median is 18.35 °C.
2. These conditions come from modeled history. If Om confirms the plant's location, a public weather record could replace them, labelled "public weather record, not a plant sensor".

The earlier runs below are kept as history.

## Why

The README and several designs show PKBX0041 as 100.4 kg / ₹5,351 baseline against 83.0 kg / ₹4,426 recommended (17.4 kg and ₹925 estimated reduction). That figure came from BigQuery job `ustad_pkbx0041_acceptance_100m_20261015`, run on 15 October 2026 against the old `prepagent.m_*` models with paper moisture 10.8%. Since commit 312d120 (owner decision D4-2026-11-20-OM) the app runs the same SQL against `prepagent.m2_*`. The designs show the figure next to "moisture 7.3% (example)", and the founders have chosen 7.3% as the pre-filled default. This rerun checks what the current models return for the same case at both moisture values.

## How the original figure was produced

Established from the code and the stored job record, not assumed.

- Query: `sql/optimize.sql`. The October file (commit 8c7e9a4) has SHA-256 `9b6c048f...0b17b`, which matches `sqlSha256` in `test/fixtures/optimizer-pkbx0041-cli-result.json`. The only change since then (commit 312d120) replaces `m_warp`, `m_delam`, `m_strength`, `m_print`, `m_crack` with the matching `m2_*` names. The grid, penalties, cost arithmetic and tie-break order are unchanged. Current file SHA-256: `7ada7985c2c69d8f3e63985b427fb91f98cef87aff6f3c7844146536833c61fd`.
- App path: `src/google-cloud/risk-optimization-service.js` loads `sql/optimize.sql`, maps the inputs through `mapRiskPredictionParameters` (`src/bigquery-mapper.js`) and sends them as named parameters (quantity INT64, the eight numeric conditions and levers FLOAT64, the rest STRING) through the BigQuery `jobs.query` API in `asia-south1` (`src/google-cloud/bigquery-read-client.js`). The optimizer has its own byte cap, separate from the general 50 MiB read cap: `readOptimizerQueryBudget` in `src/service-ports.js` accepts 80 MiB (the default) or 100 MiB from `USTAAD_OPTIMIZER_MAX_BYTES_BILLED`. Both live Cloud Run services (`momentum`, revision momentum-00023-yaz, and `prepagent`) set it to 104857600 (100 MiB). That value was read on 2026-11-22 with `gcloud run services describe`, filtered to that one variable. No destination table and no write statements. The only statements are two `ASSERT`s and one `SELECT` using `ML.PREDICT`.
- Original inputs, read back from the stored parameters of job `ustad_pkbx0041_acceptance_100m_20261015` (`bq show -j`): item_code PKBX0041, quantity 1300, paper_type RECYCLED, paper_supplier SUP-D, shift DAY, ambient_rh_pct 86, ambient_temp_c 26, paper_moisture_pct 10.8, sf_speed_mpm 48, roll_temp_c 162, gum_application HIGH, gum_viscosity_sec 32, pasting_pressure MED, drying_hours 5, print_speed_spm 60. That job was a SCRIPT, ran with a 100 MiB byte cap, and processed 174,523 bytes.
- Arithmetic, all in SQL: box weight = sheet area (from the item's box style and dimensions) x board GSM / 1000. Each defect rate is `GREATEST(prediction, 0)`, and the print rate is 0 when the item has no ink colours. scrap_kg = quantity x box weight x sum of the five rates / 100. scrap_cost = scrap_kg x `plants.cost_per_kg` for PLANT-01. penalty = ₹200 per extra drying hour + ₹60 per m/min slower single facer + ₹30 per sheet/min slower printing, measured against the planned levers. BEST is the candidate with the lowest scrap_cost + penalty among candidates with at most three lever changes. The reduction is baseline minus BEST, for scrap_kg and for total_cost.

## Commands

Identity: the logged-in gcloud account. Project `prepagent-hack`, location `asia-south1`. The byte cap is 100 MiB (`--maximum_bytes_billed=104857600`), the same as the live optimizer and the October job. The first version of this plan said 50 MiB; see "Correction" below. No `--destination_table`, no `--replace` or `--append`, and no DDL or DML. Run from the repository root.

Common parameters (all inputs except moisture):

```
P="--parameter=item_code:STRING:PKBX0041 --parameter=quantity:INT64:1300 \
 --parameter=paper_type:STRING:RECYCLED --parameter=paper_supplier:STRING:SUP-D \
 --parameter=shift:STRING:DAY --parameter=ambient_rh_pct:FLOAT64:86 \
 --parameter=ambient_temp_c:FLOAT64:26 --parameter=sf_speed_mpm:FLOAT64:48 \
 --parameter=roll_temp_c:FLOAT64:162 --parameter=gum_application:STRING:HIGH \
 --parameter=gum_viscosity_sec:FLOAT64:32 --parameter=pasting_pressure:STRING:MED \
 --parameter=drying_hours:FLOAT64:5 --parameter=print_speed_spm:FLOAT64:60"
Q="bq --project_id=prepagent-hack --location=asia-south1 query --nouse_legacy_sql \
 --maximum_bytes_billed=104857600 --format=prettyjson"
```

1. Model metadata (metadata read, no query cost): `bq --project_id=prepagent-hack show --format=prettyjson --model prepagent.m2_<defect>` for warp, delam, strength, print and crack. This confirms the etags match `config/model-acceptance.json`.
2. Dry runs (no cost, no job retained): `$Q --dry_run $P --parameter=paper_moisture_pct:FLOAT64:10.8 < sql/optimize.sql`, then the same with `7.3`.
3. Run A, like for like with October: `$Q --job_id=arc_pkbx0041_m2_moist108_<utc> $P --parameter=paper_moisture_pct:FLOAT64:10.8 < sql/optimize.sql`
4. Run B, founders' default moisture: `$Q --job_id=arc_pkbx0041_m2_moist73_<utc> $P --parameter=paper_moisture_pct:FLOAT64:7.3 < sql/optimize.sql`

## Expected cost

`bq query --dry_run` returned `totalBytesProcessed: 0` for both runs. The query is a multi-statement script (two ASSERTs and a SELECT), and BigQuery validates scripts on a dry run without estimating their bytes. Both dry runs returned statement type SCRIPT and no destination table.

The estimate therefore comes from the child jobs of the October run (`bq ls -j --parent_job_id=ustad_pkbx0041_acceptance_100m_20261015`):

| Child statement | Bytes processed | Bytes billed |
|---|---|---|
| ASSERT item exists | 1,273 | 10,485,760 (10 MiB minimum) |
| ASSERT plant exists | 10 | 10,485,760 (10 MiB minimum) |
| SELECT with ML.PREDICT | 173,240 | 73,400,320 (70 MiB) |
| Total | 174,523 | 94,371,840 (90 MiB) |

So the expected bill is about 90 MiB per run, or 180 MiB for both runs. That is about 0.00017 TiB, which costs a small fraction of one US cent at on-demand rates. The 100 MiB cap stops either run before it can bill more.

## Correction: first attempt stopped at the byte cap

The first attempt of Run A (job `arc_pkbx0041_m2_moist108_20261122T174924Z`) used the 50 MiB cap from the first version of this plan. Both ASSERTs passed, using 20 MiB. The SELECT then stopped before running: "Query exceeded limit for bytes billed: 31457280. 73400320 or higher required." No result was produced, and nothing beyond the two ASSERT minimums was billed. The cap applies to the whole script, so the optimizer needs 90 MiB in total. The app's default of 80 MiB would also be too low, but the live services set 100 MiB. Both runs below use 100 MiB to match the live path.

## Rollback

None needed. Every step is read-only: two ASSERTs, a SELECT with ML.PREDICT, and model metadata reads. No table, view, model or setting is created or changed. BigQuery writes each query's result to its own anonymous temporary cache table, as it does for every query. That table is managed by BigQuery and expires after about 24 hours. It is not a destination table.

## Provenance

Every number in the results is a **model estimate on m2_* models, not a measured saving**. The models are trained on modeled production history built on the real item master, not on plant measurements. Paper moisture, humidity and temperature are fixed test inputs, not sensor readings.

## Results

Ran on 2026-11-22 (UTC) as the founders' logged-in gcloud identity, project `prepagent-hack`, location `asia-south1`, cap 104857600 bytes, SQL `sql/optimize.sql` at SHA-256 `7ada7985...61fd`. Both ASSERTs passed in both runs.

### Models

Read with `bq show --model` before the runs. The etags match `config/model-acceptance.json` (owner decision D4-2026-11-20-OM). All five are BOOSTED_TREE_REGRESSOR models in asia-south1, created on 2026-11-19, and none has been modified since creation.

| Model | Etag (model version) |
|---|---|
| prepagent.m2_warp | A/Eqthrx3yRauwn6d+tuyg== |
| prepagent.m2_delam | OAY9Gu/8TDh8/4c6mSwNqQ== |
| prepagent.m2_strength | wh1NhlSbKmBDWmdLOTP37w== |
| prepagent.m2_print | k3lJWUVDttvsrv9VMCUNIg== |
| prepagent.m2_crack | 23cEQCbhScGie+kPs0qJ6w== |

### Inputs

The same in both runs except paper moisture: PKBX0041, quantity 1300, RECYCLED, SUP-D, DAY shift, ambient RH 86%, ambient temperature 26 °C. Planned levers: single facer 48 m/min, roll 162 °C, gum HIGH, viscosity 32 s, pasting MED, drying 5 h, print 60 sheets/min. Run A uses paper moisture 10.8%, as in October. Run B uses 7.3%.

### Jobs and bytes

| Job ID | Moisture | State | Bytes processed | Bytes billed |
|---|---|---|---|---|
| arc_pkbx0041_m2_moist108_20261122T174924Z | 10.8 | Failed at byte cap (see Correction); no result | 1,283 | 20,971,520 |
| arc_pkbx0041_m2_moist108_20261122T175049Z | 10.8 | Done | 351,636 | 94,371,840 |
| arc_pkbx0041_m2_moist73_20261122T175049Z | 7.3 | Done | 351,636 | 94,371,840 |
| Total | | | 704,555 | 209,715,200 (200 MiB) |

Child jobs of each successful run: ASSERT 1,273 bytes processed, ASSERT 10 bytes, SELECT 350,353 bytes, billed at 10 MiB, 10 MiB and 70 MiB. The SELECT processes about twice the bytes of October's 173,240, which is consistent with the m2 models being larger. The billed amount is unchanged.

### Raw output

Copied as returned by `bq --format=prettyjson`. Each run also returned two "Assertion successful" entries, omitted here.

Run A, moisture 10.8%:

| Field | BASELINE | BEST |
|---|---|---|
| n_changes | 0 | 3 |
| sf_speed_mpm | 48.0 | 48.0 |
| roll_temp_c | 162.0 | 162.0 |
| gum_application | HIGH | MED |
| gum_viscosity_sec | 32.0 | 45.0 |
| pasting_pressure | MED | MED |
| drying_hours | 5.0 | 6.0 |
| print_speed_spm | 60.0 | 60.0 |
| rate_warp_pct | 3.63 | 2.004 |
| rate_delam_pct | 2.657 | 2.371 |
| rate_strength_pct | 1.152 | 1.21 |
| rate_print_pct | 2.19 | 1.864 |
| rate_crack_pct | 0.847 | 0.68 |
| total_scrap_pct | 10.48 | 8.13 |
| scrap_kg | 103.4 | 80.2 |
| scrap_cost | 5509.0 | 4274.0 |
| penalty | 0.0 | 200.0 |
| total_cost | 5509.0 | 4474.0 |
| currency | INR | INR |
| primary_defect | WARP | DELAM |
| savings_kg | 0.0 | 23.2 |
| savings_cost | 0.0 | 1035.0 |

Run B, moisture 7.3%:

| Field | BASELINE | BEST |
|---|---|---|
| n_changes | 0 | 3 |
| sf_speed_mpm | 48.0 | 48.0 |
| roll_temp_c | 162.0 | 170.0 |
| gum_application | HIGH | MED |
| gum_viscosity_sec | 32.0 | 45.0 |
| pasting_pressure | MED | MED |
| drying_hours | 5.0 | 5.0 |
| print_speed_spm | 60.0 | 60.0 |
| rate_warp_pct | 3.193 | 2.204 |
| rate_delam_pct | 2.031 | 1.778 |
| rate_strength_pct | 1.118 | 1.153 |
| rate_print_pct | 1.923 | 1.584 |
| rate_crack_pct | 0.744 | 0.618 |
| total_scrap_pct | 9.01 | 7.34 |
| scrap_kg | 88.9 | 72.4 |
| scrap_cost | 4737.0 | 3858.0 |
| penalty | 0.0 | 0.0 |
| total_cost | 4737.0 | 3858.0 |
| currency | INR | INR |
| primary_defect | WARP | WARP |
| savings_kg | 0.0 | 16.5 |
| savings_cost | 0.0 | 879.0 |

### Comparison

| | Old (15 Oct, m_*, 10.8%) | m2_*, 10.8% | m2_*, 7.3% |
|---|---|---|---|
| Job | ustad_pkbx0041_acceptance_100m_20261015 | arc_pkbx0041_m2_moist108_20261122T175049Z | arc_pkbx0041_m2_moist73_20261122T175049Z |
| Baseline scrap | 10.18% / 100.4 kg | 10.48% / 103.4 kg | 9.01% / 88.9 kg |
| Baseline cost | ₹5,351 | ₹5,509 | ₹4,737 |
| Recommended scrap | 8.42% / 83.0 kg | 8.13% / 80.2 kg | 7.34% / 72.4 kg |
| Recommended scrap cost | ₹4,426 | ₹4,274 | ₹3,858 |
| Slower-production allowance | ₹0 | ₹200 (1 extra drying hour) | ₹0 |
| Recommended total cost | ₹4,426 | ₹4,474 | ₹3,858 |
| Reduction (kg) | 17.4 kg | 23.2 kg | 16.5 kg |
| Reduction (₹, total cost, as the app shows it) | ₹925 | ₹1,035 | ₹879 |
| Lever changes | roll 162→170, gum HIGH→MED, viscosity 32→35 | gum HIGH→MED, viscosity 32→45, drying 5→6 h | roll 162→170, gum HIGH→MED, viscosity 32→45 |
| Primary defect (baseline → recommended) | WARP → WARP | WARP → DELAM | WARP → WARP |

Arithmetic checks (from the returned rows): savings_kg equals baseline scrap_kg minus BEST scrap_kg, and savings_cost equals baseline total_cost minus BEST total_cost, in both runs. scrap_cost + penalty = total_cost on every row. scrap_cost / scrap_kg is about ₹53.3/kg on every row, the same as in October (5351 / 100.4), which suggests `plants.cost_per_kg` is unchanged. That ratio is inferred from the rows; the plant table was not read directly. The Run A ₹1,035 is net of the ₹200 drying allowance; the scrap-cost reduction alone is ₹1,235. The allowance is the SQL's linear heuristic, not a measured cost.

`tools/validate-optimizer-acceptance.mjs` was run locally on both saved outputs. Both fail against the frozen October expectations (14 differing fields at 10.8%, 11 at 7.3%), as expected, since that tool pins the old values. The rows were not passed through the app's `decodeOptimizationResult`. Its checks were applied by hand (penalty formula, grid membership, at most three changes, savings consistency, rates within 0 to 25), and both runs satisfy them.

### Provenance

**Model estimate on m2_* models, not a measured saving.** The training data is modeled production history built on the real item master, not plant measurements. Moisture, humidity and temperature are fixed test inputs, not sensor readings or operator entries.

## Open points for the founders and Om

1. The published 100.4 kg / ₹5,351 → 83.0 kg / ₹4,426 (17.4 kg, ₹925) figure does not reproduce on the current models. It is an m_* result at 10.8% moisture. Showing it next to "moisture 7.3% (example)" pairs it with an input it was not produced from. Any number shown with 7.3% should come from Run B, or from a fresh run at demo time.
2. Run B keeps RH 86% and changes only moisture, as instructed. In `config/condition-ranges.json` the monthly median paper moisture is about 10.9% in the months when RH is about 86% (June to September), and about 6.5 to 7% when RH is 35 to 42%. Both values are inside the recorded ranges (moisture 5.0 to 12.0%, RH 25 to 98%), but 86% RH with 7.3% moisture is an unusual pairing in the modeled history. Om should confirm whether it is a realistic demo condition, or whether the default RH should also change.
3. The app's default optimizer cap of 80 MiB (`readOptimizerQueryBudget`, `src/service-ports.js`) is below the 90 MiB this script is billed. The live services work only because `USTAAD_OPTIMIZER_MAX_BYTES_BILLED` is set to 100 MiB. A deployment without that variable would fail on every optimizer call. No change was made here.

## Display reference at 7.3% moisture with matching ambient conditions

**Status: superseded on 2026-11-23 by the Final reference at the top of this file (18.5 °C).** Kept as history. Do not use these figures.

Founder decision (2026-11-22, relayed by the coordinator): the on-screen reference case is the 7.3% paper moisture run, and its humidity must be realistic for 7.3% moisture rather than 86%. Runs A and B above stay unchanged as the record.

### Plan (written before running)

Step 1 finds the ambient conditions that go with 7.3% moisture in the modeled history. It is one read-only SELECT over `prepagent-hack.prepagent.lots`, with the band paper_moisture_pct 7.0 to 7.6% inclusive. It returns:
- the row count, date range, min and max, 25th, 50th and 75th percentiles of RH and of temperature;
- counts and mean RH and temperature by calendar month;
- the correlation of moisture with RH and with temperature over all lots, to show whether temperature is paired with moisture the way RH is.

The query uses all lots, as `config/condition-ranges.json` does, and reports how many band rows have a `TEST` lot ID prefix. Dry run: 235,400 bytes processed, statement type SELECT, no destination table other than BigQuery's anonymous cache. Cap 20,000,000 bytes, as for `config/condition-ranges.json`. Expected bill is the 10 MiB minimum. Query file SHA-256: `6ad4bf3507c67d7a930f755fd13f15cf55ed174af7362d1ea6000a07e7be577d`.

```sql
-- Ambient conditions that go with paper moisture 7.0..7.6 % (inclusive) in prepagent.lots
WITH band AS (
  SELECT run_date, ambient_rh_pct AS rh, ambient_temp_c AS t, lot_id
  FROM `prepagent-hack.prepagent.lots`
  WHERE paper_moisture_pct BETWEEN 7.0 AND 7.6
),
q AS (
  SELECT DISTINCT
    PERCENTILE_CONT(rh, 0.25) OVER () AS rh_p25, PERCENTILE_CONT(rh, 0.5) OVER () AS rh_p50,
    PERCENTILE_CONT(rh, 0.75) OVER () AS rh_p75,
    PERCENTILE_CONT(t, 0.25) OVER () AS t_p25, PERCENTILE_CONT(t, 0.5) OVER () AS t_p50,
    PERCENTILE_CONT(t, 0.75) OVER () AS t_p75
  FROM band
),
m AS (
  SELECT EXTRACT(MONTH FROM run_date) AS month, COUNT(*) AS n,
    ROUND(AVG(rh), 2) AS rh_mean, ROUND(AVG(t), 2) AS t_mean
  FROM band GROUP BY month
),
allc AS (
  SELECT CORR(paper_moisture_pct, ambient_rh_pct) AS corr_moist_rh,
    CORR(paper_moisture_pct, ambient_temp_c) AS corr_moist_t, COUNT(*) AS all_rows
  FROM `prepagent-hack.prepagent.lots`
)
SELECT
  (SELECT COUNT(*) FROM band) AS band_rows,
  (SELECT COUNTIF(STARTS_WITH(lot_id, 'TEST')) FROM band) AS band_test_rows,
  (SELECT MIN(run_date) FROM band) AS first_date, (SELECT MAX(run_date) FROM band) AS last_date,
  (SELECT MIN(rh) FROM band) AS rh_min, (SELECT MAX(rh) FROM band) AS rh_max,
  (SELECT MIN(t) FROM band) AS t_min, (SELECT MAX(t) FROM band) AS t_max,
  ROUND(q.rh_p25, 2) AS rh_p25, ROUND(q.rh_p50, 2) AS rh_median, ROUND(q.rh_p75, 2) AS rh_p75,
  ROUND(q.t_p25, 2) AS t_p25, ROUND(q.t_p50, 2) AS t_median, ROUND(q.t_p75, 2) AS t_p75,
  ROUND(allc.corr_moist_rh, 3) AS corr_moist_rh_all_lots,
  ROUND(allc.corr_moist_t, 3) AS corr_moist_temp_all_lots, allc.all_rows,
  ARRAY(SELECT AS STRUCT * FROM m ORDER BY month) AS by_month
FROM q, allc;
```

Command: `bq --project_id=prepagent-hack --location=asia-south1 query --nouse_legacy_sql --maximum_bytes_billed=20000000 --format=prettyjson --job_id=arc_moisture73_band_<utc> < band.sql`

Step 2 re-runs `sql/optimize.sql` with paper moisture 7.3%, the band's median RH and median temperature (rounded to one decimal place, as the inputs above are), and every other input unchanged from Runs A and B. It uses the same command as before, with a 100 MiB cap (`--maximum_bytes_billed=104857600`). The job ID is `arc_pkbx0041_m2_moist73_rh<rh>_t<t>_<utc>`, with the decimal point dropped from the RH and temperature values. Expected bill is 90 MiB, the same as Runs A and B.

Rollback: none needed. Both steps are read-only, and no table, view, model or setting is created or changed.

### Step 1 result: ambient conditions for moisture 7.0 to 7.6%

Job `arc_moisture73_band_20261122T175459Z`: 235,400 bytes processed, 10,485,760 bytes billed (the minimum), state DONE.

| Measure | Value |
|---|---|
| Lots in band (of 5,350) | 671 (0 with a `TEST` lot ID prefix) |
| Run dates | 2024-10-03 to 2026-05-31 |
| RH median / IQR / range | 42.0% / 37.75 to 46.6% / 25.5 to 63.7% |
| Temperature median / IQR / range | 24.5 °C / 17.8 to 28.95 °C / 6.1 to 39.9 °C |
| Correlation of moisture with RH, all lots | 0.954 |
| Correlation of moisture with temperature, all lots | −0.105 |

By month (number of lots, mean RH, mean temperature): Jan 119, 43.26%, 19.26 °C. Feb 112, 42.16%, 19.0 °C. Mar 82, 39.32%, 30.27 °C. Apr 89, 40.13%, 30.42 °C. May 88, 38.99%, 31.24 °C. Oct 23, 54.96%, 23.58 °C. Nov 25, 55.23%, 24.87 °C. Dec 133, 42.93%, 18.53 °C. No lots from June to September fall in the band.

Humidity is paired with moisture: the correlation is 0.954, the IQR is narrow, and every month's mean RH is between 39 and 55%. **Temperature is not paired the same way.** The correlation is −0.105, and the band covers two seasonal groups: about 18.5 to 19.3 °C in December to February (364 lots) and about 30.3 to 31.2 °C in March to May (259 lots). The median of 24.5 °C falls between them and matches only October and November (48 lots, mean 23.6 to 24.9 °C). It is the median of the band, as instructed, but not a typical day for 7.3% moisture. Om should choose between 24.5 °C, about 19 °C (winter) and about 30.5 °C (pre-monsoon). The optimizer result was not tested at either alternative (NOT RUN).

Chosen inputs: RH 42.0% (band median) and temperature 24.5 °C (band median). Source: modeled lot history in `prepagent.lots`. These are not plant sensor readings or public weather records.

### Step 2 result: optimizer at 7.3% moisture, 42.0% RH, 24.5 °C

Job `arc_pkbx0041_m2_moist73_rh420_t245_20261122T175518Z`: SCRIPT, cap 104,857,600 bytes, state DONE, 351,636 bytes processed, 94,371,840 bytes billed. Both ASSERTs passed. The stored job parameters confirm item_code PKBX0041, quantity 1300, RECYCLED, SUP-D, DAY, ambient_rh_pct 42.0, ambient_temp_c 24.5, paper_moisture_pct 7.3, levers 48/162/HIGH/32/MED/5/60. Models and SQL are the same as in Runs A and B.

| Field | BASELINE | BEST |
|---|---|---|
| n_changes | 0 | 3 |
| sf_speed_mpm | 48.0 | 48.0 |
| roll_temp_c | 162.0 | 170.0 |
| gum_application | HIGH | MED |
| gum_viscosity_sec | 32.0 | 45.0 |
| pasting_pressure | MED | MED |
| drying_hours | 5.0 | 5.0 |
| print_speed_spm | 60.0 | 60.0 |
| rate_warp_pct | 1.463 | 1.044 |
| rate_delam_pct | 1.724 | 1.66 |
| rate_strength_pct | 0.71 | 0.706 |
| rate_print_pct | 1.754 | 1.472 |
| rate_crack_pct | 0.624 | 0.561 |
| total_scrap_pct | 6.27 | 5.44 |
| scrap_kg | 61.9 | 53.7 |
| scrap_cost | 3299.0 | 2862.0 |
| penalty | 0.0 | 0.0 |
| total_cost | 3299.0 | 2862.0 |
| currency | INR | INR |
| primary_defect | PRINT | DELAM |
| savings_kg | 0.0 | 8.2 |
| savings_cost | 0.0 | 437.0 |

Summary: baseline 6.27% / 61.9 kg / ₹3,299. Recommended 5.44% / 53.7 kg / ₹2,862. Reduction 8.2 kg and ₹437. The slower-production allowance is ₹0, so the ₹437 is all scrap cost. The lever changes are roll temperature 162 → 170 °C, gum application HIGH → MED and gum viscosity 32 → 45 s. Drying time is unchanged, so the designs' "Keep drying time as entered" constraint still holds. All five defect rates fall, so the recommendation has no trade-off: strength goes from 0.710 to 0.706, where it rose by 0.078 points in October. The largest baseline rate is PRINT at 1.754%, just ahead of DELAM at 1.724% and WARP at 1.463%. After the changes, DELAM is the largest at 1.660%. The top two baseline rates are 0.03 points apart, which is well inside model error. Copy should not put weight on which defect is "main".

Checks: 61.9 − 53.7 = 8.2 and 3,299 − 2,862 = 437, matching savings_kg and savings_cost. scrap_cost / scrap_kg = ₹53.3/kg, as in all earlier runs. 8,640 candidates (5 × 4 × 3 × 3 × 2 × 6 × 4), the same as the "8,640 combinations" in the designs.

Provenance: **model estimate on m2_* models, not a measured saving.** The conditions are a proposed display reference taken from modeled history and are pending Om's sign-off on plant realism.

### Places that show the old case values

Found by searching `README.md`, `src/`, `web/` (excluding `node_modules` and the built `public/app` bundle), `public/`, and the design HTML sources in `docs/arc/design/source/html/{light,dark}/`. Each HTML source matches the PNG of the same name in `docs/arc/design/light/` and `docs/arc/design/dark/`; NewLot-Settings.png was checked by eye. Every design screen below exists in both light and dark versions, so each row covers two PNGs. Nothing was edited. "New" is the proposed display reference above and is still pending Om's sign-off.

| Location | Shows now | New value |
|---|---|---|
| `README.md` line 26 | 100.4 kg / ₹5,351 → 83.0 kg / ₹4,426; 17.4 kg and ₹925 | 61.9 kg / ₹3,299 → 53.7 kg / ₹2,862; 8.2 kg and ₹437 (and the sentence should name m2_* models and 7.3% / 42% / 24.5 °C) |
| `src/ui/workflow.js` line 1933 (`DEMO_LOT`, comment above says "a humid monsoon day") | RH "86", temperature "26", moisture "10.8" | RH "42", temperature "24.5", moisture "7.3" (the comment would no longer be true) |
| `web/src/screens/Lots.tsx` lines 217 to 219 | Placeholders "e.g. 65", "e.g. 26", "e.g. 8.5" | Placeholder text, not the case. 26 °C there is not tied to this case. No change needed unless the founders want the placeholders to match (42, 24.5, 7.3) |
| NewLot-Settings | 100.4 → 83.0 kg; 17.4 kg and ₹925; entered 100.4 kg ₹5,351; recommended 83.0 kg ₹4,426; viscosity 32 s → 35 s; "Strength risk rises 0.078 points" (toast and trade-off card) | 61.9 → 53.7 kg; 8.2 kg and ₹437; 61.9 kg ₹3,299; 53.7 kg ₹2,862; 32 s → 45 s; no trade-off (all five risks fall) |
| Arc-Lot-Compare | 100.4 → 83.0 kg; 17.4 kg and ₹925; viscosity 32 s → 35 s; "Strength risk rises 0.078" | 61.9 → 53.7 kg; 8.2 kg and ₹437; 32 s → 45 s; no trade-off |
| Insights | Modeled scrap 83.0 kg, down from 100.4 kg; modeled saving ₹925; entered ₹5,351 / recommended ₹4,426; viscosity 32 → 35 s; "Strength +0.078 points"; "three settings, one trade-off"; "What moved the Warp estimate" attribution (Humidity +0.751, Drying +0.162, Gum −0.137 pts) | 53.7 kg, down from 61.9 kg; ₹437; ₹3,299 / ₹2,862; 32 → 45 s; no strength rise and no trade-off. Attribution values: NOT RUN, they come from `sql/explain.sql`, which was not run here. Also, warp is no longer the largest baseline risk |
| Main | Reference run 100.4 → 83.0 kg; "Humidity 86% confirmed" (twice); "Conditions confirmed Humidity 86%"; viscosity 32 → 35 s | 61.9 → 53.7 kg; Humidity 42%; 32 → 45 s |
| NewLot-Approve | Modeled scrap 100.4 → 83.0 kg; "Humidity 86%, moisture 7.3% (example)"; viscosity 35 s, was 32 s | 61.9 → 53.7 kg; "Humidity 42%, moisture 7.3% (example)"; 45 s, was 32 s |
| NewLot-Recovery | Viscosity 32 s → 35 s; modeled scrap 100.4 → 83.0 kg | 32 s → 45 s; 61.9 → 53.7 kg |
| Arc-No-Data | Scrap for PKBX0041 100.4 → 83.0 kg | 61.9 → 53.7 kg |
| NewLot-Conditions | Humidity 86% (confirmed by operator); temperature left blank | 42%; temperature 24.5 °C if the founders want it pre-filled (pending Om) |
| Arc-Lot-Conditions | Humidity 86%; temperature blank | 42% |
| Arc-Answer-Value | Humidity 86% next to moisture 7.3%; temperature "Not entered" | 42% |
| Arc-Phone | Humidity 86% next to moisture 7.3%; temperature "Not entered" | 42% |
| Plant-Explorer | "86% humidity confirmed"; viscosity 32 s → 35 s; "Historical evidence: modeled lots, humid days" | 42%; 32 s → 45 s; "humid days" no longer describes the case |
| Arc-Lot-Approve | Gum viscosity 32 → 35 s; "Trade-off: strength risk rises 0.07…" | 32 → 45 s; no trade-off |
| NewLot-Stale | Gum viscosity 35 s, was 32 s | 45 s, was 32 s |
| Operator-Phone | Gum viscosity changed, 35 s, was 32 s | 45 s, was 32 s |

Roll temperature 162 → 170 °C, gum HIGH → MEDIUM, "3 of 7 settings" and "8,640 combinations" stay the same in every screen. No design shows 26 °C; temperature is blank in the designs.

Outside this case but seen while checking: the "How far to trust this" panels (NewLot-Settings, Arc-Answer-Chart, Insights, Main) show the old m_* holdout R² values (0.40, 0.50, 0.30, 0.61, −0.01). The m2_* values in `config/model-acceptance.json` are 0.47, 0.52, 0.39, 0.64 and 0.11.
