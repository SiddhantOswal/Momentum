-- impact_batch.sql: run the optimizer on every held-out lot (Sep 2026) in one go.
-- Creates table prepagent.impact_recs: one row per lot with its ACTUAL levers and the model's BEST levers
-- (max 3 changes, same grid + objective as optimize.sql). The true-rules scoring happens in impact.ts.
-- Size: ~220 lots x ~17,000 setting combinations. Takes a few minutes.
CREATE OR REPLACE TABLE prepagent.impact_recs AS
WITH held AS (
  SELECT * FROM prepagent.lots WHERE run_date >= DATE '2026-09-01'
),
grid AS (
  SELECT DISTINCT
    h.lot_id, h.customer_id, h.box_style, h.length_mm, h.width_mm, h.height_mm, h.ply, h.flute_profile,
    h.top_liner_gsm, h.flute_gsm, h.inner_liner_gsm, h.liner_bf, h.paper_type, h.paper_supplier,
    h.ink_colors, h.ink_coverage_pct, h.quantity, h.shift, h.ambient_rh_pct, h.ambient_temp_c,
    h.paper_moisture_pct, h.sheet_area_m2, h.box_weight_kg,
    s AS sf_speed_mpm, r AS roll_temp_c, g AS gum_application, v AS gum_viscosity_sec,
    p AS pasting_pressure, d AS drying_hours, pr AS print_speed_spm,
    h.sf_speed_mpm AS a_sf, h.roll_temp_c AS a_roll, h.gum_application AS a_gum,
    h.gum_viscosity_sec AS a_visc, h.pasting_pressure AS a_paste, h.drying_hours AS a_dry,
    h.print_speed_spm AS a_print
  FROM held h,
    UNNEST([30.0, 38, 45, 52, h.sf_speed_mpm]) AS s,
    UNNEST([160.0, 170, 180, h.roll_temp_c]) AS r,
    UNNEST(['LOW', 'MED', 'HIGH', h.gum_application]) AS g,
    UNNEST([35.0, 45, h.gum_viscosity_sec]) AS v,
    UNNEST(['LOW', 'MED', h.pasting_pressure]) AS p,
    UNNEST([4.0, 6, 8, 10, 12, h.drying_hours]) AS d,
    UNNEST([40.0, 55, 70, h.print_speed_spm]) AS pr
),
-- Chain the 5 models: each ML.PREDICT passes all columns through and adds its prediction.
pred AS (
  SELECT * FROM ML.PREDICT(MODEL prepagent.m_crack, (
  SELECT * FROM ML.PREDICT(MODEL prepagent.m_print, (
  SELECT * FROM ML.PREDICT(MODEL prepagent.m_strength, (
  SELECT * FROM ML.PREDICT(MODEL prepagent.m_delam, (
  SELECT * FROM ML.PREDICT(MODEL prepagent.m_warp, (SELECT * FROM grid))))))))))
),
costed AS (
  SELECT *,
    IF(sf_speed_mpm != a_sf, 1, 0) + IF(roll_temp_c != a_roll, 1, 0) + IF(gum_application != a_gum, 1, 0)
    + IF(gum_viscosity_sec != a_visc, 1, 0) + IF(pasting_pressure != a_paste, 1, 0)
    + IF(drying_hours != a_dry, 1, 0) + IF(print_speed_spm != a_print, 1, 0) AS n_changes,
    quantity * box_weight_kg / 100 * (
      GREATEST(predicted_rate_warp_pct, 0) + GREATEST(predicted_rate_delam_pct, 0)
      + GREATEST(predicted_rate_strength_pct, 0)
      + IF(ink_colors = 0, 0, GREATEST(predicted_rate_print_pct, 0))
      + GREATEST(predicted_rate_crack_pct, 0)) * (SELECT cost_per_kg FROM prepagent.plants WHERE plant_id = 'PLANT-01') AS model_scrap_cost,
    200 * GREATEST(drying_hours - a_dry, 0) + 60 * GREATEST(a_sf - sf_speed_mpm, 0) + 30 * GREATEST(a_print - print_speed_spm, 0) AS penalty
  FROM pred
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY lot_id ORDER BY model_scrap_cost + penalty, n_changes) AS rn
  FROM costed WHERE n_changes <= 3
),
baseline AS (
  SELECT lot_id, ANY_VALUE(model_scrap_cost + penalty) AS model_base_total
  FROM costed WHERE n_changes = 0 GROUP BY lot_id
)
SELECT
  r.lot_id, r.n_changes,
  r.sf_speed_mpm AS best_sf_speed_mpm, r.roll_temp_c AS best_roll_temp_c,
  r.gum_application AS best_gum_application, r.gum_viscosity_sec AS best_gum_viscosity_sec,
  r.pasting_pressure AS best_pasting_pressure, r.drying_hours AS best_drying_hours,
  r.print_speed_spm AS best_print_speed_spm,
  ROUND(b.model_base_total, 0) AS model_base_total,
  ROUND(r.model_scrap_cost + r.penalty, 0) AS model_best_total
FROM ranked r JOIN baseline b USING (lot_id)
WHERE r.rn = 1;
