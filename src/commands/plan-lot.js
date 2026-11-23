import { demoJobIdentity } from "../hackathon-demo-auth.js";
import { createJobRequestIdentity } from "../job-idempotency.js";
import {
  LeversSchema,
  ManualRunConditionsSchema,
  OperatorItemConfirmationSchema,
  OrderOperatorFieldsSchema,
} from "../schemas.js";
import { liveActor, liveLot } from "./live-events.js";
import { readPurchaseOrderUpload } from "./purchase-order-upload.js";
import { validationFailure } from "./validation.js";

/**
 * Plans one lot from a purchase order, confirmed item, shift, conditions and
 * machine settings, and stores the draft JobSheet. `fields` holds the request
 * as multipart fields (strings plus the `file` upload), exactly as the
 * dashboard form sends them; `confirmedLineIndex` is one-based.
 */
export async function planLot({ fields = {}, idempotencyKey } = {}, {
  principal,
  signal,
  submitJob,
  liveStore,
  hackathonAuth,
  demoMode,
  executionMode,
  purchaseOrderPolicy,
}) {
  const upload = await readPurchaseOrderUpload(fields.file, {
    invalidMessage: "Job request is invalid.",
    executionMode,
    purchaseOrderPolicy,
  });
  if (!upload.ok) return upload;
  const { fileBytes } = upload;

  const rawOperatorFields = {};
  for (const field of ["orderId", "paperType", "paperSupplier"]) {
    const value = fields[field];
    if (typeof value === "string" && value.trim() !== "") rawOperatorFields[field] = value;
  }
  const operatorFields = OrderOperatorFieldsSchema.safeParse(rawOperatorFields);
  const numericLevers = new Set([
    "sfSpeedMpm", "rollTempC", "gumViscositySec", "dryingHours", "printSpeedSpm",
  ]);
  const rawLevers = {};
  for (const field of [
    "sfSpeedMpm", "rollTempC", "gumApplication", "gumViscositySec",
    "pastingPressure", "dryingHours", "printSpeedSpm",
  ]) {
    const value = fields[field];
    if (typeof value === "string" && value.trim() !== "") {
      rawLevers[field] = numericLevers.has(field) ? Number(value) : value;
    }
  }
  const levers = LeversSchema.safeParse(rawLevers);
  const rawItemConfirmation = {
    itemCode: fields.confirmedItemCode,
    quantity: typeof fields.confirmedQuantity === "string" ? Number(fields.confirmedQuantity) : fields.confirmedQuantity,
    ...(typeof fields.confirmedLineIndex === "string" && fields.confirmedLineIndex.trim() !== ""
      ? { lineIndex: Number(fields.confirmedLineIndex) - 1 }
      : {}),
  };
  const operatorItemConfirmation = OperatorItemConfirmationSchema.safeParse(rawItemConfirmation);
  const reviewId = fields.reviewId;
  const reviewFingerprint = fields.reviewFingerprint;
  const hasReviewReference = reviewId !== undefined || reviewFingerprint !== undefined;
  const hasReviewId = typeof reviewId === "string" && reviewId.trim() !== "";
  const hasReviewFingerprint = typeof reviewFingerprint === "string" && reviewFingerprint.trim() !== "";
  if (hasReviewReference && (!hasReviewId || !hasReviewFingerprint ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(reviewId) ||
      !/^[a-f0-9]{64}$/.test(reviewFingerprint))) {
    return validationFailure([{
      field: "purchaseOrderReview",
      path: ["reviewId"],
      code: "incomplete_review_reference",
      message: "Both reviewId and reviewFingerprint are required to use the reviewed PO.",
    }], "The purchase-order review reference is invalid.");
  }
  if (hasReviewId && fields.confirmedSourceLine !== "true") {
    return validationFailure([{
      field: "confirmedSourceLine",
      path: ["confirmedSourceLine"],
      code: "confirmation_required",
      message: "Confirm the selected item's code and quantity against the displayed source PO line.",
    }], "The selected PO line has not been confirmed.");
  }
  const shift = fields.shift;
  // A blank humidity or temperature field is "missing", not 0; the condition
  // guard then falls back to weather or the seasonal typical value.
  const conditionNumber = (value) => value === undefined || value === null ||
    (typeof value === "string" && value.trim() === "")
    ? undefined
    : typeof value === "string" ? Number(value) : value;
  const rawManualConditions = {
    runDate: fields.runDate,
    shift,
    ambientRhPct: conditionNumber(fields.ambientRhPct),
    ambientTempC: conditionNumber(fields.ambientTempC),
    paperMoisturePct: conditionNumber(fields.paperMoisturePct),
  };
  const manualConditions = ManualRunConditionsSchema.safeParse(rawManualConditions);
  const conditionsConfirmed = fields.conditionsConfirmed === "true";
  const issues = [
    ...(operatorFields.success ? [] : operatorFields.error.issues.map((issue) => ({
      field: issue.path.join("."),
      path: ["operatorFields", ...issue.path],
      code: issue.code,
      message: issue.message,
    }))),
    ...(levers.success ? [] : levers.error.issues.map((issue) => ({
      field: issue.path.join("."),
      path: ["levers", ...issue.path],
      code: issue.code,
      message: issue.message,
    }))),
    ...(operatorItemConfirmation.success ? [] : operatorItemConfirmation.error.issues.map((issue) => ({
      field: issue.path.join("."),
      path: ["operatorItemConfirmation", ...issue.path],
      code: issue.code,
      message: issue.message,
    }))),
    ...(shift === "DAY" || shift === "NIGHT" ? [] : [{
      field: "shift",
      path: ["shift"],
      code: "invalid_value",
      message: "Select the actual DAY or NIGHT shift.",
    }]),
    ...(manualConditions.success ? [] : manualConditions.error.issues.map((issue) => ({
      field: issue.path.join("."),
      path: ["conditions", ...issue.path],
      code: issue.code,
      message: issue.message,
    }))),
    ...(conditionsConfirmed ? [] : [{
      field: "conditionsConfirmed",
      path: ["conditionsConfirmed"],
      code: "confirmation_required",
      message: "A supervisor must confirm or edit the manual condition values before prediction.",
    }]),
  ];
  if (issues.length) {
    return validationFailure(issues, "Job preparation requires confirmed order context, shift and actual machine settings.");
  }

  // Idempotency: the optional client-supplied key (the Idempotency-Key header
  // on HTTP) is bound to a fingerprint of the validated request.
  // Resubmitting the same key with different inputs returns 409 CONFLICT.
  // Without durable persistence and a shared idempotency store, the submission
  // handler returns SERVICE_UNAVAILABLE before running job preparation.
  const identity = createJobRequestIdentity({
    idempotencyKey,
    fileBytes,
    operatorFields: operatorFields.data,
    operatorItemConfirmation: operatorItemConfirmation.data,
    shift,
    levers: levers.data,
    conditions: manualConditions.data,
    ...(hasReviewFingerprint ? { purchaseOrderReviewFingerprint: reviewFingerprint } : {}),
  });
  if (!identity.ok) {
    // Key is present but malformed — return a validation error.
    return validationFailure(identity.error.issues ?? [], identity.error.message);
  }

  const submissionResult = await submitJob({
    identity: hackathonAuth.enabled ? demoJobIdentity(principal, identity.identity) : identity.identity,
    request: {
      file: { arrayBuffer: async () => fileBytes.buffer },
      operatorFields: operatorFields.data,
      operatorItemConfirmation: operatorItemConfirmation.data,
      ...(hasReviewId ? {
        purchaseOrderReview: {
          reviewId,
          reviewFingerprint,
          confirmedSourceLine: fields.confirmedSourceLine === "true",
          ...(typeof principal?.sessionId === "string" ? { ownerSessionId: principal.sessionId } : {}),
        },
      } : {}),
      shift,
      levers: levers.data,
      manualConditions: manualConditions.data,
      conditionsConfirmed,
    },
    signal,
  });
  if (submissionResult.ok && submissionResult.jobSheet) {
    const sheet = submissionResult.jobSheet;
    await liveStore.publish({
      lot: liveLot(sheet, "planned"),
      event: { type: "lot.planned", lotId: sheet.jobId, text: `Lot ${sheet.order?.itemCode ?? sheet.jobId} planned · ${sheet.order?.quantity ?? "?"} units`, actor: liveActor(principal) },
    });
  }
  return demoMode && submissionResult.ok ? { ...submissionResult, durable: false, storageScope: "process-memory", source: "mock-demo", isRealModelPrediction: false } : submissionResult;

}
