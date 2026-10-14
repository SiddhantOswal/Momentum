-- Read-only acceptance query for the five existing BQML regression models.
-- Uses each model's saved evaluation split; it does not train or replace models.
-- BigQuery execution may incur query charges. Record model version metadata
-- separately and do not treat query output as production acceptance by itself.
SELECT 'm_warp' AS model_name, metrics.*
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m_warp`) AS metrics
UNION ALL
SELECT 'm_delam' AS model_name, metrics.*
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m_delam`) AS metrics
UNION ALL
SELECT 'm_strength' AS model_name, metrics.*
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m_strength`) AS metrics
UNION ALL
SELECT 'm_print' AS model_name, metrics.*
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m_print`) AS metrics
UNION ALL
SELECT 'm_crack' AS model_name, metrics.*
FROM ML.EVALUATE(MODEL `prepagent-hack.prepagent.m_crack`) AS metrics
ORDER BY model_name;
