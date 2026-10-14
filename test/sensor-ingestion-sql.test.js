import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../sql/sensor_ingestion_acceptance.sql", import.meta.url), "utf8");
const executableSql = sql.replace(/^--.*$/gm, "");

test("sensor ingestion acceptance query is bounded, parameterized, and read-only", () => {
  assert.match(executableSql, /FROM `prepagent-hack\.prepagent\.sensor_readings`/);
  assert.match(executableSql, /reading_id = @readingId/);
  assert.match(executableSql, /plant_id = @plantId/);
  assert.match(executableSql, /LIMIT 2/);
  assert.match(executableSql, /source/);
  assert.doesNotMatch(executableSql, /\b(?:INSERT|UPDATE|DELETE|MERGE|CREATE|DROP|ALTER)\b/i);
});
