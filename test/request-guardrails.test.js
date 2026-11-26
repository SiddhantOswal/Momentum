import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { Hono } from "hono";
import test from "node:test";
import {
  clientKeyForAddress,
  createApiRateLimitMiddleware,
  createClientKeyResolver,
  createIpKeyDeriver,
  createPerIpRateLimitMiddleware,
  createPerSessionRateLimitMiddleware,
  createRequestTimeoutMiddleware,
  getSocketClientIp,
  REQUEST_SIGNAL_CONTEXT_KEY,
  UNKNOWN_CLIENT_KEY,
} from "../src/request-guardrails.js";

function contextFor({ forwardedFor, socketAddress = "169.254.1.1" } = {}) {
  return {
    env: { incoming: { socket: { remoteAddress: socketAddress } } },
    req: { header: (name) => (name.toLowerCase() === "x-forwarded-for" ? forwardedFor : undefined) },
  };
}

test("client IP comes from the Node socket and normalizes IPv4-mapped IPv6", () => {
  assert.equal(
    getSocketClientIp({
      env: { incoming: { socket: { remoteAddress: "::ffff:192.0.2.10" } } },
      req: { header: () => "198.51.100.7" },
    }),
    "192.0.2.10"
  );
  assert.equal(getSocketClientIp({ env: { incoming: { socket: {} } } }), undefined);
});

test("on Cloud Run the key is the last forwarded entry and client-set leading entries are ignored", () => {
  const resolve = createClientKeyResolver({ K_SERVICE: "momentum" });
  assert.equal(resolve(contextFor({ forwardedFor: "203.0.113.9" })), "203.0.113.9");
  assert.equal(resolve(contextFor({ forwardedFor: "10.0.0.1, 192.0.2.77, 203.0.113.9" })), "203.0.113.9");
  assert.equal(resolve(contextFor({ forwardedFor: "198.51.100.1,203.0.113.9" })), "203.0.113.9");
  assert.equal(resolve(contextFor({ forwardedFor: "::ffff:203.0.113.9" })), "203.0.113.9");
  assert.equal(resolve(contextFor({ forwardedFor: "2001:db8::1" })), "2001:db8:0:0::/64");
});

test("an IPv6 client is keyed on its /64 in one text form, and IPv4 keeps the full address", () => {
  const sameSubnet = ["2001:db8::1", "2001:0db8:0:0::2", "2001:DB8:0000:0000:ffff:ffff:ffff:ffff", "2001:db8::1%eth0"];
  for (const address of sameSubnet) assert.equal(clientKeyForAddress(address), "2001:db8:0:0::/64", address);
  assert.equal(clientKeyForAddress("2001:db8:0:1::1"), "2001:db8:0:1::/64");
  assert.notEqual(clientKeyForAddress("2001:db8:0:1::1"), clientKeyForAddress("2001:db8::1"));
  assert.equal(clientKeyForAddress("2400:cb00:2048:1::c629:d7a2"), "2400:cb00:2048:1::/64");

  assert.equal(clientKeyForAddress("203.0.113.9"), "203.0.113.9");
  assert.equal(clientKeyForAddress("::ffff:203.0.113.9"), "203.0.113.9");
  assert.equal(clientKeyForAddress("::FFFF:203.0.113.9"), "203.0.113.9");
  assert.equal(clientKeyForAddress("::ffff:cb00:7109"), "203.0.113.9");
  assert.notEqual(clientKeyForAddress("203.0.113.9"), clientKeyForAddress("203.0.113.10"));

  for (const value of [undefined, "", "unknown", "203.0.113.9%eth0", "2001:db8::g", "[2001:db8::1]"]) {
    assert.equal(clientKeyForAddress(value), undefined, String(value));
  }
});

