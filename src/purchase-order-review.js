import { createHash, randomUUID } from "node:crypto";
import {
  OrderExtractionApiResponseSchema,
  OrderExtractionInputSchema,
  OrderOperatorFieldsSchema,
  PURCHASE_ORDER_FIELDS,
} from "./schemas.js";

const REVIEW_TTL_MS = 30 * 60 * 1000;
const MAX_REVIEWS = 100;

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validationFailure(message, field, code, detail) {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message,
      issues: [{ field, path: [field], code, message: detail }],
    },
  };
}

function extractionFingerprint(result) {
  return digest(JSON.stringify({
    purchaseOrderDocument: result.purchaseOrderDocument,
    documentMissingFields: result.documentMissingFields,
    lines: result.lines,
    missingFields: result.missingFields,
  }));
}

export function createPurchaseOrderReviewService({
  extractOrder,
  resolveOrderLine,
  now = () => Date.now(),
  idFactory = randomUUID,
} = {}) {
  if (typeof extractOrder !== "function" || typeof resolveOrderLine !== "function") {
    throw new TypeError("Order extraction and catalog line-resolution services are required.");
  }
  const reviews = new Map();

  function pruneExpired() {
    const currentTime = now();
    for (const [reviewId, review] of reviews) {
      if (review.expiresAt <= currentTime) reviews.delete(reviewId);
    }
  }

  async function extractForReview({ file, operatorFields = {}, selectedLineIndex, signal } = {}) {
    if (!file || typeof file.arrayBuffer !== "function") {
      return validationFailure("A purchase-order file is required.", "file", "required", "Upload the purchase order to review its extracted lines.");
    }
    const parsedOperatorFields = OrderOperatorFieldsSchema.safeParse(operatorFields);
    if (!parsedOperatorFields.success) {
      return validationFailure("Operator-supplied order context is invalid.", "operatorFields", "invalid_value", "Correct the operator-confirmed order context.");
    }
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const result = await extractOrder({
      file,
      operatorFields: parsedOperatorFields.data,
      ...(selectedLineIndex === undefined ? {} : { selectedLineIndex }),
      signal,
    });
    if (!result || result.ok !== true) return result;

    const parsedResult = OrderExtractionApiResponseSchema.safeParse(result);
    if (!parsedResult.success) {
      return {
        ok: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Purchase-order extraction returned a result that cannot be reviewed safely.",
        },
      };
    }
    pruneExpired();
    while (reviews.size >= MAX_REVIEWS) {
      const oldest = reviews.keys().next().value;
      if (oldest === undefined) break;
      reviews.delete(oldest);
    }
    const reviewId = idFactory();
    const reviewFingerprint = extractionFingerprint(parsedResult.data);
    reviews.set(reviewId, {
      result: structuredClone(parsedResult.data),
      operatorFields: parsedOperatorFields.data,
      fileDigest: digest(fileBytes),
      reviewFingerprint,
      expiresAt: now() + REVIEW_TTL_MS,
    });
    return { ...parsedResult.data, reviewId, reviewFingerprint };
  }

  async function confirmReview({
    reviewId,
    reviewFingerprint,
    fileBytes,
    operatorFields = {},
    lineIndex,
    itemCode,
    quantity,
    confirmedSourceLine,
    signal,
  } = {}) {
    pruneExpired();
    const review = reviews.get(reviewId);
    const demoMode = process.env.USTAAD_ENABLE_DEMO_MODE === "true";
    if (!review || review.reviewFingerprint !== reviewFingerprint ||
        !(fileBytes instanceof Uint8Array) ||
        (!demoMode && digest(fileBytes) !== review.fileDigest)) {
      return validationFailure(
        "This PO review is stale or does not match the uploaded document.",
        "reviewId",
        "stale_review",
        "Extract and review the current document again before confirming a line.",
      );
    }
    const parsedOperatorFields = OrderOperatorFieldsSchema.safeParse(operatorFields);
    if (!parsedOperatorFields.success ||
        JSON.stringify(parsedOperatorFields.data) !== JSON.stringify(review.operatorFields)) {
      return validationFailure(
        "The operator order context changed after this PO was reviewed.",
        "operatorFields",
        "stale_review",
        "Review the PO again after changing the order context.",
      );
    }
    if (confirmedSourceLine !== true) {
      return validationFailure(
        "Operator confirmation of the source line is required.",
        "confirmedSourceLine",
        "confirmation_required",
        "Verify the item code and quantity against the selected PO line.",
      );
    }
    if (!Number.isSafeInteger(lineIndex) || lineIndex < 0 ||
        !Number.isSafeInteger(quantity) || quantity < 1 ||
        typeof itemCode !== "string" || itemCode.trim().length === 0) {
      return validationFailure(
        "A valid source line, catalog item code, and positive quantity are required.",
        "selection",
        "invalid_selection",
        "Choose a PO line, resolve its item code, and confirm its quantity.",
      );
    }
    const originalLine = review.result.lines?.[lineIndex];
    if (!originalLine) {
      return validationFailure(
        "The selected PO line does not exist in this review.",
        "lineIndex",
        "line_index_out_of_range",
        "Select a line displayed in the current PO review.",
      );
    }

    const extractedCode = originalLine.extractedItemCode;
    const selectedItemCode = itemCode.trim();
    if (originalLine.catalogStatus === "AMBIGUOUS" &&
        !originalLine.candidates.includes(selectedItemCode)) {
      return validationFailure(
        "The selected item code is not one of the candidates returned for this PO line.",
        "itemCode",
        "catalog_candidate_required",
        "Select one of the actual catalog candidates shown for this line.",
      );
    }
    const resolution = await resolveOrderLine({
      itemCode: originalLine.catalogStatus === "AMBIGUOUS" && extractedCode
        ? extractedCode
        : selectedItemCode,
      quantity,
      ...((originalLine.catalogStatus === "AMBIGUOUS" && selectedItemCode !== extractedCode) ||
          selectedItemCode !== extractedCode
        ? { selectedItemCode }
        : {}),
      signal,
    });
    if (!resolution || !["MATCHED", "AMBIGUOUS"].includes(resolution.status) ||
        resolution.resolvedItemCode !== selectedItemCode || !resolution.orderProfile) {
      return validationFailure(
        "The confirmed item code is not a uniquely resolved catalog item.",
        "itemCode",
        resolution?.status === "AMBIGUOUS" ? "catalog_candidate_required" : "catalog_item_not_found",
        resolution?.status === "AMBIGUOUS"
          ? "Select one of the catalog candidates shown for this line."
          : "Correct the item code using the purchase order and select a catalog item.",
      );
    }

    const parsedProfile = OrderExtractionInputSchema.safeParse({
      ...resolution.orderProfile,
      ...parsedOperatorFields.data,
      itemCode: selectedItemCode,
      quantity,
    });
    if (!parsedProfile.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "The selected catalog item is incomplete and requires clarification.",
          issues: parsedProfile.error.issues.map((issue) => ({
            field: issue.path.join("."),
            path: issue.path,
            code: issue.code,
            message: issue.message,
          })),
        },
      };
    }
    const missingFields = PURCHASE_ORDER_FIELDS.filter((field) => parsedProfile.data[field] === undefined);
    const lines = review.result.lines.map((line, index) => index === lineIndex
      ? {
        ...line,
        status: "MATCHED",
        catalogStatus: resolution.status,
        candidates: resolution.candidates,
        resolvedItemCode: selectedItemCode,
        confirmedItemCode: selectedItemCode,
        confirmedQuantity: quantity,
        orderProfile: parsedProfile.data,
      }
      : line);
    return {
      ...review.result,
      orderProfile: parsedProfile.data,
      lines,
      selectedLineIndex: lineIndex,
      lineSelectionRequired: false,
      missingFields,
      needsClarification: missingFields.length > 0 ||
        review.result.documentMissingFields?.length > 0 ||
        lines.some((line) => line.status !== "MATCHED"),
    };
  }

  return Object.freeze({
    extractForReview,
    confirmReview,
  });
}
