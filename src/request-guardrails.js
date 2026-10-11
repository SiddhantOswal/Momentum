const REQUEST_TIMEOUT_MS = 60_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const MAX_TRACKED_CLIENTS = 10_000;

export const REQUEST_SIGNAL_CONTEXT_KEY = "requestSignal";

export function createRequestTimeoutMiddleware(timeoutMs = REQUEST_TIMEOUT_MS) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("Request timeout must be a positive finite number.");
  }

  return async (c, next) => {
    const controller = new AbortController();
    c.set(REQUEST_SIGNAL_CONTEXT_KEY, controller.signal);

    let timer;
    const timeoutResponse = new Promise((resolve) => {
      timer = setTimeout(() => {
        controller.abort(new Error("Request deadline exceeded."));
        resolve(null);
      }, timeoutMs);
    });

    try {
      const completed = await Promise.race([
        Promise.resolve().then(next).then((response) => ({ response })),
        timeoutResponse.then(() => null),
      ]);
      if (completed) {
        return completed.response;
      }

      return c.json({
        ok: false,
        error: {
          code: "REQUEST_TIMEOUT",
          message: "Request exceeded the 60-second processing limit.",
        },
      }, 504);
    } finally {
      clearTimeout(timer);
    }
  };
}

export function getSocketClientIp(c) {
  const address = c.env?.incoming?.socket?.remoteAddress;
  if (typeof address !== "string" || address.trim() === "") {
    return undefined;
  }

  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

export function createPerIpRateLimitMiddleware({
  limit = RATE_LIMIT_MAX_REQUESTS,
  windowMs = RATE_LIMIT_WINDOW_MS,
  maxTrackedClients = MAX_TRACKED_CLIENTS,
  now = () => Date.now(),
  getClientIp = getSocketClientIp,
} = {}) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("Rate limit must be a positive integer.");
  }
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new RangeError("Rate-limit window must be a positive finite number.");
  }
  if (!Number.isInteger(maxTrackedClients) || maxTrackedClients < 1) {
    throw new RangeError("Maximum tracked clients must be a positive integer.");
  }

  const clients = new Map();

  return async (c, next) => {
    const clientIp = getClientIp(c);
    if (!clientIp) {
      return c.json({
        ok: false,
        error: {
          code: "CLIENT_IP_UNAVAILABLE",
          message: "The server could not safely identify the request client.",
        },
      }, 503);
    }

    const currentTime = now();
    let client = clients.get(clientIp);
    if (!client || currentTime - client.windowStartedAt >= windowMs) {
      if (clients.size >= maxTrackedClients) {
        for (const [ip, entry] of clients) {
          if (currentTime - entry.windowStartedAt >= windowMs) {
            clients.delete(ip);
          }
        }
      }

      if (!clients.has(clientIp) && clients.size >= maxTrackedClients) {
        return c.json({
          ok: false,
          error: {
            code: "RATE_LIMIT_CAPACITY",
            message: "Request rate limiting is temporarily at capacity.",
          },
        }, 503);
      }

      client = { windowStartedAt: currentTime, requestCount: 0 };
      clients.set(clientIp, client);
    }

    const resetSeconds = Math.ceil((client.windowStartedAt + windowMs - currentTime) / 1000);
    c.header("RateLimit-Limit", String(limit));
    c.header("RateLimit-Remaining", String(Math.max(0, limit - client.requestCount - 1)));
    c.header("RateLimit-Reset", String(resetSeconds));

    if (client.requestCount >= limit) {
      c.header("Retry-After", String(Math.max(1, resetSeconds)));
      return c.json({
        ok: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please wait before trying again.",
        },
      }, 429);
    }

    client.requestCount += 1;
    return next();
  };
}
