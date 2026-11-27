import assert from "node:assert/strict";
import test from "node:test";
import { createConfiguredServicePorts, createServicePorts } from "../src/service-ports.js";

const ports = (env) => createConfiguredServicePorts({ env, tokenProvider: async () => "token", fetchImpl: async () => { throw new Error("no network"); } });

test("the lot flags are off by default and the exact string true turns them on", () => {
  assert.deepEqual({ ...createServicePorts().lotRevisions }, { enabled: false, enforceGuard: false, store: undefined });
  const off = ports({ PROJECT_ID: "prepagent-hack" }).lotRevisions;
  assert.equal(off.enabled, false);
  assert.equal(off.enforceGuard, false);
  for (const value of ["TRUE", "1", "yes", " true"]) {
    const ignored = ports({ PROJECT_ID: "prepagent-hack", USTAAD_ENABLE_LOT_REVISIONS: value, USTAAD_ENFORCE_APPROVE_GUARD: value }).lotRevisions;
    assert.equal(ignored.enabled, false, value);
    assert.equal(ignored.enforceGuard, false, value);
  }
  const on = ports({ PROJECT_ID: "prepagent-hack", USTAAD_ENABLE_LOT_REVISIONS: "true" }).lotRevisions;
  assert.equal(on.enabled, true);
  assert.equal(on.enforceGuard, false);
  assert.equal(typeof on.store.beginApproval, "function");
});

test("the guard flag is independent of the revision flag and still builds the store", () => {
  const guard = ports({ PROJECT_ID: "prepagent-hack", USTAAD_ENFORCE_APPROVE_GUARD: "true" }).lotRevisions;
  assert.equal(guard.enabled, false);
  assert.equal(guard.enforceGuard, true);
  assert.equal(typeof guard.store.beginApproval, "function");
});
