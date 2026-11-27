import { createHmac } from "node:crypto";
import { isIP } from "node:net";

const REQUEST_TIMEOUT_MS = 60_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const MAX_TRACKED_CLIENTS = 10_000;
const PER_SESSION_RATE_LIMIT = 60;
const RATE_LIMIT_REMAINING_CONTEXT_KEY = "rateLimitRemaining";
const DEFAULT_TRUSTED_HOPS = 1;
const MAX_TRUSTED_HOPS = 10;
const UNKNOWN_CLIENT_LOG_INTERVAL_MS = 60_000;

export const UNKNOWN_CLIENT_KEY = "unknown";

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

function ipv6Groups(address) {
  // The WHATWG host serializer gives one lowercase, compressed form and turns an embedded IPv4 tail into hex.
  const [head, tail] = new URL(`http://[${address}]/`).hostname.slice(1, -1).split("::");
  const groups = (text) => (text ? text.split(":").map((group) => Number.parseInt(group, 16)) : []);
  const left = groups(head);
  const right = groups(tail);
  return [...left, ...new Array(8 - left.length - right.length).fill(0), ...right];
}

/**
 * The rate-limit and budget key for one address. IPv4 and IPv4-mapped IPv6 key on the
 * full IPv4 address. Other IPv6 keys on its /64, because one subscriber is usually
 * given a whole /64 and can change the low 64 bits at will.
 */
export function clientKeyForAddress(address) {
  if (typeof address !== "string") return undefined;
  if (isIP(address) === 4) return address;
  const bare = address.split("%")[0];
  if (isIP(bare) !== 6) return undefined;
  const groups = ipv6Groups(bare);
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
  }
  return `${groups.slice(0, 4).map((group) => group.toString(16)).join(":")}::/64`;
}

const socketClientKey = (c) => clientKeyForAddress(getSocketClientIp(c));

function readTrustedHops(value) {
  if (value === undefined || value === "") {
    return DEFAULT_TRUSTED_HOPS;
  }
  const hops = /^[1-9][0-9]*$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(hops) || hops > MAX_TRUSTED_HOPS) {
    throw new RangeError(`RATE_LIMIT_TRUSTED_HOPS must be an integer from 1 to ${MAX_TRUSTED_HOPS}.`);
  }
  return hops;
}

function forwardedClientKey(header, trustedHops) {
  if (typeof header !== "string") {
    return undefined;
  }
  const entries = header.split(",").map((entry) => entry.trim());
  const entry = entries[entries.length - trustedHops];
  return entry ? clientKeyForAddress(entry) : undefined;
}

const logWarning = (entry) => console.warn(JSON.stringify(entry));

// On Cloud Run the socket peer is Google's front end, so the client address is the
// X-Forwarded-For entry appended by the last trusted proxy. Entries to its left are
// client-controlled. A missing or unusable entry shares one bucket instead of going unlimited,
// and a warning at most once a minute lets a log-based alert see that bucket in use.
export function createClientKeyResolver(env = process.env, { log = logWarning, now = Date.now } = {}) {
  if (!env.K_SERVICE) {
    return socketClientKey;
  }
  const trustedHops = readTrustedHops(env.RATE_LIMIT_TRUSTED_HOPS);
  let lastWarnedAt;
  return (c) => {
    const key = forwardedClientKey(c.req.header("x-forwarded-for"), trustedHops);
    if (key !== undefined) return key;
    const currentTime = now();
    if (lastWarnedAt === undefined || currentTime - lastWarnedAt >= UNKNOWN_CLIENT_LOG_INTERVAL_MS) {
      lastWarnedAt = currentTime;
      log({
        severity: "WARNING",
        event: "client_key_unknown",
        message: "A request had no usable X-Forwarded-For entry and was counted in the shared unknown bucket.",
        trustedHops,
      });
    }
    return UNKNOWN_CLIENT_KEY;
  };
}

/**
 * The keyed hash the budget counters use for a client (design 5.2): the first
 * 16 hex of HMAC-SHA-256 over `ip.v1.<key>`. Nothing keeps the raw address.
 * With no usable key the caller gets null and is charged to the global counters only.
 */
