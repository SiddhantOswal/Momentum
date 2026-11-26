import assert from "node:assert/strict";
import test from "node:test";
import modelAcceptanceConfig from "../config/model-acceptance.json" with { type: "json" };
import { BUDGET_VIEW_TTL_MS, createBudgetViewCache, getStatus, getStatusWithBudget, publicStatus } from "../src/commands/status.js";
import { createHackathonDemoAuthenticator } from "../src/hackathon-demo-auth.js";
import { createConfiguredServicePorts } from "../src/service-ports.js";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";
const AUDIENCE = "https://momentum.example";

const LIMITS = {
  pool: "live",
  dayLimit: 300, sessionDayLimit: 40, ipDayLimit: 120, minuteLimit: 20, sessionMinuteLimit: 6,
  reserve: { units: 80, windowStart: "2026-12-04T00:00:00+08:00", windowEnd: "2026-12-04T23:59:59+08:00",
    grant: "pitch_reserve", sessionDayLimit: 120 },
};
const BASE_ENV = { PROJECT_ID: "prepagent-hack", BUCKET: "prepagent-hack-data", USTAAD_ENABLE_LIVE_MODEL_CALLS: "true" };

function deps(env, fake = fakeFirestore()) {
  const servicePorts = createConfiguredServicePorts({
    env,
    modelConfig: { modelCallsEnabled: true, testModel: "gemini-3.5-flash", location: "asia-south1" },
    fetchImpl: fake.fetchImpl,
    tokenProvider: async () => "test-token",
  });
  return {
    env, servicePorts, executionMode: "live-service",
    hackathonAuth: { enabled: true, configured: true },
    supervisorAuthenticator: { enabled: false, configured: false },
    approvalAuthorizationConfigured: false, jobSheetPersistenceAvailable: false, jobCreationAvailable: false,
    modelAcceptanceConfig,
  };
}

const BUDGET_ENV = { ...BASE_ENV, USTAAD_GEMINI_BUDGET_POLICY: "budget-v2", GEMINI_BUDGET_LIMITS: JSON.stringify(LIMITS) };
const BUDGET_WORDS = /limit|cap|reserve|spend|cost|remaining|counter|pool|minute/i;

function demoPrincipal() {
  const auth = createHackathonDemoAuthenticator({ mode: "HACKATHON_DEMO", signingKey: "c".repeat(64), syntheticOnly: true, auditEnabled: true });
  return auth.authenticate(auth.issue(AUDIENCE), AUDIENCE).principal;
}

const reads = (fake) => fake.calls.filter((call) => call.method === "GET").length;

test("with the flag off, a session sees the status command unchanged", async () => {
  const context = deps(BASE_ENV);
  assert.deepEqual(await getStatusWithBudget({}, { ...context, sessionVerified: true }), getStatus({}, context));
  assert.equal(getStatus({}, context).runtimeAvailability.geminiBudget, undefined);
});

test("without a verified session the status says only that the service runs, its mode and the model scores", async () => {
  const fake = fakeFirestore();
  const context = deps(BUDGET_ENV, fake);
  for (const caller of [{}, { sessionVerified: false }, { principal: { sessionId: "a".repeat(32), grants: [] } }]) {
    const status = await getStatusWithBudget({}, { ...context, ...caller });
    assert.deepEqual(Object.keys(status).sort(),
      ["app", "authorizationMode", "backendReachable", "executionMode", "mode", "modelAcceptance", "ok", "status"]);
    assert.deepEqual(status.modelAcceptance, getStatus({}, context).modelAcceptance);
    assert.ok(status.modelAcceptance.models.every((model) => typeof model.r2 === "number"));
    const { modelAcceptance: _scores, ...rest } = status;
    assert.doesNotMatch(JSON.stringify(rest), BUDGET_WORDS);
  }
  assert.equal(reads(fake), 0);
  assert.deepEqual(publicStatus(getStatus({}, context)), await getStatusWithBudget({}, context));
});

test("with budget-v2, a session sees only the calls it can still make today", async () => {
  const fake = fakeFirestore();
  const context = deps(BUDGET_ENV, fake);
  const status = await getStatusWithBudget({}, { ...context, principal: demoPrincipal(), sessionVerified: true });
  const budget = status.runtimeAvailability.geminiBudget;
  // Day 300 less the reserve of 80 leaves 220; the session's own limit of 40 is smaller.
  assert.deepEqual(budget, { policy: "budget-v2", configured: true, status: "configured", available: true, callsLeftToday: 40 });
  assert.equal(status.runtimeAvailability.dailyGeminiCallCap.policy, "budget-v2");
  assert.equal("limit" in status.runtimeAvailability.dailyGeminiCallCap, false);
  assert.doesNotMatch(JSON.stringify(status.runtimeAvailability), /dayLimit|CostCap|costInr|reserveUnits|remaining|"limits"/);
  assert.ok(reads(fake) > 0);
  assert.equal(fake.calls.some((call) => call.path.endsWith(":commit")), false);
});

