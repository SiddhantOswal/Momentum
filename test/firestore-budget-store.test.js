import assert from "node:assert/strict";
import test from "node:test";
import { createHackathonDemoAuthenticator } from "../src/hackathon-demo-auth.js";
import { readGeminiBudgetConfig } from "../src/gemini-budget-config.js";
import { createFirestoreBudgetStore } from "../src/google-cloud/firestore-budget-store.js";
import { hasPitchReserveClaim } from "../src/pitch-claim.js";
import { BudgetCounterDocSchema, BudgetReservationDocSchema } from "../src/state-schemas.js";
import { parseDocument } from "../src/google-cloud/firestore-rest.js";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";

const IP_A = "0123456789abcdef";
const IP_B = "fedcba9876543210";
// 12:00 in Singapore and 09:30 in India on 3 Dec, a day before the pitch.
const BEFORE_PITCH = Date.parse("2026-12-03T04:00:00Z");
// 12:00 in Singapore on 4 Dec: inside the reserve window.
const PITCH_NOON = Date.parse("2026-12-04T04:00:00Z");
// 01:00 on 5 Dec in Singapore is still 22:30 on 4 Dec in India, so the same IST day counter.
const AFTER_PITCH_SAME_IST_DAY = Date.parse("2026-12-04T17:00:00Z");

const LIMITS = {
  pool: "live",
  dayLimit: 300, sessionDayLimit: 40, ipDayLimit: 120, minuteLimit: 20, sessionMinuteLimit: 6,
};

const auth = createHackathonDemoAuthenticator({
  mode: "HACKATHON_DEMO", signingKey: "a".repeat(64), syntheticOnly: true, auditEnabled: true,
  now: () => BEFORE_PITCH,
});
function session() {
  const result = auth.authenticate(auth.issue());
  assert.equal(result.ok, true);
  return result.principal;
}

function setup({ limits = LIMITS, at = BEFORE_PITCH, fake = fakeFirestore(), hasPitchClaim } = {}) {
  const clock = { now: at };
  const config = readGeminiBudgetConfig({
    USTAAD_GEMINI_BUDGET_POLICY: "budget-v2", GEMINI_BUDGET_LIMITS: JSON.stringify(limits),
  });
  assert.equal(config.configured, true);
  const store = createFirestoreBudgetStore({
    projectId: "prepagent-hack", fetchImpl: fake.fetchImpl, tokenProvider: async () => "test-token",
    limits: config.limits, now: () => clock.now, ...(hasPitchClaim ? { hasPitchClaim } : {}),
  });
  let keys = 0;
  const reserve = (principal, extra = {}) => store.reserve({
    principal, ipKey: IP_A, purpose: "order_extraction", reservationKey: `key-${++keys}`, ...extra,
  });
  return { store, fake, clock, reserve };
}

function counter(fake, id) {
  const doc = fake.docs.get(`projects/prepagent-hack/databases/(default)/documents/budget_counters/${id}`);
  return doc ? parseDocument(BudgetCounterDocSchema, doc) : undefined;
}

test("the day limit returns BUDGET_DAY_EXHAUSTED and spares no session", async () => {
  const { reserve } = setup({ limits: { ...LIMITS, dayLimit: 3 } });
  for (let i = 0; i < 3; i += 1) assert.equal((await reserve(session())).ok, true);
  const refused = await reserve(session());
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "BUDGET_DAY_EXHAUSTED");
  assert.equal(refused.remaining.day, 0);
});

test("the session day limit returns BUDGET_SESSION_EXHAUSTED for that session only", async () => {
  const { reserve, fake } = setup({ limits: { ...LIMITS, sessionDayLimit: 2 } });
  const judge = session();
  assert.equal((await reserve(judge)).remaining.session, 1);
  assert.equal((await reserve(judge)).remaining.session, 0);
  assert.equal((await reserve(judge)).code, "BUDGET_SESSION_EXHAUSTED");
  assert.equal((await reserve(session())).ok, true);
  assert.equal(counter(fake, `live_session_day_${judge.sessionId}_20261203`).units, 2);
});

test("the IP day limit returns BUDGET_IP_EXHAUSTED however many sessions one address mints", async () => {
  const { reserve } = setup({ limits: { ...LIMITS, ipDayLimit: 2 } });
  assert.equal((await reserve(session())).ok, true);
  assert.equal((await reserve(session())).ok, true);
  assert.equal((await reserve(session())).code, "BUDGET_IP_EXHAUSTED");
  assert.equal((await reserve(session(), { ipKey: IP_B })).ok, true);
});

