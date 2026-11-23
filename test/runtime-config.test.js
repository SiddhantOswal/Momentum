import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PORT, readServerPort } from "../src/runtime-config.js";
import { readOptimizerQueryBudget } from "../src/service-ports.js";

test("server port defaults to 8080 and accepts valid TCP ports", () => {
  assert.equal(DEFAULT_PORT, 8080);
  assert.equal(readServerPort(undefined), 8080);
  assert.equal(readServerPort(""), 8080);
  assert.equal(readServerPort("1"), 1);
  assert.equal(readServerPort("65535"), 65_535);
});

test("server port rejects malformed and out-of-range values", () => {
  for (const value of ["0", "65536", "-1", "80.5", "invalid", 8080, null]) {
    assert.throws(
      () => readServerPort(value),
      /PORT must be an integer from 1 to 65535/,
    );
  }
});

// Bytes billed by one canonical optimizer run for PKBX0041, recorded in
// docs/arc/delivery/data/PKBX0041-m2-rerun.md (two ASSERT jobs and a SELECT).
const PKBX0041_OPTIMIZER_BYTES_BILLED = 94_371_840;

test("optimizer byte budget default covers the bytes billed by the recorded PKBX0041 run", () => {
  const budget = readOptimizerQueryBudget({});
  assert.ok(budget >= PKBX0041_OPTIMIZER_BYTES_BILLED,
    `default ${budget} is below the ${PKBX0041_OPTIMIZER_BYTES_BILLED} bytes one optimizer run bills`);
  assert.equal(budget, 100 * 1024 * 1024);
});
