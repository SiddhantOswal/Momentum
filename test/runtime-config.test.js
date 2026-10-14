import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PORT, readServerPort } from "../src/runtime-config.js";

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
