// Offline `numeric-fidelity` suite (05 section 7, RAI-3, threshold T2 and T3).
// Every number and ID in answer text must come from the same turn's tool
// results. The facts below are written by hand, not produced by Arc.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { checkGrounding, checkWriterText } from "../src/arc/answer-checks.js";
import { factsFor } from "../src/arc/answer-render.js";
import { events, fixture, modelCall, text } from "../test/fixtures/arc-turn-runner.js";

const scores = {
  tool: "get_status", label: "Modeled, tested on 219 lots",
  rows: [
    { defect: "WARP", r2: 0.4682, sampleCount: 219 }, { defect: "DELAM", r2: 0.5194, sampleCount: 219 },
    { defect: "STRENGTH", r2: 0.388, sampleCount: 219 }, { defect: "PRINT", r2: 0.6404, sampleCount: 219 },
    { defect: "CRACK", r2: 0.1081, sampleCount: 219 },
  ],
};
const weather = {
  tool: "get_weather", label: "Weather record", location: "Pune", units: { ambientRhPct: "% RH", ambientTempC: "°C" },
  ambientRhPct: 61.5, ambientTempC: 24, observedAt: "2026-11-24T09:30:00Z",
};
const scrap = {
  tool: "query_metric", metric: "top_scrap_items", status: "ok", label: "Modeled records",
  basis: "Modeled lot history, twelve months to 2026-09-30. No measured lots.", filters: {},
  rows: [
    { item_code: "PKBX0041", lots: 12, avg_scrap_pct: 3.4567, scrap_cost_12m: 7934, main_defect: "WARP", currency: "INR" },
    { item_code: "PKBX0007", lots: 9, avg_scrap_pct: 0.05, scrap_cost_12m: 123456, main_defect: "CRACK", currency: "INR" },
  ],
};
const foreignJob = `JOB-HACK-${"b".repeat(32)}-${"c".repeat(40)}`;

const cases = [
  ["an exact decimal from the tool passes", "Print scores an R2 of 0.6404.", [scores], null],
  ["a value rounded to two decimals passes (AC2.1)", "Warp scores 0.47.", [scores], null],
  ["a rounded value with a trailing zero passes", "Print scores 0.640.", [scores], null],
  ["an integer count passes", "The scores come from 219 modeled lots.", [scores], null],
  ["a thousands separator passes", "PKBX0041 cost 7,934 INR.", [scrap], null],
  ["Indian digit grouping passes", "PKBX0007 cost 1,23,456 INR.", [scrap], null],
  ["a currency sign before the value passes", "PKBX0041 cost ₹7,934.", [scrap], null],
  ["a percent sign after the value passes", "Humidity is 61.5%.", [weather], null],
  ["the R2 unit word is not read as an ID", "The R2 for Crack is 0.11.", [scores], null],
  ["a superscript R² is read as R2", "Crack has an R² of 0.11.", [scores], null],
  ["a date the tool returned passes", "The history runs to 2026-09-30.", [scrap], null],
  ["a time from the weather observation passes", "The reading is from 09:30.", [weather], null],
  ["an item code the tool returned passes", "PKBX0041 has the highest modeled scrap cost.", [scrap], null],
  ["a value rounded to one decimal fails", "Warp scores 0.5.", [scores], "UNGROUNDED_NUMBER"],
  ["a value rounded to a whole number fails", "Humidity is 62%.", [weather], "UNGROUNDED_NUMBER"],
  ["a wrong value fails", "Warp scores 0.48.", [scores], "UNGROUNDED_NUMBER"],
  ["a score turned into a percentage fails", "Print scores 64%.", [scores], "UNGROUNDED_NUMBER"],
  ["a count off by one fails", "The scores come from 220 modeled lots.", [scores], "UNGROUNDED_NUMBER"],
  ["a number no tool returned fails", "All 5 models were tested on held-out lots.", [scores], "UNGROUNDED_NUMBER"],
  ["a number taken from the question fails", "At 75% humidity the reading is 61.5%.", [weather], "UNGROUNDED_NUMBER"],
  ["a flipped sign fails", "PKBX0007 scrapped -0.05% of each lot.", [scrap], "UNGROUNDED_NUMBER"],
  ["a sum of two tool values fails", "Warp and Print together score 1.11.", [scores], "UNGROUNDED_NUMBER"],
  ["humidity and temperature swapped between their units fails", "The temperature is 61.5 °C and humidity 24%.", [weather], "UNGROUNDED_NUMBER"],
  ["a number with a leading dot is checked", "Print scores .71.", [scores], "UNGROUNDED_NUMBER"],
  ["a leading-dot number the tool returned passes", "Print scores .64.", [scores], null],
  ["Devanagari digits are rejected", "Print scores ०.६४.", [scores], "UNGROUNDED_NUMBER"],
  ["Arabic-Indic digits are rejected", "Print scores ٠.٦٤.", [scores], "UNGROUNDED_NUMBER"],
  ["a number word the facts do not hold fails", "Seventy one percent of lots were modeled.", [scores], "UNGROUNDED_NUMBER"],
  ["a number word the facts hold passes", "The holdout is one out-of-time month.", [{ ...scores, basis: "Holdout R2 on modeled lots, one out-of-time month." }], null],
  ["a date no tool returned fails", "The history runs to 2026-10-31.", [scrap], "UNGROUNDED_ID"],
  ["an item code no tool returned fails", "PKBX0099 has the highest modeled scrap cost.", [scrap], "UNGROUNDED_ID"],
  ["a job ID from another session fails", `Open ${foreignJob} for the card.`, [scrap], "UNGROUNDED_ID"],
];

