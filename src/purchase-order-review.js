import { createHash, randomUUID } from "node:crypto";
import {
  OrderExtractionApiResponseSchema,
  OrderExtractionInputSchema,
  OrderOperatorFieldsSchema,
  PURCHASE_ORDER_FIELDS,
} from "./schemas.js";
import { SessionIdSchema, STATE_SCHEMA_VERSION } from "./state-schemas.js";

const REVIEW_TTL_MS = 30 * 60 * 1000;
// Design 2.0: Firestore TTL removes the document a day later; the 30 minutes above is checked here.
const REVIEW_DOCUMENT_TTL_MS = 24 * 60 * 60 * 1000;
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

function reviewStoreUnavailable(message) {
  return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message } };
}

function staleReview() {
  return validationFailure(
    "This PO review is stale or does not match the uploaded document.",
    "reviewId",
    "stale_review",
    "Extract and review the current document again before confirming a line.",
  );
}

function isCallerAbort(error, signal) {
  return error?.name === "AbortError" && signal?.aborted === true;
}

function createMemoryReviewStore(now) {
  const reviews = new Map();

  function pruneExpired() {
    const currentTime = now();
    for (const [reviewId, review] of reviews) {
      if (review.expiresAt <= currentTime) reviews.delete(reviewId);
    }
  }

  return {
    async save(reviewId, review) {
      pruneExpired();
      while (reviews.size >= MAX_REVIEWS) {
        const oldest = reviews.keys().next().value;
        if (oldest === undefined) break;
        reviews.delete(oldest);
      }
      reviews.set(reviewId, review);
      return { ok: true };
    },
    async load(reviewId) {
      pruneExpired();
      return { ok: true, review: reviews.get(reviewId) };
    },
  };
}

// Firestore-backed reviews are bound to the demo session that read the order.
function createDurableReviewStore(store, now) {
  return {
    async save(reviewId, review, { ownerSessionId, signal }) {
      const createdAt = now();
      try {
        await store.create({
          schemaVersion: STATE_SCHEMA_VERSION,
          createdAt: new Date(createdAt).toISOString(),
          updatedAt: new Date(createdAt).toISOString(),
          expiresAt: new Date(createdAt + REVIEW_DOCUMENT_TTL_MS).toISOString(),
          reviewId,
          ownerSessionId,
          reviewFingerprint: review.reviewFingerprint,
          fileDigest: review.fileDigest,
          operatorFields: review.operatorFields,
          result: review.result,
          reviewExpiresAt: new Date(review.expiresAt).toISOString(),
        }, { signal });
        return { ok: true };
      } catch (error) {
        if (isCallerAbort(error, signal)) throw error;
        if (error?.code === "DOCUMENT_TOO_LARGE") {
          return validationFailure(
            "This purchase order is too large to keep for review.",
            "file",
            "review_too_large",
            "Split the purchase order into smaller files and read each one.",
          );
        }
        return reviewStoreUnavailable("The PO review could not be saved. Read the order again when the service is available.");
      }
    },
    async load(reviewId, { ownerSessionId, signal }) {
      let stored;
      try {
        stored = await store.get(reviewId, { signal });
      } catch (error) {
        if (isCallerAbort(error, signal)) throw error;
        return reviewStoreUnavailable("The PO review could not be read. Try again when the service is available.");
      }
      if (!stored || stored.ownerSessionId !== ownerSessionId) return { ok: true, review: undefined };
      return {
        ok: true,
        review: {
          result: stored.result,
          operatorFields: stored.operatorFields,
          fileDigest: stored.fileDigest,
          reviewFingerprint: stored.reviewFingerprint,
          expiresAt: Date.parse(stored.reviewExpiresAt),
        },
      };
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
  reviewStore,
} = {}) {
  if (typeof extractOrder !== "function" || typeof resolveOrderLine !== "function") {
    throw new TypeError("Order extraction and catalog line-resolution services are required.");
  }
  if (reviewStore !== undefined &&
      (typeof reviewStore?.create !== "function" || typeof reviewStore?.get !== "function")) {
    throw new TypeError("A PO review store needs create and get.");
  }
  const durable = reviewStore !== undefined;
  const reviews = durable ? createDurableReviewStore(reviewStore, now) : createMemoryReviewStore(now);

  async function extractForReview({ file, operatorFields = {}, selectedLineIndex, ownerSessionId, signal } = {}) {
    if (!file || typeof file.arrayBuffer !== "function") {
      return validationFailure("A purchase-order file is required.", "file", "required", "Upload the purchase order to review its extracted lines.");
    }
    if (durable && !SessionIdSchema.safeParse(ownerSessionId).success) {
      return {
        ok: false,
        status: 401,
        error: { code: "DEMO_SESSION_REQUIRED", message: "Start or renew the temporary hackathon session to read a purchase order." },
      };
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
    const reviewId = idFactory();
    const reviewFingerprint = extractionFingerprint(parsedResult.data);
    const saved = await reviews.save(reviewId, {
      result: structuredClone(parsedResult.data),
      operatorFields: parsedOperatorFields.data,
      fileDigest: digest(fileBytes),
      reviewFingerprint,
      expiresAt: now() + REVIEW_TTL_MS,
    }, { ownerSessionId, signal });
    if (!saved.ok) return saved;
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
    ownerSessionId,
    signal,
  } = {}) {
    const loaded = await reviews.load(reviewId, { ownerSessionId, signal });
    if (!loaded.ok) return loaded;
    const review = loaded.review;
    const demoMode = !process.env.K_SERVICE && process.env.USTAAD_AUTHORIZATION_MODE !== "HACKATHON_DEMO" && process.env.USTAAD_ENABLE_DEMO_MODE === "true";
    if (!review || review.expiresAt <= now() || review.reviewFingerprint !== reviewFingerprint ||
        !(fileBytes instanceof Uint8Array) ||
        (!demoMode && digest(fileBytes) !== review.fileDigest)) {
      return staleReview();
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
