import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";

test("public sign-in configuration permits first-user provisioning but never enables supervisor actions without an approved UID", async () => {
  // HTTP boundary only. Firebase public config is a test double; no provider
  // sign-in, token verification, model call or cloud resource is exercised.
  const port = 4197;
  const env = { PATH: process.env.PATH, PORT: String(port), K_SERVICE: "prepagent", PROJECT_ID: "prepagent-hack",
    USTAAD_FIREBASE_AUTH_ENABLED: "true", USTAAD_SUPERVISOR_UID_ALLOWLIST: "",
    USTAAD_FIREBASE_WEB_API_KEY: "A".repeat(30), USTAAD_FIREBASE_AUTH_DOMAIN: "prepagent-hack.firebaseapp.com",
    USTAAD_FIREBASE_WEB_APP_ID: "1:514663464609:web:abcdef", USTAAD_SYNTHETIC_ONLY: "true" };
  const child = spawn(process.execPath, ["index.mjs"], { cwd: new URL("..", import.meta.url), env, stdio: ["ignore", "pipe", "pipe"] });
  try {
    const startup = once(child.stdout, "data");
    const failed = once(child, "exit").then(([code]) => { throw new Error(`Backend exited before bootstrap acceptance (${code})`); });
    await Promise.race([startup, failed, new Promise((_, reject) => setTimeout(() => reject(new Error("Backend startup timeout")), 5000).unref())]);
    const config = await (await fetch(`http://127.0.0.1:${port}/api/auth/config`)).json();
    assert.equal(config.enabled, true);
    assert.equal(config.supervisorAccessConfigured, false);
    assert.equal(config.clientConfig.projectId, "prepagent-hack");
    for (const path of ["/risk/predict", "/jobs/TEST-FORGED/approve"]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: "POST",
        headers: { "Content-Type": "application/json", "X-Supervisor-Uid": "forged", "X-Supervisor-Role": "supervisor" }, body: "{}" });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error.code, "AUTHENTICATION_NOT_CONFIGURED");
    }
    const status = await (await fetch(`http://127.0.0.1:${port}/api/status`)).json();
    assert.equal(status.runtimeAvailability.supervisorAuthorizationAvailable, false);
    assert.equal(status.runtimeAvailability.jobCreationAvailable, false);
    assert.equal(status.runtimeAvailability.liveModelCallsEnabled, false);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    }
  }
});
