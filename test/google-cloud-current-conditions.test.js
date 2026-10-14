import assert from "node:assert/strict";
import test from "node:test";
import { createCurrentConditionsService } from "../src/google-cloud/current-conditions-service.js";

// Legacy 6-column schema — feed origin cannot be established.
function resultFor6(values) {
  const fields = [
    ["reading_id", "STRING"], ["ts", "TIMESTAMP"], ["plant_id", "STRING"],
    ["ambient_rh_pct", "FLOAT"], ["ambient_temp_c", "FLOAT"], ["paper_moisture_pct", "FLOAT"],
  ];
  return {
    schema: { fields: fields.map(([name, type]) => ({ name, type })) },
    rows: values === undefined ? [] : [{ f: values.map((value) => ({ v: value })) }],
  };
}

// 7-column schema (with source column) — 'live' source is real, anything else is simulated
function resultFor7(values, sourceValue = "pubsub-bq-subscription") {
  const fields = [
    ["reading_id", "STRING"], ["ts", "TIMESTAMP"], ["plant_id", "STRING"],
    ["ambient_rh_pct", "FLOAT64"], ["ambient_temp_c", "FLOAT64"], ["paper_moisture_pct", "FLOAT64"],
    ["source", "STRING"],
  ];
  const row = values === undefined ? [] : [...values, sourceValue];
  return {
    schema: { fields: fields.map(([name, type]) => ({ name, type })) },
    rows: row.length === 0 ? [] : [{ f: row.map((v) => ({ v: v === null ? null : String(v) })) }],
  };
}

test("current conditions: 7-col result with pubsub-bq-subscription source is labelled simulated", async () => {
  let queryCount = 0;
  const service = createCurrentConditionsService({
    plantId: "PLANT-01",
    projectId: "prepagent-hack",
    bigquery: {
      query: async () => {
        queryCount++;
        return resultFor7(
          ["READ-1", "2026-10-11T18:45:00Z", "PLANT-01", "82.5", "31.2", "8.4"],
          "pubsub-bq-subscription"
        );
      },
    },
  });
  const response = await service({ shift: "NIGHT" });

  assert.equal(response.ok, true);
  assert.equal(response.source, "simulated-sensor");
  assert.equal(response.sensorSource, "simulated");
  assert.equal(response.data.ambientRhPct, 82.5);
  assert.equal(response.data.shift, "NIGHT");
  assert.equal(queryCount, 1);
  assert.equal(response.provenance.recordedSource, "pubsub-bq-subscription");
});

test("current conditions refuses to label an asserted live marker as genuine sensor evidence", async () => {
  const service = createCurrentConditionsService({
    plantId: "PLANT-01",
    projectId: "prepagent-hack",
    bigquery: {
      query: async () => resultFor7(
        ["READ-2", "2026-10-12T08:00:00Z", "PLANT-01", "75.0", "28.0", "9.0"],
        "live"
      ),
    },
  });
  const response = await service({ shift: "DAY" });

  assert.equal(response.ok, true);
  assert.equal(response.source, "bigquery-last-stored");
  assert.equal(response.sensorSource, "unverified");
  assert.equal(response.data.shift, "DAY");
});

test("current conditions normalizes BigQuery REST timestamp seconds", async () => {
  const service = createCurrentConditionsService({
    plantId: "PLANT-01",
    now: () => new Date("2026-10-14T12:00:00.000Z"),
    bigquery: {
      query: async () => resultFor7(
        ["READ-REST", "1.791979033921E9", "PLANT-01", "59.9", "30.2", "8.88"],
        "simulated",
      ),
    },
  });
  const response = await service({ shift: "DAY" });

  assert.equal(response.ok, true);
  assert.equal(response.data.runDate, "2026-10-14");
  assert.equal(response.provenance.timestamp, "2026-10-14T11:57:13.921Z");
  assert.equal(response.provenance.ageSeconds, 166.079);
});

