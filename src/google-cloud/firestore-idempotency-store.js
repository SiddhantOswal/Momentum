/**
 * FirestoreIdempotencyStore — shared-store idempotency adapter using
 * Cloud Firestore conditional writes.
 *
 * WHY FIRESTORE, NOT BIGQUERY:
 *   BigQuery DML (MERGE/INSERT) uses optimistic concurrency with no row-level
 *   locking and no PRIMARY KEY enforcement. Two concurrent MERGE WHEN NOT
 *   MATCHED THEN INSERT statements can both succeed, creating duplicate claim
 *   records. This violates the mutual-exclusion requirement of the claim
 *   contract and would allow duplicate jobs to be created.
 *
 *   Cloud Firestore's `createDocument` REST call atomically fails with HTTP 409
 *   if a document with the same name already exists. This is a true
 *   set-if-absent primitive — the only safe mechanism for the claim contract.
 *   Firestore documents support field-level updates (PATCH) and deletions,
 *   mapping directly to `complete` and `release`.
 *
 * PRODUCTION READINESS:
 *   config/gcp-firestore.json records prior API, database, and service-account
 *   setup. This offline code change does not reverify current Cloud Run
 *   configuration or workload identity; do not infer live durability from
 *   this adapter or enable its runtime gate here.
 *
 * RUNTIME GATE:
 *   This adapter is only constructed when `USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY`
 *   is `"true"`. Without that flag persistent job creation is unavailable;
 *   the runtime does not substitute a process-local lock or a non-idempotent
 *   creation path. InMemoryIdempotencyStore is limited to tests/development.
 *
 * NO NEW SDK:
 *   Uses the Firestore REST API with the same ADC access-token mechanism as the
 *   existing BigQuery adapters. No additional npm package is required.
 */

import { createCloudRunAccessTokenProvider } from "./bigquery-read-client.js";

const FIRESTORE_API = "https://firestore.googleapis.com/v1";

export class FirestoreIdempotencyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "FirestoreIdempotencyError";
    this.code = code;
  }
}

/**
 * Map a plain JS value to a Firestore REST API Value field.
 * Only the scalar types needed for idempotency records are supported.
 */
function toFirestoreValue(value) {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (value === null) return { nullValue: null };
  throw new FirestoreIdempotencyError(
    "UNSUPPORTED_VALUE_TYPE",
    `Cannot serialize value of type ${typeof value} to Firestore.`
  );
}

/** Map a Firestore REST fields object back to a plain JS object. */
function fromFirestoreFields(fields) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return {};
  return Object.fromEntries(
    Object.entries(fields).map(([key, v]) => {
      if (v.stringValue !== undefined) return [key, v.stringValue];
      if (v.integerValue !== undefined) return [key, Number(v.integerValue)];
      if (v.doubleValue !== undefined) return [key, v.doubleValue];
      if (v.booleanValue !== undefined) return [key, v.booleanValue];
      if (v.nullValue !== undefined) return [key, null];
      return [key, undefined];
    })
  );
}

function conditionalWriteUrl(url, updateTime, updateMask = []) {
  if (typeof updateTime !== "string" || updateTime.length === 0) {
    throw new FirestoreIdempotencyError(
      "FIRESTORE_INVALID_RESPONSE",
      "Firestore omitted the document version required for a conditional write."
    );
  }
  const parsed = new URL(url);
  parsed.searchParams.set("currentDocument.updateTime", updateTime);
  for (const field of updateMask) parsed.searchParams.append("updateMask.fieldPaths", field);
  return parsed.toString();
}

function firestoreUnavailable(message = "Firestore rejected the idempotency operation.") {
  return new FirestoreIdempotencyError("FIRESTORE_UNAVAILABLE", message);
}

async function isPreconditionFailure(response) {
  if (response.status === 409) return true;
  if (response.status !== 400) return false;
  const payload = await response.json();
  return payload?.error?.status === "FAILED_PRECONDITION";
}

/**
 * Create a Firestore-backed idempotency store that satisfies the claim/
 * complete/release contract required by createIdempotentJobService.
 *
 * @param {object} options
 * @param {string}   options.projectId   — GCP project ID
 * @param {string}   [options.database]  — Firestore database name (default: "(default)")
 * @param {string}   [options.collection] — Firestore collection name (default: "job_idempotency")
 * @param {Function} [options.fetchImpl]  — fetch implementation (injectable for tests)
 * @param {Function} [options.tokenProvider] — ADC token provider (injectable for tests)
 */
