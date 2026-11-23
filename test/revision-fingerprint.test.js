import assert from "node:assert/strict";
import test from "node:test";
import { revisionFingerprint } from "../src/revision-fingerprint.js";
import { jobSheetFixture } from "./fixtures/job-sheet.js";

const lotId = `LOT-HACK-${"a".repeat(32)}-${"b".repeat(12)}`;
const conditions = [{
  field: "paperMoisturePct", value: 8.5, unit: "%", provenance: "operator_entry", sourceDetail: "typed",
  label: "Entered by operator", confirmed: false,
}];
const input = { jobSheet: jobSheetFixture, lotId, number: 1, requestFingerprint: "c".repeat(64), conditions };

const withRollTemp = (profile, rollTempC) => ({ ...profile, levers: { ...profile.levers, rollTempC } });

test("the fingerprint is 64 hex digits and does not depend on key order", () => {
  const fingerprint = revisionFingerprint(input);
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  const reordered = { ...input, jobSheet: Object.fromEntries(Object.entries(jobSheetFixture).reverse()) };
  assert.equal(revisionFingerprint(reordered), fingerprint);
});

test("every bound part of the draft changes the fingerprint", () => {
  const base = revisionFingerprint(input);
  const variants = {
    jobId: { ...input, jobSheet: { ...jobSheetFixture, jobId: "JOB-TEST-43" } },
    lotId: { ...input, lotId: `LOT-HACK-${"a".repeat(32)}-${"d".repeat(12)}` },
    number: { ...input, number: 2 },
    requestFingerprint: { ...input, requestFingerprint: "e".repeat(64) },
    conditions: { ...input, conditions: [{ ...conditions[0], value: 10.8 }] },
    explanation: { ...input, jobSheet: { ...jobSheetFixture, explanation: "Changed." } },
    changes: { ...input, jobSheet: { ...jobSheetFixture, changes: [] } },
    baseline: { ...input, jobSheet: { ...jobSheetFixture, baseline: withRollTemp(jobSheetFixture.baseline, 170) } },
    recommended: { ...input, jobSheet: { ...jobSheetFixture, recommended: withRollTemp(jobSheetFixture.recommended, 171) } },
  };
  for (const [name, variant] of Object.entries(variants)) {
    assert.notEqual(revisionFingerprint(variant), base, name);
  }
});

test("a status change on the stored sheet does not change the fingerprint", () => {
  assert.equal(
    revisionFingerprint({ ...input, jobSheet: { ...jobSheetFixture, status: "APPROVED" } }),
    revisionFingerprint(input),
  );
});
