import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { readDailyGeminiCallCapConfig, withDailyGeminiCallCap } from "../src/daily-gemini-call-cap.js";
import { createGeminiCallerMiddleware, currentGeminiCaller, runAsGeminiCaller } from "../src/gemini-caller-context.js";

const cap = readDailyGeminiCallCapConfig({ GEMINI_DAILY_ATTEMPT_CAP: "50" });

function recordingStore() {
  const reserved = [];
  return {
    reserved,
    scope: "shared-firestore-transaction",
    async reserveAttempt(args) { reserved.push(args); return { dayWindow: "20261130" }; },
  };
}
const client = { generateContent: async () => "content", generateJson: async () => ({}) };

test("a Gemini call made inside a caller context reserves against that session and address", async () => {
  const store = recordingStore();
  const gemini = withDailyGeminiCallCap(client, cap, { store });
  const principal = { sessionId: "s".repeat(32) };
  await runAsGeminiCaller({ principal, ipKey: "0123456789abcdef" }, async () => {
    await gemini.generateJson({ role: "extraction" });
    await Promise.resolve();
    await gemini.generateContent({ role: "explanation", contents: [] });
  });
  assert.equal(store.reserved.length, 2);
  for (const call of store.reserved) {
    assert.equal(call.budget.principal, principal);
    assert.equal(call.budget.ipKey, "0123456789abcdef");
  }
});

test("explicit budget fields win, and the rest still come from the caller", async () => {
  const store = recordingStore();
  const gemini = withDailyGeminiCallCap(client, cap, { store });
  await runAsGeminiCaller({ principal: { sessionId: "s".repeat(32) }, ipKey: "0123456789abcdef" }, () => gemini.generateJson({
    role: "extraction", budget: { purpose: "arc_router", ipKey: "fedcba9876543210" },
  }));
  assert.equal(store.reserved[0].budget.purpose, "arc_router");
  assert.equal(store.reserved[0].budget.ipKey, "fedcba9876543210");
  assert.equal(store.reserved[0].budget.principal.sessionId, "s".repeat(32));
});

test("outside a caller context the budget is what the caller passed, as before", async () => {
  const store = recordingStore();
  const gemini = withDailyGeminiCallCap(client, cap, { store });
  await gemini.generateJson({ role: "extraction" });
  assert.equal(store.reserved[0].budget, undefined);
  assert.equal(currentGeminiCaller(), undefined);
});

test("two requests running at once each keep their own caller", async () => {
  const store = recordingStore();
  const gemini = withDailyGeminiCallCap(client, cap, { store });
  const slow = (sessionId) => runAsGeminiCaller({ principal: { sessionId }, ipKey: null }, async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    await gemini.generateJson({ role: "extraction" });
  });
  await Promise.all(["a", "b", "c"].map((letter) => slow(letter.repeat(32))));
  assert.deepEqual(store.reserved.map((call) => call.budget.principal.sessionId).sort(), ["a".repeat(32), "b".repeat(32), "c".repeat(32)]);
});

test("with no store the in-process cap behaves the same inside a caller context", async () => {
  const gemini = withDailyGeminiCallCap(client, readDailyGeminiCallCapConfig({ GEMINI_DAILY_ATTEMPT_CAP: "1" }));
  await runAsGeminiCaller({ principal: { sessionId: "s".repeat(32) }, ipKey: null }, () => gemini.generateJson({ role: "extraction" }));
  await assert.rejects(runAsGeminiCaller({ principal: undefined, ipKey: null }, () => gemini.generateJson({ role: "extraction" })), { code: "GEMINI_DAILY_CAP_EXCEEDED" });
});

test("the middleware sets the caller from the request for everything the handler awaits", async () => {
  const seen = [];
  const app = new Hono();
  app.use("*", createGeminiCallerMiddleware({
    getPrincipal: (c) => ({ sessionId: c.req.header("x-test-session") }),
    getIpKey: (c) => c.req.header("x-test-ip") ?? null,
  }));
  app.get("/probe", async (c) => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    seen.push(currentGeminiCaller());
    return c.text("ok");
  });
  await app.request("/probe", { headers: { "x-test-session": "one", "x-test-ip": "0123456789abcdef" } });
  await app.request("/probe");
  assert.equal(seen[0].principal.sessionId, "one");
  assert.equal(seen[0].ipKey, "0123456789abcdef");
  assert.equal(seen[1].ipKey, null);
  assert.equal(currentGeminiCaller(), undefined);
});
