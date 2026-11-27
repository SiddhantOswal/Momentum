import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { encodeDocument, fromFirestoreFields } from "../src/google-cloud/firestore-rest.js";
import { BASE_TIMESTAMP_FIELDS, LotHeadDocSchema, LotRevisionDocSchema } from "../src/state-schemas.js";
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

const GUARD = { USTAAD_ENABLE_LOT_REVISIONS: "true", USTAAD_ENFORCE_APPROVE_GUARD: "true" };
const DOCS = "projects/prepagent-hack/databases/(default)/documents";
const confirmationFor = (revisionFingerprint) => ({ reviewConfirmed: true, revisionFingerprint });

function seedRevision(google, { sessionId, lotId, jobId, number, fingerprint, status = "CURRENT", head }) {
  const now = "2026-12-04T00:00:00.000Z";
  const base = { schemaVersion: 1, createdAt: now, updatedAt: now, expiresAt: "2027-01-04T00:00:00.000Z" };
  const frozen = [{
    field: "paperMoisturePct", value: 8.5, unit: "%", provenance: "operator_entry", sourceDetail: "typed",
    label: "Entered by operator", confirmed: false,
  }];
  const revision = {
    ...base, jobId, lotId, number, status, requestFingerprint: "e".repeat(64), revisionFingerprint: fingerprint,
    conditions: frozen, supersededBy: null, supersededReason: null, approvingLeaseExpiresAt: null, approvedAt: null,
  };
  const put = (collection, id, schema, doc, timestamps) => {
    const name = `${DOCS}/${collection}/${id}`;
    google.firestore.docs.set(name, { name, fields: encodeDocument(schema, doc, { timestamps }), updateTime: "2026-12-04T00:00:00.000001Z" });
  };
  put("lot_revisions", jobId, LotRevisionDocSchema, revision, [...BASE_TIMESTAMP_FIELDS, "approvingLeaseExpiresAt", "approvedAt"]);
  if (head) {
    put("lot_heads", lotId, LotHeadDocSchema, {
      ...base, lotId, ownerSessionId: sessionId, reviewId: null, orderRef: null, draftConditions: frozen,
      conditionsFingerprint: null, currentRevision: number, currentJobId: jobId, stage: "draft_review", version: 0,
    }, BASE_TIMESTAMP_FIELDS);
  }
}

const readRevision = (google, jobId) => {
  const stored = google.firestore.docs.get(`${DOCS}/lot_revisions/${jobId}`);
  return stored && fromFirestoreFields(stored.fields);
};

test("J8 over HTTP: after the moisture is edited, Rev 1 cannot be approved", async () => {
  await withApp(GUARD, async ({ call, sessionId, google }) => {
    const lotId = `LOT-HACK-${sessionId}-${"b".repeat(12)}`;
    const jobOne = `JOB-HACK-${sessionId}-${"1".repeat(40)}`;
    const fingerprintOne = "c".repeat(64);
    seedRevision(google, { sessionId, lotId, jobId: jobOne, number: 1, fingerprint: fingerprintOne, head: true });

    const shown = await (await call(`/lots/${lotId}`)).json();
    assert.equal(shown.revision.status, "CURRENT");
    assert.equal(shown.revision.fingerprint, fingerprintOne);

    const edit = await call(`/lots/${lotId}/conditions`, {
      method: "PUT", body: { conditions: [{ field: "paperMoisturePct", value: 10.8, source: "typed" }] },
    });
    assert.equal(edit.status, 200);
    assert.equal((await edit.json()).superseded.number, 1);
    assert.equal(readRevision(google, jobOne).status, "SUPERSEDED");

    const refused = await call(`/jobs/${jobOne}/approve?lang=en&currency=INR`, { method: "POST", body: confirmationFor(fingerprintOne) });
    assert.equal(refused.status, 409);
    assert.equal((await refused.json()).error.code, "REVISION_SUPERSEDED");
    assert.equal(readRevision(google, jobOne).status, "SUPERSEDED");
  });
});

test("the guard returns 4xx for a missing flag or a stale fingerprint and 409 for an unregistered draft", async () => {
  await withApp(GUARD, async ({ call, sessionId, google }) => {
    const lotId = `LOT-HACK-${sessionId}-${"b".repeat(12)}`;
    const jobOne = `JOB-HACK-${sessionId}-${"1".repeat(40)}`;
    const unregistered = `JOB-HACK-${sessionId}-${"9".repeat(40)}`;
    seedRevision(google, { sessionId, lotId, jobId: jobOne, number: 1, fingerprint: "c".repeat(64), head: true });
    const approve = (job, body) => call(`/jobs/${job}/approve`, { method: "POST", body });

    const noBody = await approve(jobOne);
    assert.equal(noBody.status, 400);
    assert.equal((await noBody.json()).error.code, "REVIEW_CONFIRMATION_REQUIRED");
    const unticked = await approve(jobOne, { reviewConfirmed: false, revisionFingerprint: "c".repeat(64) });
    assert.equal(unticked.status, 400);
    const stale = await approve(jobOne, confirmationFor("d".repeat(64)));
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).error.code, "REVISION_FINGERPRINT_MISMATCH");
    const none = await approve(unregistered, confirmationFor("c".repeat(64)));
    assert.equal(none.status, 409);
    assert.equal((await none.json()).error.code, "REVISION_NOT_REGISTERED");
    assert.equal(readRevision(google, jobOne).status, "CURRENT");

    const crossOrigin = await call(`/jobs/${jobOne}/approve`, {
      method: "POST", body: confirmationFor("c".repeat(64)), origin: "https://evil.example",
    });
    assert.equal(crossOrigin.status, 403);
    assert.equal(readRevision(google, jobOne).status, "CURRENT");
  });
});

test("a matching confirmation passes the guard, and a failed approval leaves the revision CURRENT", async () => {
  await withApp(GUARD, async ({ call, sessionId, google }) => {
    const lotId = `LOT-HACK-${sessionId}-${"b".repeat(12)}`;
    const jobOne = `JOB-HACK-${sessionId}-${"1".repeat(40)}`;
    seedRevision(google, { sessionId, lotId, jobId: jobOne, number: 1, fingerprint: "c".repeat(64), head: true });
    // No approval adapter is configured in this process, so the unchanged approval answers 503.
    const passed = await call(`/jobs/${jobOne}/approve`, { method: "POST", body: confirmationFor("c".repeat(64)) });
    assert.equal(passed.status, 503);
    assert.equal((await passed.json()).error.code, "SERVICE_UNAVAILABLE");
    assert.equal(readRevision(google, jobOne).status, "CURRENT");
    const commits = google.firestore.calls.filter((entry) => entry.path.endsWith(":commit")).length;
    assert.equal(commits, 2, "one commit to start the approval and one to return it to CURRENT");
  });
});

test("with the guard off, approve ignores the body and reads no lot records", async () => {
  await withApp(ENABLED, async ({ call, sessionId, google }) => {
    const jobOne = `JOB-HACK-${sessionId}-${"1".repeat(40)}`;
    const result = await call(`/jobs/${jobOne}/approve`, { method: "POST" });
    assert.equal((await result.json()).error.code, "SERVICE_UNAVAILABLE");
    assert.equal(google.firestore.calls.length, 0);
  });
});
