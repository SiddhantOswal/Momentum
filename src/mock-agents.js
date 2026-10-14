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

const DEMO_EXPLANATION = "Synthetic demo mode: this is a deterministic local workflow result for presentation and validation only. It does not represent a live model inference, plant telemetry, or verified savings outcome.";

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
      reason: "Synthetic demo: reduce roll temperature to lower WARP risk.",
    },
    {
      lever: "dryingHours",
      from: baselineLevers.dryingHours,
      to: bestLevers.dryingHours,
      reason: "Synthetic demo: shorten drying to improve crack stability.",
    },
  ].filter((change) => change.from !== change.to);
  return {
    baseline: { levers: baselineLevers, risk: baseline },
    best: { levers: bestLevers, risk: best },
    changes,
    savings: { kg: Math.max(0, baseline.totalScrapKg - best.totalScrapKg), inr: Math.max(0, baseline.scrapCost - best.scrapCost) },
    note: "Synthetic demo mode: optimization values are illustrative and not a live plant recommendation.",
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
    description: "Synthetic demo lot used to validate the UI flow without live production data.",
    shift: conditions.shift ?? DEMO_CONDITIONS.shift,
    ambientRhPct: conditions.ambientRhPct ?? DEMO_CONDITIONS.ambientRhPct,
    paperType: order.paperType ?? DEMO_ORDER.paperType,
    paperSupplier: order.paperSupplier ?? DEMO_ORDER.paperSupplier,
    totalScrapPct: risk.totalScrapPct,
    totalScrapKg: risk.totalScrapKg,
    scrapCost: risk.scrapCost,
    currency: risk.currency,
    distance: 0.8,
    operatorNote: "Synthetic evidence only.",
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
      recordedSource: "synthetic demo",
      retrievedAt: "2026-10-11T12:00:00.000Z",
      ageSeconds: 60,
      freshness: "unassessed",
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
      source: "live",
      recordedSource: "synthetic demo",
      retrievedAt: "2026-10-11T12:00:00.000Z",
      ageSeconds: 60,
      freshness: "fresh",
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
