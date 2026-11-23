import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import test from "node:test";

async function startCloudRunDemoServer() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["index.mjs"], { cwd: new URL("..", import.meta.url),
    env: { PATH: process.env.PATH, PORT: String(port), K_SERVICE: "momentum", PROJECT_ID: "prepagent-hack",
      USTAAD_AUTHORIZATION_MODE: "HACKATHON_DEMO", USTAAD_DEMO_SESSION_SIGNING_KEY: "a".repeat(64),
      USTAAD_ENABLE_APPROVAL_AUDIT: "true", USTAAD_SYNTHETIC_ONLY: "true" },
    stdio: ["ignore", "pipe", "pipe"] });
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); child.kill("SIGTERM"); await exited; }
  };
  try {
    await Promise.race([once(child.stdout, "data"), once(child, "exit").then(() => { throw new Error("Backend exited"); }), new Promise((_, reject) => setTimeout(() => reject(new Error("Startup timeout")), 5000).unref())]);
  } catch (error) {
    await stop();
    throw error;
  }
  return { origin, requestOrigin: origin.replace("http:", "https:"), stop };
}

test("HTTP API on Cloud Run limits each demo session to 60 a minute and keys the address on the last forwarded entry", async () => {
  const { origin, requestOrigin, stop } = await startCloudRunDemoServer();
  try {
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
    await stop();
  }
});

test("HTTP API on Cloud Run gives no session bucket to an unsigned demo cookie or one with a changed signature", async () => {
  const { origin, requestOrigin, stop } = await startCloudRunDemoServer();
  try {
    const session = await fetch(origin + "/api/auth/demo-session", { method: "POST",
      headers: { Origin: requestOrigin, "X-Forwarded-For": "203.0.113.9" } });
    assert.equal(session.status, 200);
    const token = session.headers.get("set-cookie").split(";")[0].split("=")[1];
    const [payload, signature] = token.split(".");
    const changedSignature = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    const forgedCookies = {
      unsigned: `__Host-ustaad-demo=${payload}`,
      "changed signature": `__Host-ustaad-demo=${payload}.${changedSignature}`,
    };

    let addressNumber = 0;
    for (const [label, cookie] of Object.entries(forgedCookies)) {
      for (let requestNumber = 0; requestNumber < 61; requestNumber += 1) {
        addressNumber += 1;
        const response = await fetch(origin + "/api/auth/config", { headers: { Cookie: cookie,
          "X-Forwarded-For": `198.51.${Math.floor(addressNumber / 256)}.${addressNumber % 256}` } });
        assert.equal(response.status, 200, `${label} cookie request ${requestNumber + 1}`);
        assert.equal(response.headers.get("ratelimit-limit"), "300", `${label} cookie request ${requestNumber + 1}`);
      }
    }
  } finally {
    await stop();
  }
});
