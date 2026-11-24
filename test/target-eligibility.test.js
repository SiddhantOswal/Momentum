import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isModelSetAccepted } from "../src/model-acceptance.js";
import { countedDefects, RiskResultSchema, shownDefects } from "../src/schemas.js";
import { optimizerTargetsBqFlag, optimizerTargetsParameter, readTargetUse } from "../src/target-eligibility.js";

const active = JSON.parse(readFileSync(new URL("../config/model-acceptance.json", import.meta.url), "utf8"));
const DEFECTS = ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"];

test("the active config gives crack the advisory class and the other four the optimizer class", () => {
  const targetUse = readTargetUse(active);
  assert.ok(targetUse, "every target needs a use class and a reason");
  assert.deepEqual(Object.fromEntries(DEFECTS.map((defect) => [defect, targetUse[defect].useClass])), {
    WARP: "optimizer", DELAM: "optimizer", STRENGTH: "optimizer", PRINT: "optimizer", CRACK: "advisory",
  });
  assert.match(targetUse.CRACK.reason, /too weak to choose settings/);
  for (const defect of DEFECTS) {
    const model = active.models.find((entry) => entry.defect === defect);
    // One plain phrasing for every target; it names the lots as modelled, not measured.
    assert.match(targetUse[defect].reason,
      new RegExp(`^Model fit on ${active.holdout.sampleCount} modelled September 2026 lots: ${model.r2.toFixed(2)} \\(R²\\)`),
      `${defect} reason cites its holdout fit`);
    assert.doesNotMatch(targetUse[defect].reason, /\bholdout\b|\bR2\b|accura/i);
  }
});

test("the acceptance record is still accepted with the use-class field", () => {
  assert.equal(isModelSetAccepted(active), true);
  const { targetUse: _removed, ...withoutTargetUse } = active;
  assert.equal(isModelSetAccepted(withoutTargetUse), true, "use classes add a rule beside acceptance, not inside it");
});

test("a missing, unknown or reasonless use class is refused", () => {
  const variants = {
    missingMap: (r) => { delete r.targetUse; },
    missingTarget: (r) => { delete r.targetUse.PRINT; },
    unknownClass: (r) => { r.targetUse.CRACK.useClass = "maybe"; },
    emptyReason: (r) => { r.targetUse.WARP.reason = " "; },
    extraTarget: (r) => { r.targetUse.SMELL = { useClass: "optimizer", reason: "x" }; },
    extraField: (r) => { r.targetUse.WARP.weight = 2; },
    noOptimizer: (r) => { for (const defect of DEFECTS) r.targetUse[defect].useClass = "advisory"; },
  };
  for (const [name, mutate] of Object.entries(variants)) {
    const record = structuredClone(active);
    mutate(record);
    assert.equal(readTargetUse(record), null, name);
  }
});

test("only optimizer targets are bound as the optimizer target set", () => {
  const targetUse = readTargetUse(active);
  assert.deepEqual(optimizerTargetsParameter(targetUse), {
    type: "ARRAY<STRING>",
    value: ["WARP", "DELAM", "STRENGTH", "PRINT"],
  });
  assert.equal(
    optimizerTargetsBqFlag(targetUse),
    '--parameter=optimizer_targets:ARRAY<STRING>:["WARP","DELAM","STRENGTH","PRINT"]',
  );
  assert.throws(() => optimizerTargetsParameter(undefined), TypeError);
  const abstaining = structuredClone(active.targetUse);
  abstaining.STRENGTH.useClass = "abstain";
  assert.deepEqual(optimizerTargetsParameter(abstaining).value, ["WARP", "DELAM", "PRINT"]);
  assert.deepEqual(shownDefects(abstaining), ["WARP", "DELAM", "PRINT", "CRACK"]);
  assert.deepEqual(countedDefects(abstaining), ["WARP", "DELAM", "PRINT"]);
});

test("a risk result follows its use classes: abstain carries no rate, the primary defect is an optimizer target", () => {
  const targetUse = structuredClone(active.targetUse);
  const risk = {
    ratesPct: { WARP: 2, DELAM: 1, STRENGTH: 1, PRINT: 1, CRACK: 3 },
    totalScrapPct: 5, totalScrapKg: 10, scrapCost: 500, currency: "INR", primaryDefect: "WARP", targetUse,
  };
  assert.equal(RiskResultSchema.safeParse(risk).success, true);
  assert.equal(RiskResultSchema.safeParse({ ...risk, primaryDefect: "CRACK" }).success, false,
    "an advisory target cannot be the primary defect");
  const { CRACK: _crack, ...withoutCrack } = risk.ratesPct;
  assert.equal(RiskResultSchema.safeParse({ ...risk, ratesPct: withoutCrack }).success, false,
    "an advisory target is still shown");

  targetUse.CRACK.useClass = "abstain";
  assert.equal(RiskResultSchema.safeParse({ ...risk, targetUse }).success, false, "an abstain target must not carry a rate");
  assert.equal(RiskResultSchema.safeParse({ ...risk, ratesPct: withoutCrack, targetUse }).success, true);

  const { targetUse: _legacy, ...legacy } = risk;
  assert.equal(RiskResultSchema.safeParse(legacy).success, true, "records stored before use classes still parse");
  assert.equal(RiskResultSchema.safeParse({ ...legacy, ratesPct: withoutCrack }).success, false,
    "without use classes all five rates are still required");
});
