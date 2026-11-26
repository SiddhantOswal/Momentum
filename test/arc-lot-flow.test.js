import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { getLot } from "../src/commands/get-lot.js";
import { fromFirestoreFields } from "../src/google-cloud/firestore-rest.js";
import { action, arcConfig, events, fixture, text } from "./fixtures/arc-turn-runner.js";
import { CONDITIONS, conditionsFor, LEVERS, lotBackend, PO1, PO1_BYTES, PO1_EXTRACTION } from "./fixtures/arc-lot-flow.js";

const DOCS = "projects/prepagent-hack/databases/(default)/documents";
const shape = (frames) => frames.map(({ type, tool, waitingFor }) => [type, tool ?? null, waitingFor ?? null].filter(Boolean).join(":"));

// `wrap` and `wrapServices` replace deps before the runner is built, so a test can interrupt a command.
function setup({ router, reviewNow, extraction, backend: shared, wrap = (deps) => deps, wrapServices = (ports) => ports, config } = {}) {
  const backend = shared ?? lotBackend({ reviewNow, extraction });
  const commandDeps = wrap(backend.commandDeps);
  const arc = fixture({
    router: router ?? (() => assert.fail("a button never calls the router")),
    services: wrapServices(backend.servicePorts), commandDeps, lotStore: commandDeps.lotRevisions.store, ...(config && { config }),
  });
  const lotHeads = () => [...backend.lotFirestore.docs.entries()]
    .filter(([name]) => name.startsWith(`${DOCS}/lot_heads/`)).map(([, doc]) => fromFirestoreFields(doc.fields));
  return { backend, arc, lotHeads };
}

async function readPo1(arc, clientTurnId = randomUUID()) {
  const frames = await events(await arc.post(action("read_sample_order", { sampleId: "PO1" }), { clientTurnId }));
  const reviewId = frames.find(({ type, tool }) => type === "step.succeeded" && tool === "read_order").resultRef.id;
  return { frames, reviewId };
}

async function confirmLine(arc, reviewId, clientTurnId = randomUUID()) {
  const frames = await events(await arc.post(action("confirm_order", { reviewId, lineIndex: 0 }), { clientTurnId }));
  const lotId = frames.find(({ type, tool }) => type === "step.succeeded" && tool === "confirm_order")?.resultRef?.id;
  return { frames, lotId };
}

