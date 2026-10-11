import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { Hono } from "hono";
import test from "node:test";
import {
  createPerIpRateLimitMiddleware,
  createRequestTimeoutMiddleware,
  getSocketClientIp,
  REQUEST_SIGNAL_CONTEXT_KEY,
} from "../src/request-guardrails.js";

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
