-- predict_defect.sql: per-defect fallback used only when the combined predict.sql job fails.
-- It is appended to predict.sql's spec, rh_scenarios and input CTEs, so the input row and the RH-5/RH+5
-- band are identical to the combined query. {{MODEL}} and {{PREDICTED_COLUMN}} are filled only from the
-- fixed defect whitelist in src/google-cloud/risk-prediction-service.js, never from request input.
-- Extra param: @defect (WARP, DELAM, STRENGTH, PRINT or CRACK) for the no-ink PRINT rule and the output row.
m AS (SELECT rh_scenario, {{PREDICTED_COLUMN}} AS v FROM ML.PREDICT(MODEL {{MODEL}}, (SELECT * FROM input))),
scenario_rates AS (
  SELECT i.rh_scenario, i.ambient_rh_pct, i.quantity, i.box_weight_kg,
    IF(@defect = 'PRINT' AND i.ink_colors = 0, 0, GREATEST(m.v, 0)) AS r
  FROM input i JOIN m USING (rh_scenario)
)
SELECT
  @item_code AS item_code,
  @defect AS defect,
  ROUND(MAX(IF(rh_scenario = 'CENTRAL', r, NULL)), 3) AS rate_pct,
  ROUND(MIN(r), 3) AS rate_low_pct,
  ROUND(MAX(r), 3) AS rate_high_pct,
  ROUND(MIN(ambient_rh_pct), 2) AS rh_band_low_pct,
  ROUND(MAX(ambient_rh_pct), 2) AS rh_band_high_pct,
  MAX(IF(rh_scenario = 'CENTRAL', quantity * box_weight_kg, NULL)) AS lot_board_kg,
  ANY_VALUE(pl.cost_per_kg) AS cost_per_kg,
  ANY_VALUE(pl.base_currency) AS currency
FROM scenario_rates, prepagent.plants pl
WHERE pl.plant_id = 'PLANT-01'
HAVING COUNT(*) > 0
