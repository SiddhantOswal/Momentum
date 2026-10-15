import assert from "node:assert/strict";
import test from "node:test";
import { RiskPredictionRequestSchema } from "../src/schemas.js";
import { toRiskPredictionPayload } from "../src/risk-ui.js";

const input = {
  order: {
    orderId: "PO-1", itemCode: "PKBX0041", customerId: "C-1", boxStyle: "RSC",
    lengthMm: 1392, widthMm: 800, heightMm: 0, ply: 5, fluteProfile: "BC",
    topLinerGsm: 180, fluteGsm: 120, innerLinerGsm: 160, linerBf: 26,
    paperType: "RECYCLED", paperSupplier: "SUP-D", inkColors: 2,
    inkCoveragePct: 70, quantity: 1300,
  },
  conditions: {
    runDate: "2026-10-12", shift: "DAY", ambientRhPct: 86,
    ambientTempC: 26, paperMoisturePct: 10.8,
  },
  levers: {
    sfSpeedMpm: 48, rollTempC: 162, gumApplication: "HIGH",
    gumViscositySec: 32, pastingPressure: "MED", dryingHours: 5,
    printSpeedSpm: 60,
  },
};

test("risk UI projects actual order and confirmed conditions onto the strict live prediction contract", () => {
  const payload = toRiskPredictionPayload({ ...input, conditionsConfirmed: true });
  assert.deepEqual(payload, {
    order: {
      itemCode: "PKBX0041", quantity: 1300,
      paperType: "RECYCLED", paperSupplier: "SUP-D",
    },
    conditions: {
      shift: "DAY", ambientRhPct: 86, ambientTempC: 26,
      paperMoisturePct: 10.8,
    },
    conditionsConfirmed: true,
    levers: input.levers,
  });
  assert.equal(RiskPredictionRequestSchema.safeParse(payload).success, true);
});

test("risk UI rejects missing workflow groups rather than creating a partial prediction", () => {
  assert.throws(() => toRiskPredictionPayload({ order: input.order }), /Order, conditions, and machine settings/);
  assert.throws(() => toRiskPredictionPayload(input), /Condition confirmation is required/);
});
