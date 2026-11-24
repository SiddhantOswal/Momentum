import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateM2Acceptance } from "../tools/validate-optimizer-acceptance.mjs";

const active = JSON.parse(readFileSync(new URL("../config/model-acceptance.json", import.meta.url), "utf8"));

test("optimizer acceptance checks only the active m2 R2 evidence", () => {
  const result = validateM2Acceptance(active);
  assert.equal(result.ok, true);
  assert.equal(result.differences.length, 0);
  assert.deepEqual(result.models, active.models.map(({ defect, resource, r2 }) => ({ defect, resource, r2 })));
});
