import assert from "node:assert/strict";
import test from "node:test";
import {
  BigQueryReadError,
  createBigQueryReadClient,
  createCloudRunAccessTokenProvider,
  DEFAULT_MAX_BYTES_BILLED,
} from "../src/google-cloud/bigquery-read-client.js";

function jsonResponse(payload, { ok = true } = {}) {
  return {
    ok,
    async json() {
      return payload;
    },
  };
}

test("BigQuery read client sends named parameters and a bounded standard SQL query", async () => {
  let request;
  const client = createBigQueryReadClient({
    projectId: "prepagent-hack",
    location: "asia-south1",
    tokenProvider: async () => "test-token",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return jsonResponse({
        jobComplete: true,
        totalRows: "1",
        totalBytesProcessed: "1024",
        schema: { fields: [{ name: "reading_id", type: "STRING" }] },
        rows: [{ f: [{ v: "r-1" }] }],
        jobReference: { jobId: "test-job" },
      });
    },
  });

  const result = await client.query({
    sql: "SELECT reading_id FROM `prepagent-hack.prepagent.sensor_readings` WHERE plant_id = @plantId;",
    parameters: { plantId: "PLANT-01" },
  });

  assert.equal(request.url, "https://bigquery.googleapis.com/bigquery/v2/projects/prepagent-hack/queries");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(request.options.body), {
    query: "SELECT reading_id FROM `prepagent-hack.prepagent.sensor_readings` WHERE plant_id = @plantId;",
    useLegacySql: false,
    location: "asia-south1",
    maximumBytesBilled: String(DEFAULT_MAX_BYTES_BILLED),
    maxResults: 1000,
    parameterMode: "NAMED",
    queryParameters: [{
      name: "plantId",
      parameterType: { type: "STRING" },
      parameterValue: { value: "PLANT-01" },
    }],
  });
  assert.deepEqual(result.rows, [{ f: [{ v: "r-1" }] }]);
  assert.equal(result.totalRows, 1);
  assert.equal(result.totalBytesProcessed, 1024);
  assert.equal(result.jobReference.jobId, "test-job");
});

test("BigQuery read client refuses writes and multi-statement SQL before requesting credentials", async () => {
  let tokenCalls = 0;
  let fetchCalls = 0;
  const client = createBigQueryReadClient({
    projectId: "prepagent-hack",
    tokenProvider: async () => {
      tokenCalls += 1;
      return "test-token";
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      return jsonResponse({ jobComplete: true });
    },
  });

  for (const sql of [
    "INSERT INTO `prepagent-hack.prepagent.plants` VALUES ('PLANT-01')",
    "WITH x AS (SELECT 1) DELETE FROM `prepagent-hack.prepagent.plants` WHERE TRUE",
    "SELECT 1; DELETE FROM `prepagent-hack.prepagent.plants`",
  ]) {
    await assert.rejects(
      client.query({ sql }),
      (error) => error instanceof BigQueryReadError && error.code === "READ_ONLY_QUERY_REQUIRED",
    );
  }

  assert.equal(tokenCalls, 0);
  assert.equal(fetchCalls, 0);
});

test("BigQuery read client rejects unsafe parameters before making a request", async () => {
  let fetchCalls = 0;
  const client = createBigQueryReadClient({
    projectId: "prepagent-hack",
    tokenProvider: async () => "test-token",
    fetchImpl: async () => {
      fetchCalls += 1;
      return jsonResponse({ jobComplete: true });
    },
  });

  await assert.rejects(
    client.query({ sql: "SELECT @value", parameters: { "value;DROP": "unsafe" } }),
    (error) => error instanceof BigQueryReadError && error.code === "INVALID_QUERY_PARAMETER",
  );
  await assert.rejects(
    client.query({ sql: "SELECT @value", parameters: { value: null } }),
    (error) => error instanceof BigQueryReadError && error.code === "INVALID_QUERY_PARAMETER",
  );
  assert.equal(fetchCalls, 0);
});

test("BigQuery read client reports unfinished jobs without a job reference and oversized results explicitly", async () => {
  let payload = { jobComplete: false };
  const client = createBigQueryReadClient({
    projectId: "prepagent-hack",
    tokenProvider: async () => "test-token",
    fetchImpl: async () => jsonResponse(payload),
  });

  await assert.rejects(
    client.query({ sql: "SELECT 1" }),
    (error) => error instanceof BigQueryReadError && error.code === "BIGQUERY_QUERY_PENDING",
  );
  payload = { jobComplete: true, pageToken: "more-results" };
  await assert.rejects(
    client.query({ sql: "SELECT 1" }),
    (error) => error instanceof BigQueryReadError && error.code === "BIGQUERY_RESULT_LIMIT",
  );
});

test("BigQuery read client polls an asynchronous query job and returns its completed results", async () => {
  const requests = [];
  let polls = 0;
  const client = createBigQueryReadClient({
    projectId: "prepagent-hack",
    location: "asia-south1",
    tokenProvider: async () => "test-token",
    pollIntervalMs: 1,
    queryWaitMs: 100,
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      if (options.method === "POST") {
        return jsonResponse({ jobComplete: false, jobReference: { jobId: "prediction-job" } });
      }
      polls += 1;
      return jsonResponse(polls === 1
        ? { jobComplete: false, jobReference: { jobId: "prediction-job" } }
        : {
          jobComplete: true,
          totalRows: "1",
          totalBytesProcessed: "2048",
          schema: { fields: [{ name: "item_code", type: "STRING" }] },
          rows: [{ f: [{ v: "PKBX0041" }] }],
          jobReference: { jobId: "prediction-job" },
        });
    },
  });

  const result = await client.query({ sql: "SELECT 'safe' AS item_code" });
  assert.equal(polls, 2);
  assert.equal(requests[0].options.method, "POST");
  assert.match(requests[1].url, /\/projects\/prepagent-hack\/queries\/prediction-job\?/);
  assert.match(requests[1].url, /location=asia-south1/);
  assert.equal(requests[1].options.headers.Authorization, "Bearer test-token");
  assert.equal(result.rows[0].f[0].v, "PKBX0041");
  assert.equal(result.totalBytesProcessed, 2048);
});

test("Cloud Run token provider uses the metadata identity endpoint without exposing token contents", async () => {
  let request;
  const tokenProvider = createCloudRunAccessTokenProvider({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return jsonResponse({ access_token: "secret-test-token" });
    },
  });

  assert.equal(await tokenProvider(), "secret-test-token");
  assert.match(request.url, /metadata\.google\.internal\/computeMetadata/);
  assert.equal(request.options.headers["Metadata-Flavor"], "Google");
});

test("BigQuery read client validates the configured project and cost cap", () => {
  assert.throws(() => createBigQueryReadClient({ projectId: "bad" }), TypeError);
  assert.throws(() => createBigQueryReadClient({ projectId: "prepagent-hack", maximumBytesBilled: 0 }), TypeError);
  assert.throws(() => createBigQueryReadClient({ projectId: "prepagent-hack", maxResults: 1001 }), TypeError);
  assert.throws(() => createBigQueryReadClient({ projectId: "prepagent-hack", queryWaitMs: 60_000 }), TypeError);
});
