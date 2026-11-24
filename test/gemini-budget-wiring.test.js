import assert from "node:assert/strict";
import test from "node:test";
import {
  geminiUsageFailure,
  readDailyGeminiCallCapConfig,
  withDailyGeminiCallCap,
} from "../src/daily-gemini-call-cap.js";
import { attemptCostMicroInr, readGeminiBudgetConfig } from "../src/gemini-budget-config.js";
import { budgetCapStore, createFirestoreBudgetStore } from "../src/google-cloud/firestore-budget-store.js";
import { parseDocument } from "../src/google-cloud/firestore-rest.js";
import { configureGeminiUsage, createConfiguredServicePorts } from "../src/service-ports.js";
import { BudgetCounterDocSchema, BudgetReservationDocSchema } from "../src/state-schemas.js";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";

const LIVE_LIMITS = {
  pool: "live",
  dayLimit: 300, sessionDayLimit: 40, ipDayLimit: 120, minuteLimit: 20, sessionMinuteLimit: 6,
  reserve: { units: 80, windowStart: "2026-12-04T00:00:00+08:00", windowEnd: "2026-12-04T23:59:59+08:00",
    grant: "pitch_reserve", sessionDayLimit: 120 },
};
const BUDGET_ENV = { USTAAD_GEMINI_BUDGET_POLICY: "budget-v2", GEMINI_BUDGET_LIMITS: JSON.stringify(LIVE_LIMITS) };
const START = Date.parse("2026-11-30T04:00:00Z");
const COUNTERS = "projects/prepagent-hack/databases/(default)/documents/budget_counters/";

function setup({ env = BUDGET_ENV, provider } = {}) {
  const fake = fakeFirestore();
  const clock = { now: START };
  const providerCalls = [];
  const client = {
    generateContent: async (args) => { providerCalls.push(args); return provider ? provider(args) : "content"; },
    generateJson: async (args) => { providerCalls.push(args); return provider ? provider(args) : "json"; },
  };
  const usage = configureGeminiUsage({
    env, projectId: "prepagent-hack", fetchImpl: fake.fetchImpl, tokenProvider: async () => "test-token",
    geminiDailyCap: readDailyGeminiCallCapConfig(env), now: () => clock.now,
  });
  const gemini = withDailyGeminiCallCap(client, readDailyGeminiCallCapConfig(env), { store: usage.store, now: () => clock.now });
  return { fake, clock, usage, gemini, providerCalls };
}

const counterUnits = (fake, id) => {
  const doc = fake.docs.get(`${COUNTERS}${id}`);
  return doc ? parseDocument(BudgetCounterDocSchema, doc).units : 0;
};

test("with the flag off the shared gemini_daily_usage cap is used as today", async () => {
  const env = { USTAAD_ENABLE_FIRESTORE_GEMINI_CAP: "true", USTAAD_GEMINI_COUNTER_DATABASE: "(default)", GEMINI_DAILY_ATTEMPT_CAP: "2" };
  const { fake, usage, gemini, providerCalls } = setup({ env });
  assert.equal(usage.policy, undefined);
  assert.equal(usage.sharedCounterConfigured, true);
  await gemini.generateContent({ role: "explanation", contents: [] });
  await gemini.generateJson({ role: "extraction" });
  await assert.rejects(gemini.generateJson({ role: "extraction" }), { code: "GEMINI_DAILY_CAP_EXCEEDED" });
  assert.equal(providerCalls.length, 2);
  assert.ok(fake.calls.some((call) => call.path.includes("/gemini_daily_usage/")));
  assert.equal(fake.calls.some((call) => call.path.includes("/budget_")), false);
});

test("with the flag off and no shared counter the in-process cap still applies", async () => {
  const { usage, gemini } = setup({ env: { GEMINI_DAILY_ATTEMPT_CAP: "1" } });
  assert.equal(usage.store, undefined);
  await gemini.generateJson({});
  await assert.rejects(gemini.generateJson({}), { code: "GEMINI_DAILY_CAP_EXCEEDED" });
});

