import assert from "node:assert/strict";
import test from "node:test";
import { mapJobSheetToBigQuery } from "../src/bigquery-mapper.js";
import { createJobSheetRepository, decodeStoredJobSheetRow, JOB_SHEET_COLUMNS } from "../src/google-cloud/job-sheet-repository.js";
import { jobSheetFixture as fixture } from "./fixtures/job-sheet.js";

const jobSheetFixture = {
  ...fixture,
  order: { ...fixture.order, orderId: "TEST-REPOSITORY-001" },
};

const metadata = {
  plantId: "PLANT-01",
  createdAt: "2026-10-12T10:00:00.000Z",
  savingsCost: 0,
  currency: "INR",
  approvedAt: null,
  cardUri: null,
};

function queryResult(mapped) {
  return {
    schema: { fields: JOB_SHEET_COLUMNS.map((name) => ({
      name,
      type: name.endsWith("_json") ? "JSON"
        : ["savings_kg", "savings_cost"].includes(name) ? "FLOAT"
          : name === "approved_at" ? "TIMESTAMP" : "STRING",
    })) },
    rows: [{ f: JOB_SHEET_COLUMNS.map((name) => ({ v: mapped[name] === null ? null
      : name.endsWith("_json") ? JSON.stringify(mapped[name]) : String(mapped[name]) })) }],
  };
}

test("job-sheet repository writes a validated DRAFT with mapped BigQuery columns", async () => {
  let insert;
  const mapped = mapJobSheetToBigQuery(jobSheetFixture, metadata);
  const repository = createJobSheetRepository({
    projectId: "prepagent-hack",
    now: () => new Date(metadata.createdAt),
    bigquery: { query: async () => queryResult(mapped) },
    writer: {
      insertJobSheet: async (input) => { insert = input; return { inserted: true }; },
      approveDraft: async () => ({ affectedRows: 1 }),
    },
  });
  const created = await repository.createDraft({ jobSheet: jobSheetFixture, plantId: metadata.plantId, savingsCost: 0 });
  assert.equal(created.status, "DRAFT");
  assert.equal(created.createdAt, metadata.createdAt);
  assert.deepEqual(Object.keys(insert), ["row", "signal"]);
  assert.equal(insert.row.job_id, jobSheetFixture.jobId);
  assert.equal(insert.row.plant_id, metadata.plantId);
  assert.equal(insert.row.order_json.itemCode, jobSheetFixture.order.itemCode);
  assert.equal(insert.row.status, "DRAFT");
});

test("job-sheet repository refuses non-TEST writes before calling the writer", async () => {
  let writes = 0;
  const repository = createJobSheetRepository({
    projectId: "prepagent-hack",
    bigquery: { query: async () => assert.fail("No read-back should follow a rejected write.") },
    writer: {
      insertJobSheet: async () => { writes += 1; return { inserted: true }; },
      approveDraft: async () => assert.fail("Approval writer must not run."),
    },
  });
  await assert.rejects(
    repository.createDraft({ jobSheet: fixture, plantId: metadata.plantId, savingsCost: 0 }),
    { code: "TEST_RECORD_REQUIRED" },
  );
  assert.equal(writes, 0);
});

test("job-sheet repository confirms matching read-back after both insert and idempotent merge", async () => {
  const persistedAt = "2026-10-13T10:00:00.000Z";
  const mapped = mapJobSheetToBigQuery(jobSheetFixture, { ...metadata, createdAt: persistedAt });
  let inserted = true;
  let reads = 0;
  let clockReads = 0;
  const repository = createJobSheetRepository({
    projectId: "prepagent-hack",
    now: () => new Date(clockReads++ === 0 ? persistedAt : "2026-10-14T10:00:00.000Z"),
    bigquery: { query: async () => { reads += 1; return queryResult(mapped); } },
    writer: {
      insertJobSheet: async () => ({ inserted }),
      approveDraft: async () => ({ affectedRows: 1 }),
    },
  });

  const first = await repository.createDraft({
    jobSheet: jobSheetFixture,
    plantId: metadata.plantId,
    savingsCost: metadata.savingsCost,
  });
  inserted = false;
  const retry = await repository.createDraft({
    jobSheet: jobSheetFixture,
    plantId: metadata.plantId,
    savingsCost: metadata.savingsCost,
  });

  assert.equal(reads, 2);
  assert.equal(first.createdAt, persistedAt);
  assert.equal(retry.createdAt, persistedAt);
  assert.equal(retry.status, "DRAFT");
  assert.equal(retry.jobId, first.jobId);
});

test("job-sheet repository rejects absent or mismatched read-back", async () => {
  const mapped = mapJobSheetToBigQuery(jobSheetFixture, metadata);
  let result = { rows: [] };
  const repository = createJobSheetRepository({
    projectId: "prepagent-hack",
    now: () => new Date(metadata.createdAt),
    bigquery: { query: async () => result },
    writer: {
      insertJobSheet: async () => ({ inserted: true }),
      approveDraft: async () => ({ affectedRows: 1 }),
    },
  });
  await assert.rejects(
    () => repository.createDraft({ jobSheet: jobSheetFixture, plantId: metadata.plantId, savingsCost: 0 }),
    { code: "JOB_SHEET_WRITE_UNCONFIRMED" },
  );

  result = queryResult({ ...mapped, status: "APPROVED", approved_at: metadata.createdAt, card_uri: "gs://bucket/card.pdf" });
  await assert.rejects(
    () => repository.createDraft({ jobSheet: jobSheetFixture, plantId: metadata.plantId, savingsCost: 0 }),
    { code: "JOB_SHEET_WRITE_UNCONFIRMED" },
  );
  result = queryResult({ ...mapped, order_json: { ...mapped.order_json, quantity: mapped.order_json.quantity + 1 } });
  await assert.rejects(
    () => repository.createDraft({ jobSheet: jobSheetFixture, plantId: metadata.plantId, savingsCost: 0 }),
    { code: "JOB_SHEET_WRITE_UNCONFIRMED" },
  );
  result = queryResult({ ...mapped, created_at: "2026-10-13T10:00:00.000Z" });
  await assert.rejects(
    () => repository.createDraft({ jobSheet: jobSheetFixture, plantId: metadata.plantId, savingsCost: 0 }),
    { code: "JOB_SHEET_WRITE_UNCONFIRMED" },
  );
});

