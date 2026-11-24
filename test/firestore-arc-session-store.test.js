import assert from "node:assert/strict";
import test from "node:test";
import { createFirestoreArcSessionStore } from "../src/google-cloud/firestore-arc-session-store.js";
import { FirestoreRestError } from "../src/google-cloud/firestore-rest.js";
import { createFakeFirestore, FAKE_PROJECT_ID } from "./fixtures/fake-firestore.js";

const SID = "a".repeat(32);
const OTHER_SID = "b".repeat(32);
const NOW = Date.parse("2026-11-24T09:00:00.000Z");
const SESSION_EXPIRES = "2026-11-24T11:00:00.000Z";
const HASH = "c".repeat(64);
const TURN_A = "6f1c2a44-8b0e-4d51-9c7a-3e5d1b7f0a21";
const TURN_B = "7a2d3b55-9c1f-4e62-8d8b-4f6e2c8a1b32";
const TURN_C = "8b3e4c66-ad20-4f73-9e9c-5a7f3d9b2c43";

const jobId = (n) => `JOB-HACK-${SID}-${String(n).padStart(40, "0")}`;

function storeOver(fake, clock = { now: NOW }, options = {}) {
  return createFirestoreArcSessionStore({
    projectId: FAKE_PROJECT_ID,
    fetchImpl: fake.fetchImpl,
    tokenProvider: async () => "fake-access-token",
    now: () => clock.now,
    ...options,
  });
}

const textInput = (text) => ({ kind: "text", text });

function claimRequest(overrides = {}) {
  return { sessionId: SID, clientTurnId: TURN_A, input: textInput("What is the R2 of the crack model?"), inputFingerprint: HASH, ...overrides };
}

async function startedSession(fake, clock) {
  const store = storeOver(fake, clock);
  await store.getOrCreate({ sessionId: SID, sessionExpiresAt: SESSION_EXPIRES });
  return store;
}

test("getOrCreate makes the session once and returns the same record afterwards", async () => {
  const fake = createFakeFirestore();
  const store = storeOver(fake);
  const created = await store.getOrCreate({ sessionId: SID, sessionExpiresAt: SESSION_EXPIRES });
  assert.equal(created.sessionId, SID);
  assert.equal(created.identityLabel, "Demo session, simulated");
  assert.deepEqual(created.jobIds, []);
  assert.equal(created.turnCount, 0);
  const stored = fake.documents.get(`arc_sessions/${SID}`).fields;
  assert.equal(stored.expiresAt.timestampValue, "2026-12-01T11:00:00.000Z");
  assert.equal(stored.sessionExpiresAt.timestampValue, SESSION_EXPIRES);
  const again = await storeOver(fake).getOrCreate({ sessionId: SID, sessionExpiresAt: SESSION_EXPIRES });
  assert.deepEqual(again, created);
  assert.equal(fake.calls.filter((call) => call.method === "POST").length, 1);
});

test("sessions are keyed by the session ID, so another session's ID reads as absent", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  assert.equal(await store.get(OTHER_SID), null);
  await assert.rejects(store.get("not-a-session"), TypeError);
});

test("recordJob keeps at most 20 job IDs, newest last, and drops the oldest", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  for (let n = 1; n <= 22; n += 1) await store.recordJob({ sessionId: SID, jobId: jobId(n) });
  const session = await store.get(SID);
  assert.equal(session.jobIds.length, 20);
  assert.deepEqual(session.jobIds, Array.from({ length: 20 }, (_, i) => jobId(i + 3)));
  assert.equal(session.jobIds.at(-1), jobId(22));
});

test("recordJob moves a reopened job to the end and does not duplicate it", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  for (const n of [1, 2, 3]) await store.recordJob({ sessionId: SID, jobId: jobId(n) });
  await store.recordJob({ sessionId: SID, jobId: jobId(1) });
  assert.deepEqual((await store.get(SID)).jobIds, [jobId(2), jobId(3), jobId(1)]);
});

test("recordJob refuses a job ID from another session", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  await assert.rejects(store.recordJob({ sessionId: SID, jobId: `JOB-HACK-${OTHER_SID}-${"0".repeat(40)}` }), TypeError);
  assert.deepEqual((await store.get(SID)).jobIds, []);
});

test("two instances recording jobs at once both land, because a lost race re-reads", async () => {
  const fake = createFakeFirestore();
  const one = await startedSession(fake);
  const two = storeOver(fake);
  await Promise.all([one.recordJob({ sessionId: SID, jobId: jobId(1) }), two.recordJob({ sessionId: SID, jobId: jobId(2) })]);
  assert.deepEqual([...(await one.get(SID)).jobIds].sort(), [jobId(1), jobId(2)]);
});

