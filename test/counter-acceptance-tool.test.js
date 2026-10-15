import assert from "node:assert/strict";
import test from "node:test";
import { acceptGeminiCounter } from "../tools/accept-gemini-counter.mjs";

// Local administrator-acceptance harness double; not actual Firestore evidence.
function fixture({ initial = 0, failAttempt } = {}) {
  let count = initial; let attempts = 0; let clients = 0;
  return {
    now: () => Date.parse("2026-10-15T10:00:00Z"),
    createStore() { clients += 1; return { async reserveAttempt() {
      attempts += 1; if (attempts === failAttempt) throw new Error("ambiguous timeout");
      return { attemptCount: ++count };
    } }; },
    async readCounter(dayKey) { return count === 0 ? null : { name: `projects/prepagent-hack/databases/(default)/documents/gemini_daily_usage/${dayKey}`, updateTime: "2026-10-15T10:00:00Z",
      fields: { dayKey: { stringValue: dayKey }, timezone: { stringValue: "Asia/Kolkata" }, configuredCap: { integerValue: "100" }, attemptCount: { integerValue: String(count) },
        policyVersion: { stringValue: "ist-attempts-v1" }, updatedAt: { timestampValue: "2026-10-15T10:00:00Z" } } }; },
    get attempts() { return attempts; }, get clients() { return clients; },
  };
}

test("counter acceptance reserves exactly three slots through two clients and independently reads actual final count", async () => {
  const f = fixture(); const result = await acceptGeminiCounter(f);
  assert.equal(result.status, "PASS"); assert.equal(result.before.count, 0); assert.equal(result.after.count, 3);
  assert.equal(f.attempts, 3); assert.equal(f.clients, 2); assert.equal(result.providerCalls, 0);
});

test("counter acceptance refuses insufficient capacity and preserves partial-failure evidence without repeats", async () => {
  const exhausted = fixture({ initial: 98 });
  assert.equal((await acceptGeminiCounter(exhausted)).status, "BLOCKED"); assert.equal(exhausted.attempts, 0);
  const partial = fixture({ failAttempt: 2 }); const result = await acceptGeminiCounter(partial);
  assert.equal(result.status, "BLOCKED"); assert.equal(result.after.count, 2); assert.equal(partial.attempts, 3);
  assert.equal(result.providerCalls, 0); assert.match(result.error, /ambiguous/);
});
