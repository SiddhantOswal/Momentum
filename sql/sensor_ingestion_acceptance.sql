-- Read-only verification for one separately authorized genuine sensor event.
-- Bind readingId to its unique sensor-issued acceptance correlation ID and
-- plantId to the plant whose physical measurement was actually published.
-- Keep LIMIT 2 so duplicate delivery is visible as a failure.
SELECT
  reading_id,
  ts,
  plant_id,
  ambient_rh_pct,
  ambient_temp_c,
  paper_moisture_pct,
  source
FROM `prepagent-hack.prepagent.sensor_readings`
WHERE reading_id = @readingId
  AND plant_id = @plantId
LIMIT 2;
