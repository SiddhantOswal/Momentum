import assert from "node:assert/strict";
import test from "node:test";
import { approveJob } from "../src/commands/approve-job.js";
import { SUPPORTED_CURRENCIES } from "../src/currency.js";

const JOB_ID = `JOB-${"0".repeat(40)}`;

function approvalDeps() {
  const calls = [];
  return {
    calls,
    deps: {
      servicePorts: { approveJob: async (request) => { calls.push(request); return { ok: true, data: { status: "APPROVED" } }; } },
      liveStore: { publish: async () => {} },
      executionMode: "demo",
      newCorrelationId: () => "corr-test",
      now: Date.now,
      log: () => {},
    },
  };
}

test("approve accepts every supported currency and forwards it", async () => {
  for (const currency of SUPPORTED_CURRENCIES) {
    const { deps, calls } = approvalDeps();
    const result = await approveJob({ jobId: JOB_ID, lang: "en", currency }, deps);
    assert.equal(result.ok, true, currency);
    assert.equal(calls[0].currency, currency);
  }
});

test("approve rejects an unsupported currency with the supported list and never reaches the service", async () => {
  const { deps, calls } = approvalDeps();

  const result = await approveJob({ jobId: JOB_ID, lang: "en", currency: "ZZZ" }, deps);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.deepEqual(result.error.issues.map(({ field }) => field), ["currency"]);
  assert.equal(result.error.issues[0].message, `Currency must be one of ${SUPPORTED_CURRENCIES.join(", ")}.`);
  assert.equal(calls.length, 0);
});
