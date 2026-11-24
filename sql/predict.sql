-- predict.sql: one lot in -> 5 scrap rates, total kg, cost, primary defect
-- Params (16): item_code, quantity, paper_type, paper_supplier, shift, ambient_rh_pct, ambient_temp_c,
--   paper_moisture_pct, sf_speed_mpm, roll_temp_c, gum_application, gum_viscosity_sec, pasting_pressure,
--   drying_hours, print_speed_spm, optimizer_targets (ARRAY<STRING>)
-- Use classes (ARC-ML-03): only the targets in @optimizer_targets (the "optimizer" use class in
--   config/model-acceptance.json) count toward total_scrap_pct, total_scrap_kg, scrap_cost and
--   primary_defect. Every rate is still returned; the service drops abstain targets.
-- Humidity band: the same job predicts three rows (CENTRAL at @ambient_rh_pct, LOW at RH-5, HIGH at RH+5).
--   The band is clamped to the plant's recorded humidity range 25..98 %RH (config/condition-ranges.json).
--   Totals and primary_defect come from the CENTRAL row only; band columns are the min/max across the rows.
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
rh_scenarios AS (
  SELECT 'CENTRAL' AS rh_scenario, CAST(@ambient_rh_pct AS FLOAT64) AS rh
  UNION ALL SELECT 'LOW', GREATEST(CAST(@ambient_rh_pct AS FLOAT64) - 5, 25.0)
  UNION ALL SELECT 'HIGH', LEAST(CAST(@ambient_rh_pct AS FLOAT64) + 5, 98.0)
),
input AS (
  SELECT
    s.rh_scenario,
    customer_id, box_style, length_mm, width_mm, height_mm, ply, flute_profile,
    top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf,
    @paper_type AS paper_type, @paper_supplier AS paper_supplier,
    ink_colors, ink_coverage_pct, CAST(@quantity AS INT64) AS quantity,
    @shift AS shift,
    s.rh AS ambient_rh_pct,
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
  FROM spec CROSS JOIN rh_scenarios s
),
w  AS (SELECT rh_scenario, predicted_rate_warp_pct     AS v FROM ML.PREDICT(MODEL prepagent.m2_warp,     (SELECT * FROM input))),
d  AS (SELECT rh_scenario, predicted_rate_delam_pct    AS v FROM ML.PREDICT(MODEL prepagent.m2_delam,    (SELECT * FROM input))),
st AS (SELECT rh_scenario, predicted_rate_strength_pct AS v FROM ML.PREDICT(MODEL prepagent.m2_strength, (SELECT * FROM input))),
p  AS (SELECT rh_scenario, predicted_rate_print_pct    AS v FROM ML.PREDICT(MODEL prepagent.m2_print,    (SELECT * FROM input))),
c  AS (SELECT rh_scenario, predicted_rate_crack_pct    AS v FROM ML.PREDICT(MODEL prepagent.m2_crack,    (SELECT * FROM input))),
scenario_rates AS (
  SELECT i.rh_scenario, i.ambient_rh_pct, i.quantity, i.box_weight_kg,
    GREATEST(w.v, 0) AS r_warp,
    GREATEST(d.v, 0) AS r_delam,
    GREATEST(st.v, 0) AS r_strength,
    IF(i.ink_colors = 0, 0, GREATEST(p.v, 0)) AS r_print,
    GREATEST(c.v, 0) AS r_crack
  FROM input i
  JOIN w USING (rh_scenario) JOIN d USING (rh_scenario) JOIN st USING (rh_scenario)
  JOIN p USING (rh_scenario) JOIN c USING (rh_scenario)
),
-- One pass over the three rows: CENTRAL values for totals, min/max across rows for the band.
rates AS (
  SELECT
    MAX(IF(rh_scenario = 'CENTRAL', quantity, NULL)) AS quantity,
    MAX(IF(rh_scenario = 'CENTRAL', box_weight_kg, NULL)) AS box_weight_kg,
    MAX(IF(rh_scenario = 'CENTRAL', r_warp, NULL)) AS r_warp,
    MAX(IF(rh_scenario = 'CENTRAL', r_delam, NULL)) AS r_delam,
    MAX(IF(rh_scenario = 'CENTRAL', r_strength, NULL)) AS r_strength,
    MAX(IF(rh_scenario = 'CENTRAL', r_print, NULL)) AS r_print,
    MAX(IF(rh_scenario = 'CENTRAL', r_crack, NULL)) AS r_crack,
    MIN(ambient_rh_pct) AS rh_low, MAX(ambient_rh_pct) AS rh_high,
    MIN(r_warp) AS warp_low, MAX(r_warp) AS warp_high,
    MIN(r_delam) AS delam_low, MAX(r_delam) AS delam_high,
    MIN(r_strength) AS strength_low, MAX(r_strength) AS strength_high,
    MIN(r_print) AS print_low, MAX(r_print) AS print_high,
    MIN(r_crack) AS crack_low, MAX(r_crack) AS crack_high
  FROM scenario_rates
  HAVING COUNT(*) > 0
),
eligible AS (
  SELECT
    'WARP' IN UNNEST(@optimizer_targets) AS u_warp,
    'DELAM' IN UNNEST(@optimizer_targets) AS u_delam,
    'STRENGTH' IN UNNEST(@optimizer_targets) AS u_strength,
    'PRINT' IN UNNEST(@optimizer_targets) AS u_print,
    'CRACK' IN UNNEST(@optimizer_targets) AS u_crack
),
-- c_* feed the totals (0 when not counted); k_* pick the primary defect (-1 when not counted).
counted AS (
  SELECT r.*,
    IF(e.u_warp, r_warp, 0) + IF(e.u_delam, r_delam, 0) + IF(e.u_strength, r_strength, 0)
      + IF(e.u_print, r_print, 0) + IF(e.u_crack, r_crack, 0) AS counted_pct,
    IF(e.u_warp, r_warp, -1) AS k_warp, IF(e.u_delam, r_delam, -1) AS k_delam,
    IF(e.u_strength, r_strength, -1) AS k_strength, IF(e.u_print, r_print, -1) AS k_print,
    IF(e.u_crack, r_crack, -1) AS k_crack
  FROM rates r CROSS JOIN eligible e
)
SELECT
  @item_code AS item_code,
  ROUND(r_warp, 3) AS rate_warp_pct,
  ROUND(r_delam, 3) AS rate_delam_pct,
  ROUND(r_strength, 3) AS rate_strength_pct,
  ROUND(r_print, 3) AS rate_print_pct,
  ROUND(r_crack, 3) AS rate_crack_pct,
  ROUND(counted_pct, 2) AS total_scrap_pct,
  ROUND(quantity * box_weight_kg * counted_pct / 100, 1) AS total_scrap_kg,
  ROUND(quantity * box_weight_kg * counted_pct / 100 * pl.cost_per_kg, 0) AS scrap_cost,
  pl.base_currency AS currency,
  CASE GREATEST(k_warp, k_delam, k_strength, k_print, k_crack)
    WHEN k_warp THEN 'WARP' WHEN k_delam THEN 'DELAM' WHEN k_strength THEN 'STRENGTH'
    WHEN k_print THEN 'PRINT' ELSE 'CRACK' END AS primary_defect,
  ROUND(rh_low, 2) AS rh_band_low_pct,
  ROUND(rh_high, 2) AS rh_band_high_pct,
  ROUND(warp_low, 3) AS rate_warp_low_pct,
  ROUND(warp_high, 3) AS rate_warp_high_pct,
  ROUND(delam_low, 3) AS rate_delam_low_pct,
  ROUND(delam_high, 3) AS rate_delam_high_pct,
  ROUND(strength_low, 3) AS rate_strength_low_pct,
  ROUND(strength_high, 3) AS rate_strength_high_pct,
  ROUND(print_low, 3) AS rate_print_low_pct,
  ROUND(print_high, 3) AS rate_print_high_pct,
  ROUND(crack_low, 3) AS rate_crack_low_pct,
  ROUND(crack_high, 3) AS rate_crack_high_pct
FROM counted, prepagent.plants pl
WHERE pl.plant_id = 'PLANT-01';