test("job-sheet repository rejects an invalid writer acknowledgement without reading as success", async () => {
  let reads = 0;
  const repository = createJobSheetRepository({
    projectId: "prepagent-hack",
    now: () => new Date(metadata.createdAt),
    bigquery: { query: async () => { reads += 1; return { rows: [] }; } },
    writer: {
      insertJobSheet: async () => ({}),
      approveDraft: async () => ({ affectedRows: 1 }),
    },
  });

  await assert.rejects(
    () => repository.createDraft({ jobSheet: jobSheetFixture, plantId: metadata.plantId, savingsCost: 0 }),
    { code: "JOB_SHEET_WRITE_UNCONFIRMED" },
  );
  assert.equal(reads, 0);
});

test("job-sheet repository reads and validates JSON row fields", async () => {
  const mapped = mapJobSheetToBigQuery(jobSheetFixture, metadata);
  const repository = createJobSheetRepository({
    projectId: "prepagent-hack",
    bigquery: { query: async (request) => {
      assert.match(request.sql, /WHERE job_id = @jobId LIMIT 2/);
      assert.deepEqual(request.parameters, { jobId: jobSheetFixture.jobId });
      return queryResult(mapped);
    } },
    writer: { insertJobSheet: async () => ({ inserted: true }), approveDraft: async () => ({ affectedRows: 1 }) },
  });
  const stored = await repository.get(jobSheetFixture.jobId);
  assert.equal(stored.jobId, jobSheetFixture.jobId);
  assert.equal(stored.order.itemCode, jobSheetFixture.order.itemCode);
  assert.equal(stored.savings.amount, 0);
  assert.equal(stored.status, "DRAFT");
});

test("job-sheet approval is conditional, idempotent, and reports missing or raced rows", async () => {
  let mapped = mapJobSheetToBigQuery(jobSheetFixture, metadata);
  let affectedRows = 1;
  let missing = false;
  const repository = createJobSheetRepository({
    projectId: "prepagent-hack",
    bigquery: { query: async () => missing ? { schema: { fields: [] }, rows: [] } : queryResult(mapped) },
    writer: { insertJobSheet: async () => ({ inserted: true }), approveDraft: async ({ approvedAt, cardUri }) => {
      if (affectedRows === 1) {
        mapped = { ...mapped, status: "APPROVED", approved_at: approvedAt, card_uri: cardUri };
      }
      return { affectedRows };
    } },
  });
  const approved = await repository.approve({ jobId: jobSheetFixture.jobId, cardUri: "gs://bucket/card.pdf" });
  assert.equal(approved.ok, true);
  assert.equal(approved.data.status, "APPROVED");
  assert.equal(approved.data.cardUri, "gs://bucket/card.pdf");

  const repeated = await repository.approve({ jobId: jobSheetFixture.jobId, cardUri: "gs://bucket/other.pdf" });
  assert.equal(repeated.data.cardUri, "gs://bucket/card.pdf");

  missing = true;
  assert.equal((await repository.approve({ jobId: "missing", cardUri: "gs://bucket/a.pdf" })).error.code, "NOT_FOUND");

  missing = false;
  mapped = mapJobSheetToBigQuery(jobSheetFixture, metadata);
  affectedRows = 0;
  assert.equal((await repository.approve({ jobId: jobSheetFixture.jobId, cardUri: "gs://bucket/a.pdf" })).error.code, "CONFLICT");
});

test("stored job-sheet row decoder rejects bad JSON and unexpected field order", () => {
  const mapped = mapJobSheetToBigQuery(jobSheetFixture, metadata);
  const result = queryResult(mapped);
  result.rows[0].f[4].v = "not json";
  assert.throws(() => decodeStoredJobSheetRow(result), /invalid JSON/);
  result.schema.fields.reverse();
  assert.throws(() => decodeStoredJobSheetRow(result), /unexpected schema/);
});

test("stored job-sheet decoder normalizes BigQuery TIMESTAMP epoch seconds", () => {
  const mapped = mapJobSheetToBigQuery(jobSheetFixture, metadata);
  const result = queryResult(mapped);
  for (const name of ["created_at", "approved_at"]) {
    const index = JOB_SHEET_COLUMNS.indexOf(name);
    result.schema.fields[index].type = "TIMESTAMP";
    if (name === "created_at") result.rows[0].f[index].v = String(Date.parse(metadata.createdAt) / 1000);
  }

  const stored = decodeStoredJobSheetRow(result);
  assert.equal(stored.createdAt, metadata.createdAt);
  assert.equal(stored.approvedAt, null);
});
