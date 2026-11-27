const REQUIRED_DEFECTS = Object.freeze(["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"]);
export const REQUIRED_MODEL_R2 = Object.freeze({
  WARP: 0.6,
  DELAM: 0.6,
  STRENGTH: 0.45,
  PRINT: 0.6,
  CRACK: 0.30,
});

// Owner D4 decision (16 Oct 2026): the internal-split sample counts were lost when
// BigQuery deleted the temporary split tables. An explicit, complete owner decision
// may stand in for those counts only; it never relaxes thresholds or version links.
const OWNER_DECISION = "ACCEPT_UNRECOVERABLE_INTERNAL_SPLIT_COUNT";
export function hasOwnerCountDecision(record) {
  const decision = record?.ownerDecision;
  const holdout = decision?.supplementaryEvaluation;
  const coOwner = decision?.coOwnerReview;
  const text = (value) => typeof value === "string" && value.trim() !== "";
  return decision?.decision === OWNER_DECISION &&
    coOwner?.decision === "APPROVE_SUPERVISED_PROTOTYPE_EXCEPTION" && text(coOwner.reviewer) && text(coOwner.reference) &&
    text(coOwner.approvedAt) && Number.isFinite(Date.parse(coOwner.approvedAt)) && Date.parse(coOwner.approvedAt) <= Date.now() &&
    text(decision.owner) && text(decision.reference) &&
    text(decision.decidedAt) && !Number.isNaN(Date.parse(decision.decidedAt)) &&
    text(holdout?.splitId) && Number.isInteger(holdout?.sampleCount) && holdout.sampleCount > 0 &&
    REQUIRED_DEFECTS.every((defect) => Number.isFinite(holdout?.r2?.[defect]));
}
const usesOwnerCountDecision = (record, model) =>
  model?.sampleCount === null && model?.sampleCountStatus === "NOT_RECOVERABLE" && hasOwnerCountDecision(record);

// Owner D4 decision (20 Nov 2026): a model set may instead be accepted on an exactly counted
// out-of-time holdout. Every model must beat the model it replaces on the same rows and beat
// the mean (R2 > 0). The internal-split thresholds above stay as reported reference values.
export const HOLDOUT_BASIS = "OUT_OF_TIME_HOLDOUT_IMPROVEMENT";
const HOLDOUT_DECISION = "ACCEPT_OUT_OF_TIME_HOLDOUT_IMPROVEMENT";
const text = (value) => typeof value === "string" && value.trim() !== "";
function hasHoldoutDecision(record) {
  const decision = record?.ownerDecision;
  return decision?.decision === HOLDOUT_DECISION && text(decision.owner) && text(decision.reference) &&
    text(decision.decidedAt) && Number.isFinite(Date.parse(decision.decidedAt)) && Date.parse(decision.decidedAt) <= Date.now() &&
    text(record?.holdout?.splitId) && Number.isInteger(record?.holdout?.sampleCount) && record.holdout.sampleCount > 0;
}
const holdoutModelOk = (record, defect, model) =>
  model?.resource === `prepagent.m2_${defect.toLowerCase()}` &&
  model?.sampleCount === record.holdout.sampleCount &&
  Number.isFinite(model?.r2) && model.r2 > 0 &&
  text(model?.replaces?.resource) && model.replaces.resource !== model.resource &&
  Number.isFinite(model?.replaces?.r2) && model.r2 > model.replaces.r2;

