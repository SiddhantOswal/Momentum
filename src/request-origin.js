/** Cloud Run terminates TLS before Node; never trust client Forwarded headers. */
export function isSameApplicationOrigin({ origin, requestUrl, cloudRun = false, configuredOrigin } = {}) {
  try {
    if (typeof origin !== "string") return false;
    const supplied = new URL(origin);
    if (supplied.origin !== origin || supplied.username || supplied.password) return false;
    const request = new URL(requestUrl);
    const expected = configuredOrigin === undefined ? new URL(request.origin) : new URL(configuredOrigin);
    if (configuredOrigin !== undefined && (expected.origin !== configuredOrigin || expected.username || expected.password)) return false;
    if (cloudRun) {
      if (configuredOrigin !== undefined && expected.protocol !== "https:") return false;
      expected.protocol = "https:";
    }
    return supplied.origin === expected.origin;
  } catch { return false; }
}
