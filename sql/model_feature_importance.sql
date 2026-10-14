-- Read-only feature-importance query for the five existing BQML models.
-- Compare these rankings with the approved manufacturing-rule expectations.
-- BigQuery execution may incur query charges; no model training occurs here.
SELECT 'm_warp' AS model_name, feature, importance_gain, importance_cover, importance_weight
FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m_warp`) AS importance
UNION ALL
SELECT 'm_delam' AS model_name, feature, importance_gain, importance_cover, importance_weight
FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m_delam`) AS importance
UNION ALL
SELECT 'm_strength' AS model_name, feature, importance_gain, importance_cover, importance_weight
FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m_strength`) AS importance
UNION ALL
SELECT 'm_print' AS model_name, feature, importance_gain, importance_cover, importance_weight
FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m_print`) AS importance
UNION ALL
SELECT 'm_crack' AS model_name, feature, importance_gain, importance_cover, importance_weight
FROM ML.FEATURE_IMPORTANCE(MODEL `prepagent-hack.prepagent.m_crack`) AS importance
ORDER BY model_name, importance_gain DESC;
