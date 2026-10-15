import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getModelAcceptanceSummary, isModelSetAccepted, REQUIRED_MODEL_R2 } from "../src/model-acceptance.js";

const recorded = JSON.parse(readFileSync(new URL("../config/model-acceptance.json", import.meta.url), "utf8"));
const featureObservation = JSON.parse(readFileSync(new URL("../config/model-feature-importance-observation.json", import.meta.url), "utf8"));

function acceptedFixture() {
  return {
    status: "accepted",
    requiredR2: REQUIRED_MODEL_R2,
    evaluationId: "GROUPED-2026-10-15-V1",
    evaluatedAt: "2026-10-15T00:00:00.000Z",
    splitId: "customer-heldout-v1",
    dataset: "test-only-evaluation-fixture",
    linkedToCurrentResourceVersions: true,
    currentModelVersions: Object.fromEntries(["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"].map((defect) => [defect, "1"])),
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

test("recorded model evaluation remains blocked despite current-version linkage and declared evaluation window", () => {
  assert.equal(isModelSetAccepted(recorded), false);
  const summary = getModelAcceptanceSummary(recorded);
  assert.equal(summary.status, "prototype-thresholds-met");
  assert.deepEqual(summary.requiredR2, REQUIRED_MODEL_R2);
  assert.equal(summary.prototypeThresholdsMet, true);
  assert.equal(summary.completeAcceptanceEvidenceAvailable, false);
  assert.equal(summary.linkedToCurrentResourceVersions, true);
  assert.deepEqual(recorded.recordedEvaluation.declaredDataWindow, {
    modelingRowsFrom: "2024-10-01",
    modelingRowsThrough: "2026-08-31",
    heldOutMonthFrom: "2026-09-01",
    heldOutMonthThrough: "2026-09-30",
  });
  assert.equal(summary.models.length, 5);
  assert.equal(summary.models.find((model) => model.defect === "STRENGTH").r2, 0.4672613);
  assert.equal(summary.models.find((model) => model.defect === "CRACK").r2, 0.3010716);
});

test("read-only feature-importance observation covers the active five model versions but does not imply acceptance", () => {
  assert.equal(featureObservation.completeAcceptance, false);
  assert.equal(featureObservation.status, "observed-for-review");
  assert.match(featureObservation.ownerReviewReference, /Om D4/);
  assert.deepEqual(featureObservation.declaredModelingWindow, {
    from: "2024-10-01",
    through: "2026-08-31",
    evaluationSplit: "random 20 percent of modeling rows",
    heldOutImpactMonth: "2026-09",
  });
  assert.equal(Object.keys(featureObservation.topFiveByGain).length, 5);
  for (const version of Object.values(featureObservation.modelVersions)) assert.equal(version, "1");
  assert.equal(recorded.status, "blocked");
  assert.equal(recorded.recordedEvaluation.models.every((model) => model.sampleCount === null), true);
  assert.equal(isModelSetAccepted(recorded), false);
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

  const unlinked = acceptedFixture();
  unlinked.linkedToCurrentResourceVersions = false;
  assert.equal(isModelSetAccepted(unlinked), false);

  const wrongCurrentVersion = acceptedFixture();
  wrongCurrentVersion.currentModelVersions.WARP = "2";
  assert.equal(isModelSetAccepted(wrongCurrentVersion), false);

  const wrongResource = acceptedFixture();
  wrongResource.models[0].resource = "prepagent.m_delam";
  assert.equal(isModelSetAccepted(wrongResource), false);

  const staleConfiguration = { ...recorded, status: "accepted", linkedToCurrentResourceVersions: false };
  assert.equal(isModelSetAccepted(staleConfiguration), false);
});

test("malformed model evidence fails closed without crashing status reporting", () => {
  for (const models of [null, {}, "unverified", [null], [undefined], [false], [[]]]) {
    for (const record of [{ status: "accepted", models }, { status: "blocked", recordedEvaluation: { models } }]) {
      assert.equal(isModelSetAccepted(record), false);
      const summary = getModelAcceptanceSummary(record);
      assert.equal(summary.status, "blocked");
      assert.equal(summary.prototypeThresholdsMet, false);
      assert.equal(summary.completeAcceptanceEvidenceAvailable, false);
      assert.deepEqual(summary.models, []);
    }
  }
});

test("accepted model summaries use accepted evidence instead of historical display metadata", () => {
  for (const models of [{}, [null], [], [{ defect: "WARP", r2: 0 }]]) {
    const record = { ...acceptedFixture(), recordedEvaluation: { models, asOf: "2020-01-01", split: "historical-display-only" } };
    const summary = getModelAcceptanceSummary(record);
    assert.equal(summary.status, "accepted");
    assert.equal(summary.prototypeThresholdsMet, true);
    assert.equal(summary.completeAcceptanceEvidenceAvailable, true);
    assert.deepEqual(summary.models, record.models);
    assert.equal(summary.evaluatedAt, record.evaluatedAt);
    assert.equal(summary.split, record.splitId);
  }
});
