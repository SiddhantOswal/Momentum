import bindingConfig from "../../config/model-version-binding.json" with { type: "json" };
import { BIGQUERY_API, createCloudRunAccessTokenProvider } from "./bigquery-read-client.js";

export const MODEL_VERSION_MISMATCH = "MODEL_VERSION_MISMATCH";
export const MODEL_VERSION_UNVERIFIED = "MODEL_VERSION_UNVERIFIED";

const RESOURCE = /^([A-Za-z_][A-Za-z0-9_]{0,1023})\.(m2_[a-z0-9_]{1,64})$/;
// BigQuery returns model etags as base64. Anything else is treated as an invalid
// response, so /api/status never repeats arbitrary upstream text.
const ETAG = /^[A-Za-z0-9+/=_-]{1,128}$/;

class ModelReadFailure extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

function bindingTargets(modelAcceptance) {
  const versions = modelAcceptance?.currentModelVersions;
  const models = Array.isArray(modelAcceptance?.models) ? modelAcceptance.models : [];
  const targets = models.map((model) => {
    const match = typeof model?.resource === "string" ? RESOURCE.exec(model.resource) : null;
    const expected = versions?.[model?.defect];
    if (!match || typeof model.defect !== "string" || typeof expected !== "string" || !ETAG.test(expected)) {
      throw new TypeError("Every accepted model needs an m2_* resource and a current etag to bind.");
    }
    return Object.freeze({ defect: model.defect, resource: model.resource, datasetId: match[1], modelId: match[2], expected });
  });
  if (targets.length === 0) throw new TypeError("The acceptance record lists no models to bind.");
  return targets;
}

