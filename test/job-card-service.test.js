import assert from "node:assert/strict";
import test from "node:test";
import { mapJobSheetFromBigQuery, mapJobSheetToBigQuery } from "../src/bigquery-mapper.js";
import { createJobCardService } from "../src/google-cloud/job-card-service.js";
import { jobSheetFixture as fixture } from "./fixtures/job-sheet.js";

const jobSheetFixture = {
  ...fixture,
  order: { ...fixture.order, orderId: "TEST-JOBCARD-001" },
};

const writeMetadata = {
  plantId: "PLANT-01",
  createdAt: "2026-10-12T10:00:00.000Z",
  savingsCost: jobSheetFixture.savings.inr,
  currency: "INR",
  approvedAt: null,
  cardUri: null,
};

function storedJob(
  status = "DRAFT",
  cardUri = null,
  approvedAt = status === "APPROVED" ? "2026-10-12T10:15:00.000Z" : null,
) {
  const row = mapJobSheetToBigQuery({ ...jobSheetFixture, status }, { ...writeMetadata, cardUri, approvedAt });
  return mapJobSheetFromBigQuery(row);
}

test("job-card service refuses non-TEST approval before rendering or upload", async () => {
  let uploads = 0;
  let renders = 0;
  const service = createJobCardService({
    repository: {
      get: async () => ({ ...storedJob(), order: { ...storedJob().order, orderId: "PO-REAL-001" } }),
      approve: async () => assert.fail("Non-TEST record must not be approved."),
    },
    storage: {
      upload: async () => { uploads += 1; },
      download: async () => assert.fail("No card should be read."),
      delete: async () => assert.fail("No object should be written."),
    },
    renderPdf: async () => { renders += 1; return new Uint8Array(); },
    bucket: "prepagent-hack-data",
  });
  const result = await service.approveJob({ jobId: jobSheetFixture.jobId });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "TEST_RECORD_REQUIRED");
  assert.equal(uploads, 0);
  assert.equal(renders, 0);
});

test("approval renders and stores an approved PDF before recording conditional approval", async () => {
  const operations = [];
  let cardUri;
  const current = storedJob();
  const service = createJobCardService({
    repository: {
      get: async () => current,
      approve: async ({ cardUri: uri }) => {
        operations.push("persist");
        assert.equal(uri, cardUri);
        return { ok: true, data: storedJob("APPROVED", uri) };
      },
    },
    storage: {
      upload: async (input) => {
        operations.push("upload");
        assert.match(input.name, /^jobcards\/JOB-TEST-42-.+\.pdf$/);
        assert.equal(input.contentType, "application/pdf");
        assert.equal(Buffer.from(input.bytes).toString("ascii", 0, 5), "%PDF-");
        cardUri = `gs://prepagent-hack-data/${input.name}`;
        return { name: input.name, generation: "123", gcsUri: cardUri };
      },
      download: async () => assert.fail("approval must not download"),
      delete: async () => assert.fail("successful approval must not delete"),
    },
    renderPdf: async (job) => {
      operations.push("render");
      assert.equal(job.status, "APPROVED");
      assert.equal(job.savings.inr, 0);
      return new Uint8Array(Buffer.from("%PDF-1.4\ncard"));
    },
    bucket: "prepagent-hack-data",
  });

  const result = await service.approveJob({ jobId: current.jobId });
  assert.equal(result.ok, true);
  assert.equal(result.cardUri, cardUri);
  assert.equal(result.jobSheet.status, "APPROVED");
  assert.deepEqual(operations, ["render", "upload", "persist"]);
});

test("failed approval persistence cleans only the uploaded object generation", async () => {
  const deleted = [];
  const service = createJobCardService({
    repository: {
      get: async () => storedJob(),
      approve: async () => ({ ok: false, error: { code: "CONFLICT", message: "Changed." } }),
    },
    storage: {
      upload: async ({ name }) => ({ name, generation: "456", gcsUri: `gs://prepagent-hack-data/${name}` }),
      download: async () => assert.fail("not used"),
      delete: async (input) => { deleted.push(input); return { deleted: true }; },
    },
    renderPdf: async () => new Uint8Array(Buffer.from("%PDF-1.4\ncard")),
    bucket: "prepagent-hack-data",
  });

  const result = await service.approveJob({ jobId: "JOB-TEST-42" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "CONFLICT");
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0].generation, "456");
});

test("approval reconciles an ambiguous write from stored state and retains the referenced card", async () => {
  let cardUri;
  let persisted;
  const deleted = [];
  let reads = 0;
  const service = createJobCardService({
    repository: {
      get: async () => {
        reads += 1;
        return reads === 1 ? storedJob() : persisted;
      },
      approve: async () => { throw new Error("write response was lost after commit"); },
    },
    storage: {
      upload: async ({ name }) => {
        cardUri = `gs://prepagent-hack-data/${name}`;
        persisted = storedJob("APPROVED", cardUri);
        return { name, generation: "789", gcsUri: cardUri };
      },
      download: async () => assert.fail("not used"),
      delete: async (input) => { deleted.push(input); },
    },
    renderPdf: async () => new Uint8Array(Buffer.from("%PDF-1.4\ncard")),
    bucket: "prepagent-hack-data",
  });

  const result = await service.approveJob({ jobId: jobSheetFixture.jobId });
  assert.equal(result.ok, true);
  assert.equal(result.cardUri, cardUri);
  assert.equal(result.jobSheet.status, "APPROVED");
  assert.equal(deleted.length, 0);
});