export function createIpKeyDeriver(signingKeyHex) {
  if (typeof signingKeyHex !== "string" || !/^[a-f0-9]{64}$/.test(signingKeyHex)) return () => null;
  const key = Buffer.from(signingKeyHex, "hex");
  return (clientKey) => (typeof clientKey === "string" && clientKey !== ""
    ? createHmac("sha256", key).update(`ip.v1.${clientKey}`).digest("hex").slice(0, 16)
    : null);
}

export function createPerIpRateLimitMiddleware({
  limit = RATE_LIMIT_MAX_REQUESTS,
  windowMs = RATE_LIMIT_WINDOW_MS,
  maxTrackedClients = MAX_TRACKED_CLIENTS,
  now = () => Date.now(),
  getClientIp = socketClientKey,
} = {}) {
  return createFixedWindowMiddleware({
    limit,
    windowMs,
    maxTrackedClients,
    now,
    getKey: getClientIp,
    onMissingKey: (c) => c.json({
      ok: false,
      error: {
        code: "CLIENT_IP_UNAVAILABLE",
        message: "The server could not safely identify the request client.",
      },
    }, 503),
  });
}

// Requests without a verified demo session are left to the per-IP limit.
export function createPerSessionRateLimitMiddleware({
  limit = PER_SESSION_RATE_LIMIT,
  windowMs = RATE_LIMIT_WINDOW_MS,
  maxTrackedClients = MAX_TRACKED_CLIENTS,
  now = () => Date.now(),
  getSessionId,
} = {}) {
  if (typeof getSessionId !== "function") {
    throw new TypeError("A session ID reader is required.");
  }
  return createFixedWindowMiddleware({
    limit,
    windowMs,
    maxTrackedClients,
    now,
    getKey: getSessionId,
    onMissingKey: (_c, next) => next(),
  });
}

export function createApiRateLimitMiddleware({
  ipLimit = RATE_LIMIT_MAX_REQUESTS,
  sessionLimit = PER_SESSION_RATE_LIMIT,
  now = () => Date.now(),
  getClientIp,
  getSessionId,
} = {}) {
  const perIp = createPerIpRateLimitMiddleware({ limit: ipLimit, now, getClientIp });
  const perSession = createPerSessionRateLimitMiddleware({ limit: sessionLimit, now, getSessionId });
  return (c, next) => perIp(c, () => perSession(c, next));
}

function createFixedWindowMiddleware({ limit, windowMs, maxTrackedClients, now, getKey, onMissingKey }) {
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
    const key = getKey(c);
    if (!key) {
      return onMissingKey(c, next);
    }

    const currentTime = now();
    let client = clients.get(key);
    if (!client || currentTime - client.windowStartedAt >= windowMs) {
      if (clients.size >= maxTrackedClients) {
        for (const [trackedKey, entry] of clients) {
          if (currentTime - entry.windowStartedAt >= windowMs) {
            clients.delete(trackedKey);
          }
        }
      }

      if (!clients.has(key) && clients.size >= maxTrackedClients) {
        return c.json({
          ok: false,
          error: {
            code: "RATE_LIMIT_CAPACITY",
            message: "Request rate limiting is temporarily at capacity.",
          },
        }, 503);
      }

      client = { windowStartedAt: currentTime, requestCount: 0 };
      clients.set(key, client);
    }

    const resetSeconds = Math.ceil((client.windowStartedAt + windowMs - currentTime) / 1000);
    const remaining = Math.max(0, limit - client.requestCount - 1);
    const reported = c.get(RATE_LIMIT_REMAINING_CONTEXT_KEY);
    if (reported === undefined || remaining <= reported) {
      c.set(RATE_LIMIT_REMAINING_CONTEXT_KEY, remaining);
      c.header("RateLimit-Limit", String(limit));
      c.header("RateLimit-Remaining", String(remaining));
      c.header("RateLimit-Reset", String(resetSeconds));
    }

    if (client.requestCount >= limit) {
      c.header("RateLimit-Limit", String(limit));
      c.header("RateLimit-Remaining", "0");
      c.header("RateLimit-Reset", String(resetSeconds));
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
