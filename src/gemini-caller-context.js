import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Who a Gemini call is made for. The request middleware sets it once from the
 * verified cookie and the client address, so every path that reaches
 * withDailyGeminiCallCap is charged to that session and address without each
 * service passing them along (ADR-0004, design 5.2). A path that forgot to
 * pass them would silently skip the per-session and per-address limits.
 */
const callers = new AsyncLocalStorage();

export function runAsGeminiCaller({ principal, ipKey, nextReservationKey, onReservation }, work) {
  return callers.run(Object.freeze({ principal, ipKey: ipKey ?? null, nextReservationKey, onReservation }), work);
}

export function currentGeminiCaller() {
  return callers.getStore();
}

export function createGeminiCallerMiddleware({ getPrincipal, getIpKey }) {
  if (typeof getPrincipal !== "function" || typeof getIpKey !== "function") {
    throw new TypeError("Principal and address key readers are required.");
  }
  return (c, next) => runAsGeminiCaller({ principal: getPrincipal(c), ipKey: getIpKey(c) }, next);
}
