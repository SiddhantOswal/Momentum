import vertexConfig from "../config/gcp-vertex-ai.json" with { type: "json" };
import storageConfig from "../config/gcp-storage.json" with { type: "json" };
import modelAcceptanceConfig from "../config/model-acceptance.json" with { type: "json" };
import { createCloudStorageClient } from "./google-cloud/storage-client.js";
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
import { createRiskOptimizationService } from "./google-cloud/risk-optimization-service.js";
import {
  createRiskExplanationService,
  createSeenBeforeService,
  createSimilarRunsService,
} from "./google-cloud/risk-evidence-service.js";
import { createImpactSummaryService } from "./google-cloud/impact-summary-service.js";
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
  getLotOrder: "BigQuery lot-to-order association lookup is not configured.",
};

// The demo prediction job requires 73,400,320 bytes of billed query capacity.
// Keep its 80 MiB ceiling isolated from the general read client's 50 MiB cap.
const RISK_PREDICTION_MAX_BYTES_BILLED = 80 * 1024 * 1024;

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
  });
  return Object.freeze({
    availability,
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
        recordedSource: "synthetic demo",
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
        description: "Synthetic demo evidence only.",
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
      const normalized = normalizeStoredJobSheet(sheet, {
        status: "APPROVED",
        approvedAt: new Date().toISOString(),
        cardUri: `gs://demo/jobcards/${jobId}.pdf`,
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
      const pdf = await renderJobSheetPdf(printableJobSheetForPdf(normalized), { locale: lang ?? "en" });
      return { ok: true, bytes: pdf, contentType: "application/pdf", filename: `job-card-${jobId}.pdf` };
    },
    saveFeedback: async (input = {}) => ({ ok: true, ...input, savedAt: "2026-10-11T12:00:00.000Z" }),
    getLotOrder: async ({ lotId, signal } = {}) => ({ ok: true, orderId: "PO-TEST-42" }),
    getInsights: async ({ signal } = {}) => ({
      ok: true,
      rows: [{ lotId: "LOT-DEMO-001", scrapPct: 5, defect: "WARP", totalCost: 120 }],
      source: "mock-demo",
      isRealModelPrediction: false,
    }),
    getImpactSummary: async ({ signal } = {}) => ({
      ok: true,
      totalSavingsInr: 120,
      averageScrapPct: 5,
      windowMonths: 12,
      topItems: [{ itemCode: "SKU-TEST-42", description: "Synthetic demo item", lots: 2, averageScrapPct: 5, scrapCost: 120, mainDefect: "WARP" }],
      source: "mock-demo",
      isRealModelPrediction: false,
      note: "Synthetic demo values are illustrative only.",
    }),
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
  if (env.USTAAD_ENABLE_DEMO_MODE === "true" && !env.K_SERVICE) {
    return createSyntheticDemoServicePorts();
  }
  const allowed = modelConfig.modelCallsEnabled === true &&
    env.USTAAD_ENABLE_LIVE_MODEL_CALLS === "true";
  const projectId = env.PROJECT_ID ?? env.GOOGLE_CLOUD_PROJECT ?? modelConfig.projectId;
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
  const adapters = {};
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
    adapters.predictRisk = createRiskPredictionService({ bigquery: riskBigquery, projectId, modelAcceptance });
    const optimizerContractApproved = env.USTAAD_OPTIMIZER_CONTRACT_STATUS === "approved" &&
      typeof env.USTAAD_OPTIMIZER_CONTRACT_VERSION === "string" &&
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(env.USTAAD_OPTIMIZER_CONTRACT_VERSION);
    if (optimizerContractApproved) {
      adapters.optimizeRisk = createRiskOptimizationService({ bigquery: riskBigquery, projectId, modelAcceptance });
    }
    if (env.USTAAD_ENABLE_HISTORICAL_EVIDENCE === "true") {
      adapters.findSeenBefore = createSeenBeforeService({ bigquery });
      adapters.findSimilarRuns = createSimilarRunsService({ bigquery });
    }
  }

  if (projectId && bucket && env.USTAAD_ENABLE_JOB_STORAGE === "true" &&
      env.USTAAD_ENABLE_BIGQUERY_WRITES === "true") {
    const writer = createBigQueryWriteClient({ projectId, location: region, fetchImpl, tokenProvider });
    const repository = createJobSheetRepository({ bigquery, writer, projectId });
    const storage = createCloudStorageClient({ bucket, fetchImpl, tokenProvider });
    const cards = createJobCardService({ repository, storage, renderPdf: renderJobSheetPdf, bucket });
    adapters.createDraftJobSheet = (input) => repository.createDraft(
      mergeDraftWriteArgs(input, env.USTAAD_PLANT_ID)
    );
    adapters.getStoredJobSheet = (input) => repository.get(input.jobId, input);
    adapters.approveJob = cards.approveJob;
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
  const gemini = createVertexGeminiClient({
    projectId,
    location: vertexLocation,
    model,
    fetchImpl,
    tokenProvider,
  });
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
  const extractOrder = createPdfOrderExtractionService({ storage, gemini, itemCatalog });
  const review = createPurchaseOrderReviewService({
    extractOrder,
    resolveOrderLine: itemCatalog.resolveOrderLine,
  });
  return createServicePorts({
    ...adapters,
    extractOrder,
    extractOrderForReview: review.extractForReview,
    confirmPurchaseOrderReview: review.confirmReview,
  });
}

export const servicePorts = createConfiguredServicePorts();
