import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import test from "node:test";

test("HTTP API on Cloud Run limits each demo session to 60 a minute and keys the address on the last forwarded entry", async () => {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const requestOrigin = origin.replace("http:", "https:");
  const child = spawn(process.execPath, ["index.mjs"], { cwd: new URL("..", import.meta.url),
    env: { PATH: process.env.PATH, PORT: String(port), K_SERVICE: "momentum", PROJECT_ID: "prepagent-hack",
      USTAAD_AUTHORIZATION_MODE: "HACKATHON_DEMO", USTAAD_DEMO_SESSION_SIGNING_KEY: "a".repeat(64),
      USTAAD_ENABLE_APPROVAL_AUDIT: "true", USTAAD_SYNTHETIC_ONLY: "true" },
    stdio: ["ignore", "pipe", "pipe"] });
  try {
    await Promise.race([once(child.stdout, "data"), once(child, "exit").then(() => { throw new Error("Backend exited"); }), new Promise((_, reject) => setTimeout(() => reject(new Error("Startup timeout")), 5000).unref())]);
    const session = await fetch(origin + "/api/auth/demo-session", { method: "POST",
      headers: { Origin: requestOrigin, "X-Forwarded-For": "203.0.113.9" } });
    assert.equal(session.status, 200);
    const cookie = session.headers.get("set-cookie").split(";")[0];

    for (let requestNumber = 0; requestNumber < 60; requestNumber += 1) {
      const response = await fetch(origin + "/api/auth/config", { headers: { Cookie: cookie,
        "X-Forwarded-For": `192.0.2.${requestNumber}, 203.0.113.${requestNumber}` } });
      assert.equal(response.status, 200, `session request ${requestNumber + 1}`);
    }
    const limited = await fetch(origin + "/api/auth/config", { headers: { Cookie: cookie, "X-Forwarded-For": "198.51.100.77" } });
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.code, "RATE_LIMIT_EXCEEDED");

    const anonymous = await fetch(origin + "/api/auth/config", { headers: { "X-Forwarded-For": "192.0.2.200, 203.0.113.9" } });
    assert.equal(anonymous.status, 200);
    assert.equal(anonymous.headers.get("ratelimit-limit"), "300");
    // 203.0.113.9 has now been used by the session request, request 10 of the loop and this one.
    assert.equal(anonymous.headers.get("ratelimit-remaining"), "297");
  } finally {
    if (child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); child.kill("SIGTERM"); await exited; }
  }
});
