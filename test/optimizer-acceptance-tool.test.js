import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateM2Acceptance, validatePkbx0041Acceptance } from "../tools/validate-optimizer-acceptance.mjs";

const active = JSON.parse(readFileSync(new URL("../config/model-acceptance.json", import.meta.url), "utf8"));

test("optimizer acceptance checks only the active m2 R2 evidence", () => {
  const result = validateM2Acceptance(active);
  assert.equal(result.ok, true);
  assert.equal(result.differences.length, 0);
  assert.deepEqual(result.models.map(({ defect, resource, r2 }) => ({ defect, resource, r2 })), [
    { defect: "WARP", resource: "prepagent.m2_warp", r2: active.models[0].r2 },
    { defect: "DELAM", resource: "prepagent.m2_delam", r2: active.models[1].r2 },
    { defect: "STRENGTH", resource: "prepagent.m2_strength", r2: active.models[2].r2 },
    { defect: "PRINT", resource: "prepagent.m2_print", r2: active.models[3].r2 },
    { defect: "CRACK", resource: "prepagent.m2_crack", r2: active.models[4].r2 },
  ]);
});

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
