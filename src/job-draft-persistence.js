import { isDeepStrictEqual } from "node:util";
import { JobIdSchema, JobSheetSchema } from "./schemas.js";
import { createIdempotentJobService } from "./job-idempotency.js";

const persistFailed = {
  ok: false,
  error: {
    code: "SERVICE_UNAVAILABLE",
    message: "Job sheet could not be durably persisted; the idempotency claim was released for retry.",
  },
};

function unavailable(message) {
  return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message } };
}

/**
 * Fill repository createDraft fields from the JobSheet when the caller omitted
 * them. Does not invent a plant ID, savings amount, or currency.
 */
export function mergeDraftWriteArgs(input = {}, fallbackPlantId) {
  const jobSheet = input.jobSheet;
  const plantId = input.plantId ?? jobSheet?.plantId ?? fallbackPlantId;
  const savingsCost = input.savingsCost ?? jobSheet?.savings?.inr;
  const currency = input.currency ?? jobSheet?.baseline?.risk?.currency;
  return {
    ...input,
    ...(plantId === undefined ? {} : { plantId }),
    ...(savingsCost === undefined ? {} : { savingsCost }),
    ...(currency === undefined ? {} : { currency }),
  };
}

/**
 * Accept either an `{ ok: true, jobSheet|data }` envelope or the repository
 * document returned by `createDraft` / `get` (no `ok` field). A matching
 * DRAFT identity is required; extra stored metadata is ignored.
 */
export function readPersistedDraft(saved, jobId) {
  if (saved == null || typeof saved !== "object" || Array.isArray(saved)) return undefined;
  if (saved.ok === false) return undefined;
  const candidate = saved.ok === true
    ? (saved.jobSheet ?? saved.data)
    : saved;
  if (candidate == null || typeof candidate !== "object" || Array.isArray(candidate)) return undefined;
  if (candidate.jobId !== jobId) return undefined;
  if (candidate.status !== undefined && candidate.status !== "DRAFT") return undefined;
  return candidate;
}

function persistedJobSheetMatches(candidate, expected) {
  const fields = Object.keys(JobSheetSchema.shape);
  const projected = Object.fromEntries(fields
    .filter((field) => Object.hasOwn(candidate, field))
    .map((field) => [field, candidate[field]]));
  if (candidate.savings && typeof candidate.savings === "object" &&
      Object.hasOwn(candidate.savings, "amount")) {
    if (candidate.savings.currency !== expected.baseline.risk.currency) return false;
    projected.savings = {
      kg: candidate.savings.kg,
      inr: candidate.savings.amount,
    };
  }
  const parsedCandidate = JobSheetSchema.safeParse(projected);
  const parsedExpected = JobSheetSchema.safeParse(expected);
  return parsedCandidate.success && parsedExpected.success &&
    isDeepStrictEqual(parsedCandidate.data, parsedExpected.data);
}

/**
 * Persist a coordinator JobSheet only after preparation succeeds. Unconfigured
 * adapters never set `durable: true`. Repository-shaped success (no `ok`) is
 * accepted so a real `createDraft` return is not treated as failure.
 */
export function createPersistableJobCreator({
  prepareJob,
  createDraftJobSheet,
  draftPersistenceEnabled = false,
  plantId,
} = {}) {
  if (typeof prepareJob !== "function") {
    throw new TypeError("A job coordinator is required.");
  }
  const configuredPlantId = plantId === undefined ? undefined : JobIdSchema.safeParse(plantId);

  return async function createJob({ jobId, request = {}, signal } = {}) {
    if (draftPersistenceEnabled !== true || typeof createDraftJobSheet !== "function") {
      return unavailable("Durable JobSheet persistence is not configured; job preparation was not run.");
    }

    const result = await prepareJob({
      file: request.file,
      operatorFields: request.operatorFields,
      operatorItemConfirmation: request.operatorItemConfirmation,
      purchaseOrderReview: request.purchaseOrderReview,
      shift: request.shift,
      levers: request.levers,
      manualConditions: request.manualConditions,
      conditionsConfirmed: request.conditionsConfirmed,
      jobId,
      signal,
    });
    if (!result || result.ok !== true) {
      return result ?? unavailable("Job preparation failed.");
    }
    const parsedSheet = JobSheetSchema.safeParse(result.jobSheet);
    if (!parsedSheet.success || parsedSheet.data.jobId !== jobId || parsedSheet.data.status !== "DRAFT") {
      return unavailable("The prepared job did not match its request identity.");
    }

    const resolvedPlantId = parsedSheet.data.plantId ?? (configuredPlantId?.success ? configuredPlantId.data : undefined);
    if (resolvedPlantId === undefined) {
      return unavailable("A configured plant ID is required to persist a draft job sheet.");
    }

    let saved;
    try {
      saved = await createDraftJobSheet(mergeDraftWriteArgs({
        jobSheet: parsedSheet.data,
        jobId,
        plantId: resolvedPlantId,
        ...(signal === undefined ? {} : { signal }),
      }));
    } catch (error) {
      if (error?.name === "AbortError" || signal?.aborted) throw error;
      return {
        ok: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Job sheet persistence failed; the idempotency claim was released for retry.",
        },
      };
    }

    if (saved?.ok === false) {
      return {
        ok: false,
        error: {
          code: saved.error?.code === "VALIDATION_ERROR" ? "VALIDATION_ERROR" : "SERVICE_UNAVAILABLE",
          message: saved.error?.message
            ?? persistFailed.error.message,
        },
      };
    }
    const expectedJobSheet = { ...parsedSheet.data, plantId: resolvedPlantId };
    const persistedDraft = readPersistedDraft(saved, jobId);
    if (!persistedDraft || !persistedJobSheetMatches(persistedDraft, expectedJobSheet)) {
      return persistFailed;
    }
    return { ...result, jobId, durable: true };
  };
}

export function createStoredJobReplayLoader({ getStoredJobSheet, storedJobLookupEnabled = false } = {}) {
  return async function loadJob({ jobId, signal } = {}) {
    if (storedJobLookupEnabled !== true || typeof getStoredJobSheet !== "function") return null;
    const stored = await getStoredJobSheet({ jobId, signal });
    if (stored == null || stored.ok === false) return null;
    const draft = readPersistedDraft(stored, jobId);
    if (!draft) return null;
    return { ok: true, jobId, jobSheet: draft, durable: true };
  };
}

/** `/jobs` reports success only after the DRAFT is durably persisted. */
export function createJobSubmissionHandler({
  prepareJob,
  createDraftJobSheet,
  getStoredJobSheet,
  draftPersistenceEnabled = false,
  storedJobLookupEnabled = false,
  plantId,
  store,
  leaseMs = 30_000,
} = {}) {
  if (typeof prepareJob !== "function") {
    throw new TypeError("A job coordinator is required.");
  }

  const createJob = createPersistableJobCreator({
    prepareJob,
    createDraftJobSheet,
    draftPersistenceEnabled,
    plantId,
  });
  const createIdempotently = createIdempotentJobService({
    store,
    leaseMs,
    createJob,
    loadJob: createStoredJobReplayLoader({ getStoredJobSheet, storedJobLookupEnabled }),
  });

  return async function submitJob({ identity, request, signal } = {}) {
    if (draftPersistenceEnabled !== true || typeof createDraftJobSheet !== "function") {
      return unavailable("Durable JobSheet persistence is not configured; job preparation was not run.");
    }

    return createIdempotently({ identity, request, signal });
  };
}
