import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";

const preload = fileURLToPath(new URL("./fixtures/redirect-google-apis.mjs", import.meta.url));
const appDirectory = fileURLToPath(new URL("..", import.meta.url));

// One fake for the Google APIs the app reaches: the metadata token and Firestore transactions.
async function startFakeGoogleApis() {
  const firestore = fakeFirestore();
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks).toString("utf8") : undefined;
    const original = new URL(request.headers["x-original-url"]);
    const reply = (status, payload) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(payload));
    };
    if (original.hostname === "metadata.google.internal") {
      return reply(200, { access_token: "test-token", expires_in: 3600, token_type: "Bearer" });
    }
    if (original.hostname === "firestore.googleapis.com") {
      const answer = await firestore.fetchImpl(original.href, { method: request.method, body });
      return reply(answer.status, await answer.json());
    }
    return reply(503, { error: { code: 503, status: "UNAVAILABLE" } });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { firestore, server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function freePort() {
  const listener = createNetServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function startApp(googleApisOrigin, extraEnv = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, ["--import", preload, "index.mjs"], {
    cwd: appDirectory,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      USTAAD_AUTHORIZATION_MODE: "HACKATHON_DEMO",
      USTAAD_DEMO_SESSION_SIGNING_KEY: "a".repeat(64),
      USTAAD_ENABLE_APPROVAL_AUDIT: "true",
      USTAAD_SYNTHETIC_ONLY: "true",
      PROJECT_ID: "prepagent-hack",
      REGION: "asia-south1",
      TEST_GOOGLE_APIS_ORIGIN: googleApisOrigin,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await Promise.race([
    once(child.stdout, "data"),
    once(child, "exit").then(() => { throw new Error("The app exited during startup."); }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("App startup timed out.")), 6000).unref()),
  ]);
  return { child, origin: `http://127.0.0.1:${port}` };
}

async function stopApp(app) {
  if (!app || app.child.exitCode !== null || app.child.signalCode !== null) return;
  const exited = once(app.child, "exit");
  app.child.kill("SIGTERM");
  await exited;
}

async function withApp(extraEnv, work) {
  const google = await startFakeGoogleApis();
  let app;
  try {
    app = await startApp(google.origin, extraEnv);
    const session = await fetch(`${app.origin}/api/auth/demo-session`, { method: "POST", headers: { Origin: app.origin } });
    assert.equal(session.status, 200);
    const cookie = session.headers.get("set-cookie").split(";")[0];
    const sessionId = JSON.parse(Buffer.from(cookie.split("=")[1].split(".")[0], "base64url").toString()).sid;
    const call = (path, { method = "GET", body, origin = app.origin, cookieHeader = cookie } = {}) => fetch(`${app.origin}${path}`, {
      method,
      headers: {
        ...(origin ? { Origin: origin } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    await work({ app, cookie, google, call, sessionId });
  } finally {
    await stopApp(app);
    await new Promise((resolve) => google.server.close(resolve));
  }
}

const ENABLED = { USTAAD_ENABLE_LOT_REVISIONS: "true" };
const conditionsBody = { conditions: [{ field: "paperMoisturePct", value: 8.5, source: "typed" }] };

test("PUT and GET /lots work through the routes with the session checks", async () => {
  await withApp(ENABLED, async ({ app, cookie, call, sessionId, google }) => {
    const lotId = `LOT-HACK-${sessionId}-${"b".repeat(12)}`;
    const put = await call(`/lots/${lotId}/conditions`, { method: "PUT", body: conditionsBody });
    assert.equal(put.status, 200);
    const saved = await put.json();
    assert.equal(saved.lot.draftConditions[0].label, "Entered by operator");
    assert.ok(google.firestore.docs.size >= 1);

    const get = await call(`/lots/${lotId}`);
    assert.equal(get.status, 200);
    assert.equal((await get.json()).lot.draftConditions[0].value, 8.5);

    assert.equal((await call(`/lots/${lotId}`, { cookieHeader: "" })).status, 401);
    assert.equal((await call(`/lots/${lotId}/conditions`, { method: "PUT", body: conditionsBody, origin: "https://evil.example" })).status, 403);
    assert.equal((await call(`/lots/${lotId}/conditions`, { method: "PUT", body: conditionsBody, origin: "" })).status, 403);

    const foreign = `LOT-HACK-${"f".repeat(32)}-${"b".repeat(12)}`;
    const refused = await call(`/lots/${foreign}`);
    assert.equal(refused.status, 403);
    assert.equal((await refused.json()).error.code, "DEMO_SCOPE_REQUIRED");

    const invalid = await call(`/lots/${lotId}/conditions`, { method: "PUT", body: { conditions: [] } });
    assert.equal(invalid.status, 400);
    const notJson = await fetch(`${app.origin}/lots/${lotId}/conditions`, {
      method: "PUT",
      headers: { Origin: app.origin, Cookie: cookie, "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(notJson.status, 400);
    // A lot ID that is not this session's is refused on ownership before its format is checked.
    assert.equal((await call(`/lots/${lotId}x`)).status, 403);
  });
});

test("the lot routes answer 503 while USTAAD_ENABLE_LOT_REVISIONS is off", async () => {
  await withApp({}, async ({ call, sessionId, google }) => {
    const lotId = `LOT-HACK-${sessionId}-${"b".repeat(12)}`;
    const put = await call(`/lots/${lotId}/conditions`, { method: "PUT", body: conditionsBody });
    assert.equal(put.status, 503);
    assert.equal((await call(`/lots/${lotId}`)).status, 503);
    assert.equal(google.firestore.docs.size, 0);
  });
});

test("the lot routes share the API rate limiter", async () => {
  await withApp(ENABLED, async ({ call, sessionId }) => {
    const lotId = `LOT-HACK-${sessionId}-${"b".repeat(12)}`;
    const statuses = [];
    for (let index = 0; index < 70; index += 1) statuses.push((await call(`/lots/${lotId}`)).status);
    assert.ok(statuses.includes(429), "a session sending 70 requests in a minute must be limited");
    assert.equal(statuses[0], 404);
  });
});
