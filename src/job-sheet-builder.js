import { randomUUID } from "node:crypto";
import {
  JobIdSchema,
  JobSheetOrderSchema,
  JobSheetSchema,
  OptimizationResultSchema,
  RunConditionsSchema,
  SensorProvenanceSchema,
  SimilarRunSchema,
} from "./schemas.js";

/**
 * Assemble the deterministic portion of a DRAFT JobSheet from validated
 * workflow outputs. Explanations and evidence must be supplied by their real
 * workflow services; this module never invents either one.
 */
export function buildDraftJobSheet({
  jobId = randomUUID(),
  plantId,
  order,
  conditions,
  conditionsProvenance,
  conditionSource,
  supervisorConfirmed,
  optimization,
  evidence,
  explanation,
} = {}) {
  const issues = [];
  const check = (schema, value, field) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      issues.push(...parsed.error.issues.map((issue) => ({
        ...issue,
        path: [field, ...issue.path],
      })));
      return undefined;
    }
    return parsed.data;
  };

  const parsedJobId = check(JobIdSchema, jobId, "jobId");
  const parsedPlantId = plantId === undefined ? undefined : check(JobIdSchema, plantId, "plantId");
  const parsedOrder = check(JobSheetOrderSchema, order, "order");
  const parsedConditions = check(RunConditionsSchema, conditions, "conditions");
  const parsedConditionsProvenance = conditionsProvenance === undefined
    ? undefined
    : check(SensorProvenanceSchema, conditionsProvenance, "conditionsProvenance");
  const jobSheetConditions = parsedConditions === undefined
    ? undefined
    : {
      ...parsedConditions,
      ...(parsedConditionsProvenance === undefined
        ? {}
        : { provenance: parsedConditionsProvenance }),
      ...(conditionSource === undefined ? {} : { conditionSource }),
      ...(supervisorConfirmed === undefined ? {} : { supervisorConfirmed }),
    };
  const parsedOptimization = check(OptimizationResultSchema, optimization, "optimization");
  if (evidence !== undefined && !Array.isArray(evidence)) {
    issues.push({ path: ["evidence"], code: "invalid_type", message: "Evidence must be an array." });
  }
  const parsedEvidence = Array.isArray(evidence)
    ? evidence.map((entry, index) => check(SimilarRunSchema, entry, `evidence.${index}`))
    : evidence;
  if (typeof explanation !== "string" || explanation.trim().length === 0) {
    issues.push({ path: ["explanation"], code: "required", message: "A non-empty explanation from the workflow is required." });
  }

  if (issues.length) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validated workflow outputs are required to assemble a draft JobSheet.",
        issues: issues.map((issue) => ({
          field: issue.path.map(String).join("."),
          path: issue.path,
          code: issue.code,
          message: issue.message,
        })),
      },
    };
  }

  const result = JobSheetSchema.safeParse({
    jobId: parsedJobId,
    ...(parsedPlantId === undefined ? {} : { plantId: parsedPlantId }),
    order: parsedOrder,
    conditions: jobSheetConditions,
    baseline: parsedOptimization.baseline,
    recommended: parsedOptimization.best,
    changes: parsedOptimization.changes,
    ...(parsedEvidence === undefined ? {} : { evidence: parsedEvidence }),
    explanation: explanation.trim(),
    savings: parsedOptimization.savings,
    status: "DRAFT",
  });
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Assembled JobSheet failed its schema validation.",
        issues: result.error.issues.map((issue) => ({
          field: issue.path.map(String).join("."),
          path: issue.path,
          code: issue.code,
          message: issue.message,
        })),
      },
    };
  }
  return { ok: true, jobSheet: result.data };
}
