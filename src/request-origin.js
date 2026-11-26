/**
 * The origin this service answers on: `USTAAD_PUBLIC_ORIGIN` when it is set, otherwise the
 * request's own origin, which is https on Cloud Run because TLS ends before Node. Undefined
 * when the configured origin is not a bare origin. Client Forwarded headers are never used.
 */
export function applicationOrigin({ requestUrl, cloudRun = false, configuredOrigin } = {}) {
  try {
    const expected = configuredOrigin === undefined ? new URL(new URL(requestUrl).origin) : new URL(configuredOrigin);
    if (configuredOrigin !== undefined && (expected.origin !== configuredOrigin || expected.username || expected.password)) return undefined;
    if (cloudRun) {
      if (configuredOrigin !== undefined && expected.protocol !== "https:") return undefined;
      expected.protocol = "https:";
    } else if (configuredOrigin === undefined && expected.protocol !== "http:") {
      // A local run serves plain HTTP; an https origin here can only come from an absolute-form
      // request target, which would let a laptop mint sessions for a deployed origin.
      return undefined;
    }
    return expected.origin;
  } catch { return undefined; }
}

/**
 * The origin sessions are bound to. On Cloud Run only a valid https `USTAAD_PUBLIC_ORIGIN`
 * counts: the request URL there can come from an absolute-form request line the caller
 * writes, so it never names the audience. Undefined means sessions must stay off.
 */
export function sessionOrigin({ requestUrl, cloudRun = false, configuredOrigin } = {}) {
  if (cloudRun && configuredOrigin === undefined) return undefined;
  return applicationOrigin({ requestUrl, cloudRun, configuredOrigin });
}

export function isSameApplicationOrigin({ origin, requestUrl, cloudRun = false, configuredOrigin } = {}) {
  try {
    if (typeof origin !== "string") return false;
    const supplied = new URL(origin);
    if (supplied.origin !== origin || supplied.username || supplied.password || !URL.canParse(requestUrl)) return false;
    const expected = applicationOrigin({ requestUrl, cloudRun, configuredOrigin });
    return expected !== undefined && supplied.origin === expected;
  } catch { return false; }
}
