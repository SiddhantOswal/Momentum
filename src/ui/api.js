// Same-origin boundaries also apply to authenticated trace streams.
export function apiUrl(path) {
  const resolved = new URL(path, window.location.origin);
  if (resolved.origin !== window.location.origin) throw new Error("API requests must use the current application origin.");
  return resolved.toString();
}
export async function request(url, options = {}) {
  const response = await fetch(apiUrl(url), options);
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("application/pdf") && response.ok) return { response, pdf: await response.blob() };
  let payload;
  try { payload = await response.json(); } catch { throw new Error("The server returned an unreadable response. Try again."); }
  if (new URL(apiUrl(url)).pathname !== "/api/status") assertProductionResponse(payload);
  return { response, payload };
}
// Latest response wins even when abort is ignored by a remote adapter.
export function createRequestGate() {
  let generation = 0;
  let controller;
  return {
    begin() { controller?.abort(); controller = new AbortController(); const token = ++generation; return { signal: controller.signal, current: () => token === generation }; },
    invalidate() { generation += 1; controller?.abort(); },
  };
}

const excludedSources = new Set(["mock-demo", "offline-test-adapter", "simulated", "simulated-sensor", "synthetic", "preview"]);
export function assertProductionResponse(payload) {
  function excluded(value) {
    if (!value || typeof value !== "object") return false;
    return Object.entries(value).some(([key, entry]) =>
      (["source", "sensorSource", "series", "dataOrigin"].includes(key) && excludedSources.has(entry)) ||
      (["isSynthetic", "isSimulated", "isDemo", "testOnly"].includes(key) && entry === true) ||
      excluded(entry));
  }
  if (excluded(payload)) throw new Error("Production data is unavailable for this action. Check the configured data source.");
  if (payload?.ok === false && /\b(?:synthetic|simulated|fixture|mock-demo)\b/i.test(payload.error?.message ?? "")) {
    throw new Error("This action is unavailable under the current backend data policy. Check the configured data source.");
  }
}