test("the minute limit returns BUDGET_RATE_LIMITED with the seconds to the next minute", async () => {
  const { reserve, clock } = setup({ limits: { ...LIMITS, minuteLimit: 2 }, at: BEFORE_PITCH + 45_000 });
  assert.equal((await reserve(session())).ok, true);
  assert.equal((await reserve(session())).ok, true);
  const refused = await reserve(session());
  assert.equal(refused.code, "BUDGET_RATE_LIMITED");
  assert.equal(refused.retryAfterSeconds, 15);
  clock.now += 15_000;
  assert.equal((await reserve(session())).ok, true);
});

test("the session minute limit returns BUDGET_SESSION_RATE_LIMITED and leaves other sessions alone", async () => {
  const { reserve, clock } = setup({ limits: { ...LIMITS, sessionMinuteLimit: 1 } });
  const judge = session();
  assert.equal((await reserve(judge)).ok, true);
  const refused = await reserve(judge);
  assert.equal(refused.code, "BUDGET_SESSION_RATE_LIMITED");
  assert.equal(refused.retryAfterSeconds, 60);
  assert.equal((await reserve(session())).ok, true);
  clock.now += 60_000;
  assert.equal((await reserve(judge)).ok, true);
});

test("the rupee cap returns BUDGET_COST_EXHAUSTED once recorded spend reaches it", async () => {
  const { reserve, store, fake } = setup({ limits: { ...LIMITS, dayCostCapInr: 1 } });
  const first = await reserve(session());
  assert.equal(first.remaining.costInr, 1);
  await store.recordUsage({ dayWindow: first.dayWindow, costMicroInr: 600_000 });
  assert.equal((await reserve(session())).ok, true);
  await store.recordUsage({ dayWindow: first.dayWindow, costMicroInr: 400_000 });
  const refused = await reserve(session());
  assert.equal(refused.code, "BUDGET_COST_EXHAUSTED");
  assert.equal(refused.remaining.costInr, 0);
  assert.equal(counter(fake, "live_cost_day_all_20261203").units, 1_000_000);
});

test("the pitch reserve is held back all day and only a pitch claim can spend it on 4 Dec SGT", async () => {
  const limits = { ...LIMITS, dayLimit: 10, ipDayLimit: 10, sessionDayLimit: 10, minuteLimit: 50, sessionMinuteLimit: 50,
    reserve: { units: 4, windowStart: "2026-12-04T00:00:00+08:00", windowEnd: "2026-12-04T23:59:59+08:00",
      grant: "pitch_reserve", sessionDayLimit: 5 } };
  const pitchLaptop = session();
  const before = setup({ limits, at: BEFORE_PITCH, hasPitchClaim: (principal) => principal === pitchLaptop });
  for (let i = 0; i < 6; i += 1) assert.equal((await before.reserve(session())).ok, true);
  const early = await before.reserve(pitchLaptop);
  assert.equal(early.code, "BUDGET_DAY_EXHAUSTED");
  assert.equal(early.reserveWindowActive, false);

  const fake = fakeFirestore();
  const during = setup({ limits, at: PITCH_NOON, fake, hasPitchClaim: (principal) => principal === pitchLaptop });
  for (let i = 0; i < 6; i += 1) assert.equal((await during.reserve(session())).ok, true);
  const judge = await during.reserve(session());
  assert.equal(judge.code, "BUDGET_RESERVED_FOR_PITCH");
  assert.equal(judge.reserveWindowActive, true);
  const spent = [];
  for (let i = 0; i < 4; i += 1) spent.push(await during.reserve(pitchLaptop));
  assert.deepEqual(spent.map((result) => [result.ok, result.usedPitchReserve]), [[true, true], [true, true], [true, true], [true, true]]);
  assert.equal((await during.reserve(pitchLaptop)).code, "BUDGET_DAY_EXHAUSTED");
  // The pitch laptop spends from the reserve without drawing on the shared venue address.
  assert.equal(counter(fake, `live_ip_day_${IP_A}_20261204`).units, 6);
  assert.equal(counter(fake, `live_session_day_${pitchLaptop.sessionId}_20261204`).units, 4);

  during.clock.now = AFTER_PITCH_SAME_IST_DAY;
  const late = await during.reserve(pitchLaptop);
  assert.equal(late.code, "BUDGET_DAY_EXHAUSTED");
  assert.equal(late.reserveWindowActive, false);
});

