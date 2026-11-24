-- top_scrap_items.sql: items with the highest modeled scrap cost, 2025-10-01 to 2026-09-30.
-- Params: limit (INT64, 1 to 10). Same window and ranking as sql/dash_top_items.sql.
SELECT
  l.item_code,
  COUNT(*) AS lots,
  ROUND(AVG(rate_warp_pct + rate_delam_pct + rate_strength_pct + rate_print_pct + rate_crack_pct), 2) AS avg_scrap_pct,
  ROUND(SUM(l.scrap_cost), 0) AS scrap_cost_12m,
  APPROX_TOP_COUNT(l.primary_defect, 1)[OFFSET(0)].value AS main_defect,
  MIN(l.currency) AS currency
FROM prepagent.lots l
WHERE l.run_date BETWEEN DATE '2025-10-01' AND DATE '2026-09-30'
GROUP BY l.item_code
ORDER BY scrap_cost_12m DESC, l.item_code
LIMIT @limit;
