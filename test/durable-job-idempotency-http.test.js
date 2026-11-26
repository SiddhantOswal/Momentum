import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { mapJobSheetToBigQuery } from "../src/bigquery-mapper.js";
import { createFakeFirestore } from "./fixtures/fake-firestore.js";
import { jobSheetFixture } from "./fixtures/job-sheet.js";

const purchaseOrder = await readFile(new URL("./fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf", import.meta.url));
const preload = fileURLToPath(new URL("./fixtures/redirect-google-apis.mjs", import.meta.url));
const appDirectory = fileURLToPath(new URL("..", import.meta.url));

// Answers with the columns the query selected; with approval audit on, the
// repository also selects approval_audit_json, which a DRAFT row leaves null.
function queryResult(mapped, columns) {
  return {
    jobComplete: true,
    schema: { fields: columns.map((name) => ({
      name,
      type: name.endsWith("_json") ? "JSON"
        : ["savings_kg", "savings_cost"].includes(name) ? "FLOAT"
          : name === "approved_at" ? "TIMESTAMP" : "STRING",
    })) },
    rows: [{ f: columns.map((name) => ({ v: mapped[name] == null ? null
      : name.endsWith("_json") ? JSON.stringify(mapped[name]) : String(mapped[name]) })) }],
  };
}

// One fake for the Google APIs both app processes reach: the metadata token,
// Firestore documents and BigQuery job_sheets reads.
async function startFakeGoogleApis() {
  const firestore = createFakeFirestore();
  const jobSheets = new Map();
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
    if (original.hostname === "bigquery.googleapis.com" && original.pathname.endsWith("/queries")) {
      const query = JSON.parse(body);
      const jobId = query.queryParameters?.find((parameter) => parameter.name === "jobId")?.parameterValue.value;
      const columns = /^SELECT (.+?) FROM /.exec(query.query)?.[1].split(", ") ?? [];
      const row = jobSheets.get(jobId);
      return reply(200, row ? queryResult(row, columns) : { jobComplete: true, schema: { fields: [] }, rows: [] });
    }
    return reply(503, { error: { code: 503, status: "UNAVAILABLE" } });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { firestore, jobSheets, server, origin: `http://127.0.0.1:${server.address().port}` };
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
      BUCKET: "prepagent-hack-data",
      USTAAD_ENABLE_JOB_STORAGE: "true",
      USTAAD_ENABLE_BIGQUERY_WRITES: "true",
      USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY: "true",
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

function planRequest(app, cookie, origin = app.origin) {
  const form = new FormData();
  const fields = {
    orderId: "TEST-PO-HTTP-1", paperType: "VIRGIN", paperSupplier: "SUPPLIER-TEST",
    confirmedItemCode: "SKU-TEST-42", confirmedQuantity: "100", confirmedLineIndex: "1",
    shift: "DAY", runDate: "2026-10-15", ambientRhPct: "64", ambientTempC: "26", paperMoisturePct: "8.5",
    conditionsConfirmed: "true", sfSpeedMpm: "40", rollTempC: "165", gumApplication: "MED", gumViscositySec: "40",
    pastingPressure: "MED", dryingHours: "6", printSpeedSpm: "50",
  };
  form.append("file", new File([purchaseOrder], "order.pdf", { type: "application/pdf" }));
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return fetch(`${app.origin}/jobs`, {
    method: "POST",
    body: form,
    headers: { Origin: origin, Cookie: cookie, "Idempotency-Key": "http-replay-0001" },
  });
}

test("Cloud Run rejects authenticated job creation when Firestore idempotency is disabled", async () => {
  const google = await startFakeGoogleApis();
  let app;
  try {
    const origin = "https://momentum.example";
    app = await startApp(google.origin, {
      K_SERVICE: "prepagent",
      USTAAD_PUBLIC_ORIGIN: origin,
      USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY: "false",
      USTAAD_ENABLE_LOT_REVISIONS: "true",
    });
    const session = await fetch(`${app.origin}/api/auth/demo-session`, {
      method: "POST", headers: { Origin: origin },
    });
    assert.equal(session.status, 200);
    const cookie = session.headers.get("set-cookie").split(";")[0];

    const response = await planRequest(app, cookie, origin);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Job creation requires a shared idempotency store." },
    });
    assert.equal(google.firestore.calls.length, 0);

    const status = await (await fetch(`${app.origin}/api/status`, { headers: { Cookie: cookie } })).json();
    assert.equal(status.runtimeAvailability.jobSheetPersistenceAvailable, true);
    assert.equal(status.runtimeAvailability.jobCreationAvailable, false);
    for (const section of [status.runtimeAvailability, status.integrations]) {
      assert.equal(section.durableIdempotencyConfigured, false);
      assert.equal(section.idempotencyScope, "unavailable");
    }
  } finally {
    await stopApp(app);
    await new Promise((resolve) => google.server.close(resolve));
  }
});

test("index.mjs routes /jobs through the Firestore store: a replay on a second app process returns the stored job", async () => {
  const google = await startFakeGoogleApis();
  let first;
  let second;
  try {
    first = await startApp(google.origin);
    second = await startApp(google.origin);

    const session = await fetch(`${first.origin}/api/auth/demo-session`, { method: "POST", headers: { Origin: first.origin } });
    assert.equal(session.status, 200);
    const cookie = session.headers.get("set-cookie").split(";")[0];

    const status = await (await fetch(`${first.origin}/api/status`, { headers: { Cookie: cookie } })).json();
    assert.equal(status.runtimeAvailability.jobCreationAvailable, true);
    assert.equal(status.runtimeAvailability.idempotencyScope, "shared-firestore");

    // No model or prediction adapter is configured, so this first run fails
    // after its claim and releases it. The claim it wrote shows which store
    // index.mjs handed to /jobs.
    const failedRun = await planRequest(first, cookie);
    assert.notEqual(failedRun.status, 200);
    const claimWrite = google.firestore.calls.find((call) => call.method === "POST" &&
      new URL(call.url).pathname.endsWith("/documents/idempotency"));
    assert.ok(claimWrite, "the first app process must claim the key in Firestore");
    const claimed = claimWrite.body.fields;
    const jobId = claimed.jobId.stringValue;

    // Record the job as if that run had finished: the stored DRAFT row and the
    // completed claim, exactly as createDraft and complete would leave them.
    google.jobSheets.set(jobId, mapJobSheetToBigQuery(
      { ...structuredClone(jobSheetFixture), jobId, order: { ...jobSheetFixture.order, orderId: "TEST-PO-HTTP-1" } },
      { plantId: "PLANT-01", createdAt: "2026-12-04T04:00:00.000Z", savingsCost: 0, currency: "INR", approvedAt: null, cardUri: null },
    ));
    google.firestore.documents.set(google.firestore.documentName("idempotency", claimed.keyHash.stringValue), {
      name: google.firestore.documentName("idempotency", claimed.keyHash.stringValue),
      fields: { ...claimed, recordStatus: { stringValue: "complete" }, completedAt: claimed.claimedAt },
      createTime: "2026-12-04T04:00:00.000Z",
      updateTime: "2026-12-04T04:00:01.000Z",
    });

    for (const app of [second, first]) {
      const replay = await planRequest(app, cookie);
      const payload = await replay.json();
      assert.equal(replay.status, 200, JSON.stringify(payload.error));
      assert.equal(payload.jobSheet.jobId, jobId);
      assert.equal(payload.jobSheet.order.orderId, "TEST-PO-HTTP-1");
    }
  } finally {
    await stopApp(first);
    await stopApp(second);
    await new Promise((resolve) => google.server.close(resolve));
  }
});
