import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRiskExplanationService } from "../src/google-cloud/risk-evidence-service.js";

// Real Gemini answer and BigQuery attribution rows from the 16 Oct 2026 PKBX0041 replay.
const fixture = JSON.parse(readFileSync(new URL("./fixtures/explanation-pkbx0041-20261016.json", import.meta.url), "utf8"));
const sql = readFileSync(new URL("../sql/explain.sql", import.meta.url), "utf8");
const liveText = fixture.geminiText;

async function explainWith(text) {
  const service = createRiskExplanationService({
    bigquery: { query: async () => structuredClone(fixture.explainResult) },
    gemini: { generateContent: async () => ({ parts: [{ text }] }) },
    sql,
  });
  return service(structuredClone(fixture.inputs));
}

test("the real 16 Oct explanation passes: supplied run date, named setting and negated causation disclaimer", async () => {
  assert.match(liveText, /2025-07-14/);
  assert.match(liveText, /roll temperature of 170/);
  assert.match(liveText, /rather than proven real-world cause-and-effect/);
  const result = await explainWith(liveText);
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal(result.explanation, liveText);
});

test("evidence checks still reject unsupplied dates, unreported attribution drivers and causal claims", async () => {
  const unsafe = {
    unknownDate: liveText.replace("2025-07-14", "2024-01-01"),
    unreportedAttribution: liveText.replace(
      "while gum application (gum_application) is associated with a downward contribution of -0.137 points",
      "while roll temperature is associated with a downward contribution of -0.137 points"),
    causalClaim: liveText.replace(
      "These model attributions represent statistical associations within the data rather than proven real-world cause-and-effect relationships.",
      "Humidity causes the warp scrap."),
    unnegatedCauseAndEffect: liveText.replace(
      "rather than proven real-world cause-and-effect relationships",
      "and prove the cause-and-effect relationships"),
    unsuppliedNumber: liveText.replace("8.42%", "7.5%"),
  };
  for (const [name, text] of Object.entries(unsafe)) {
    assert.notEqual(text, liveText, `${name} must change the text`);
    const result = await explainWith(text);
    // Rejected twice, so the checked attribution summary replaces the unsafe text.
    assert.equal(result.source, "bigquery-ml-attribution-summary", name);
    assert.notEqual(result.explanation, text, name);
  }
});

test("driver names match whole words, so ordinary words such as supply are not driver claims", async () => {
  // "ply" is not a reported driver for this item; "supply" previously matched it as a substring.
  assert.equal(fixture.explainResult.rows.some((row) => row.f[4].v === "ply"), false);
  const withSupply = liveText.replace("Historically, actual observed runs", "Historically, with the same reel supply, actual observed runs");
  assert.equal((await explainWith(withSupply)).ok, true);
  const withPly = liveText.replace("Historically, actual observed runs", "Historically, actual observed ply runs");
  assert.equal((await explainWith(withPly)).source, "bigquery-ml-attribution-summary");
});

// 20 Nov 2026 live rejections (gemini-3.5-flash on the m2_* models): both were sound texts.
test("a negated causal disclaimer passes in every common wording", async () => {
  for (const disclaimer of [
    "These model attributions do not imply causal links between the settings and the defects.",
    "Neither attribution establishes a real-world causal effect.",
    "These attributions are associations, not causation.",
  ]) {
    const text = liveText.replace(
      "These model attributions represent statistical associations within the data rather than proven real-world cause-and-effect relationships.",
      disclaimer);
    const result = await explainWith(text);
    assert.equal(result.source, "bigquery-ml-and-gemini", disclaimer);
    assert.equal(result.explanation, text);
  }
});

test("a source-history sentence may name supplied settings even with the word associated", async () => {
  const reported = new Set(fixture.explainResult.rows.map((row) => row.f[4].v));
  assert.equal(reported.has("pasting_pressure"), false, "pasting pressure is a supplied setting, not a reported driver here");
  const text = liveText.replace("Historically, actual observed runs", "Source-history records associated with past settings like a different pasting pressure show that runs");
  const result = await explainWith(text);
  assert.equal(result.source, "bigquery-ml-and-gemini");
  // The same words in a model-attribution sentence are still refused.
  const claim = liveText.replace("Historically, actual observed runs", "The model attribution is associated with pasting pressure, and runs");
  assert.equal((await explainWith(claim)).source, "bigquery-ml-attribution-summary");
});

test("a rejected first answer gets one more attempt before the summary", async () => {
  const texts = ["Humidity causes the warp scrap. Warp is high. It is bad.", liveText];
  let calls = 0;
  const service = createRiskExplanationService({
    bigquery: { query: async () => structuredClone(fixture.explainResult) },
    gemini: { generateContent: async () => ({ parts: [{ text: texts[calls++] }] }) },
    sql,
  });
  const result = await service(structuredClone(fixture.inputs));
  assert.equal(calls, 2);
  assert.equal(result.source, "bigquery-ml-and-gemini");
  assert.equal(result.explanation, liveText);
});

test("the attribution summary states only validated rows and supplied totals", async () => {
  let calls = 0;
  const service = createRiskExplanationService({
    bigquery: { query: async () => structuredClone(fixture.explainResult) },
    gemini: { generateContent: async () => { calls += 1; const error = new Error("cap"); error.code = "GEMINI_DAILY_CAP_EXCEEDED"; throw error; } },
    sql,
  });
  const result = await service(structuredClone(fixture.inputs));
  assert.equal(calls, 1, "a provider failure is not retried");
  assert.equal(result.ok, true);
  assert.equal(result.source, "bigquery-ml-attribution-summary");
  assert.match(result.explanation, /^The model predicts a total scrap rate of /);
  assert.match(result.explanation, /not proof of cause and effect/);
  const sentences = result.explanation.split(/(?<=\.)\s+/);
  assert.ok(sentences.length >= 3 && sentences.length <= 5, result.explanation);
  for (const row of result.rows.filter((r) => r.driverRank === 1).slice(0, 2)) {
    assert.match(result.explanation, new RegExp(`${row.predictedPct}%`));
  }
});
