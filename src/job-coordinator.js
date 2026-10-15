import { randomUUID } from "node:crypto";
import {
  LeversSchema,
  OperatorItemConfirmationSchema,
  OptimizationResultSchema,
  OrderOperatorFieldsSchema,
  OrderProfileSchema,
  RiskResultSchema,
  RunConditionsSchema,
  SimilarRunSchema,
  SensorProvenanceSchema,
} from "./schemas.js";
import { buildDraftJobSheet } from "./job-sheet-builder.js";

const REQUIRED_OPERATOR_FIELDS = ["orderId", "paperType", "paperSupplier"];

function validationFailure(message, issues) {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message,
      issues: issues.map((issue) => ({
        field: issue.path.join(".") || "request",
        path: issue.path,
        code: issue.code,
        message: issue.message,
      })),
    },
  };
}

function traceErrorCode(result) {
  const code = result?.error?.code;
  return ["SERVICE_UNAVAILABLE", "VALIDATION_ERROR", "TIMEOUT", "CANCELLED"].includes(code)
    ? code
    : "TOOL_ERROR";
}

function predictionMatchesBaseline(prediction, baseline) {
  const sameRoundedValue = (left, right, tolerance) =>
    Math.abs(left - right) <= tolerance;
  return Object.keys(baseline.risk.ratesPct).every((defect) =>
    sameRoundedValue(prediction.ratesPct[defect], baseline.risk.ratesPct[defect], 0.001)) &&
    prediction.totalScrapPct !== undefined &&
    sameRoundedValue(prediction.totalScrapPct, baseline.risk.totalScrapPct, 0.01) &&
    sameRoundedValue(prediction.totalScrapKg, baseline.risk.totalScrapKg, 0.1) &&
    sameRoundedValue(prediction.scrapCost, baseline.risk.scrapCost, 1) &&
    prediction.currency === baseline.risk.currency &&
    prediction.primaryDefect === baseline.risk.primaryDefect;
}

function predictionIsInternallyConsistent(prediction) {
  const rates = Object.entries(prediction.ratesPct);
  const total = rates.reduce((sum, [, rate]) => sum + rate, 0);
  const primary = rates.find(([, rate]) => rate === Math.max(...Object.values(prediction.ratesPct)))?.[0];
  return Math.abs(total - prediction.totalScrapPct) <= 0.01 &&
    primary === prediction.primaryDefect;
}

function optimizerMatchesPlan(optimization, plannedLevers) {
  if (Object.keys(plannedLevers).some((lever) =>
    optimization.baseline.levers[lever] !== plannedLevers[lever])) {
    return false;
  }
  const expectedChanges = Object.keys(plannedLevers)
    .filter((lever) => optimization.baseline.levers[lever] !== optimization.best.levers[lever]);
  return expectedChanges.length === optimization.changes.length &&
    new Set(optimization.changes.map((change) => change.lever)).size === optimization.changes.length &&
    optimization.changes.every((change) => expectedChanges.includes(change.lever) &&
      change.from === optimization.baseline.levers[change.lever] &&
      change.to === optimization.best.levers[change.lever]);
}

/**
 * Runs the source-defined workflow stages in a fixed order. Integrations are
 * injected so missing Om-owned query tools remain explicit unavailable steps;
 * this coordinator never substitutes sample values or creates persistent data.
 */
