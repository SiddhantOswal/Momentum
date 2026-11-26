import { OrderOperatorFieldsSchema } from "../schemas.js";
import { liveActor } from "./live-events.js";
import { readPurchaseOrderUpload } from "./purchase-order-upload.js";
import { validationFailure } from "./validation.js";

/**
 * Reads one purchase order into a review record. `fields` holds the upload
 * as multipart fields: `file`, optional `orderId`, `paperType`,
 * `paperSupplier` and a zero-based `selectedLineIndex`. `reviewId` is set
 * only by Arc, derived from its step's effect key, so a resumed step finds
 * the review it already stored; a client never chooses it.
 */
export async function readOrder({ fields = {}, reviewId } = {}, {
  principal,
  signal,
  servicePorts,
  liveStore,
  executionMode,
  purchaseOrderPolicy,
}) {
  const upload = await readPurchaseOrderUpload(fields.file, {
    invalidMessage: "Purchase order upload is invalid.",
    executionMode,
    purchaseOrderPolicy,
  });
  if (!upload.ok) return upload;

  const rawOperatorFields = {};
  for (const field of ["orderId", "paperType", "paperSupplier"]) {
    const value = fields[field];
    if (value === undefined || value === "") continue;
    rawOperatorFields[field] = value;
  }
  const operatorFields = OrderOperatorFieldsSchema.safeParse(rawOperatorFields);
  if (!operatorFields.success) {
    return validationFailure(operatorFields.error.issues.map((issue) => ({
      field: issue.path.join(".") || "operatorFields",
      path: ["operatorFields", ...issue.path],
      code: issue.code,
      message: issue.message,
    })), "Operator-supplied order context is invalid.");
  }

  const rawLineIndex = fields.selectedLineIndex;
  const selectedLineIndex = rawLineIndex === undefined || rawLineIndex === ""
    ? undefined
    : Number(rawLineIndex);
  if (selectedLineIndex !== undefined &&
      (!Number.isSafeInteger(selectedLineIndex) || selectedLineIndex < 0)) {
    return validationFailure([{
      field: "selectedLineIndex",
      path: ["selectedLineIndex"],
      code: "invalid_value",
      message: "selectedLineIndex must be a non-negative PO line number.",
    }], "Purchase order line selection is invalid.");
  }

  const extraction = await servicePorts.extractOrderForReview({
    file: upload.file,
    operatorFields: operatorFields.data,
    ...(selectedLineIndex === undefined ? {} : { selectedLineIndex }),
    ...(typeof principal?.sessionId === "string" ? { ownerSessionId: principal.sessionId } : {}),
    ...(reviewId === undefined ? {} : { reviewId }),
    signal,
  });
  if (extraction?.ok && Array.isArray(extraction.lines)) {
    const lines = extraction.lines.length;
    const order = operatorFields.data.orderId ? `Order ${operatorFields.data.orderId}` : "An order";
    const readBy = extraction.source === "vertex-gemini" && extraction.isRealModelPrediction === true
      ? "read by Gemini"
      : "read · Sample output, no model call";
    await liveStore.publish({ event: { type: "order.read", text: `${order} ${readBy} · ${lines} line${lines === 1 ? "" : "s"}`, actor: liveActor(principal) } });
  }
  return extraction;
}
