import {
  ConditionsValidationApiResponseSchema,
  RunConditionsSchema,
  SensorReadingRowSchema,
} from "../schemas.js";
import { BigQueryReadError } from "./bigquery-read-client.js";

function normalizedTimestamp(value) {
  if (typeof value !== "string") return value;
  if (/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value.trim())) {
    const milliseconds = Number(value) * 1000;
    const date = new Date(milliseconds);
    return Number.isFinite(milliseconds) && Number.isFinite(date.getTime())
      ? date.toISOString()
      : value;
  }
  const normalized = value.includes(" ") ? value.replace(" ", "T") : value;
  const withUtc = normalized.endsWith(" UTC")
    ? normalized.slice(0, -4) + "Z"
    : normalized;
  const withOffset = withUtc.replace(/([+-]\d{2})$/, "$1:00");
  const parsed = new Date(withOffset);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function safeErrorType(error) {
  return typeof error?.name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name)
    ? error.name
    : "Error";
}

function safeValidationIssues(error) {
  if (!Array.isArray(error?.issues)) return undefined;
  return error.issues.slice(0, 8).map((issue) => ({
    path: Array.isArray(issue.path)
      ? issue.path.map((segment) => typeof segment === "number"
        ? segment
        : typeof segment === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(segment)
          ? segment
          : "field")
      : [],
    code: typeof issue.code === "string" && /^[a-z_]{1,48}$/.test(issue.code)
      ? issue.code
      : "invalid",
  }));
}

// Names expected without a source field in legacy sensor tables.
const NAMES_NO_SOURCE = [
  "reading_id", "ts", "plant_id", "ambient_rh_pct", "ambient_temp_c", "paper_moisture_pct",
];
// Names when the source column is present
const NAMES_WITH_SOURCE = [
  "reading_id", "ts", "plant_id", "ambient_rh_pct", "ambient_temp_c", "paper_moisture_pct",
  "source",
];

function decodeLatestReading(result) {
  const fields = result?.schema?.fields;
  if (!Array.isArray(fields)) {
    throw new BigQueryReadError("SENSOR_SCHEMA_MISMATCH", "The sensor query returned an unexpected schema.");
  }
  const names = fields.map((f) => f.name);
  const hasSource = names.length === NAMES_WITH_SOURCE.length &&
    NAMES_WITH_SOURCE.every((n, i) => names[i] === n);
  const hasNoSource = names.length === NAMES_NO_SOURCE.length &&
    NAMES_NO_SOURCE.every((n, i) => names[i] === n);
  if (!hasSource && !hasNoSource) {
    throw new BigQueryReadError("SENSOR_SCHEMA_MISMATCH", "The sensor query returned an unexpected schema.");
  }

  const row = result.rows?.[0];
  if (!row) return undefined;
  if (result.rows.length !== 1) {
    throw new BigQueryReadError("SENSOR_ROW_INVALID", "The latest sensor query must return at most one reading.");
  }
  if (!Array.isArray(row.f) || row.f.length !== fields.length) {
    throw new BigQueryReadError("SENSOR_ROW_INVALID", "The latest sensor reading is malformed.");
  }
  const values = Object.fromEntries(fields.map((field, index) => {
    const value = row.f[index]?.v;
    if (value === null || value === undefined) return [field.name, undefined];
    if (["FLOAT", "FLOAT64", "INTEGER", "INT64", "NUMERIC", "BIGNUMERIC"].includes(field.type)) {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        throw new BigQueryReadError("SENSOR_ROW_INVALID", "The latest sensor reading has an invalid numeric value.");
      }
      return [field.name, number];
    }
    return [field.name, field.name === "ts" ? normalizedTimestamp(value) : value];
  }));

  // Keep compatibility with previously ingested rows before source was persisted.
  const sourceValue = hasSource ? values.source : undefined;
  const reading = SensorReadingRowSchema.parse({
    reading_id: values.reading_id,
    ts: values.ts,
    plant_id: values.plant_id,
    ambient_rh_pct: values.ambient_rh_pct,
    ambient_temp_c: values.ambient_temp_c,
    paper_moisture_pct: values.paper_moisture_pct,
    ...(values.source === "simulated" || values.source === "live"
      ? { source: values.source }
      : {}),
  });
  return { reading, sourceValue };
}

