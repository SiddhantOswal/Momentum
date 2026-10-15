import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mapJobSheetToBigQuery } from "../src/bigquery-mapper.js";
import { createJobSheetRepository, JOB_SHEET_COLUMNS } from "../src/google-cloud/job-sheet-repository.js";
import { createJobCardService } from "../src/google-cloud/job-card-service.js";
import { createBigQueryWriteClient } from "../src/google-cloud/bigquery-write-client.js";
import { jobSheetFixture } from "./fixtures/job-sheet.js";
import { testSupervisor } from "./fixtures/verified-supervisor.js";

const fixedTime = "2026-10-15T10:00:00.000Z";
const job = { ...jobSheetFixture, order: { ...jobSheetFixture.order, orderId: "TEST-AUDIT-1" } };

function environment({ dropAudit = false, storageFails = false, scopedJob = job } = {}) {
  let row = { ...mapJobSheetToBigQuery(scopedJob, { plantId: "PLANT-01", createdAt: fixedTime, savingsCost: 0, currency: "INR" }), approval_audit_json: null };
  let writes = 0;
  const files = new Map();
  const columns = [...JOB_SHEET_COLUMNS, "approval_audit_json"];
  const repository = () => createJobSheetRepository({
    projectId: "prepagent-hack", approvalAuditEnabled: true, now: () => new Date(fixedTime),
    bigquery: { query: async () => ({
      schema: { fields: columns.map(name => ({ name, type: name.endsWith("_json") ? "JSON" : ["savings_kg", "savings_cost"].includes(name) ? "FLOAT64" : "STRING" })) },
      rows: [{ f: columns.map(name => ({ v: row[name] === null ? null : name.endsWith("_json") ? JSON.stringify(row[name]) : String(row[name]) })) }],
    }) },
    writer: {
      insertJobSheet: async () => ({ inserted: false }),
      approveDraft: async ({ approvedAt, cardUri, approvalAudit }) => {
        if (row.status !== "DRAFT") return { affectedRows: 0 };
        writes += 1;
        row = { ...row, status: "APPROVED", approved_at: approvedAt, card_uri: cardUri,
          approval_audit_json: dropAudit ? null : approvalAudit };
        return { affectedRows: 1 };
      },
    },
  });
  const storage = {
    upload: async ({ name, bytes }) => {
      if (storageFails) throw new Error("GCS unavailable");
      files.set(name, bytes);
      return { name, generation: "1", gcsUri: `gs://prepagent-hack-data/${name}` };
    },
    delete: async ({ name }) => { files.delete(name); },
    download: async ({ name }) => ({ contentType: "application/pdf", bytes: files.get(name) }),
  };
  const cards = () => createJobCardService({
    repository: repository(), storage, bucket: "prepagent-hack-data", requireApprovalAudit: true,
    renderPdf: async () => Buffer.from("%PDF-local-approval-test-double"),
  });
  return { repository, cards, files, get row() { return row; }, get writes() { return writes; } };
}

test("approval audit refuses an unverified principal and forged role object before reads/writes", async () => {
  const context = environment();
  for (const supervisorPrincipal of [undefined, { uid: "forged", role: "supervisor", provider: "google.com" }]) {
    assert.equal((await context.cards().approveJob({ jobId: job.jobId, supervisorPrincipal })).error.code, "SUPERVISOR_AUTHORIZATION_REQUIRED");
    assert.equal((await context.cards().getJobCard({ jobId: job.jobId, supervisorPrincipal })).error.code, "SUPERVISOR_AUTHORIZATION_REQUIRED");
  }
  assert.equal(context.writes, 0);
  assert.equal(context.files.size, 0);
});

test("approval atomically records verified actor, status, server time and card and supports independent replay/readback", async () => {
  const context = environment();
  const supervisorPrincipal = await testSupervisor();
  const correlationId = randomUUID();
  const first = await context.cards().approveJob({ jobId: job.jobId, supervisorPrincipal, correlationId });
  assert.equal(first.ok, true);
  const audit = first.jobSheet.approvalAudit;
  assert.equal(audit.actorUid, supervisorPrincipal.uid);
  assert.equal(audit.previousStatus, "DRAFT");
  assert.equal(audit.newStatus, "APPROVED");
  assert.equal(audit.decidedAt, fixedTime);
  assert.equal(audit.correlationId, correlationId);
  assert.equal(audit.cardUri, first.cardUri);
  const independent = await context.repository().get(job.jobId);
  assert.deepEqual(independent.approvalAudit, audit);
  const replay = await context.cards().approveJob({ jobId: job.jobId, supervisorPrincipal: await testSupervisor("another-test-supervisor") });
  assert.equal(replay.cardUri, first.cardUri);
  assert.deepEqual(replay.jobSheet.approvalAudit, audit);
  assert.equal(context.writes, 1);
  assert.equal((await context.cards().getJobCard({ jobId: job.jobId, supervisorPrincipal })).ok, true);
});

