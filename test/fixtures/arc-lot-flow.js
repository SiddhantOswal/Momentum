// One backend for PO1 lot preparation, offline: the real commands, PO review service,
// extraction service, job coordinator, job submission handler and lot store, over
// in-process fakes for Firestore and Vertex AI. The model and BigQuery answers are
// replays of recorded responses: PO1's lines as read in test/fixtures/synthetic_POs,
// the saved PKBX0041 optimizer response, and the 16 Oct 2026 explanation replay
// (Gemini text and BigQuery attributions). Replays return the same rows whatever the
// inputs, so a test built on this compares routes, never model accuracy. Every
// request each port receives is kept, so two backends can be compared request by request.
import { File } from "node:buffer";
import { readFileSync } from "node:fs";
import { createArcWriteEffects } from "../../src/arc/write-effects.js";
import { readOrder } from "../../src/commands/read-order.js";
import { planLot } from "../../src/commands/plan-lot.js";
import { readGeminiBudgetConfig } from "../../src/gemini-budget-config.js";
import { createFirestoreBudgetStore } from "../../src/google-cloud/firestore-budget-store.js";
import { createFirestoreLotStore } from "../../src/google-cloud/firestore-lot-store.js";
import { createFirestorePoReviewStore } from "../../src/google-cloud/firestore-po-review-store.js";
import { createPdfOrderExtractionService } from "../../src/google-cloud/order-extraction-service.js";
import { createRiskExplanationService } from "../../src/google-cloud/risk-evidence-service.js";
import { createRiskOptimizationService, decodeOptimizationResult } from "../../src/google-cloud/risk-optimization-service.js";
import { createVertexGeminiClient } from "../../src/google-cloud/vertex-gemini-client.js";
import { createJobCoordinator } from "../../src/job-coordinator.js";
import { createJobSubmissionHandler } from "../../src/job-draft-persistence.js";
import { InMemoryIdempotencyStore } from "../../src/job-idempotency.js";
import { createRecordingVertexTransport, vertexTextResponse } from "../../src/mock-agents.js";
import { createPurchaseOrderReviewService } from "../../src/purchase-order-review.js";
import { SAMPLE_DOCUMENTS, SAMPLE_ORDER_CONTEXT } from "../../src/synthetic-po-allowlist.js";
import { createTraceRegistry } from "../../src/trace-registry.js";
import { acceptedModelSetFixture } from "./accepted-model-set.js";
import { fakeFirestore } from "./fake-firestore-transactions.js";
import { createFakeFirestore, FAKE_PROJECT_ID } from "./fake-firestore.js";

const expected = JSON.parse(readFileSync(new URL("./synthetic_POs/expected_results.json", import.meta.url), "utf8"))
  .find(({ file }) => file === SAMPLE_DOCUMENTS.PO1);
const optimizerRecording = JSON.parse(readFileSync(new URL("./optimizer-pkbx0041-cli-result.json", import.meta.url), "utf8"));
const explanationRecording = JSON.parse(readFileSync(new URL("./explanation-pkbx0041-20261016.json", import.meta.url), "utf8"));
const explainSql = readFileSync(new URL("../../sql/explain.sql", import.meta.url), "utf8");
export const PO1_BYTES = readFileSync(new URL(`../../public/samples/${SAMPLE_DOCUMENTS.PO1}`, import.meta.url));

export const PO1 = Object.freeze({ itemCode: "PKBX0041", quantity: 1300, context: SAMPLE_ORDER_CONTEXT.PO1 });
// The values of the live check in the build packet; test inputs, not plant readings.
export const CONDITIONS = Object.freeze({ runDate: "2026-11-26", shift: "DAY", ambientRhPct: 62, ambientTempC: 24.5, paperMoisturePct: 7.3 });
export const LEVERS = Object.freeze({
  sfSpeedMpm: 48, rollTempC: 162, gumApplication: "HIGH", gumViscositySec: 32, pastingPressure: "MED", dryingHours: 5, printSpeedSpm: 60,
});
export const CONFIRM_CONDITIONS = Object.freeze({ ...CONDITIONS, paperMoistureSource: "example", ...LEVERS });
/** Confirm conditions params for the lot on the card. */
export const conditionsFor = (lotId, patch = {}) => ({ lotId, ...CONFIRM_CONDITIONS, ...patch });

// PO1's line as test/fixtures/synthetic_POs/expected_results.json records it.
export const PO1_EXTRACTION = Object.freeze({
  poNumber: expected.poNumber, buyer: expected.buyer, deliveryDate: expected.deliveryDate,
  lines: expected.lines.map(({ itemCode, quantity }) => ({ itemCode, quantity, sourcePage: 1 })),
});

