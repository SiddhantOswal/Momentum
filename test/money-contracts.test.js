import assert from "node:assert/strict";
import test from "node:test";
import { getDisplayableProductionAmounts } from "../src/money-contracts.js";
import { jobSheetFixture } from "./fixtures/job-sheet.js";

test("display amount selection follows risk, optimization, and JobSheet contracts without mutation", () => {
  const risk = jobSheetFixture.recommended.risk;
  const riskJson = JSON.stringify(risk);
  assert.deepEqual(getDisplayableProductionAmounts(risk), [{
    path: "scrapCost",
    amount: risk.scrapCost,
    currency: risk.currency,
  }]);
  assert.equal(JSON.stringify(risk), riskJson);

  const optimization = {
    baseline: jobSheetFixture.baseline,
    best: jobSheetFixture.recommended,
    changes: jobSheetFixture.changes,
    savings: jobSheetFixture.savings,
  };
  assert.deepEqual(
    getDisplayableProductionAmounts(optimization).map(({ path }) => path),
    ["baseline.risk.scrapCost", "best.risk.scrapCost", "savings.inr"]
  );
  assert.deepEqual(
    getDisplayableProductionAmounts(jobSheetFixture).map(({ path }) => path),
    ["baseline.risk.scrapCost", "recommended.risk.scrapCost", "savings.inr"]
  );
});

test("unknown or invalid result shapes are not treated as production money contracts", () => {
  assert.deepEqual(getDisplayableProductionAmounts({
    scrapCost: 100,
    currency: "INR",
  }), []);
  assert.deepEqual(getDisplayableProductionAmounts({
    ...jobSheetFixture.recommended.risk,
    scrapCost: Number.NaN,
  }), []);
});