test("the calls left are the smallest applicable count, and none once the day's spend cap is used", async () => {
  const withView = (view) => ({
    ...deps(BASE_ENV),
    servicePorts: { ...deps(BASE_ENV).servicePorts, geminiUsage: { policy: "budget-v2", sharedCounterConfigured: true, budgetStatus: "configured", peek: async () => view } },
  });
  const ask = async (view) => (await getStatusWithBudget({}, { ...withView(view), principal: demoPrincipal(), sessionVerified: true }))
    .runtimeAvailability.geminiBudget.callsLeftToday;
  assert.equal(await ask({ ok: true, day: 3, session: 12, ip: 1, minute: 0, sessionMinute: 0, costInr: 5 }), 3);
  assert.equal(await ask({ ok: true, day: 30, session: 12, ip: null, minute: 20, sessionMinute: 6, costInr: 5 }), 12);
  assert.equal(await ask({ ok: true, day: 30, session: 12, ip: null, minute: 20, sessionMinute: 6, costInr: 0 }), 0);
});

test("two status calls from one session inside the cache window cause one budget read", async () => {
  let currentTime = 0;
  let peeks = 0;
  const context = deps(BASE_ENV);
  const usage = { policy: "budget-v2", sharedCounterConfigured: true, budgetStatus: "configured",
    peek: async () => { peeks += 1; return { ok: true, day: 100 - peeks, session: 40, ip: null, minute: 20, sessionMinute: 6, costInr: 600 }; } };
  const cache = createBudgetViewCache({ now: () => currentTime });
  const caller = (principal) => ({ ...context, servicePorts: { ...context.servicePorts, geminiUsage: usage },
    principal, sessionVerified: true, budgetViewCache: cache });
  const left = async (principal) => (await getStatusWithBudget({}, caller(principal))).runtimeAvailability.geminiBudget.callsLeftToday;

  const first = demoPrincipal();
  assert.equal(await left(first), 40);
  currentTime = BUDGET_VIEW_TTL_MS - 1;
  await Promise.all([left(first), left(first)]);
  assert.equal(peeks, 1);
  await left(demoPrincipal());
  assert.equal(peeks, 2);
  currentTime = BUDGET_VIEW_TTL_MS;
  await left(first);
  assert.equal(peeks, 3);
  assert.equal(BUDGET_VIEW_TTL_MS, 5_000);
});

test("the budget cache window holds against the Firestore store too", async () => {
  const fake = fakeFirestore();
  const context = { ...deps(BUDGET_ENV, fake), principal: demoPrincipal(), sessionVerified: true, budgetViewCache: createBudgetViewCache() };
  await getStatusWithBudget({}, context);
  const afterOne = reads(fake);
  await getStatusWithBudget({}, context);
  await getStatusWithBudget({}, context);
  assert.equal(reads(fake), afterOne);
});

test("status reports an invalid budget config or an unreadable store without numbers", async () => {
  const session = { principal: demoPrincipal(), sessionVerified: true };
  const invalid = deps({ ...BASE_ENV, USTAAD_GEMINI_BUDGET_POLICY: "budget-v2", GEMINI_BUDGET_LIMITS: "{" });
  const blocked = (await getStatusWithBudget({}, { ...invalid, ...session })).runtimeAvailability;
  assert.deepEqual(blocked.geminiBudget, { policy: "budget-v2", configured: false, status: "invalid", available: false });
  assert.equal(blocked.liveModelCallsEnabled, false);

  const down = deps(BUDGET_ENV, fakeFirestore({ failReads: true }));
  const unreadable = (await getStatusWithBudget({}, { ...down, ...session })).runtimeAvailability.geminiBudget;
  assert.deepEqual(unreadable, { policy: "budget-v2", configured: true, status: "configured", available: false });
});

test("a deployment that issues no sessions keeps its configuration status, with no budget read or day limit", async () => {
  const fake = fakeFirestore();
  const context = { ...deps(BUDGET_ENV, fake), hackathonAuth: { enabled: false, configured: false } };
  const status = await getStatusWithBudget({}, context);
  assert.equal(status.runtimeAvailability.geminiBudget.available, false);
  assert.equal("callsLeftToday" in status.runtimeAvailability.geminiBudget, false);
  assert.equal("limit" in status.runtimeAvailability.dailyGeminiCallCap, false);
  assert.equal(reads(fake), 0);
});
