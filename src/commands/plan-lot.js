import { demoJobIdentity, demoOwnsLot, isDemoPrincipal } from "../hackathon-demo-auth.js";
import { createJobRequestIdentity } from "../job-idempotency.js";
import {
  LeversSchema,
  ManualRunConditionsSchema,
  OperatorItemConfirmationSchema,
  OrderOperatorFieldsSchema,
} from "../schemas.js";
import { revisionFingerprint } from "../revision-fingerprint.js";
import { LotIdSchema } from "../state-schemas.js";
import { liveActor, liveLot } from "./live-events.js";
import { lotFailure, lotStoreFailure } from "./lot-access.js";
import { readPurchaseOrderUpload } from "./purchase-order-upload.js";
import { PAPER_MOISTURE_EXAMPLE_PCT } from "./update-conditions.js";
import { validateWith, validationFailure } from "./validation.js";

const CONDITION_UNITS = [
  ["runDate", "date"], ["shift", "shift"], ["ambientRhPct", "% RH"], ["ambientTempC", "°C"], ["paperMoisturePct", "%"],
];

// The request already carried these values and a supervisor confirmed them, so they are frozen as confirmed.
// Paper moisture planned at its example value keeps that label: the person confirmed the plan with the
// example on screen, but the value did not come from the reel.
function frozenConditions(manualConditions, { moistureSource }) {
  return CONDITION_UNITS
    .filter(([field]) => manualConditions[field] !== undefined && manualConditions[field] !== null)
    .map(([field, unit]) => (field === "paperMoisturePct" && moistureSource === "example"
      ? {
        field, value: manualConditions[field], unit, provenance: "synthetic_example", sourceDetail: "example",
        label: "Example value", confirmed: true,
      }
      : {
        field, value: manualConditions[field], unit, provenance: "operator_entry", sourceDetail: "confirmed",
        label: "Confirmed by operator", confirmed: true, enteredByRole: "Supervisor session",
      }));
}

/**
 * The per-session daily plan limit, checked before anything is written or planned. It applies
 * where the budget store is configured and the caller is a demo session; the request identity is
 * the key, so a replay of a plan already counted is not counted again. Returns a refusal or nothing.
 */
async function admitPlan({ principal, identity, servicePorts, signal }) {
  const admit = servicePorts?.geminiUsage?.admitPlan;
  if (typeof admit !== "function" || !isDemoPrincipal(principal)) return undefined;
  let result;
  try {
    result = await admit({ principal, planKey: identity.keyHash, signal });
  } catch (error) {
    if (error?.name === "AbortError" || signal?.aborted) throw error;
    result = { ok: false, code: "BUDGET_UNAVAILABLE" };
  }
  if (result?.ok) return undefined;
  if (result?.code === "PLAN_DAILY_LIMIT_REACHED") {
    return {
      ok: false, status: 429,
      error: { code: "PLAN_DAILY_LIMIT_REACHED", message: "This session has planned today's limit of lots.", retryAfterSeconds: result.retryAfterSeconds },
    };
  }
  return { ok: false, status: 503, error: { code: "SERVICE_UNAVAILABLE", message: "The plan limit could not be checked, so nothing was planned." } };
}

/**
 * Registers the PENDING revision before planning (design 3.2, step 4). Without
 * an explicit lot ID the lot is derived from the request, so every plan has a
 * revision for the approve guard to check.
 */
async function registerRevision({ lotId: requestedLotId, identity, conditions, principal, lotRevisions, signal }) {
  const lotId = requestedLotId ?? `LOT-HACK-${principal.sessionId}-${identity.keyHash.slice(0, 12)}`;
  if (!demoOwnsLot(principal, lotId)) {
    return lotFailure(403, "DEMO_SCOPE_REQUIRED", "This lot does not belong to this demo session.");
  }
  try {
    const registered = await lotRevisions.store.registerPending({
      lotId, ownerSessionId: principal.sessionId, jobId: identity.jobId,
      requestFingerprint: identity.fingerprint, conditions, signal,
    });
    if (registered.ok) return { ok: true, lotId, registered };
    return registered.code === "REVISION_CONFLICT"
      ? { ok: false, error: { code: "CONFLICT", message: "This idempotency key was used for a different request." } }
      : lotFailure(403, "DEMO_SCOPE_REQUIRED", "This lot does not belong to this demo session.");
  } catch (error) {
    return lotStoreFailure(error);
  }
}

