-- predict.sql: one lot in -> 5 scrap rates, total kg, cost, primary defect
-- Params (15): item_code, quantity, paper_type, paper_supplier, shift, ambient_rh_pct, ambient_temp_c,
--   paper_moisture_pct, sf_speed_mpm, roll_temp_c, gum_application, gum_viscosity_sec, pasting_pressure,
--   drying_hours, print_speed_spm
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
w  AS (SELECT predicted_rate_warp_pct     AS v FROM ML.PREDICT(MODEL prepagent.m_warp,     (SELECT * FROM input))),
d  AS (SELECT predicted_rate_delam_pct    AS v FROM ML.PREDICT(MODEL prepagent.m_delam,    (SELECT * FROM input))),
st AS (SELECT predicted_rate_strength_pct AS v FROM ML.PREDICT(MODEL prepagent.m_strength, (SELECT * FROM input))),
p  AS (SELECT predicted_rate_print_pct    AS v FROM ML.PREDICT(MODEL prepagent.m_print,    (SELECT * FROM input))),
c  AS (SELECT predicted_rate_crack_pct    AS v FROM ML.PREDICT(MODEL prepagent.m_crack,    (SELECT * FROM input))),
rates AS (
  SELECT i.quantity, i.box_weight_kg,
    GREATEST(w.v, 0) AS r_warp,
    GREATEST(d.v, 0) AS r_delam,
    GREATEST(st.v, 0) AS r_strength,
    IF(i.ink_colors = 0, 0, GREATEST(p.v, 0)) AS r_print,
    GREATEST(c.v, 0) AS r_crack
  FROM input i, w, d, st, p, c
)
SELECT
  @item_code AS item_code,
  ROUND(r_warp, 3) AS rate_warp_pct,
  ROUND(r_delam, 3) AS rate_delam_pct,
  ROUND(r_strength, 3) AS rate_strength_pct,
  ROUND(r_print, 3) AS rate_print_pct,
  ROUND(r_crack, 3) AS rate_crack_pct,
  ROUND(r_warp + r_delam + r_strength + r_print + r_crack, 2) AS total_scrap_pct,
  ROUND(quantity * box_weight_kg * (r_warp + r_delam + r_strength + r_print + r_crack) / 100, 1) AS total_scrap_kg,
  ROUND(quantity * box_weight_kg * (r_warp + r_delam + r_strength + r_print + r_crack) / 100 * pl.cost_per_kg, 0) AS scrap_cost,
  pl.base_currency AS currency,
  CASE GREATEST(r_warp, r_delam, r_strength, r_print, r_crack)
    WHEN r_warp THEN 'WARP' WHEN r_delam THEN 'DELAM' WHEN r_strength THEN 'STRENGTH'
    WHEN r_print THEN 'PRINT' ELSE 'CRACK' END AS primary_defect
FROM rates, prepagent.plants pl
WHERE pl.plant_id = 'PLANT-01';
