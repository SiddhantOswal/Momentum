import assert from "node:assert/strict";
import test from "node:test";
import modelAcceptanceConfig from "../config/model-acceptance.json" with { type: "json" };
import { getStatus, getStatusWithBudget } from "../src/commands/status.js";
import { createHackathonDemoAuthenticator } from "../src/hackathon-demo-auth.js";
import { createConfiguredServicePorts } from "../src/service-ports.js";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";

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

test("with the flag off, status with budget is the status command unchanged", async () => {
  const context = deps(BASE_ENV);
  assert.deepEqual(await getStatusWithBudget({}, context), getStatus({}, context));
  assert.equal(getStatus({}, context).runtimeAvailability.geminiBudget, undefined);
});

test("with budget-v2, status shows what remains for the caller's session and the day", async () => {
  const env = { ...BASE_ENV, USTAAD_GEMINI_BUDGET_POLICY: "budget-v2", GEMINI_BUDGET_LIMITS: JSON.stringify(LIMITS) };
  const fake = fakeFirestore();
  const context = deps(env, fake);
  const auth = createHackathonDemoAuthenticator({ mode: "HACKATHON_DEMO", signingKey: "c".repeat(64), syntheticOnly: true, auditEnabled: true });
  const { principal } = auth.authenticate(auth.issue());
  const status = await getStatusWithBudget({}, { ...context, principal });
  const budget = status.runtimeAvailability.geminiBudget;
  assert.equal(budget.policy, "budget-v2");
  assert.equal(budget.configured, true);
  assert.equal(budget.available, true);
  assert.equal(budget.pool, "live");
  assert.deepEqual(budget.remaining, { day: 220, session: 40, ip: null, minute: 20, sessionMinute: 6, costInr: 600 });
  assert.equal(budget.limits.reserveUnits, 80);
  assert.equal(budget.limits.dayCostCapInr, 600);
  assert.equal(typeof budget.reserveWindowActive, "boolean");
  assert.equal(status.runtimeAvailability.dailyGeminiCallCap.policy, "budget-v2");
  assert.equal(status.runtimeAvailability.dailyGeminiCallCap.limit, 300);
  assert.equal(fake.calls.some((call) => call.path.endsWith(":commit")), false);
});

test("status reports an invalid budget config or an unreadable store without numbers", async () => {
  const invalid = deps({ ...BASE_ENV, USTAAD_GEMINI_BUDGET_POLICY: "budget-v2", GEMINI_BUDGET_LIMITS: "{" });
  const blocked = (await getStatusWithBudget({}, invalid)).runtimeAvailability;
  assert.deepEqual(blocked.geminiBudget, { policy: "budget-v2", configured: false, status: "invalid", available: false });
  assert.equal(blocked.liveModelCallsEnabled, false);

  const down = deps({ ...BASE_ENV, USTAAD_GEMINI_BUDGET_POLICY: "budget-v2", GEMINI_BUDGET_LIMITS: JSON.stringify(LIMITS) },
    fakeFirestore({ failReads: true }));
  const unreadable = (await getStatusWithBudget({}, down)).runtimeAvailability.geminiBudget;
  assert.deepEqual(unreadable, { policy: "budget-v2", configured: true, status: "configured", available: false });
});
