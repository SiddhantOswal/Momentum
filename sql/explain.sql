-- explain.sql: WHY is this lot risky? Top 3 drivers per defect from ML.EXPLAIN_PREDICT.
-- Params: same 15 as predict.sql (pass the levers you want explained: planned or recommended).
-- attribution > 0 pushes that defect's scrap % UP versus a typical lot; < 0 pushes it DOWN.
-- typical_pct = the model's average prediction (baseline_prediction_value).
-- The app already holds the input values, so it can say e.g. "humidity 86% (+0.9 pts warp)".
WITH spec AS (
  SELECT *,
    CASE
      WHEN box_style = 'TRAY' THEN (length_mm + 2*height_mm + 20) * (width_mm + 2*height_mm + 20) / 1e6
      WHEN box_style = 'DIECUT' AND height_mm = 0 THEN length_mm * width_mm * 1.1 / 1e6
      WHEN box_style = 'DIECUT' THEN (2*length_mm + 2*width_mm + 35) * (width_mm + height_mm) / 1e6 * 1.15
      ELSE (2*length_mm + 2*width_mm + 35) * (width_mm + height_mm) / 1e6
    END AS area,
    top_liner_gsm + inner_liner_gsm
      + flute_gsm * CASE flute_profile WHEN 'BC' THEN 1 WHEN 'BCB' THEN 2 ELSE 0 END
      + flute_gsm * CASE flute_profile WHEN 'B' THEN 1.32 WHEN 'C' THEN 1.43 WHEN 'E' THEN 1.27
                                      WHEN 'BC' THEN 2.75 WHEN 'BCB' THEN 4.07 ELSE 1.4 END AS board_gsm
  FROM prepagent.items
  WHERE item_code = @item_code
),
input AS (
  SELECT
    customer_id, box_style, length_mm, width_mm, height_mm, ply, flute_profile,
    top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf,
    @paper_type AS paper_type, @paper_supplier AS paper_supplier,
    ink_colors, ink_coverage_pct, CAST(@quantity AS INT64) AS quantity,
    @shift AS shift,
    CAST(@ambient_rh_pct AS FLOAT64) AS ambient_rh_pct,
    CAST(@ambient_temp_c AS FLOAT64) AS ambient_temp_c,
    CAST(@paper_moisture_pct AS FLOAT64) AS paper_moisture_pct,
    CAST(@sf_speed_mpm AS FLOAT64) AS sf_speed_mpm,
    CAST(@roll_temp_c AS FLOAT64) AS roll_temp_c,
    @gum_application AS gum_application,
    CAST(@gum_viscosity_sec AS FLOAT64) AS gum_viscosity_sec,
    @pasting_pressure AS pasting_pressure,
    CAST(@drying_hours AS FLOAT64) AS drying_hours,
    CAST(@print_speed_spm AS FLOAT64) AS print_speed_spm,
    area AS sheet_area_m2,
    area * board_gsm / 1000 AS box_weight_kg
  FROM spec
),
ex AS (
  SELECT 'WARP' AS defect, predicted_rate_warp_pct AS predicted, baseline_prediction_value AS typical, top_feature_attributions AS attrs
  FROM ML.EXPLAIN_PREDICT(MODEL prepagent.m_warp, (SELECT * FROM input), STRUCT(3 AS top_k_features))
  UNION ALL
  SELECT 'DELAM', predicted_rate_delam_pct, baseline_prediction_value, top_feature_attributions
  FROM ML.EXPLAIN_PREDICT(MODEL prepagent.m_delam, (SELECT * FROM input), STRUCT(3 AS top_k_features))
  UNION ALL
  SELECT 'STRENGTH', predicted_rate_strength_pct, baseline_prediction_value, top_feature_attributions
  FROM ML.EXPLAIN_PREDICT(MODEL prepagent.m_strength, (SELECT * FROM input), STRUCT(3 AS top_k_features))
  UNION ALL
  SELECT 'PRINT', predicted_rate_print_pct, baseline_prediction_value, top_feature_attributions
  FROM ML.EXPLAIN_PREDICT(MODEL prepagent.m_print, (SELECT * FROM input), STRUCT(3 AS top_k_features))
  WHERE (SELECT ink_colors FROM input) > 0
  UNION ALL
  SELECT 'CRACK', predicted_rate_crack_pct, baseline_prediction_value, top_feature_attributions
  FROM ML.EXPLAIN_PREDICT(MODEL prepagent.m_crack, (SELECT * FROM input), STRUCT(3 AS top_k_features))
)
SELECT
  defect,
  ROUND(GREATEST(predicted, 0), 3) AS predicted_pct,
  ROUND(typical, 3) AS typical_pct,
  pos + 1 AS driver_rank,
  a.feature AS driver,
  ROUND(a.attribution, 3) AS attribution_pts
FROM ex, UNNEST(attrs) AS a WITH OFFSET AS pos
ORDER BY predicted_pct DESC, driver_rank;
