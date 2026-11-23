import { identifyPurchaseOrderMimeType, MAX_PURCHASE_ORDER_BYTES } from "../purchase-order-file.js";
import { isApprovedSyntheticPurchaseOrder } from "../synthetic-po-allowlist.js";
import { validationFailure } from "./validation.js";

function approvedDocumentRejection(fileBytes, { executionMode, purchaseOrderPolicy }) {
  // Production: signed-in plant users may upload their own customers' orders.
  if (purchaseOrderPolicy.acceptRealOrders) return undefined;
  if (executionMode === "offline" && !purchaseOrderPolicy.extractionAdapterConfigured) return undefined;
  if (executionMode === "live-service" && !purchaseOrderPolicy.syntheticOnly) {
    return {
      ok: false,
      status: 503,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Approved-document restrictions must be explicitly enabled before live-service PO processing.",
      },
    };
  }
  if (!isApprovedSyntheticPurchaseOrder(fileBytes)) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "VALIDATION_ERROR",
        message: "Only the owner-approved purchase-order documents are accepted in this prototype.",
      },
    };
  }
  return undefined;
}

/**
 * Checks an uploaded purchase order before any adapter sees it: presence,
 * size, real PDF or JPEG content, then the approved-document policy.
 */
export async function readPurchaseOrderUpload(file, { invalidMessage, executionMode, purchaseOrderPolicy }) {
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return validationFailure([{
      field: "file",
      path: ["file"],
      code: "invalid_type",
      message: "A purchase-order PDF or JPEG file is required in the file field.",
    }], invalidMessage);
  }

  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_PURCHASE_ORDER_BYTES) {
    return { ok: false, status: 413, error: { code: "PAYLOAD_TOO_LARGE", message: "Purchase-order files must be between 1 byte and 10 MiB." } };
  }
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = identifyPurchaseOrderMimeType(file, fileBytes);
  if (!mimeType) {
    return validationFailure([{
      field: "file",
      path: ["file"],
      code: "invalid_format",
      message: "The uploaded purchase order must be a valid PDF or JPEG image.",
    }], invalidMessage);
  }

  const rejection = approvedDocumentRejection(fileBytes, { executionMode, purchaseOrderPolicy });
  if (rejection) return rejection;
  return { ok: true, file, fileBytes, mimeType };
}
