// Synthetic acceptance evidence used only by isolated adapter tests.
// It is not evidence about the deployed BigQuery ML model versions.
export const acceptedModelSetFixture = Object.freeze({
  status: "accepted",
  evaluationId: "test-evaluation-001",
  evaluatedAt: "2026-10-14T00:00:00.000Z",
  splitId: "test-held-out-split",
  dataset: "isolated-test-fixture",
  featureImportanceReviewed: true,
  models: Object.freeze([
    ["WARP", 0.61], ["DELAM", 0.67], ["STRENGTH", 0.47], ["PRINT", 0.75], ["CRACK", 0.30],
  ].map(([defect, r2]) => Object.freeze({
    defect,
    resource: `test-${defect.toLowerCase()}`,
    modelVersion: "test-version-1",
    r2,
    sampleCount: 100,
  }))),
});