// Test catalog values for PKBX0041, not the catalog's own row.
const catalogProfile = (itemCode, quantity) => ({
  itemCode, quantity, customerId: "CUST-TEST-1", boxStyle: "RSC", lengthMm: 400, widthMm: 300, heightMm: 250, ply: 5,
  fluteProfile: "BC", topLinerGsm: 180, fluteGsm: 120, innerLinerGsm: 150, linerBf: 20, inkColors: 2, inkCoveragePct: 30,
});
const itemCatalog = {
  resolveOrderLine: async ({ itemCode, quantity }) => itemCode === PO1.itemCode
    ? { status: "MATCHED", candidates: [], resolvedItemCode: itemCode, orderProfile: catalogProfile(itemCode, quantity) }
    : { status: "UNKNOWN_CODE", candidates: [] },
};

// The saved optimizer response was recorded when all five targets counted toward the totals.
const RECORDED_TARGET_USE = Object.freeze(Object.fromEntries(["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"].map((defect) => [
  defect, { useClass: "optimizer", reason: "All five targets counted when the PKBX0041 rows were recorded." },
])));
const modelAcceptance = Object.freeze({ ...acceptedModelSetFixture, targetUse: RECORDED_TARGET_USE });
const OPTIMIZER_COLUMNS = [
  "kind", "n_changes", "sf_speed_mpm", "roll_temp_c", "gum_application", "gum_viscosity_sec", "pasting_pressure",
  "drying_hours", "print_speed_spm", "rate_warp_pct", "rate_delam_pct", "rate_strength_pct", "rate_print_pct", "rate_crack_pct",
  "total_scrap_pct", "scrap_kg", "scrap_cost", "penalty", "total_cost", "currency", "primary_defect", "savings_kg", "savings_cost",
];
const STRING_COLUMNS = new Set(["kind", "gum_application", "pasting_pressure", "currency", "primary_defect"]);
function optimizerRows() {
  const rows = optimizerRecording.response[2];
  return {
    schema: { fields: OPTIMIZER_COLUMNS.map((name) => ({ name, type: STRING_COLUMNS.has(name) ? "STRING" : name === "n_changes" ? "INTEGER" : "FLOAT" })) },
    rows: ["BASELINE", "BEST"].map((kind) => rows.find((row) => row.kind === kind))
      .map((row) => ({ f: OPTIMIZER_COLUMNS.map((name) => ({ v: row[name] })) })),
  };
}

const withoutSignal = ({ signal: _signal, ...rest }) => structuredClone(rest);
export const po1File = () => new File([PO1_BYTES], SAMPLE_DOCUMENTS.PO1, { type: "application/pdf" });

/**
 * Service ports and command deps for one backend. `reviewNow` is the PO review
 * service's clock, so a test can let a review expire. `plansPerDay` turns on the
 * per-session plan limit through the real budget store, as a budget-v2 deployment has it.
 */