test("claimTurn creates an in-progress record with a 130 s lease and counts the turn", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  const claim = await store.claimTurn(claimRequest());
  assert.equal(claim.outcome, "claimed");
  assert.equal(claim.turn.recordStatus, "in_progress");
  assert.equal(claim.turn.leaseExpiresAt, "2026-11-24T09:02:10.000Z");
  assert.equal(claim.turn.errorCode, null);
  assert.equal(fake.documents.get(`arc_sessions/${SID}/turns/${TURN_A}`).fields.expiresAt.timestampValue, "2026-12-01T09:00:00.000Z");
  const session = await store.get(SID);
  assert.equal(session.turnCount, 1);
  assert.deepEqual(session.recentTurnIds, [TURN_A]);
});

test("recentTurnIds keeps the last four turns, oldest first", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  const ids = Array.from({ length: 6 }, (_, i) => `6f1c2a44-8b0e-4d51-9c7a-3e5d1b7f0a${String(i).padStart(2, "0")}`);
  for (const clientTurnId of ids) await store.claimTurn(claimRequest({ clientTurnId }));
  const session = await store.get(SID);
  assert.deepEqual(session.recentTurnIds, ids.slice(2));
  assert.equal(session.turnCount, 6);
});

test("a second claim with the same input while the lease is live is in_progress and counts nothing", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  await store.claimTurn(claimRequest());
  const second = await store.claimTurn(claimRequest());
  assert.equal(second.outcome, "in_progress");
  assert.equal((await store.get(SID)).turnCount, 1);
});

test("the same turn ID with different input is a conflict, in progress or complete", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  const first = await store.claimTurn(claimRequest());
  const different = claimRequest({ inputFingerprint: "d".repeat(64), input: textInput("A different question") });
  assert.equal((await store.claimTurn(different)).outcome, "conflict");
  await store.completeTurn({ sessionId: SID, clientTurnId: TURN_A, ownerToken: first.turn.ownerToken, taskRunId: null, answerText: "Done.", summary: null, eventRange: null });
  assert.equal((await store.claimTurn(different)).outcome, "conflict");
});

test("a completed turn replays its stored record and writes nothing", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  const first = await store.claimTurn(claimRequest());
  await store.completeTurn({ sessionId: SID, clientTurnId: TURN_A, ownerToken: first.turn.ownerToken, taskRunId: null, answerText: "The crack model scores an R2 of 0.640.", summary: null, eventRange: null });
  const before = JSON.stringify([...fake.documents.entries()]);
  const callsBefore = fake.calls.length;
  const replay = await storeOver(fake).claimTurn(claimRequest());
  assert.equal(replay.outcome, "replay");
  assert.equal(replay.turn.answerText, "The crack model scores an R2 of 0.640.");
  assert.deepEqual(fake.calls.slice(callsBefore).map((call) => call.method), ["GET"]);
  assert.equal(JSON.stringify([...fake.documents.entries()]), before);
});

test("a failed turn replays with its error code", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  const first = await store.claimTurn(claimRequest());
  await store.failTurn({ sessionId: SID, clientTurnId: TURN_A, ownerToken: first.turn.ownerToken, errorCode: "BUDGET_DAY_EXHAUSTED" });
  const replay = await store.claimTurn(claimRequest());
  assert.equal(replay.outcome, "replay");
  assert.equal(replay.turn.recordStatus, "failed");
  assert.equal(replay.turn.errorCode, "BUDGET_DAY_EXHAUSTED");
});

test("an expired lease lets a retry take over, and the old owner can no longer finish the turn", async () => {
  const fake = createFakeFirestore();
  const clock = { now: NOW };
  const store = await startedSession(fake, clock);
  const first = await store.claimTurn(claimRequest());
  clock.now += 131_000;
  const takeover = await store.claimTurn(claimRequest());
  assert.equal(takeover.outcome, "takeover");
  assert.notEqual(takeover.turn.ownerToken, first.turn.ownerToken);
  const stale = await store.completeTurn({ sessionId: SID, clientTurnId: TURN_A, ownerToken: first.turn.ownerToken, taskRunId: null, answerText: "Late.", summary: null, eventRange: null });
  assert.deepEqual(stale, { ok: false, code: "TURN_NOT_OWNED" });
  const done = await store.completeTurn({ sessionId: SID, clientTurnId: TURN_A, ownerToken: takeover.turn.ownerToken, taskRunId: null, answerText: "On time.", summary: null, eventRange: null });
  assert.equal(done.ok, true);
  assert.equal((await store.getTurn(SID, TURN_A)).answerText, "On time.");
  assert.equal((await store.get(SID)).turnCount, 1);
});

