-- Mutating, billable preparation only. Do not run without a separately
-- approved model-training operation; the candidate names intentionally never
-- replace the existing m_* models.
DECLARE evaluation_bucket_limit INT64 DEFAULT 51;

CREATE TEMP TABLE grouped_training_rows AS
SELECT
  *,
  MOD(MOD(FARM_FINGERPRINT(customer_id), 100) + 100, 100) AS evaluation_bucket
FROM `prepagent-hack.prepagent.lots`
WHERE run_date < DATE '2026-09-01';

ASSERT (SELECT COUNT(*) FROM grouped_training_rows) > 0
  AS 'No pre-September training rows are available.';
ASSERT (
  SELECT COUNTIF(customer_id IS NULL OR TRIM(customer_id) = '')
  FROM grouped_training_rows
) = 0 AS 'Customer-group evaluation requires a non-empty customer_id on every row.';
ASSERT (
  SELECT COUNT(DISTINCT customer_id)
  FROM grouped_training_rows
  WHERE evaluation_bucket < evaluation_bucket_limit
) >= 5 AS 'The grouped evaluation holdout must contain at least five customers.';
ASSERT (
  SELECT COUNT(DISTINCT customer_id)
  FROM grouped_training_rows
  WHERE evaluation_bucket >= evaluation_bucket_limit
) >= 5 AS 'The grouped training partition must contain at least five customers.';
ASSERT (
  SELECT COUNT(*)
  FROM (
    SELECT DISTINCT customer_id
    FROM grouped_training_rows
    WHERE evaluation_bucket < evaluation_bucket_limit
    INTERSECT DISTINCT
    SELECT DISTINCT customer_id
    FROM grouped_training_rows
    WHERE evaluation_bucket >= evaluation_bucket_limit
  )
) = 0 AS 'A customer may not occur in both grouped partitions.';

-- Identity/date fields, non-target rates, outcomes, and customer_id are
-- excluded; each model retains its own label and scoring-time area/mass inputs.
CREATE MODEL `prepagent-hack.prepagent.m_warp_grouped_v1`
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR',
  input_label_cols = ['rate_warp_pct'],
  data_split_method = 'NO_SPLIT',
  category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = TRUE,
  early_stop = TRUE,
  learn_rate = 0.3,
  max_iterations = 20,
  max_tree_depth = 6,
  min_relative_progress = 0.01,
  l1_reg = 0,
  l2_reg = 1
) AS
SELECT * EXCEPT (
  lot_id, order_id, customer_id, item_code, run_date, evaluation_bucket,
  rate_delam_pct, rate_strength_pct, rate_print_pct, rate_crack_pct,
  total_scrap_kg, scrap_cost, currency, primary_defect
)
FROM grouped_training_rows
WHERE evaluation_bucket >= evaluation_bucket_limit;

CREATE MODEL `prepagent-hack.prepagent.m_delam_grouped_v1`
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR',
  input_label_cols = ['rate_delam_pct'],
  data_split_method = 'NO_SPLIT',
  category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = TRUE,
  early_stop = TRUE,
  learn_rate = 0.3,
  max_iterations = 20,
  max_tree_depth = 6,
  min_relative_progress = 0.01,
  l1_reg = 0,
  l2_reg = 1
) AS
SELECT * EXCEPT (
  lot_id, order_id, customer_id, item_code, run_date, evaluation_bucket,
  rate_warp_pct, rate_strength_pct, rate_print_pct, rate_crack_pct,
  total_scrap_kg, scrap_cost, currency, primary_defect
)
FROM grouped_training_rows
WHERE evaluation_bucket >= evaluation_bucket_limit;

CREATE MODEL `prepagent-hack.prepagent.m_strength_grouped_v1`
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR',
  input_label_cols = ['rate_strength_pct'],
  data_split_method = 'NO_SPLIT',
  category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = TRUE,
  early_stop = TRUE,
  learn_rate = 0.3,
  max_iterations = 20,
  max_tree_depth = 6,
  min_relative_progress = 0.01,
  l1_reg = 0,
  l2_reg = 1
) AS
SELECT * EXCEPT (
  lot_id, order_id, customer_id, item_code, run_date, evaluation_bucket,
  rate_warp_pct, rate_delam_pct, rate_print_pct, rate_crack_pct,
  total_scrap_kg, scrap_cost, currency, primary_defect
)
FROM grouped_training_rows
WHERE evaluation_bucket >= evaluation_bucket_limit;

CREATE MODEL `prepagent-hack.prepagent.m_print_grouped_v1`
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR',
  input_label_cols = ['rate_print_pct'],
  data_split_method = 'NO_SPLIT',
  category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = TRUE,
  early_stop = TRUE,
  learn_rate = 0.3,
  max_iterations = 20,
  max_tree_depth = 6,
  min_relative_progress = 0.01,
  l1_reg = 0,
  l2_reg = 1
) AS
SELECT * EXCEPT (
  lot_id, order_id, customer_id, item_code, run_date, evaluation_bucket,
  rate_warp_pct, rate_delam_pct, rate_strength_pct, rate_crack_pct,
  total_scrap_kg, scrap_cost, currency, primary_defect
)
FROM grouped_training_rows
WHERE evaluation_bucket >= evaluation_bucket_limit;

CREATE MODEL `prepagent-hack.prepagent.m_crack_grouped_v1`
OPTIONS (
  model_type = 'BOOSTED_TREE_REGRESSOR',
  input_label_cols = ['rate_crack_pct'],
  data_split_method = 'NO_SPLIT',
  category_encoding_method = 'LABEL_ENCODING',
  enable_global_explain = TRUE,
  early_stop = TRUE,
  learn_rate = 0.3,
  max_iterations = 20,
  max_tree_depth = 6,
  min_relative_progress = 0.01,
  l1_reg = 0,
  l2_reg = 1
) AS
SELECT * EXCEPT (
  lot_id, order_id, customer_id, item_code, run_date, evaluation_bucket,
  rate_warp_pct, rate_delam_pct, rate_strength_pct, rate_print_pct,
  total_scrap_kg, scrap_cost, currency, primary_defect
)
FROM grouped_training_rows
WHERE evaluation_bucket >= evaluation_bucket_limit;

SELECT
  'customer-fingerprint-mod100-lt51-v1' AS split_id,
  COUNT(*) AS total_rows,
  COUNTIF(evaluation_bucket >= evaluation_bucket_limit) AS training_rows,
  COUNTIF(evaluation_bucket < evaluation_bucket_limit) AS evaluation_rows,
  COUNT(DISTINCT IF(evaluation_bucket >= evaluation_bucket_limit, customer_id, NULL)) AS training_customers,
  COUNT(DISTINCT IF(evaluation_bucket < evaluation_bucket_limit, customer_id, NULL)) AS evaluation_customers
FROM grouped_training_rows;