export function createFirestoreIdempotencyStore({
  projectId,
  database = "(default)",
  collection = "job_idempotency",
  fetchImpl = fetch,
  tokenProvider,
} = {}) {
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new TypeError("A valid Google Cloud project ID is required.");
  }
  if (typeof collection !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(collection)) {
    throw new TypeError("Collection name must be 1–128 word characters.");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("Fetch implementation must be a function.");
  }

  const provideToken = tokenProvider ?? createCloudRunAccessTokenProvider({ fetchImpl });
  const basePath = `${FIRESTORE_API}/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(database)}/documents/${encodeURIComponent(collection)}`;

  async function authorizedRequest(url, options, signal) {
    const token = await provideToken({ signal });
    if (typeof token !== "string" || token.length === 0) {
      throw new FirestoreIdempotencyError(
        "CLOUD_IDENTITY_UNAVAILABLE",
        "Cloud Run workload identity is unavailable."
      );
    }
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options?.headers,
        },
        signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new FirestoreIdempotencyError(
        "FIRESTORE_UNAVAILABLE",
        "Cloud Firestore could not be reached."
      );
    }
    return response;
  }

  return Object.freeze({
    /**
     * Atomically claim a slot for (keyHash, fingerprint, jobId).
     *
     * Uses Firestore's `createDocument` (POST with documentId) which atomically
     * fails with HTTP 409 ALREADY_EXISTS if the document already exists. This
     * is the only supported safe primitive for the mutual-exclusion requirement.
     *
     * Returns:
     *   { status: "claimed", ownerToken }   — caller owns the slot
     *   { status: "complete" }              — prior call completed; replay
     *   { status: "in_progress" }           — another caller holds a valid lease
     *   { status: "conflict" }              — same key, different fingerprint
     */
    async claim({ keyHash, fingerprint, jobId, ownerToken, claimedAt, leaseExpiresAt }, signal) {
      const documentId = keyHash; // document name is the keyHash — guaranteed unique per key

      // First, try to read an existing record to handle complete/in_progress/conflict.
      const getUrl = `${basePath}/${encodeURIComponent(documentId)}`;
      const getResponse = await authorizedRequest(getUrl, { method: "GET" }, signal);

      if (getResponse.status === 200) {
        const document = await getResponse.json();
        const existing = fromFirestoreFields(document.fields ?? {});
        if (existing.fingerprint !== fingerprint) {
          return { status: "conflict" };
        }
        if (existing.recordStatus === "complete") {
          return { status: "complete" };
        }
        if (existing.recordStatus !== "in_progress" || !Number.isFinite(existing.leaseExpiresAt)) {
          throw firestoreUnavailable("Firestore returned an invalid idempotency record.");
        }
        if (existing.leaseExpiresAt > claimedAt) return { status: "in_progress" };

        const deleteUrl = conditionalWriteUrl(getUrl, document.updateTime);
        const deleteResponse = await authorizedRequest(deleteUrl, { method: "DELETE" }, signal);
        if (await isPreconditionFailure(deleteResponse)) {
          const racedGet = await authorizedRequest(getUrl, { method: "GET" }, signal);
          if (racedGet.status === 200) {
            const racedDocument = await racedGet.json();
            const raced = fromFirestoreFields(racedDocument.fields ?? {});
            if (raced.fingerprint !== fingerprint) return { status: "conflict" };
            if (raced.recordStatus === "complete") return { status: "complete" };
            if (raced.recordStatus === "in_progress" && raced.leaseExpiresAt > claimedAt) {
              return { status: "in_progress" };
            }
          } else if (racedGet.status !== 404) {
            throw firestoreUnavailable("Firestore could not confirm the expired claim race.");
          }
        } else if (deleteResponse.status !== 200 && deleteResponse.status !== 404) {
          throw firestoreUnavailable("Firestore could not conditionally release the expired claim.");
        }
      } else if (getResponse.status !== 404) {
        throw firestoreUnavailable("Firestore returned an unexpected status when reading the idempotency record.");
      }

      // Attempt atomic create-if-absent.
      const createUrl = `${basePath}?documentId=${encodeURIComponent(documentId)}`;
      const body = JSON.stringify({
        fields: {
          keyHash: toFirestoreValue(keyHash),
          fingerprint: toFirestoreValue(fingerprint),
          jobId: toFirestoreValue(jobId),
          ownerToken: toFirestoreValue(ownerToken),
          recordStatus: toFirestoreValue("in_progress"),
          claimedAt: toFirestoreValue(claimedAt),
          leaseExpiresAt: toFirestoreValue(leaseExpiresAt),
        },
      });

      const createResponse = await authorizedRequest(createUrl, { method: "POST", body }, signal);

      if (createResponse.status === 200 || createResponse.status === 201) {
        return { status: "claimed", ownerToken };
      }
      if (createResponse.status === 409) {
        // Race condition: another instance claimed between our GET and POST.
        // Re-read to determine the actual state.
        const raceGet = await authorizedRequest(getUrl, { method: "GET" }, signal);
        if (raceGet.status === 200) {
          const raceDoc = fromFirestoreFields((await raceGet.json()).fields ?? {});
          if (raceDoc.fingerprint !== fingerprint) return { status: "conflict" };
          if (raceDoc.recordStatus === "complete") return { status: "complete" };
          return { status: "in_progress" };
        }
        return { status: "in_progress" };
      }
      throw firestoreUnavailable("Firestore rejected the idempotency claim with an unexpected status.");
    },

    /**
     * Mark the record complete. Only the owning token may do this.
     * Uses PATCH with updateMask to touch only the status and completedAt fields.
     */
    async complete({ keyHash, fingerprint, jobId, ownerToken, completedAt }, signal) {
      const documentId = keyHash;
      const getUrl = `${basePath}/${encodeURIComponent(documentId)}`;
      const getResponse = await authorizedRequest(getUrl, { method: "GET" }, signal);
      if (getResponse.status === 404) return false;
      if (getResponse.status !== 200) throw firestoreUnavailable("Firestore could not read the claim before completion.");
      const document = await getResponse.json();
      const existing = fromFirestoreFields(document.fields ?? {});
      if (existing.ownerToken !== ownerToken || existing.fingerprint !== fingerprint || existing.jobId !== jobId) {
        return false;
      }
      if (existing.recordStatus === "complete") return true;
      if (existing.recordStatus !== "in_progress") return false;

      const updateUrl = conditionalWriteUrl(
        getUrl,
        document.updateTime,
        ["recordStatus", "completedAt"],
      );
      const body = JSON.stringify({
        fields: {
          recordStatus: toFirestoreValue("complete"),
          completedAt: toFirestoreValue(completedAt),
        },
      });
      const updateResponse = await authorizedRequest(updateUrl, { method: "PATCH", body }, signal);
      if (updateResponse.status === 200) return true;
      if (await isPreconditionFailure(updateResponse) || updateResponse.status === 404) {
        const latestResponse = await authorizedRequest(getUrl, { method: "GET" }, signal);
        if (latestResponse.status === 200) {
          const latest = fromFirestoreFields((await latestResponse.json()).fields ?? {});
          if (latest.ownerToken === ownerToken &&
              latest.fingerprint === fingerprint &&
              latest.jobId === jobId &&
              latest.recordStatus === "complete") return true;
        }
        return false;
      }
      throw firestoreUnavailable("Firestore could not conditionally complete the claim.");
    },

    /**
     * Release the claim so another attempt can retry.
     * Only the owning token may do this. Deletes the document.
     */
    async release({ keyHash, ownerToken }, signal) {
      const documentId = keyHash;
      const getUrl = `${basePath}/${encodeURIComponent(documentId)}`;
      const getResponse = await authorizedRequest(getUrl, { method: "GET" }, signal);
      if (getResponse.status === 404) return false;
      if (getResponse.status !== 200) throw firestoreUnavailable("Firestore could not read the claim before release.");
      const document = await getResponse.json();
      const existing = fromFirestoreFields(document.fields ?? {});
      if (existing.ownerToken !== ownerToken) return false;
      if (existing.recordStatus === "complete") return false;
      const deleteUrl = conditionalWriteUrl(getUrl, document.updateTime);
      const deleteResponse = await authorizedRequest(deleteUrl, { method: "DELETE" }, signal);
      if (deleteResponse.status === 200) return true;
      if (deleteResponse.status === 404 || await isPreconditionFailure(deleteResponse)) return false;
      throw firestoreUnavailable("Firestore could not conditionally release the claim.");
    },
  });
}