export function createCurrentConditionsService({
  bigquery,
  plantId,
  projectId = "prepagent-hack",
  now = () => new Date(),
} = {}) {
  if (!bigquery || typeof bigquery.query !== "function") {
    throw new TypeError("A bounded BigQuery read client is required.");
  }
  if (typeof plantId !== "string" || plantId.trim().length === 0) {
    throw new TypeError("An authoritative plant ID is required.");
  }
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new TypeError("A valid Google Cloud project ID is required.");
  }
  if (typeof now !== "function") {
    throw new TypeError("A current-time provider is required.");
  }

  return async ({ shift, signal } = {}) => {
    if (shift !== "DAY" && shift !== "NIGHT") {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "A DAY or NIGHT shift is required for the run conditions.",
          issues: [{
            field: "shift",
            path: ["shift"],
            code: "invalid_value",
            message: "shift is required and must be DAY or NIGHT.",
          }],
        },
      };
    }

    try {
      const result = await bigquery.query({
        sql: `SELECT reading.reading_id, reading.ts, reading.plant_id,
       reading.ambient_rh_pct, reading.ambient_temp_c, reading.paper_moisture_pct,
       JSON_VALUE(TO_JSON_STRING(reading), '$.source') AS source
FROM \`${projectId}.prepagent.sensor_readings\` AS reading
WHERE reading.plant_id = @plantId
ORDER BY reading.ts DESC
LIMIT 1`,
        parameters: { plantId: plantId.trim() },
        signal,
      });

      const decoded = decodeLatestReading(result);
      if (!decoded) {
        return {
          ok: false,
          error: { code: "SERVICE_UNAVAILABLE", message: "No stored sensor reading is available for this plant." },
        };
      }
      const { reading, sourceValue } = decoded;
      if (reading.plant_id !== plantId.trim()) {
        throw new BigQueryReadError("SENSOR_PLANT_MISMATCH", "The latest sensor reading belongs to a different plant.");
      }
      const readingTime = Date.parse(reading.ts);
      if (!Number.isFinite(readingTime)) {
        throw new BigQueryReadError("SENSOR_TIMESTAMP_INVALID", "The latest sensor reading has an invalid timestamp.");
      }
      // D5 records that the plant has no physical sensors. Only explicitly
      // marked demo/stream rows may be called simulated; a "live" marker is
      // unverified rather than evidence of a genuine sensor.
      const sensorSource = sourceValue === "simulated" || sourceValue === "pubsub-bq-subscription"
        ? "simulated"
        : "unverified";
      const retrievedAt = now();
      if (!(retrievedAt instanceof Date) || !Number.isFinite(retrievedAt.getTime())) {
        throw new TypeError("The current-time provider returned an invalid date.");
      }
      if (readingTime > retrievedAt.getTime()) {
        throw new BigQueryReadError("SENSOR_TIMESTAMP_INVALID", "The latest sensor reading is dated in the future.");
      }
      const responseSource = sensorSource === "simulated"
        ? "simulated-sensor"
        : "bigquery-last-stored";

      const data = RunConditionsSchema.parse({
        runDate: reading.ts.slice(0, 10),
        shift,
        ambientRhPct: reading.ambient_rh_pct,
        ambientTempC: reading.ambient_temp_c,
        paperMoisturePct: reading.paper_moisture_pct,
      });
      return ConditionsValidationApiResponseSchema.parse({
        ok: true,
        agent: "getConditions",
        source: responseSource,
        isRealModelPrediction: false,
        data,
        sensorSource,
        provenance: {
          readingId: reading.reading_id,
          timestamp: reading.ts,
          plantId: reading.plant_id,
          source: sensorSource,
          recordedSource: sourceValue ?? "not recorded in sensor_readings row",
          retrievedAt: retrievedAt.toISOString(),
          ageSeconds: (retrievedAt.getTime() - readingTime) / 1000,
          freshness: retrievedAt.getTime() - readingTime > 24 * 60 * 60 * 1000 ? "stale" : "unassessed",
        },
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      const validationIssues = safeValidationIssues(error);
      console.error(JSON.stringify({
        event: "current_conditions_unavailable",
        code: typeof error?.code === "string" && /^[A-Z0-9_]{1,64}$/.test(error.code)
          ? error.code
          : "INTEGRATION_ERROR",
        errorType: safeErrorType(error),
        ...(validationIssues === undefined ? {} : { validationIssues }),
      }));
      return {
        ok: false,
        error: { code: "SERVICE_UNAVAILABLE", message: "Stored sensor conditions are unavailable." },
      };
    }
  };
}

export { decodeLatestReading };
