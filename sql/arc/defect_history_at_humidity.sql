-- defect_history_at_humidity.sql: modeled lots within 10 points of a humidity, for one defect.
-- Params: defect (STRING: WARP | DELAM | STRENGTH | PRINT | CRACK), ambient_rh_pct (FLOAT64)
-- Reads prepagent.lots only. The band logic matches sql/seen_before.sql.
WITH band AS (
  SELECT
    primary_defect,
    scrap_cost,
    CASE @defect
      WHEN 'WARP' THEN rate_warp_pct
      WHEN 'DELAM' THEN rate_delam_pct
      WHEN 'STRENGTH' THEN rate_strength_pct
      WHEN 'PRINT' THEN rate_print_pct
      ELSE rate_crack_pct
    END AS r
  FROM prepagent.lots
  WHERE ABS(ambient_rh_pct - @ambient_rh_pct) <= 10
)
SELECT
  @defect AS defect,
  COUNT(*) AS lots_in_band,
  COUNTIF(primary_defect = @defect) AS n_cases,
  ROUND(AVG(IF(primary_defect = @defect, r, NULL)), 2) AS avg_rate_when_main,
  ROUND(SUM(IF(primary_defect = @defect, scrap_cost, 0)), 0) AS cost_when_main,
  ROUND(AVG(r), 2) AS avg_rate_all_lots
FROM band;
