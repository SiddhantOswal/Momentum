import assert from "node:assert/strict";
import test from "node:test";
import { createStoredJobSheetLookup } from "../src/stored-job-sheet-lookup.js";
import { jobSheetFixture } from "./fixtures/job-sheet.js";

const storedJob = {
  ...jobSheetFixture,
  createdAt: "2026-10-12T10:00:00.000Z",
  plantId: "PLANT-SYNTHETIC-001",
  evidence: [],
  savings: { kg: 0, amount: 0, currency: "INR" },
  approvedAt: null,
  cardUri: null,
};

test("stored job lookup requires a retrieval port", () => {
  assert.throws(() => createStoredJobSheetLookup({}), { name: "TypeError" });
});

test("prototype TEST-only retrieval refuses a valid unrelated stored order without disclosing its payload", async () => {
  for (const [orderId, allowed] of [["TEST-APPROVED-FIXTURE", true], ["CUSTOMER-LIVE-1", false], ["PO-TEST-SPOOF", false]]) {
    const job = { ...storedJob, order: { ...storedJob.order, orderId } };
    const lookup = createStoredJobSheetLookup({ getStoredJobSheet: async () => job, testOnly: true });
    const result = await lookup({ jobId: job.jobId });
    assert.equal(result.ok, allowed);
    if (!allowed) {
      assert.equal(result.error.code, "NOT_FOUND");
      assert.equal(result.jobSheet, undefined);
    }
  }
});

test("stored job lookup returns the validated persisted JobSheet", async () => {
  const calls = [];
  const lookup = createStoredJobSheetLookup({
    getStoredJobSheet: async (request) => {
      calls.push(request);
      return storedJob;
    },
  });
  const controller = new AbortController();
  assert.deepEqual(await lookup({ jobId: storedJob.jobId, signal: controller.signal }), {
    ok: true,
    jobSheet: storedJob,
  });
  assert.deepEqual(calls, [{ jobId: storedJob.jobId, signal: controller.signal }]);
});

test("stored job lookup rejects a missing job ID before calling the port", async () => {
  let reads = 0;
  const lookup = createStoredJobSheetLookup({
    getStoredJobSheet: async () => {
      reads += 1;
      return storedJob;
    },
  });
  const result = await lookup({ jobId: "   " });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.equal(reads, 0);
});

test("stored job lookup maps missing, mismatched, and malformed rows", async () => {
  const cases = [
    { stored: undefined, code: "NOT_FOUND" },
    { stored: null, code: "NOT_FOUND" },
    { stored: { ...storedJob, jobId: "OTHER-JOB" }, code: "NOT_FOUND" },
    { stored: { jobId: storedJob.jobId }, code: "SERVICE_UNAVAILABLE" },
  ];
  for (const { stored, code } of cases) {
    const lookup = createStoredJobSheetLookup({
      getStoredJobSheet: async () => stored,
    });
    const result = await lookup({ jobId: storedJob.jobId });
    assert.equal(result.ok, false, code);
    assert.equal(result.error.code, code);
  }
});

test("stored job lookup preserves unavailable reads and cancellation", async () => {
  const unavailable = {
    ok: false,
    error: { code: "SERVICE_UNAVAILABLE", message: "read unavailable" },
  };
  const lookup = createStoredJobSheetLookup({
    getStoredJobSheet: async () => unavailable,
  });
  assert.deepEqual(await lookup({ jobId: storedJob.jobId }), unavailable);

  const cancelled = createStoredJobSheetLookup({
    getStoredJobSheet: async () => {
      const error = new Error("cancelled");
      error.name = "AbortError";
      throw error;
    },
  });
  await assert.rejects(cancelled({ jobId: storedJob.jobId }), { name: "AbortError" });
});
