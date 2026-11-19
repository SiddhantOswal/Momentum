import test from "node:test";
import assert from "node:assert/strict";
import { createLiveStore } from "../src/google-cloud/live-store.js";

const fixedNow = () => new Date("2026-11-21T09:30:00.000Z");
const lot = { lotId: "JOB-1", jobId: "JOB-1", orderId: "TEST-CLA/PO/2026/1047", itemCode: "SKU-TEST-42", quantity: 100, status: "planned", totalScrapPct: 9.8, primaryDefect: "DELAM" };

test("memory store pushes lots and events to every watcher", async () => {
  const store = createLiveStore({ now: fixedNow });
  const seenA = [], seenB = [];
  const stopA = await store.watch((v) => seenA.push(v));
  await store.watch((v) => seenB.push(v));
  assert.equal(await store.publish({ lot, event: { type: "lot.planned", lotId: "JOB-1", text: "Lot SKU-TEST-42 planned" } }), true);
  assert.deepEqual(seenA.at(-1).lots.map((l) => l.lotId), ["JOB-1"]);
  assert.equal(seenB.at(-1).events[0].type, "lot.planned");
  assert.equal(seenB.at(-1).lots[0].updatedAt, "2026-11-21T09:30:00.000Z");
  stopA();
  await store.publish({ lot: { ...lot, status: "approved" } });
  assert.equal(seenA.at(-1).lots[0].status, "planned", "an unsubscribed watcher hears nothing more");
  assert.equal(seenB.at(-1).lots[0].status, "approved");
});

test("invalid records are rejected without throwing", async () => {
  const store = createLiveStore({ now: fixedNow });
  assert.equal(await store.publish({ lot: { ...lot, status: "lost" } }), false);
  assert.equal(await store.publish({ event: { type: "lot.planned", text: "" } }), false);
});

test("firestore mode writes through the collections and fans one listener out", async () => {
  const writes = [];
  let snapshotCallbacks = 0;
  const collection = (name) => ({
    doc: (id) => ({ set: async (data, opts) => writes.push({ name, id, data, opts }) }),
    add: async (data) => writes.push({ name, data }),
    orderBy: () => ({ limit: () => ({ onSnapshot: (next) => { snapshotCallbacks++; next({ docs: [{ data: () => ({ name }) }] }); return () => {}; } }) }),
  });
  const store = createLiveStore({ enabled: true, now: fixedNow, firestore: async () => ({ collection }) });
  assert.equal(store.mode, "firestore");
  await store.publish({ lot: { ...lot, lotId: "JOB/1" }, event: { type: "order.read", text: "Order read" } });
  assert.equal(writes[0].name, "lots");
  assert.equal(writes[0].id, "JOB_1", "document ids are made safe");
  assert.deepEqual(writes[0].opts, { merge: true });
  assert.equal(writes[1].name, "events");
  const views = [];
  await store.watch((v) => views.push(v));
  await store.watch(() => {});
  assert.equal(snapshotCallbacks, 2, "one lots listener and one events listener, shared by all watchers");
  assert.deepEqual(views.at(-1).events, [{ name: "events" }]);
});
