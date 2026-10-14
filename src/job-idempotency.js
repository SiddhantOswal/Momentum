import { createHash, randomUUID } from "node:crypto";

/**
 * In-memory fake IdempotencyStore for offline testing and single-instance
 * development. This store is NOT durable across process restarts, does NOT
 * coordinate across application replicas, and MUST NOT be used as the
 * production persistence mechanism. It implements the same atomic
 * claim/complete/release contract as a real shared-store adapter so that all
 * guardrail logic, conflict handling, and retry paths can be fully tested
 * offline.
 *
 * Shared-store blocker: a real production adapter requires an atomic
 * compare-and-swap operation against a durable, globally consistent backend
 * (e.g., a BigQuery row insert with a UNIQUE constraint or a Cloud Firestore
 * conditional write). The interface below is the adapter contract; only the
 * backing storage needs to change.
 */
export class InMemoryIdempotencyStore {
  #records = new Map();
  #leaseMs;

  constructor({ leaseMs = 30_000 } = {}) {
    if (!Number.isFinite(leaseMs) || leaseMs <= 0) {
      throw new TypeError("leaseMs must be a positive finite number.");
    }
    this.#leaseMs = leaseMs;
  }

  /**
   * Atomically claim a slot for (keyHash, fingerprint, jobId).
   *
   * Returns:
   *   { status: "claimed", ownerToken }  — this caller owns the slot and must create the job.
   *   { status: "complete" }             — a prior call completed; caller should replay.
   *   { status: "in_progress" }          — another call holds the lease; retry shortly.
   *   { status: "conflict" }             — same key, different fingerprint.
   */
  async claim({ keyHash, fingerprint, jobId, ownerToken, claimedAt, leaseExpiresAt }) {
    const now = claimedAt;
    const existing = this.#records.get(keyHash);

    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        return { status: "conflict" };
      }
      if (existing.status === "complete") {
        return { status: "complete" };
      }
      // in_progress but lease may have expired — treat expired leases as releasable
      if (existing.status === "in_progress" && existing.leaseExpiresAt > now) {
        return { status: "in_progress" };
      }
      // expired lease — allow re-claim (fault recovery path)
    }

    const record = {
      keyHash,
      fingerprint,
      jobId,
      ownerToken,
      status: "in_progress",
      claimedAt,
      leaseExpiresAt: leaseExpiresAt ?? claimedAt + this.#leaseMs,
    };
    this.#records.set(keyHash, record);
    return { status: "claimed", ownerToken };
  }

  /**
   * Mark the record complete. Only the owning token may do this.
   * Idempotent if called again with the same ownerToken.
   */
  async complete({ keyHash, fingerprint, jobId, ownerToken, completedAt }) {
    const existing = this.#records.get(keyHash);
    if (!existing || existing.ownerToken !== ownerToken) return;
    if (existing.fingerprint !== fingerprint) return;
    this.#records.set(keyHash, {
      ...existing,
      status: "complete",
      completedAt,
    });
  }

  /**
   * Release the lease so a different attempt can retry.
   * Only the owning token may do this; releasing a complete record is a no-op.
   */
  async release({ keyHash, ownerToken }) {
    const existing = this.#records.get(keyHash);
    if (!existing || existing.ownerToken !== ownerToken) return;
    if (existing.status === "complete") return;
    this.#records.delete(keyHash);
  }

  /** Remove all records — for test isolation only. */
  clear() {
    this.#records.clear();
  }

  /** Return a snapshot of a record by keyHash — for test assertions only. */
  inspect(keyHash) {
    return this.#records.get(keyHash);
  }
}

const visibleKey = /^[\x21-\x7e]{1,128}$/;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validationError(field, message) {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Job idempotency identity is invalid.",
      issues: [{ field, path: [field], code: "invalid_value", message }],
    },
  };
}

/**
 * Derive opaque, deterministic identity from validated fields and PO bytes.
 * Only hashes leave this function; neither the PO nor the raw client key is
 * suitable for storage in an idempotency record.
 */
