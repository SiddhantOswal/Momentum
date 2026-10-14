import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getModelAcceptanceSummary, isModelSetAccepted, REQUIRED_MODEL_R2 } from "../src/model-acceptance.js";

const recorded = JSON.parse(readFileSync(new URL("../config/model-acceptance.json", import.meta.url), "utf8"));

function acceptedFixture() {
  return {
    status: "accepted",
    requiredR2: REQUIRED_MODEL_R2,
    evaluationId: "GROUPED-2026-10-15-V1",
    evaluatedAt: "2026-10-15T00:00:00.000Z",
    splitId: "customer-heldout-v1",
    dataset: "test-only-evaluation-fixture",
    featureImportanceReviewed: true,
    models: ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"].map((defect) => ({
      defect,
      resource: `prepagent.m_${defect.toLowerCase()}`,
      modelVersion: "1",
      r2: REQUIRED_MODEL_R2[defect],
      sampleCount: 100,
    })),
  };
}

test("recorded model evaluation remains blocked and reports all five historical results without version linkage", () => {
  assert.equal(isModelSetAccepted(recorded), false);
  const summary = getModelAcceptanceSummary(recorded);
  assert.equal(summary.status, "prototype-thresholds-met");
  assert.deepEqual(summary.requiredR2, REQUIRED_MODEL_R2);
  assert.equal(summary.prototypeThresholdsMet, true);
  assert.equal(summary.completeAcceptanceEvidenceAvailable, false);
  assert.equal(summary.linkedToCurrentResourceVersions, false);
  assert.equal(summary.models.length, 5);
  assert.equal(summary.models.find((model) => model.defect === "STRENGTH").r2, 0.4672613);
  assert.equal(summary.models.find((model) => model.defect === "CRACK").r2, 0.3010716);
});

test("model set acceptance requires five version-linked results at each prototype threshold and reviewed feature importance", () => {
  const accepted = acceptedFixture();
  assert.equal(isModelSetAccepted(accepted), true);
  assert.equal(getModelAcceptanceSummary(accepted).evaluationId, accepted.evaluationId);
  assert.equal(getModelAcceptanceSummary(accepted).status, "accepted");

  const lowScore = acceptedFixture();
  lowScore.models[2].r2 = 0.449999;
  assert.equal(isModelSetAccepted(lowScore), false);

  const missingVersion = acceptedFixture();
  missingVersion.models[0].modelVersion = "";
  assert.equal(isModelSetAccepted(missingVersion), false);

  const missingSampleCount = acceptedFixture();
  missingSampleCount.models[0].sampleCount = null;
  assert.equal(isModelSetAccepted(missingSampleCount), false);

  const unreviewedImportance = acceptedFixture();
  unreviewedImportance.featureImportanceReviewed = false;
  assert.equal(isModelSetAccepted(unreviewedImportance), false);
});