test("addresses in one /64 share the per-IP bucket and the budget key; another /64 does not", async () => {
  const resolve = createClientKeyResolver({ K_SERVICE: "momentum" });
  const app = new Hono();
  app.use("*", createPerIpRateLimitMiddleware({ limit: 2, getClientIp: resolve }));
  app.get("/", (c) => c.text("ok"));
  const env = { incoming: { socket: { remoteAddress: "169.254.1.1" } } };
  const request = (forwardedFor) => app.request("/", { headers: { "x-forwarded-for": forwardedFor } }, env);

  assert.equal((await request("2001:db8:aa:1::1")).status, 200);
  assert.equal((await request("2001:db8:aa:1:ffff::2")).status, 200);
  assert.equal((await request("2001:db8:aa:1:1234:5678:9abc:def0")).status, 429);
  assert.equal((await request("2001:db8:aa:2::1")).status, 200);

  const derive = createIpKeyDeriver("a".repeat(64));
  const keyOf = (address) => derive(resolve(contextFor({ forwardedFor: address })));
  assert.equal(keyOf("2001:db8:aa:1::1"), keyOf("2001:db8:aa:1:ffff::2"));
  assert.notEqual(keyOf("2001:db8:aa:1::1"), keyOf("2001:db8:aa:2::1"));
  assert.equal(keyOf("::ffff:203.0.113.9"), derive("203.0.113.9"));
});

test("the unknown bucket still limits and logs one warning a minute with no address in it", async () => {
  let currentTime = 0;
  const logged = [];
  const resolve = createClientKeyResolver({ K_SERVICE: "momentum" }, { log: (entry) => logged.push(entry), now: () => currentTime });
  for (const forwardedFor of [undefined, "", "garbage", "192.0.2.1, 203.0.113.9%eth0"]) {
    assert.equal(resolve(contextFor({ forwardedFor })), UNKNOWN_CLIENT_KEY);
  }
  assert.equal(logged.length, 1);
  assert.deepEqual(Object.keys(logged[0]).sort(), ["event", "message", "severity", "trustedHops"]);
  assert.equal(logged[0].severity, "WARNING");
  assert.equal(logged[0].event, "client_key_unknown");
  assert.doesNotMatch(JSON.stringify(logged[0]), /192\.0\.2|203\.0\.113|169\.254/);

  currentTime = 59_999;
  resolve(contextFor({ forwardedFor: "garbage" }));
  assert.equal(logged.length, 1);
  currentTime = 60_000;
  resolve(contextFor({ forwardedFor: "garbage" }));
  assert.equal(logged.length, 2);
  assert.equal(resolve(contextFor({ forwardedFor: "203.0.113.9" })), "203.0.113.9");
  assert.equal(logged.length, 2);

  const app = new Hono();
  app.use("*", createPerIpRateLimitMiddleware({ limit: 1, getClientIp: resolve }));
  app.get("/", (c) => c.text("ok"));
  const env = { incoming: { socket: { remoteAddress: "169.254.1.1" } } };
  assert.equal((await app.request("/", {}, env)).status, 200);
  assert.equal((await app.request("/", { headers: { "x-forwarded-for": "garbage" } }, env)).status, 429);
});

test("forged leading entries do not give a client a fresh bucket on Cloud Run", async () => {
  const app = new Hono();
  app.use("*", createPerIpRateLimitMiddleware({
    limit: 2,
    getClientIp: createClientKeyResolver({ K_SERVICE: "momentum" }),
  }));
  app.get("/", (c) => c.text("ok"));
  const env = { incoming: { socket: { remoteAddress: "169.254.1.1" } } };
  const request = (forwardedFor) => app.request("/", { headers: { "x-forwarded-for": forwardedFor } }, env);

  assert.equal((await request("192.0.2.1, 203.0.113.9")).status, 200);
  assert.equal((await request("192.0.2.2, 203.0.113.9")).status, 200);
  const limited = await request("192.0.2.3, 198.51.100.4, 203.0.113.9");
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "RATE_LIMIT_EXCEEDED");
  assert.equal((await request("192.0.2.1, 203.0.113.10")).status, 200);
});

test("RATE_LIMIT_TRUSTED_HOPS picks the entry that many places from the right", () => {
  const header = "192.0.2.50, 203.0.113.9, 198.51.100.200";
  const oneHop = createClientKeyResolver({ K_SERVICE: "momentum", RATE_LIMIT_TRUSTED_HOPS: "1" });
  const twoHops = createClientKeyResolver({ K_SERVICE: "momentum", RATE_LIMIT_TRUSTED_HOPS: "2" });
  assert.equal(oneHop(contextFor({ forwardedFor: header })), "198.51.100.200");
  assert.equal(twoHops(contextFor({ forwardedFor: header })), "203.0.113.9");
  assert.equal(twoHops(contextFor({ forwardedFor: "10.9.9.9, 192.0.2.50, 203.0.113.9, 198.51.100.200" })), "203.0.113.9");
});

