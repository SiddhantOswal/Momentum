# D4: Evaluation provenance

Chain: **source table → training SQL → training job → BigQuery model → Vertex version → evaluation → metrics**

## Source data
| Item | Value |
|---|---|
| Table | `prepagent-hack.prepagent.lots` (asia-south1), partitioned by `run_date` |
| Origin | Modelled production history from `generator.ts` (seed 20261010), built on `prepagent.items` (117 real plant items). Loaded 11 Oct 2026 with `bq load`. |
| Training window | 2024-10-01 to 2026-08-31 · **5,131 rows** · fingerprint `-5765157229033313959` |
| Holdout window | 2026-09-01 to 2026-09-30 · **219 rows** · fingerprint `4806831653848498529` |
| Fingerprint method | `BIT_XOR(FARM_FINGERPRINT(TO_JSON_STRING(row)))`, all columns except `scrap_cost` |
| Changes after training | `scrap_cost` re-priced on 13 Oct (Rs 45 → 53.30/kg). Not a feature or label, so excluded from the fingerprint. No other updates. TEST rows: 0. |
| Missing data | None. The generator writes complete rows; the sanity checks recorded 0 NaN/Infinity rows. |

## Training
- **Script job:** `bqjob_r4cfdf43fbdc1dad1_000001a12c5223a4_1`, run from Cloud Shell with `bq query < train.sql` on 11 Oct 2026 (2,373 s).
- **Options for each model:** `BOOSTED_TREE_REGRESSOR`, `data_split_method='RANDOM'`, `data_split_eval_fraction=0.2`, `enable_global_explain=TRUE`, `model_registry='VERTEX_AI'`, `vertex_ai_model_id='prepagent_<defect>'`. All other options are BQML defaults (no tuning).
- **Input:** `SELECT * EXCEPT (lot_id, order_id, run_date, item_code, <other four rates>, total_scrap_kg, scrap_cost, currency, primary_defect) FROM prepagent.lots WHERE run_date < DATE '2026-09-01'`.

| Model | Child job | Start (UTC) | End (UTC) | BQ model created | Vertex v1 created | SQL SHA-256 |
|---|---|---|---|---|---|---|
| `m_warp` | `script_job_ebc8bce775a9865457344d191a15497f_0` | 2026-10-11 18:55:43.477+00 | 2026-10-11 19:17:48.298+00 | 2026-10-11T19:17:48Z | 2026-10-11T19:01:19.116689Z | `dcdecf00ace15a7b…` |
| `m_delam` | `script_job_7353ca4bc168eb6bbb0c90cf9bc1f133_1` | 2026-10-11 19:17:48.754+00 | 2026-10-11 19:20:38.351+00 | 2026-10-11T19:20:38Z | 2026-10-11T19:18:08.381123Z | `1312f2c1c677c39b…` |
| `m_strength` | `script_job_9054a1fd60f5c3ce155ff22f290c7bb3_2` | 2026-10-11 19:20:38.866+00 | 2026-10-11 19:25:27.436+00 | 2026-10-11T19:25:27Z | 2026-10-11T19:20:58.963683Z | `8b40cbb3b1642f75…` |
| `m_print` | `script_job_ccd81227355eb3f28fb81d6ec3cc08d2_3` | 2026-10-11 19:25:27.855+00 | 2026-10-11 19:30:11.663+00 | 2026-10-11T19:30:11Z | 2026-10-11T19:25:46.485907Z | `b2c990b2e3f60d61…` |
| `m_crack` | `script_job_6ba85af79147a8ba3d7e811e95979495_4` | 2026-10-11 19:30:13.114+00 | 2026-10-11 19:35:02.378+00 | 2026-10-11T19:35:02Z | 2026-10-11T19:30:34.435898Z | `1833b64169feafd3…` |

Full SQL hashes are in `D4_MODEL_EVIDENCE.json`. The exact SQL text can be retrieved from `INFORMATION_SCHEMA.JOBS_BY_USER` (query 2 in `D4_REPRODUCIBILITY.sql`).

## Model ↔ Vertex linkage
`bq show --model` for each model reports `trainingRuns[0].vertexAiModelId = projects/514663464609/locations/asia-south1/models/prepagent_<defect>` and `vertexAiModelVersion = 1`. `gcloud ai models list` shows the same IDs with version 1. Each Vertex create time falls inside that model's training job. The link is one to one.

## Evaluations
1. **Original internal split:** `ML.EVALUATE(MODEL m)` with no input, which reads the metrics stored from the 11 Oct training run. The split tables:

| Model | Evaluation split table | Status on 16 Oct |
|---|---|---|
| `m_warp` | `anonb29c4810_8e57_47d9_9ec1_d2b85c7bc9f2_imported_data_split_eval_data` | Not found (deleted by BigQuery) |
| `m_delam` | `anone77b9b32_cfa3_41ff_a568_f81629bbd281_imported_data_split_eval_data` | Not found (deleted by BigQuery) |
| `m_strength` | `anon0248cac8_54c1_4545_b59d_cc5f6450536f_imported_data_split_eval_data` | Not found (deleted by BigQuery) |
| `m_print` | `anon9e5df2c0_2f0e_4778_8e4d_1b319c24a212_imported_data_split_eval_data` | Not found (deleted by BigQuery) |
| `m_crack` | `anon70389735_49f9_4db1_914d_9c421492a42e_imported_data_split_eval_data` | Not found (deleted by BigQuery) |

   **The counts are not recoverable.** No historical evaluation job ID exists separately, because BQML computes these metrics inside the training job.

2. **New independent holdout (16 Oct 2026):** `ML.EVALUATE(MODEL m, (SELECT * FROM prepagent.lots WHERE run_date BETWEEN '2026-09-01' AND '2026-09-30'))`, giving **219 lots** per model, the same membership for all five models, and full reproducibility (query 4). Job IDs for these runs can be listed with query 2 using `statement_type = 'SELECT'`.

## Collection artefact
`d4_evidence.tgz` (made by `d4_collect.sh`, 16 Oct) holds the raw outputs: model metadata, training jobs, data fingerprints, both evaluations, full feature importance and the Vertex listing.
