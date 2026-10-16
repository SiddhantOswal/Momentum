-- D4_REPRODUCIBILITY.sql: READ-ONLY checks. No training, no writes.
-- Run each query with: bq query --project_id=prepagent-hack --use_legacy_sql=false --maximum_bytes_billed=1000000000 '<query>'
-- Expected values are from 16 Oct 2026.

-- 1. Training metadata (one row per model, expected 1 iteration set per model)
SELECT * FROM ML.TRAINING_INFO(MODEL prepagent.m_warp);   -- repeat for m_delam, m_strength, m_print, m_crack
-- Model and Vertex linkage (shell, free):  bq --format=prettyjson show --model prepagent-hack:prepagent.m_warp   → trainingRuns[0].vertexAiModelId / vertexAiModelVersion = "1"

-- 2. Training jobs and SQL hashes (expect 5 CREATE_MODEL child jobs of bqjob_r4cfdf43fbdc1dad1_000001a12c5223a4_1)
SELECT job_id, parent_job_id, creation_time, end_time, state, TO_HEX(SHA256(query)) AS sql_sha256
FROM `region-asia-south1`.INFORMATION_SCHEMA.JOBS_BY_USER
WHERE creation_time >= TIMESTAMP '2026-10-11' AND creation_time < TIMESTAMP '2026-10-12' AND statement_type = 'CREATE_MODEL'
ORDER BY creation_time;

-- 3. Data windows and fingerprints
--    expect train_window 5131 rows, 2024-10-01..2026-08-31, -5765157229033313959
--    expect holdout 219 rows, 2026-09-01..2026-09-30, 4806831653848498529
SELECT 'train_window' AS part, COUNT(*) AS rows_n, MIN(run_date) AS first_day, MAX(run_date) AS last_day,
       BIT_XOR(FARM_FINGERPRINT(TO_JSON_STRING(t))) AS fingerprint
FROM (SELECT * EXCEPT (scrap_cost) FROM prepagent.lots WHERE run_date < DATE '2026-09-01' AND (order_id IS NULL OR order_id NOT LIKE 'TEST-%')) t
UNION ALL
SELECT 'holdout_sep_2026', COUNT(*), MIN(run_date), MAX(run_date), BIT_XOR(FARM_FINGERPRINT(TO_JSON_STRING(t)))
FROM (SELECT * EXCEPT (scrap_cost) FROM prepagent.lots WHERE run_date BETWEEN DATE '2026-09-01' AND DATE '2026-09-30' AND (order_id IS NULL OR order_id NOT LIKE 'TEST-%')) t;

-- 4. Internal (original) and holdout (new) evaluation, all five models
--    expected r2 internal / holdout: warp 0.6052/0.4021, delam 0.6664/0.5003, strength 0.4673/0.2971, print 0.7512/0.6102, crack 0.3011/-0.0136
SELECT 'warp' AS model, 'internal_split' AS eval_set, * FROM ML.EVALUATE(MODEL prepagent.m_warp)
UNION ALL SELECT 'warp', 'holdout_sep_2026', * FROM ML.EVALUATE(MODEL prepagent.m_warp,
  (SELECT * FROM prepagent.lots WHERE run_date BETWEEN DATE '2026-09-01' AND DATE '2026-09-30' AND (order_id IS NULL OR order_id NOT LIKE 'TEST-%')))
UNION ALL
SELECT 'delam' AS model, 'internal_split' AS eval_set, * FROM ML.EVALUATE(MODEL prepagent.m_delam)
UNION ALL SELECT 'delam', 'holdout_sep_2026', * FROM ML.EVALUATE(MODEL prepagent.m_delam,
  (SELECT * FROM prepagent.lots WHERE run_date BETWEEN DATE '2026-09-01' AND DATE '2026-09-30' AND (order_id IS NULL OR order_id NOT LIKE 'TEST-%')))
UNION ALL
SELECT 'strength' AS model, 'internal_split' AS eval_set, * FROM ML.EVALUATE(MODEL prepagent.m_strength)
UNION ALL SELECT 'strength', 'holdout_sep_2026', * FROM ML.EVALUATE(MODEL prepagent.m_strength,
  (SELECT * FROM prepagent.lots WHERE run_date BETWEEN DATE '2026-09-01' AND DATE '2026-09-30' AND (order_id IS NULL OR order_id NOT LIKE 'TEST-%')))
UNION ALL
SELECT 'print' AS model, 'internal_split' AS eval_set, * FROM ML.EVALUATE(MODEL prepagent.m_print)
UNION ALL SELECT 'print', 'holdout_sep_2026', * FROM ML.EVALUATE(MODEL prepagent.m_print,
  (SELECT * FROM prepagent.lots WHERE run_date BETWEEN DATE '2026-09-01' AND DATE '2026-09-30' AND (order_id IS NULL OR order_id NOT LIKE 'TEST-%')))
UNION ALL
SELECT 'crack' AS model, 'internal_split' AS eval_set, * FROM ML.EVALUATE(MODEL prepagent.m_crack)
UNION ALL SELECT 'crack', 'holdout_sep_2026', * FROM ML.EVALUATE(MODEL prepagent.m_crack,
  (SELECT * FROM prepagent.lots WHERE run_date BETWEEN DATE '2026-09-01' AND DATE '2026-09-30' AND (order_id IS NULL OR order_id NOT LIKE 'TEST-%')))
;

-- 5. Feature importance (expect 29 rows each; top features as in D4_FEATURE_IMPORTANCE_REVIEW.md)
SELECT * FROM ML.FEATURE_IMPORTANCE(MODEL prepagent.m_warp) ORDER BY importance_gain DESC;   -- repeat for each model

-- 6. Holdout membership, identical for all five models (expect 219)
SELECT COUNT(*) AS holdout_members FROM prepagent.lots
WHERE run_date BETWEEN DATE '2026-09-01' AND DATE '2026-09-30' AND (order_id IS NULL OR order_id NOT LIKE 'TEST-%');
