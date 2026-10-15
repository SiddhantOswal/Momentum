import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validatePkbx0041Acceptance } from "../tools/validate-optimizer-acceptance.mjs";

// Frozen observed response from the already-completed approved query. These
// tests perform no BigQuery operation and do not stand in for cloud evidence.
function savedResult() {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/optimizer-pkbx0041-cli-result.json", import.meta.url)));
  return fixture.response;
}

test("optimizer acceptance validates canonical bq script assertions plus the real saved two-row response", () => {
  const payload = savedResult();
  const result = validatePkbx0041Acceptance(payload);
  assert.equal(result.ok, true); assert.equal(result.differences.length, 0);
  assert.equal(validatePkbx0041Acceptance(payload[2]).ok, true);
});

test("optimizer acceptance refuses altered savings, missing risks and unsuccessful script wrappers without changing expected values", () => {
  const rows = structuredClone(savedResult()[2]);
  const best = rows.find(r => r.kind === "BEST"); best.savings_cost = "924";
  assert.equal(validatePkbx0041Acceptance(rows).ok, false);
  best.savings_cost = "925"; best.rate_crack_pct = null;
  assert.equal(validatePkbx0041Acceptance(rows).ok, false);
  assert.throws(() => validatePkbx0041Acceptance(["Assertion failed", "Assertion successful", rows]), /canonical/);
  assert.throws(() => validatePkbx0041Acceptance([rows[0], rows[0]]), /canonical/);
});