test("readings older than 24 hours are marked stale and a live marker is not treated as real sensor evidence", async () => {
  const service = createCurrentConditionsService({
    plantId: "PLANT-01",
    now: () => new Date("2026-10-14T12:00:00.000Z"),
    bigquery: {
      query: async () => resultFor7(
        ["READ-OLD", "2026-10-01T08:00:00Z", "PLANT-01", "60", "25", "8.6"],
        "live",
      ),
    },
  });

  const response = await service({ shift: "DAY" });
  assert.equal(response.ok, true);
  assert.equal(response.sensorSource, "unverified");
  assert.equal(response.provenance.ageSeconds, 1_137_600);
  assert.equal(response.provenance.freshness, "stale");
});

test("current conditions preserves sensor identity and marks an absent feed source unverified", async () => {
  const retrievedAt = new Date("2026-10-14T12:00:00.000Z");
  let request;
  const service = createCurrentConditionsService({
    plantId: "PLANT-AUTHORITATIVE",
    projectId: "prepagent-hack",
    now: () => retrievedAt,
    bigquery: {
      query: async (value) => {
        request = value;
        return resultFor6([
          "READ-1", "2026-10-11 18:45:00+00", "PLANT-AUTHORITATIVE", "82.5", "31.2", "8.4",
        ]);
      },
    },
  });
  const response = await service({ shift: "NIGHT" });

  assert.equal(response.ok, true);
  assert.equal(response.source, "bigquery-last-stored");
  assert.equal(response.sensorSource, "unverified");
  assert.deepEqual(response.data, {
    runDate: "2026-10-11",
    shift: "NIGHT",
    ambientRhPct: 82.5,
    ambientTempC: 31.2,
    paperMoisturePct: 8.4,
  });
  assert.deepEqual(response.provenance, {
    readingId: "READ-1",
    timestamp: "2026-10-11T18:45:00.000Z",
    plantId: "PLANT-AUTHORITATIVE",
    source: "unverified",
    recordedSource: "not recorded in sensor_readings row",
    retrievedAt: retrievedAt.toISOString(),
    ageSeconds: 234900,
    freshness: "stale",
  });
  assert.equal(request.parameters.plantId, "PLANT-AUTHORITATIVE");
  assert.match(request.sql, /JSON_VALUE\(TO_JSON_STRING\(reading\), '\$\.source'\) AS source/);
});

test("current conditions does not mistake a null source column for simulated data", async () => {
  const service = createCurrentConditionsService({
    plantId: "PLANT-01",
    bigquery: {
      query: async () => resultFor7(
        ["READ-3", "2026-10-12T08:00:00Z", "PLANT-01", "60", "25", "8.6"],
        null
      ),
    },
  });
  const response = await service({ shift: "DAY" });

  assert.equal(response.ok, true);
  assert.equal(response.sensorSource, "unverified");
  assert.equal(response.provenance.recordedSource, "not recorded in sensor_readings row");
});

test("current conditions reports unavailable when no stored reading exists and rejects missing shift before querying", async () => {
  let queries = 0;
  const service = createCurrentConditionsService({
    plantId: "PLANT-AUTHORITATIVE",
    bigquery: { query: async () => { queries += 1; return resultFor7(undefined); } },
  });

  assert.equal((await service({})).error.code, "VALIDATION_ERROR");
  assert.equal(queries, 0);
  assert.equal((await service({ shift: "DAY" })).error.code, "SERVICE_UNAVAILABLE");
  assert.equal(queries, 1);
});

test("current conditions: malformed reading with non-finite value returns SERVICE_UNAVAILABLE", async () => {
  const service = createCurrentConditionsService({
    plantId: "PLANT-01",
    projectId: "prepagent-hack",
    bigquery: {
      query: async () => resultFor7(
        ["READ-X", "2026-10-11T10:00:00Z", "PLANT-01", "NaN", "28.0", "9.0"],
        "pubsub-bq-subscription"
      ),
    },
  });
  const response = await service({ shift: "DAY" });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "SERVICE_UNAVAILABLE");
});

