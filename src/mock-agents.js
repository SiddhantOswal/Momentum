import {
  CompletePurchaseOrderSchema,
  ConditionsValidationApiResponseSchema,
  LeversSchema,
  OrderExtractionApiResponseSchema,
  RunConditionsSchema,
  ServiceUnavailableSchema,
  ValidationFailureSchema,
} from "./schemas.js";
import { extractOrderFromMock } from "./order-extraction.js";

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

  return ConditionsValidationApiResponseSchema.parse({
    ok: true,
    agent: "getConditions",
    source: "local-validation",
    isRealModelPrediction: false,
    data: parsed.data,
  });
}

export function predictRisk(order, conditions, levers) {
  const results = [
    { key: "order", result: CompletePurchaseOrderSchema.safeParse(order) },
    { key: "conditions", result: RunConditionsSchema.safeParse(conditions) },
    { key: "levers", result: LeversSchema.safeParse(levers) },
  ];
  const issues = validationIssues(...results);

  if (issues.length > 0) {
    return validationFailure(issues);
  }

  return unavailable(
    "Risk prediction",
    "It requires the configured BigQuery ML models and predict query."
  );
}

export function optimizeLevers(order, conditions) {
  const results = [
    { key: "order", result: CompletePurchaseOrderSchema.safeParse(order) },
    { key: "conditions", result: RunConditionsSchema.safeParse(conditions) },
  ];
  const issues = validationIssues(...results);

  if (issues.length > 0) {
    return validationFailure(issues);
  }

  return unavailable(
    "Lever optimization",
    "It requires the configured BigQuery ML models and optimizer query."
  );
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

  return unavailable(
    "Similar-run retrieval",
    "It requires the configured BigQuery evidence query and historical lot data."
  );
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

  if (!riskEvidence || typeof riskEvidence !== "object") {
    return validationFailure(
      [{
        path: ["riskEvidence"],
        code: "invalid_type",
        message: "Model attributions and similar-run evidence are required.",
      }],
      "Risk explanation inputs failed validation."
    );
  }

  return unavailable(
    "Risk explanation",
    "It requires Gemini and validated model-attribution and similar-run evidence."
  );
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

  if (!analysis || typeof analysis !== "object") {
    return validationFailure(
      [{
        path: ["analysis"],
        code: "invalid_type",
        message: "Risk, optimization, and evidence results are required.",
      }],
      "Job sheet inputs failed validation."
    );
  }

  return unavailable(
    "Job sheet generation",
    "It requires verified risk, optimization, evidence, and explanation results."
  );
}
