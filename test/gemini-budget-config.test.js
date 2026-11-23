import assert from "node:assert/strict";
import test from "node:test";
import {
  attemptCostMicroInr,
  istWindows,
  readGeminiBudgetConfig,
  windowActive,
} from "../src/gemini-budget-config.js";

const LIVE_LIMITS = {
  pool: "live",
  dayLimit: 300, sessionDayLimit: 40, ipDayLimit: 120, minuteLimit: 20, sessionMinuteLimit: 6,
  demoSessionMint: { perIpPerHour: 30 },
  pitchClaim: { attemptsPerIpPerHour: 5 },
  reserve: { units: 80, windowStart: "2026-12-04T00:00:00+08:00",
    windowEnd: "2026-12-04T23:59:59+08:00", grant: "pitch_reserve", sessionDayLimit: 120 },
};
const EVAL_LIMITS = {
  pool: "eval",
  dayLimit: 900, sessionDayLimit: 900, ipDayLimit: 900, minuteLimit: 10, sessionMinuteLimit: 10,
  blockedWindows: [{ start: "2026-12-04T00:00:00+08:00", end: "2026-12-04T23:59:59+08:00" }],
};
const flagOn = (limits, extra = {}) => ({
  USTAAD_GEMINI_BUDGET_POLICY: "budget-v2",
  GEMINI_BUDGET_LIMITS: typeof limits === "string" ? limits : JSON.stringify(limits),
  ...extra,
});

test("the budget policy is off unless the flag selects budget-v2", () => {
  const config = readGeminiBudgetConfig({});
  assert.equal(config.requested, false);
  assert.equal(config.configured, false);
  assert.equal(config.status, "off");
});

test("a valid live config applies the F2 rupee cap of 600 a day unless it sets its own", () => {
  const config = readGeminiBudgetConfig(flagOn(LIVE_LIMITS));
  assert.equal(config.requested, true);
  assert.equal(config.configured, true);
  assert.equal(config.status, "configured");
  assert.equal(config.limits.dayCostCapInr, 600);
  assert.equal(config.limits.reserve.units, 80);
  assert.equal(readGeminiBudgetConfig(flagOn({ ...LIVE_LIMITS, dayCostCapInr: 450 })).limits.dayCostCapInr, 450);
});

test("the eval pool defaults to the F2 rupee cap of 200 a day and is refused on Cloud Run", () => {
  const local = readGeminiBudgetConfig(flagOn(EVAL_LIMITS));
  assert.equal(local.configured, true);
  assert.equal(local.limits.dayCostCapInr, 200);
  const cloud = readGeminiBudgetConfig(flagOn(EVAL_LIMITS, { K_SERVICE: "momentum" }));
  assert.equal(cloud.configured, false);
  assert.deepEqual(cloud.invalid, ["GEMINI_BUDGET_LIMITS"]);
});