test("concurrent approval test doubles return the winning persisted card and one actor decision", async () => {
  const context = environment();
  const supervisorPrincipal = await testSupervisor();
  const [a, b] = await Promise.all([context.cards().approveJob({ jobId: job.jobId, supervisorPrincipal }), context.cards().approveJob({ jobId: job.jobId, supervisorPrincipal })]);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.cardUri, b.cardUri);
  assert.deepEqual(a.jobSheet.approvalAudit, b.jobSheet.approvalAudit);
  assert.equal(context.writes, 1);
  assert.equal(context.files.size, 1);
});

test("missing actor audit in readback, wrong job and failed GCS write never produce approval success", async () => {
  const supervisorPrincipal = await testSupervisor();
  const missing = environment({ dropAudit: true });
  assert.equal((await missing.cards().approveJob({ jobId: job.jobId, supervisorPrincipal })).ok, false);
  assert.equal((await missing.cards().getJobCard({ jobId: job.jobId, supervisorPrincipal })).ok, false);
  const wrongJob = environment();
  assert.equal((await wrongJob.cards().approveJob({ jobId: "different-job", supervisorPrincipal })).ok, false);
  assert.equal(wrongJob.writes, 0);
  const storageFailure = environment({ storageFails: true });
  assert.equal((await storageFailure.cards().approveJob({ jobId: job.jobId, supervisorPrincipal })).ok, false);
  assert.equal(storageFailure.writes, 0);
});

test("approval SQL stores actor audit in the same conditional TEST-only update", async () => {
  const context = environment();
  await context.cards().approveJob({ jobId: job.jobId, supervisorPrincipal: await testSupervisor() });
  let request;
  const writer = createBigQueryWriteClient({ projectId: "prepagent-hack", tokenProvider: async () => "test-token",
    fetchImpl: async (_url, options) => { request = JSON.parse(options.body); return Response.json({ jobComplete: true, numDmlAffectedRows: "1" }); } });
  const audit = context.row.approval_audit_json;
  await writer.approveDraft({ jobId: job.jobId, approvedAt: fixedTime, cardUri: audit.cardUri, approvalAudit: audit });
  assert.match(request.query, /approval_audit_json = PARSE_JSON\(@approvalAudit\)/);
  assert.match(request.query, /STARTS_WITH\(JSON_VALUE\(order_json, '\$\.orderId'\), 'TEST-'\)/);
  assert.deepEqual(JSON.parse(request.queryParameters.find(p => p.name === "approvalAudit").parameterValue.value), audit);
  await assert.rejects(writer.approveDraft({ jobId: "different-job", approvedAt: fixedTime, cardUri: audit.cardUri, approvalAudit: audit }), { code: "INVALID_APPROVAL_AUDIT" });
});

// Local BigQuery/GCS test doubles exercise the genuine repository/card orchestration.
test("hackathon approval persists honest actor provenance, replays and retrieves only within its session", async () => {
  const { createHackathonDemoAuthenticator, demoJobIdentity } = await import("../src/hackathon-demo-auth.js");
  const auth = createHackathonDemoAuthenticator({ mode: "HACKATHON_DEMO", signingKey: "a".repeat(64), syntheticOnly: true, auditEnabled: true });
  const actor = auth.authenticate(auth.issue()).principal;
  const other = auth.authenticate(auth.issue()).principal;
  const jobId = demoJobIdentity(actor, { keyHash: "c".repeat(64), fingerprint: "d".repeat(64) }).jobId;
  const context = environment({ scopedJob: { ...job, jobId } });
  for (const supervisorPrincipal of [other, { ...actor }]) {
    assert.equal((await context.cards().approveJob({ jobId, supervisorPrincipal })).ok, false);
    assert.equal((await context.cards().getJobCard({ jobId, supervisorPrincipal })).ok, false);
  }
  assert.equal(context.files.size, 0);
  const [a, b] = await Promise.all([context.cards().approveJob({ jobId, supervisorPrincipal: actor }), context.cards().approveJob({ jobId, supervisorPrincipal: actor })]);
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  assert.equal(a.cardUri, b.cardUri); assert.equal(context.writes, 1);
  const stored = await context.repository().get(jobId);
  assert.equal(stored.approvalAudit.actorUid, actor.uid);
  assert.equal(stored.approvalAudit.authenticatedHuman, false);
  assert.equal(stored.approvalAudit.authorizationMode, "HACKATHON_DEMO");
  const replay = await context.cards().approveJob({ jobId, supervisorPrincipal: actor });
  assert.equal(replay.cardUri, a.cardUri);
  const pdf = await context.cards().getJobCard({ jobId, supervisorPrincipal: actor });
  assert.equal(pdf.ok, true); assert.match(Buffer.from(pdf.bytes).toString(), /^%PDF-/);
  for (const options of [{ dropAudit: true }, { storageFails: true }]) {
    const broken = environment({ ...options, scopedJob: { ...job, jobId } });
    assert.equal((await broken.cards().approveJob({ jobId, supervisorPrincipal: actor })).ok, false);
    assert.equal((await broken.cards().getJobCard({ jobId, supervisorPrincipal: actor })).ok, false);
  }
});
