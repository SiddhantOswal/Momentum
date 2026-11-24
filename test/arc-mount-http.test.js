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

test("with the flag unset or not exactly true, Arc paths answer 404 ARC_NOT_ENABLED without a cookie", async () => {
  for (const flag of [undefined, "TRUE", "1", "false"]) {
    const { child, origin } = await start(flag === undefined ? baseEnv : { ...baseEnv, USTAAD_ENABLE_ARC: flag });
    try {
      for (const [method, path] of [["GET", "/api/arc/session"], ["POST", "/api/arc/turns"], ["GET", "/api/arc/other"]]) {
        const response = await fetch(origin + path, { method, headers: { Origin: "https://elsewhere.example" } });
        assert.equal(response.status, 404, `${flag} ${method} ${path}`);
        assert.equal((await response.json()).error.code, "ARC_NOT_ENABLED");
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
      await response.arrayBuffer();
    }
    assert.equal(statuses.has(429), true);
  } finally {
    child.kill("SIGKILL");
  }
});

test("with the flag on and no Google Cloud project, Arc is 503 SERVICE_UNAVAILABLE rather than not enabled", async () => {
  const { PROJECT_ID, ...withoutProject } = baseEnv;
  const { child, origin } = await start({ ...withoutProject, USTAAD_ENABLE_ARC: "true" });
  try {
    const response = await fetch(origin + "/api/arc/session");
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "SERVICE_UNAVAILABLE");
  } finally {
    child.kill("SIGKILL");
  }
});
