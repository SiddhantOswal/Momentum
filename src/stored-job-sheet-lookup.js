import { JobIdSchema, StoredJobSheetSchema } from "./schemas.js";

const unavailable = {
  ok: false,
  error: {
    code: "SERVICE_UNAVAILABLE",
    message: "The stored job could not be retrieved.",
  },
};

function validationFailure(issues) {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "A stored job ID is required.",
      issues: issues.map((issue) => ({
        field: issue.path.join(".") || "jobId",
        path: issue.path.length ? issue.path : ["jobId"],
        code: issue.code,
        message: issue.message,
      })),
    },
  };
}

/**
 * Read a persisted JobSheet through the existing repository port. Missing or
 * mismatched rows stay explicit; this lookup never invents a draft.
 */
export function createStoredJobSheetLookup({ getStoredJobSheet, testOnly = false } = {}) {
  if (typeof getStoredJobSheet !== "function") {
    throw new TypeError("A stored job-sheet retrieval port is required.");
  }

  return async function lookupStoredJobSheet({ jobId, signal } = {}) {
    const parsedId = JobIdSchema.safeParse(jobId);
    if (!parsedId.success) {
      return validationFailure(parsedId.error.issues);
    }

    let stored;
    try {
      stored = await getStoredJobSheet({
        jobId: parsedId.data,
        ...(signal === undefined ? {} : { signal }),
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return unavailable;
    }

    if (stored?.ok === false) return stored;
    if (stored === undefined || stored === null) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "The stored job was not found." },
      };
    }

    const parsed = StoredJobSheetSchema.safeParse(stored);
    if (!parsed.success) return unavailable;
    if (parsed.data.jobId !== parsedId.data) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "The stored job was not found." },
      };
    }

    if (testOnly && !parsed.data.order.orderId.startsWith("TEST-")) {
      return { ok: false, error: { code: "NOT_FOUND", message: "The stored TEST job was not found." } };
    }

    return { ok: true, jobSheet: parsed.data };
  };
}