test("budget-v2 charges budget_counters only and never gemini_daily_usage (F1)", async () => {
  const env = { ...BUDGET_ENV, USTAAD_ENABLE_FIRESTORE_GEMINI_CAP: "true", USTAAD_GEMINI_COUNTER_DATABASE: "(default)" };
  const { fake, usage, gemini, providerCalls } = setup({ env });
  assert.equal(usage.policy, "budget-v2");
  assert.equal(usage.sharedCounterConfigured, true);
  await gemini.generateContent({ role: "explanation", contents: [] });
  assert.equal(providerCalls.length, 1);
  assert.equal(fake.calls.some((call) => call.path.includes("gemini_daily_usage")), false);
  assert.equal(counterUnits(fake, "live_day_all_20261130"), 1);
  const [reservation] = [...fake.docs.entries()].filter(([name]) => name.includes("/budget_reservations/"));
  assert.equal(parseDocument(BudgetReservationDocSchema, reservation[1]).purpose, "explanation");
});

test("budget context stays private and a replayed key calls and charges once", async () => {
  const { fake, gemini, providerCalls } = setup();
  const budget = { reservationKey: "arc1.turn.0", purpose: "arc_router" };
  await gemini.generateContent({ role: "router", contents: [], budget });
  await assert.rejects(gemini.generateContent({ role: "router", contents: [], budget }), {
    code: "GEMINI_CALL_REPLAYED",
  });
  assert.equal(providerCalls.length, 1);
  assert.equal(providerCalls.some((args) => "budget" in args), false);
  assert.equal(counterUnits(fake, "live_day_all_20261130"), 1);
});

test("each response's usageMetadata is priced and added to the day's rupee spend", async () => {
  const usageReport = { promptTokenCount: 4000, candidatesTokenCount: 500, thoughtsTokenCount: 1500, totalTokenCount: 6000 };
  const { fake, gemini } = setup({ provider: (args) => { args.onUsage(usageReport); return "ok"; } });
  const seen = [];
  await gemini.generateContent({ role: "explanation", contents: [], onUsage: (reported) => seen.push(reported) });
  assert.deepEqual(seen, [usageReport]);
  assert.equal(counterUnits(fake, "live_cost_day_all_20261130"), attemptCostMicroInr("explanation", usageReport));
});

test("a failed provider call that reported usage is still charged", async () => {
  const { fake, gemini } = setup({ provider: (args) => {
    args.onUsage({ promptTokenCount: 1000, candidatesTokenCount: 2048 });
    throw Object.assign(new Error("cut off"), { code: "VERTEX_OUTPUT_TRUNCATED" });
  } });
  await assert.rejects(gemini.generateJson({ role: "extraction" }), { code: "VERTEX_OUTPUT_TRUNCATED" });
  assert.ok(counterUnits(fake, "live_cost_day_all_20261130") > 0);
});

test("a burst of maximum-length responses stops at the 600 rupee cap before the 300 attempt limit", async () => {
  // The explanation role's 8,192 output tokens, and about 16,000 prompt tokens: the 64 KiB request limit at 4 bytes a token.
  const maximum = { promptTokenCount: 16384, thoughtsTokenCount: 4096, candidatesTokenCount: 4096, totalTokenCount: 24576 };
  const perCall = attemptCostMicroInr("explanation", maximum);
  const { fake, clock, gemini, providerCalls } = setup({ provider: (args) => { args.onUsage(maximum); return "ok"; } });
  let refusal;
  for (let attempt = 0; attempt < LIVE_LIMITS.dayLimit; attempt += 1) {
    try {
      await gemini.generateContent({ role: "explanation", contents: [] });
    } catch (error) {
      refusal = error;
      break;
    }
    clock.now += 60_000;
  }
  assert.equal(refusal?.budgetCode, "BUDGET_COST_EXHAUSTED");
  assert.ok(providerCalls.length < LIVE_LIMITS.dayLimit - LIVE_LIMITS.reserve.units);
  assert.equal(providerCalls.length, Math.ceil(600_000_000 / perCall));
  const spent = counterUnits(fake, "live_cost_day_all_20261130");
  assert.ok(spent >= 600_000_000 && spent < 600_000_000 + perCall);
  assert.equal(counterUnits(fake, "live_day_all_20261130"), providerCalls.length);
});

