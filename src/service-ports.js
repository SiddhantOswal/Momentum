import approvedPhotos from "../config/approved-photos.json" with { type: "json" };
import { createApprovedPhotoService } from "./google-cloud/approved-photo-service.js";
import vertexConfig from "../config/gcp-vertex-ai.json" with { type: "json" };
import storageConfig from "../config/gcp-storage.json" with { type: "json" };
import modelAcceptanceConfig from "../config/model-acceptance.json" with { type: "json" };
import { createCloudStorageClient } from "./google-cloud/storage-client.js";
import { createMetricQueryService } from "./arc/metrics/query.js";
import { createBigQueryReadClient } from "./google-cloud/bigquery-read-client.js";
import { createItemCatalogService } from "./google-cloud/item-catalog-service.js";
import { createCurrentConditionsService } from "./google-cloud/current-conditions-service.js";
import { createVertexGeminiClient } from "./google-cloud/vertex-gemini-client.js";
import { createPdfOrderExtractionService } from "./google-cloud/order-extraction-service.js";
import { createPurchaseOrderReviewService } from "./purchase-order-review.js";
import { createBigQueryWriteClient } from "./google-cloud/bigquery-write-client.js";
import { createJobSheetRepository } from "./google-cloud/job-sheet-repository.js";
import { createJobCardService } from "./google-cloud/job-card-service.js";
import { createFeedbackService } from "./google-cloud/feedback-service.js";
import { createLotAssociationService } from "./google-cloud/lot-association-service.js";
import { createRiskPredictionService } from "./google-cloud/risk-prediction-service.js";
import { createWeatherProviderFromEnv } from "./google-cloud/weather-service.js";
import { createConditionGuard } from "./condition-guard.js";
import { createRiskOptimizationService } from "./google-cloud/risk-optimization-service.js";
import {
  createRiskExplanationService,
  createSeenBeforeService,
  createSimilarRunsService,
} from "./google-cloud/risk-evidence-service.js";
import { createImpactSummaryService } from "./google-cloud/impact-summary-service.js";
import { readDailyGeminiCallCapConfig, withDailyGeminiCallCap } from "./daily-gemini-call-cap.js";
import { createFirestoreGeminiAttemptStore } from "./google-cloud/firestore-gemini-attempt-store.js";
import { budgetCapStore, createFirestoreBudgetStore } from "./google-cloud/firestore-budget-store.js";
import { readGeminiBudgetConfig } from "./gemini-budget-config.js";
import { createFirestoreLotStore } from "./google-cloud/firestore-lot-store.js";
import { createFirestorePoReviewStore } from "./google-cloud/firestore-po-review-store.js";
import { createFirestoreIdempotencyStore } from "./google-cloud/firestore-idempotency-store.js";
import { createDefectDiagnosisService } from "./google-cloud/defect-diagnosis-service.js";
import { mergeDraftWriteArgs } from "./job-draft-persistence.js";
import { renderJobSheetPdf } from "./job-sheet-pdf.js";
import {
  explainRisk,
  extractOrder,
  findSimilarRuns,
  generateJobSheet,
  getConditions,
  optimizeLevers,
  predictRisk,
} from "./mock-agents.js";

const requirements = {
  getApprovedPhotos: "The approved photo classification service is not enabled.",
  classifyApprovedPhoto: "Approved-photo storage and shared-metered Gemini are not enabled.",
  diagnoseDefectPhoto: "Photo diagnosis needs Cloud Storage and Gemini on Vertex AI.",
  extractOrder: "Cloud Storage and Gemini on Vertex AI are not configured.",
  extractOrderForReview: "Cloud Storage, Gemini and the item catalog are not configured.",
  confirmPurchaseOrderReview: "The current PO review and catalog item are not available.",
  currentConditions: "BigQuery sensor readings are not configured.",
  predictRisk: "The BigQuery ML models and predict query are not configured.",
  optimizeRisk: "A written owner-approved optimizer contract ID and version are required before optimization is configured.",
  findSimilarRuns: "The historical similar-run query is not configured.",
  explainRisk: "The BigQuery ML explanation query and Gemini are not configured.",
  findSeenBefore: "The historical defect-evidence query is not configured.",
  prepareJob: "Cloud Storage, Gemini, BigQuery, and the BigQuery ML models are not configured.",
  approveJob: "Job-sheet persistence and Cloud Storage card generation are not configured.",
  getJobCard: "Cloud Storage job-card files are not configured.",
  saveFeedback: "BigQuery, Cloud Storage photo uploads, and note translation are not configured.",
  getInsights: "BigQuery historical lot and feedback data are not configured.",
  getImpactSummary: "The four live Impact dashboard queries are not configured.",
  queryMetric: "The Arc metric queries are not enabled.",
  getLotOrder: "BigQuery lot-to-order association lookup is not configured.",
};