test("approval retains an uploaded card when the write outcome cannot be read back", async () => {
  const deleted = [];
  let reads = 0;
  const service = createJobCardService({
    repository: {
      get: async () => {
        reads += 1;
        if (reads === 1) return storedJob();
        throw new Error("read unavailable");
      },
      approve: async () => { throw new Error("write outcome unknown"); },
    },
    storage: {
      upload: async ({ name }) => ({ name, generation: "790", gcsUri: `gs://prepagent-hack-data/${name}` }),
      download: async () => assert.fail("not used"),
      delete: async (input) => { deleted.push(input); },
    },
    renderPdf: async () => new Uint8Array(Buffer.from("%PDF-1.4\ncard")),
    bucket: "prepagent-hack-data",
  });

  const result = await service.approveJob({ jobId: "JOB-TEST-42" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  assert.match(result.error.message, /retained for recovery/);
  assert.equal(deleted.length, 0);
});

test("an unapproved advanced state cannot generate a job card", async () => {
  let uploadCount = 0;
  const service = createJobCardService({
    repository: {
      get: async () => storedJob("RUN"),
      approve: async () => assert.fail("RUN jobs cannot be approved again"),
    },
    storage: {
      upload: async () => { uploadCount += 1; },
      download: async () => assert.fail("not used"),
      delete: async () => {},
    },
    renderPdf: async () => assert.fail("RUN jobs must not be rendered as a new card"),
    bucket: "prepagent-hack-data",
  });

  const result = await service.approveJob({ jobId: "JOB-TEST-42" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "CONFLICT");
  assert.equal(uploadCount, 0);
});

test("stored card download is private, validates bucket URI and requires approval", async () => {
  const approved = storedJob("APPROVED", "gs://prepagent-hack-data/jobcards/JOB-TEST-42.pdf");
  let downloadCount = 0;
  const service = createJobCardService({
    repository: { get: async () => approved, approve: async () => assert.fail("not used") },
    storage: {
      upload: async () => assert.fail("not used"),
      download: async ({ name }) => {
        downloadCount += 1;
        assert.equal(name, "jobcards/JOB-TEST-42.pdf");
        return { contentType: "application/pdf", bytes: new Uint8Array(Buffer.from("%PDF-1.7\ncard")) };
      },
      delete: async () => assert.fail("not used"),
    },
    renderPdf: async () => assert.fail("not used"),
    bucket: "prepagent-hack-data",
  });
  const file = await service.getJobCard({ jobId: approved.jobId });
  assert.equal(file.ok, true);
  assert.equal(file.contentType, "application/pdf");
  assert.equal(Buffer.from(file.bytes).toString("ascii", 0, 5), "%PDF-");
  assert.equal(downloadCount, 1);

  const draftService = createJobCardService({
    repository: { get: async () => storedJob(), approve: async () => assert.fail("not used") },
    storage: { upload: async () => {}, download: async () => assert.fail("draft must not download"), delete: async () => {} },
    renderPdf: async () => new Uint8Array(),
    bucket: "prepagent-hack-data",
  });
  assert.equal((await draftService.getJobCard({ jobId: "JOB-TEST-42" })).error.code, "CONFLICT");
});

test("stored card rejects language or currency it cannot render", async () => {
  const service = createJobCardService({
    repository: { get: async () => assert.fail("unsupported preferences must be rejected before reading"), approve: async () => {} },
    storage: { upload: async () => {}, download: async () => {}, delete: async () => {} },
    renderPdf: async () => new Uint8Array(),
    bucket: "prepagent-hack-data",
  });
  const translated = await service.getJobCard({ jobId: "JOB-TEST-42", lang: "hi" });
  const converted = await service.getJobCard({ jobId: "JOB-TEST-42", currency: "USD" });
  assert.equal(translated.ok, false);
  assert.equal(translated.error.code, "SERVICE_UNAVAILABLE");
  assert.equal(converted.ok, false);
  assert.equal(converted.error.code, "SERVICE_UNAVAILABLE");
});

test("approval rejects unsupported card preferences before reading or writing a job", async () => {
  const service = createJobCardService({
    repository: {
      get: async () => assert.fail("unsupported preferences must be rejected before reading"),
      approve: async () => assert.fail("unsupported preferences must not approve"),
    },
    storage: {
      upload: async () => assert.fail("unsupported preferences must not upload"),
      download: async () => assert.fail("not used"),
      delete: async () => assert.fail("not used"),
    },
    renderPdf: async () => assert.fail("unsupported preferences must not render"),
    bucket: "prepagent-hack-data",
  });

  const translated = await service.approveJob({ jobId: "JOB-TEST-42", lang: "mr" });
  const converted = await service.approveJob({ jobId: "JOB-TEST-42", currency: "USD" });

  assert.equal(translated.ok, false);
  assert.equal(translated.error.code, "SERVICE_UNAVAILABLE");
  assert.equal(converted.ok, false);
  assert.equal(converted.error.code, "SERVICE_UNAVAILABLE");
});
