import assert from "node:assert/strict";
import test from "node:test";
import {
  GeminiDailyCallCapError,
  readDailyGeminiCallCapConfig,
  withDailyGeminiCallCap,
} from "../src/daily-gemini-call-cap.js";

function client(overrides = {}) {
  return {
    generateContent: async (args) => ({ method: "content", args }),
    generateJson: async (args) => ({ method: "json", args }),
    ...overrides,
  };
}

test("daily Gemini attempt cap defaults to 100 calls at midnight Asia/Kolkata", () => {
  assert.deepEqual(readDailyGeminiCallCapConfig({}), {
    configured: true,
    status: "configured",
    limit: 100,
    timeZone: "Asia/Kolkata",
    countingPolicy: "attempts",
    scope: "single-process",
    globalScopeEnforced: false,
    missing: [],
    invalid: [],
  });
});

test("invalid limit or time zone disables the Gemini wrapper", () => {
  assert.deepEqual(readDailyGeminiCallCapConfig({
    GEMINI_DAILY_ATTEMPT_CAP: "0",
    GEMINI_DAILY_ATTEMPT_TIMEZONE: "not-a-time-zone",
  }).invalid, ["GEMINI_DAILY_ATTEMPT_CAP", "GEMINI_DAILY_ATTEMPT_TIMEZONE"]);
  assert.throws(() => withDailyGeminiCallCap(client(), readDailyGeminiCallCapConfig({
    GEMINI_DAILY_ATTEMPT_CAP: "0",
  })), TypeError);
});

test("attempt counting consumes the cap before the provider call, including failures", async () => {
  let calls = 0;
  const config = readDailyGeminiCallCapConfig({ GEMINI_DAILY_ATTEMPT_CAP: "1" });
  const capped = withDailyGeminiCallCap(client({
    generateContent: async () => { calls += 1; throw new Error("provider unavailable"); },
  }), config);

  await assert.rejects(capped.generateContent({}), /provider unavailable/);
  await assert.rejects(capped.generateJson({}), GeminiDailyCallCapError);
  assert.equal(calls, 1);
  assert.deepEqual(capped.getDailyCapStatus(), {
    configured: true,
    limit: 1,
    calls: 1,
    inFlight: 0,
    remaining: 0,
    countingPolicy: "attempts",
    timeZone: "Asia/Kolkata",
    scope: "single-process",
    globalScopeEnforced: false,
    reset: "midnight-in-configured-time-zone",
  });
});

test("the cap is shared across Gemini methods and concurrent attempts", async () => {
  let releaseFirst;
  let called = 0;
  const capped = withDailyGeminiCallCap(client({
    generateContent: async () => {
      called += 1;
      await new Promise((resolve) => { releaseFirst = resolve; });
      return "done";
    },
  }), readDailyGeminiCallCapConfig({ GEMINI_DAILY_ATTEMPT_CAP: "1" }));

  const first = capped.generateContent({});
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(capped.generateJson({}), GeminiDailyCallCapError);
  assert.equal(capped.getDailyCapStatus().calls, 1);
  releaseFirst();
  assert.equal(await first, "done");
  assert.equal(called, 1);
});

test("daily reset uses the configured timezone midnight and date key", async () => {
  let time = Date.parse("2026-10-14T18:29:59.000Z");
  let calls = 0;
  const capped = withDailyGeminiCallCap(client({
    generateJson: async () => { calls += 1; return calls; },
  }), readDailyGeminiCallCapConfig({ GEMINI_DAILY_ATTEMPT_CAP: "1" }), {
    now: () => time,
  });

  await capped.generateJson({});
  await assert.rejects(capped.generateJson({}), GeminiDailyCallCapError);
  time = Date.parse("2026-10-14T18:30:00.000Z");
  assert.equal(await capped.generateJson({}), 2);
  assert.equal(capped.getDailyCapStatus().remaining, 0);
});