export function lotBackend({ reviewNow = Date.now, extraction = PO1_EXTRACTION, plansPerDay } = {}) {
  const requests = { vertex: [], predict: [], optimize: [], similar: [], explainQuery: [], explainModel: [], submit: [] };
  const transport = createRecordingVertexTransport(() => vertexTextResponse(JSON.stringify(extraction)));
  requests.vertex = transport.requests;
  const firestore = createFakeFirestore();
  const reviews = createPurchaseOrderReviewService({
    extractOrder: createPdfOrderExtractionService({
      storage: {
        createObjectName: () => "orders/arc-lot-flow.pdf",
        upload: async () => ({ gcsUri: "gs://prepagent-hack-data/orders/arc-lot-flow.pdf" }),
        delete: async () => {},
      },
      gemini: createVertexGeminiClient({ projectId: FAKE_PROJECT_ID, tokenProvider: async () => "offline-test", fetchImpl: transport.fetchImpl }),
      itemCatalog, allowTestOrderNamespace: true,
    }),
    resolveOrderLine: itemCatalog.resolveOrderLine,
    now: reviewNow,
    reviewStore: createFirestorePoReviewStore({ projectId: FAKE_PROJECT_ID, fetchImpl: firestore.fetchImpl, tokenProvider: async () => "offline-test" }),
  });
  const services = {
    extractOrder: async () => ({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Planning uses the stored review." } }),
    confirmPurchaseOrderReview: reviews.confirmReview,
    currentConditions: async () => ({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Conditions are entered." } }),
    predictRisk: async (request) => {
      requests.predict.push(withoutSignal(request));
      const { baseline } = decodeOptimizationResult(optimizerRows(), { plannedLevers: request.levers, targetUse: RECORDED_TARGET_USE });
      return { ok: true, ...baseline.risk };
    },
    optimizeRisk: createRiskOptimizationService({
      bigquery: { query: async ({ parameters }) => { requests.optimize.push(structuredClone(parameters)); return optimizerRows(); } },
      modelAcceptance,
    }),
    findSimilarRuns: async (request) => {
      requests.similar.push(withoutSignal(request));
      return { ok: true, evidence: structuredClone(explanationRecording.inputs.evidence) };
    },
    explainRisk: createRiskExplanationService({
      bigquery: { query: async ({ parameters }) => { requests.explainQuery.push(structuredClone(parameters)); return structuredClone(explanationRecording.explainResult); } },
      gemini: { generateContent: async ({ signal: _signal, ...request }) => {
        requests.explainModel.push(structuredClone(request));
        return { parts: [{ text: explanationRecording.geminiText }] };
      } },
      sql: explainSql,
    }),
  };
  const drafts = new Map();
  const handler = createJobSubmissionHandler({
    prepareJob: createJobCoordinator({ services, traceRegistry: createTraceRegistry(), plantId: "PLANT-01" }),
    createDraftJobSheet: async ({ jobSheet, jobId, plantId }) => {
      const record = structuredClone({ ...jobSheet, jobId, plantId });
      drafts.set(jobId, record);
      return record;
    },
    getStoredJobSheet: async ({ jobId }) => drafts.get(jobId) ?? null,
    draftPersistenceEnabled: true, storedJobLookupEnabled: true, plantId: "PLANT-01",
    store: new InMemoryIdempotencyStore({ leaseMs: 30_000 }), leaseMs: 30_000,
  });
  const submitJob = async (input) => {
    requests.submit.push({ jobId: input.identity.jobId, fingerprint: input.identity.fingerprint });
    return handler(input);
  };
  const lotFirestore = fakeFirestore();
  const lotStore = createFirestoreLotStore({ projectId: "prepagent-hack", fetchImpl: lotFirestore.fetchImpl, tokenProvider: async () => "offline-test" });
  const budget = plansPerDay === undefined ? undefined : createFirestoreBudgetStore({
    projectId: "prepagent-hack", fetchImpl: fakeFirestore().fetchImpl, tokenProvider: async () => "offline-test",
    limits: readGeminiBudgetConfig({
      USTAAD_GEMINI_BUDGET_POLICY: "budget-v2",
      GEMINI_BUDGET_LIMITS: JSON.stringify({
        pool: "live", dayLimit: 300, sessionDayLimit: 40, ipDayLimit: 120, minuteLimit: 20, sessionMinuteLimit: 6,
        lotPlans: { perSessionPerDay: plansPerDay },
      }),
    }).limits,
  });
  const servicePorts = {
    ...(budget && { geminiUsage: { admitPlan: budget.admitPlan } }),
    extractOrderForReview: reviews.extractForReview,
    loadPurchaseOrderReview: reviews.loadReview,
    confirmPurchaseOrderReview: reviews.confirmReview,
  };
  const commandDeps = {
    submitJob, demoMode: false, liveStore: { publish: async () => {} },
    purchaseOrderPolicy: { syntheticOnly: true },
    lotRevisions: { enabled: true, enforceGuard: false, store: lotStore },
    runWriteEffect: createArcWriteEffects({ servicePorts }),
  };

  /** The two dashboard commands behind POST /orders/extract and POST /jobs, with New Lot's fields. */
  const dashboard = {
    deps: (principal) => ({
      ...commandDeps, servicePorts, principal, signal: undefined, executionMode: "live-service", hackathonAuth: { enabled: true },
    }),
    readOrder: (principal) => readOrder({ fields: { file: po1File(), ...PO1.context } }, dashboard.deps(principal)),
    planLot: (principal, { review, lotId, idempotencyKey }) => planLot({
      idempotencyKey,
      fields: {
        file: po1File(), ...PO1.context, lotId,
        confirmedItemCode: PO1.itemCode, confirmedQuantity: String(PO1.quantity), confirmedLineIndex: "1",
        reviewId: review.reviewId, reviewFingerprint: review.reviewFingerprint, confirmedSourceLine: "true",
        ...Object.fromEntries(Object.entries(CONDITIONS).map(([field, value]) => [field, String(value)])),
        conditionsConfirmed: "true", paperMoistureSource: "example",
        ...Object.fromEntries(Object.entries(LEVERS).map(([field, value]) => [field, String(value)])),
      },
    }, dashboard.deps(principal)),
  };

  return { requests, servicePorts, commandDeps, lotStore, lotFirestore, drafts, reviews, dashboard };
}
