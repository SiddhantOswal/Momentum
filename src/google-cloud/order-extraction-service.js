import {
  OrderExtractionInputSchema,
  OrderOperatorFieldsSchema,
  PurchaseOrderLineExtractionSchema,
  PurchaseOrderDocumentSchema,
  PURCHASE_ORDER_FIELDS,
} from "../schemas.js";
import { BigQueryReadError } from "./bigquery-read-client.js";
import { CloudStorageError } from "./storage-client.js";
import { VertexGeminiError } from "./vertex-gemini-client.js";
import { identifyPurchaseOrderMimeType } from "../purchase-order-file.js";

const orderResponseSchema = Object.freeze({
  type: "OBJECT",
  properties: {
    poNumber: { type: "STRING" },
    buyer: { type: "STRING" },
    deliveryDate: { type: "STRING" },
    lines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          itemCode: { type: "STRING" },
          quantity: { type: "INTEGER" },
          sourcePage: { type: "INTEGER" },
        },
      },
    },
  },
});

const EXTRACTION_PROMPT = `Read this corrugated packaging purchase order as one document. Extract document-level purchase-order number (poNumber), buyer name (buyer), and delivery date as printed (deliveryDate). Extract every line item, in source order, into lines; each line may contain only itemCode, quantity, and sourcePage. sourcePage is the 1-based page number on which the line appears. Return exactly one JSON object with these keys. Do not split one PO into separate documents. Quantity must be an integer, sourcePage must be a positive integer, and deliveryDate must use DD-MM-YYYY. Do not extract or infer item specifications, loaded paper details, shift, or machine settings. Do not guess; omit any absent, ambiguous, or unlocatable value on its line. Preserve a line with an omitted itemCode, quantity, or sourcePage so it can be held for clarification.`;
const MAX_ORDER_DOCUMENT_BYTES = 10 * 1024 * 1024;
const DOCUMENT_FIELDS = ["poNumber", "buyer", "deliveryDate"];

function normalizeExtraction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some((key) => !["poNumber", "buyer", "deliveryDate", "lines"].includes(key)) ||
      !Array.isArray(value.lines) || value.lines.length < 1 || value.lines.length > 100) {
    return undefined;
  }

  const document = {};
  const documentMissingFields = [];
  for (const field of DOCUMENT_FIELDS) {
    if (value[field] === undefined) {
      documentMissingFields.push(field);
      continue;
    }
    const parsed = PurchaseOrderDocumentSchema.shape[field].safeParse(value[field]);
    if (parsed.success) document[field] = parsed.data;
    else documentMissingFields.push(field);
  }

  const lines = value.lines.map((rawLine) => {
    if (!rawLine || typeof rawLine !== "object" || Array.isArray(rawLine) ||
        Object.keys(rawLine).some((key) => !["itemCode", "quantity", "sourcePage"].includes(key))) {
      return { validationIssues: ["LINE_INVALID"] };
    }
    const normalized = {};
    const validationIssues = [];
    for (const [field, issue] of [
      ["itemCode", "ITEM_CODE_INVALID"],
      ["quantity", "QUANTITY_INVALID"],
      ["sourcePage", "SOURCE_PAGE_INVALID"],
    ]) {
      if (!Object.hasOwn(rawLine, field) || rawLine[field] === undefined) continue;
      const parsed = PurchaseOrderLineExtractionSchema.shape[field].safeParse(rawLine[field]);
      if (parsed.success) normalized[field] = parsed.data;
      else validationIssues.push(issue);
    }
    if (normalized.sourcePage === undefined &&
        !validationIssues.includes("SOURCE_PAGE_INVALID")) {
      validationIssues.push("SOURCE_PAGE_MISSING");
    }
    return { ...normalized, validationIssues };
  });

  return {
    ...document,
    lines,
    documentMissingFields,
  };
}