// The demo prediction job requires 73,400,320 bytes of billed query capacity.
// Keep its 80 MiB ceiling isolated from the general read client's 50 MiB cap.
const RISK_PREDICTION_MAX_BYTES_BILLED = 80 * 1024 * 1024;

// The canonical optimizer's two ASSERT jobs and SELECT are billed separately,
// 90 MiB in total for the recorded PKBX0041 run, so 80 MiB cannot cover one run.
// An invalid/unreviewed value disables only the optimizer adapter.
const OPTIMIZER_DEFAULT_MAX_BYTES_BILLED = 100 * 1024 * 1024;
export function readOptimizerQueryBudget(env = process.env) {
  const raw = env.USTAAD_OPTIMIZER_MAX_BYTES_BILLED ?? String(OPTIMIZER_DEFAULT_MAX_BYTES_BILLED);
  return [String(80 * 1024 * 1024), String(100 * 1024 * 1024)].includes(raw)
    ? Number(raw) : undefined;
}

// Configuration availability only, never proof of a verified user or cloud I/O.
export function getJobLifecycleAvailability({ availability, executionMode, supervisorConfigured, modelsAccepted, jobCreationAvailable }) {
  const authorized = executionMode === "demo" || supervisorConfigured === true;
  return {
    approveJob: Boolean(availability.approveJob && authorized && (executionMode === "demo" || modelsAccepted === true)),
    getJobCard: Boolean(availability.getJobCard && authorized),
    getStoredJobSheet: Boolean(availability.getStoredJobSheet && authorized),
    createDraftJobSheet: Boolean(availability.createDraftJobSheet && jobCreationAvailable),
    saveFeedback: Boolean(availability.saveFeedback && authorized),
  };
}

function unavailable(operation) {
  return async () => ({
    ok: false,
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: `${operation} is not configured. ${requirements[operation]}`,
    },
  });
}

export function createServicePorts(adapters = {}) {
  const availability = Object.freeze({
    getApprovedPhotos: typeof adapters.getApprovedPhotos === "function",
    classifyApprovedPhoto: typeof adapters.classifyApprovedPhoto === "function",
    diagnoseDefectPhoto: typeof adapters.diagnoseDefectPhoto === "function",
    extractOrder: typeof adapters.extractOrder === "function",
    currentConditions: typeof adapters.currentConditions === "function",
    predictRisk: typeof adapters.predictRisk === "function",
    optimizeRisk: typeof adapters.optimizeRisk === "function",
    findSimilarRuns: typeof adapters.findSimilarRuns === "function",
    explainRisk: typeof adapters.explainRisk === "function",
    findSeenBefore: typeof adapters.findSeenBefore === "function",
    prepareJob: typeof adapters.prepareJob === "function",
    approveJob: typeof adapters.approveJob === "function",
    getJobCard: typeof adapters.getJobCard === "function",
    saveFeedback: typeof adapters.saveFeedback === "function",
    getLotOrder: typeof adapters.getLotOrder === "function",
    getStoredJobSheet: typeof adapters.getStoredJobSheet === "function",
    createDraftJobSheet: typeof adapters.createDraftJobSheet === "function",
    getInsights: typeof adapters.getInsights === "function",
    getImpactSummary: typeof adapters.getImpactSummary === "function",
    queryMetric: typeof adapters.queryMetric === "function",
  });
  return Object.freeze({
    availability,
    getApprovedPhotos: adapters.getApprovedPhotos ?? unavailable("getApprovedPhotos"),
    classifyApprovedPhoto: adapters.classifyApprovedPhoto ?? unavailable("classifyApprovedPhoto"),
    diagnoseDefectPhoto: adapters.diagnoseDefectPhoto ?? unavailable("diagnoseDefectPhoto"),
    geminiUsage: adapters.geminiUsage ?? Object.freeze({ sharedCounterConfigured: false, liveConnectivityVerified: false }),
    jobIdempotency: adapters.jobIdempotency ?? Object.freeze({ durableRequested: false }),
    lotRevisions: adapters.lotRevisions ?? Object.freeze({ enabled: false, enforceGuard: false, store: undefined }),
    extractOrder: adapters.extractOrder ?? unavailable("extractOrder"),
    extractOrderForReview: adapters.extractOrderForReview ?? unavailable("extractOrderForReview"),
    confirmPurchaseOrderReview: adapters.confirmPurchaseOrderReview ?? unavailable("confirmPurchaseOrderReview"),
    currentConditions: adapters.currentConditions ?? unavailable("currentConditions"),
    predictRisk: adapters.predictRisk ?? unavailable("predictRisk"),
    optimizeRisk: adapters.optimizeRisk ?? unavailable("optimizeRisk"),
    findSimilarRuns: adapters.findSimilarRuns ?? unavailable("findSimilarRuns"),
    explainRisk: adapters.explainRisk ?? unavailable("explainRisk"),
    findSeenBefore: adapters.findSeenBefore ?? unavailable("findSeenBefore"),
    prepareJob: adapters.prepareJob ?? unavailable("prepareJob"),
    approveJob: adapters.approveJob ?? unavailable("approveJob"),
    getJobCard: adapters.getJobCard ?? unavailable("getJobCard"),
    createDraftJobSheet: adapters.createDraftJobSheet ?? unavailable("prepareJob"),
    getStoredJobSheet: adapters.getStoredJobSheet ?? unavailable("prepareJob"),
    saveFeedback: adapters.saveFeedback ?? unavailable("saveFeedback"),
    getLotOrder: adapters.getLotOrder ?? unavailable("getLotOrder"),
    getInsights: adapters.getInsights ?? unavailable("getInsights"),
    getImpactSummary: adapters.getImpactSummary ?? unavailable("getImpactSummary"),
    queryMetric: adapters.queryMetric ?? unavailable("queryMetric"),
    // Resolves humidity/temperature fallbacks and checks paper moisture against
    // the plant's recorded ranges before any prediction (src/condition-guard.js).
    conditionGuard: adapters.conditionGuard ?? createConditionGuard(),
  });
}

