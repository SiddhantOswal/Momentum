/**
 * Shared Cloud Firestore REST helper: value codecs, schema-checked document
 * reads and writes, and the transaction calls (beginTransaction, commit with
 * preconditions, rollback).
 *
 * Uses the Firestore REST API with the caller's ADC access token, so no
 * Firestore SDK is needed. Callers own their token, retry and error mapping;
 * this module only reports what Firestore said, as a FirestoreRestError when
 * the answer cannot be trusted.
 */

import { TimestampSchema } from "../schemas.js";

export const FIRESTORE_API = "https://firestore.googleapis.com/v1";

export class FirestoreRestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "FirestoreRestError";
    this.code = code;
  }
}

function serviceUnavailable(message) {
  return new FirestoreRestError("SERVICE_UNAVAILABLE", message);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function encodeTimestamp(value) {
  const iso = value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : value;
  if (typeof iso !== "string" || !TimestampSchema.safeParse(iso).success ||
      !Number.isFinite(Date.parse(iso))) {
    throw new FirestoreRestError("UNSUPPORTED_VALUE_TYPE", "Timestamps must be valid dates or ISO 8601 strings with an offset.");
  }
  return { timestampValue: new Date(iso).toISOString() };
}

export function decodeTimestamp(value) {
  const raw = value?.timestampValue;
  if (typeof raw !== "string" || !TimestampSchema.safeParse(raw).success) {
    throw serviceUnavailable("Firestore returned an invalid timestamp.");
  }
  return raw;
}

/** Date values become Firestore Timestamps. A plain ISO string stays a string; see toFirestoreFields. */
export function toFirestoreValue(value) {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return encodeTimestamp(value);
  if (Array.isArray(value)) {
    return { arrayValue: value.length === 0 ? {} : { values: value.map(toFirestoreValue) } };
  }
  if (isPlainObject(value)) return { mapValue: { fields: toFirestoreFields(value) } };
  throw new FirestoreRestError(
    "UNSUPPORTED_VALUE_TYPE",
    `Cannot serialize value of type ${typeof value} to Firestore.`
  );
}

export function fromFirestoreValue(value) {
  if (!value || typeof value !== "object") return undefined;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return decodeTimestamp(value);
  if (value.arrayValue !== undefined) return (value.arrayValue.values ?? []).map(fromFirestoreValue);
  if (value.mapValue !== undefined) return fromFirestoreFields(value.mapValue.fields);
  return undefined;
}

/**
 * Undefined fields are left out, so optional schema fields stay absent.
 * `timestamps` names the top-level string fields to store as Timestamps,
 * which the TTL policy on `expiresAt` requires.
 */
export function toFirestoreFields(object, { timestamps = [] } = {}) {
  const timestampFields = new Set(timestamps);
  const fields = {};
  for (const [key, value] of Object.entries(object)) {
    if (value === undefined) continue;
    fields[key] = timestampFields.has(key) && value !== null
      ? encodeTimestamp(value)
      : toFirestoreValue(value);
  }
  return fields;
}

export function fromFirestoreFields(fields) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return {};
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)])
  );
}

/** A stored document that fails its schema is a fault, never an absent document. */
export function parseDocument(schema, document) {
  let decoded;
  try {
    decoded = fromFirestoreFields(document?.fields);
  } catch (error) {
    if (error instanceof FirestoreRestError) throw serviceUnavailable(error.message);
    throw error;
  }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) throw serviceUnavailable("Firestore returned a document that does not match its schema.");
  return parsed.data;
}

export function encodeDocument(schema, value, { timestamps = [] } = {}) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw serviceUnavailable("The document does not match its schema and was not written.");
  return toFirestoreFields(parsed.data, { timestamps });
}