test("a load balancer in front with one trusted hop collapses every client into its own address", () => {
  // Documents why RATE_LIMIT_TRUSTED_HOPS must be raised when a balancer or Cloud Armor is added (M11).
  const resolve = createClientKeyResolver({ K_SERVICE: "momentum", RATE_LIMIT_TRUSTED_HOPS: "1" });
  assert.equal(resolve(contextFor({ forwardedFor: "203.0.113.9, 198.51.100.200" })), "198.51.100.200");
  assert.equal(resolve(contextFor({ forwardedFor: "203.0.113.10, 198.51.100.200" })), "198.51.100.200");
});

test("a missing, empty, short or malformed forwarded header on Cloud Run falls back to one shared bucket", async () => {
  const twoHops = createClientKeyResolver({ K_SERVICE: "momentum", RATE_LIMIT_TRUSTED_HOPS: "2" });
  const oneHop = createClientKeyResolver({ K_SERVICE: "momentum" });
  assert.equal(UNKNOWN_CLIENT_KEY, "unknown");
  assert.equal(oneHop(contextFor({ forwardedFor: undefined })), UNKNOWN_CLIENT_KEY);
  assert.equal(oneHop(contextFor({ forwardedFor: "" })), UNKNOWN_CLIENT_KEY);
  assert.equal(oneHop(contextFor({ forwardedFor: " , " })), UNKNOWN_CLIENT_KEY);
  assert.equal(oneHop(contextFor({ forwardedFor: "192.0.2.1, not-an-address" })), UNKNOWN_CLIENT_KEY);
  assert.equal(twoHops(contextFor({ forwardedFor: "203.0.113.9" })), UNKNOWN_CLIENT_KEY);

  const app = new Hono();
  app.use("*", createPerIpRateLimitMiddleware({ limit: 2, getClientIp: oneHop }));
  app.get("/", (c) => c.text("ok"));
  const env = { incoming: { socket: { remoteAddress: "169.254.1.1" } } };
  assert.equal((await app.request("/", {}, env)).status, 200);
  assert.equal((await app.request("/", { headers: { "x-forwarded-for": "" } }, env)).status, 200);
  const limited = await app.request("/", { headers: { "x-forwarded-for": "garbage" } }, env);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "RATE_LIMIT_EXCEEDED");
});

test("off Cloud Run the key stays the socket address and forwarded headers are ignored", () => {
  const resolve = createClientKeyResolver({ RATE_LIMIT_TRUSTED_HOPS: "2" });
  assert.equal(resolve(contextFor({ forwardedFor: "203.0.113.9, 198.51.100.200", socketAddress: "::ffff:192.0.2.10" })), "192.0.2.10");
  assert.equal(resolve({ env: { incoming: { socket: {} } }, req: { header: () => "203.0.113.9" } }), undefined);
  assert.equal(createClientKeyResolver({ K_SERVICE: "" })(contextFor({ forwardedFor: "203.0.113.9" })), "169.254.1.1");
});

test("an invalid RATE_LIMIT_TRUSTED_HOPS is rejected at startup", () => {
  for (const value of ["0", "-1", "1.5", "two", " 1", "11"]) {
    assert.throws(
      () => createClientKeyResolver({ K_SERVICE: "momentum", RATE_LIMIT_TRUSTED_HOPS: value }),
      RangeError,
      `RATE_LIMIT_TRUSTED_HOPS=${JSON.stringify(value)}`
    );
  }
  assert.doesNotThrow(() => createClientKeyResolver({ K_SERVICE: "momentum", RATE_LIMIT_TRUSTED_HOPS: "" }));
});

