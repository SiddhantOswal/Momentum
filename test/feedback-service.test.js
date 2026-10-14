import assert from "node:assert/strict";
import test from "node:test";
import { createFeedbackService } from "../src/google-cloud/feedback-service.js";

const timestamp = "2026-10-12T10:00:00.000Z";
const feedback = {
  jobId: "JOB-42",
  lotId: "LOT-9",
  rateWarpPct: 1.25,
  operatorNote: "Observed warp on line 2",
  noteLang: "en",
};

test("feedback adapter maps and persists observed feedback without rewriting the operator note", async () => {
  let request;
  const saveFeedback = createFeedbackService({
    now: () => new Date(timestamp),
    writer: { insertRow: async (input) => { request = input; } },
  });
  const controller = new AbortController();
  const result = await saveFeedback({ ...feedback, signal: controller.signal });
  assert.deepEqual(result, { ok: true, agent: "saveFeedback", status: "stored", createdAt: timestamp });
  assert.equal(request.table, "feedback");
  assert.match(request.insertId, /^feedback-[a-f0-9]{64}$/);
  assert.equal(request.signal, controller.signal);
  assert.deepEqual(request.row, {
    job_id: "JOB-42",
    lot_id: "LOT-9",
    created_at: timestamp,
    rate_warp_pct: 1.25,
    rate_delam_pct: null,
    rate_strength_pct: null,
    rate_print_pct: null,
    rate_crack_pct: null,
    photo_uri: null,
    photo_defect: null,
    photo_confidence: null,
    override: null,
    operator_note: "Observed warp on line 2",
    operator_note_en: null,
    note_lang: "en",
  });
});

test("feedback adapter returns a bounded unavailable response for write failures", async () => {
  const saveFeedback = createFeedbackService({
    writer: { insertRow: async () => { throw new Error("do not expose provider details"); } },
  });
  assert.deepEqual(await saveFeedback(feedback), {
    ok: false,
    error: { code: "SERVICE_UNAVAILABLE", message: "Feedback persistence is temporarily unavailable." },
  });
});

test("feedback adapter refuses photo data until consent and provenance-safe storage are configured", async () => {
  let writes = 0;
  const saveFeedback = createFeedbackService({
    writer: { insertRow: async () => { writes += 1; } },
  });

  const result = await saveFeedback({
    ...feedback,
    photoUri: "gs://private-bucket/photo.jpg",
    photoDefect: "WARP",
    photoConfidence: 0.9,
  });

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "Photo feedback is disabled until consent capture and provenance-safe storage are configured.",
    },
  });
  assert.equal(writes, 0);
});

test("feedback retries reuse a payload-derived insert ID despite a new timestamp", async () => {
  const requests = [];
  let writeAttempt = 0;
  let clockTick = 0;
  const saveFeedback = createFeedbackService({
    now: () => new Date(Date.parse(timestamp) + clockTick++ * 1_000),
    writer: {
      insertRow: async (request) => {
        requests.push(request);
        writeAttempt += 1;
        if (writeAttempt === 1) throw new Error("temporary write failure");
      },
    },
  });

  const failed = await saveFeedback(feedback);
  const retried = await saveFeedback(feedback);
  assert.equal(failed.ok, false);
  assert.equal(retried.ok, true);
  assert.equal(requests[0].insertId, requests[1].insertId);
  assert.notEqual(requests[0].row.created_at, requests[1].row.created_at);

  await saveFeedback({ ...feedback, rateWarpPct: 1.5 });
  assert.notEqual(requests[1].insertId, requests[2].insertId);
});
