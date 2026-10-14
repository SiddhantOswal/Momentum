import assert from "node:assert/strict";
import test from "node:test";
import { createLinkedFeedbackService } from "../src/linked-feedback-service.js";
import { jobSheetFixture } from "./fixtures/job-sheet.js";

const input = { jobId: jobSheetFixture.jobId, lotId: "LOT-SYNTHETIC-001", rateWarpPct: 2 };
const storedJob = {
  ...jobSheetFixture,
  order: { ...jobSheetFixture.order, orderId: "TEST-FEEDBACK-001" },
  createdAt: "2026-10-12T10:00:00.000Z",
  plantId: "PLANT-SYNTHETIC-001",
  evidence: [],
  savings: { kg: 0, amount: 0, currency: "INR" },
  approvedAt: null,
  cardUri: null,
};

test("linked feedback reads and validates the referenced job before saving", async () => {
  const calls = [];
  const saveFeedback = createLinkedFeedbackService({
    getStoredJobSheet: async (request) => {
      calls.push(["get", request]);
      return storedJob;
    },
    getLotOrder: async (request) => {
      calls.push(["lot", request]);
      return storedJob.order.orderId;
    },
    saveFeedback: async (request) => {
      calls.push(["save", request]);
      return { ok: true, status: "stored" };
    },
  });

  assert.deepEqual(await saveFeedback(input), { ok: true, status: "stored" });
  assert.deepEqual(calls.map(([name]) => name), ["get", "lot", "save"]);
  assert.equal(calls[0][1].jobId, input.jobId);
  assert.deepEqual(calls[1][1], { lotId: input.lotId });
  assert.deepEqual(calls[2][1], input);
});

test("linked feedback rejects an unknown job without calling the writer", async () => {
  let writes = 0;
  const saveFeedback = createLinkedFeedbackService({
    getStoredJobSheet: async () => undefined,
    saveFeedback: async () => { writes += 1; return { ok: true }; },
  });

  assert.deepEqual(await saveFeedback(input), {
    ok: false,
    error: { code: "NOT_FOUND", message: "Feedback requires an existing stored job." },
  });
  assert.equal(writes, 0);
});

test("linked feedback refuses writes for non-TEST orders", async () => {
  let writes = 0;
  const saveLinkedFeedback = createLinkedFeedbackService({
    getStoredJobSheet: async () => ({
      ...storedJob,
      order: { ...storedJob.order, orderId: "PO-REAL-001" },
    }),
    saveFeedback: async () => { writes += 1; return { ok: true }; },
  });
  assert.deepEqual(await saveLinkedFeedback({ jobId: input.jobId, rateWarpPct: 2 }), {
    ok: false,
    error: { code: "TEST_RECORD_REQUIRED", message: "Feedback writes are restricted to stored TEST- orders." },
  });
  assert.equal(writes, 0);
});

test("linked feedback rejects malformed or mismatched stored jobs without writing", async () => {
  let writes = 0;
  const cases = [
    { stored: { ...storedJob, jobId: "OTHER-JOB" }, code: "NOT_FOUND" },
    { stored: { jobId: input.jobId }, code: "SERVICE_UNAVAILABLE" },
  ];
  for (const { stored, code } of cases) {
    const saveLinkedFeedback = createLinkedFeedbackService({
      getStoredJobSheet: async () => stored,
      saveFeedback: async () => { writes += 1; return { ok: true }; },
    });
    const result = await saveLinkedFeedback(input);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, code);
  }
  assert.equal(writes, 0);
});

test("linked feedback preserves unavailable reads and propagates cancellation", async () => {
  const unavailable = { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "read unavailable" } };
  const service = createLinkedFeedbackService({
    getStoredJobSheet: async () => unavailable,
    saveFeedback: async () => assert.fail("writer must not run"),
  });
  assert.deepEqual(await service(input), unavailable);

  const cancelled = createLinkedFeedbackService({
    getStoredJobSheet: async () => { const error = new Error("cancelled"); error.name = "AbortError"; throw error; },
    saveFeedback: async () => assert.fail("writer must not run"),
  });
  await assert.rejects(cancelled(input), { name: "AbortError" });
});

test("linked feedback rejects lots that are missing or belong to a different order", async () => {
  let writes = 0;
  for (const { lotOrder, code } of [
    { lotOrder: undefined, code: "NOT_FOUND" },
    { lotOrder: "OTHER-ORDER", code: "CONFLICT" },
  ]) {
    const saveLinkedFeedback = createLinkedFeedbackService({
      getStoredJobSheet: async () => storedJob,
      getLotOrder: async () => lotOrder,
      saveFeedback: async () => { writes += 1; return { ok: true }; },
    });
    const result = await saveLinkedFeedback(input);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, code);
  }
  assert.equal(writes, 0);
});

test("feedback without an optional lot ID does not request a lot lookup", async () => {
  let lookups = 0;
  const saveLinkedFeedback = createLinkedFeedbackService({
    getStoredJobSheet: async () => storedJob,
    getLotOrder: async () => { lookups += 1; return storedJob.order.orderId; },
    saveFeedback: async () => ({ ok: true, status: "stored" }),
  });

  assert.deepEqual(await saveLinkedFeedback({ jobId: input.jobId, rateWarpPct: 2 }), {
    ok: true,
    status: "stored",
  });
  assert.equal(lookups, 0);
});
