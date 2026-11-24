import {
  CompletePurchaseOrderSchema,
  ConditionsValidationApiResponseSchema,
  LeversSchema,
  OrderExtractionApiResponseSchema,
  RiskPredictionRequestSchema,
  RunConditionsSchema,
  ServiceUnavailableSchema,
  ValidationFailureSchema,
} from "./schemas.js";
import { buildDraftJobSheet } from "./job-sheet-builder.js";
import { extractOrderFromMock } from "./order-extraction.js";

const DEMO_ORDER = {
  orderId: "PO-TEST-42",
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
  paperType: "VIRGIN",
  paperSupplier: "SUPPLIER-TEST",
  inkColors: 2,
  inkCoveragePct: 40,
  quantity: 100,
};

const DEMO_CONDITIONS = {
  runDate: "2026-10-11",
  shift: "DAY",
  ambientRhPct: 50,
  ambientTempC: 28,
  paperMoisturePct: 9,
};

const DEMO_BASE_LEVERS = {
  sfSpeedMpm: 40,
  rollTempC: 165,
  gumApplication: "MED",
  gumViscositySec: 40,
  pastingPressure: "MED",
  dryingHours: 6,
  printSpeedSpm: 50,
};

const DEMO_RISK = {
  ratesPct: { WARP: 2, DELAM: 1, STRENGTH: 1, PRINT: 1, CRACK: 0 },
  totalScrapPct: 5,
  totalScrapKg: 12,
  scrapCost: 120,
  currency: "INR",
  primaryDefect: "WARP",
};

const DEMO_EXPLANATION = "Local mock demo mode: this is a deterministic local workflow result for presentation and validation only. It does not represent a live model inference, plant telemetry, or verified savings outcome.";

function demoModeEnabled() {
  return !process.env.K_SERVICE && process.env.USTAAD_ENABLE_DEMO_MODE === "true";
}

function validationFailure(issues, message = "Request fields failed validation.") {
  return ValidationFailureSchema.parse({
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message,
      issues: issues.map((issue) => ({
        field: issue.path.join(".") || "root",
        path: issue.path,
        code: issue.code,
        message: issue.message,
      })),
    },
  });
}

function validationIssues(...results) {
  return results.flatMap(({ key, result }) =>
    result.success
      ? []
      : result.error.issues.map((issue) => ({
          ...issue,
          path: [key, ...issue.path],
        }))
  );
}

function unavailable(service, detail) {
  return ServiceUnavailableSchema.parse({
    ok: false,
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: `${service} is not configured. ${detail}`,
    },
  });
}

function demoRiskFor(order = DEMO_ORDER, conditions = DEMO_CONDITIONS, levers = DEMO_BASE_LEVERS) {
  const baselineLevers = { ...DEMO_BASE_LEVERS, ...levers };
  const orderQuantity = Number(order?.quantity ?? DEMO_ORDER.quantity);
  const scrapCost = Math.max(60, Math.round((orderQuantity / 100) * DEMO_RISK.scrapCost));
  const rates = { ...DEMO_RISK.ratesPct };
  if (baselineLevers.rollTempC < 165) {
    rates.WARP = Math.max(1, rates.WARP - 1);
  }
  if (baselineLevers.dryingHours <= 5) {
    rates.CRACK = Math.max(0, rates.CRACK - 1);
  }
  const totalScrapPct = Object.values(rates).reduce((sum, value) => sum + value, 0);
  return {
    ratesPct: rates,
    totalScrapPct,
    totalScrapKg: Math.max(3, Math.round((totalScrapPct / 100) * orderQuantity)),
    scrapCost,
    currency: "INR",
    primaryDefect: "WARP",
  };
}