test("per-IP limiter returns structured 429 and keeps separate clients independent", async () => {
  let currentTime = 1_000;
  const app = new Hono();
  app.use("*", createPerIpRateLimitMiddleware({
    limit: 2,
    windowMs: 1_000,
    now: () => currentTime,
    getClientIp: (c) => c.req.header("test-client"),
  }));
  app.get("/", (c) => c.json({ ok: true }));

  const request = (client) => app.request("/", {
    headers: { "test-client": client },
  });
  assert.equal((await request("192.0.2.1")).status, 200);
  assert.equal((await request("192.0.2.1")).status, 200);
  const limited = await request("192.0.2.1");
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "RATE_LIMIT_EXCEEDED");
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  assert.equal((await request("192.0.2.2")).status, 200);

  currentTime += 1_000;
  assert.equal((await request("192.0.2.1")).status, 200);
});

test("per-IP fixed window remains active until the exact reset boundary", async () => {
  let currentTime = 1_000;
  const app = new Hono();
  app.use("*", createPerIpRateLimitMiddleware({
    limit: 2,
    windowMs: 1_000,
    now: () => currentTime,
    getClientIp: () => "192.0.2.10",
  }));
  app.get("/", (c) => c.text("ok"));

  assert.equal((await app.request("/")).status, 200);
  assert.equal((await app.request("/")).status, 200);

  currentTime = 1_999;
  const beforeReset = await app.request("/");
  assert.equal(beforeReset.status, 429);
  assert.equal(beforeReset.headers.get("ratelimit-reset"), "1");

  currentTime = 2_000;
  const atReset = await app.request("/");
  assert.equal(atReset.status, 200);
  assert.equal(atReset.headers.get("ratelimit-remaining"), "1");
  assert.equal(atReset.headers.get("ratelimit-reset"), "1");
});

test("socket-based limiter ignores spoofed forwarding headers and applies the default threshold", async () => {
  const app = new Hono();
  app.use("*", createPerIpRateLimitMiddleware());
  app.get("/", (c) => c.text("ok"));
  const env = { incoming: { socket: { remoteAddress: "198.51.100.10" } } };

  for (let requestNumber = 0; requestNumber < 60; requestNumber += 1) {
    const response = await app.request("/", {
      headers: {
        "x-forwarded-for": `203.0.113.${requestNumber}`,
        "x-real-ip": `192.0.2.${requestNumber}`,
      },
    }, env);
    assert.equal(response.status, 200, `request ${requestNumber + 1}`);
  }

  const limited = await app.request("/", {
    headers: {
      "x-forwarded-for": "192.0.2.200",
      "x-real-ip": "203.0.113.200",
    },
  }, env);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "RATE_LIMIT_EXCEEDED");
});

test("per-IP limiter fails closed if a client address is unavailable", async () => {
  const app = new Hono();
  app.use("*", createPerIpRateLimitMiddleware());
  app.get("/", (c) => c.text("should not be reached"));

  const response = await app.request("/");
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "CLIENT_IP_UNAVAILABLE");
});

test("bounded limiter reports capacity and reclaims expired clients", async () => {
  let currentTime = 1_000;
  let clientNumber = 0;
  const app = new Hono();
  app.use("*", createPerIpRateLimitMiddleware({
    limit: 1,
    windowMs: 1_000,
    maxTrackedClients: 2,
    now: () => currentTime,
    getClientIp: () => `client-${clientNumber++}`,
  }));
  app.get("/", (c) => c.text("ok"));

  for (let requestNumber = 0; requestNumber < 2; requestNumber += 1) {
    assert.equal((await app.request("/")).status, 200);
  }
  const atCapacity = await app.request("/");
  assert.equal(atCapacity.status, 503);
  assert.equal((await atCapacity.json()).error.code, "RATE_LIMIT_CAPACITY");

  currentTime += 1_000;
  assert.equal((await app.request("/")).status, 200);
});

test("downstream errors consume the request allowance", async () => {
  const app = new Hono();
  app.onError((_error, c) => c.json({ ok: false }, 500));
  app.use("*", createPerIpRateLimitMiddleware({
    limit: 1,
    getClientIp: () => "198.51.100.25",
  }));
  app.get("/", () => {
    throw new Error("test failure");
  });

  assert.equal((await app.request("/")).status, 500);
  const limited = await app.request("/");
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "RATE_LIMIT_EXCEEDED");
});

