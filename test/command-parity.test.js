import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import test from "node:test";
import modelAcceptanceConfig from "../config/model-acceptance.json" with { type: "json" };
import { approveJob } from "../src/commands/approve-job.js";
import { authorizeSupervisor } from "../src/commands/authorize.js";
import { getCard } from "../src/commands/get-card.js";
import { getJob } from "../src/commands/get-job.js";
import { findSeenBefore } from "../src/commands/history.js";
import { classifyApprovedPhoto, diagnoseUploadedPhoto, listApprovedPhotos } from "../src/commands/photos.js";
import { planLot } from "../src/commands/plan-lot.js";
import { readOrder } from "../src/commands/read-order.js";
import { createWeatherCache, readWeather } from "../src/commands/read-weather.js";
import { getStatus, impactSummary } from "../src/commands/status.js";
import { initializeFirebaseSupervisorAuthenticator } from "../src/firebase-supervisor-auth.js";
import { createLiveStore } from "../src/google-cloud/live-store.js";
import { createHackathonDemoAuthenticator } from "../src/hackathon-demo-auth.js";
import { createJobCoordinator } from "../src/job-coordinator.js";
import { createJobSubmissionHandler } from "../src/job-draft-persistence.js";
import { InMemoryIdempotencyStore } from "../src/job-idempotency.js";
import { isModelSetAccepted } from "../src/model-acceptance.js";
import { applicationOrigin, isSameApplicationOrigin } from "../src/request-origin.js";
import { createConfiguredServicePorts } from "../src/service-ports.js";
import { createStoredJobSheetLookup } from "../src/stored-job-sheet-lookup.js";
import { createTraceRegistry } from "../src/trace-registry.js";
import { initializeUserSessionAuth } from "../src/user-session-auth.js";

// Each side generates these per call (clock reads, random IDs), so they cannot match.
const VOLATILE_KEYS = new Set(["runId", "reviewId", "createdAt", "approvedAt", "retrievedAt", "ageSeconds", "diagnosedAt", "expiresAt"]);

const DEMO_ENV = { USTAAD_ENABLE_DEMO_MODE: "true" };
const HACKATHON_ENV = {
  USTAAD_AUTHORIZATION_MODE: "HACKATHON_DEMO",
  USTAAD_DEMO_SESSION_SIGNING_KEY: "a".repeat(64),
  USTAAD_ENABLE_APPROVAL_AUDIT: "true",
  USTAAD_SYNTHETIC_ONLY: "true",
};

const LEVERS = {
  sfSpeedMpm: "40", rollTempC: "165", gumApplication: "MED", gumViscositySec: "40",
  pastingPressure: "MED", dryingHours: "6", printSpeedSpm: "50",
};

function withoutVolatile(value) {
  if (Array.isArray(value)) return value.map(withoutVolatile);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !VOLATILE_KEYS.has(key))
    .map(([key, item]) => [key, withoutVolatile(item)]));
}

// Two renders of the same card differ only in the creation date and the trailer /ID.
function maskPdfVolatile(bytes) {
  return bytes.toString("latin1")
    .replace(/\(D:\d{14}Z\)/g, "(D:masked)")
    .replace(/\/ID \[<[0-9a-f]+> <[0-9a-f]+>\]/g, "/ID [masked]");
}

// Mirrors responseForResult and commandResponse in index.mjs.
function expectedStatus(result) {
  if (result.ok) return 200;
  if (Number.isInteger(result.status)) return result.status;
  return { GEMINI_DAILY_CAP_EXCEEDED: 429, SERVICE_UNAVAILABLE: 503, NOT_FOUND: 404, CONFLICT: 409, IDEMPOTENCY_IN_PROGRESS: 409 }[result.error?.code] ?? 400;
}

function bodyOf(result) {
  if (result.ok || !Number.isInteger(result.status)) return result;
  const { status, ...body } = result;
  return body;
}

async function assertParity(response, result, label) {
  assert.equal(response.status, expectedStatus(result), `${label}: HTTP status`);
  assert.deepEqual(withoutVolatile(await response.json()), withoutVolatile(JSON.parse(JSON.stringify(bodyOf(result)))), `${label}: body`);
}

