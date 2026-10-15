import { createCloudRunAccessTokenProvider } from "./bigquery-read-client.js";

export const GEMINI_COUNTER_POLICY_VERSION = "ist-attempts-v1";

export class GeminiReservationError extends Error {
  constructor(code = "GEMINI_USAGE_UNAVAILABLE", message = "Gemini usage could not be reserved. No provider request was issued.") {
    super(message);
    this.name = "GeminiReservationError";
    this.code = code;
  }
}

function validatePolicy({ dayKey, timeZone, limit } = {}) {
  if (typeof dayKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey) ||
      !Number.isFinite(Date.parse(`${dayKey}T00:00:00Z`)) ||
      new Date(`${dayKey}T00:00:00Z`).toISOString().slice(0, 10) !== dayKey ||
      timeZone !== "Asia/Kolkata" || !Number.isSafeInteger(limit) || limit < 1) {
    throw new GeminiReservationError("INVALID_GEMINI_USAGE_POLICY", "A valid IST day and positive attempted-call cap are required.");
  }
}

function decodeCount(document, { dayKey, timeZone, limit }) {
  const fields = document?.fields;
  const raw = fields?.attemptCount?.integerValue;
  const count = typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(count) || count < 0 ||
      fields?.dayKey?.stringValue !== dayKey || fields?.timezone?.stringValue !== timeZone ||
      fields?.configuredCap?.integerValue !== String(limit) ||
      fields?.policyVersion?.stringValue !== GEMINI_COUNTER_POLICY_VERSION ||
      typeof document.updateTime !== "string" || document.updateTime.length === 0) {
    throw new GeminiReservationError("GEMINI_USAGE_POLICY_MISMATCH", "The stored Gemini usage policy is invalid or differs from configuration. Provider calls remain blocked.");
  }
  return count;
}

/** No calls are made during construction. Cloud usage requires a separate opt-in. */
export function createFirestoreGeminiAttemptStore({
  projectId, database = "(default)", fetchImpl = fetch, tokenProvider,
  maxAttempts = 3, timeoutMs = 5000,
} = {}) {
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) ||
      database !== "(default)" || typeof fetchImpl !== "function" ||
      !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) {
    throw new TypeError("The existing default Firestore database and bounded reservation settings are required.");
  }
  const provideToken = tokenProvider ?? createCloudRunAccessTokenProvider({ fetchImpl });
  const databaseName = `projects/${projectId}/databases/${database}`;
  const root = `https://firestore.googleapis.com/v1/${databaseName}/documents`;

  async function request(url, { method = "GET", body, signal, token } = {}) {
    let response;
    try {
      response = await fetchImpl(url, {
        method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal,
      });
    } catch {
      throw new GeminiReservationError();
    }
    let payload;
    try { payload = await response.json(); } catch { throw new GeminiReservationError(); }
    return { status: response.status, ok: response.ok, payload };
  }

  return Object.freeze({
    scope: "shared-firestore-transaction",
    async reserveAttempt({ dayKey, timeZone, limit, signal } = {}) {
      const policy = { dayKey, timeZone, limit };
      validatePolicy(policy);
      const boundedSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs);
      let token;
      try { token = await provideToken({ signal: boundedSignal }); } catch { throw new GeminiReservationError(); }
      if (typeof token !== "string" || token.length === 0 || boundedSignal.aborted) throw new GeminiReservationError();
      const name = `${databaseName}/documents/gemini_daily_usage/${dayKey}`;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        let transaction;
        let commitIssued = false;
        try {
          const begun = await request(`${root}:beginTransaction`, {
            method: "POST", body: { options: { readWrite: {} } }, token, signal: boundedSignal,
          });
          transaction = begun.payload?.transaction;
          if (!begun.ok || typeof transaction !== "string" || !transaction) throw new GeminiReservationError();
          const read = await request(`${root}/gemini_daily_usage/${dayKey}?transaction=${encodeURIComponent(transaction)}`, { token, signal: boundedSignal });
          if (!read.ok && read.status !== 404) throw new GeminiReservationError();
          if (read.ok && read.payload?.name !== name) throw new GeminiReservationError();
          const count = read.status === 404 ? 0 : decodeCount(read.payload, policy);
          if (count >= limit) throw new GeminiReservationError("GEMINI_DAILY_CAP_EXCEEDED", "Gemini daily attempt cap is exhausted. Try after midnight IST.");
          const fields = {
            dayKey: { stringValue: dayKey }, timezone: { stringValue: timeZone },
            attemptCount: { integerValue: String(count + 1) }, configuredCap: { integerValue: String(limit) },
            policyVersion: { stringValue: GEMINI_COUNTER_POLICY_VERSION },
          };
          commitIssued = true;
          const committed = await request(`${root}:commit`, {
            method: "POST", token, signal: boundedSignal,
            body: { transaction, writes: [{
              update: { name, fields },
              currentDocument: read.status === 404 ? { exists: false } : { updateTime: read.payload.updateTime },
              updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
            }] },
          });
          // ABORTED is a definite non-commit. Ambiguous timeout/5xx responses
          // are never retried or refunded; they may already have consumed a slot.
          if (committed.status === 409 && committed.payload?.error?.status === "ABORTED") continue;
          if (!committed.ok || !Array.isArray(committed.payload?.writeResults) ||
              committed.payload.writeResults.length !== 1 || typeof committed.payload.commitTime !== "string" ||
              boundedSignal.aborted) throw new GeminiReservationError();
          return Object.freeze({ dayKey, timeZone, configuredCap: limit, attemptCount: count + 1 });
        } catch (error) {
          if (transaction && !commitIssued && !boundedSignal.aborted) {
            try {
              await request(`${root}:rollback`, { method: "POST", body: { transaction }, token, signal: boundedSignal });
            } catch { /* A failed rollback grants no provider permission. */ }
          }
          if (error instanceof GeminiReservationError) throw error;
          throw new GeminiReservationError();
        }
      }
      throw new GeminiReservationError();
    },
  });
}