test("per-session limiter caps one signed session and leaves other sessions and anonymous requests alone", async () => {
  let currentTime = 1_000;
  const app = new Hono();
  app.use("*", createPerSessionRateLimitMiddleware({
    limit: 2,
    windowMs: 1_000,
    now: () => currentTime,
    getSessionId: (c) => c.req.header("test-session"),
  }));
  app.get("/", (c) => c.text("ok"));
  const request = (session) => app.request("/", session ? { headers: { "test-session": session } } : {});

  assert.equal((await request("a".repeat(32))).status, 200);
  assert.equal((await request("a".repeat(32))).status, 200);
  const limited = await request("a".repeat(32));
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "RATE_LIMIT_EXCEEDED");
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  assert.equal((await request("b".repeat(32))).status, 200);
  for (let requestNumber = 0; requestNumber < 5; requestNumber += 1) {
    assert.equal((await request()).status, 200);
  }

  currentTime += 1_000;
  assert.equal((await request("a".repeat(32))).status, 200);
});

test("API limiter allows 60 per minute per session and still applies the per-IP limit", async () => {
  let currentTime = 1_000;
  let clientIp = "203.0.113.9";
  const app = new Hono();
  app.use("*", createApiRateLimitMiddleware({
    now: () => currentTime,
    getClientIp: () => clientIp,
    getSessionId: (c) => c.req.header("test-session"),
  }));
  app.get("/", (c) => c.text("ok"));
  const request = (session) => app.request("/", session ? { headers: { "test-session": session } } : {});

  for (let requestNumber = 0; requestNumber < 60; requestNumber += 1) {
    clientIp = `203.0.113.${requestNumber}`;
    assert.equal((await request("s0")).status, 200, `session request ${requestNumber + 1}`);
  }
  clientIp = "198.51.100.1";
  const sessionLimited = await request("s0");
  assert.equal(sessionLimited.status, 429);
  assert.equal((await sessionLimited.json()).error.code, "RATE_LIMIT_EXCEEDED");
  assert.equal((await request("s1")).status, 200);
  assert.equal((await request()).status, 200);

  clientIp = "192.0.2.1";
  for (let requestNumber = 0; requestNumber < 60; requestNumber += 1) {
    assert.equal((await request(`fresh-${requestNumber}`)).status, 200, `address request ${requestNumber + 1}`);
  }
  assert.equal((await request("fresh-60")).status, 429);

  currentTime += 60_000;
  clientIp = "198.51.100.1";
  assert.equal((await request("s0")).status, 200);
});

test("API limiter reports the tighter of the two allowances", async () => {
  const app = new Hono();
  app.use("*", createApiRateLimitMiddleware({
    ipLimit: 300,
    sessionLimit: 60,
    getClientIp: () => "203.0.113.9",
    getSessionId: (c) => c.req.header("test-session"),
  }));
  app.get("/", (c) => c.text("ok"));

  const withSession = await app.request("/", { headers: { "test-session": "s0" } });
  assert.equal(withSession.headers.get("ratelimit-limit"), "60");
  assert.equal(withSession.headers.get("ratelimit-remaining"), "59");
  const anonymous = await app.request("/");
  assert.equal(anonymous.headers.get("ratelimit-limit"), "300");
  assert.equal(anonymous.headers.get("ratelimit-remaining"), "298");
});

test("request timeout returns structured 504 and aborts cooperative handlers", async () => {
  const app = new Hono();
  let requestSignal;
  app.use("*", createRequestTimeoutMiddleware(10));
  app.onError((error, c) => {
    if (c.get(REQUEST_SIGNAL_CONTEXT_KEY)?.aborted) {
      return c.json({
        ok: false,
        error: {
          code: "REQUEST_TIMEOUT",
          message: "Request exceeded the 60-second processing limit.",
        },
      }, 504);
    }
    throw error;
  });
  app.get("/", async (c) => {
    requestSignal = c.get(REQUEST_SIGNAL_CONTEXT_KEY);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 100);
      requestSignal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(requestSignal.reason);
      }, { once: true });
    });
    return c.text("late response");
  });

  const response = await app.request("/");
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, "REQUEST_TIMEOUT");
  assert.equal(requestSignal.aborted, true);
  await delay(10);
});