/**
 * Construct live extraction only when both the model manifest and an exact
 * runtime opt-in allow model calls; neither setting alone enables inference.
 */
function normalizeStoredJobSheet(jobSheet, overrides = {}) {
  const normalized = {
    jobId: jobSheet.jobId,
    createdAt: overrides.createdAt ?? jobSheet.createdAt ?? jobSheet.created_at ?? new Date().toISOString(),
    plantId: overrides.plantId ?? jobSheet.plantId ?? jobSheet.plant_id ?? "PLANT-DEMO-01",
    status: overrides.status ?? jobSheet.status ?? "DRAFT",
    order: jobSheet.order,
    conditions: jobSheet.conditions,
    baseline: jobSheet.baseline,
    recommended: jobSheet.recommended,
    changes: Array.isArray(jobSheet.changes) ? jobSheet.changes : [],
    evidence: Array.isArray(jobSheet.evidence) ? jobSheet.evidence : [],
    explanation: jobSheet.explanation,
    savings: {
      kg: Number(jobSheet.savings?.kg ?? 0),
      amount: Number(jobSheet.savings?.amount ?? jobSheet.savings?.inr ?? 0),
      currency: jobSheet.savings?.currency ?? jobSheet.baseline?.risk?.currency ?? "INR",
    },
    approvedAt: overrides.approvedAt ?? jobSheet.approvedAt ?? jobSheet.approved_at ?? null,
    cardUri: overrides.cardUri ?? jobSheet.cardUri ?? jobSheet.card_uri ?? null,
  };
  return normalized;
}

function printableJobSheetForPdf(stored) {
  const normalized = normalizeStoredJobSheet(stored);
  return {
    jobId: normalized.jobId,
    plantId: normalized.plantId,
    order: normalized.order,
    conditions: normalized.conditions,
    baseline: normalized.baseline,
    recommended: normalized.recommended,
    changes: normalized.changes,
    evidence: normalized.evidence,
    explanation: normalized.explanation,
    savings: { kg: normalized.savings.kg, inr: normalized.savings.amount },
    status: normalized.status,
  };
}