for (const [name, text, facts, expected] of cases) {
  test(name, () => {
    assert.equal(checkGrounding(text, facts), expected);
    assert.equal(checkWriterText(text, facts), expected);
  });
}

test("a number from purchase order text fails because the order never becomes a fact", () => {
  const result = {
    ok: true,
    lot: { stage: "conditions", currentRevision: 0, draftConditions: [], orderRef: { orderId: "PO-4471", itemCode: "PKBX0041", quantity: 5000 } },
    purchaseOrderDocument: { poNumber: "CLA/PO/4471", buyer: "Client A Industries", quantity: 5000 },
  };
  const facts = [factsFor({ tool: "get_lot", result })];
  assert.doesNotMatch(JSON.stringify(facts), /5000|4471|Client A/);
  assert.equal(checkWriterText("The order is for 5000 boxes.", facts), "UNGROUNDED_NUMBER");
  assert.equal(checkWriterText("The lot has not been planned yet.", facts), null);
});

// Through the turn runner: the check runs before anything is stored or shown.
async function writtenTurn(written) {
  const setup = fixture({ router: () => ({ calls: [modelCall("get_status")] }), writer: () => ({ outcome: "shown", text: written }) });
  const clientTurnId = randomUUID();
  await events(await setup.post(text("How far can I trust the models?"), { clientTurnId }));
  return { turn: await setup.sessionStore.getTurn(setup.principal.sessionId, clientTurnId), attempts: setup.attempts.size };
}
const TEMPLATE_START = /^Holdout R2 per model: Warp 0\.47, Delamination 0\.52, Strength 0\.39, Print 0\.64, Crack 0\.11\./;

test("a grounded written answer is shown and stored as the writer's", { timeout: 3000 }, async () => {
  const written = "Print scores the highest R2, 0.64, on 219 modeled lots.";
  const { turn, attempts } = await writtenTurn(written);
  assert.deepEqual([turn.answerText, turn.summary.writerOutcome, turn.summary.fallbackReason, attempts], [written, "shown", null, 2]);
});

for (const [name, written, reason] of [
  ["a written number the tools did not return shows the template and counts the fallback", "Print scores 0.71 on 219 modeled lots.", "UNGROUNDED_NUMBER"],
  ["a written ID the tools did not return shows the template and counts the fallback", "Print scores 0.64; see PKBX0099.", "UNGROUNDED_ID"],
]) {
  test(name, { timeout: 3000 }, async () => {
    const { turn, attempts } = await writtenTurn(written);
    assert.match(turn.answerText, TEMPLATE_START);
    assert.deepEqual([turn.summary.writerOutcome, turn.summary.fallbackReason, turn.summary.attempts, attempts], ["fallback", reason, 2, 2]);
    assert.doesNotMatch(JSON.stringify(turn), /0\.71|PKBX0099/);
  });
}