test("two instances racing to take over an expired turn: exactly one wins", async () => {
  const fake = createFakeFirestore();
  const clock = { now: NOW };
  const one = await startedSession(fake, clock);
  const two = storeOver(fake, clock);
  await one.claimTurn(claimRequest());
  clock.now += 131_000;
  const outcomes = (await Promise.all([one.claimTurn(claimRequest()), two.claimTurn(claimRequest())])).map(({ outcome }) => outcome).sort();
  assert.deepEqual(outcomes, ["in_progress", "takeover"]);
});

test("completeTurn rejects an answer or summary that carries order text, and stores nothing", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  const first = await store.claimTurn(claimRequest());
  const forbiddenText = ["Zephyr Kartonagen GmbH", "Hafenstrasse 12"];
  const base = { sessionId: SID, clientTurnId: TURN_A, ownerToken: first.turn.ownerToken, taskRunId: null, eventRange: null, forbiddenText };
  const summary = { intent: "data_question", tools: ["get_metrics"], resultRefs: [], attempts: 1, writerOutcome: "shown", fallbackReason: null, versions: { prompt: "router-v1" } };

  await assert.rejects(store.completeTurn({ ...base, answerText: "Your buyer zephyr kartonagen gmbh ordered 500 boxes.", summary: null }), { code: "ORDER_TEXT_IN_TRANSCRIPT" });
  await assert.rejects(store.completeTurn({ ...base, answerText: "Done.", summary: { ...summary, intent: "ship to Hafenstrasse 12" } }), { code: "ORDER_TEXT_IN_TRANSCRIPT" });
  await assert.rejects(store.completeTurn({ ...base, answerText: "Done.", summary: { ...summary, versions: { note: "Zephyr Kartonagen GmbH" } } }), { code: "ORDER_TEXT_IN_TRANSCRIPT" });

  const everything = JSON.stringify([...fake.documents.values()]);
  assert.equal(everything.includes("Zephyr"), false);
  assert.equal(everything.includes("Hafenstrasse"), false);
  assert.equal((await store.getTurn(SID, TURN_A)).recordStatus, "in_progress");

  const accepted = await store.completeTurn({ ...base, answerText: "The order has 500 boxes.", summary });
  assert.equal(accepted.ok, true);
});

test("a stored action turn keeps a params hash and no params", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  await store.claimTurn(claimRequest({ input: { kind: "action", actionId: "open_last_card", paramsHash: HASH } }));
  assert.equal(JSON.stringify(fake.documents.get(`arc_sessions/${SID}/turns/${TURN_A}`)).includes(HASH), true);
  const withParams = { kind: "action", actionId: "open_last_card", paramsHash: HASH, params: { buyer: "Zephyr" } };
  await assert.rejects(store.claimTurn(claimRequest({ clientTurnId: TURN_B, input: withParams })), FirestoreRestError);
  assert.equal(JSON.stringify([...fake.documents.values()]).includes("Zephyr"), false);
});

test("listTurns pages newest first with an opaque cursor", async () => {
  const fake = createFakeFirestore();
  const clock = { now: NOW };
  const store = await startedSession(fake, clock);
  for (const id of [TURN_A, TURN_B, TURN_C]) {
    await store.claimTurn(claimRequest({ clientTurnId: id }));
    clock.now += 1000;
  }
  const first = await store.listTurns({ sessionId: SID, limit: 2 });
  assert.deepEqual(first.turns.map((turn) => turn.clientTurnId), [TURN_C, TURN_B]);
  assert.equal(typeof first.nextBefore, "string");
  const second = await store.listTurns({ sessionId: SID, limit: 2, before: first.nextBefore });
  assert.deepEqual(second.turns.map((turn) => turn.clientTurnId), [TURN_A]);
  assert.equal(second.nextBefore, null);
});

test("listTurns orders turns created in the same millisecond by turn ID, newest first", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  for (const id of [TURN_A, TURN_B, TURN_C]) await store.claimTurn(claimRequest({ clientTurnId: id }));
  const first = await store.listTurns({ sessionId: SID, limit: 2 });
  const second = await store.listTurns({ sessionId: SID, limit: 2, before: first.nextBefore });
  assert.deepEqual([...first.turns, ...second.turns].map((turn) => turn.clientTurnId), [TURN_C, TURN_B, TURN_A]);
});

