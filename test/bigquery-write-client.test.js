import assert from "node:assert/strict";
import test from "node:test";
import { BigQueryWriteError, createBigQueryWriteClient } from "../src/google-cloud/bigquery-write-client.js";

const projectId = "prepagent-hack";

test("BigQuery write client restricts inserted tables and uses create-only bounded row inserts", async () => {
  const calls = [];
  const client = createBigQueryWriteClient({
    projectId,
    tokenProvider: async () => "token",
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return Response.json({});
    },
  });

  await assert.rejects(
    client.insertRow({ table: "plants", insertId: "p1", row: {} }),
    (error) => error instanceof BigQueryWriteError && error.code === "TABLE_NOT_ALLOWED",
  );
  await assert.rejects(client.insertRow({ table: "job_sheets", insertId: "job-1", row: { job_id: "job-1" } }), { code: "TABLE_NOT_ALLOWED" });
  await assert.rejects(client.insertRow({ table: "feedback", insertId: "job-1", row: { job_id: "job-1" } }), { code: "TEST_RECORD_REQUIRED" });
  const result = await client.insertRow({ table: "feedback", insertId: "job-1", row: { job_id: "job-1" }, testOrderId: "TEST-ORDER-1" });
  assert.deepEqual(result, { inserted: true, insertId: "job-1" });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /datasets\/prepagent\/tables\/feedback\/insertAll$/);
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    skipInvalidRows: false,
    ignoreUnknownValues: false,
    rows: [{ insertId: "job-1", json: { job_id: "job-1" } }],
  });
});

test("job-sheet writes use a bounded parameterized MERGE with native JSON parsing", async () => {
  let request;
  const client = createBigQueryWriteClient({
    projectId,
    tokenProvider: async () => "token",
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return Response.json({ jobComplete: true, numDmlAffectedRows: "1" });
    },
  });
  const row = {
    job_id: "job-1", created_at: "2026-10-12T10:00:00.000Z", plant_id: "PLANT-01", status: "DRAFT",
    order_json: { itemCode: "item", orderId: "TEST-WRITER-1" }, conditions_json: {}, baseline_json: {}, recommended_json: {},
    changes_json: [], evidence_json: [], explanation_en: "grounded", savings_kg: 1, savings_cost: 2, currency: "INR",
  };
  assert.deepEqual(await client.insertJobSheet({ row }), { inserted: true });
  assert.match(request.query, /MERGE `prepagent-hack\.prepagent\.job_sheets`/);
  assert.match(request.query, /WHEN NOT MATCHED THEN INSERT/);
  assert.match(request.query, /PARSE_JSON\(@orderJson\)/);
  assert.equal(request.maximumBytesBilled, "52428800");
  assert.equal(request.queryParameters.find(({ name }) => name === "orderJson").parameterValue.value, JSON.stringify(row.order_json));
  await assert.rejects(client.insertJobSheet({ row: { ...row, status: "APPROVED" } }),
    (error) => error.code === "INVALID_JOB_SHEET");
});

test("BigQuery write client updates only a matching DRAFT and reports affected rows", async () => {
  let request;
  const client = createBigQueryWriteClient({
    projectId,
    tokenProvider: async () => "token",
    fetchImpl: async (url, options) => {
      request = { url: String(url), body: JSON.parse(options.body) };
      return Response.json({ jobComplete: true, numDmlAffectedRows: "1" });
    },
  });
  const updated = await client.approveDraft({
    jobId: "job-1",
    approvedAt: "2026-10-12T10:00:00.000Z",
    cardUri: "gs://prepagent-hack-data/jobcards/job-1.pdf",
  });
  assert.deepEqual(updated, { affectedRows: 1 });
  assert.match(request.url, /\/queries$/);
  assert.match(request.body.query, /WHERE job_id = @jobId AND status = 'DRAFT'/);
  assert.equal(request.body.maximumBytesBilled, "52428800");
  assert.deepEqual(request.body.queryParameters.map(({ name }) => name), ["approvedAt", "cardUri", "jobId"]);
});

test("BigQuery write client fails closed on rejected inserts and unfinished DML", async () => {
  const client = createBigQueryWriteClient({
    projectId,
    tokenProvider: async () => "token",
    fetchImpl: async () => Response.json({ insertErrors: [{ index: 0 }] }),
  });
  await assert.rejects(client.insertRow({ table: "feedback", insertId: "f1", row: { job_id: "x" }, testOrderId: "TEST-ORDER-1" }),
    (error) => error.code === "BIGQUERY_ROW_REJECTED");
  await assert.rejects(client.approveDraft({
    jobId: "job-1", approvedAt: "2026-10-12T10:00:00.000Z", cardUri: "gs://bucket/card.pdf",
  }), (error) => error.code === "BIGQUERY_APPROVAL_PENDING");
});
