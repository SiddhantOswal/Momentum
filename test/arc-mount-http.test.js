import assert from "node:assert/strict";
import test, { after } from "node:test";
import { startIndexServer, stopAllStarted } from "./helpers/server.js";

after(stopAllStarted);

const baseEnv = {
  PATH: process.env.PATH,
  PROJECT_ID: "prepagent-hack",
  USTAAD_AUTHORIZATION_MODE: "HACKATHON_DEMO",
  USTAAD_DEMO_SESSION_SIGNING_KEY: "a".repeat(64),
  USTAAD_ENABLE_APPROVAL_AUDIT: "true",
  USTAAD_SYNTHETIC_ONLY: "true",
};

async function start(env) {
  const { child, port } = await startIndexServer(env);
  return { child, origin: `http://127.0.0.1:${port}` };
}

async function assertRateLimited(response, limit) {
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("ratelimit-limit"), String(limit));
  assert.match(response.headers.get("retry-after") ?? "", /^[1-9]\d*$/);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests. Please wait before trying again." },
  });
}

async function assertOversized(origin, cookie, signal) {
  const response = await fetch(origin + "/api/arc/turns", {
    method: "POST",
    headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    body: Buffer.alloc(10 * 1024 * 1024 + 1),
    signal,
  });
  assert.equal(response.status, 413);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).error.code, "PAYLOAD_TOO_LARGE");
}

test("with the flag unset or not exactly true, Arc paths answer 404 ARC_NOT_ENABLED without a cookie", async () => {
  for (const flag of [undefined, "TRUE", "1", "false"]) {
    const { child, origin } = await start(flag === undefined ? baseEnv : { ...baseEnv, USTAAD_ENABLE_ARC: flag });
    try {
      for (const [method, path] of [["GET", "/api/arc/session"], ["POST", "/api/arc/turns"], ["GET", "/api/arc/other"]]) {
        const response = await fetch(origin + path, { method, headers: { Origin: "https://elsewhere.example" } });
        assert.equal(response.status, 404, `${flag} ${method} ${path}`);
        assert.equal((await response.json()).error.code, "ARC_NOT_ENABLED");
        assert.equal(response.headers.get("cache-control"), "no-store");
      }
    } finally {
      child.kill("SIGKILL");
    }
  }
});

test("with the flag on, an Arc route without the cookie is 401, and the per-session limiter covers it", async () => {
  const { child, origin } = await start({ ...baseEnv, USTAAD_ENABLE_ARC: "true" });
  try {
    const anonymous = await fetch(origin + "/api/arc/session");
    assert.equal(anonymous.status, 401);
    assert.equal((await anonymous.json()).error.code, "DEMO_SESSION_REQUIRED");

    const issued = await fetch(origin + "/api/auth/demo-session", { method: "POST", headers: { Origin: origin } });
    assert.equal(issued.status, 200);
    const cookie = issued.headers.get("set-cookie").split(";")[0];
    const statuses = new Set();
    for (let n = 0; n < 65; n += 1) {
      const response = await fetch(origin + "/api/arc/runs/not-a-uuid", { headers: { Cookie: cookie } });
      statuses.add(response.status);
      if (response.status === 429) await assertRateLimited(response, 60);
      else await response.arrayBuffer();
    }
    assert.equal(statuses.has(429), true);
    await assertOversized(origin, cookie);
  } finally {
    child.kill("SIGKILL");
  }
});

test("with the flag on the turn route validates action params with the runner's rules before any store is read", async () => {
  const { child, origin } = await start({ ...baseEnv, USTAAD_ENABLE_ARC: "true" });
  try {
    const issued = await fetch(origin + "/api/auth/demo-session", { method: "POST", headers: { Origin: origin } });
    const cookie = issued.headers.get("set-cookie").split(";")[0];
    const post = (input) => fetch(origin + "/api/arc/turns", {
      method: "POST",
      headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ clientTurnId: crypto.randomUUID(), input }),
    });
    const strict = await post({ kind: "action", actionId: "get_status", params: { session: "foreign" } });
    assert.equal(strict.status, 400);
    assert.equal(strict.headers.get("cache-control"), "no-store");
    const body = await strict.json();
    assert.deepEqual([body.error.code, body.error.issues[0].field], ["VALIDATION_ERROR", "input.params.session"]);
    const unknown = await post({ kind: "action", actionId: "approve_job" });
    assert.equal(unknown.status, 400);
    assert.equal((await unknown.json()).error.issues[0].code, "unknown_action");
  } finally {
    child.kill("SIGKILL");
  }
});

test("with the flag on and no Google Cloud project, Arc is 503 SERVICE_UNAVAILABLE rather than not enabled", async () => {
  const { PROJECT_ID, ...withoutProject } = baseEnv;
  const { child, origin } = await start({ ...withoutProject, USTAAD_ENABLE_ARC: "true" });
  try {
    const wrongOrigin = await fetch(origin + "/api/arc/turns", { method: "POST", headers: { Origin: "https://elsewhere.example" } });
    assert.equal(wrongOrigin.status, 403);
    assert.equal((await wrongOrigin.json()).error.code, "ORIGIN_REQUIRED");
    const anonymous = await fetch(origin + "/api/arc/session");
    assert.equal(anonymous.status, 401);
    assert.equal((await anonymous.json()).error.code, "DEMO_SESSION_REQUIRED");
    const issued = await fetch(origin + "/api/auth/demo-session", { method: "POST", headers: { Origin: origin } });
    assert.equal(issued.status, 200);
    const cookie = issued.headers.get("set-cookie").split(";")[0];
    const response = await fetch(origin + "/api/arc/session", { headers: { Cookie: cookie } });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "SERVICE_UNAVAILABLE");
  } finally {
    child.kill("SIGKILL");
  }
});

test("the Arc global body limit runs before the IP rate limit and feature flag", { timeout: 15_000 }, async ({ signal }) => {
  const { child, origin } = await start(baseEnv);
  try {
    await assertOversized(origin, undefined, signal);
    for (let n = 0; n < 300; n += 1) {
      const response = await fetch(origin + "/api/arc/session", { signal });
      assert.equal(response.status, 404);
      await response.arrayBuffer();
    }
    await assertRateLimited(await fetch(origin + "/api/arc/session", { signal }), 300);
    await assertOversized(origin, undefined, signal);
  } finally {
    child.kill("SIGKILL");
  }
});