test("PO1 runs through Arc from the sample to the Approve card with no router call", async () => {
  const { backend, arc } = setup();
  const read = await readPo1(arc);
  assert.deepEqual(shape(read.frames), [
    "run.started", "step.started:read_order", "step.succeeded:read_order",
    "step.waiting_for_user:confirm_order:confirm_order", "answer",
  ]);
  assert.equal(backend.requests.vertex.length, 1, "one extraction call");
  const stored = await backend.reviews.loadReview({ reviewId: read.reviewId, ownerSessionId: arc.principal.sessionId });
  assert.deepEqual(stored.review.operatorFields, PO1.context, "Arc reads PO1 with the order context New Lot sends");

  const order = await confirmLine(arc, read.reviewId);
  assert.deepEqual(shape(order.frames), [
    "run.started", "step.started:confirm_order", "step.succeeded:confirm_order",
    "step.waiting_for_user:confirm_conditions:confirm_conditions", "answer",
  ]);
  const lot = (await backend.lotStore.getLot({ lotId: order.lotId, ownerSessionId: arc.principal.sessionId })).head;
  assert.deepEqual([lot.stage, lot.reviewId, lot.orderRef], ["conditions", read.reviewId, {
    orderId: PO1.context.orderId, itemCode: PO1.itemCode, quantity: PO1.quantity, lineIndex: 0,
  }]);
  assert.match(order.lotId, new RegExp(`^LOT-HACK-${arc.principal.sessionId}-[a-f0-9]{12}$`));

  const planTurn = randomUUID();
  const plan = await events(await arc.post(action("confirm_conditions", conditionsFor(order.lotId)), { clientTurnId: planTurn }));
  assert.deepEqual(shape(plan), [
    "run.started", "step.started:confirm_conditions", "step.succeeded:confirm_conditions",
    "step.started:plan_lot", "step.succeeded:plan_lot", "step.waiting_for_user:approve:approve", "answer",
  ]);
  const jobId = plan.find(({ type, tool }) => type === "step.succeeded" && tool === "plan_lot").resultRef.id;
  assert.equal(backend.drafts.get(jobId).status, "DRAFT");
  assert.deepEqual(backend.drafts.get(jobId).baseline.levers, LEVERS);
  assert.deepEqual(Object.fromEntries(Object.keys(CONDITIONS).map((field) => [field, backend.drafts.get(jobId).conditions[field]])), CONDITIONS);

  const run = await arc.taskRunStore.get(plan[0].taskRunId);
  assert.equal(run.status, "WAITING_FOR_USER");
  assert.deepEqual(run.steps.map(({ tool, status, waitingFor }) => [tool, status, waitingFor]), [
    ["confirm_conditions", "SUCCEEDED", null], ["plan_lot", "SUCCEEDED", null], ["approve", "WAITING_FOR_USER", "approve"],
  ]);
  const turn = await arc.sessionStore.getTurn(arc.principal.sessionId, planTurn);
  assert.deepEqual(turn.summary.tools, ["confirm_conditions", "plan_lot"]);
  assert.equal(turn.summary.attempts, 0);

  const session = await (await arc.request("/api/arc/session", { method: "GET" })).json();
  assert.deepEqual(session.session.activeLots, [{ lotId: order.lotId, stage: "draft_review", currentJobId: jobId, currentRevision: 1 }]);
  assert.deepEqual(session.session.jobIds, [jobId]);
  assert.equal(backend.requests.submit.length, 1);
});

test("conditions are stored as confirmed by the operator, and moisture kept at the example value as the example", async () => {
  const { backend, arc } = setup();
  const { reviewId } = await readPo1(arc);
  const { lotId } = await confirmLine(arc, reviewId);
  await events(await arc.post(action("confirm_conditions", conditionsFor(lotId))));
  const lot = (await backend.lotStore.getLot({ lotId, ownerSessionId: arc.principal.sessionId })).head;
  assert.deepEqual(lot.draftConditions.map(({ field, value, sourceDetail, label }) => [field, value, sourceDetail, label]), [
    ["runDate", CONDITIONS.runDate, "confirmed", "Confirmed by operator"],
    ["shift", "DAY", "confirmed", "Confirmed by operator"],
    ["ambientRhPct", 62, "confirmed", "Confirmed by operator"],
    ["ambientTempC", 24.5, "confirmed", "Confirmed by operator"],
    ["paperMoisturePct", 7.3, "example", "Example value"],
  ]);
  const { revision } = await backend.lotStore.getLot({ lotId, ownerSessionId: arc.principal.sessionId });
  assert.deepEqual(revision.conditions.map(({ field, sourceDetail, label, provenance }) => [field, sourceDetail, label, provenance]), [
    ["runDate", "confirmed", "Confirmed by operator", "operator_entry"],
    ["shift", "confirmed", "Confirmed by operator", "operator_entry"],
    ["ambientRhPct", "confirmed", "Confirmed by operator", "operator_entry"],
    ["ambientTempC", "confirmed", "Confirmed by operator", "operator_entry"],
    ["paperMoisturePct", "example", "Example value", "synthetic_example"],
  ], "the planned revision keeps the example label on moisture");
});

test("a moisture value other than the example cannot carry the example label", async () => {
  const { backend, arc } = setup();
  const { reviewId } = await readPo1(arc);
  const { lotId } = await confirmLine(arc, reviewId);
  const frames = await events(await arc.post(action("confirm_conditions", conditionsFor(lotId, { paperMoisturePct: 8.1 }))));
  assert.deepEqual(shape(frames).slice(-1), ["step.failed:confirm_conditions"]);
  assert.equal(frames.at(-1).errorCode, "VALIDATION_ERROR");
  assert.equal(backend.requests.submit.length, 0, "nothing was planned");
});

