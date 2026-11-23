import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { readDailyGeminiCallCapConfig, withDailyGeminiCallCap } from "../src/daily-gemini-call-cap.js";
import { attemptCostMicroInr, readGeminiBudgetConfig } from "../src/gemini-budget-config.js";
import { budgetCapStore, createFirestoreBudgetStore } from "../src/google-cloud/firestore-budget-store.js";
import { parseDocument } from "../src/google-cloud/firestore-rest.js";
import { BudgetCounterDocSchema } from "../src/state-schemas.js";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";

const NOON_IST = Date.parse("2026-11-30T06:30:00Z");
const USAGE = { promptTokenCount: 20000, candidatesTokenCount: 2000, totalTokenCount: 22000 };
const CALL_COST = attemptCostMicroInr("explanation", USAGE);
const CALLS_TO_CAP = 3;
const MINUTE_LIMIT = 8;

function setup({ holdProviderMs = 0 } = {}) {
  const fake = fakeFirestore();
  const config = readGeminiBudgetConfig({
    USTAAD_GEMINI_BUDGET_POLICY: "budget-v2",
    GEMINI_BUDGET_LIMITS: JSON.stringify({
      pool: "live", dayLimit: 300, sessionDayLimit: 300, ipDayLimit: 300, minuteLimit: MINUTE_LIMIT, sessionMinuteLimit: 300,
      dayCostCapInr: (CALL_COST * CALLS_TO_CAP) / 1e6,
    }),
  });
  assert.equal(config.configured, true);
  const store = createFirestoreBudgetStore({
    projectId: "prepagent-hack", fetchImpl: fake.fetchImpl, tokenProvider: async () => "test-token", limits: config.limits, now: () => NOON_IST,
  });
  let providerCalls = 0;
  const client = {
    generateContent: async ({ onUsage }) => { providerCalls += 1; await sleep(holdProviderMs); onUsage(USAGE); return "content"; },
    generateJson: async () => ({}),
  };
  const gemini = withDailyGeminiCallCap(client, readDailyGeminiCallCapConfig({}), { store: budgetCapStore(store, { log: () => {} }), now: () => NOON_IST });
  const call = () => gemini.generateContent({ role: "explanation", contents: [] });
  const spent = () => {
    const doc = fake.docs.get("projects/prepagent-hack/databases/(default)/documents/budget_counters/live_cost_day_all_20261130");
    return doc ? parseDocument(BudgetCounterDocSchema, doc).units : 0;
  };
  return { call, spent, providerCalls: () => providerCalls };
}

test("a sequential burst ends at most one call over the rupee cap", async () => {
  const { call, spent } = setup();
  const outcomes = [];
  for (let i = 0; i < 6; i += 1) outcomes.push(await call().then(() => "ok", (error) => error.budgetCode));
  assert.deepEqual(outcomes, ["ok", "ok", "ok", "BUDGET_COST_EXHAUSTED", "BUDGET_COST_EXHAUSTED", "BUDGET_COST_EXHAUSTED"]);
  assert.ok(spent() - CALL_COST * CALLS_TO_CAP < CALL_COST);
});

test("calls already in flight pass the rupee cap, by no more than the per-minute limit allows", async () => {
  const { call, spent, providerCalls } = setup({ holdProviderMs: 400 });
  // Staggered so the reservations do not abort each other; each response is still pending when the next call starts.
  const pending = [];
  for (let i = 0; i < 12; i += 1) {
    pending.push(call().then(() => ({ status: "fulfilled" }), (error) => ({ status: "rejected", code: error.budgetCode })));
    await sleep(10);
  }
  const results = await Promise.all(pending);
  const admitted = results.filter((result) => result.status === "fulfilled").length;
  const overshootCalls = (spent() - CALL_COST * CALLS_TO_CAP) / CALL_COST;
  // Measured with the fake: every call that reserved before the first response was recorded went through.
  assert.equal(providerCalls(), admitted);
  assert.equal(spent(), admitted * CALL_COST);
  assert.ok(admitted > CALLS_TO_CAP, `expected in-flight calls to pass the cap, admitted ${admitted}`);
  assert.ok(admitted <= MINUTE_LIMIT, `the minute limit bounds in-flight calls, admitted ${admitted}`);
  assert.equal(overshootCalls, admitted - CALLS_TO_CAP);
  // Once the responses are recorded the cap holds again.
  await assert.rejects(call(), { budgetCode: "BUDGET_COST_EXHAUSTED" });
});
