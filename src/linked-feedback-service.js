import { StoredJobSheetSchema } from "./schemas.js";

const unavailable = {
  ok: false,
  error: {
    code: "SERVICE_UNAVAILABLE",
    message: "Feedback could not be linked to a validated stored job.",
  },
};

/**
 * Gate feedback submission on the referenced JobSheet and optional lot
 * belonging to the same order. The schemas expose order-level linkage but do
 * not establish a direct JobSheet-to-lot foreign key.
 */
export function createLinkedFeedbackService({ getStoredJobSheet, getLotOrder, saveFeedback } = {}) {
  if (typeof getStoredJobSheet !== "function" || typeof saveFeedback !== "function") {
    throw new TypeError("Stored-job lookup and feedback persistence ports are required.");
  }

  return async function saveLinkedFeedback(input = {}) {
    let stored;
    try {
      stored = await getStoredJobSheet({ jobId: input.jobId, signal: input.signal });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return unavailable;
    }

    if (stored?.ok === false) return stored;
    if (stored === undefined || stored === null) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Feedback requires an existing stored job." },
      };
    }

    const parsed = StoredJobSheetSchema.safeParse(stored);
    if (!parsed.success) return unavailable;
    if (parsed.data.jobId !== input.jobId) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Feedback requires the referenced stored job." },
      };
    }
    if (!parsed.data.order.orderId.startsWith("TEST-")) {
      return {
        ok: false,
        error: {
          code: "TEST_RECORD_REQUIRED",
          message: "Feedback writes are restricted to stored TEST- orders.",
        },
      };
    }

    if (input.lotId !== undefined) {
      if (typeof getLotOrder !== "function") return unavailable;
      let orderId;
      try {
        orderId = await getLotOrder({
          lotId: input.lotId,
          ...(input.signal === undefined ? {} : { signal: input.signal }),
        });
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        return unavailable;
      }
      if (orderId?.ok === false) return orderId;
      if (orderId === undefined || orderId === null) {
        return {
          ok: false,
          error: { code: "NOT_FOUND", message: "The referenced lot was not found." },
        };
      }
      if (orderId !== parsed.data.order.orderId) {
        return {
          ok: false,
          error: { code: "CONFLICT", message: "The lot does not belong to the stored job order." },
        };
      }
    }

    return saveFeedback(input);
  };
}
