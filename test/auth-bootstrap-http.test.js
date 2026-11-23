import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { startIndexServer } from "./helpers/server.js";

test("public sign-in configuration permits first-user provisioning but never enables supervisor actions without an approved UID", async () => {
  // HTTP boundary only. Firebase public config is a test double; no provider
  // sign-in, token verification, model call or cloud resource is exercised.
  const env = { PATH: process.env.PATH, K_SERVICE: "prepagent", PROJECT_ID: "prepagent-hack",
    USTAAD_FIREBASE_AUTH_ENABLED: "true", USTAAD_SUPERVISOR_UID_ALLOWLIST: "",
    USTAAD_FIREBASE_WEB_API_KEY: "A".repeat(30), USTAAD_FIREBASE_AUTH_DOMAIN: "prepagent-hack.firebaseapp.com",
    USTAAD_FIREBASE_WEB_APP_ID: "1:514663464609:web:abcdef", USTAAD_SYNTHETIC_ONLY: "true" };
  const { child, port } = await startIndexServer(env);
  try {
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
