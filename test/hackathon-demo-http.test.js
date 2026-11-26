import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { connect } from "node:net";
import test from "node:test";
import { freePort, startIndexServer } from "./helpers/server.js";

const SIGNING_KEY = "a".repeat(64);
const HACKATHON_ENV = { PATH: process.env.PATH, K_SERVICE: "prepagent", PROJECT_ID: "prepagent-hack",
  USTAAD_AUTHORIZATION_MODE: "HACKATHON_DEMO", USTAAD_DEMO_SESSION_SIGNING_KEY: SIGNING_KEY,
  USTAAD_ENABLE_APPROVAL_AUDIT: "true", USTAAD_SYNTHETIC_ONLY: "true", USTAAD_ENABLE_DEMO_MODE: "true" };

async function stop(child) {
  if (child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); child.kill("SIGTERM"); await exited; }
}

test("on Cloud Run without a valid public origin no session is issued or accepted, and startup warns once", async () => {
  for (const configured of [undefined, "", "http://momentum.example", "https://momentum.example/", "not an origin"]) {
    const port = await freePort();
    const env = { ...HACKATHON_ENV, PORT: String(port), ...(configured === undefined ? {} : { USTAAD_PUBLIC_ORIGIN: configured }) };
    const child = spawn(process.execPath, ["index.mjs"], { cwd: new URL("..", import.meta.url), env, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    try {
      await once(child.stdout, "data");
      const at = (path) => `http://127.0.0.1:${port}${path}`;
      const hostOrigin = `https://127.0.0.1:${port}`;
      const minted = await fetch(at("/api/auth/demo-session"), { method: "POST", headers: { Origin: hostOrigin } });
      assert.equal(minted.status, 503, String(configured));
      const body = await minted.json();
      assert.equal(body.error.code, "DEMO_AUTHORIZATION_NOT_CONFIGURED");
      assert.doesNotMatch(body.error.message, /demo|hackathon/i);
      assert.equal(minted.headers.get("set-cookie"), null);

      // A correctly signed cookie naming the request host, which a fallback would accept.
      const data = { sid: "c".repeat(32), iat: Math.floor(Date.now() / 1000), policy: "HACKATHON_DEMO:v1", aud: hostOrigin };
      const payload = Buffer.from(JSON.stringify({ ...data, exp: data.iat + 7200 })).toString("base64url");
      const cookie = `__Host-ustaad-demo=${payload}.${createHmac("sha256", Buffer.from(SIGNING_KEY, "hex")).update(payload).digest("base64url")}`;
      const job = await fetch(at(`/jobs/JOB-HACK-${data.sid}-${"b".repeat(40)}`), { headers: { Cookie: cookie } });
      assert.equal(job.status, 503);
      assert.equal((await job.json()).error.code, "DEMO_AUTHORIZATION_NOT_CONFIGURED");
      const status = await (await fetch(at("/api/status"), { headers: { Cookie: cookie } })).json();
      assert.equal(status.runtimeAvailability, undefined);
      assert.equal((await (await fetch(at("/api/auth/config"))).json()).demoSessionConfigured, false);

      const warnings = stderr.split("\n").filter((line) => line.includes("session_origin_missing"));
      assert.equal(warnings.length, 1, String(configured));
      assert.equal(JSON.parse(warnings[0]).severity, "WARNING");
    } finally {
      await stop(child);
    }
  }
});

test("a local run with no public origin will not mint a session for a deployed https origin", async () => {
  const { K_SERVICE: _cloudRun, ...localEnv } = HACKATHON_ENV;
  const local = await startIndexServer(localEnv);
  try {
    const socket = connect(local.port, "127.0.0.1");
    await once(socket, "connect");
    socket.end("POST https://momentum.example/api/auth/demo-session HTTP/1.1\r\nHost: momentum.example\r\n" +
      "Origin: https://momentum.example\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    let raw = "";
    for await (const chunk of socket) raw += chunk;
    assert.match(raw, /^HTTP\/1\.1 403/);
    assert.match(raw, /ORIGIN_REQUIRED/);
    assert.doesNotMatch(raw, /set-cookie/i);

    const origin = `http://127.0.0.1:${local.port}`;
    const minted = await fetch(origin + "/api/auth/demo-session", { method: "POST", headers: { Origin: origin } });
    assert.equal(minted.status, 200);
    const cookie = minted.headers.get("set-cookie").split(";")[0];
    assert.equal(JSON.parse(Buffer.from(cookie.split("=")[1].split(".")[0], "base64url").toString()).aud, origin);
  } finally {
    await stop(local.child);
  }
});

test("HTTP sessions are refused by a service on another origin, even with the shared signing key", async () => {
  const servingOrigin = "https://momentum.example";
  const testOrigin = "https://arc-test---momentum.example";
  const serving = await startIndexServer({ ...HACKATHON_ENV, USTAAD_PUBLIC_ORIGIN: servingOrigin });
  const tagged = await startIndexServer({ ...HACKATHON_ENV, USTAAD_PUBLIC_ORIGIN: testOrigin });
  const at = (server, path) => `http://127.0.0.1:${server.port}${path}`;
  try {
    const minted = await fetch(at(serving, "/api/auth/demo-session"), { method: "POST", headers: { Origin: servingOrigin } });
    assert.equal(minted.status, 200);
    const cookie = minted.headers.get("set-cookie").split(";")[0];
    const payload = JSON.parse(Buffer.from(cookie.split("=")[1].split(".")[0], "base64url").toString());
    assert.equal(payload.aud, servingOrigin);
    const owned = `JOB-HACK-${payload.sid}-${"b".repeat(40)}`;

    const refusedOn = async (server, origin, sessionCookie) => {
      for (const [method, path] of [["POST", "/jobs"], ["POST", `/jobs/${owned}/approve`], ["GET", `/jobs/${owned}`]]) {
        const response = await fetch(at(server, path), { method, headers: { Cookie: sessionCookie, Origin: origin } });
        assert.equal(response.status, 401, `${method} ${path}`);
        assert.equal((await response.json()).error.code, "DEMO_SESSION_REQUIRED", `${method} ${path}`);
      }
      const status = await (await fetch(at(server, "/api/status"), { headers: { Cookie: sessionCookie } })).json();
      assert.equal(status.runtimeAvailability, undefined);
    };
    await refusedOn(tagged, testOrigin, cookie);

    // A cookie re-sent to the mint route on the other service is replaced, never reused.
    const remint = await fetch(at(tagged, "/api/auth/demo-session"), { method: "POST", headers: { Origin: testOrigin, Cookie: cookie } });
    assert.equal(remint.status, 200);
    const reminted = remint.headers.get("set-cookie").split(";")[0];
    assert.notEqual(reminted, cookie);
    assert.equal(JSON.parse(Buffer.from(reminted.split("=")[1].split(".")[0], "base64url").toString()).aud, testOrigin);

    // Right signature, wrong audience: the key is shared, so only the audience tells the services apart.
    const sign = (data) => {
      const body = Buffer.from(JSON.stringify(data)).toString("base64url");
      return `__Host-ustaad-demo=${body}.${createHmac("sha256", Buffer.from(SIGNING_KEY, "hex")).update(body).digest("base64url")}`;
    };
    await refusedOn(serving, servingOrigin, sign({ ...payload, aud: testOrigin }));
    const { aud: _aud, ...withoutAudience } = payload;
    await refusedOn(serving, servingOrigin, sign(withoutAudience));

    const approve = await fetch(at(serving, `/jobs/${owned}/approve`), { method: "POST", headers: { Cookie: cookie, Origin: servingOrigin } });
    assert.equal(approve.status, 503, "the issuing service accepts the session and reaches its approval gate");
    assert.equal((await approve.json()).error.code, "SERVICE_UNAVAILABLE");
    const ownStatus = await (await fetch(at(serving, "/api/status"), { headers: { Cookie: cookie } })).json();
    assert.equal(typeof ownStatus.runtimeAvailability, "object");
  } finally {
    await stop(serving.child);
    await stop(tagged.child);
  }
});

test("HTTP hackathon sessions enforce origin, record ownership, model acceptance and mock isolation without Firebase", async () => {
  // No cloud credentials/adapters. Real HTTP and signed session cookies; provider calls absent.
  const requestOrigin = "https://momentum.example";
  const { child, port } = await startIndexServer({ ...HACKATHON_ENV, USTAAD_PUBLIC_ORIGIN: requestOrigin });
  const origin = `http://127.0.0.1:${port}`;
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
