import assert from "node:assert/strict";
import test from "node:test";
import { createFirestoreGeminiAttemptStore } from "../src/google-cloud/firestore-gemini-attempt-store.js";
import { readDailyGeminiCallCapConfig, withDailyGeminiCallCap } from "../src/daily-gemini-call-cap.js";

// Deterministic REST test double with versioned commit preconditions. This is
// local concurrency evidence only; no claim about actual Firestore connectivity.
function fakeFirestore({ alwaysAbort = false, denyRead = false, ambiguousCommit = false } = {}) {
  const docs = new Map();
  const calls = [];
  let serial = 0;
  const reply = (data, status = 200) => Response.json(data, { status });
  return {
    docs, calls,
    async fetchImpl(url, options) {
      const path = new URL(url).pathname;
      calls.push({ path, options });
      if (path.endsWith(":beginTransaction")) return reply({ transaction: `transaction-${++serial}` });
      if (path.endsWith(":rollback")) return reply({});
      if (options.method === "GET") {
        if (denyRead) return reply({ error: { status: "PERMISSION_DENIED" } }, 403);
        const name = path.slice(4);
        const doc = docs.get(name);
        return doc ? reply(structuredClone(doc)) : reply({ error: { status: "NOT_FOUND" } }, 404);
      }
      assert.ok(path.endsWith(":commit"));
      const request = JSON.parse(options.body);
      const write = request.writes[0];
      const current = docs.get(write.update.name);
      if (alwaysAbort || (write.currentDocument.exists === false && current) ||
          (write.currentDocument.updateTime && current?.updateTime !== write.currentDocument.updateTime)) {
        return reply({ error: { status: "ABORTED" } }, 409);
      }
      const stamp = `2026-10-15T00:00:${String(++serial).padStart(2, "0")}.000000Z`;
      docs.set(write.update.name, { ...write.update, updateTime: stamp });
      if (ambiguousCommit) throw new Error("network lost after commit");
      return reply({ writeResults: [{ updateTime: stamp }], commitTime: stamp });
    },
  };
}

function setup(fake = fakeFirestore(), { cap = "100", now = () => Date.parse("2026-10-15T12:00:00Z"), provider } = {}) {
  let providerCalls = 0;
  const client = {
    generateContent: async () => { providerCalls += 1; return provider ? provider() : "content"; },
    generateJson: async () => { providerCalls += 1; return provider ? provider() : "json"; },
  };
  const store = createFirestoreGeminiAttemptStore({ projectId: "prepagent-hack", tokenProvider: async () => "test-token", fetchImpl: fake.fetchImpl });
  const capped = withDailyGeminiCallCap(client, readDailyGeminiCallCapConfig({ GEMINI_DAILY_ATTEMPT_CAP: cap }), { store, now });
  return { capped, store, fake, get providerCalls() { return providerCalls; } };
}

test("shared Gemini store reserves first, 99th and 100th attempts; 101st never reaches provider", async () => {
  const context = setup();
  for (let i = 0; i < 100; i += 1) await context.capped.generateContent({});
  await assert.rejects(context.capped.generateJson({}), { code: "GEMINI_DAILY_CAP_EXCEEDED" });
  assert.equal(context.providerCalls, 100);
  const doc = [...context.fake.docs.values()][0];
  assert.equal(doc.fields.attemptCount.integerValue, "100");
  assert.equal(doc.fields.timezone.stringValue, "Asia/Kolkata");
  assert.equal(context.fake.calls.filter(x => x.path.endsWith(":commit")).length, 100);
});

test("two instances racing for final slot cannot both call Gemini and restart preserves usage", async () => {
  const fake = fakeFirestore();
  const first = setup(fake, { cap: "1" });
  const second = setup(fake, { cap: "1" });
  const results = await Promise.allSettled([first.capped.generateJson({}), second.capped.generateContent({})]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(first.providerCalls + second.providerCalls, 1);
  assert.equal([...fake.docs.values()][0].fields.attemptCount.integerValue, "1");
  const restarted = setup(fake, { cap: "1" });
  await assert.rejects(restarted.capped.generateJson({}), { code: "GEMINI_DAILY_CAP_EXCEEDED" });
  assert.equal(restarted.providerCalls, 0);
});

test("Firestore permission failure and transaction contention fail closed with bounded attempts", async () => {
  const denied = setup(fakeFirestore({ denyRead: true }));
  await assert.rejects(denied.capped.generateContent({}), { code: "GEMINI_USAGE_UNAVAILABLE" });
  assert.equal(denied.providerCalls, 0);
  const aborted = setup(fakeFirestore({ alwaysAbort: true }));
  await assert.rejects(aborted.capped.generateContent({}), { code: "GEMINI_USAGE_UNAVAILABLE" });
  assert.equal(aborted.providerCalls, 0);
  assert.equal(aborted.fake.calls.filter(x => x.path.endsWith(":commit")).length, 3);
});

test("ambiguous commit is not retried and does not call provider or refund usage", async () => {
  const context = setup(fakeFirestore({ ambiguousCommit: true }), { cap: "1" });
  await assert.rejects(context.capped.generateJson({}), { code: "GEMINI_USAGE_UNAVAILABLE" });
  assert.equal(context.providerCalls, 0);
  assert.equal(context.fake.calls.filter(x => x.path.endsWith(":commit")).length, 1);
  assert.equal([...context.fake.docs.values()][0].fields.attemptCount.integerValue, "1");
});

test("provider timeout, 429 and 503 consume their reservations without automatic retry", async (t) => {
  for (const reason of ["timeout", "429", "503"]) {
    await t.test(reason, async () => {
      const context = setup(fakeFirestore(), { cap: "1", provider: () => { throw new Error(reason); } });
      await assert.rejects(context.capped.generateContent({}), new RegExp(reason));
      await assert.rejects(context.capped.generateJson({}), { code: "GEMINI_DAILY_CAP_EXCEEDED" });
      assert.equal(context.providerCalls, 1);
    });
  }
});

test("shared counter uses IST midnight, validates existing policy and never resets a mismatched counter", async () => {
  let time = Date.parse("2026-10-14T18:29:59Z");
  const context = setup(fakeFirestore(), { cap: "1", now: () => time });
  await context.capped.generateJson({});
  await assert.rejects(context.capped.generateContent({}), { code: "GEMINI_DAILY_CAP_EXCEEDED" });
  time += 1000;
  await context.capped.generateContent({});
  assert.equal(context.fake.docs.size, 2);
  const changedCap = setup(context.fake, { cap: "2", now: () => time });
  await assert.rejects(changedCap.capped.generateContent({}), { code: "GEMINI_USAGE_POLICY_MISMATCH" });
  assert.equal(changedCap.providerCalls, 0);
});

test("shared store rejects invalid policy and missing identity without reaching Firestore", async () => {
  const context = setup();
  await assert.rejects(context.store.reserveAttempt({ dayKey: "2026-02-30", timeZone: "Asia/Kolkata", limit: 100 }), { code: "INVALID_GEMINI_USAGE_POLICY" });
  assert.equal(context.fake.calls.length, 0);
  const noToken = createFirestoreGeminiAttemptStore({ projectId: "prepagent-hack", fetchImpl: context.fake.fetchImpl, tokenProvider: async () => "" });
  await assert.rejects(noToken.reserveAttempt({ dayKey: "2026-10-15", timeZone: "Asia/Kolkata", limit: 100 }), { code: "GEMINI_USAGE_UNAVAILABLE" });
  assert.equal(context.fake.calls.length, 0);
});