function createSyntheticDemoServicePorts() {
  const storage = new Map();
  const feedbackRecords = [];
  const review = createPurchaseOrderReviewService({
    extractOrder: async ({ operatorFields, selectedLineIndex, signal } = {}) => {
      const demo = extractOrder({
        orderId: operatorFields?.orderId,
        paperType: operatorFields?.paperType,
        paperSupplier: operatorFields?.paperSupplier,
        itemCode: "SKU-TEST-42",
        quantity: 100,
      });
      if (!demo || demo.ok !== true) return demo;
      const lines = [{
        lineIndex: selectedLineIndex ?? 0,
        sourcePage: 1,
        extractedItemCode: "SKU-TEST-42",
        quantity: 100,
        status: "MATCHED",
        catalogStatus: "MATCHED",
        candidates: ["SKU-TEST-42"],
        resolvedItemCode: "SKU-TEST-42",
        orderProfile: {
          orderId: operatorFields?.orderId ?? "PO-TEST-42",
          itemCode: "SKU-TEST-42",
          customerId: "CUSTOMER-TEST-42",
          boxStyle: "RSC",
          lengthMm: 520,
          widthMm: 360,
          heightMm: 260,
          ply: 3,
          fluteProfile: "B",
          topLinerGsm: 125,
          fluteGsm: 115,
          innerLinerGsm: 125,
          linerBf: 18,
          paperType: operatorFields?.paperType ?? "VIRGIN",
          paperSupplier: operatorFields?.paperSupplier ?? "SUPPLIER-TEST",
          inkColors: 2,
          inkCoveragePct: 40,
          quantity: 100,
        },
      }];
      return {
        ...demo,
        purchaseOrderDocument: {
          poNumber: operatorFields?.orderId ?? "PO-TEST-42",
          buyer: "CUSTOMER-TEST-42",
          deliveryDate: "11-10-2026",
        },
        documentMissingFields: [],
        lines,
        selectedLineIndex: selectedLineIndex ?? 0,
        lineSelectionRequired: false,
        missingFields: [],
        needsClarification: false,
      };
    },
    resolveOrderLine: async ({ itemCode, quantity, signal } = {}) => ({
      status: "MATCHED",
      candidates: [itemCode ?? "SKU-TEST-42"],
      resolvedItemCode: itemCode ?? "SKU-TEST-42",
      orderProfile: {
        orderId: "PO-TEST-42",
        itemCode: itemCode ?? "SKU-TEST-42",
        customerId: "CUSTOMER-TEST-42",
        boxStyle: "RSC",
        lengthMm: 520,
        widthMm: 360,
        heightMm: 260,
        ply: 3,
        fluteProfile: "B",
        topLinerGsm: 125,
        fluteGsm: 115,
        innerLinerGsm: 125,
        linerBf: 18,
        paperType: "VIRGIN",
        paperSupplier: "SUPPLIER-TEST",
        inkColors: 2,
        inkCoveragePct: 40,
        quantity: Number(quantity ?? 100),
      },
    }),
  });

  return createServicePorts({
    // Local runs only: a fixed diagnosis so the Defects screen can be exercised without Gemini.
    diagnoseDefectPhoto: async () => ({
      ok: true, source: "mock-demo", isRealModelPrediction: false, recognised: true,
      diagnosis: { label: "DELAM", severity: "MEDIUM", confidence: 0.8, visibleSigns: ["Local mock: liner lifting along one edge"] },
      photo: { uri: "memory://local-mock", contentType: "image/jpeg" }, model: "local-mock",
      diagnosedAt: new Date().toISOString(), note: "Local mock diagnosis, not a Gemini result.",
    }),
    extractOrder: async ({ operatorFields, selectedLineIndex, signal } = {}) => {
      return extractOrder({
        orderId: operatorFields?.orderId ?? "PO-TEST-42",
        itemCode: "SKU-TEST-42",
        customerId: "CUSTOMER-TEST-42",
        boxStyle: "RSC",
        lengthMm: 520,
        widthMm: 360,
        heightMm: 260,
        ply: 3,
        fluteProfile: "B",
        topLinerGsm: 125,
        fluteGsm: 115,
        innerLinerGsm: 125,
        linerBf: 18,
        paperType: operatorFields?.paperType ?? "VIRGIN",
        paperSupplier: operatorFields?.paperSupplier ?? "SUPPLIER-TEST",
        inkColors: 2,
        inkCoveragePct: 40,
        quantity: 100,
      });
    },
    extractOrderForReview: review.extractForReview,
    confirmPurchaseOrderReview: review.confirmReview,
    currentConditions: async ({ shift, signal } = {}) => {
      const result = getConditions({
        runDate: "2026-10-11",
        shift: shift ?? "DAY",
        ambientRhPct: 50,
        ambientTempC: 28,
        paperMoisturePct: 9,
      });
      if (!result || result.ok !== true) return result;
      return { ...result, provenance: result.provenance ?? {
        readingId: "READ-DEMO-001",
        timestamp: "2026-10-11T12:00:00.000Z",
        plantId: "PLANT-DEMO-01",
        source: "simulated",
        recordedSource: "local mock demo",
        retrievedAt: "2026-10-11T12:00:00.000Z",
        ageSeconds: 60,
        freshness: "unassessed",
      } };
    },
    predictRisk: async ({ order, conditions, levers, signal } = {}) => {
      const result = predictRisk(order, conditions, levers);
      return result && result.ok === true ? result : result;
    },
    optimizeRisk: async ({ order, conditions, levers, signal } = {}) => {
      const result = optimizeLevers(order, conditions, levers);
      return result && result.ok === true ? result : result;
    },
    findSimilarRuns: async ({ order, conditions, signal } = {}) => {
      const result = findSimilarRuns(order, conditions);
      return result && result.ok === true ? result : result;
    },
    explainRisk: async ({ order, conditions, prediction, optimization, evidence, signal } = {}) => {
      const result = explainRisk(order, conditions, {
        attributions: [],
        similarRuns: evidence ?? [],
      });
      return result && result.ok === true ? result : result;
    },
    findSeenBefore: async ({ defect, ambientRhPct, signal } = {}) => ({
      ok: true,
      evidence: [{
        lotId: "LOT-DEMO-001",
        orderId: "PO-TEST-42",
        runDate: "2026-10-11",
        primaryDefect: defect ?? "WARP",
        levers: { ...{ sfSpeedMpm: 40, rollTempC: 165, gumApplication: "MED", gumViscositySec: 40, pastingPressure: "MED", dryingHours: 6, printSpeedSpm: 50 } },
        ratesPct: { WARP: 2, DELAM: 1, STRENGTH: 1, PRINT: 1, CRACK: 0 },
        itemCode: "SKU-TEST-42",
        description: "Local mock demo evidence only.",
      }],
    }),
    createDraftJobSheet: async ({ jobSheet, jobId, plantId, signal } = {}) => {
      const resolved = normalizeStoredJobSheet(jobSheet, {
        createdAt: new Date().toISOString(),
        jobId: jobId ?? jobSheet?.jobId,
        plantId: plantId ?? jobSheet?.plantId ?? "PLANT-DEMO-01",
        status: "DRAFT",
        approvedAt: null,
        cardUri: null,
      });
      storage.set(resolved.jobId, resolved);
      return resolved;
    },
    getStoredJobSheet: async ({ jobId, signal } = {}) => storage.get(jobId) ?? null,
    approveJob: async ({ jobId, lang, currency, signal } = {}) => {
      const sheet = storage.get(jobId);
      if (!sheet) {
        return { ok: false, error: { code: "NOT_FOUND", message: "The stored job sheet was not found." } };
      }
      if (sheet.status === "APPROVED") return { ok: true, jobId, jobSheet: sheet, approvedAt: sheet.approvedAt };
      const normalized = normalizeStoredJobSheet(sheet, {
        status: "APPROVED",
        approvedAt: new Date().toISOString(),
        cardUri: `local-demo://jobcards/${jobId}.pdf`,
      });
      storage.set(jobId, normalized);
      return { ok: true, jobId, jobSheet: normalized, approvedAt: normalized.approvedAt };
    },
    getJobCard: async ({ jobId, lang, currency, signal } = {}) => {
      const sheet = storage.get(jobId);
      if (!sheet) {
        return { ok: false, error: { code: "NOT_FOUND", message: "The stored job sheet was not found." } };
      }
      const normalized = normalizeStoredJobSheet(sheet);
      if (normalized.status !== "APPROVED" || !normalized.approvedAt) {
        return { ok: false, error: { code: "CONFLICT", message: "The job card is not available until approval." } };
      }
      const pdf = await renderJobSheetPdf(printableJobSheetForPdf({ ...normalized, explanation: "LOCAL MOCK BACKUP — mock recommendations and simulated approval; in-memory only, no live models or Cloud Storage. " + normalized.explanation }), { locale: lang ?? "en", localSyntheticDemo: true });
      return { ok: true, bytes: pdf, contentType: "application/pdf", filename: `job-card-${jobId}.pdf` };
    },
    saveFeedback: async (input = {}) => { const record = { ...input, savedAt: new Date().toISOString() }; feedbackRecords.push(record); return { ok: true, ...record, source: "mock-demo", storageScope: "process-memory", isRealModelPrediction: false }; },
    getLotOrder: async ({ lotId, signal } = {}) => ({ ok: true, orderId: "PO-TEST-42" }),
    getInsights: async ({ signal } = {}) => ({
      ok: true,
      rows: [{ lotId: "LOT-DEMO-001", scrapPct: 5, defect: "WARP", totalCost: 120 }],
      source: "mock-demo",
      isRealModelPrediction: false,
    }),
    getImpactSummary: async ({ signal } = {}) => ({
      ok: true,
      kpis: { lotsScored: 2, lotsChanged: 1, netSavingMonth: 120, kgSavedMonth: 3, scrapPctBefore: 5, scrapPctAfter: 4, scrapCostBefore: 240, scrapCostAfter: 120, currency: "INR" },
      monthly: [{ month: "2026-09", lots: 2, scrapCost: 240, scrapKg: 6, avgScrapPct: 5, series: "simulated" }],
      seasonal: [],
      topItems: [{ label: "Item 1", lots: 2, avgScrapPct: 5, scrapCost12m: 240, mainDefect: "WARP" }],
      counterfactual: { month: "2026-09", scrapCost: 120, currency: "INR", label: "Local mock counterfactual, not observed production" },
      source: "mock-demo",
      isRealModelPrediction: false,
      note: "Local mock demo values are illustrative only.",
    }),
  });
}

