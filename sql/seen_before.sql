-- seen_before.sql: "Have we seen this before?" for a defect (e.g. from a photo) in similar weather.
-- Params: defect (STRING: WARP | DELAM | STRENGTH | PRINT | CRACK), ambient_rh_pct (FLOAT64)
-- Looks at all past lots within +/-10 points of humidity:
--   n_cases          = lots where this defect was the main problem
--   good_runs        = average settings of the best 25% of lots for this defect (lowest rate)
--   bad_runs         = average settings of the worst 25% (highest rate)
--   notes            = up to 3 operator notes from lots where this defect was the main problem
-- The difference between good_runs and bad_runs is "what worked last time".
WITH band AS (
  SELECT l.*,
    CASE @defect
      WHEN 'WARP' THEN l.rate_warp_pct WHEN 'DELAM' THEN l.rate_delam_pct
      WHEN 'STRENGTH' THEN l.rate_strength_pct WHEN 'PRINT' THEN l.rate_print_pct
      ELSE l.rate_crack_pct END AS r
  FROM prepagent.lots l
  WHERE ABS(l.ambient_rh_pct - CAST(@ambient_rh_pct AS FLOAT64)) <= 10
),
q AS (SELECT APPROX_QUANTILES(r, 4) AS qs FROM band),
grouped AS (
  SELECT IF(b.r <= q.qs[OFFSET(1)], 'GOOD', 'BAD') AS grp, b.*
  FROM band b CROSS JOIN q
  WHERE b.r <= q.qs[OFFSET(1)] OR b.r >= q.qs[OFFSET(3)]
),
levers AS (
  SELECT grp,
    COUNT(*) AS lots,
    ROUND(AVG(r), 2) AS avg_rate_pct,
    ROUND(AVG(sf_speed_mpm), 1) AS sf_speed_mpm,
    ROUND(AVG(roll_temp_c), 1) AS roll_temp_c,
    APPROX_TOP_COUNT(gum_application, 1)[OFFSET(0)].value AS gum_application,
    ROUND(AVG(gum_viscosity_sec), 1) AS gum_viscosity_sec,
    APPROX_TOP_COUNT(pasting_pressure, 1)[OFFSET(0)].value AS pasting_pressure,
    ROUND(AVG(drying_hours), 1) AS drying_hours,
    ROUND(AVG(print_speed_spm), 1) AS print_speed_spm
  FROM grouped
  GROUP BY grp
),
cases AS (
  SELECT COUNT(*) AS n_cases, ROUND(AVG(r), 2) AS avg_rate_when_main, ROUND(SUM(scrap_cost), 0) AS cost_when_main
  FROM band WHERE primary_defect = @defect
),
notes AS (
  SELECT ARRAY_AGG(DISTINCT f.operator_note LIMIT 3) AS notes
  FROM prepagent.feedback f
  JOIN prepagent.lots l ON l.lot_id = f.lot_id
  WHERE l.primary_defect = @defect AND f.operator_note IS NOT NULL
)
SELECT
  @defect AS defect,
  c.n_cases, c.avg_rate_when_main, c.cost_when_main,
  (SELECT AS STRUCT * EXCEPT (grp) FROM levers WHERE grp = 'GOOD') AS good_runs,
  (SELECT AS STRUCT * EXCEPT (grp) FROM levers WHERE grp = 'BAD') AS bad_runs,
  n.notes
FROM cases c CROSS JOIN notes n;