function unavailable(stage, reasonCode = "INTEGRATION_ERROR") {
  return {
    ok: false,
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: `Purchase-order ${stage} failed (${reasonCode}); no extraction result was accepted.`,
    },
  };
}

function safeReasonCode(error) {
  return typeof error?.code === "string" && /^[A-Z0-9_]{1,64}$/.test(error.code)
    ? error.code
    : "INTEGRATION_ERROR";
}

function safeErrorType(error) {
  return typeof error?.name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name)
    ? error.name
    : "Error";
}

function safeValidationIssues(error) {
  if (!Array.isArray(error?.issues)) return undefined;
  return error.issues.slice(0, 8).map((issue) => ({
    path: Array.isArray(issue.path)
      ? issue.path.map((segment) => typeof segment === "number"
        ? segment
        : typeof segment === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(segment)
          ? segment
          : "field")
      : [],
    code: typeof issue.code === "string" && /^[a-z_]{1,48}$/.test(issue.code)
      ? issue.code
      : "invalid",
  }));
}

export function createPdfOrderExtractionService({ storage, gemini, itemCatalog } = {}) {
  if (!storage || typeof storage.upload !== "function" || typeof storage.delete !== "function" ||
      typeof storage.createObjectName !== "function" ||
      !gemini || typeof gemini.generateJson !== "function" ||
      !itemCatalog || (typeof itemCatalog.resolveOrderLine !== "function" &&
        typeof itemCatalog.getOrderProfile !== "function")) {
    throw new TypeError("Cloud Storage, Vertex Gemini, and item catalog services are required.");
  }

  return async ({
    file,
    operatorFields = {},
    selectedLineIndex,
    confirmedItemCode,
    signal,
  } = {}) => {
    if (!file || typeof file.arrayBuffer !== "function" ||
        !Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_ORDER_DOCUMENT_BYTES) {
      return {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "A PDF or JPEG purchase order between 1 byte and 10 MiB is required." },
      };
    }

    const parsedOperatorFields = OrderOperatorFieldsSchema.safeParse(operatorFields);
    if (!parsedOperatorFields.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Operator-supplied order context is invalid.",
          issues: parsedOperatorFields.error.issues.map((issue) => ({
            field: issue.path.join(".") || "operatorFields",
            path: ["operatorFields", ...issue.path],
            code: issue.code,
            message: issue.message,
          })),
        },
      };
    }

    let objectName;
    let uploaded;
    const discardUpload = async () => {
      if (!objectName || !uploaded) return undefined;
      try {
        await storage.delete({
          name: objectName,
          ...(uploaded.generation === undefined ? {} : { generation: uploaded.generation }),
        });
        uploaded = undefined;
        return undefined;
      } catch (error) {
        return safeReasonCode(error);
      }
    };

    try {
      let modelUsage;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mimeType = identifyPurchaseOrderMimeType(file, bytes);
      if (!mimeType) {
        return {
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "The purchase order must be a valid PDF or JPEG image." },
        };
      }
      const extension = mimeType === "application/pdf" ? ".pdf" : ".jpg";
      objectName = storage.createObjectName("orders", extension);
      uploaded = await storage.upload({
        name: objectName,
        contentType: mimeType,
        bytes,
        signal,
      });
      if (typeof uploaded?.gcsUri !== "string" || uploaded.gcsUri.length === 0) {
        throw new CloudStorageError("CLOUD_STORAGE_INVALID_UPLOAD", "Cloud Storage returned an invalid upload result.");
      }
      const extracted = await gemini.generateJson({
        fileUri: uploaded.gcsUri,
        mimeType,
        prompt: EXTRACTION_PROMPT,
        responseSchema: orderResponseSchema,
        signal,
        onUsage: (usage) => { modelUsage = usage; },
      });
      const normalized = normalizeExtraction(extracted);
      if (!normalized) {
        const cleanupFailure = await discardUpload();
        return cleanupFailure
          ? unavailable("temporary document cleanup", cleanupFailure)
          : unavailable("Gemini result validation", "EXTRACTION_CONTRACT_MISMATCH");
      }
      if (normalized.poNumber && parsedOperatorFields.data.orderId &&
          normalized.poNumber !== parsedOperatorFields.data.orderId) {
        const validationFailure = {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "The operator-confirmed order ID does not match the purchase-order number.",
            issues: [{
              field: "orderId",
              path: ["operatorFields", "orderId"],
              code: "purchase_order_mismatch",
              message: "Confirm the order ID against the extracted purchase-order number.",
            }],
          },
        };
        const cleanupFailure = await discardUpload();
        return cleanupFailure
          ? unavailable("temporary document cleanup", cleanupFailure)
          : validationFailure;
      }

      const selectedIndex = selectedLineIndex === undefined && normalized.lines.length === 1
        ? 0
        : selectedLineIndex;
      if (selectedIndex !== undefined &&
          (!Number.isSafeInteger(selectedIndex) || selectedIndex < 0 ||
           selectedIndex >= normalized.lines.length)) {
        const cleanupFailure = await discardUpload();
        return cleanupFailure
          ? unavailable("temporary document cleanup", cleanupFailure)
          : {
            ok: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "The selected purchase-order line does not exist.",
              issues: [{
                field: "lineIndex",
                path: ["selectedLineIndex"],
                code: "line_index_out_of_range",
                message: "Select a line from the extracted purchase order.",
              }],
            },
          };
      }

      const lines = [];
      for (const [lineIndex, extractedLine] of normalized.lines.entries()) {
        let resolution = extractedLine.itemCode
          ? typeof itemCatalog.resolveOrderLine === "function"
            ? await itemCatalog.resolveOrderLine({
              itemCode: extractedLine.itemCode,
              ...(extractedLine.quantity === undefined ? {} : { quantity: extractedLine.quantity }),
              ...(selectedIndex === lineIndex && confirmedItemCode !== undefined
                ? { selectedItemCode: confirmedItemCode }
                : {}),
              signal,
            })
            : await (async () => {
              const profile = await itemCatalog.getOrderProfile({
                itemCode: extractedLine.itemCode,
                ...(extractedLine.quantity === undefined ? {} : { quantity: extractedLine.quantity }),
                signal,
              });
              return profile
                ? { status: "MATCHED", candidates: [], resolvedItemCode: extractedLine.itemCode, orderProfile: profile }
                : { status: "UNKNOWN_CODE", candidates: [] };
            })()
          : { status: "MISSING_ITEM_CODE", candidates: [] };

        if (!Array.isArray(resolution?.candidates) ||
            !["MATCHED", "AMBIGUOUS", "UNKNOWN_CODE", "MISSING_ITEM_CODE"].includes(resolution?.status)) {
          throw new TypeError("Item catalog returned an invalid line-resolution result.");
        }
        const status = extractedLine.validationIssues.length > 0
          ? "MALFORMED"
          : extractedLine.itemCode === undefined
            ? "MISSING_ITEM_CODE"
            : extractedLine.quantity === undefined
              ? "MISSING_QTY"
              : resolution.status;
        const catalogProfile = resolution.orderProfile ?? (
          resolution.status === "MATCHED" && resolution.resolvedItemCode
            ? await itemCatalog.getOrderProfile?.({
              itemCode: resolution.resolvedItemCode,
              ...(extractedLine.quantity === undefined ? {} : { quantity: extractedLine.quantity }),
              signal,
            })
            : undefined
        );
        const validatedProfile = catalogProfile
          ? OrderExtractionInputSchema.safeParse({
            ...catalogProfile,
            itemCode: resolution.resolvedItemCode ?? catalogProfile.itemCode ?? extractedLine.itemCode,
            ...(extractedLine.quantity === undefined ? {} : { quantity: extractedLine.quantity }),
            ...parsedOperatorFields.data,
          })
          : undefined;
        if (validatedProfile && !validatedProfile.success) {
          const cleanupFailure = await discardUpload();
          return cleanupFailure
            ? unavailable("temporary document cleanup", cleanupFailure)
            : unavailable("item catalog result validation", "ITEM_PROFILE_CONTRACT_MISMATCH");
        }
        lines.push({
          lineIndex,
          ...(extractedLine.sourcePage === undefined ? {} : { sourcePage: extractedLine.sourcePage }),
          ...(extractedLine.itemCode === undefined ? {} : { extractedItemCode: extractedLine.itemCode }),
          ...(extractedLine.quantity === undefined ? {} : { quantity: extractedLine.quantity }),
          status,
          ...(extractedLine.itemCode === undefined ? {} : { catalogStatus: resolution.status }),
          ...(extractedLine.validationIssues.length === 0
            ? {}
            : { validationIssues: extractedLine.validationIssues }),
          candidates: resolution.candidates,
          ...(resolution.resolvedItemCode === undefined ? {} : { resolvedItemCode: resolution.resolvedItemCode }),
          ...(validatedProfile?.success ? { orderProfile: validatedProfile.data } : {}),
        });
      }

      const selectedLine = selectedIndex === undefined ? undefined : lines[selectedIndex];
      const orderProfile = selectedLine?.orderProfile;
      const missingFields = orderProfile
        ? PURCHASE_ORDER_FIELDS.filter((field) => orderProfile[field] === undefined)
        : [];
      const purchaseOrderDocument = PurchaseOrderDocumentSchema.parse({
        ...(normalized.poNumber === undefined ? {} : { poNumber: normalized.poNumber }),
        ...(normalized.buyer === undefined ? {} : { buyer: normalized.buyer }),
        ...(normalized.deliveryDate === undefined ? {} : { deliveryDate: normalized.deliveryDate }),
      });
      const documentMissingFields = normalized.documentMissingFields;
      const lineSelectionRequired = lines.length > 1 && selectedIndex === undefined;
      const needsClarification = missingFields.length > 0 || documentMissingFields.length > 0 || lineSelectionRequired ||
        lines.some((line) => line.status !== "MATCHED");
      return {
        ok: true,
        agent: "extractOrder",
        source: "vertex-gemini",
        isRealModelPrediction: true,
        ...(orderProfile === undefined ? {} : { orderProfile }),
        purchaseOrderDocument,
        documentMissingFields,
        lines,
        ...(selectedIndex === undefined ? {} : { selectedLineIndex: selectedIndex }),
        lineSelectionRequired,
        missingFields,
        needsClarification,
        sourceDocumentUri: uploaded.gcsUri,
        operatorProvidedFields: Object.keys(parsedOperatorFields.data),
        ...(modelUsage === undefined ? {} : { modelUsage }),
      };
    } catch (error) {
      const cleanupFailure = await discardUpload();
      if (error?.name === "AbortError") {
        if (cleanupFailure) {
          console.error(JSON.stringify({
            event: "order_extraction_cleanup_failed",
            code: cleanupFailure,
          }));
        }
        throw error;
      }
      const stage = error instanceof CloudStorageError ? "Cloud Storage"
        : error instanceof VertexGeminiError ? "Vertex AI"
          : error instanceof BigQueryReadError ? "item catalog"
            : "extraction";
      console.error(JSON.stringify({
        event: "order_extraction_failed",
        stage,
        code: safeReasonCode(error),
        errorType: safeErrorType(error),
        ...(safeValidationIssues(error) === undefined
          ? {}
          : { validationIssues: safeValidationIssues(error) }),
        ...(cleanupFailure ? { cleanupFailure } : {}),
      }));
      return cleanupFailure
        ? unavailable("temporary document cleanup", cleanupFailure)
        : unavailable(stage, safeReasonCode(error));
    }
  };
}

export const orderExtractionResponseSchema = orderResponseSchema;