async function nothingOpened(arc, lotHeads) {
  const session = await arc.sessionStore.get(arc.principal.sessionId);
  assert.deepEqual([session.activeLotIds, session.jobIds, lotHeads()], [[], [], []]);
}

test("confirm_order refuses a line that is not in the stored review, and writes nothing", async () => {
  const { arc, lotHeads } = setup();
  const { reviewId } = await readPo1(arc);
  for (const lineIndex of [1, 99]) {
    const frames = await events(await arc.post(action("confirm_order", { reviewId, lineIndex })));
    assert.deepEqual(shape(frames).slice(-2), ["step.started:confirm_order", "step.blocked:confirm_order"]);
    assert.equal(frames.at(-1).errorCode, "ORDER_LINE_NOT_CONFIRMABLE");
  }
  await nothingOpened(arc, lotHeads);
});

test("confirm_order refuses a line the catalog did not match, and writes nothing", async () => {
  const { arc, lotHeads } = setup({ extraction: { ...PO1_EXTRACTION, lines: [{ itemCode: "PKBX9999", quantity: 1300, sourcePage: 1 }] } });
  const { reviewId } = await readPo1(arc);
  const frames = await events(await arc.post(action("confirm_order", { reviewId, lineIndex: 0 })));
  assert.equal(frames.at(-1).errorCode, "ORDER_LINE_NOT_CONFIRMABLE");
  await nothingOpened(arc, lotHeads);
});

test("confirm_order with another session's review answers as an expired review, and writes nothing", async () => {
  const owner = setup();
  const { reviewId } = await readPo1(owner.arc);
  const other = setup({ backend: owner.backend });
  assert.notEqual(other.arc.principal.sessionId, owner.arc.principal.sessionId);
  const frames = await events(await other.arc.post(action("confirm_order", { reviewId, lineIndex: 0 })));
  assert.equal(frames.at(-1).errorCode, "ORDER_REVIEW_EXPIRED");
  await nothingOpened(other.arc, other.lotHeads);
  assert.deepEqual(owner.lotHeads(), []);
});

test("confirm_order refuses a review of a file that is not an approved sample, before any lot is written", async () => {
  const { backend, arc, lotHeads } = setup();
  const otherFile = new File([PO1_BYTES, new Uint8Array([10])], "other-order.pdf", { type: "application/pdf" });
  const review = await backend.reviews.extractForReview({ file: otherFile, ownerSessionId: arc.principal.sessionId });
  assert.equal(review.ok, true, JSON.stringify(review.error));
  const frames = await events(await arc.post(action("confirm_order", { reviewId: review.reviewId, lineIndex: 0 })));
  assert.equal(frames.at(-1).type, "step.blocked");
  assert.equal(frames.at(-1).errorCode, "ORDER_SAMPLE_REQUIRED");
  await nothingOpened(arc, lotHeads);
});

test("confirm_order with an expired review fails closed, and writes nothing", async () => {
  let reviewTime = Date.now();
  const { arc, lotHeads } = setup({ reviewNow: () => reviewTime });
  const { reviewId } = await readPo1(arc);
  reviewTime += 30 * 60 * 1000 + 1;
  const frames = await events(await arc.post(action("confirm_order", { reviewId, lineIndex: 0 })));
  assert.equal(frames.at(-1).type, "step.blocked");
  assert.equal(frames.at(-1).errorCode, "ORDER_REVIEW_EXPIRED");
  await nothingOpened(arc, lotHeads);
});

