// The per-session daily plan limit (M3-01 security review, Medium-1). It is checked in planLot,
// so Arc's Confirm conditions and New Lot's POST /jobs share one count per session and IST day.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { action, events, fixture } from "./fixtures/arc-turn-runner.js";
import { conditionsFor, lotBackend, PO1, PO1_EXTRACTION } from "./fixtures/arc-lot-flow.js";

const TWO_LINES = { ...PO1_EXTRACTION, lines: [
  { itemCode: PO1.itemCode, quantity: 1300, sourcePage: 1 },
  { itemCode: PO1.itemCode, quantity: 500, sourcePage: 1 },
] };
const succeeded = (frames, tool) => frames.find((frame) => frame.type === "step.succeeded" && frame.tool === tool)?.resultRef?.id;

function setup(plansPerDay) {
  const backend = lotBackend({ extraction: TWO_LINES, plansPerDay });
  const arc = fixture({
    router: () => assert.fail("buttons only"),
    services: backend.servicePorts, commandDeps: backend.commandDeps, lotStore: backend.lotStore,
  });
  return { backend, arc };
}

async function twoLots(arc) {
  const reviewId = succeeded(await events(await arc.post(action("read_sample_order", { sampleId: "PO1" }))), "read_order");
  const lotA = succeeded(await events(await arc.post(action("confirm_order", { reviewId, lineIndex: 0 }))), "confirm_order");
  const lotB = succeeded(await events(await arc.post(action("confirm_order", { reviewId, lineIndex: 1 }))), "confirm_order");
  return { reviewId, lotA, lotB };
}

test("past the session's daily plan limit Arc blocks the plan before any planning, and a replay still answers", async () => {
  const { backend, arc } = setup(1);
  const { lotA, lotB } = await twoLots(arc);
  const firstTurn = randomUUID();
  const first = await events(await arc.post(action("confirm_conditions", conditionsFor(lotA)), { clientTurnId: firstTurn }));
  assert.ok(succeeded(first, "plan_lot"));

  const second = await events(await arc.post(action("confirm_conditions", conditionsFor(lotB))));
  assert.deepEqual(second.slice(-2).map(({ type, tool, errorCode }) => [type, tool, errorCode ?? null]), [
    ["step.started", "plan_lot", null], ["step.blocked", "plan_lot", "PLAN_DAILY_LIMIT_REACHED"],
  ]);
  assert.equal(second.at(-1).retrySafe, false);
  assert.equal(backend.requests.submit.length, 1, "the blocked plan reached no submission");
  assert.equal(backend.requests.predict.length, 1, "and ran no prediction");
  const lot = await backend.lotStore.getLot({ lotId: lotB, ownerSessionId: arc.principal.sessionId });
  assert.deepEqual([lot.head.currentRevision, lot.revision], [0, null], "no revision was registered");

  const replayed = await events(await arc.post(action("confirm_conditions", conditionsFor(lotA)), { clientTurnId: firstTurn }), "replayed");
  assert.deepEqual(replayed, first);
});

test("POST /jobs past the limit is refused with 429 and writes nothing; the same request again is not counted twice", async () => {
  const { backend, arc } = setup(1);
  const { lotA, lotB } = await twoLots(arc);
  await events(await arc.post(action("confirm_conditions", conditionsFor(lotA))));
  const review = await backend.dashboard.readOrder(arc.principal);
  const refused = await backend.dashboard.planLot(arc.principal, { review, lotId: lotB, idempotencyKey: "dashboard-key-0001" });
  assert.equal(refused.ok, false);
  assert.equal(refused.status, 429);
  assert.equal(refused.error.code, "PLAN_DAILY_LIMIT_REACHED");
  assert.ok(Number.isSafeInteger(refused.error.retryAfterSeconds) && refused.error.retryAfterSeconds > 0);
  assert.equal(backend.requests.submit.length, 1);
  const lot = await backend.lotStore.getLot({ lotId: lotB, ownerSessionId: arc.principal.sessionId });
  assert.equal(lot.revision, null);
});

test("with room under the limit, a resumed or repeated plan counts once", async () => {
  const { backend, arc } = setup(2);
  const { lotA, lotB } = await twoLots(arc);
  const turn = randomUUID();
  await events(await arc.post(action("confirm_conditions", conditionsFor(lotA)), { clientTurnId: turn }));
  const review = await backend.dashboard.readOrder(arc.principal);
  // New Lot planning lot A again with the same inputs and key as Arc's step is the same request.
  const run = await arc.taskRunStore.get((await arc.sessionStore.getTurn(arc.principal.sessionId, turn)).taskRunId);
  const key = run.steps.find(({ tool }) => tool === "plan_lot").idempotencyKey;
  assert.equal((await backend.dashboard.planLot(arc.principal, { review: { ...review }, lotId: lotA, idempotencyKey: key })).ok, true);
  assert.ok(succeeded(await events(await arc.post(action("confirm_conditions", conditionsFor(lotB)))), "plan_lot"),
    "the replay of lot A did not use the second plan");
});