/**
 * Chooses the store behind withDailyGeminiCallCap. With
 * `USTAAD_GEMINI_BUDGET_POLICY=budget-v2` it is the budget store, which never
 * touches the shared `gemini_daily_usage` document (founder decision F1); a
 * requested policy with invalid limits permits no Gemini call. Without the
 * flag the existing day cap is unchanged.
 */
export function configureGeminiUsage({ env, projectId, fetchImpl = fetch, tokenProvider, geminiDailyCap, now } = {}) {
  const budget = readGeminiBudgetConfig(env);
  if (budget.requested) {
    const configured = budget.configured && Boolean(projectId);
    return Object.freeze({
      policy: "budget-v2",
      budgetStatus: budget.status,
      sharedCounterConfigured: configured,
      callsPermitted: configured,
      store: configured ? budgetCapStore(createFirestoreBudgetStore({
        projectId, fetchImpl, tokenProvider, limits: budget.limits, ...(now ? { now } : {}),
      })) : undefined,
    });
  }
  const sharedCounterRequested = env.USTAAD_ENABLE_FIRESTORE_GEMINI_CAP === "true";
  const sharedCounterConfigured = sharedCounterRequested && Boolean(projectId) &&
    env.USTAAD_GEMINI_COUNTER_DATABASE === "(default)" && geminiDailyCap.configured &&
    geminiDailyCap.timeZone === "Asia/Kolkata";
  // Source support is not cloud approval. This flag stays absent/false until
  // the owner approves the existing database and its IAM/cost scope.
  const callsPermitted = (env.K_SERVICE || env.USTAAD_AUTHORIZATION_MODE === "HACKATHON_DEMO")
    ? sharedCounterConfigured
    : (!sharedCounterRequested || sharedCounterConfigured);
  return Object.freeze({
    sharedCounterConfigured,
    callsPermitted,
    store: sharedCounterConfigured ? createFirestoreGeminiAttemptStore({
      projectId, database: env.USTAAD_GEMINI_COUNTER_DATABASE, fetchImpl, tokenProvider,
    }) : undefined,
  });
}