test("budget refusals keep the 429 cap shape and add the specific code", async () => {
  const env = { ...BUDGET_ENV, GEMINI_BUDGET_LIMITS: JSON.stringify({ ...LIVE_LIMITS, minuteLimit: 1 }) };
  const { gemini, providerCalls } = setup({ env });
  await gemini.generateJson({ role: "extraction" });
  const error = await gemini.generateJson({ role: "extraction" }).catch((caught) => caught);
  assert.equal(providerCalls.length, 1);
  assert.equal(error.code, "GEMINI_DAILY_CAP_EXCEEDED");
  assert.equal(error.budgetCode, "BUDGET_RATE_LIMITED");
  assert.deepEqual(geminiUsageFailure(error), {
    ok: false,
    error: {
      code: "GEMINI_DAILY_CAP_EXCEEDED", budgetCode: "BUDGET_RATE_LIMITED", retryAfterSeconds: 60,
      message: "Too many Gemini requests this minute. Try again in a minute.",
    },
  });
});

test("an unavailable budget store or an unknown purpose makes no provider call", async () => {
  const fake = fakeFirestore({ failReads: true });
  const limits = readGeminiBudgetConfig(BUDGET_ENV).limits;
  const store = budgetCapStore(createFirestoreBudgetStore({ projectId: "prepagent-hack", fetchImpl: fake.fetchImpl,
    tokenProvider: async () => "test-token", limits, now: () => START }));
  let calls = 0;
  const gemini = withDailyGeminiCallCap({ generateContent: async () => { calls += 1; }, generateJson: async () => { calls += 1; } },
    readDailyGeminiCallCapConfig({}), { store, now: () => START });
  const down = await gemini.generateJson({ role: "extraction" }).catch((caught) => caught);
  assert.equal(down.code, "GEMINI_USAGE_UNAVAILABLE");
  assert.equal(geminiUsageFailure(down).error.code, "SERVICE_UNAVAILABLE");
  const working = setup();
  await assert.rejects(working.gemini.generateContent({ role: "agent", contents: [] }), { code: "GEMINI_USAGE_UNAVAILABLE" });
  assert.equal(calls + working.providerCalls.length, 0);
});

test("on Cloud Run an invalid or missing budget config blocks Gemini, and a valid one allows it", () => {
  let requests = 0;
  const base = { K_SERVICE: "momentum", PROJECT_ID: "prepagent-hack", BUCKET: "prepagent-hack-data", USTAAD_ENABLE_LIVE_MODEL_CALLS: "true" };
  const create = (env) => createConfiguredServicePorts({ env,
    modelConfig: { modelCallsEnabled: true, testModel: "gemini-3.5-flash", location: "asia-south1" },
    fetchImpl: async () => { requests += 1; throw new Error("No network is expected during construction"); },
  });
  const sharedCounter = { USTAAD_ENABLE_FIRESTORE_GEMINI_CAP: "true", USTAAD_GEMINI_COUNTER_DATABASE: "(default)" };
  assert.equal(create({ ...base, ...sharedCounter, USTAAD_GEMINI_BUDGET_POLICY: "budget-v2", GEMINI_BUDGET_LIMITS: "{" }).availability.extractOrder, false);
  assert.equal(create({ ...base, ...sharedCounter, USTAAD_GEMINI_BUDGET_POLICY: "budget-v2" }).availability.extractOrder, false);
  assert.equal(create({ ...base, ...sharedCounter, USTAAD_GEMINI_BUDGET_POLICY: "on", GEMINI_BUDGET_LIMITS: BUDGET_ENV.GEMINI_BUDGET_LIMITS }).availability.extractOrder, false);
  const ready = create({ ...base, ...BUDGET_ENV });
  assert.equal(ready.availability.extractOrder, true);
  assert.equal(ready.geminiUsage.policy, "budget-v2");
  assert.equal(ready.geminiUsage.sharedCounterConfigured, true);
  assert.equal(typeof ready.geminiUsage.peek, "function");
  assert.equal(requests, 0);
});
