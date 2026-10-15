import { createHash } from "node:crypto";
import { isModelSetAccepted, REQUIRED_MODEL_R2 } from "./model-acceptance.js";

export const evidenceDigest = (value) => createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
const text = (v) => typeof v === "string" && v.trim().length > 0;
const date = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const timestamp = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
const hash = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const resource = (m) => `${m?.modelReference?.datasetId}.${m?.modelReference?.modelId}`;
const latest = (m) => Array.isArray(m?.trainingRuns) ? m.trainingRuns.at(-1) : undefined;
const tableId = (t) => t && `${t.projectId}.${t.datasetId}.${t.tableId}`;

/** Offline consistency validation only. It cannot authenticate an owner or
 * prove that supplied artifacts were genuinely retrieved from Google Cloud.
 * A trusted operator must compare their origin and refresh metadata before use.
 * Never installs configuration, invokes a model, or changes an acceptance gate. */
export function validateModelEvidenceBundle(bundle, currentModels, { preparedQueries = {}, now = Date.now() } = {}) {
  const issues = [];
  const require = (condition, field, message, code = "EVIDENCE_INVALID_OR_MISSING") => { if (!condition) issues.push({ field, code, message }); };
  const defects = Object.keys(REQUIRED_MODEL_R2);
  require(bundle?.schemaVersion === 1, "schemaVersion", "Evidence bundle version1 required.");
  require(["HISTORICAL", "NEW_EVALUATION"].includes(bundle?.evidenceKind), "evidenceKind", "Declare historical or explicitly new evidence.");
  require(text(bundle?.evaluationId), "evaluationId", "Stable evaluation/run identifier required.");
  require(timestamp(bundle?.evaluatedAt) && Date.parse(bundle.evaluatedAt) <= now, "evaluatedAt", "Actual non-future evaluation timestamp required.");
  require(text(bundle?.splitId), "splitId", "Explicit evaluation membership definition required.");
  const source = bundle?.source;
  require(text(source?.dataset) && text(source?.identity), "source", "Exact source dataset and snapshot/query identity required.");
  require(date(source?.from) && date(source?.through) && source.from <= source.through, "source.window", "Verified inclusive source date window required.");
  require(text(source?.query) && hash(source?.querySha256) && source.querySha256 === createHash("sha256").update(source?.query ?? "").digest("hex"), "source.query", "Source query and matching SHA256 required.");
  require(Array.isArray(source?.rows) && source.rows.length > 0, "source.rows", "Actual source membership and row fingerprints required.");
  require(["lot-id", "feature-row"].includes(source?.rowIdentity), "source.rowIdentity", "Declare actual lot IDs or frozen feature-row identities; never invent discarded identifiers.");
  const rows = new Map();
  for (const [i, row] of (Array.isArray(source?.rows) ? source.rows : []).entries()) {
    const identityValid = source.rowIdentity === "lot-id"
      ? row?.values?.lot_id === row?.id && row?.values?.run_date === row?.runDate && date(row?.runDate) && row.runDate >= source.from && row.runDate <= source.through
      : bundle?.evidenceKind === "HISTORICAL" && (row?.runDate === undefined || date(row.runDate) && row.runDate >= source.from && row.runDate <= source.through);
    require(text(row?.id) && !rows.has(row.id) && hash(row?.rowSha256) && row?.values !== null &&
      typeof row?.values === "object" && !Array.isArray(row.values) && row.rowSha256 === evidenceDigest(row.values) && identityValid,
      `source.rows.${i}`, "Unique captured member identity, actual archived row values and matching hash required; lot-ID rows also require actual in-window dates.");
    if (text(row?.id)) rows.set(row.id, row);
  }
  require(Array.isArray(currentModels) && currentModels.length === 5, "currentModels", "Five independently captured current model metadata records required.");
  const current = new Map((Array.isArray(currentModels) ? currentModels : []).map(m => [resource(m), m]));
  require(current.size === 5, "currentModels", "Duplicate current model resources rejected.");
  require(Array.isArray(bundle?.models) && bundle.models.length === 5, "models", "Exactly five evaluated models required.");
  const evaluated = new Map((Array.isArray(bundle?.models) ? bundle.models : []).map(m => [m?.defect, m]));
  require(evaluated.size === 5, "models", "Duplicate evaluated model identities rejected.");
  const models = [];
  for (const defect of defects) {
    const p = `models.${defect}`, m = evaluated.get(defect), expected = `prepagent.m_${defect.toLowerCase()}`;
    const observed = current.get(expected), run = latest(observed);
    require(m?.resource === expected && observed?.modelReference?.projectId === "prepagent-hack", p, "Exact approved project/model resource required.");
    require(text(m?.modelVersion) && m.modelVersion === String(run?.vertexAiModelVersion) && text(m?.modelEtag) && m.modelEtag === observed?.etag,
      `${p}.version`, "Evidence must match independently observed current version and etag.");
    const members = m?.members;
    require(Array.isArray(members) && members.length > 0 && new Set(members).size === members.length && members.every(id => text(id) && rows.has(id)),
      `${p}.members`, "Actual unique evaluation members must belong to the captured source.");
    require(Number.isSafeInteger(m?.sampleCount) && m.sampleCount > 0 && Array.isArray(members) && m.sampleCount === members.length,
      `${p}.sampleCount`, "Actual sample count must equal evaluation membership, never an inferred split percentage.");
    const features = observed?.featureColumns;
    const labels = run?.trainingOptions?.inputLabelColumns;
    require(Array.isArray(features) && features.length > 0 && Array.isArray(labels) && labels.length === 1 &&
      Array.isArray(members) && members.every(id => {
        const values = rows.get(id)?.values;
        const label = values?.[labels[0]];
        return values && features.every(f => text(f?.name) && Object.hasOwn(values, f.name)) &&
          (typeof label === "number" || typeof label === "string" && label.trim() !== "") && Number.isFinite(Number(label));
      }), `${p}.inputRows`, "Every evaluated row must contain the actual saved model features and finite training label.");
    const job = m?.evaluationJob, query = job?.configuration?.query?.query;
    require(job?.jobReference?.projectId === "prepagent-hack" && job?.jobReference?.location === "asia-south1" && text(job?.jobReference?.jobId) &&
      job?.status?.state === "DONE" && !job.status.errorResult && !job.status.errors?.length && timestamp(m?.evaluatedAt) && Date.parse(m.evaluatedAt) <= now,
      `${p}.evaluationJob`, "Successful real job identity, location and evaluation timestamp required.", "EVALUATION_JOB_UNVERIFIED");
    const started = Number(job?.statistics?.startTime), ended = Number(job?.statistics?.endTime), created = Number(observed?.creationTime);
    require(Number.isFinite(started) && Number.isFinite(ended) && Number.isFinite(created) && ended >= started && ended >= created &&
      Date.parse(m?.evaluatedAt) === ended, `${p}.evaluationTime`, "Evaluation completion must match actual job end time and cannot predate the current model.");
    require(text(query) && hash(m?.querySha256) && m.querySha256 === createHash("sha256").update(query ?? "").digest("hex") && query.includes(expected),
      `${p}.query`, "Exact evaluated query, model reference and matching hash required.");
    let actualR2;
    if (bundle?.evidenceKind === "HISTORICAL") {
      const saved = m?.evaluatedModel, savedRun = latest(saved);
      require(resource(saved) === expected && saved?.etag === observed?.etag && String(savedRun?.vertexAiModelVersion) === m?.modelVersion,
        `${p}.historicalModel`, "Saved evaluated model metadata must match the current immutable model observation.");
      require(text(m?.evaluationDataset) && m.evaluationDataset === tableId(savedRun?.dataSplitResult?.evaluationTable),
        `${p}.evaluationDataset`, "Historical membership must identify the actual saved evaluation split table.");
      require(/CREATE\s+(?:OR\s+REPLACE\s+)?MODEL/i.test(query ?? ""), `${p}.queryKind`, "Historical training/evaluation job SQL required.");
      actualR2 = savedRun?.evaluationMetrics?.regressionMetrics?.rSquared;
      require(actualR2 === run?.evaluationMetrics?.regressionMetrics?.rSquared &&
        evidenceDigest(savedRun?.dataSplitResult ?? null) === evidenceDigest(run?.dataSplitResult ?? null),
        `${p}.savedMetrics`, "Historical metrics and split reference must match independently captured current metadata.");
    } else {
      require(source?.rowIdentity === "lot-id", `${p}.rowIdentity`, "Prepared new evaluation uses actual lot IDs and dates.");
      require(text(preparedQueries[expected]) && query === preparedQueries[expected] && source?.query === preparedQueries.source,
        `${p}.approvedQuery`, "New evaluation SQL and source projection must exactly match the reviewed prepared files.");
      require(/^\s*(?:--[^\n]*\n\s*)*SELECT\b/i.test(query ?? "") && /ML\.EVALUATE\s*\(/i.test(query ?? "") &&
        /FOR\s+SYSTEM_TIME\s+AS\s+OF\s+@source_as_of/i.test(query ?? ""), `${p}.queryKind`, "New explicit-input evaluation must use the reviewed time-travel population.");
      const parameters = job?.configuration?.query?.queryParameters ?? [];
      const asOf = parameters.find(v => v.name === "source_as_of")?.parameterValue?.value;
      require(timestamp(source?.asOf) && timestamp(asOf) && Date.parse(asOf) === Date.parse(source?.asOf), `${p}.sourceTimestamp`, "Same frozen source timestamp required for every evaluation.");
      require(Array.isArray(members) && members.length === rows.size, `${p}.population`, "New evaluation must cover every captured source member; no silent subset.");
      const result = m?.evaluationResult, fields = result?.schema?.fields ?? [];
      const index = fields.findIndex(v => v.name === "r2_score");
      const raw = result?.rows?.[0]?.f?.[index]?.v;
      actualR2 = index >= 0 && result?.rows?.length === 1 && (typeof raw === "number" || typeof raw === "string" && raw.trim()) ? Number(raw) : NaN;
    }
    require(Number.isFinite(m?.r2) && Number.isFinite(actualR2) && m.r2 === actualR2,
      `${p}.r2`, "Actual metric is missing or differs from the saved result.", "EVALUATION_METRIC_UNVERIFIED");
    if (Number.isFinite(actualR2)) require(actualR2 >= REQUIRED_MODEL_R2[defect],
      `${p}.r2`, "Observed metric is below the unchanged prototype threshold.", "MODEL_THRESHOLD_NOT_MET");
    const review = m?.featureReview, featureEvidence = run?.modelLevelGlobalExplanation;
    require(Array.isArray(featureEvidence?.explanations) && featureEvidence.explanations.length > 0 &&
      review?.decision === "APPROVE_PROTOTYPE" && text(review?.reviewer) && timestamp(review?.reviewedAt) &&
      Date.parse(review.reviewedAt) >= Date.parse(m?.evaluatedAt) && Date.parse(review.reviewedAt) <= now && review?.modelEtag === observed?.etag &&
      review?.featureEvidenceSha256 === evidenceDigest(featureEvidence) && review?.membershipSha256 === evidenceDigest(members),
      `${p}.featureReview`, "Owner review must bind the exact current feature evidence and evaluated membership.");
    if (m) models.push({ defect, resource: expected, modelVersion: m.modelVersion, modelEtag: m.modelEtag, r2: m.r2, sampleCount: m.sampleCount });
  }
  const candidate = {
    status: "accepted", evaluationId: bundle?.evaluationId, evaluatedAt: bundle?.evaluatedAt, splitId: bundle?.splitId,
    dataset: source?.dataset, linkedToCurrentResourceVersions: true,
    currentModelVersions: Object.fromEntries(models.map(m => [m.defect, m.modelVersion])),
    featureImportanceReviewed: true, models, requiredR2: REQUIRED_MODEL_R2,
    evidenceKind: bundle?.evidenceKind, evidenceBundleSha256: evidenceDigest(bundle),
    notes: ["Offline-consistent owner-provided evidence; origin and fresh cloud metadata require trusted operator verification before explicit installation."],
  };
  if (issues.length === 0 && !isModelSetAccepted(candidate)) issues.push({ field: "candidate", message: "Existing application acceptance contract failed." });
  return { ok: issues.length === 0, status: issues.length ? "BLOCKED" : "CONSISTENT_NOT_INSTALLED", issues,
    ...(issues.length ? {} : { acceptanceCandidate: candidate }),
    boundary: "Offline artifact consistency is not cloud authenticity verification or automatic acceptance. Active configuration was not changed." };
}
