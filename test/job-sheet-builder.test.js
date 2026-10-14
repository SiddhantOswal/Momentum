import assert from "node:assert/strict";
import test from "node:test";
import { buildDraftJobSheet } from "../src/job-sheet-builder.js";
import { jobSheetFixture } from "./fixtures/job-sheet.js";

const optimization = {
  baseline: jobSheetFixture.baseline,
  best: jobSheetFixture.recommended,
  changes: jobSheetFixture.changes,
  savings: jobSheetFixture.savings,
};

function input(overrides = {}) {
  return {
    jobId: "JOB-SYNTHETIC-001",
    plantId: "PLANT-SYNTHETIC-001",
    order: jobSheetFixture.order,
    conditions: jobSheetFixture.conditions,
    optimization,
    explanation: "Synthetic fixture explanation; not a production recommendation.",
    ...overrides,
  };
}

test("builder assembles a validated DRAFT from explicit workflow outputs", () => {
  const result = buildDraftJobSheet(input());

  assert.equal(result.ok, true);
  assert.equal(result.jobSheet.jobId, "JOB-SYNTHETIC-001");
  assert.equal(result.jobSheet.plantId, "PLANT-SYNTHETIC-001");
  assert.deepEqual(result.jobSheet.baseline, optimization.baseline);
  assert.deepEqual(result.jobSheet.recommended, optimization.best);
  assert.deepEqual(result.jobSheet.changes, optimization.changes);
  assert.deepEqual(result.jobSheet.savings, optimization.savings);
  assert.equal(result.jobSheet.status, "DRAFT");
});

test("builder preserves the selected PO source line as JobSheet provenance", () => {
  const result = buildDraftJobSheet(input({
    order: {
      ...jobSheetFixture.order,
      purchaseOrderLineIndex: 2,
      purchaseOrderSourcePage: 3,
    },
  }));

  assert.equal(result.ok, true);
  assert.equal(result.jobSheet.order.purchaseOrderLineIndex, 2);
  assert.equal(result.jobSheet.order.purchaseOrderSourcePage, 3);
});

test("builder preserves explicit evidence and does not create evidence when omitted", () => {
  const evidence = [{
    lotId: "LOT-SYNTHETIC-001",
    orderId: "PO-SYNTHETIC-001",
    runDate: "2026-10-11",
    primaryDefect: "WARP",
    ratesPct: jobSheetFixture.baseline.risk.ratesPct,
    levers: jobSheetFixture.baseline.levers,
  }];

  assert.deepEqual(buildDraftJobSheet(input({ evidence })).jobSheet.evidence, evidence);
  assert.equal("evidence" in buildDraftJobSheet(input()).jobSheet, false);
});

test("builder rejects missing explanation and malformed upstream outputs with field paths", () => {
  const result = buildDraftJobSheet(input({
    explanation: "  ",
    conditions: { ...jobSheetFixture.conditions, ambientRhPct: 101 },
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.ok(result.error.issues.some((issue) => issue.field === "explanation"));
  assert.ok(result.error.issues.some((issue) => issue.field === "conditions.ambientRhPct"));
});

test("builder does not silently omit malformed evidence or accept more than the contract limit", () => {
  const malformed = buildDraftJobSheet(input({ evidence: [{ lotId: "incomplete" }] }));
  assert.equal(malformed.ok, false);
  assert.ok(malformed.error.issues.some((issue) => issue.field.startsWith("evidence.0.")));

  const tooMany = Array.from({ length: 6 }, (_, index) => ({
    lotId: `LOT-SYNTHETIC-${index}`,
    orderId: `PO-SYNTHETIC-${index}`,
    runDate: "2026-10-11",
    primaryDefect: "WARP",
    ratesPct: jobSheetFixture.baseline.risk.ratesPct,
    levers: jobSheetFixture.baseline.levers,
  }));
  const excessive = buildDraftJobSheet(input({ evidence: tooMany }));
  assert.equal(excessive.ok, false);
  assert.ok(excessive.error.issues.some((issue) => issue.field === "evidence"));
});
