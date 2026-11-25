// O3 for PO1: Arc and New Lot call the same commands, so the same order, line, conditions and
// planned settings reach the same job identity, the same model requests and the same draft.
// Each route runs on its own backend (its own stores and idempotency records), so the dashboard
// side really plans instead of replaying Arc's job. The model and BigQuery answers are recorded
// replays (test/fixtures/arc-lot-flow.js); the test compares the two routes, not the models.
import assert from "node:assert/strict";
import test from "node:test";
import { action, events, fixture } from "./fixtures/arc-turn-runner.js";
import { CONDITIONS, CONFIRM_CONDITIONS, LEVERS, lotBackend, PO1 } from "./fixtures/arc-lot-flow.js";

const DRAFT_FIELDS = ["jobId", "status", "order", "conditions", "baseline", "recommended", "changes", "savings", "explanation", "evidence"];
const pick = (record, fields) => Object.fromEntries(fields.map((field) => [field, record[field]]));
const succeeded = (frames, tool) => frames.find((frame) => frame.type === "step.succeeded" && frame.tool === tool).resultRef.id;

test("PO1 through Arc reaches the same job identity, settings and scrap estimate as POST /jobs with the same inputs", async () => {
  const arcSide = lotBackend();
  const arc = fixture({
    router: () => assert.fail("the Arc route here is buttons only"),
    services: arcSide.servicePorts, commandDeps: arcSide.commandDeps, lotStore: arcSide.lotStore,
  });
  const reviewId = succeeded(await events(await arc.post(action("read_sample_order", { sampleId: "PO1" }))), "read_order");
  const lotId = succeeded(await events(await arc.post(action("confirm_order", { reviewId, lineIndex: 0 }))), "confirm_order");
  const planned = await events(await arc.post(action("confirm_conditions", CONFIRM_CONDITIONS)));
  const jobId = succeeded(planned, "plan_lot");
  const run = await arc.taskRunStore.get(planned[0].taskRunId);
  const idempotencyKey = run.steps.find(({ tool }) => tool === "plan_lot").idempotencyKey;
  const arcReview = (await arcSide.reviews.loadReview({ reviewId, ownerSessionId: arc.principal.sessionId })).review;

  // New Lot's two requests, POST /orders/extract then POST /jobs, with the fields its client sends, in the
  // same demo session and with the lot ID and Idempotency-Key Arc used, which the job identity includes.
  const dashboardSide = lotBackend();
  const review = await dashboardSide.dashboard.readOrder(arc.principal);
  assert.equal(review.ok, true, JSON.stringify(review.error));
  assert.equal(review.reviewFingerprint, arcReview.reviewFingerprint, "both routes stored the same order review");
  const job = await dashboardSide.dashboard.planLot(arc.principal, { review, lotId, idempotencyKey });
  assert.equal(job.ok, true, JSON.stringify(job.error));

  // Same request identity: the same job ID and request fingerprint went to the submission handler.
  assert.equal(arcSide.requests.submit.length, 1);
  assert.deepEqual(dashboardSide.requests.submit, arcSide.requests.submit);
  assert.equal(job.jobSheet.jobId, jobId);

  // The same requests reached Gemini and BigQuery at every stage.
  for (const port of ["predict", "optimize", "similar", "explainQuery", "explainModel"]) {
    assert.ok(arcSide.requests[port].length > 0, `${port} was called`);
    assert.deepEqual(dashboardSide.requests[port], arcSide.requests[port], port);
  }
  assert.deepEqual(dashboardSide.requests.vertex.map(({ body }) => body), arcSide.requests.vertex.map(({ body }) => body), "order extraction");

  // The stored drafts agree field by field: item, quantity, conditions, settings and the scrap estimate.
  const arcDraft = arcSide.drafts.get(jobId);
  const dashboardDraft = dashboardSide.drafts.get(jobId);
  assert.deepEqual(pick(dashboardDraft, DRAFT_FIELDS), pick(arcDraft, DRAFT_FIELDS));
  assert.deepEqual([arcDraft.order.itemCode, arcDraft.order.quantity], [PO1.itemCode, PO1.quantity]);
  assert.deepEqual(pick(arcDraft.conditions, Object.keys(CONDITIONS)), CONDITIONS);
  assert.deepEqual(arcDraft.baseline.levers, LEVERS);
  assert.deepEqual(
    [arcDraft.baseline.risk.totalScrapKg, arcDraft.recommended.risk.totalScrapKg, arcDraft.savings],
    [dashboardDraft.baseline.risk.totalScrapKg, dashboardDraft.recommended.risk.totalScrapKg, dashboardDraft.savings],
  );

  // The same revision: number, status and the fingerprint the Approve card sends.
  const arcLot = await arcSide.lotStore.getLot({ lotId, ownerSessionId: arc.principal.sessionId });
  assert.deepEqual(job.revision, { lotId, number: arcLot.revision.number, fingerprint: arcLot.revision.revisionFingerprint, status: "CURRENT" });
  assert.equal(arcLot.revision.status, "CURRENT");
});