function demoOptimizationFor(order = DEMO_ORDER, conditions = DEMO_CONDITIONS, levers = DEMO_BASE_LEVERS) {
  const baselineLevers = { ...DEMO_BASE_LEVERS, ...levers };
  const baseline = demoRiskFor(order, conditions, baselineLevers);
  const bestLevers = { ...baselineLevers, rollTempC: Math.min(160, baselineLevers.rollTempC), dryingHours: Math.max(4, baselineLevers.dryingHours - 1) };
  const best = demoRiskFor(order, conditions, bestLevers);
  const changes = [
    {
      lever: "rollTempC",
      from: baselineLevers.rollTempC,
      to: bestLevers.rollTempC,
      reason: "Local mock demo: reduce roll temperature to lower WARP risk.",
    },
    {
      lever: "dryingHours",
      from: baselineLevers.dryingHours,
      to: bestLevers.dryingHours,
      reason: "Local mock demo: shorten drying to improve crack stability.",
    },
  ].filter((change) => change.from !== change.to);
  return {
    baseline: { levers: baselineLevers, risk: baseline },
    best: { levers: bestLevers, risk: best },
    changes,
    savings: { kg: Math.max(0, baseline.totalScrapKg - best.totalScrapKg), inr: Math.max(0, baseline.scrapCost - best.scrapCost) },
    note: "Local mock demo mode: optimization values are illustrative and not a live plant recommendation.",
  };
}

function demoEvidenceFor(order = DEMO_ORDER, conditions = DEMO_CONDITIONS, levers = DEMO_BASE_LEVERS) {
  const risk = demoRiskFor(order, conditions, levers);
  return [{
    lotId: "LOT-DEMO-001",
    orderId: order.orderId ?? DEMO_ORDER.orderId,
    runDate: conditions.runDate ?? DEMO_CONDITIONS.runDate,
    primaryDefect: risk.primaryDefect,
    levers: { ...DEMO_BASE_LEVERS, ...levers },
    ratesPct: risk.ratesPct,
    itemCode: order.itemCode ?? DEMO_ORDER.itemCode,
    description: "Local mock demo lot used to illustrate the UI flow; not a production record.",
    shift: conditions.shift ?? DEMO_CONDITIONS.shift,
    ambientRhPct: conditions.ambientRhPct ?? DEMO_CONDITIONS.ambientRhPct,
    paperType: order.paperType ?? DEMO_ORDER.paperType,
    paperSupplier: order.paperSupplier ?? DEMO_ORDER.paperSupplier,
    totalScrapPct: risk.totalScrapPct,
    totalScrapKg: risk.totalScrapKg,
    scrapCost: risk.scrapCost,
    currency: risk.currency,
    distance: 0.8,
    operatorNote: "Local mock evidence only.",
  }];
}

export function extractOrder(input) {
  const result = extractOrderFromMock(input);

  if (!result || result.ok === false) {
    return result;
  }

  return OrderExtractionApiResponseSchema.parse({
    ok: true,
    agent: "extractOrder",
    source: "mock-demo",
    isRealModelPrediction: false,
    ...result,
  });
}

export function getConditions(input) {
  const parsed = RunConditionsSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error.issues, "Run conditions failed validation.");
  }

  if (!demoModeEnabled()) {
    return ConditionsValidationApiResponseSchema.parse({
      ok: true,
      agent: "getConditions",
      source: "local-validation",
      isRealModelPrediction: false,
      data: parsed.data,
    });
  }

  return ConditionsValidationApiResponseSchema.parse({
    ok: true,
    agent: "getConditions",
    source: "simulated-sensor",
    isRealModelPrediction: false,
    provenance: {
      readingId: "READ-DEMO-001",
      timestamp: "2026-10-11T12:00:00.000Z",
      plantId: "PLANT-DEMO-01",
      source: "simulated",
      recordedSource: "local mock demo",
      retrievedAt: new Date().toISOString(),
      ageSeconds: Math.max(0, Math.floor((Date.now() - Date.parse("2026-10-11T12:00:00Z")) / 1000)),
      freshness: "stale",
    },
    data: {
      ...DEMO_CONDITIONS,
      ...parsed.data,
    },
  });
}

