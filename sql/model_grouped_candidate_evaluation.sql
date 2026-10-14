-- Read-only evaluation of separately trained customer-grouped candidates.
-- Candidate model resource names are immutable version identifiers: training
-- uses CREATE MODEL (never CREATE OR REPLACE) and distinct *_grouped_v1 names.
-- This does not call ML.PREDICT on active models or change model resources.
-- BigQuery execution may incur charges.
WITH grouped_evaluation_rows AS (
  SELECT
    *,
    MOD(MOD(FARM_FINGERPRINT(customer_id), 100) + 100, 100) AS evaluation_bucket
  FROM `prepagent-hack.prepagent.lots`
  WHERE run_date < DATE '2026-09-01'
),
evaluation_counts AS (
  SELECT
    'customer-fingerprint-mod100-lt51-v1' AS split_id,
    'prepagent-hack.prepagent.lots' AS evaluated_dataset,
    DATE '2026-09-01' AS training_cutoff_exclusive,
    MIN(IF(evaluation_bucket < 51, run_date, NULL)) AS evaluation_start_date,
    MAX(IF(evaluation_bucket < 51, run_date, NULL)) AS evaluation_end_date,
    COUNTIF(evaluation_bucket >= 51) AS training_rows,
    COUNTIF(evaluation_bucket < 51) AS evaluation_rows,
    COUNT(DISTINCT IF(evaluation_bucket >= 51, customer_id, NULL)) AS training_customers,
    COUNT(DISTINCT IF(evaluation_bucket < 51, customer_id, NULL)) AS evaluation_customers
  FROM grouped_evaluation_rows
)
SELECT
  'm_warp_grouped_v1' AS model_name,
  'm_warp_grouped_v1' AS model_version,
  counts.*,
  metrics.*
FROM ML.EVALUATE(
  MODEL `prepagent-hack.prepagent.m_warp_grouped_v1`,
  (
    SELECT * EXCEPT (
      lot_id, order_id, customer_id, item_code, run_date, evaluation_bucket,
      rate_delam_pct, rate_strength_pct, rate_print_pct, rate_crack_pct,
      total_scrap_kg, scrap_cost, currency, primary_defect
    )
    FROM grouped_evaluation_rows
    WHERE evaluation_bucket < 51
  )
) AS metrics
CROSS JOIN evaluation_counts AS counts
UNION ALL
SELECT
  'm_delam_grouped_v1' AS model_name,
  'm_delam_grouped_v1' AS model_version,
  counts.*,
  metrics.*
FROM ML.EVALUATE(
  MODEL `prepagent-hack.prepagent.m_delam_grouped_v1`,
  (
    SELECT * EXCEPT (
      lot_id, order_id, customer_id, item_code, run_date, evaluation_bucket,
      rate_warp_pct, rate_strength_pct, rate_print_pct, rate_crack_pct,
      total_scrap_kg, scrap_cost, currency, primary_defect
    )
    FROM grouped_evaluation_rows
    WHERE evaluation_bucket < 51
  )
) AS metrics
CROSS JOIN evaluation_counts AS counts
UNION ALL
SELECT
  'm_strength_grouped_v1' AS model_name,
  'm_strength_grouped_v1' AS model_version,
  counts.*,
  metrics.*
FROM ML.EVALUATE(
  MODEL `prepagent-hack.prepagent.m_strength_grouped_v1`,
  (
    SELECT * EXCEPT (
      lot_id, order_id, customer_id, item_code, run_date, evaluation_bucket,
      rate_warp_pct, rate_delam_pct, rate_print_pct, rate_crack_pct,
      total_scrap_kg, scrap_cost, currency, primary_defect
    )
    FROM grouped_evaluation_rows
    WHERE evaluation_bucket < 51
  )
) AS metrics
CROSS JOIN evaluation_counts AS counts
UNION ALL
SELECT
  'm_print_grouped_v1' AS model_name,
  'm_print_grouped_v1' AS model_version,
  counts.*,
  metrics.*
FROM ML.EVALUATE(
  MODEL `prepagent-hack.prepagent.m_print_grouped_v1`,
  (
    SELECT * EXCEPT (
      lot_id, order_id, customer_id, item_code, run_date, evaluation_bucket,
      rate_warp_pct, rate_delam_pct, rate_strength_pct, rate_crack_pct,
      total_scrap_kg, scrap_cost, currency, primary_defect
    )
    FROM grouped_evaluation_rows
    WHERE evaluation_bucket < 51
  )
) AS metrics
CROSS JOIN evaluation_counts AS counts
UNION ALL
SELECT
  'm_crack_grouped_v1' AS model_name,
  'm_crack_grouped_v1' AS model_version,
  counts.*,
  metrics.*
FROM ML.EVALUATE(
  MODEL `prepagent-hack.prepagent.m_crack_grouped_v1`,
  (
    SELECT * EXCEPT (
      lot_id, order_id, customer_id, item_code, run_date, evaluation_bucket,
      rate_warp_pct, rate_delam_pct, rate_strength_pct, rate_print_pct,
      total_scrap_kg, scrap_cost, currency, primary_defect
    )
    FROM grouped_evaluation_rows
    WHERE evaluation_bucket < 51
  )
) AS metrics
CROSS JOIN evaluation_counts AS counts
ORDER BY model_name;
