import assert from "node:assert/strict";
import test from "node:test";
import { readGeminiBudgetConfig } from "../src/gemini-budget-config.js";
import { budgetCapStore, createFirestoreBudgetStore } from "../src/google-cloud/firestore-budget-store.js";
import { parseDocument } from "../src/google-cloud/firestore-rest.js";
import { BudgetCounterDocSchema } from "../src/state-schemas.js";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";

const IP_A = "0123456789abcdef";
const IP_B = "fedcba9876543210";
// 09:30 IST on 3 Dec, 04:00 UTC.
const NINE_THIRTY_IST = Date.parse("2026-12-03T04:00:00Z");
const LIMITS = {
  pool: "live", dayLimit: 300, sessionDayLimit: 40, ipDayLimit: 120, minuteLimit: 20, sessionMinuteLimit: 6,
  demoSessionMint: { perIpPerHour: 3 }, pitchClaim: { attemptsPerIpPerHour: 2 },
};

function setup({ limits = LIMITS, fake = fakeFirestore() } = {}) {
  const clock = { now: NINE_THIRTY_IST };
  const config = readGeminiBudgetConfig({
    USTAAD_GEMINI_BUDGET_POLICY: "budget-v2", GEMINI_BUDGET_LIMITS: JSON.stringify(limits),
  });
  assert.equal(config.configured, true);
  const store = createFirestoreBudgetStore({
    projectId: "prepagent-hack", fetchImpl: fake.fetchImpl, tokenProvider: async () => "test-token",
    limits: config.limits, now: () => clock.now,
  });
  return { store, fake, clock };
}

function counter(fake, id) {
  const doc = fake.docs.get(`projects/prepagent-hack/databases/(default)/documents/budget_counters/${id}`);
  return doc ? parseDocument(BudgetCounterDocSchema, doc) : undefined;
}

test("session issuance is limited per address per IST hour", async () => {
  const { store, fake, clock } = setup();
  for (let i = 0; i < 3; i += 1) assert.equal((await store.admitSession({ ipKey: IP_A })).ok, true);
  const refused = await store.admitSession({ ipKey: IP_A });
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "DEMO_SESSION_RATE_LIMITED");
  // 09:30 IST is 30 minutes into the 09:00 IST hour.
  assert.equal(refused.retryAfterSeconds, 1800);
  assert.equal(counter(fake, `live_mint_ip_hour_${IP_A}_2026120309`).units, 3);
  assert.equal((await store.admitSession({ ipKey: IP_B })).ok, true);
  clock.now += 1800_000;
  assert.equal((await store.admitSession({ ipKey: IP_A })).ok, true);
});

test("session issuance falls back to 30 an hour when the limits name none", async () => {
  const { demoSessionMint: _mint, ...limits } = LIMITS;
  const { store } = setup({ limits });
  for (let i = 0; i < 30; i += 1) assert.equal((await store.admitSession({ ipKey: IP_A })).ok, true);
  assert.equal((await store.admitSession({ ipKey: IP_A })).code, "DEMO_SESSION_RATE_LIMITED");
});

test("pitch claim attempts are counted before the compare and limited per address", async () => {
  const { store, fake } = setup();
  assert.equal((await store.admitPitchClaim({ ipKey: IP_A })).ok, true);
  assert.equal((await store.admitPitchClaim({ ipKey: IP_A })).ok, true);
  const refused = await store.admitPitchClaim({ ipKey: IP_A });
  assert.equal(refused.code, "PITCH_CLAIM_RATE_LIMITED");
  assert.equal(counter(fake, `live_claim_ip_hour_${IP_A}_2026120309`).units, 2);
  assert.equal(counter(fake, `live_mint_ip_hour_${IP_A}_2026120309`), undefined);
});

test("issuance fails closed when Firestore is unavailable and refuses a bad address key", async () => {
  const { store } = setup({ fake: fakeFirestore({ failReads: true }) });
  assert.deepEqual(await store.admitSession({ ipKey: IP_A }), { ok: false, code: "BUDGET_UNAVAILABLE" });
  await assert.rejects(store.admitSession({ ipKey: "203.0.113.9" }), TypeError);
  await assert.rejects(store.admitSession({ ipKey: null }), TypeError);
});

test("twenty sessions minted at once from one address are cut off at the hourly limit", async () => {
  const { store, fake } = setup({ limits: { ...LIMITS, demoSessionMint: { perIpPerHour: 5 } }, fake: fakeFirestore({ commitBarrier: 2 }) });
  const results = await Promise.all(Array.from({ length: 20 }, () => store.admitSession({ ipKey: IP_A })));
  const admitted = results.filter((result) => result.ok).length;
  assert.ok(admitted >= 1 && admitted <= 5);
  // A call that lost every retry is refused as unavailable, never admitted.
  assert.equal(results.length - admitted, results.filter((result) => result.code === "DEMO_SESSION_RATE_LIMITED" || result.code === "BUDGET_UNAVAILABLE").length);
  assert.equal(counter(fake, `live_mint_ip_hour_${IP_A}_2026120309`).units, admitted);
});

test("the cap adapter passes the admission checks through", async () => {
  const { store } = setup();
  const adapter = budgetCapStore(store);
  assert.equal((await adapter.admitSession({ ipKey: IP_A })).ok, true);
  assert.equal((await adapter.admitPitchClaim({ ipKey: IP_A })).ok, true);
});