export function createJobCoordinator({ services, traceRegistry, plantId, allowSyntheticDemoConditions = false } = {}) {
  if (!services || typeof services !== "object" || Array.isArray(services) ||
      !traceRegistry || typeof traceRegistry.startRun !== "function" ||
      typeof traceRegistry.startTool !== "function" ||
      typeof traceRegistry.finishTool !== "function" ||
      typeof traceRegistry.finishRun !== "function") {
    throw new TypeError("Job services and a trace registry are required.");
  }

  for (const name of ["extractOrder", "currentConditions", "predictRisk", "optimizeRisk"]) {
    if (typeof services[name] !== "function") {
      throw new TypeError(`The ${name} service port is required.`);
    }
  }

  return async function prepareJob({
    file,
    operatorFields,
    operatorItemConfirmation,
    shift,
    levers,
    manualConditions,
    conditionsConfirmed,
    jobId,
    purchaseOrderReview,
    signal,
  } = {}) {
    const parsedOperatorFields = OrderOperatorFieldsSchema.safeParse(operatorFields);
    const operatorIssues = parsedOperatorFields.success ? [] : parsedOperatorFields.error.issues;
    for (const field of REQUIRED_OPERATOR_FIELDS) {
      if (parsedOperatorFields.success && parsedOperatorFields.data[field] === undefined) {
        operatorIssues.push({ path: [field], code: "required", message: `${field} must be confirmed by the operator.` });
      }
    }
    const parsedLevers = LeversSchema.safeParse(levers);
    const parsedItemConfirmation = OperatorItemConfirmationSchema.safeParse(operatorItemConfirmation);
    const issues = [
      ...operatorIssues,
      ...(parsedItemConfirmation.success ? [] : parsedItemConfirmation.error.issues.map((issue) => ({
        ...issue,
        path: ["operatorItemConfirmation", ...issue.path],
      }))),
      ...(shift === "DAY" || shift === "NIGHT"
        ? []
        : [{ path: ["shift"], code: "invalid_value", message: "The operator must select DAY or NIGHT." }]),
      ...(parsedLevers.success ? [] : parsedLevers.error.issues.map((issue) => ({
        ...issue,
        path: ["levers", ...issue.path],
      }))),
      ...(conditionsConfirmed === true ? [] : [{
        path: ["conditionsConfirmed"],
        code: "confirmation_required",
        message: "A supervisor must confirm or edit the condition values before prediction.",
      }]),
    ];
    if (!file || typeof file.arrayBuffer !== "function") {
      issues.push({ path: ["file"], code: "required", message: "A purchase-order PDF or JPEG scan is required." });
    }
    if (issues.length) {
      return validationFailure("Job preparation requires verified operator inputs.", issues);
    }

    const runId = traceRegistry.startRun();
    const context = {
      file,
      operatorFields: parsedOperatorFields.data,
      shift,
      levers: parsedLevers.data,
      manualConditions,
      conditionsConfirmed,
      purchaseOrderReview,
      signal,
    };

    async function execute(tool, operation) {
      const started = traceRegistry.startTool(runId, tool);
      try {
        const result = await operation();
        if (!result || result.ok !== true) {
          const code = traceErrorCode(result);
          traceRegistry.finishTool(runId, started.toolCallId, code === "SERVICE_UNAVAILABLE" ? "unavailable" : "failed", code);
          traceRegistry.finishRun(runId, signal?.aborted ? "cancelled" : "failed");
          return { stopped: true, result: { ...result, runId, blockedAt: tool } };
        }
        traceRegistry.finishTool(runId, started.toolCallId, "succeeded");
        return { stopped: false, result };
      } catch (error) {
        const code = error?.name === "AbortError" || signal?.aborted ? "CANCELLED" : "TOOL_ERROR";
        traceRegistry.finishTool(runId, started.toolCallId, "failed", code);
        traceRegistry.finishRun(runId, code === "CANCELLED" ? "cancelled" : "failed");
        if (code === "CANCELLED") throw error;
        return {
          stopped: true,
          result: {
            ok: false,
            error: { code: "SERVICE_UNAVAILABLE", message: `${tool} failed; retry after the service is available.` },
            runId,
            blockedAt: tool,
          },
        };
      }
    }

    const extracted = await execute("extractOrder", async () => {
      if (context.purchaseOrderReview) {
        if (typeof services.confirmPurchaseOrderReview !== "function") {
          return {
            ok: false,
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "The purchase-order review confirmation service is not configured.",
            },
          };
        }
        return services.confirmPurchaseOrderReview({
          ...context.purchaseOrderReview,
          fileBytes: new Uint8Array(await context.file.arrayBuffer()),
          operatorFields: context.operatorFields,
          lineIndex: parsedItemConfirmation.data.lineIndex,
          itemCode: parsedItemConfirmation.data.itemCode,
          quantity: parsedItemConfirmation.data.quantity,
          confirmedSourceLine: context.purchaseOrderReview.confirmedSourceLine === true,
          signal,
        });
      }
      return services.extractOrder({
        file: context.file,
        operatorFields: context.operatorFields,
        selectedLineIndex: parsedItemConfirmation.data.lineIndex,
        confirmedItemCode: parsedItemConfirmation.data.itemCode,
        signal,
      });
    });
    if (extracted.stopped) return extracted.result;
    let order = extracted.result.orderProfile;
    let purchaseOrderLines;
    let selectedLineIndex;
    let purchaseOrderSourcePage;
    const purchaseOrderOutput = () => purchaseOrderLines === undefined
      ? {}
      : {
        purchaseOrderDocument: extracted.result.purchaseOrderDocument,
        purchaseOrderLines,
        selectedLineIndex,
      };
    if (Array.isArray(extracted.result.lines)) {
      purchaseOrderLines = extracted.result.lines;
      selectedLineIndex = parsedItemConfirmation.data.lineIndex ??
        (purchaseOrderLines.length === 1 ? 0 : undefined);
      const selectedLine = selectedLineIndex === undefined
        ? undefined
        : purchaseOrderLines[selectedLineIndex];
      if (selectedLineIndex === undefined || !selectedLine) {
        traceRegistry.finishRun(runId, "failed");
        return {
          ...validationFailure(
          "Select a valid line from the purchase order before continuing.",
          [{
            path: ["operatorItemConfirmation", "lineIndex"],
            code: "line_selection_required",
            message: "A valid extracted PO line must be selected.",
          }]
          ),
          runId,
          blockedAt: "extractOrder",
          purchaseOrderLines,
        };
      }
      if (!Number.isSafeInteger(selectedLine.sourcePage) || selectedLine.sourcePage < 1) {
        traceRegistry.finishRun(runId, "failed");
        return {
          ...validationFailure(
            "The selected PO line has no validated source-page provenance.",
            [{
              path: ["purchaseOrderLines", selectedLineIndex, "sourcePage"],
              code: "source_page_missing",
              message: "Review the original PO page and re-extract the line before continuing.",
            }]
          ),
          runId,
          blockedAt: "extractOrder",
          purchaseOrderLines,
          selectedLineIndex,
        };
      }
      purchaseOrderSourcePage = selectedLine.sourcePage;
      if (selectedLine.status !== "MATCHED" && selectedLine.status !== "AMBIGUOUS") {
        traceRegistry.finishRun(runId, "failed");
        return {
          ...validationFailure(
            "The selected PO line is unresolved and cannot be sent to production preparation.",
            [{
              path: ["operatorItemConfirmation", "lineIndex"],
              code: `line_${selectedLine.status.toLowerCase()}`,
              message: "Resolve the selected line's item code and quantity before continuing.",
            }]
          ),
          runId,
          blockedAt: "extractOrder",
          purchaseOrderLines,
          selectedLineIndex,
        };
      }
      const confirmedCode = parsedItemConfirmation.data.itemCode;
      const confirmationMatches = context.purchaseOrderReview
        ? selectedLine.status === "MATCHED" &&
          selectedLine.resolvedItemCode === confirmedCode &&
          selectedLine.confirmedItemCode === confirmedCode &&
          selectedLine.confirmedQuantity === parsedItemConfirmation.data.quantity &&
          selectedLine.orderProfile?.quantity === parsedItemConfirmation.data.quantity
        : selectedLine.status === "MATCHED"
        ? confirmedCode === selectedLine.extractedItemCode &&
          selectedLine.resolvedItemCode === confirmedCode
        : selectedLine.status === "AMBIGUOUS" &&
          selectedLine.candidates.includes(confirmedCode) &&
          selectedLine.resolvedItemCode === confirmedCode;
      if (!confirmationMatches ||
          (!context.purchaseOrderReview && selectedLine.quantity !== parsedItemConfirmation.data.quantity)) {
        traceRegistry.finishRun(runId, "failed");
        return {
          ...validationFailure(
            "The operator confirmation does not match the selected extracted PO line.",
            [{
              path: ["operatorItemConfirmation"],
              code: "extracted_line_mismatch",
              message: "Confirm the selected line's item code and quantity from this purchase order.",
            }]
          ),
          runId,
          blockedAt: "extractOrder",
          ...purchaseOrderOutput(),
        };
      }
      order = selectedLine.orderProfile;
    }
    if ((purchaseOrderLines === undefined && extracted.result.needsClarification) ||
        extracted.result.missingFields?.length) {
      traceRegistry.finishRun(runId, "failed");
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "The extracted item does not have a complete authoritative profile.",
          issues: (extracted.result.missingFields ?? []).map((field) => ({
            field,
            path: [field],
            code: "missing_authoritative_value",
            message: `Supply an authoritative ${field} value before continuing.`,
          })),
        },
        runId,
        blockedAt: "extractOrder",
        orderProfile: order,
        ...purchaseOrderOutput(),
      };
    }
    if (parsedItemConfirmation.data.itemCode !== order?.itemCode ||
        parsedItemConfirmation.data.quantity !== order?.quantity) {
      traceRegistry.finishRun(runId, "failed");
      return {
        ...validationFailure("The operator-confirmed item and quantity do not match the extracted purchase order.", [{
          path: ["operatorItemConfirmation"],
          code: "extracted_item_mismatch",
          message: "Recheck the extracted item code and quantity before preparing the job.",
        }]),
        runId,
        blockedAt: "extractOrder",
        orderProfile: order,
        ...purchaseOrderOutput(),
      };
    }
    const parsedOrder = OrderProfileSchema.safeParse(order);
    if (!parsedOrder.success) {
      traceRegistry.finishRun(runId, "failed");
      return {
        ...validationFailure("The item catalog returned an invalid production-order profile.", parsedOrder.error.issues),
        runId,
        blockedAt: "extractOrder",
        ...purchaseOrderOutput(),
      };
    }

    const manualConditionsParsed = manualConditions === undefined
      ? undefined
      : RunConditionsSchema.safeParse({ ...manualConditions, shift: context.shift });
    if (manualConditionsParsed && !manualConditionsParsed.success) {
      traceRegistry.finishRun(runId, "failed");
      return {
        ...validationFailure("Manually entered conditions do not match the run-conditions contract.", manualConditionsParsed.error.issues),
        runId,
        blockedAt: "getConditions",
        ...purchaseOrderOutput(),
      };
    }
    const conditionsResult = await execute("getConditions", () => manualConditionsParsed
      ? { ok: true, data: manualConditionsParsed.data, sensorSource: "manual-entry" }
      : services.currentConditions({ shift: context.shift, signal }));
    if (conditionsResult.stopped) {
      return { ...conditionsResult.result, ...purchaseOrderOutput() };
    }
    const parsedConditions = RunConditionsSchema.safeParse(conditionsResult.result.data);
    if (!parsedConditions.success) {
      traceRegistry.finishRun(runId, "failed");
      return {
        ...validationFailure("The stored sensor result does not match the run-conditions contract.", parsedConditions.error.issues),
        runId,
        blockedAt: "getConditions",
        ...purchaseOrderOutput(),
      };
    }
    const conditions = parsedConditions.data;
    const provenanceResult = conditionsResult.result.provenance === undefined
      ? undefined
      : SensorProvenanceSchema.safeParse(conditionsResult.result.provenance);
    if (provenanceResult && !provenanceResult.success) {
      traceRegistry.finishRun(runId, "failed");
      return {
        ...validationFailure("The stored sensor provenance does not match its contract.", provenanceResult.error.issues),
        runId,
        blockedAt: "getConditions",
        ...purchaseOrderOutput(),
      };
    }
    const conditionsProvenance = provenanceResult?.data;
    const manuallyEnteredConditions = manualConditionsParsed !== undefined;
    const conditionsOutput = {
      ...conditions,
      conditionSource: manuallyEnteredConditions ? "manual-entry" : "simulated-sensor",
      supervisorConfirmed: true,
      ...(conditionsProvenance === undefined ? {} : { provenance: conditionsProvenance }),
    };
    const simulatedSensorConditions = conditionsProvenance?.source === "simulated" &&
      conditionsProvenance.recordedSource !== "not recorded in sensor_readings row";
    if (!manuallyEnteredConditions && !simulatedSensorConditions) {
      traceRegistry.finishRun(runId, "failed");
      return {
        ...validationFailure(
          "Prototype prediction requires supervisor-confirmed manual conditions or an explicitly simulated sensor reading.",
          [{
            path: ["conditions", "provenance"],
            code: "sensor_conditions_unverified",
            message: "Use manually entered values or an explicitly labeled simulated reading; unverified sources cannot be used.",
          }]
        ),
        runId,
        blockedAt: "getConditions",
        completedStages: ["extractOrder", "getConditions"],
        orderProfile: order,
        ...purchaseOrderOutput(),
        conditions: conditionsOutput,
      };
    }

    const prediction = await execute("predictRisk", () => services.predictRisk({
      order,
      conditions: {
        shift: conditions.shift,
        ambientRhPct: conditions.ambientRhPct,
        ambientTempC: conditions.ambientTempC,
        paperMoisturePct: conditions.paperMoisturePct,
      },
      conditionsConfirmed,
      levers: context.levers,
      signal,
    }));
    if (prediction.stopped) {
      return { ...prediction.result, ...purchaseOrderOutput() };
    }

    const risk = RiskResultSchema.safeParse({
      ratesPct: prediction.result.ratesPct,
      totalScrapPct: prediction.result.totalScrapPct,
      totalScrapKg: prediction.result.totalScrapKg,
      scrapCost: prediction.result.scrapCost,
      currency: prediction.result.currency,
      primaryDefect: prediction.result.primaryDefect,
    });
    if (!risk.success || !predictionIsInternallyConsistent(risk.data)) {
      traceRegistry.finishRun(runId, "failed");
      return {
        ...validationFailure(
          "The prediction did not match the five-defect risk contract.",
          risk.success ? [{
            path: ["prediction"],
            code: "risk_summary_mismatch",
            message: "Defect rates must sum to total scrap, and the primary defect must have the highest rate.",
          }] : risk.error.issues
        ),
        runId,
        blockedAt: "predictRisk",
        completedStages: ["extractOrder", "getConditions"],
        orderProfile: order,
        ...purchaseOrderOutput(),
        conditions: conditionsOutput,
        ...purchaseOrderOutput(),
      };
    }

    if (prediction.result.isRealModelPrediction === true &&
        prediction.result.modelAcceptance?.status !== "accepted") {
      traceRegistry.finishRun(runId, "failed");
      return {
        ok: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "The current five-model set has not met the required, version-linked acceptance criteria; production preparation is blocked.",
        },
        runId,
        blockedAt: "modelAcceptance",
        completedStages: ["extractOrder", "getConditions", "predictRisk"],
        orderProfile: order,
        ...purchaseOrderOutput(),
        conditions: conditionsOutput,
        prediction: risk.data,
        modelProvenance: prediction.result.modelProvenance,
        modelAcceptance: prediction.result.modelAcceptance,
      };
    }

    const optimization = await execute("optimizeLevers", () => services.optimizeRisk({
      order,
      conditions,
      conditionsConfirmed,
      levers: context.levers,
      signal,
    }));
    if (optimization.stopped) {
      return {
        ...optimization.result,
        completedStages: ["extractOrder", "getConditions", "predictRisk"],
        orderProfile: order,
        ...purchaseOrderOutput(),
        conditions: conditionsOutput,
        prediction: risk.data,
      };
    }
    const optimizationOutput = OptimizationResultSchema.safeParse({
      baseline: optimization.result.baseline,
      best: optimization.result.best,
      changes: optimization.result.changes,
      savings: optimization.result.savings,
      ...(optimization.result.modelPredicted === true ? { modelPredicted: true } : {}),
      ...(optimization.result.note === undefined ? {} : { note: optimization.result.note }),
    });
    if (!optimizationOutput.success) {
      traceRegistry.finishRun(runId, "failed");
      return {
        ...validationFailure("The optimizer result did not match its contract.", optimizationOutput.error.issues),
        runId,
        blockedAt: "optimizeLevers",
        completedStages: ["extractOrder", "getConditions", "predictRisk"],
        orderProfile: order,
        ...purchaseOrderOutput(),
        conditions: conditionsOutput,
        prediction: risk.data,
      };
    }
    const optimizationData = optimizationOutput.data;
    if (!predictionMatchesBaseline(risk.data, optimizationData.baseline) ||
        !optimizerMatchesPlan(optimizationData, context.levers)) {
      traceRegistry.finishRun(runId, "failed");
      return {
        ...validationFailure(
          "The optimizer baseline or recommended changes do not match the validated plan.",
          [{
            path: ["optimization", "baseline"],
            code: "prediction_baseline_mismatch",
            message: "The optimizer baseline must match the planned settings and prediction, and its changes must match baseline versus recommendation.",
          }]
        ),
        runId,
        blockedAt: "optimizeLevers",
        completedStages: ["extractOrder", "getConditions", "predictRisk"],
        orderProfile: order,
        ...purchaseOrderOutput(),
        conditions: conditionsOutput,
        prediction: risk.data,
      };
    }

    const completedStages = ["extractOrder", "getConditions", "predictRisk", "optimizeLevers"];
    const similarRuns = await execute("findSimilarRuns", () => services.findSimilarRuns
      ? services.findSimilarRuns({ order, conditions, prediction: risk.data, signal })
      : ({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Om's similar-run query and result contract are not configured." } }));
    if (similarRuns.stopped) {
      return {
        ...similarRuns.result,
        completedStages,
        orderProfile: order,
        ...purchaseOrderOutput(),
        conditions: conditionsOutput,
        prediction: risk.data,
        optimization: optimizationData,
      };
    }
    const parsedEvidence = Array.isArray(similarRuns.result.evidence)
      ? SimilarRunSchema.array().max(5).safeParse(similarRuns.result.evidence)
      : undefined;
    if (!parsedEvidence?.success) {
      traceRegistry.finishRun(runId, "failed");
      return {
        ...validationFailure(
          "Historical similar-run evidence did not match its source contract.",
          parsedEvidence?.error.issues ?? [{
            path: ["evidence"],
            code: "required",
            message: "The similar-run query must return a validated evidence array.",
          }]
        ),
        runId,
        blockedAt: "findSimilarRuns",
        completedStages,
        orderProfile: order,
        ...purchaseOrderOutput(),
        conditions: conditionsOutput,
        prediction: risk.data,
        optimization: optimizationData,
      };
    }
    const evidence = parsedEvidence.data ?? [];
    completedStages.push("findSimilarRuns");

    const explanation = await execute("explainRisk", () => services.explainRisk
      ? services.explainRisk({
        order,
        conditions,
        prediction: risk.data,
        optimization: optimizationData,
        evidence,
        riskEvidence: {
          attributions: [],
          similarRuns: evidence,
        },
        signal,
      })
      : ({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "The approved risk-explanation service is not configured." } }));
    if (explanation.stopped) {
      return {
        ...explanation.result,
        completedStages,
        orderProfile: order,
        ...purchaseOrderOutput(),
        conditions: conditionsOutput,
        prediction: risk.data,
        optimization: optimizationData,
        evidence,
      };
    }
    if (typeof explanation.result.explanation !== "string" ||
        explanation.result.explanation.trim().length === 0) {
      traceRegistry.finishRun(runId, "failed");
      return {
        ...validationFailure(
          "The explanation service returned no validated explanation.",
          [{
            path: ["explanation"],
            code: "invalid_value",
            message: "A non-empty evidence-grounded explanation is required.",
          }]
        ),
        runId,
        blockedAt: "explainRisk",
        completedStages,
        orderProfile: order,
        ...purchaseOrderOutput(),
        conditions: conditionsOutput,
        prediction: risk.data,
        optimization: optimizationData,
        evidence,
      };
    }
    completedStages.push("explainRisk");

    const generated = await execute("generateJobSheet", async () => {
      const built = buildDraftJobSheet({
        jobId: jobId ?? randomUUID(),
        ...(plantId === undefined ? {} : { plantId }),
        order: purchaseOrderLines === undefined
          ? order
          : {
            ...order,
            ...(extracted.result.purchaseOrderDocument?.poNumber ? { sourcePoNumber: extracted.result.purchaseOrderDocument.poNumber } : {}),
            purchaseOrderLineIndex: selectedLineIndex,
            purchaseOrderSourcePage,
          },
        conditions,
        conditionsProvenance,
        conditionSource: conditionsOutput.conditionSource,
        supervisorConfirmed: conditionsOutput.supervisorConfirmed,
        optimization: optimizationData,
        evidence: evidence ?? [],
        explanation: `${optimizationData.modelPredicted === true
          ? "Savings are model-predicted estimates, not observed production outcomes."
          : "Savings are optimizer-reported estimates, not verified production outcomes."} ${
          optimizationData.note === undefined ? "" : `${optimizationData.note} `
        }${explanation.result.explanation.trim()}`,
      });
      return built.ok
        ? { ok: true, jobSheet: built.jobSheet }
        : { ok: false, error: built.error };
    });
    if (generated.stopped) {
      return {
        ...generated.result,
        completedStages,
        orderProfile: order,
        ...purchaseOrderOutput(),
        conditions: conditionsOutput,
        prediction: risk.data,
        optimization: optimizationData,
        evidence,
        explanation: explanation.result.explanation,
      };
    }
    completedStages.push("generateJobSheet");
    traceRegistry.finishRun(runId, "completed");
    return {
      ok: true,
      runId,
      completedStages,
      orderProfile: order,
      ...purchaseOrderOutput(),
      conditions: conditionsOutput,
      prediction: risk.data,
      optimization: optimizationData,
      evidence,
      explanation: explanation.result.explanation,
      jobSheet: generated.result.jobSheet,
    };
  };
}
