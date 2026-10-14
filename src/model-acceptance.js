const REQUIRED_DEFECTS = Object.freeze(["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"]);
export const REQUIRED_MODEL_R2 = Object.freeze({
  WARP: 0.6,
  DELAM: 0.6,
  STRENGTH: 0.45,
  PRINT: 0.6,
  CRACK: 0.30,
});

export function isModelSetAccepted(record) {
  if (!record || record.status !== "accepted" ||
      typeof record.evaluationId !== "string" || record.evaluationId.trim() === "" ||
      typeof record.evaluatedAt !== "string" || Number.isNaN(Date.parse(record.evaluatedAt)) ||
      typeof record.splitId !== "string" || record.splitId.trim() === "" ||
      typeof record.dataset !== "string" || record.dataset.trim() === "" ||
      record.featureImportanceReviewed !== true || !Array.isArray(record.models) ||
      record.models.length !== REQUIRED_DEFECTS.length) {
    return false;
  }

  const byDefect = new Map(record.models.map((model) => [model?.defect, model]));
  return byDefect.size === REQUIRED_DEFECTS.length && REQUIRED_DEFECTS.every((defect) => {
    const model = byDefect.get(defect);
    return typeof model?.resource === "string" && model.resource.trim() !== "" &&
      typeof model?.modelVersion === "string" && model.modelVersion.trim() !== "" &&
      Number.isFinite(model?.r2) && model.r2 >= REQUIRED_MODEL_R2[defect] &&
      Number.isInteger(model?.sampleCount) && model.sampleCount > 0;
  });
}

export function getModelAcceptanceSummary(record) {
  const accepted = isModelSetAccepted(record);
  const models = record?.recordedEvaluation?.models ?? record?.models ?? [];
  const byDefect = new Map(models.map((model) => [model?.defect, model]));
  const prototypeThresholdsMet = REQUIRED_DEFECTS.every((defect) =>
    Number.isFinite(byDefect.get(defect)?.r2) && byDefect.get(defect).r2 >= REQUIRED_MODEL_R2[defect]);
  const completeAcceptanceEvidenceAvailable = accepted;
  return {
    status: accepted ? "accepted" : prototypeThresholdsMet ? "prototype-thresholds-met" : "blocked",
    requiredR2: REQUIRED_MODEL_R2,
    prototypeThresholdsMet,
    completeAcceptanceEvidenceAvailable,
    evaluationId: accepted
      ? record.evaluationId
      : typeof record?.acceptanceEvidence === "string" ? record.acceptanceEvidence : null,
    evaluatedAt: record?.recordedEvaluation?.asOf ?? record?.evaluatedAt ?? null,
    split: record?.recordedEvaluation?.split ?? record?.splitId ?? null,
    linkedToCurrentResourceVersions: accepted || record?.recordedEvaluation?.linkedToCurrentResourceVersions === true,
    models,
    notes: Array.isArray(record?.notes) ? record.notes : [],
  };
}
