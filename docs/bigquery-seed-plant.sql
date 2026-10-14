-- Idempotent Part 2 plant configuration seed.
-- Run only after the project billing prerequisite is resolved.
-- This script is prepared locally and has not been executed.

MERGE `prepagent-hack.prepagent.plants` AS target
USING (
  SELECT
    'PLANT-01' AS plant_id,
    'Pune unit' AS name,
    'INR' AS base_currency,
    53.30 AS cost_per_kg,
    'en' AS default_locale
) AS source
ON target.plant_id = source.plant_id
WHEN MATCHED THEN
  UPDATE SET
    name = source.name,
    base_currency = source.base_currency,
    cost_per_kg = source.cost_per_kg,
    default_locale = source.default_locale
WHEN NOT MATCHED THEN
  INSERT (plant_id, name, base_currency, cost_per_kg, default_locale)
  VALUES (
    source.plant_id,
    source.name,
    source.base_currency,
    source.cost_per_kg,
    source.default_locale
  );
