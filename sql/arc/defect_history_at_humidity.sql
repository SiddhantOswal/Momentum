-- defect_history_at_humidity.sql: modeled lots within 10 points of a humidity, for one defect.
-- Params: defect (STRING: WARP | DELAM | STRENGTH | PRINT | CRACK), ambient_rh_pct (FLOAT64),
--   band_pts (INT64, from src/humidity-band.js, bound by code, not by the model)
-- Reads prepagent.lots only. The band predicate is the same text as in sql/seen_before.sql.
WITH band AS (
  SELECT
    l.primary_defect,
    l.scrap_cost,
    CASE @defect
      WHEN 'WARP' THEN l.rate_warp_pct
      WHEN 'DELAM' THEN l.rate_delam_pct
      WHEN 'STRENGTH' THEN l.rate_strength_pct
      WHEN 'PRINT' THEN l.rate_print_pct
      ELSE l.rate_crack_pct
    END AS r
  FROM prepagent.lots l
  WHERE ABS(l.ambient_rh_pct - @ambient_rh_pct) <= @band_pts
)
SELECT
  @defect AS defect,
  COUNT(*) AS lots_in_band,
  COUNTIF(primary_defect = @defect) AS n_cases,
  ROUND(AVG(IF(primary_defect = @defect, r, NULL)), 2) AS avg_rate_when_main,
  ROUND(SUM(IF(primary_defect = @defect, scrap_cost, 0)), 0) AS cost_when_main,
  ROUND(AVG(r), 2) AS avg_rate_all_lots
FROM band;
