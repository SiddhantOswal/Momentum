import assert from "node:assert/strict";
import { setImmediate as nextTurn } from "node:timers/promises";

// Deterministic REST double: a commit applies every write or none, and each write's
// currentDocument precondition is checked. Local evidence only, not live Firestore.
export function fakeFirestore({ failReads = false, commitBarrier = 0 } = {}) {
  const docs = new Map();
  const calls = [];
  let serial = 0;
  // Holds the first `commitBarrier` commits until all have arrived, so they race on the same reads.
  const held = [];
  const reply = (data, status = 200) => Response.json(data, { status });
  return {
    docs, calls,
    async fetchImpl(url, options = {}) {
      const path = new URL(url).pathname;
      calls.push({ path, method: options.method ?? "GET" });
      await nextTurn();
      if (path.endsWith(":beginTransaction")) return reply({ transaction: `tx-${++serial}` });
      if (path.endsWith(":rollback")) return reply({});
      if ((options.method ?? "GET") === "GET") {
        if (failReads) return reply({ error: { status: "UNAVAILABLE" } }, 503);
        const doc = docs.get(path.slice(4));
        return doc ? reply(structuredClone(doc)) : reply({ error: { status: "NOT_FOUND" } }, 404);
      }
      assert.ok(path.endsWith(":commit"));
      if (held.length < commitBarrier) {
        await new Promise((release) => {
          held.push(release);
          if (held.length === commitBarrier) held.forEach((go) => go());
        });
      }
      const { writes } = JSON.parse(options.body);
      for (const write of writes) {
        const current = docs.get(write.update.name);
        if ((write.currentDocument.exists === false && current) ||
            (write.currentDocument.updateTime && current?.updateTime !== write.currentDocument.updateTime)) {
          return reply({ error: { status: "ABORTED" } }, 409);
        }
      }
      const stamp = `2026-12-04T00:00:00.${String(++serial).padStart(6, "0")}Z`;
      for (const write of writes) docs.set(write.update.name, { ...write.update, updateTime: stamp });
      return reply({ writeResults: writes.map(() => ({ updateTime: stamp })), commitTime: stamp });
    },
  };
}
