import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { startIndexServer } from "./helpers/server.js";

test("HTTP hackathon sessions enforce origin, record ownership, model acceptance and mock isolation without Firebase", async () => {
  // No cloud credentials/adapters. Real HTTP and signed session cookies; provider calls absent.
  const { child, port } = await startIndexServer({ PATH: process.env.PATH, K_SERVICE: "prepagent", PROJECT_ID: "prepagent-hack",
      USTAAD_AUTHORIZATION_MODE: "HACKATHON_DEMO", USTAAD_DEMO_SESSION_SIGNING_KEY: "a".repeat(64),
      USTAAD_ENABLE_APPROVAL_AUDIT: "true", USTAAD_SYNTHETIC_ONLY: "true", USTAAD_ENABLE_DEMO_MODE: "true" });
  const origin = `http://127.0.0.1:${port}`;
  const requestOrigin = origin.replace("http:", "https:"); // Cloud Run TLS termination emulation.
  try {
    const config = await (await fetch(origin + "/api/auth/config")).json();
    assert.equal(config.authorizationMode, "HACKATHON_DEMO");
    assert.equal(config.enabled, false); assert.equal(config.demoSessionConfigured, true);
    assert.equal(config.approvalNote, "Approval is recorded against this session.");
    assert.doesNotMatch(config.approvalNote, /hackathon/i);
    assert.equal((await fetch(origin + "/api/auth/demo-session", { method: "POST" })).status, 403);
    assert.equal((await fetch(origin + "/api/auth/demo-session", { method: "POST", headers: { Origin: "https://evil.example" } })).status, 403);
    const session = await fetch(origin + "/api/auth/demo-session", { method: "POST", headers: { Origin: requestOrigin } });
    assert.equal(session.status, 200);
    const setCookie = session.headers.get("set-cookie");
    assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /Secure/i); assert.match(setCookie, /SameSite=Strict/i);
    const cookie = setCookie.split(";")[0];
    const payload = JSON.parse(Buffer.from(cookie.split("=")[1].split(".")[0], "base64url").toString());
    const owned = `JOB-HACK-${payload.sid}-${"b".repeat(40)}`;
    const headers = { Cookie: cookie, Origin: requestOrigin, "Content-Type": "application/json" };
    for (const [method, path] of [
      ["POST", "/orders/extract"], ["GET", "/conditions/current"],
      ["POST", "/risk/predict"], ["POST", "/risk/optimize"],
      ["POST", "/risk/explanation"], ["POST", "/risk/similar-runs"],
      ["POST", "/jobs"], ["GET", `/jobs/${owned}`],
      ["POST", `/jobs/${owned}/approve`], ["GET", `/jobs/${owned}/card.pdf`],
      ["POST", `/jobs/${owned}/feedback`], ["POST", "/evidence/seen-before"],
      ["GET", `/api/runs/${"00000000-0000-4000-8000-000000000000"}/events`],
    ]) {
      const denied = await fetch(origin + path, { method, headers: {
        Origin: requestOrigin, Authorization: "Bearer forged", "X-Supervisor-Uid": "forged",
        "X-Supervisor-Role": "supervisor", "X-User-Email": "forged@example.invalid",
      } });
      assert.equal(denied.status, 401, `${method} ${path} must reject identity headers without a signed session`);
    }
    for (const path of ["/jobs/JOB-TEST-42", "/jobs/JOB-TEST-42/card.pdf", "/api/runs/00000000-0000-4000-8000-000000000000/events", "/insights/summary"]) {
      assert.equal((await fetch(origin + path, { headers })).status, 403);
    }
    const forged = await fetch(origin + `/jobs/${owned}/approve`, { method: "POST", headers: { Origin: requestOrigin, "X-Supervisor-Uid": "forged" } });
    assert.equal(forged.status, 401);
    const noOrigin = await fetch(origin + `/jobs/${owned}/approve`, { method: "POST", headers: { Cookie: cookie } });
    assert.equal(noOrigin.status, 403);
    const gated = await fetch(origin + `/jobs/${owned}/approve`, { method: "POST", headers });
    assert.equal(gated.status, 503); assert.equal((await gated.json()).error.code, "SERVICE_UNAVAILABLE");
    const prediction = await fetch(origin + "/risk/predict", { method: "POST", headers, body: "{}" });
    assert.notEqual(prediction.status, 200);
    for (const path of ["/evidence/approved-photos", "/evidence/classify-photo"]) {
      const denial = await fetch(origin + path, {method:path.endsWith("classify-photo")?"POST":"GET",headers:{Origin:requestOrigin}});
      assert.equal(denial.status,401);
    }
    const forgedPhoto = await fetch(origin + "/evidence/classify-photo", {method:"POST",headers,body:JSON.stringify({photoId:"photo-01",fileUri:"gs://unapproved/image.jpg"})});
    assert.equal(forgedPhoto.status,400);
    const mock = await fetch(origin + "/api/agents/predictRisk", { method: "POST", headers, body: "{}" });
    assert.equal(mock.status, 503);
    const publicStatus = await (await fetch(origin + "/api/status")).json();
    assert.equal(publicStatus.executionMode, "live-service");
    assert.equal(publicStatus.authorizationMode, "HACKATHON_DEMO");
    assert.equal(publicStatus.runtimeAvailability, undefined);
    assert.equal(publicStatus.integrations, undefined);
    const status = await (await fetch(origin + "/api/status", { headers: { Cookie: cookie } })).json();
    assert.equal(status.executionMode, "live-service");
    assert.equal(status.runtimeAvailability.jobCreationAvailable, false);
    assert.equal(status.runtimeAvailability.liveModelCallsEnabled, false);
  } finally {
    if (child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); child.kill("SIGTERM"); await exited; }
  }
});
