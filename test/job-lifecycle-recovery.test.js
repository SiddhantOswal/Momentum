import assert from "node:assert/strict";
import test from "node:test";
import { mapJobSheetToBigQuery } from "../src/bigquery-mapper.js";
import { createJobSheetRepository, JOB_SHEET_COLUMNS } from "../src/google-cloud/job-sheet-repository.js";
import { createJobCardService } from "../src/google-cloud/job-card-service.js";
import { jobSheetFixture as fixture } from "./fixtures/job-sheet.js";

const jobSheetFixture = {
  ...fixture,
  order: { ...fixture.order, orderId: "TEST-LIFECYCLE-001" },
};

const createdAt = "2026-10-14T12:00:00.000Z";
const approvedAt = "2026-10-14T12:05:00.000Z";
const bucket = "prepagent-hack-data";

function queryResult(row) {
  return {
    schema: {
      fields: JOB_SHEET_COLUMNS.map((name) => ({
        name,
        type: name.endsWith("_json") ? "JSON"
          : name === "created_at" || name === "approved_at" ? "TIMESTAMP"
            : name === "savings_kg" || name === "savings_cost" ? "FLOAT" : "STRING",
      })),
    },
    rows: [{
      f: JOB_SHEET_COLUMNS.map((name) => ({
        v: row[name] === null ? null
          : name.endsWith("_json") ? JSON.stringify(row[name])
            : String(row[name]),
      })),
    }],
  };
}

function lifecycleAdapters({ failReadCount = 0 } = {}) {
  const rows = new Map();
  const objects = new Map();
  let readCount = 0;
  let generation = 0;
  let clockReads = 0;
  const bigquery = {
    query: async ({ parameters }) => {
      readCount += 1;
      if (readCount <= failReadCount) throw new Error("temporary read failure");
      const row = rows.get(parameters.jobId);
      return row ? queryResult(row) : { rows: [] };
    },
  };
  const writer = {
    insertJobSheet: async ({ row }) => {
      if (rows.has(row.job_id)) return { inserted: false };
      rows.set(row.job_id, row);
      return { inserted: true };
    },
    approveDraft: async ({ jobId, approvedAt: timestamp, cardUri }) => {
      const row = rows.get(jobId);
      if (!row || row.status !== "DRAFT") return { affectedRows: 0 };
      rows.set(jobId, { ...row, status: "APPROVED", approved_at: timestamp, card_uri: cardUri });
      return { affectedRows: 1 };
    },
  };
  const repository = createJobSheetRepository({
    bigquery,
    writer,
    projectId: "prepagent-hack",
    now: () => new Date(clockReads++ === 0 ? createdAt : approvedAt),
  });
  const storage = {
    upload: async ({ name, bytes }) => {
      const objectGeneration = String(++generation);
      const gcsUri = `gs://${bucket}/${name}`;
      objects.set(gcsUri, { bytes, generation: objectGeneration });
      return { name, generation: objectGeneration, gcsUri };
    },
    download: async ({ name }) => ({
      contentType: "application/pdf",
      bytes: objects.get(`gs://${bucket}/${name}`).bytes,
    }),
    delete: async ({ name, generation: objectGeneration }) => {
      const gcsUri = `gs://${bucket}/${name}`;
      if (objects.get(gcsUri)?.generation === objectGeneration) objects.delete(gcsUri);
      return { deleted: true };
    },
  };
  return { repository, storage, rows, objects };
}

test("persisted DRAFT retries, recovers ambiguous approval, and retrieves its approved card", async () => {
  const adapters = lifecycleAdapters();
  const jobSheet = { ...jobSheetFixture, status: "DRAFT" };
  const input = {
    jobSheet,
    plantId: "PLANT-01",
    savingsCost: jobSheet.savings.inr,
    currency: jobSheet.baseline.risk.currency,
  };

  const created = await adapters.repository.createDraft(input);
  const duplicate = await adapters.repository.createDraft(input);
  assert.equal(created.status, "DRAFT");
  assert.equal(duplicate.jobId, created.jobId);
  assert.equal((await adapters.repository.get(created.jobId)).status, "DRAFT");
  assert.equal(adapters.rows.size, 1);

  const cards = createJobCardService({
    repository: {
      get: (id, options) => adapters.repository.get(id, options),
      approve: async (approvalInput) => {
        const result = await adapters.repository.approve({
          ...approvalInput,
          approvedAt,
        });
        assert.equal(result.ok, true);
        throw new Error("approval response lost after the repository committed it");
      },
    },
    storage: adapters.storage,
    renderPdf: async () => new Uint8Array(Buffer.from("%PDF-1.4\nrecovery test")),
    bucket,
  });

  const approval = await cards.approveJob({ jobId: created.jobId });
  assert.equal(approval.ok, true);
  assert.equal(approval.jobSheet.status, "APPROVED");
  assert.equal(approval.jobSheet.approvedAt, approvedAt);
  assert.equal((await adapters.repository.get(created.jobId)).cardUri, approval.cardUri);

  const card = await cards.getJobCard({ jobId: created.jobId });
  assert.equal(card.ok, true);
  assert.equal(card.filename, `${created.jobId}.pdf`);
  assert.equal(Buffer.from(card.bytes).toString("ascii", 0, 5), "%PDF-");
  assert.equal(adapters.objects.size, 1);
});

test("a failed read-back leaves a persisted DRAFT recoverable by an idempotent retry", async () => {
  const adapters = lifecycleAdapters({ failReadCount: 1 });
  const jobSheet = { ...jobSheetFixture, status: "DRAFT" };
  const input = {
    jobSheet,
    plantId: "PLANT-01",
    savingsCost: jobSheet.savings.inr,
    currency: jobSheet.baseline.risk.currency,
  };

  await assert.rejects(
    () => adapters.repository.createDraft(input),
    /temporary read failure/,
  );
  const retry = await adapters.repository.createDraft(input);
  assert.equal(retry.status, "DRAFT");
  assert.equal(retry.jobId, jobSheet.jobId);
  assert.equal((await adapters.repository.get(jobSheet.jobId)).status, "DRAFT");
  assert.equal(adapters.rows.size, 1);
});
