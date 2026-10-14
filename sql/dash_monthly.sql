-- dash_monthly.sql: Chart 1. Scrap cost per month, Oct 2024 - Sep 2026 (no params)
SELECT
  FORMAT_DATE('%Y-%m', run_date) AS month,
  COUNT(*) AS lots,
  ROUND(SUM(scrap_cost), 0) AS scrap_cost,
  ROUND(SUM(total_scrap_kg), 0) AS scrap_kg,
  ROUND(AVG(rate_warp_pct + rate_delam_pct + rate_strength_pct + rate_print_pct + rate_crack_pct), 2) AS avg_scrap_pct
FROM prepagent.lots
WHERE run_date < DATE '2026-10-01'
GROUP BY month
ORDER BY month;
