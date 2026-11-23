import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { createHackathonDemoAuthenticator } from "../src/hackathon-demo-auth.js";
import { readGeminiBudgetConfig } from "../src/gemini-budget-config.js";
import { createFirestoreBudgetStore } from "../src/google-cloud/firestore-budget-store.js";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";
import { createPitchClaimExchange, hasPitchReserveClaim, PITCH_RESERVE_GRANT } from "../src/pitch-claim.js";

const KEY = "a".repeat(64);
const SECRET = "c0de".repeat(16);
const SESSION_MS = 7200_000;

function authenticator(clock, signingKey = KEY) {
  return createHackathonDemoAuthenticator({
    mode: "HACKATHON_DEMO", signingKey, syntheticOnly: true, auditEnabled: true, now: () => clock.now,
  });
}

const sign = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${createHmac("sha256", Buffer.from(KEY, "hex")).update(body).digest("base64url")}`;
};
const payloadOf = (token) => JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());

test("a plain session carries no pitch claim", () => {
  const auth = authenticator({ now: Date.now() });
  assert.equal(hasPitchReserveClaim(auth.authenticate(auth.issue()).principal), false);
  assert.equal(hasPitchReserveClaim(undefined), false);
});

test("granting keeps the session and its expiry, and the new cookie verifies with the claim", () => {
  const auth = authenticator({ now: Date.now() });
  const plain = auth.issue();
  const claimed = auth.grant(plain, PITCH_RESERVE_GRANT);
  const before = auth.authenticate(plain).principal;
  const after = auth.authenticate(claimed);
  assert.equal(after.ok, true);
  assert.equal(after.principal.sessionId, before.sessionId);
  assert.equal(after.principal.expiresAt, before.expiresAt);
  assert.equal(hasPitchReserveClaim(after.principal), true);
  assert.equal(after.principal.role, "hackathon-participant");
});

test("a pitch claim cannot be forged", () => {
  const clock = { now: Date.now() };
  const auth = authenticator(clock);
  const claimed = auth.grant(auth.issue(), PITCH_RESERVE_GRANT);
  const payload = payloadOf(claimed);
  const edited = Buffer.from(JSON.stringify({ ...payload, sid: "b".repeat(32) })).toString("base64url");
  assert.equal(auth.authenticate(`${edited}.${claimed.split(".")[1]}`).ok, false);
  const plain = auth.issue();
  const withGrant = Buffer.from(JSON.stringify({ ...payloadOf(plain), grants: ["pitch_reserve"] })).toString("base64url");
  assert.equal(auth.authenticate(`${withGrant}.${plain.split(".")[1]}`).ok, false);
  // Signed correctly but malformed: a v1 policy with grants, unknown or extra grants, an empty list.
  assert.equal(auth.authenticate(sign({ ...payload, policy: "HACKATHON_DEMO:v1" })).ok, false);
  assert.equal(auth.authenticate(sign({ ...payload, grants: ["pitch_reserve", "approve"] })).ok, false);
  assert.equal(auth.authenticate(sign({ ...payload, grants: ["approve"] })).ok, false);
  assert.equal(auth.authenticate(sign({ ...payload, grants: [] })).ok, false);
  assert.equal(authenticator(clock, "d".repeat(64)).authenticate(claimed).ok, false);
  assert.equal(hasPitchReserveClaim({ sessionId: "a".repeat(32), grants: ["pitch_reserve"] }), false);
});

test("a claimed cookie cannot be replayed after it expires", () => {
  const clock = { now: Date.now() };
  const auth = authenticator(clock);
  const claimed = auth.grant(auth.issue(), PITCH_RESERVE_GRANT);
  clock.now += SESSION_MS - 1000;
  assert.equal(auth.authenticate(claimed).ok, true);
  clock.now += 1000;
  assert.equal(auth.authenticate(claimed).ok, false);
});

test("granting needs a valid session and a known grant", () => {
  const clock = { now: Date.now() };
  const auth = authenticator(clock);
  assert.equal(auth.grant("garbage", PITCH_RESERVE_GRANT), undefined);
  assert.equal(auth.grant(auth.issue(), "approve"), undefined);
  const expired = auth.issue();
  clock.now += SESSION_MS;
  assert.equal(auth.grant(expired, PITCH_RESERVE_GRANT), undefined);
});

test("the exchange matches only the exact code and reports unconfigured when the secret is missing", () => {
  const exchange = createPitchClaimExchange(SECRET);
  assert.equal(exchange.configured, true);
  assert.equal(exchange.matches(SECRET), true);
  for (const wrong of [SECRET.slice(1), `${SECRET}0`, SECRET.toUpperCase(), "", undefined, null, 42, { toString: () => SECRET }, [SECRET]]) {
    assert.equal(exchange.matches(wrong), false);
  }
  for (const missing of [undefined, "", "   ", 42]) {
    const off = createPitchClaimExchange(missing);
    assert.equal(off.configured, false);
    assert.equal(off.matches(SECRET), false);
    assert.equal(off.matches(""), false);
  }
});

test("the budget store lets a claimed cookie spend the reserve and refuses a plain one", async () => {
  const clock = { now: Date.parse("2026-12-04T04:00:00Z") };
  const auth = authenticator(clock);
  const config = readGeminiBudgetConfig({
    USTAAD_GEMINI_BUDGET_POLICY: "budget-v2",
    GEMINI_BUDGET_LIMITS: JSON.stringify({
      pool: "live", dayLimit: 3, sessionDayLimit: 3, ipDayLimit: 3, minuteLimit: 50, sessionMinuteLimit: 50,
      reserve: { units: 2, windowStart: "2026-12-04T00:00:00+08:00", windowEnd: "2026-12-04T23:59:59+08:00", grant: "pitch_reserve", sessionDayLimit: 3 },
    }),
  });
  const store = createFirestoreBudgetStore({
    projectId: "prepagent-hack", fetchImpl: fakeFirestore().fetchImpl, tokenProvider: async () => "t", limits: config.limits, now: () => clock.now,
  });
  let keys = 0;
  const reserve = (principal) => store.reserve({ principal, ipKey: "0123456789abcdef", purpose: "order_extraction", reservationKey: `k-${++keys}` });
  const plain = auth.authenticate(auth.issue()).principal;
  const claimed = auth.authenticate(auth.grant(auth.issue(), PITCH_RESERVE_GRANT)).principal;
  assert.equal((await reserve(plain)).ok, true);
  assert.equal((await reserve(plain)).code, "BUDGET_RESERVED_FOR_PITCH");
  assert.equal((await reserve(claimed)).usedPitchReserve, true);
});

test("the exchange never exposes the secret", () => {
  const exchange = createPitchClaimExchange(SECRET);
  assert.equal(JSON.stringify(exchange).includes(SECRET), false);
  assert.equal(Object.getOwnPropertyNames(exchange).some((name) => exchange[name] === SECRET), false);
});