/** Makes the revision CURRENT once its draft is stored, or marks it FAILED when planning failed. */
async function finishRevision({ result, lot, identity, conditions, lotRevisions, signal }) {
  const { store } = lotRevisions;
  const { lotId, registered } = lot;
  const done = (revision) => ({
    ...result,
    revision: { lotId, number: revision.number, fingerprint: revision.revisionFingerprint, status: revision.status },
  });
  if (!result.ok || !result.jobSheet) {
    // Another request holding the same key still owns the pending revision.
    if (result.error?.code !== "IDEMPOTENCY_IN_PROGRESS") {
      await store.markFailed({ lotId, jobId: identity.jobId, signal }).catch(() => undefined);
    }
    return result;
  }
  // A replay of a draft that was already finished, approved or replaced reports the stored state.
  if (registered.reused && registered.revision.status !== "PENDING") return done(registered.revision);
  try {
    const made = await store.makeCurrent({
      lotId, jobId: identity.jobId, signal,
      revisionFingerprint: revisionFingerprint({
        jobSheet: result.jobSheet, lotId, number: registered.revision.number,
        requestFingerprint: identity.fingerprint, conditions,
      }),
    });
    if (!made.ok) return lotFailure(409, "REVISION_CONFLICT", "The lot changed while this draft was being prepared. Plan the lot again.");
    return done(made.revision);
  } catch (error) {
    return lotStoreFailure(error);
  }
}

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
  lotRevisions,
  servicePorts,
}) {
  // A lot ID is part of the request identity, so two lots with the same inputs never share a job.
  const lotField = typeof fields.lotId === "string" && fields.lotId.trim() !== "" ? validateWith(LotIdSchema, fields.lotId, "Lot ID failed validation.") : undefined;
  if (lotField && !lotField.ok) return lotField.failure;
  const lotId = lotField?.data;
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
  // Optional; absent means the moisture was entered. Only the example value may be planned as the example.
  const moistureSource = fields.paperMoistureSource;
  const moistureSourceValid = moistureSource === undefined || moistureSource === "confirmed" ||
    (moistureSource === "example" && manualConditions.success && manualConditions.data.paperMoisturePct === PAPER_MOISTURE_EXAMPLE_PCT);
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
    ...(moistureSourceValid ? [] : [{
      field: "paperMoistureSource",
      path: ["paperMoistureSource"],
      code: "invalid_value",
      message: "Only the paper moisture example value can be planned as the example.",
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
    ...(lotId === undefined ? {} : { lotId }),
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

  const scopedIdentity = hackathonAuth.enabled ? demoJobIdentity(principal, identity.identity) : identity.identity;
  const admitted = await admitPlan({ principal, identity: scopedIdentity, servicePorts, signal });
  if (admitted) return admitted;
  const conditions = frozenConditions(manualConditions.data, { moistureSource });
  const lot = lotRevisions?.enabled === true && isDemoPrincipal(principal)
    ? await registerRevision({ lotId, identity: scopedIdentity, conditions, principal, lotRevisions, signal })
    : undefined;
  if (lot && !lot.ok) return lot;

  const planned = await submitJob({
    identity: scopedIdentity,
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
  const submissionResult = lot
    ? await finishRevision({ result: planned, lot, identity: scopedIdentity, conditions, lotRevisions, signal })
    : planned;
  if (submissionResult.ok && submissionResult.jobSheet) {
    const sheet = submissionResult.jobSheet;
    await liveStore.publish({
      lot: liveLot(sheet, "planned"),
      event: { type: "lot.planned", lotId: sheet.jobId, text: `Lot ${sheet.order?.itemCode ?? sheet.jobId} planned · ${sheet.order?.quantity ?? "?"} units`, actor: liveActor(principal) },
    });
  }
  return demoMode && submissionResult.ok ? { ...submissionResult, durable: false, storageScope: "process-memory", source: "mock-demo", isRealModelPrediction: false } : submissionResult;

}