test("confirm_order takes the item, quantity and order ID from the stored review, never from the client", async () => {
  const { arc, lotHeads } = setup();
  const { reviewId } = await readPo1(arc);
  for (const extra of [{ itemCode: "PKBX0099" }, { quantity: 5 }, { orderId: "PO-FORGED" }, { reviewFingerprint: "0".repeat(64) }, { lotId: "x" }]) {
    const clientTurnId = randomUUID();
    const response = await arc.post(action("confirm_order", { reviewId, lineIndex: 0, ...extra }), { clientTurnId });
    assert.equal(response.status, 400, JSON.stringify(extra));
    assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
    assert.equal(await arc.sessionStore.getTurn(arc.principal.sessionId, clientTurnId), null, "no turn is claimed");
  }
  await nothingOpened(arc, lotHeads);
});

test("confirm_conditions plans only with the confirmed order rebuilt on the server", async () => {
  const { backend, arc } = setup();
  const { reviewId } = await readPo1(arc);
  const { lotId } = await confirmLine(arc, reviewId);
  for (const extra of [{ itemCode: "PKBX0099" }, { quantity: 5 }, { reviewId }, { lineIndex: 0 }, { file: "x" }, { lotId: "LOT-1" }]) {
    const response = await arc.post(action("confirm_conditions", conditionsFor(lotId, extra)));
    assert.equal(response.status, 400, JSON.stringify(extra));
  }
  const { lotId: _omitted, ...withoutLot } = conditionsFor(lotId);
  assert.equal((await arc.post(action("confirm_conditions", withoutLot))).status, 400, "the lot is required");
  await events(await arc.post(action("confirm_conditions", conditionsFor(lotId))));
  const [request] = backend.requests.optimize;
  assert.equal(request.item_code, PO1.itemCode);
  assert.equal(request.quantity.value, PO1.quantity);
  assert.equal(request.paper_supplier, PO1.context.paperSupplier);
});

test("confirm_conditions without a confirmed order in the session plans nothing", async () => {
  const { backend, arc } = setup();
  const frames = await events(await arc.post(action("confirm_conditions", conditionsFor(`LOT-HACK-${arc.principal.sessionId}-${"0".repeat(12)}`))));
  assert.deepEqual(shape(frames), ["run.failed"]);
  assert.equal(frames[0].errorCode, "LOT_NOT_FOUND");
  assert.equal(backend.requests.submit.length, 0);
});

test("with two lots in the session, Confirm conditions plans the lot on the card, not the newest", async () => {
  const { backend, arc } = setup({ extraction: { ...PO1_EXTRACTION, lines: [
    { itemCode: PO1.itemCode, quantity: 1300, sourcePage: 1 },
    { itemCode: PO1.itemCode, quantity: 500, sourcePage: 1 },
  ] } });
  const { reviewId } = await readPo1(arc);
  const lotA = (await confirmLine(arc, reviewId)).lotId;
  const lotB = (await events(await arc.post(action("confirm_order", { reviewId, lineIndex: 1 }))))
    .find(({ type }) => type === "step.succeeded").resultRef.id;
  assert.notEqual(lotA, lotB);
  const session = await arc.sessionStore.get(arc.principal.sessionId);
  assert.deepEqual(session.activeLotIds, [lotA, lotB], "lot B is the newest");

  const plan = await events(await arc.post(action("confirm_conditions", conditionsFor(lotA))));
  const jobId = plan.find(({ type, tool }) => type === "step.succeeded" && tool === "plan_lot").resultRef.id;
  assert.equal((await arc.taskRunStore.get(plan[0].taskRunId)).lotId, lotA);
  assert.equal(backend.drafts.get(jobId).order.quantity, 1300);
  const read = (lotId) => backend.lotStore.getLot({ lotId, ownerSessionId: arc.principal.sessionId });
  assert.deepEqual([(await read(lotA)).head.currentJobId, (await read(lotA)).head.draftConditions.length], [jobId, 5]);
  assert.deepEqual([(await read(lotB)).head.stage, (await read(lotB)).head.draftConditions], ["conditions", []]);
});

