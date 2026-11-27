-- optimize.sql: order + conditions + planned levers -> BASELINE row and BEST row (max 3 lever changes)
-- Params: same 16 as predict.sql; the 7 lever params are the supervisor's PLANNED settings.
-- Objective: predicted scrap cost of the optimizer targets only + throughput penalty for SLOWING DOWN
--   versus the plan (Rs 200 per extra drying hour, Rs 60 per m/min slower single facer, Rs 30 per
--   sheet/min slower printing). @optimizer_targets (ARRAY<STRING>) is the "optimizer" use class from
--   config/model-acceptance.json; advisory and abstain targets are predicted but never enter the
--   objective, the totals or primary_defect, so they cannot move the recommendation (ARC-ML-03).
-- Verified test, run before ARC-ML-03 with all five targets in the objective (not re-run since):
--   PKBX0041, 1300, RECYCLED, SUP-D, DAY, 86, 26, 10.8, levers 48/162/HIGH/32/MED/5/60
--   -> BASELINE 10.18% / 100.4 kg / 5351; BEST roll 170, gum MED, viscosity 35 -> saves 17.4 kg / 925
ASSERT EXISTS(SELECT 1 FROM prepagent.items WHERE item_code = @item_code)
  AS 'Item not found in item master';
ASSERT EXISTS(SELECT 1 FROM prepagent.plants WHERE plant_id = 'PLANT-01')
  AS 'Plant settings missing';
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
base AS (
  SELECT
    customer_id, box_style, length_mm, width_mm, height_mm, ply, flute_profile,
    top_liner_gsm, flute_gsm, inner_liner_gsm, liner_bf,
    @paper_type AS paper_type, @paper_supplier AS paper_supplier,
    ink_colors, ink_coverage_pct, CAST(@quantity AS INT64) AS quantity,
    @shift AS shift,
    CAST(@ambient_rh_pct AS FLOAT64) AS ambient_rh_pct,
    CAST(@ambient_temp_c AS FLOAT64) AS ambient_temp_c,
    CAST(@paper_moisture_pct AS FLOAT64) AS paper_moisture_pct,
    area AS sheet_area_m2,
    area * board_gsm / 1000 AS box_weight_kg
  FROM spec
),
speeds  AS (SELECT DISTINCT x FROM UNNEST([30.0, 38, 45, 52, CAST(@sf_speed_mpm AS FLOAT64)]) x),
rolls   AS (SELECT DISTINCT x FROM UNNEST([160.0, 170, 180, CAST(@roll_temp_c AS FLOAT64)]) x),
gums    AS (SELECT DISTINCT x FROM UNNEST(['LOW', 'MED', 'HIGH', @gum_application]) x),
viscs   AS (SELECT DISTINCT x FROM UNNEST([35.0, 45, CAST(@gum_viscosity_sec AS FLOAT64)]) x),
pastes  AS (SELECT DISTINCT x FROM UNNEST(['LOW', 'MED', @pasting_pressure]) x),
dries   AS (SELECT DISTINCT x FROM UNNEST([4.0, 6, 8, 10, 12, CAST(@drying_hours AS FLOAT64)]) x),
prints  AS (SELECT DISTINCT x FROM UNNEST([40.0, 55, 70, CAST(@print_speed_spm AS FLOAT64)]) x),
candidates AS (
  SELECT
    ROW_NUMBER() OVER (ORDER BY s.x, r.x, g.x, v.x, p.x, d.x, pr.x) AS cid,
    s.x AS sf_speed_mpm, r.x AS roll_temp_c, g.x AS gum_application, v.x AS gum_viscosity_sec,
    p.x AS pasting_pressure, d.x AS drying_hours, pr.x AS print_speed_spm
  FROM speeds s CROSS JOIN rolls r CROSS JOIN gums g CROSS JOIN viscs v
    CROSS JOIN pastes p CROSS JOIN dries d CROSS JOIN prints pr
),
grid AS (SELECT c.*, b.* FROM candidates c CROSS JOIN base b),
pw AS (SELECT cid, predicted_rate_warp_pct     AS v FROM ML.PREDICT(MODEL prepagent.m2_warp,     (SELECT * FROM grid))),
pd AS (SELECT cid, predicted_rate_delam_pct    AS v FROM ML.PREDICT(MODEL prepagent.m2_delam,    (SELECT * FROM grid))),
ps AS (SELECT cid, predicted_rate_strength_pct AS v FROM ML.PREDICT(MODEL prepagent.m2_strength, (SELECT * FROM grid))),
pp AS (SELECT cid, predicted_rate_print_pct    AS v FROM ML.PREDICT(MODEL prepagent.m2_print,    (SELECT * FROM grid))),
pc AS (SELECT cid, predicted_rate_crack_pct    AS v FROM ML.PREDICT(MODEL prepagent.m2_crack,    (SELECT * FROM grid))),
rated AS (
  SELECT g.*,
    GREATEST(pw.v, 0) AS r_warp, GREATEST(pd.v, 0) AS r_delam, GREATEST(ps.v, 0) AS r_strength,
    IF(g.ink_colors = 0, 0, GREATEST(pp.v, 0)) AS r_print, GREATEST(pc.v, 0) AS r_crack,
    IF(g.sf_speed_mpm      != CAST(@sf_speed_mpm AS FLOAT64), 1, 0)
  + IF(g.roll_temp_c       != CAST(@roll_temp_c AS FLOAT64), 1, 0)
  + IF(g.gum_application   != @gum_application, 1, 0)
  + IF(g.gum_viscosity_sec != CAST(@gum_viscosity_sec AS FLOAT64), 1, 0)
  + IF(g.pasting_pressure  != @pasting_pressure, 1, 0)
  + IF(g.drying_hours      != CAST(@drying_hours AS FLOAT64), 1, 0)
  + IF(g.print_speed_spm   != CAST(@print_speed_spm AS FLOAT64), 1, 0) AS n_changes
  FROM grid g
  JOIN pw USING (cid) JOIN pd USING (cid) JOIN ps USING (cid) JOIN pp USING (cid) JOIN pc USING (cid)
),
eligible AS (
  SELECT
    'WARP' IN UNNEST(@optimizer_targets) AS u_warp,
    'DELAM' IN UNNEST(@optimizer_targets) AS u_delam,
    'STRENGTH' IN UNNEST(@optimizer_targets) AS u_strength,
    'PRINT' IN UNNEST(@optimizer_targets) AS u_print,
    'CRACK' IN UNNEST(@optimizer_targets) AS u_crack
),
-- total_pct sums the counted targets (0 when not counted); k_* pick the primary defect (-1 when not counted).
counted AS (
  SELECT r.*,
    IF(e.u_warp, r_warp, 0) + IF(e.u_delam, r_delam, 0) + IF(e.u_strength, r_strength, 0)
      + IF(e.u_print, r_print, 0) + IF(e.u_crack, r_crack, 0) AS total_pct,
    IF(e.u_warp, r_warp, -1) AS k_warp, IF(e.u_delam, r_delam, -1) AS k_delam,
    IF(e.u_strength, r_strength, -1) AS k_strength, IF(e.u_print, r_print, -1) AS k_print,
    IF(e.u_crack, r_crack, -1) AS k_crack
  FROM rated r CROSS JOIN eligible e
),
costed AS (
  SELECT c.*,
    quantity * box_weight_kg * total_pct / 100 AS scrap_kg,
    quantity * box_weight_kg * total_pct / 100 * pl.cost_per_kg AS scrap_cost,
    200 * GREATEST(drying_hours - CAST(@drying_hours AS FLOAT64), 0) + 60 * GREATEST(CAST(@sf_speed_mpm AS FLOAT64) - sf_speed_mpm, 0) + 30 * GREATEST(CAST(@print_speed_spm AS FLOAT64) - print_speed_spm, 0) AS penalty,
    pl.base_currency AS currency
  FROM counted c, prepagent.plants pl
  WHERE pl.plant_id = 'PLANT-01'
),
out AS (
  SELECT
    n_changes, sf_speed_mpm, roll_temp_c, gum_application, gum_viscosity_sec,
    pasting_pressure, drying_hours, print_speed_spm,
    ROUND(r_warp, 3) AS rate_warp_pct, ROUND(r_delam, 3) AS rate_delam_pct,
    ROUND(r_strength, 3) AS rate_strength_pct, ROUND(r_print, 3) AS rate_print_pct,
    ROUND(r_crack, 3) AS rate_crack_pct,
    ROUND(total_pct, 2) AS total_scrap_pct, ROUND(scrap_kg, 1) AS scrap_kg,
    ROUND(scrap_cost, 0) AS scrap_cost, ROUND(penalty, 0) AS penalty,
    ROUND(scrap_cost + penalty, 0) AS total_cost, currency,
    CASE GREATEST(k_warp, k_delam, k_strength, k_print, k_crack)
      WHEN k_warp THEN 'WARP' WHEN k_delam THEN 'DELAM' WHEN k_strength THEN 'STRENGTH'
      WHEN k_print THEN 'PRINT' ELSE 'CRACK' END AS primary_defect
  FROM costed
),
bl   AS (SELECT * FROM out WHERE n_changes = 0 LIMIT 1),
best AS (
  SELECT * FROM out WHERE n_changes <= 3
  ORDER BY total_cost, n_changes, sf_speed_mpm, roll_temp_c, gum_application,
    gum_viscosity_sec, pasting_pressure, drying_hours, print_speed_spm
  LIMIT 1
)
SELECT 'BASELINE' AS kind, bl.*, 0.0 AS savings_kg, 0.0 AS savings_cost FROM bl
UNION ALL
SELECT 'BEST', best.*, ROUND(bl.scrap_kg - best.scrap_kg, 1), ROUND(bl.total_cost - best.total_cost, 0)
FROM best CROSS JOIN bl;