test("the pitch claim session uses the reserve session limit, not the normal one", async () => {
  const limits = { ...LIMITS, dayLimit: 100, sessionDayLimit: 2, minuteLimit: 50, sessionMinuteLimit: 50,
    reserve: { units: 10, windowStart: "2026-12-04T00:00:00+08:00", windowEnd: "2026-12-04T23:59:59+08:00",
      grant: "pitch_reserve", sessionDayLimit: 3 } };
  const pitchLaptop = session();
  const { reserve } = setup({ limits, at: PITCH_NOON, hasPitchClaim: (principal) => principal === pitchLaptop });
  for (let i = 0; i < 3; i += 1) assert.equal((await reserve(pitchLaptop)).ok, true);
  assert.equal((await reserve(pitchLaptop)).code, "BUDGET_SESSION_EXHAUSTED");
});

test("until ARC-M1-17 issues pitch claims, no session can spend the reserve", async () => {
  assert.equal(hasPitchReserveClaim(session()), false);
  assert.equal(hasPitchReserveClaim({ sessionId: "a".repeat(32), grants: ["pitch_reserve"] }), false);
  const limits = { ...LIMITS, dayLimit: 3, minuteLimit: 50, sessionMinuteLimit: 50,
    reserve: { units: 2, windowStart: "2026-12-04T00:00:00+08:00", windowEnd: "2026-12-04T23:59:59+08:00",
      grant: "pitch_reserve", sessionDayLimit: 5 } };
  const { reserve } = setup({ limits, at: PITCH_NOON });
  const laptop = session();
  assert.equal((await reserve(laptop)).ok, true);
  assert.equal((await reserve(laptop)).code, "BUDGET_RESERVED_FOR_PITCH");
});

test("replaying a reservation key charges once and reports the replay", async () => {
  const { store, fake } = setup();
  const judge = session();
  const request = { principal: judge, ipKey: IP_A, purpose: "explanation", reservationKey: "arc1.step.0" };
  const first = await store.reserve(request);
  const again = await store.reserve(request);
  assert.equal(first.ok, true);
  assert.equal(first.replayed, false);
  assert.equal(again.ok, true);
  assert.equal(again.replayed, true);
  assert.equal(again.reservationId, first.reservationId);
  assert.equal(counter(fake, "live_day_all_20261203").units, 1);
  assert.equal(counter(fake, `live_session_day_${judge.sessionId}_20261203`).units, 1);
  // The key is scoped to the session, so another session's identical key is its own attempt.
  assert.equal((await store.reserve({ ...request, principal: session() })).replayed, false);
  assert.equal(counter(fake, "live_day_all_20261203").units, 2);
  const reservations = [...fake.docs.entries()].filter(([name]) => name.includes("/budget_reservations/"));
  assert.equal(reservations.length, 2);
  for (const [, doc] of reservations) parseDocument(BudgetReservationDocSchema, doc);
});

test("two concurrent reservations for the last unit grant exactly one", async () => {
  const { reserve, fake } = setup({ limits: { ...LIMITS, dayLimit: 1 }, fake: fakeFirestore({ commitBarrier: 2 }) });
  const results = await Promise.all([reserve(session()), reserve(session())]);
  assert.deepEqual(results.map((result) => result.ok).sort(), [false, true]);
  assert.equal(results.find((result) => !result.ok).code, "BUDGET_DAY_EXHAUSTED");
  assert.equal(counter(fake, "live_day_all_20261203").units, 1);
  // Both commits raced on the same reads; the loser was aborted, read again and refused.
  assert.equal(fake.calls.filter((call) => call.path.endsWith(":commit")).length, 2);
  assert.equal(fake.calls.filter((call) => call.path.endsWith(":beginTransaction")).length, 3);
});

test("a reservation without a session is charged to the day and minute counters only", async () => {
  const { store, fake } = setup();
  const result = await store.reserve({ principal: undefined, purpose: "explanation", reservationKey: "no-session" });
  assert.equal(result.ok, true);
  assert.equal(result.remaining.session, null);
  assert.equal(result.remaining.ip, null);
  const counters = [...fake.docs.keys()].filter((name) => name.includes("/budget_counters/")).map((name) => name.split("/").pop());
  assert.deepEqual(counters.sort(), ["live_day_all_20261203", "live_minute_all_202612030930"]);
});