test("the lot read behind GET /lots/:lotId names the confirmed item and quantity, not the order ID", async () => {
  const { backend, arc } = setup();
  const { reviewId } = await readPo1(arc);
  const { lotId } = await confirmLine(arc, reviewId);
  const read = await getLot({ lotId }, { principal: arc.principal, lotRevisions: backend.commandDeps.lotRevisions });
  assert.deepEqual(read.lot.order, { itemCode: PO1.itemCode, quantity: PO1.quantity });
  assert.ok(!JSON.stringify(read).includes(PO1.context.orderId));
});

test("Confirm conditions for this session's lot that has left its five active lots plans nothing", async () => {
  const { backend, arc } = setup();
  const { reviewId } = await readPo1(arc);
  const lots = [];
  for (let n = 0; n < 6; n += 1) lots.push((await confirmLine(arc, reviewId)).lotId);
  const session = await arc.sessionStore.get(arc.principal.sessionId);
  assert.deepEqual(session.activeLotIds, lots.slice(1), "the oldest lot was dropped");
  assert.ok(await backend.lotStore.getLot({ lotId: lots[0], ownerSessionId: arc.principal.sessionId }), "it still exists and is owned");
  const frames = await events(await arc.post(action("confirm_conditions", conditionsFor(lots[0]))));
  assert.deepEqual(shape(frames), ["run.failed"]);
  assert.equal(frames[0].errorCode, "LOT_NOT_FOUND");
  assert.equal(backend.requests.submit.length, 0);
});

test("Confirm conditions for a lot this session does not hold plans nothing", async () => {
  const owner = setup();
  const { reviewId } = await readPo1(owner.arc);
  const { lotId } = await confirmLine(owner.arc, reviewId);
  const other = setup({ backend: owner.backend });
  const { reviewId: ownReview } = await readPo1(other.arc);
  await confirmLine(other.arc, ownReview);
  const frames = await events(await other.arc.post(action("confirm_conditions", conditionsFor(lotId))));
  assert.deepEqual(shape(frames), ["run.failed"]);
  assert.equal(frames[0].errorCode, "LOT_NOT_FOUND");
  assert.equal(owner.backend.requests.submit.length, 0);
  assert.deepEqual((await owner.backend.lotStore.getLot({ lotId, ownerSessionId: owner.arc.principal.sessionId })).head.draftConditions, []);
});

test("a repeated clientTurnId for confirm_conditions replays and does not plan twice", async () => {
  const { backend, arc } = setup();
  const { reviewId } = await readPo1(arc);
  const { lotId } = await confirmLine(arc, reviewId);
  const clientTurnId = randomUUID();
  const first = await events(await arc.post(action("confirm_conditions", conditionsFor(lotId)), { clientTurnId }));
  const again = await events(await arc.post(action("confirm_conditions", conditionsFor(lotId)), { clientTurnId }), "replayed");
  assert.deepEqual(again, first);
  assert.equal(backend.requests.submit.length, 1);
  assert.equal(backend.requests.predict.length, 1);
  assert.equal(backend.drafts.size, 1);
  const session = await arc.sessionStore.get(arc.principal.sessionId);
  assert.deepEqual([session.activeLotIds, session.jobIds.length], [[lotId], 1]);
});