export function createJobRequestIdentity({
  idempotencyKey,
  fileBytes,
  operatorFields,
  operatorItemConfirmation,
  purchaseOrderReviewFingerprint,
  shift,
  levers,
} = {}) {
  if (idempotencyKey !== undefined &&
      (typeof idempotencyKey !== "string" || !visibleKey.test(idempotencyKey))) {
    return validationError("Idempotency-Key", "Use 1–128 visible ASCII characters without spaces.");
  }
  if (!(fileBytes instanceof Uint8Array)) {
    return validationError("file", "A validated purchase-order file is required.");
  }
  if (!operatorFields || typeof operatorFields !== "object" || Array.isArray(operatorFields) ||
      !operatorItemConfirmation || typeof operatorItemConfirmation !== "object" ||
      Array.isArray(operatorItemConfirmation) ||
      typeof operatorItemConfirmation.itemCode !== "string" ||
      operatorItemConfirmation.itemCode.trim().length === 0 ||
      !Number.isSafeInteger(operatorItemConfirmation.quantity) ||
      operatorItemConfirmation.quantity < 1 ||
      (operatorItemConfirmation.lineIndex !== undefined &&
        (!Number.isSafeInteger(operatorItemConfirmation.lineIndex) || operatorItemConfirmation.lineIndex < 0)) ||
      (purchaseOrderReviewFingerprint !== undefined &&
        (typeof purchaseOrderReviewFingerprint !== "string" ||
          !/^[a-f0-9]{64}$/.test(purchaseOrderReviewFingerprint))) ||
      !levers || typeof levers !== "object" || Array.isArray(levers) ||
      !["DAY", "NIGHT"].includes(shift)) {
    return validationError("request", "Validated operator fields, item confirmation, shift, and machine settings are required.");
  }

  const fileFingerprint = sha256(fileBytes);
  const canonicalRequest = JSON.stringify({
    fileFingerprint,
    operatorFields: {
      orderId: operatorFields.orderId,
      paperType: operatorFields.paperType,
      paperSupplier: operatorFields.paperSupplier,
    },
    operatorItemConfirmation: {
      itemCode: operatorItemConfirmation.itemCode,
      quantity: operatorItemConfirmation.quantity,
      lineIndex: operatorItemConfirmation.lineIndex,
    },
    purchaseOrderReviewFingerprint,
    shift,
    levers: {
      sfSpeedMpm: levers.sfSpeedMpm,
      rollTempC: levers.rollTempC,
      gumApplication: levers.gumApplication,
      gumViscositySec: levers.gumViscositySec,
      pastingPressure: levers.pastingPressure,
      dryingHours: levers.dryingHours,
      printSpeedSpm: levers.printSpeedSpm,
    },
  });
  const fingerprint = sha256(canonicalRequest);
  const keyHash = sha256(idempotencyKey === undefined
    ? `ustaad-jobs:v1:request:${fingerprint}`
    : `ustaad-jobs:v1:client:${idempotencyKey}`);
  return {
    ok: true,
    identity: {
      keyHash,
      fingerprint,
      jobId: `JOB-${keyHash.slice(0, 40)}`,
    },
  };
}

function unavailable(message = "The shared job-idempotency store is not configured.") {
  return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message } };
}

/**
 * Run a durable job creation through a shared store implementing atomic claim,
 * complete, and owner-conditional release. The store receives hashes and
 * lifecycle metadata only. `createJob` must durably persist under jobId before
 * returning success; `loadJob` reconstructs a replay without storing a PO or
 * other result payload in the idempotency record.
 */
export function createIdempotentJobService({
  store,
  createJob,
  loadJob,
  leaseMs,
  now = () => Date.now(),
  ownerTokenFactory = randomUUID,
} = {}) {
  const ready = store && typeof store.claim === "function" &&
    typeof store.complete === "function" && typeof store.release === "function" &&
    typeof createJob === "function" && typeof loadJob === "function" &&
    Number.isFinite(leaseMs) && leaseMs > 0;

  return async function createIdempotently({ identity, request, signal } = {}) {
    if (!ready) return unavailable();
    if (!identity || !/^[a-f0-9]{64}$/.test(identity.keyHash ?? "") ||
        !/^[a-f0-9]{64}$/.test(identity.fingerprint ?? "") ||
        identity.jobId !== `JOB-${identity.keyHash.slice(0, 40)}`) {
      return validationError("identity", "A valid request identity is required.");
    }

    const ownerToken = ownerTokenFactory();
    const claimedAt = now();
    let claim;
    try {
      claim = await store.claim({
        keyHash: identity.keyHash,
        fingerprint: identity.fingerprint,
        jobId: identity.jobId,
        ownerToken,
        claimedAt,
        leaseExpiresAt: claimedAt + leaseMs,
      });
    } catch {
      return unavailable("The shared job-idempotency store could not claim this request.");
    }

    if (claim?.status === "conflict") {
      return { ok: false, error: { code: "CONFLICT", message: "This idempotency key was used for a different request." } };
    }
    if (claim?.status === "in_progress") {
      return { ok: false, error: { code: "IDEMPOTENCY_IN_PROGRESS", message: "A matching job request is already in progress; retry shortly." } };
    }
    if (claim?.status === "complete") {
      try {
        const existing = await loadJob({ jobId: identity.jobId, signal });
        return existing ?? unavailable("The completed idempotency record has no readable job.");
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        return unavailable("The completed job could not be loaded for retry.");
      }
    }
    if (claim?.status !== "claimed" || claim.ownerToken !== ownerToken) {
      return unavailable("The shared idempotency store returned an invalid claim result.");
    }

    try {
      const result = await createJob({ jobId: identity.jobId, request, signal });
      const resultJobId = result?.jobSheet?.jobId ?? result?.jobId;
      if (!result || result.ok !== true || resultJobId !== identity.jobId || result.durable !== true) {
        await store.release({ keyHash: identity.keyHash, ownerToken });
        return result?.ok === false ? result : unavailable("The job was not durably created under its idempotency identity.");
      }
      const completed = await store.complete({
        keyHash: identity.keyHash,
        fingerprint: identity.fingerprint,
        jobId: identity.jobId,
        ownerToken,
        completedAt: now(),
      });
      if (completed === false) {
        return unavailable("The durable job exists but its shared idempotency claim could not be completed.");
      }
      return result;
    } catch (error) {
      try {
        await store.release({ keyHash: identity.keyHash, ownerToken });
      } catch {
        // The claim lease is the recovery path if an adapter cannot release.
      }
      if (error?.name === "AbortError" || signal?.aborted) throw error;
      return unavailable("Job creation failed; the idempotency claim was released for retry.");
    }
  };
}
