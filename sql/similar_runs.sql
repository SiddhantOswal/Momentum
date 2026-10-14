-- similar_runs.sql: evidence panel. Top 5 past lots most like this order.
-- Params: item_code (STRING), ambient_rh_pct (FLOAT64)
-- Rules: same ply AND same flute as the ordered item. Distance = normalised gaps in
--   top liner GSM (/50), BF (/5), humidity (/10), ink coverage (/20), height (/100), length (/200);
--   the same item gets a 0.5 bonus. Smaller distance = more similar. Includes live completed lots
--   once the app writes them into prepagent.lots ("the factory learned").
-- Output: one row per past lot with its settings, outcome and operator note (if any).
WITH target AS (
  SELECT * FROM prepagent.items WHERE item_code = @item_code
),
notes AS (
  SELECT lot_id, ANY_VALUE(operator_note) AS operator_note
  FROM prepagent.feedback
  WHERE lot_id IS NOT NULL AND operator_note IS NOT NULL
  GROUP BY lot_id
),
cand AS (
  SELECT l.*, i.description,
    ABS(l.top_liner_gsm - t.top_liner_gsm) / 50
    + ABS(l.liner_bf - t.liner_bf) / 5
    + ABS(l.ambient_rh_pct - CAST(@ambient_rh_pct AS FLOAT64)) / 10
    + ABS(l.ink_coverage_pct - t.ink_coverage_pct) / 20
    + ABS(l.height_mm - t.height_mm) / 100
    + ABS(l.length_mm - t.length_mm) / 200
    - IF(l.item_code = t.item_code, 0.5, 0) AS distance
  FROM prepagent.lots l
  CROSS JOIN target t
  JOIN prepagent.items i ON i.item_code = l.item_code
  WHERE l.ply = t.ply AND l.flute_profile = t.flute_profile
)
SELECT
  c.lot_id, c.order_id, CAST(c.run_date AS STRING) AS run_date,
  c.item_code, c.description, c.shift,
  c.ambient_rh_pct, c.paper_type, c.paper_supplier,
  c.sf_speed_mpm, c.roll_temp_c, c.gum_application, c.gum_viscosity_sec,
  c.pasting_pressure, c.drying_hours, c.print_speed_spm,
  ROUND(c.rate_warp_pct + c.rate_delam_pct + c.rate_strength_pct + c.rate_print_pct + c.rate_crack_pct, 2) AS total_scrap_pct,
  c.total_scrap_kg, c.scrap_cost, c.currency, c.primary_defect,
  ROUND(c.distance, 3) AS distance,
  n.operator_note
FROM cand c
LEFT JOIN notes n USING (lot_id)
ORDER BY c.distance, c.run_date DESC
LIMIT 5;