test("a plan interrupted after the draft was stored resumes with the same key and plans once", { timeout: 5000 }, async () => {
  const abort = new AbortController();
  const { backend, arc } = setup({
    wrap: (deps) => ({ ...deps, submitJob: async (input) => {
      const result = await deps.submitJob(input);
      abort.abort();
      return result;
    } }),
  });
  const { reviewId } = await readPo1(arc);
  const { lotId } = await confirmLine(arc, reviewId);
  const clientTurnId = randomUUID();
  const input = action("confirm_conditions", conditionsFor(lotId));
  const interrupted = await events(await arc.post(input, { clientTurnId, signal: abort.signal }));
  const runId = interrupted.find(({ type }) => type === "run.started").taskRunId;
  const before = await arc.taskRunStore.get(runId);
  assert.deepEqual(before.steps.map(({ status }) => status), ["SUCCEEDED", "RUNNING", "PENDING"]);
  assert.equal(backend.drafts.size, 1, "the first request stored the draft before it stopped");

  arc.clock(131_000);
  const resumed = await events(await arc.post(input, { clientTurnId, runner: arc.create() }));
  assert.deepEqual(shape(resumed).slice(-2), ["step.waiting_for_user:approve:approve", "answer"]);
  const after = await arc.taskRunStore.get(runId);
  assert.equal(after.steps[1].idempotencyKey, before.steps[1].idempotencyKey);
  assert.equal(backend.requests.submit.length, 2, "the resumed step asks again with the same key");
  assert.equal(new Set(backend.requests.submit.map(({ jobId }) => jobId)).size, 1);
  assert.equal(backend.requests.predict.length, 1, "the plan itself ran once");
  assert.equal(backend.drafts.size, 1);
  const session = await arc.sessionStore.get(arc.principal.sessionId);
  assert.deepEqual([session.activeLotIds, session.jobIds], [[lotId], [...backend.drafts.keys()]]);
});

test("Confirm conditions interrupted after the conditions were saved resumes to one plan and one job", { timeout: 5000 }, async () => {
  const abort = new AbortController();
  let interruptAfter = null;
  let saves = 0;
  const { backend, arc } = setup({
    wrap: (deps) => ({ ...deps, lotRevisions: { ...deps.lotRevisions, store: { ...deps.lotRevisions.store,
      saveConditions: async (request) => {
        const saved = await deps.lotRevisions.store.saveConditions(request);
        saves += 1;
        if (saves === interruptAfter) abort.abort();
        return saved;
      } } } }),
  });
  const { reviewId } = await readPo1(arc);
  const { lotId } = await confirmLine(arc, reviewId);
  interruptAfter = saves + 1;
  const clientTurnId = randomUUID();
  const input = action("confirm_conditions", conditionsFor(lotId));
  const interrupted = await events(await arc.post(input, { clientTurnId, signal: abort.signal }));
  const runId = interrupted.find(({ type }) => type === "run.started").taskRunId;
  const before = await arc.taskRunStore.get(runId);
  assert.deepEqual(before.steps.map(({ status }) => status), ["RUNNING", "PENDING", "PENDING"]);
  assert.equal(backend.requests.submit.length, 0, "nothing was planned before the stop");

  arc.clock(131_000);
  const resumed = await events(await arc.post(input, { clientTurnId, runner: arc.create() }));
  assert.deepEqual(shape(resumed).slice(-2), ["step.waiting_for_user:approve:approve", "answer"]);
  assert.equal(backend.drafts.size, 1);
  assert.equal(backend.requests.predict.length, 1);
  const head = (await backend.lotStore.getLot({ lotId, ownerSessionId: arc.principal.sessionId })).head;
  assert.equal(head.draftConditions.length, 5);
  const session = await arc.sessionStore.get(arc.principal.sessionId);
  assert.deepEqual([session.activeLotIds, session.jobIds.length], [[lotId], 1]);
});

test("confirm_order replayed or resumed opens one lot per turn", { timeout: 5000 }, async () => {
  const abort = new AbortController();
  let interrupt = false;
  const { arc, lotHeads } = setup({
    wrap: (deps) => ({ ...deps, lotRevisions: { ...deps.lotRevisions, store: { ...deps.lotRevisions.store,
      saveConditions: async (request) => {
        const saved = await deps.lotRevisions.store.saveConditions(request);
        if (interrupt) abort.abort();
        return saved;
      } } } }),
  });
  const { reviewId } = await readPo1(arc);
  const replayTurn = randomUUID();
  const { lotId } = await confirmLine(arc, reviewId, replayTurn);
  await events(await arc.post(action("confirm_order", { reviewId, lineIndex: 0 }), { clientTurnId: replayTurn }), "replayed");
  assert.equal(lotHeads().length, 1);

  interrupt = true;
  const clientTurnId = randomUUID();
  const input = action("confirm_order", { reviewId, lineIndex: 0 });
  const interrupted = await events(await arc.post(input, { clientTurnId, signal: abort.signal }));
  interrupt = false;
  const run = await arc.taskRunStore.get(interrupted.find(({ type }) => type === "run.started").taskRunId);
  assert.equal(run.steps[0].status, "RUNNING");
  assert.equal(lotHeads().length, 2, "the interrupted turn had written its lot");
  arc.clock(131_000);
  const resumed = await events(await arc.post(input, { clientTurnId, runner: arc.create() }));
  const resumedLot = resumed.find(({ type, tool }) => type === "step.succeeded" && tool === "confirm_order").resultRef.id;
  assert.equal(lotHeads().length, 2, "the resumed turn reopened its own lot, not a third");
  const session = await arc.sessionStore.get(arc.principal.sessionId);
  assert.deepEqual(session.activeLotIds, [lotId, resumedLot]);
});

