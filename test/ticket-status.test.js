import assert from "node:assert/strict";
import test from "node:test";
import { mergedIds, parseTickets, summarise } from "../tools/orchestrator/ticket-status.mjs";

test("reads ticket ids, titles and priorities from a ticket file", () => {
  const tickets = parseTickets("# M1\n\n### ARC-M1-05 Durable idempotency for `/jobs` (P0)\n- Goal\n### ARC-M1-13 Weather test (P1, needs Node 22)\n### ARC-SETUP-02 Follow-ups (P1, condition for the gate)\n### ARC-M2-09 No priority\n");
  assert.deepEqual(tickets.map((t) => [t.id, t.priority]), [["ARC-M1-05", "P0"], ["ARC-M1-13", "P1"], ["ARC-SETUP-02", "P1"], ["ARC-M2-09", "P?"]]);
  assert.equal(tickets[0].title, "Durable idempotency for `/jobs`");
});

test("finds merged tickets from merge subjects, including a combined merge", () => {
  const ids = mergedIds(["Merge ARC-M1-05: durable idempotency for /jobs", "Merge ARC-M1-12 and M1-14: Gemini request and safety settings", "Merge ARC-M1-REPAIR-1: fail closed", "Merge branch 'x'", "Add a thing"]);
  assert.deepEqual([...ids].sort(), ["ARC-M1-05", "ARC-M1-12", "ARC-M1-14", "ARC-M1-REPAIR-1"]);
});

test("counts open tickets by priority and honours tickets done without a merge", () => {
  const tickets = [{ id: "ARC-A-01", title: "a", priority: "P0" }, { id: "ARC-A-02", title: "b", priority: "P0" }, { id: "ARC-A-03", title: "c", priority: "P1" }, { id: "ARC-A-04", title: "d", priority: "P2" }];
  const result = summarise(tickets, new Set(["ARC-A-01"]), new Set(["ARC-A-04"]));
  assert.deepEqual(result.openByPriority, { P0: 1, P1: 1, P2: 0, "P?": 0 });
  assert.equal(result.rows.find((r) => r.id === "ARC-A-04").state, "MERGED");
});