export function predictRisk(order, conditions, levers) {
  const normalizedLevers = levers ?? DEMO_BASE_LEVERS;
  const parsedRequest = RiskPredictionRequestSchema.safeParse({
    order,
    conditions,
    levers: normalizedLevers,
  });
  const issues = parsedRequest.success ? [] : parsedRequest.error.issues.map((issue) => ({
    ...issue,
    path: issue.path,
  }));

  if (issues.length > 0) {
    return validationFailure(issues);
  }

  if (!demoModeEnabled()) {
    return unavailable(
      "Risk prediction",
      "It requires the configured BigQuery ML models and predict query."
    );
  }

  const risk = demoRiskFor(order, conditions, normalizedLevers);
  return {
    ok: true,
    ...risk,
  };
}

export function optimizeLevers(order, conditions, levers) {
  const normalizedLevers = levers ?? DEMO_BASE_LEVERS;
  const results = [
    { key: "order", result: CompletePurchaseOrderSchema.safeParse(order) },
    { key: "conditions", result: RunConditionsSchema.safeParse(conditions) },
    { key: "levers", result: LeversSchema.safeParse(normalizedLevers) },
  ];
  const issues = validationIssues(...results);

  if (issues.length > 0) {
    return validationFailure(issues);
  }

  if (!demoModeEnabled()) {
    return unavailable(
      "Lever optimization",
      "It requires the configured BigQuery ML models and optimizer query."
    );
  }

  return {
    ok: true,
    ...demoOptimizationFor(order, conditions, normalizedLevers),
  };
}

export function findSimilarRuns(order, conditions) {
  const results = [
    { key: "order", result: CompletePurchaseOrderSchema.safeParse(order) },
    { key: "conditions", result: RunConditionsSchema.safeParse(conditions) },
  ];
  const issues = validationIssues(...results);

  if (issues.length > 0) {
    return validationFailure(issues);
  }

  if (!demoModeEnabled()) {
    return unavailable(
      "Similar-run retrieval",
      "It requires the configured BigQuery evidence query and historical lot data."
    );
  }

  return {
    ok: true,
    evidence: demoEvidenceFor(order, conditions),
  };
}

export function explainRisk(order, conditions, riskEvidence) {
  const results = [
    { key: "order", result: CompletePurchaseOrderSchema.safeParse(order) },
    { key: "conditions", result: RunConditionsSchema.safeParse(conditions) },
  ];
  const issues = validationIssues(...results);

  if (issues.length > 0) {
    return validationFailure(issues);
  }

  if (!riskEvidence || typeof riskEvidence !== "object" || Array.isArray(riskEvidence)) {
    return validationFailure(
      [{
        path: ["riskEvidence"],
        code: "invalid_type",
        message: "Model attributions and similar-run evidence are required.",
      }],
      "Risk explanation inputs failed validation."
    );
  }

  if (!demoModeEnabled()) {
    return unavailable(
      "Risk explanation",
      "It requires Gemini and validated model-attribution and similar-run evidence."
    );
  }

  return {
    ok: true,
    explanation: DEMO_EXPLANATION,
  };
}