async function freePort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function startServer(modeEnv) {
  const port = await freePort();
  const child = spawn(process.execPath, ["index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { PATH: process.env.PATH, PORT: String(port), ...modeEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await Promise.race([
    once(child.stdout, "data"),
    once(child, "exit").then(() => { throw new Error("Server exited during startup."); }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Server startup timed out.")), 6000).unref()),
  ]);
  return { origin: `http://127.0.0.1:${port}`, child };
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await exited;
}

// The same wiring index.mjs builds at startup, from the same environment.
async function buildDeps(env) {
  const isCloudRun = Boolean(env.K_SERVICE);
  const demoMode = !isCloudRun && env.USTAAD_AUTHORIZATION_MODE !== "HACKATHON_DEMO" && env.USTAAD_ENABLE_DEMO_MODE === "true";
  const executionMode = demoMode ? "demo" : isCloudRun ? "live-service" : "offline";
  const servicePorts = createConfiguredServicePorts({ env });
  const supervisorAuthenticator = await initializeFirebaseSupervisorAuthenticator(env);
  const userSessionAuth = await initializeUserSessionAuth(env);
  const hackathonAuth = createHackathonDemoAuthenticator({ mode: env.USTAAD_AUTHORIZATION_MODE,
    signingKey: env.USTAAD_DEMO_SESSION_SIGNING_KEY,
    syntheticOnly: env.USTAAD_SYNTHETIC_ONLY === "true",
    auditEnabled: env.USTAAD_ENABLE_APPROVAL_AUDIT === "true" });
  const approvalAuthorizationConfigured = hackathonAuth.enabled ? hackathonAuth.configured : supervisorAuthenticator.configured;
  const plantId = env.USTAAD_PLANT_ID ?? (demoMode ? "PLANT-DEMO-01" : undefined);
  const prepareJob = createJobCoordinator({ services: servicePorts, traceRegistry: createTraceRegistry(), plantId, allowSyntheticDemoConditions: demoMode });
  const jobSheetPersistenceAvailable = servicePorts.availability.createDraftJobSheet === true &&
    servicePorts.availability.getStoredJobSheet === true;
  const idempotencyStore = (jobSheetPersistenceAvailable || demoMode) ? new InMemoryIdempotencyStore({ leaseMs: 30_000 }) : undefined;
  const jobCreationAvailable = jobSheetPersistenceAvailable && typeof idempotencyStore?.claim === "function" &&
    (executionMode === "demo" || (isModelSetAccepted(modelAcceptanceConfig) && approvalAuthorizationConfigured));
  const published = [];
  const liveStore = createLiveStore({ enabled: false });
  return {
    published,
    deps: {
      env,
      servicePorts,
      executionMode,
      demoMode,
      userSessionAuth,
      hackathonAuth,
      supervisorAuthenticator,
      approvalAuthorizationConfigured,
      localPrivilegedAdapterConfigured: false,
      traceOwners: new Map(),
      isSameOrigin: ({ origin, requestUrl }) => isSameApplicationOrigin({ origin, requestUrl, cloudRun: isCloudRun, configuredOrigin: env.USTAAD_PUBLIC_ORIGIN }),
      sessionAudience: (requestUrl) => applicationOrigin({ requestUrl, cloudRun: isCloudRun, configuredOrigin: env.USTAAD_PUBLIC_ORIGIN }),
      jobSheetPersistenceAvailable,
      jobCreationAvailable,
      idempotencyStore,
      modelAcceptanceConfig,
      liveStore: { publish: async (record) => { published.push(record); return liveStore.publish(record); } },
      submitJob: createJobSubmissionHandler({
        prepareJob,
        createDraftJobSheet: servicePorts.createDraftJobSheet,
        getStoredJobSheet: servicePorts.getStoredJobSheet,
        draftPersistenceEnabled: jobCreationAvailable,
        storedJobLookupEnabled: servicePorts.availability.getStoredJobSheet === true,
        plantId,
        store: idempotencyStore,
        leaseMs: 30_000,
      }),
      lookupStoredJobSheet: createStoredJobSheetLookup({ getStoredJobSheet: servicePorts.getStoredJobSheet, testOnly: executionMode !== "demo" }),
      newCorrelationId: randomUUID,
      now: Date.now,
      log: () => {},
      weatherProvider: undefined,
      weatherCache: createWeatherCache(),
      purchaseOrderPolicy: {
        acceptRealOrders: false,
        extractionAdapterConfigured: servicePorts.availability.extractOrderForReview === true,
        syntheticOnly: env.USTAAD_SYNTHETIC_ONLY === "true",
      },
    },
  };
}

function multipart(fields) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return form;
}