export function isModelSetAccepted(record) {
  if (record?.basis === HOLDOUT_BASIS) return isHoldoutSetAccepted(record);
  if (!record || record.status !== "accepted" ||
      typeof record.evaluationId !== "string" || record.evaluationId.trim() === "" ||
      typeof record.evaluatedAt !== "string" || Number.isNaN(Date.parse(record.evaluatedAt)) ||
      typeof record.splitId !== "string" || record.splitId.trim() === "" ||
      typeof record.dataset !== "string" || record.dataset.trim() === "" ||
      record.linkedToCurrentResourceVersions !== true ||
      !record.currentModelVersions || typeof record.currentModelVersions !== "object" ||
      record.featureImportanceReviewed !== true || !Array.isArray(record.models) ||
      record.models.length !== REQUIRED_DEFECTS.length) {
    return false;
  }

  const byDefect = new Map(record.models.map((model) => [model?.defect, model]));
  return byDefect.size === REQUIRED_DEFECTS.length && REQUIRED_DEFECTS.every((defect) => {
    const model = byDefect.get(defect);
    const expectedResource = `prepagent.m_${defect.toLowerCase()}`;
    return model?.resource === expectedResource &&
      typeof model?.modelVersion === "string" && model.modelVersion.trim() !== "" &&
      record.currentModelVersions[defect] === model.modelVersion &&
      Number.isFinite(model?.r2) && model.r2 >= REQUIRED_MODEL_R2[defect] &&
      (Number.isInteger(model?.sampleCount) && model.sampleCount > 0 || usesOwnerCountDecision(record, model));
  });
}

function isHoldoutSetAccepted(record) {
  if (record.status !== "accepted" || !text(record.evaluationId) ||
      !text(record.evaluatedAt) || Number.isNaN(Date.parse(record.evaluatedAt)) ||
      !text(record.splitId) || record.splitId !== record.holdout?.splitId || !text(record.dataset) ||
      record.linkedToCurrentResourceVersions !== true ||
      !record.currentModelVersions || typeof record.currentModelVersions !== "object" ||
      record.featureImportanceReviewed !== true || !Array.isArray(record.models) ||
      record.models.length !== REQUIRED_DEFECTS.length || !hasHoldoutDecision(record)) {
    return false;
  }
  const byDefect = new Map(record.models.map((model) => [model?.defect, model]));
  return byDefect.size === REQUIRED_DEFECTS.length && REQUIRED_DEFECTS.every((defect) => {
    const model = byDefect.get(defect);
    return holdoutModelOk(record, defect, model) && text(model.modelVersion) &&
      record.currentModelVersions[defect] === model.modelVersion;
  });
}

export function getModelAcceptanceSummary(record) {
  const accepted = isModelSetAccepted(record);
  const rawModels = accepted
    ? record.models
    : record?.recordedEvaluation?.models ?? record?.models;
  // A malformed evidence file must report blocked status, not crash status
  // reporting. This projection never changes the acceptance predicate above.
  // Project to the public response fields; config-only markers stay server-side.
  const models = Array.isArray(rawModels)
    ? rawModels.filter((model) => model !== null && typeof model === "object" && !Array.isArray(model))
      .map(({ defect, resource, r2, modelVersion, sampleCount }) => ({ defect, resource, r2, modelVersion, sampleCount }))
    : [];
  const byDefect = new Map(models.map((model) => [model?.defect, model]));
  const prototypeThresholdsMet = REQUIRED_DEFECTS.every((defect) =>
    Number.isFinite(byDefect.get(defect)?.r2) && byDefect.get(defect).r2 >= REQUIRED_MODEL_R2[defect]);
  // An owner decision accepts the set; it does not make the missing counts available.
  const completeAcceptanceEvidenceAvailable = accepted &&
    record.models.every((model) => !usesOwnerCountDecision(record, model));
  return {
    status: accepted ? "accepted" : prototypeThresholdsMet ? "prototype-thresholds-met" : "blocked",
    requiredR2: REQUIRED_MODEL_R2,
    prototypeThresholdsMet,
    completeAcceptanceEvidenceAvailable,
    evaluationId: accepted
      ? record.evaluationId
      : typeof record?.acceptanceEvidence === "string" ? record.acceptanceEvidence : null,
    evaluatedAt: accepted ? record.evaluatedAt : record?.recordedEvaluation?.asOf ?? record?.evaluatedAt ?? null,
    split: accepted ? record.splitId : record?.recordedEvaluation?.split ?? record?.splitId ?? null,
    linkedToCurrentResourceVersions: accepted || record?.recordedEvaluation?.linkedToCurrentResourceVersions === true,
    models,
    notes: Array.isArray(record?.notes) ? record.notes : [],
  };
}
