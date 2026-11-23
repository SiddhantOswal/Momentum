import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createJobRequestIdentity } from "../src/job-idempotency.js";

const sessionId = "a".repeat(32);
const lotA = `LOT-HACK-${sessionId}-${"b".repeat(12)}`;
const lotB = `LOT-HACK-${sessionId}-${"c".repeat(12)}`;

function identityFor(overrides = {}) {
  return createJobRequestIdentity({
    fileBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
    operatorFields: { orderId: "PO-LOT-001", paperType: "VIRGIN", paperSupplier: "SUPPLIER-A" },
    operatorItemConfirmation: { itemCode: "SKU-LOT-1", quantity: 250 },
    shift: "DAY",
    levers: {
      sfSpeedMpm: 40, rollTempC: 165, gumApplication: "MED", gumViscositySec: 40,
      pastingPressure: "MED", dryingHours: 6, printSpeedSpm: 50,
    },
    conditions: { runDate: "2026-10-15", shift: "DAY", ambientRhPct: 64, ambientTempC: 26, paperMoisturePct: 8.5 },
    ...overrides,
  });
}

test("two lots with the same inputs do not share a job", () => {
  const first = identityFor({ lotId: lotA });
  const second = identityFor({ lotId: lotB });
  assert.equal(first.ok && second.ok, true);
  assert.notEqual(first.identity.fingerprint, second.identity.fingerprint);
  assert.notEqual(first.identity.keyHash, second.identity.keyHash);
  assert.notEqual(first.identity.jobId, second.identity.jobId);
});

test("the same lot and inputs give the same identity, and no lot differs from any lot", () => {
  assert.deepEqual(identityFor({ lotId: lotA }), identityFor({ lotId: lotA }));
  assert.notEqual(identityFor({ lotId: lotA }).identity.fingerprint, identityFor().identity.fingerprint);
});

test("one client key reused for a second lot conflicts instead of replaying the first lot's job", () => {
  const first = identityFor({ lotId: lotA, idempotencyKey: "client-key-lot-0001" });
  const second = identityFor({ lotId: lotB, idempotencyKey: "client-key-lot-0001" });
  assert.equal(first.identity.keyHash, second.identity.keyHash);
  assert.notEqual(first.identity.fingerprint, second.identity.fingerprint);
});

test("keys move to the v3 prefix so a persisted v2 claim cannot meet a v3 fingerprint", () => {
  const withClientKey = identityFor({ idempotencyKey: "client-key-lot-0001" });
  assert.equal(withClientKey.identity.keyHash,
    createHash("sha256").update("ustaad-jobs:v3:client:client-key-lot-0001").digest("hex"));
  const derived = identityFor();
  assert.equal(derived.identity.keyHash,
    createHash("sha256").update(`ustaad-jobs:v3:request:${derived.identity.fingerprint}`).digest("hex"));
});

test("a lot ID that is not a string, or is malformed, is rejected", () => {
  for (const lotId of [42, "", "not a lot", "LOT-HACK-" + "x".repeat(200), {}, null]) {
    const result = identityFor({ lotId });
    assert.equal(result.ok, false, String(lotId));
    assert.equal(result.error.code, "VALIDATION_ERROR");
  }
});