test("a forged principal object is not treated as a session", async () => {
  const { store } = setup({ limits: { ...LIMITS, sessionDayLimit: 1 } });
  const forged = { sessionId: "b".repeat(32) };
  assert.equal((await store.reserve({ principal: forged, purpose: "explanation", reservationKey: "f1" })).remaining.session, null);
});

test("Firestore faults and corrupt counters return BUDGET_UNAVAILABLE", async () => {
  const down = setup({ fake: fakeFirestore({ failReads: true }) });
  assert.equal((await down.reserve(session())).code, "BUDGET_UNAVAILABLE");

  const corrupt = setup();
  assert.equal((await corrupt.reserve(session())).ok, true);
  const name = "projects/prepagent-hack/databases/(default)/documents/budget_counters/live_day_all_20261203";
  const doc = corrupt.fake.docs.get(name);
  doc.fields.units = { integerValue: "-4" };
  assert.equal((await corrupt.reserve(session())).code, "BUDGET_UNAVAILABLE");

  const noToken = createFirestoreBudgetStore({ projectId: "prepagent-hack", fetchImpl: fakeFirestore().fetchImpl,
    tokenProvider: async () => "", limits: readGeminiBudgetConfig({ USTAAD_GEMINI_BUDGET_POLICY: "budget-v2",
      GEMINI_BUDGET_LIMITS: JSON.stringify(LIMITS) }).limits, now: () => BEFORE_PITCH });
  assert.equal((await noToken.reserve({ purpose: "explanation", reservationKey: "k" })).code, "BUDGET_UNAVAILABLE");
});

test("the eval pool writes only eval counters, needs a suite name and stays out of blocked windows", async () => {
  const limits = { pool: "eval", dayLimit: 900, sessionDayLimit: 900, ipDayLimit: 900, minuteLimit: 10, sessionMinuteLimit: 10,
    blockedWindows: [{ start: "2026-12-04T00:00:00+08:00", end: "2026-12-04T23:59:59+08:00" }] };
  const { store, fake, clock } = setup({ limits });
  await assert.rejects(store.reserve({ purpose: "arc_router", reservationKey: "e1" }), TypeError);
  const result = await store.reserve({ purpose: "arc_router", reservationKey: "e1", evalSuite: "off-topic" });
  assert.equal(result.ok, true);
  assert.ok([...fake.docs.keys()].filter((name) => name.includes("/budget_counters/"))
    .every((name) => name.split("/").pop().startsWith("eval_")));
  clock.now = PITCH_NOON;
  assert.equal((await store.reserve({ purpose: "arc_router", reservationKey: "e2", evalSuite: "off-topic" })).code, "BUDGET_WINDOW_BLOCKED");
});

test("peek reports what remains without writing", async () => {
  const { reserve, store, fake } = setup({ limits: { ...LIMITS, dayCostCapInr: 600 } });
  const judge = session();
  const reserved = await reserve(judge);
  await store.recordUsage({ dayWindow: reserved.dayWindow, costMicroInr: 2_500_000 });
  const commits = fake.calls.filter((call) => call.path.endsWith(":commit")).length;
  const view = await store.peek({ principal: judge, ipKey: IP_A });
  assert.equal(fake.calls.filter((call) => call.path.endsWith(":commit")).length, commits);
  assert.deepEqual(view, {
    ok: true, pool: "live", day: 299, session: 39, ip: 119, minute: 19, sessionMinute: 5, costInr: 597.5,
    reserveWindowActive: false,
    limits: { dayLimit: 300, usableDayLimit: 300, sessionDayLimit: 40, ipDayLimit: 120, minuteLimit: 20,
      sessionMinuteLimit: 6, dayCostCapInr: 600, reserveUnits: 0 },
  });
  const anonymous = await store.peek({});
  assert.equal(anonymous.session, null);
  assert.equal(anonymous.day, 299);
});

test("the budget store never touches the shared gemini_daily_usage document (F1)", async () => {
  const { reserve, store, fake } = setup();
  const reserved = await reserve(session());
  await store.recordUsage({ dayWindow: reserved.dayWindow, costMicroInr: 10 });
  await store.peek({});
  assert.ok(fake.calls.length > 0);
  assert.equal(fake.calls.some((call) => call.path.includes("gemini_daily_usage")), false);
});
