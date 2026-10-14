-- dash_seasonal.sql: Chart 2. Average scrap % per defect by season (no params)
SELECT
  season,
  ROUND(AVG(rate_warp_pct), 2) AS warp,
  ROUND(AVG(rate_delam_pct), 2) AS delam,
  ROUND(AVG(rate_strength_pct), 2) AS strength,
  ROUND(AVG(rate_print_pct), 2) AS print,
  ROUND(AVG(rate_crack_pct), 2) AS crack
FROM (
  SELECT *,
    CASE
      WHEN EXTRACT(MONTH FROM run_date) BETWEEN 3 AND 5 THEN 'Summer'
      WHEN EXTRACT(MONTH FROM run_date) BETWEEN 6 AND 9 THEN 'Monsoon'
      WHEN EXTRACT(MONTH FROM run_date) IN (10, 11) THEN 'Post-monsoon'
      ELSE 'Winter'
    END AS season
  FROM prepagent.lots
  WHERE run_date < DATE '2026-10-01'
)
GROUP BY season
ORDER BY CASE season WHEN 'Summer' THEN 1 WHEN 'Monsoon' THEN 2 WHEN 'Post-monsoon' THEN 3 ELSE 4 END;
