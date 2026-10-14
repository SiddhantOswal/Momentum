-- dash_kpis.sql: the 4 headline numbers. Held-out month (Sep 2026) re-run with the agent's settings,
-- scored with the true factory rules (prepagent.impact_lots, built by impact.ts). No params.
-- Do not annualize this held-out September monsoon-month estimate.
SELECT
  COUNT(*) AS lots_scored,
  COUNTIF(n_changes > 0) AS lots_changed,
  ROUND(SUM(net_saving), 0) AS net_saving_month,
  ROUND(SUM(base_scrap_kg - best_scrap_kg), 0) AS kg_saved_month,
  ROUND(AVG(base_scrap_pct), 2) AS scrap_pct_before,
  ROUND(AVG(best_scrap_pct), 2) AS scrap_pct_after,
  ROUND(SUM(base_scrap_cost), 0) AS scrap_cost_before,
  ROUND(SUM(best_scrap_cost), 0) AS scrap_cost_after,
  ANY_VALUE(currency) AS currency
FROM prepagent.impact_lots;
