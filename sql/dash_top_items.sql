-- dash_top_items.sql: Chart 3. Top 10 items by scrap cost over the last 12 months (no params)
SELECT
  l.item_code,
  i.description,
  COUNT(*) AS lots,
  ROUND(AVG(rate_warp_pct + rate_delam_pct + rate_strength_pct + rate_print_pct + rate_crack_pct), 2) AS avg_scrap_pct,
  ROUND(SUM(l.scrap_cost), 0) AS scrap_cost_12m,
  APPROX_TOP_COUNT(l.primary_defect, 1)[OFFSET(0)].value AS main_defect
FROM prepagent.lots l
JOIN prepagent.items i USING (item_code)
WHERE l.run_date BETWEEN DATE '2025-10-01' AND DATE '2026-09-30'
GROUP BY l.item_code, i.description
ORDER BY scrap_cost_12m DESC
LIMIT 10;