/** Adds the `currentDocument.updateTime` precondition (and an update mask) to a document URL. */
export function conditionalWriteUrl(url, updateTime, updateMask = []) {
  if (typeof updateTime !== "string" || updateTime.length === 0) {
    throw new FirestoreRestError(
      "FIRESTORE_INVALID_RESPONSE",
      "Firestore omitted the document version required for a conditional write."
    );
  }
  const parsed = new URL(url);
  parsed.searchParams.set("currentDocument.updateTime", updateTime);
  for (const field of updateMask) parsed.searchParams.append("updateMask.fieldPaths", field);
  return parsed.toString();
}

/** `null` means the document must not exist yet; a string pins the version that was read. */
export function currentDocumentPrecondition(updateTime) {
  if (updateTime === null) return { exists: false };
  if (typeof updateTime !== "string" || updateTime.length === 0) {
    throw new FirestoreRestError(
      "FIRESTORE_INVALID_RESPONSE",
      "Firestore omitted the document version required for a conditional write."
    );
  }
  return { updateTime };
}

export async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw serviceUnavailable("Firestore returned a response that is not valid JSON.");
  }
}

export async function isPreconditionFailure(response) {
  if (response.status === 409) return true;
  if (response.status !== 400) return false;
  const payload = await readJson(response);
  return payload?.error?.status === "FAILED_PRECONDITION";
}

export function createFirestoreRestClient({
  projectId,
  database = "(default)",
  fetchImpl = fetch,
} = {}) {
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new TypeError("A valid Google Cloud project ID is required.");
  }
  if (typeof database !== "string" || database.length === 0) {
    throw new TypeError("A Firestore database name is required.");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("Fetch implementation must be a function.");
  }

  const databaseName = `projects/${projectId}/databases/${database}`;
  const documentsUrl = `${FIRESTORE_API}/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(database)}/documents`;

  async function send(url, { method = "GET", body, token, signal } = {}) {
    if (typeof token !== "string" || token.length === 0) {
      throw new FirestoreRestError("CLOUD_IDENTITY_UNAVAILABLE", "Cloud Run workload identity is unavailable.");
    }
    try {
      return await fetchImpl(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
        signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw serviceUnavailable("Cloud Firestore could not be reached.");
    }
  }

  async function request(url, options) {
    const response = await send(url, options);
    return { status: response.status, ok: response.ok, payload: await readJson(response) };
  }

  return Object.freeze({
    databaseName,
    documentsUrl,
    send,
    request,

    async beginTransaction({ token, signal, readOnly = false } = {}) {
      const begun = await request(`${documentsUrl}:beginTransaction`, {
        method: "POST",
        body: { options: readOnly ? { readOnly: {} } : { readWrite: {} } },
        token,
        signal,
      });
      const transaction = begun.payload?.transaction;
      if (!begun.ok || typeof transaction !== "string" || transaction.length === 0) {
        throw serviceUnavailable("Firestore did not start a transaction.");
      }
      return transaction;
    },

    /**
     * Every write must carry a `currentDocument` precondition, so a lost race
     * fails the commit instead of overwriting a newer version.
     * `aborted` is a definite non-commit and is safe to retry; any other
     * failure may have been applied and is left to the caller.
     */
    async commit({ transaction, writes, token, signal } = {}) {
      if (typeof transaction !== "string" || transaction.length === 0) {
        throw new TypeError("A transaction ID is required to commit.");
      }
      if (!Array.isArray(writes) || writes.length === 0 ||
          writes.some((write) => !isPlainObject(write?.currentDocument))) {
        throw new TypeError("Every write needs a currentDocument precondition.");
      }
      const committed = await request(`${documentsUrl}:commit`, {
        method: "POST",
        body: { transaction, writes },
        token,
        signal,
      });
      const errorStatus = committed.payload?.error?.status;
      return {
        ...committed,
        aborted: committed.status === 409 && errorStatus === "ABORTED",
        preconditionFailed: committed.status === 400 && errorStatus === "FAILED_PRECONDITION",
      };
    },

    async rollback({ transaction, token, signal } = {}) {
      const rolledBack = await request(`${documentsUrl}:rollback`, {
        method: "POST",
        body: { transaction },
        token,
        signal,
      });
      return rolledBack.ok;
    },
  });
}
