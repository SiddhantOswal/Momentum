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
    assert.equal(result.ok, false, name);
    assert.equal(result.error.code, "SERVICE_UNAVAILABLE", name);
  }
});

test("driver names match whole words, so ordinary words such as supply are not driver claims", async () => {
  // "ply" is not a reported driver for this item; "supply" previously matched it as a substring.
  assert.equal(fixture.explainResult.rows.some((row) => row.f[4].v === "ply"), false);
  const withSupply = liveText.replace("Historically, actual observed runs", "Historically, with the same reel supply, actual observed runs");
  assert.equal((await explainWith(withSupply)).ok, true);
  const withPly = liveText.replace("Historically, actual observed runs", "Historically, actual observed ply runs");
  assert.equal((await explainWith(withPly)).ok, false);
});