test("listTurns uses one Firestore query and reads at most one extra document per page", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  for (const id of [TURN_A, TURN_B, TURN_C]) await store.claimTurn(claimRequest({ clientTurnId: id }));

  for (const limit of [1, 2, 20]) {
    const callsBefore = fake.calls.length;
    await store.listTurns({ sessionId: SID, limit });
    const calls = fake.calls.slice(callsBefore);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, `arc_sessions/${SID}:runQuery`);
    const queryLimit = calls[0].body.structuredQuery.limit;
    assert.ok(Number.isInteger(queryLimit) && queryLimit <= limit + 1, `limit ${limit}, query limit ${queryLimit}`);
  }
});

test("listTurns returns a cursor only when a 20-turn page has another turn after it", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  const ids = Array.from({ length: 21 }, (_, index) =>
    `6f1c2a44-8b0e-4d51-9c7a-${String(index + 1).padStart(12, "0")}`);
  for (const id of ids.slice(0, 20)) await store.claimTurn(claimRequest({ clientTurnId: id }));

  const fullLastPage = await store.listTurns({ sessionId: SID, limit: 20 });
  assert.deepEqual(fullLastPage.turns.map((turn) => turn.clientTurnId), ids.slice(0, 20).reverse());
  assert.equal(fullLastPage.nextBefore, null);

  await store.claimTurn(claimRequest({ clientTurnId: ids[20] }));
  const first = await store.listTurns({ sessionId: SID, limit: 20 });
  assert.deepEqual(first.turns.map((turn) => turn.clientTurnId), ids.slice(1).reverse());
  assert.ok(first.nextBefore);
  const last = await store.listTurns({ sessionId: SID, limit: 20, before: first.nextBefore });
  assert.deepEqual(last.turns.map((turn) => turn.clientTurnId), [ids[0]]);
  assert.equal(last.nextBefore, null);
});

test("listTurns never returns another session's turns and rejects a forged cursor", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  await store.getOrCreate({ sessionId: OTHER_SID, sessionExpiresAt: SESSION_EXPIRES });
  await store.claimTurn(claimRequest({ sessionId: OTHER_SID }));
  assert.deepEqual((await store.listTurns({ sessionId: SID, limit: 10 })).turns, []);
  assert.equal(await store.getTurn(SID, TURN_A), null);
  assert.deepEqual(await store.listTurns({ sessionId: SID, limit: 10, before: "not-a-cursor" }), { ok: false, code: "INVALID_CURSOR" });
});

test("a turn past its expiry reads as absent even before TTL deletes it", async () => {
  const fake = createFakeFirestore();
  const clock = { now: NOW };
  const store = await startedSession(fake, clock);
  await store.claimTurn(claimRequest());
  clock.now += 8 * 24 * 60 * 60 * 1000;
  assert.equal(await store.getTurn(SID, TURN_A), null);
  assert.deepEqual((await store.listTurns({ sessionId: SID, limit: 10 })).turns, []);
});

test("Firestore faults and schema-invalid documents fail closed as SERVICE_UNAVAILABLE", async () => {
  const down = createFakeFirestore({ failWhen: () => true });
  await assert.rejects(storeOver(down).get(SID), { code: "SERVICE_UNAVAILABLE" });
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  fake.documents.get(`arc_sessions/${SID}`).fields.jobIds = { arrayValue: { values: [{ stringValue: "JOB-HACK-other" }] } };
  await assert.rejects(store.get(SID), { code: "SERVICE_UNAVAILABLE" });
});

test("a failed session update removes the new turn record so a retry is not stuck in progress", async () => {
  const fake = createFakeFirestore({ failWhen: ({ method, path }) => method === "PATCH" && path === `arc_sessions/${SID}` });
  const store = await startedSession(fake);
  await assert.rejects(store.claimTurn(claimRequest()), { code: "SERVICE_UNAVAILABLE" });
  assert.equal(fake.documents.has(`arc_sessions/${SID}/turns/${TURN_A}`), false);
});

test("claimTurn with createIfAbsent false writes nothing for an unknown turn", async () => {
  const fake = createFakeFirestore();
  const store = await startedSession(fake);
  const before = JSON.stringify([...fake.documents.entries()]);
  assert.deepEqual(await store.claimTurn(claimRequest({ createIfAbsent: false })), { outcome: "absent" });
  assert.equal(JSON.stringify([...fake.documents.entries()]), before);
});