export function createConfiguredServicePorts({
  env = process.env,
  modelConfig = vertexConfig,
  bucketConfig = storageConfig,
  modelAcceptance = modelAcceptanceConfig,
  fetchImpl = fetch,
  tokenProvider,
} = {}) {
  if (env.USTAAD_ENABLE_DEMO_MODE === "true" && !env.K_SERVICE && env.USTAAD_AUTHORIZATION_MODE !== "HACKATHON_DEMO") {
    return createSyntheticDemoServicePorts();
  }
  const liveModelCallsOptedIn = modelConfig.modelCallsEnabled === true &&
    env.USTAAD_ENABLE_LIVE_MODEL_CALLS === "true";
  const geminiDailyCap = readDailyGeminiCallCapConfig(env);
  const projectId = env.PROJECT_ID ?? env.GOOGLE_CLOUD_PROJECT ?? modelConfig.projectId;
  const geminiUsage = configureGeminiUsage({ env, projectId, fetchImpl, tokenProvider, geminiDailyCap });
  const { sharedCounterConfigured } = geminiUsage;
  const allowed = liveModelCallsOptedIn && geminiDailyCap.configured && geminiUsage.callsPermitted;
  const region = env.REGION ?? env.VERTEX_LOCATION ?? modelConfig.location;
  const vertexLocation = env.VERTEX_LOCATION ?? region;
  const bucket = env.BUCKET ?? env.USTAAD_GCS_BUCKET ?? bucketConfig.bucket?.name;
  const model = env.GEMINI_MODEL ?? modelConfig.testModel;
  const bigquery = createBigQueryReadClient({
    projectId,
    location: region,
    fetchImpl,
    tokenProvider,
  });
  // The weather fallback is enabled only when WEATHER_API_KEY is set.
  const conditionGuard = createConditionGuard({
    weatherProvider: createWeatherProviderFromEnv(env, { fetchImpl }),
  });
  const adapters = {
    geminiUsage: Object.freeze({
      sharedCounterConfigured,
      liveConnectivityVerified: false,
      ...(geminiUsage.policy ? { policy: geminiUsage.policy, budgetStatus: geminiUsage.budgetStatus } : {}),
      ...(geminiUsage.store?.peek ? { peek: geminiUsage.store.peek } : {}),
      ...(geminiUsage.store?.admitSession ? {
        admitSession: geminiUsage.store.admitSession, admitPitchClaim: geminiUsage.store.admitPitchClaim,
      } : {}),
    }),
    conditionGuard,
  };
  if (env.USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY === "true") {
    adapters.jobIdempotency = Object.freeze({
      durableRequested: true,
      store: projectId ? createFirestoreIdempotencyStore({
        projectId, collection: "idempotency", fetchImpl, tokenProvider,
      }) : undefined,
    });
  }
  // 7a writes revisions; 7b enforces the approve guard. Both need the store, and neither falls back to memory.
  const lotRevisionsEnabled = env.USTAAD_ENABLE_LOT_REVISIONS === "true";
  const approveGuardEnforced = env.USTAAD_ENFORCE_APPROVE_GUARD === "true";
  if (lotRevisionsEnabled || approveGuardEnforced) {
    adapters.lotRevisions = Object.freeze({
      enabled: lotRevisionsEnabled,
      enforceGuard: approveGuardEnforced,
      store: projectId ? createFirestoreLotStore({ projectId, fetchImpl, tokenProvider }) : undefined,
    });
  }
  if (projectId && env.USTAAD_ENABLE_ARC_METRICS === "true") {
    adapters.queryMetric = createMetricQueryService({
      projectId, location: region, fetchImpl, tokenProvider, modelAcceptance,
    }).queryMetric;
  }
  if (projectId) {
    adapters.getLotOrder = createLotAssociationService({ bigquery, projectId });
    if (env.USTAAD_ENABLE_IMPACT_SUMMARY === "true") {
      adapters.getImpactSummary = createImpactSummaryService({ bigquery });
    }
  }
  if (env.USTAAD_PLANT_ID) {
    adapters.currentConditions = createCurrentConditionsService({
      bigquery,
      projectId,
      plantId: env.USTAAD_PLANT_ID,
    });
  }

  if (projectId && env.USTAAD_ENABLE_RISK_PREDICTION === "true") {
    const riskBigquery = createBigQueryReadClient({
      projectId,
      location: region,
      maximumBytesBilled: RISK_PREDICTION_MAX_BYTES_BILLED,
      fetchImpl,
      tokenProvider,
    });
    adapters.predictRisk = createRiskPredictionService({ bigquery: riskBigquery, projectId, modelAcceptance, conditionGuard });
    const optimizerContractApproved = env.USTAAD_OPTIMIZER_CONTRACT_STATUS === "approved" &&
      typeof env.USTAAD_OPTIMIZER_CONTRACT_VERSION === "string" &&
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(env.USTAAD_OPTIMIZER_CONTRACT_VERSION);
    const optimizerMaximumBytesBilled = readOptimizerQueryBudget(env);
    if (optimizerContractApproved && optimizerMaximumBytesBilled) {
      const optimizerBigquery = createBigQueryReadClient({ projectId, location: region,
        maximumBytesBilled: optimizerMaximumBytesBilled, fetchImpl, tokenProvider });
      adapters.optimizeRisk = createRiskOptimizationService({ bigquery: optimizerBigquery, projectId, modelAcceptance });
    }
    if (env.USTAAD_ENABLE_HISTORICAL_EVIDENCE === "true") {
      adapters.findSeenBefore = createSeenBeforeService({ bigquery });
      adapters.findSimilarRuns = createSimilarRunsService({ bigquery });
    }
  }

  if (projectId && bucket && env.USTAAD_ENABLE_JOB_STORAGE === "true" &&
      env.USTAAD_ENABLE_BIGQUERY_WRITES === "true") {
    const writer = createBigQueryWriteClient({ projectId, location: region, fetchImpl, tokenProvider, requireApprovalAudit: true });
    const approvalAuditEnabled = env.USTAAD_ENABLE_APPROVAL_AUDIT === "true";
    const repository = createJobSheetRepository({ bigquery, writer, projectId, approvalAuditEnabled });
    const storage = createCloudStorageClient({ bucket, fetchImpl, tokenProvider });
    const cards = createJobCardService({ repository, storage, renderPdf: renderJobSheetPdf, bucket, requireApprovalAudit: true });
    adapters.createDraftJobSheet = (input) => repository.createDraft(
      mergeDraftWriteArgs(input, env.USTAAD_PLANT_ID)
    );
    adapters.getStoredJobSheet = (input) => repository.get(input.jobId, input);
    if (approvalAuditEnabled) adapters.approveJob = cards.approveJob;
    adapters.getJobCard = cards.getJobCard;
  }

  if (projectId && env.USTAAD_ENABLE_BIGQUERY_WRITES === "true" &&
      env.USTAAD_ENABLE_FEEDBACK_WRITES === "true") {
    const writer = createBigQueryWriteClient({ projectId, location: region, fetchImpl, tokenProvider });
    adapters.saveFeedback = createFeedbackService({ writer });
  }

  if (!allowed || !projectId || !bucket || !model || !vertexLocation) {
    return createServicePorts(adapters);
  }

  const storage = createCloudStorageClient({ bucket, fetchImpl, tokenProvider });
  const itemCatalog = createItemCatalogService({ bigquery, projectId });
  const vertexGemini = createVertexGeminiClient({
    projectId,
    location: vertexLocation,
    model,
    fetchImpl,
    tokenProvider,
  });
  const gemini = withDailyGeminiCallCap(vertexGemini, geminiDailyCap, { store: geminiUsage.store });
  if (env.USTAAD_ENABLE_RISK_PREDICTION === "true") {
    const riskBigquery = createBigQueryReadClient({
      projectId,
      location: region,
      maximumBytesBilled: RISK_PREDICTION_MAX_BYTES_BILLED,
      fetchImpl,
      tokenProvider,
    });
    adapters.explainRisk = createRiskExplanationService({ bigquery: riskBigquery, gemini });
  }
  if (env.USTAAD_ENABLE_DEFECT_DIAGNOSIS === "true") {
    adapters.diagnoseDefectPhoto = createDefectDiagnosisService({ storage, gemini, bucket, model }).diagnose;
  }
  if (env.USTAAD_ENABLE_APPROVED_PHOTO_CLASSIFICATION === "true" && env.USTAAD_AUTHORIZATION_MODE === "HACKATHON_DEMO" && env.USTAAD_SYNTHETIC_ONLY === "true") {
    const photos = createApprovedPhotoService({ storage, gemini, inventory: approvedPhotos, model });
    adapters.getApprovedPhotos = photos.list;
    adapters.classifyApprovedPhoto = photos.classify;
  }
  const extractOrder = createPdfOrderExtractionService({ storage, gemini, itemCatalog,
    allowTestOrderNamespace: env.USTAAD_AUTHORIZATION_MODE === "HACKATHON_DEMO" && env.USTAAD_SYNTHETIC_ONLY === "true" });
  // Off: reviews stay in this instance's memory. On: they live in po_reviews and fail closed.
  const review = createPurchaseOrderReviewService({
    extractOrder,
    resolveOrderLine: itemCatalog.resolveOrderLine,
    ...(env.USTAAD_ENABLE_DURABLE_PO_REVIEWS === "true" ? {
      reviewStore: createFirestorePoReviewStore({ projectId, fetchImpl, tokenProvider }),
    } : {}),
  });
  return createServicePorts({
    ...adapters,
    extractOrder,
    extractOrderForReview: review.extractForReview,
    confirmPurchaseOrderReview: review.confirmReview,
  });
}

export const servicePorts = createConfiguredServicePorts();