export function generateJobSheet(order, conditions, analysis) {
  const results = [
    { key: "order", result: CompletePurchaseOrderSchema.safeParse(order) },
    { key: "conditions", result: RunConditionsSchema.safeParse(conditions) },
  ];
  const issues = validationIssues(...results);

  if (issues.length > 0) {
    return validationFailure(issues);
  }

  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
    return validationFailure(
      [{
        path: ["analysis"],
        code: "invalid_type",
        message: "Risk, optimization, and evidence results are required.",
      }],
      "Job sheet inputs failed validation."
    );
  }

  if (!demoModeEnabled()) {
    return unavailable(
      "Job sheet generation",
      "It requires verified risk, optimization, evidence, and explanation results."
    );
  }

  const jobSheet = buildDraftJobSheet({
    jobId: "JOB-DEMO-42",
    plantId: "PLANT-DEMO-01",
    order,
    conditions,
    conditionsProvenance: {
      readingId: "READ-DEMO-001",
      timestamp: "2026-10-11T12:00:00.000Z",
      plantId: "PLANT-DEMO-01",
      source: "simulated",
      recordedSource: "local mock demo",
      retrievedAt: new Date().toISOString(),
      ageSeconds: Math.max(0, Math.floor((Date.now() - Date.parse("2026-10-11T12:00:00Z")) / 1000)),
      freshness: "stale",
    },
    optimization: analysis.optimization ?? demoOptimizationFor(order, conditions),
    evidence: analysis.evidence ?? demoEvidenceFor(order, conditions),
    explanation: analysis.explanation ?? DEMO_EXPLANATION,
  });

  if (!jobSheet.ok) {
    return { ok: false, error: jobSheet.error };
  }

  return { ok: true, jobSheet: jobSheet.jobSheet };
}

// Recorded Vertex AI responses for the offline evals (05 section 7). None of this
// came from a live call. The evals put these behind the real Vertex client and
// router through a fake fetch, so the code under test is the shipped code and
// no request leaves the process or spends a Gemini attempt.

const OFFLINE_USAGE = Object.freeze({ promptTokenCount: 120, candidatesTokenCount: 12, totalTokenCount: 132 });

export function vertexTextResponse(text) {
  return { candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }], usageMetadata: OFFLINE_USAGE };
}

export function vertexFunctionCallResponse(calls) {
  return {
    candidates: [{
      content: { role: "model", parts: calls.map(({ name, args = {} }) => ({ functionCall: { name, args } })) },
      finishReason: "STOP",
    }],
    usageMetadata: OFFLINE_USAGE,
  };
}

const httpFault = (status) => ({ status, json: { error: { code: status, status: "FAULT", message: "Injected offline fault." } } });

/**
 * The faults of RAI-7 and spec J11, as a transport sees them. "timeout" rejects
 * the fetch the way an expired AbortSignal.timeout does. "cap_reached" never
 * reaches the transport, because the budget wrapper stops it first; if a capped
 * call ever got through, it would be recorded and fail the case's request count.
 */
export const VERTEX_FAULTS = Object.freeze({
  http_429: httpFault(429),
  http_500: httpFault(500),
  http_503: httpFault(503),
  timeout: { reject: () => new DOMException("The operation timed out.", "TimeoutError") },
  safety_block: { json: { candidates: [{ finishReason: "SAFETY", safetyRatings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", probability: "MEDIUM", blocked: true }] }], usageMetadata: OFFLINE_USAGE } },
  prompt_blocked: { json: { promptFeedback: { blockReason: "SAFETY", safetyRatings: [{ category: "HARM_CATEGORY_HARASSMENT", probability: "HIGH", blocked: true }] }, usageMetadata: OFFLINE_USAGE } },
  invalid_json: { json: vertexTextResponse("{\"label\": ") },
  cap_reached: { reject: () => new Error("The budget wrapper must stop a capped call before the transport.") },
});

/**
 * A fetch stand-in that records every request and answers from `respond`, which
 * is a list used in order or a function of the request. Each answer is a Vertex
 * payload, `{ status, json }`, or `{ reject }` to fail the fetch itself.
 */
export function createRecordingVertexTransport(respond) {
  const requests = [];
  async function fetchImpl(url, init = {}) {
    const request = { url: String(url), method: init.method, body: JSON.parse(init.body) };
    requests.push(request);
    const answer = typeof respond === "function" ? respond(request, requests.length - 1) : respond[requests.length - 1];
    if (answer === undefined) throw new Error(`No recorded Vertex response for request ${requests.length}.`);
    if (answer.reject) throw answer.reject();
    const spec = Object.hasOwn(answer, "json") || Object.hasOwn(answer, "status") ? answer : { json: answer };
    return Response.json(spec.json ?? {}, { status: spec.status ?? 200 });
  }
  return { fetchImpl, requests };
}