test("invalid budget config is reported without echoing its content and blocks the store", () => {
  const cases = [
    ["not json", "{ dayLimit: 300"],
    ["unknown field", { ...LIVE_LIMITS, dayLimt: 300 }],
    ["zero limit", { ...LIVE_LIMITS, minuteLimit: 0 }],
    ["fractional limit", { ...LIVE_LIMITS, dayLimit: 300.5 }],
    ["reserve not below the day limit", { ...LIVE_LIMITS, reserve: { ...LIVE_LIMITS.reserve, units: 300 } }],
    ["reserve window backwards", { ...LIVE_LIMITS, reserve: { ...LIVE_LIMITS.reserve,
      windowStart: "2026-12-05T00:00:00+08:00", windowEnd: "2026-12-04T00:00:00+08:00" } }],
    ["reserve window without offset", { ...LIVE_LIMITS, reserve: { ...LIVE_LIMITS.reserve, windowStart: "2026-12-04T00:00:00" } }],
    ["reserve in the eval pool", { ...EVAL_LIMITS, reserve: LIVE_LIMITS.reserve }],
    ["negative rupee cap", { ...LIVE_LIMITS, dayCostCapInr: -1 }],
    ["rupee cap above the 10,000 set aside", { ...LIVE_LIMITS, dayCostCapInr: 10001 }],
    ["array", [LIVE_LIMITS]],
  ];
  for (const [name, limits] of cases) {
    const config = readGeminiBudgetConfig(flagOn(limits));
    assert.equal(config.configured, false, name);
    assert.equal(config.status, "invalid", name);
    assert.deepEqual(config.invalid, ["GEMINI_BUDGET_LIMITS"], name);
    assert.equal(config.limits, undefined, name);
    assert.doesNotMatch(JSON.stringify(config), /dayLimt|300\.5|10001/, name);
  }
  const missing = readGeminiBudgetConfig({ USTAAD_GEMINI_BUDGET_POLICY: "budget-v2" });
  assert.equal(missing.status, "missing");
  assert.deepEqual(missing.missing, ["GEMINI_BUDGET_LIMITS"]);
  const unknownPolicy = readGeminiBudgetConfig({ USTAAD_GEMINI_BUDGET_POLICY: "budget-v3", GEMINI_BUDGET_LIMITS: JSON.stringify(LIVE_LIMITS) });
  assert.equal(unknownPolicy.configured, false);
  assert.deepEqual(unknownPolicy.invalid, ["USTAAD_GEMINI_BUDGET_POLICY"]);
});

test("attempt cost uses usageMetadata and the ADR-0008 prices, with thinking billed as output", () => {
  // gemini-3.5-flash: input 1.65, cached 0.165, output 9.90 USD per 1M tokens; 1 INR = 0.01034 USD.
  const usage = { promptTokenCount: 10000, cachedContentTokenCount: 2000, candidatesTokenCount: 1000,
    thoughtsTokenCount: 3000, totalTokenCount: 14000 };
  const usd = (8000 * 1.65 + 2000 * 0.165 + 4000 * 9.90) / 1e6;
  assert.equal(attemptCostMicroInr("explanation", usage), Math.ceil((usd / 0.01034) * 1e6));
  assert.equal(attemptCostMicroInr("explanation", {}), 0);
  // Tokens the total reports but no component explains are charged at the output price.
  assert.equal(attemptCostMicroInr("extraction", { totalTokenCount: 1000 }),
    Math.ceil(((1000 * 9.90) / 1e6 / 0.01034) * 1e6));
  // The router can fall back to gemini-3.5-flash, so it is charged at the higher price.
  assert.equal(attemptCostMicroInr("router", { promptTokenCount: 1000 }),
    attemptCostMicroInr("explanation", { promptTokenCount: 1000 }));
  assert.throws(() => attemptCostMicroInr("unknown-role", {}), TypeError);
});

test("IST windows give the day, hour and minute digits used in counter IDs", () => {
  assert.deepEqual(istWindows(Date.parse("2026-12-03T18:30:00Z")),
    { day: "20261204", hour: "2026120400", minute: "202612040000" });
  assert.deepEqual(istWindows(Date.parse("2026-12-04T18:29:59Z")),
    { day: "20261204", hour: "2026120423", minute: "202612042359" });
});

test("the configured reserve window covers all of 4 Dec in Singapore time", () => {
  const { reserve } = readGeminiBudgetConfig(flagOn(LIVE_LIMITS)).limits;
  const window = { start: reserve.windowStart, end: reserve.windowEnd };
  assert.equal(windowActive(window, Date.parse("2026-12-03T15:59:59.999Z")), false);
  assert.equal(windowActive(window, Date.parse("2026-12-03T16:00:00Z")), true);
  assert.equal(windowActive(window, Date.parse("2026-12-04T15:59:59.999Z")), true);
  assert.equal(windowActive(window, Date.parse("2026-12-04T16:00:00Z")), false);
});