test("current conditions rejects a mismatched-plant result instead of trusting the query filter", async () => {
  const service = createCurrentConditionsService({
    plantId: "PLANT-01",
    bigquery: {
      query: async () => resultFor7(
        ["READ-OTHER", "2026-10-12T08:00:00Z", "PLANT-02", "60", "25", "8.6"],
        "live",
      ),
    },
  });
  const response = await service({ shift: "DAY" });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "SERVICE_UNAVAILABLE");
});

test("current conditions rejects duplicate latest rows and future timestamps", async (t) => {
  await t.test("multiple rows", async () => {
    const duplicate = resultFor7(
      ["READ-1", "2026-10-12T08:00:00Z", "PLANT-01", "60", "25", "8.6"],
      "live",
    );
    duplicate.rows.push(duplicate.rows[0]);
    const service = createCurrentConditionsService({
      plantId: "PLANT-01",
      bigquery: { query: async () => duplicate },
    });
    assert.equal((await service({ shift: "DAY" })).error.code, "SERVICE_UNAVAILABLE");
  });

  await t.test("future timestamp", async () => {
    const service = createCurrentConditionsService({
      plantId: "PLANT-01",
      now: () => new Date("2026-10-12T08:00:00.000Z"),
      bigquery: {
        query: async () => resultFor7(
          ["READ-1", "2026-10-12T08:00:01Z", "PLANT-01", "60", "25", "8.6"],
          "live",
        ),
      },
    });
    assert.equal((await service({ shift: "DAY" })).error.code, "SERVICE_UNAVAILABLE");
  });
});

test("current conditions: schema mismatch returns SERVICE_UNAVAILABLE", async () => {
  const service = createCurrentConditionsService({
    plantId: "PLANT-01",
    projectId: "prepagent-hack",
    bigquery: {
      query: async () => ({
        schema: { fields: [{ name: "unexpected_col", type: "STRING" }] },
        rows: [],
      }),
    },
  });
  const response = await service({ shift: "DAY" });
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "SERVICE_UNAVAILABLE");
});

test("current conditions logs only schema paths and codes for invalid sensor rows", async () => {
  const logs = [];
  const originalConsoleError = console.error;
  const service = createCurrentConditionsService({
    plantId: "PLANT-01",
    now: () => new Date("2026-10-14T12:00:00.000Z"),
    bigquery: {
      query: async () => resultFor7(
        ["READ-1", "not-a-timestamp", "PLANT-01", "60", "25", "8.6"],
        "simulated",
      ),
    },
  });

  let response;
  try {
    console.error = (message) => logs.push(message);
    response = await service({ shift: "DAY" });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.ok, false);
  assert.deepEqual(JSON.parse(logs[0]), {
    event: "current_conditions_unavailable",
    code: "INTEGRATION_ERROR",
    errorType: "ZodError",
    validationIssues: [{ path: ["ts"], code: "invalid_format" }],
  });
  assert.doesNotMatch(logs[0], /not-a-timestamp|READ-1/);
});

test("current conditions: BigQuery unavailable returns SERVICE_UNAVAILABLE", async () => {
  let queryCount = 0;
  const logs = [];
  const originalConsoleError = console.error;
  const service = createCurrentConditionsService({
    plantId: "PLANT-01",
    projectId: "prepagent-hack",
    bigquery: {
      query: async () => { queryCount++; throw new Error("BigQuery unavailable"); },
    },
  });
  let response;
  try {
    console.error = (message) => logs.push(message);
    response = await service({ shift: "DAY" });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(response.ok, false);
  assert.equal(response.error.code, "SERVICE_UNAVAILABLE");
  assert.equal(queryCount, 1);
  assert.deepEqual(JSON.parse(logs[0]), {
    event: "current_conditions_unavailable",
    code: "INTEGRATION_ERROR",
    errorType: "Error",
  });
  assert.doesNotMatch(logs[0], /BigQuery unavailable/);
});

test("current conditions: AbortError is rethrown", async () => {
  const abortError = new DOMException("Aborted", "AbortError");
  const service = createCurrentConditionsService({
    plantId: "PLANT-01",
    projectId: "prepagent-hack",
    bigquery: { query: async () => { throw abortError; } },
  });
  await assert.rejects(() => service({ shift: "DAY" }), { name: "AbortError" });
});
