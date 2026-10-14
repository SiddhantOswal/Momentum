-- Read-only feature importance for the separately trained grouped candidates.
-- Compare rankings with the exact driver rules documented in the Blueprint.
SELECT
  'm_warp_grouped_v1' AS model_name,
  feature,
  importance_gain,
  importance_cover,
  importance_weight
FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m_warp_grouped_v1`)
UNION ALL
SELECT
  'm_delam_grouped_v1' AS model_name,
  feature,
  importance_gain,
  importance_cover,
  importance_weight
FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m_delam_grouped_v1`)
UNION ALL
SELECT
  'm_strength_grouped_v1' AS model_name,
  feature,
  importance_gain,
  importance_cover,
  importance_weight
FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m_strength_grouped_v1`)
UNION ALL
SELECT
  'm_print_grouped_v1' AS model_name,
  feature,
  importance_gain,
  importance_cover,
  importance_weight
FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m_print_grouped_v1`)
UNION ALL
SELECT
  'm_crack_grouped_v1' AS model_name,
  feature,
  importance_gain,
  importance_cover,
  importance_weight
FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m_crack_grouped_v1`)
ORDER BY model_name, importance_gain DESC;