const purchaseOrder = await readFile(new URL("./fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf", import.meta.url));
const pdfFile = (bytes = purchaseOrder) => new File([bytes], "order.pdf", { type: "application/pdf" });

function jobFields(overrides = {}) {
  return {
    file: pdfFile(), orderId: "TEST-PO-PARITY", paperType: "VIRGIN", paperSupplier: "SUPPLIER-TEST",
    confirmedItemCode: "SKU-TEST-42", confirmedQuantity: "100", confirmedLineIndex: "1",
    shift: "DAY", runDate: "2026-10-15", ambientRhPct: "64", ambientTempC: "26", paperMoisturePct: "8.5",
    conditionsConfirmed: "true", ...LEVERS, ...overrides,
  };
}

test("demo-mode commands return through HTTP what they return in process", async (t) => {
  // src/mock-agents.js reads the demo flag from process.env rather than from its caller.
  const savedEnv = { K_SERVICE: process.env.K_SERVICE, USTAAD_ENABLE_DEMO_MODE: process.env.USTAAD_ENABLE_DEMO_MODE };
  delete process.env.K_SERVICE;
  process.env.USTAAD_ENABLE_DEMO_MODE = "true";
  t.after(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const { origin, child } = await startServer(DEMO_ENV);
  try {
    const { deps, published } = await buildDeps(DEMO_ENV);

    await assertParity(await fetch(`${origin}/api/status`), getStatus({}, deps), "status");
    await assertParity(await fetch(`${origin}/impact/summary`), await impactSummary({}, deps), "impact summary");
    await assertParity(await fetch(`${origin}/conditions/weather`), await readWeather({}, deps), "weather");

    const orderFields = { file: pdfFile(), orderId: "TEST-PO-PARITY", paperType: "VIRGIN", paperSupplier: "SUPPLIER-TEST" };
    const httpOrder = await fetch(`${origin}/orders/extract`, { method: "POST", body: multipart(orderFields) });
    const order = await readOrder({ fields: orderFields }, deps);
    assert.equal(order.ok, true);
    await assertParity(httpOrder, order, "read order");
    assert.equal(published.at(-1).event.type, "order.read");
    const modified = { ...orderFields, file: pdfFile(Buffer.concat([purchaseOrder, Buffer.from("\n%changed")])) };
    await assertParity(await fetch(`${origin}/orders/extract`, { method: "POST", body: multipart(modified) }),
      await readOrder({ fields: modified }, deps), "read order, unapproved bytes");
    await assertParity(await fetch(`${origin}/orders/extract`, { method: "POST", body: multipart({ ...orderFields, selectedLineIndex: "-1" }) }),
      await readOrder({ fields: { ...orderFields, selectedLineIndex: "-1" } }, deps), "read order, bad line index");

    const unconfirmed = jobFields({ conditionsConfirmed: "false" });
    await assertParity(await fetch(`${origin}/jobs`, { method: "POST", body: multipart(unconfirmed) }),
      await planLot({ fields: unconfirmed }, deps), "plan lot, unconfirmed conditions");
    await assertParity(await fetch(`${origin}/jobs`, { method: "POST", body: multipart(jobFields()), headers: { "Idempotency-Key": "has space" } }),
      await planLot({ fields: jobFields(), idempotencyKey: "has space" }, deps), "plan lot, malformed key");
    const httpPlan = await fetch(`${origin}/jobs`, { method: "POST", body: multipart(jobFields()) });
    const plan = await planLot({ fields: jobFields() }, deps);
    assert.equal(plan.ok, true, JSON.stringify(plan.error));
    await assertParity(httpPlan, plan, "plan lot");
    assert.equal(published.at(-1).lot.status, "planned");
    const jobId = plan.jobSheet.jobId;

    await assertParity(await fetch(`${origin}/jobs/${jobId}`), await getJob({ jobId }, deps), "get job");
    await assertParity(await fetch(`${origin}/jobs/JOB-${"0".repeat(40)}`), await getJob({ jobId: `JOB-${"0".repeat(40)}` }, deps), "get job, missing");
    await assertParity(await fetch(`${origin}/jobs/${jobId}/card.pdf`), await getCard({ jobId }, deps), "card before approval");
    await assertParity(await fetch(`${origin}/jobs/${jobId}/approve?lang=xx`, { method: "POST" }),
      await approveJob({ jobId, lang: "xx" }, deps), "approve, bad language");
    // The demo ports ignore currency, so a malformed code is the only currency-dependent
    // outcome here: it is rejected only if the route forwards the query.
    await assertParity(await fetch(`${origin}/jobs/${jobId}/approve?lang=en&currency=us`, { method: "POST" }),
      await approveJob({ jobId, lang: "en", currency: "us" }, deps), "approve, malformed currency");
    await assertParity(await fetch(`${origin}/jobs/${jobId}/card.pdf?currency=us`),
      await getCard({ jobId, currency: "us" }, deps), "card, malformed currency");
    await assertParity(await fetch(`${origin}/jobs/${jobId}/approve?lang=en&currency=INR`, { method: "POST" }),
      await approveJob({ jobId, lang: "en", currency: "INR" }, deps), "approve");
    assert.equal(published.at(-1).lot.status, "approved");

    const httpCard = await fetch(`${origin}/jobs/${jobId}/card.pdf?lang=en&currency=INR`);
    const card = await getCard({ jobId, lang: "en", currency: "INR" }, deps);
    assert.equal(httpCard.status, 200);
    assert.equal(card.ok, true);
    assert.equal(httpCard.headers.get("content-type"), card.contentType);
    assert.equal(httpCard.headers.get("content-disposition"), `inline; filename="${card.filename}"`);
    assert.equal(maskPdfVolatile(Buffer.from(await httpCard.arrayBuffer())), maskPdfVolatile(Buffer.from(card.bytes)), "card: PDF bytes");

    await assertParity(await fetch(`${origin}/evidence/approved-photos`), await listApprovedPhotos({}, deps), "approved photos");
    const forgedPhoto = { photoId: "photo-01", fileUri: "gs://unapproved/image.jpg" };
    await assertParity(await fetch(`${origin}/evidence/classify-photo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(forgedPhoto) }),
      await classifyApprovedPhoto(forgedPhoto, deps), "classify photo, forged URI");
    const photoFields = () => ({ file: new File([Buffer.from([0xff, 0xd8, 0xff])], "sheet.jpg", { type: "image/jpeg" }), ambientRhPct: "72", lotId: "LOT-1" });
    await assertParity(await fetch(`${origin}/evidence/diagnose-photo`, { method: "POST", body: multipart(photoFields()) }),
      await diagnoseUploadedPhoto({ fields: photoFields() }, deps), "diagnose photo");
    assert.equal(published.at(-1).event.type, "defect.logged");
    await assertParity(await fetch(`${origin}/evidence/diagnose-photo`, { method: "POST", body: multipart({ ...photoFields(), ambientRhPct: "140" }) }),
      await diagnoseUploadedPhoto({ fields: { ...photoFields(), ambientRhPct: "140" } }, deps), "diagnose photo, bad humidity");

    for (const body of [{ defect: "WARP", ambientRhPct: 80 }, { defect: "NONE", ambientRhPct: 80 }]) {
      await assertParity(await fetch(`${origin}/evidence/seen-before`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
        await findSeenBefore(body, deps), `seen before ${body.defect}`);
    }
  } finally {
    await stopServer(child);
  }
});

test("authorize decides through HTTP what it decides in process", async () => {
  const { origin, child } = await startServer(HACKATHON_ENV);
  try {
    const { deps } = await buildDeps(HACKATHON_ENV);
    const session = await fetch(`${origin}/api/auth/demo-session`, { method: "POST", headers: { Origin: origin } });
    assert.equal(session.status, 200);
    const demoCookie = session.headers.get("set-cookie").split(";")[0].split("=")[1];
    const sid = JSON.parse(Buffer.from(demoCookie.split(".")[0], "base64url").toString()).sid;
    const cookieHeader = `__Host-ustaad-demo=${demoCookie}`;
    const ownedJob = `JOB-HACK-${sid}-${"b".repeat(40)}`;

    const cases = [
      { label: "no session", method: "GET", path: `/jobs/${ownedJob}`, headers: {}, input: {} },
      { label: "forged session", method: "GET", path: `/jobs/${ownedJob}`, headers: { Cookie: "__Host-ustaad-demo=abc.def" }, input: { demoCookie: "abc.def" } },
      { label: "another session's job", method: "GET", path: "/jobs/JOB-TEST-42", headers: { Cookie: cookieHeader }, input: { demoCookie } },
      { label: "cross-origin write", method: "POST", path: "/evidence/seen-before", headers: { Cookie: cookieHeader, Origin: "https://evil.example" }, input: { demoCookie, origin: "https://evil.example" } },
      { label: "unowned trace", method: "GET", path: `/api/runs/${"00000000-0000-4000-8000-000000000000"}/events`, headers: { Cookie: cookieHeader }, input: { demoCookie } },
      { label: "insights scope", method: "GET", path: "/insights/summary", headers: { Cookie: cookieHeader }, input: { demoCookie } },
    ];
    for (const { label, method, path, headers, input } of cases) {
      const jobId = /^\/jobs\/([^/]+)/.exec(path)?.[1];
      const result = await authorizeSupervisor({ method, path, jobId, requestUrl: origin + path, ...input }, deps);
      assert.equal(result.ok, false, label);
      await assertParity(await fetch(origin + path, { method, headers }), result, label);
    }

    const allowed = await authorizeSupervisor({ method: "POST", path: "/evidence/seen-before", demoCookie, origin, requestUrl: `${origin}/evidence/seen-before` }, deps);
    assert.equal(allowed.ok, true);
    assert.equal(allowed.principal.sessionId, sid);
    const passed = await fetch(`${origin}/evidence/seen-before`, { method: "POST", headers: { Cookie: cookieHeader, Origin: origin, "Content-Type": "application/json" }, body: "{}" });
    assert.equal(passed.status, 400, "an authorized request reaches validation");
    assert.equal((await passed.json()).error.code, "VALIDATION_ERROR");
  } finally {
    await stopServer(child);
  }
});

test("approve route rejects an unsupported currency before approving", async () => {
  const { origin, child } = await startServer(DEMO_ENV);
  try {
    const plan = await fetch(`${origin}/jobs`, { method: "POST", body: multipart(jobFields()) });
    assert.equal(plan.status, 200);
    const { jobSheet } = await plan.json();

    const rejected = await fetch(`${origin}/jobs/${jobSheet.jobId}/approve?lang=en&currency=ZZZ`, { method: "POST" });
    assert.equal(rejected.status, 400);
    const body = await rejected.json();
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.match(body.error.issues[0].message, /INR, JPY, KRW, CNY, IDR, SGD, AUD, THB, PHP, MYR, USD/);
    assert.equal((await (await fetch(`${origin}/jobs/${jobSheet.jobId}`)).json()).jobSheet.status, "DRAFT");

    const approved = await fetch(`${origin}/jobs/${jobSheet.jobId}/approve?lang=en&currency=SGD`, { method: "POST" });
    assert.equal(approved.status, 200);
  } finally {
    await stopServer(child);
  }
});
