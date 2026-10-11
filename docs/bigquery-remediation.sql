-- Ustaad AI — BigQuery remediation plan
-- Project: prepagent-hack
-- Dataset: prepagent
--
-- IMPORTANT:
-- This is a PROPOSED remediation script.
-- Do not execute while billing is disabled.
--
-- Retention rationale:
-- The Part 2 table definitions do not specify a 60-day expiration.
-- Remove the inherited defaults and existing expirations so the
-- tables and partitions are not unexpectedly deleted.
-- Confirm the intended retention policy before execution.

-- 1. Remove the dataset's default expiration settings.
ALTER SCHEMA `prepagent-hack.prepagent`
SET OPTIONS (
  default_table_expiration_days = NULL,
  default_partition_expiration_days = NULL
);

-- 2. Remove expiration from existing table partitions.
ALTER TABLE `prepagent-hack.prepagent.lots`
SET OPTIONS (
  partition_expiration_days = NULL
);

ALTER TABLE `prepagent-hack.prepagent.sensor_readings`
SET OPTIONS (
  partition_expiration_days = NULL
);

-- 3. Remove the table-level expiration on plants.
ALTER TABLE `prepagent-hack.prepagent.plants`
SET OPTIONS (
  expiration_timestamp = NULL
);

-- 4. Insert the required plant seed record.
-- This DML statement previously failed because billing is disabled.
INSERT INTO `prepagent-hack.prepagent.plants`
  (plant_id, name, base_currency, cost_per_kg, default_locale)
VALUES
  ('PLANT-01', 'Pune unit', 'INR', 45, 'mr');