// Races the operation so a token provider or fetch that ignores the signal
// still cannot hold the check open past the timeout.
async function withTimeout(timeoutMs, operation) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ModelReadFailure("TIMEOUT"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function mismatchMessage(operation, defects) {
  return defects.length === 1
    ? `${operation} is blocked: the ${defects[0]} model in BigQuery is not the accepted version.`
    : `${operation} is blocked: the ${defects.join(", ")} models in BigQuery are not the accepted versions.`;
}

/**
 * Binds the served models to the accepted etags (audit M01). The service reads
 * model metadata only (models.get has no query cost) and fails closed: until
 * every target has been read and matches, guarded ports return 503 codes.
 */
export function createModelVersionBinding({
  projectId,
  modelAcceptance,
  fetchImpl = fetch,
  tokenProvider,
  checkIntervalMs = bindingConfig.checkIntervalMs,
  requestTimeoutMs = bindingConfig.requestTimeoutMs,
  now = () => new Date(),
  log = (entry) => console.error(JSON.stringify(entry)),
} = {}) {
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new TypeError("A valid Google Cloud project ID is required.");
  }
  if (typeof fetchImpl !== "function" || (tokenProvider !== undefined && typeof tokenProvider !== "function")) {
    throw new TypeError("Fetch and token providers must be functions.");
  }
  if (!Number.isSafeInteger(checkIntervalMs) || checkIntervalMs < 1000 ||
      !Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs >= checkIntervalMs) {
    throw new TypeError("The model version check interval and timeout are out of range.");
  }
  const targets = bindingTargets(modelAcceptance);
  const provideToken = tokenProvider ?? createCloudRunAccessTokenProvider({ fetchImpl });
  let results = new Map(targets.map((target) => [target.defect,
    { observed: null, state: "unchecked", checkedAt: null, reason: null }]));
  let lastCheckedAt = null;
  let inFlight;
  let timer;

  async function readEtag(target, accessToken, signal) {
    const url = `${BIGQUERY_API}/projects/${encodeURIComponent(projectId)}` +
      `/datasets/${encodeURIComponent(target.datasetId)}/models/${encodeURIComponent(target.modelId)}`;
    let response;
    try {
      response = await fetchImpl(url, { method: "GET", headers: { Authorization: `Bearer ${accessToken}` }, signal });
    } catch {
      throw new ModelReadFailure("BIGQUERY_UNAVAILABLE");
    }
    if (!response.ok) throw new ModelReadFailure(response.status === 404 ? "MODEL_NOT_FOUND" : "MODEL_READ_FAILED");
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ModelReadFailure("INVALID_RESPONSE");
    }
    if (typeof payload?.etag !== "string" || !ETAG.test(payload.etag)) throw new ModelReadFailure("INVALID_RESPONSE");
    return payload.etag;
  }

  function overallState(entries) {
    if (entries.some((entry) => entry.state === "mismatch")) return "mismatch";
    if (entries.every((entry) => entry.state === "match")) return "verified";
    if (entries.every((entry) => entry.state === "unchecked")) return "unchecked";
    return "unverified";
  }

  async function runCheck() {
    const before = overallState([...results.values()]);
    let accessToken;
    let tokenFailure;
    try {
      accessToken = await withTimeout(requestTimeoutMs, (signal) => provideToken({ signal }));
      if (typeof accessToken !== "string" || accessToken.length === 0) tokenFailure = "IDENTITY_UNAVAILABLE";
    } catch (error) {
      tokenFailure = error instanceof ModelReadFailure ? error.reason : "IDENTITY_UNAVAILABLE";
    }
    const outcomes = await Promise.all(targets.map(async (target) => {
      if (tokenFailure) return { observed: null, state: "unverified", reason: tokenFailure };
      try {
        const observed = await withTimeout(requestTimeoutMs, (signal) => readEtag(target, accessToken, signal));
        return { observed, state: observed === target.expected ? "match" : "mismatch", reason: null };
      } catch (error) {
        return { observed: null, state: "unverified", reason: error instanceof ModelReadFailure ? error.reason : "MODEL_READ_FAILED" };
      }
    }));
    const checkedAt = now().toISOString();
    results = new Map(targets.map((target, index) => [target.defect, { ...outcomes[index], checkedAt }]));
    lastCheckedAt = checkedAt;
    const after = overallState(outcomes);
    if (after !== before) {
      log({
        event: "model_version_check",
        state: after,
        targets: targets.map((target, index) => ({ defect: target.defect, state: outcomes[index].state, reason: outcomes[index].reason })),
      });
    }
  }

  // One check at a time; callers during a check share its result. A check that
  // fails unexpectedly leaves every target unverified instead of keeping old state.
  function check() {
    inFlight ??= runCheck()
      .catch(() => {
        results = new Map(targets.map((target) => [target.defect,
          { observed: null, state: "unverified", checkedAt: null, reason: "CHECK_FAILED" }]));
      })
      .finally(() => { inFlight = undefined; });
    return inFlight;
  }

  function snapshot() {
    const entries = targets.map((target) => {
      const result = results.get(target.defect);
      return {
        defect: target.defect,
        resource: target.resource,
        expected: target.expected,
        observed: result.observed,
        state: result.state,
        checkedAt: result.checkedAt,
        ...(result.reason ? { reason: result.reason } : {}),
      };
    });
    return { enforced: true, state: overallState(entries), checkIntervalMs, lastCheckedAt, targets: entries };
  }

  function gate(operation) {
    const failing = (predicate) => targets.filter((target) => predicate(results.get(target.defect).state))
      .map((target) => target.defect);
    const mismatched = failing((state) => state === "mismatch");
    if (mismatched.length > 0) {
      return {
        ok: false,
        error: {
          code: MODEL_VERSION_MISMATCH,
          message: mismatchMessage(operation, mismatched),
          targets: mismatched,
        },
      };
    }
    const unverified = failing((state) => state !== "match");
    if (unverified.length > 0) {
      return {
        ok: false,
        error: {
          code: MODEL_VERSION_UNVERIFIED,
          message: `${operation} is blocked until the accepted model versions are confirmed in BigQuery.`,
          targets: unverified,
        },
      };
    }
    return undefined;
  }

  return Object.freeze({
    check,
    snapshot,
    gate,
    guard(port, operation) {
      return async (input) => gate(operation) ?? port(input);
    },
    start() {
      if (!timer) {
        timer = setInterval(() => { check(); }, checkIntervalMs);
        // The periodic check must not keep a test or a draining instance alive.
        timer.unref?.();
      }
      return check();
    },
    stop() {
      clearInterval(timer);
      timer = undefined;
    },
  });
}