test("a repeated read_sample_order turn replays and reads the order once", async () => {
  const { backend, arc } = setup();
  const clientTurnId = randomUUID();
  const first = await readPo1(arc, clientTurnId);
  await events(await arc.post(action("read_sample_order", { sampleId: "PO1" }), { clientTurnId }), "replayed");
  assert.equal(backend.requests.vertex.length, 1);
  assert.match(first.reviewId, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("an order read interrupted after the review was stored resumes from the stored review without reading again", { timeout: 5000 }, async () => {
  const abort = new AbortController();
  const { backend, arc } = setup({
    wrapServices: (ports) => ({ ...ports, extractOrderForReview: async (request) => {
      const result = await ports.extractOrderForReview(request);
      abort.abort();
      return result;
    } }),
  });
  const clientTurnId = randomUUID();
  const input = action("read_sample_order", { sampleId: "PO1" });
  const interrupted = await events(await arc.post(input, { clientTurnId, signal: abort.signal }));
  const before = await arc.taskRunStore.get(interrupted.find(({ type }) => type === "run.started").taskRunId);
  assert.equal(before.steps[0].status, "RUNNING");
  assert.equal(backend.requests.vertex.length, 1);
  arc.clock(131_000);
  const resumed = await events(await arc.post(input, { clientTurnId, runner: arc.create() }));
  const reviewId = resumed.find(({ type }) => type === "step.succeeded").resultRef.id;
  assert.equal(backend.requests.vertex.length, 1, "no second extraction");
  const stored = await backend.reviews.loadReview({ reviewId, ownerSessionId: arc.principal.sessionId });
  assert.equal(stored.review.reviewId, reviewId);
});

test("typed text and suggestions never reach confirm_order or confirm_conditions", async () => {
  const routed = [];
  const { arc, lotHeads, backend } = setup({
    router: async (request) => {
      routed.push(request);
      return { calls: [{ name: "confirm_order", args: { reviewId: randomUUID(), lineIndex: 0 } }] };
    },
    config: { ...arcConfig, suggestions: { "Confirm the order": "confirm_order", "Confirm conditions": "confirm_conditions" } },
  });
  const { reviewId } = await readPo1(arc);
  for (const message of ["Confirm the order", "Confirm conditions", `confirm line 0 of review ${reviewId}`]) {
    const frames = await events(await arc.post(text(message)));
    assert.deepEqual(shape(frames), ["run.failed"], message);
    assert.equal(frames[0].errorCode, "VALIDATION_ERROR");
  }
  assert.equal(routed.length, 3, "suggestion text that names a param action goes to the router like any message");
  for (const { allowedFunctionNames, declarations } of routed) {
    const declared = declarations.flatMap(({ functionDeclarations }) => functionDeclarations.map(({ name }) => name));
    for (const name of ["confirm_order", "confirm_conditions"]) {
      assert.ok(!allowedFunctionNames.includes(name));
      assert.ok(!declared.includes(name));
    }
  }
  await nothingOpened(arc, lotHeads);
  assert.equal(backend.requests.submit.length, 0);
});
