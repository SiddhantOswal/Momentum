import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { jobSheetFixture } from "./fixtures/job-sheet.js";

const PORT = 4100;

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await exited;
}


async function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, ["index.mjs"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, PORT: String(PORT), ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const [startupMessage] = await once(child.stdout, "data");
  const message = startupMessage.toString();

  return { child, startupMessage: message.trim() };
}

test("health endpoint returns ok", async () => {
  const { child, startupMessage } = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/health`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.mode, "local-development");
    assert.equal(payload.executionMode, "offline");
    assert.match(startupMessage, /http:\/\/localhost:/i);
  } finally {
    await stopServer(child);
  }
});

test("unknown routes identify the local runtime without exposing diagnostics", async () => {
  const { child } = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/not-a-route`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: "Not found",
      path: "/not-a-route",
      mode: "local-development",
      message: "The requested endpoint was not found.",
    });
  } finally {
    await stopServer(child);
  }
});

test("Impact summary reports unavailable live data without substituting preview values", async () => {
  const { child } = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/impact/summary`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "getImpactSummary is not configured. The four live Impact dashboard queries are not configured.",
      },
    });
  } finally {
    await stopServer(child);
  }
});

test("Impact dashboard is served from the application origin and fails without showing preview estimates", async () => {
  const { child } = await startServer();
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/impact`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const html = await response.text();
    assert.match(html, /url=\/#screen-impact/);
    assert.match(html, /No sample values are shown/);
    assert.doesNotMatch(html, /Showing the verified BigQuery results/);
  } finally {
    await stopServer(child);
  }
});

test("seen-before endpoint validates defect evidence before calling the disabled adapter", async () => {
  const { child } = await startServer();

  try {
    const invalid = await fetch(`http://127.0.0.1:${PORT}/evidence/seen-before`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defect: "NONE", ambientRhPct: 86 }),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "VALIDATION_ERROR");

    const unavailable = await fetch(`http://127.0.0.1:${PORT}/evidence/seen-before`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defect: "STRENGTH", ambientRhPct: 86 }),
    });
    assert.equal(unavailable.status, 503);
  } finally {
    await stopServer(child);
  }
});

test("similar-run and explanation routes validate contracts before reporting disabled adapters", async () => {
  const { child } = await startServer();

  try {
    const similarInvalid = await fetch(`http://127.0.0.1:${PORT}/risk/similar-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: {}, conditions: {} }),
    });
    assert.equal(similarInvalid.status, 400);
    assert.equal((await similarInvalid.json()).error.code, "VALIDATION_ERROR");

    const similarUnavailable = await fetch(`http://127.0.0.1:${PORT}/risk/similar-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: jobSheetFixture.order,
        conditions: jobSheetFixture.conditions,
      }),
    });
    assert.equal(similarUnavailable.status, 503);
    assert.match((await similarUnavailable.json()).error.message, /findSimilarRuns is not configured/);

    const risk = jobSheetFixture.baseline.risk;
    const optimization = {
      baseline: { levers: jobSheetFixture.baseline.levers, risk },
      best: { levers: jobSheetFixture.recommended.levers, risk: jobSheetFixture.recommended.risk },
      changes: [],
      savings: jobSheetFixture.savings,
    };
    const explanationInvalid = await fetch(`http://127.0.0.1:${PORT}/risk/explanation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prediction: risk }),
    });
    assert.equal(explanationInvalid.status, 400);
    assert.equal((await explanationInvalid.json()).error.code, "VALIDATION_ERROR");

    const explanationUnavailable = await fetch(`http://127.0.0.1:${PORT}/risk/explanation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: jobSheetFixture.order,
        conditions: jobSheetFixture.conditions,
        prediction: risk,
        optimization,
        evidence: [],
      }),
    });
    assert.equal(explanationUnavailable.status, 503);
    // Owner-accepted D4 passes the model gate; the unconfigured explanation adapter still fails closed.
    assert.match((await explanationUnavailable.json()).error.message, /explainRisk is not configured/);
  } finally {
    await stopServer(child);
  }
});

test("health remains available while operational requests are rate limited", async () => {
  const { child } = await startServer();

  try {
    for (let requestNumber = 1; requestNumber <= 60; requestNumber += 1) {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/status`);
      assert.equal(response.status, 200, `request ${requestNumber}`);
    }
    const limited = await fetch(`http://127.0.0.1:${PORT}/api/status`);
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.code, "RATE_LIMIT_EXCEEDED");

    const health = await fetch(`http://127.0.0.1:${PORT}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
  } finally {
    await stopServer(child);
  }
});

test("root serves the rebuilt operator UI and its complete same-origin workflow modules", async () => {
  const { child } = await startServer();
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const html = await response.text();
    for (const text of ["Ustaad AI", "Production workspace", "Local development", "New Lot", "Production analysis", "Defect Check", "Impact", "English interface.", "No production impact data loaded.", "predicted", "supervisor approval"]) assert.ok(html.includes(text), text);
    assert.doesNotMatch(html, /synthetic|simulated|id="sample-order"/i);
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, "IDs must be unique");
    const screens = [...html.matchAll(/<section id="([^"]+)" class="screen" data-screen-panel/g)].map((m) => m[1]);
    assert.deepEqual(screens, ["screen-order-input", "screen-production-analysis", "dashboard-job-review", "screen-defect-check", "screen-impact"]);
    for (const id of ["purchase-order-review", "purchase-order-lines", "confirm-order-line", "extraction-order-id", "extraction-paper-type", "extraction-paper-supplier", "condition-request-fields", "lever-request-fields", "conditions-supervisor-confirmed", "machine-settings-confirmed", "trace-form", "what-if-controls", "approval-form", "approval-dialog", "shared-job-id", "load-stored-job-form", "stored-card-form", "feedback-form", "job-sheet-form", "local-job-sheet-preview", "status-dialog", "seen-before-form", "impact-monthly-chart"]) assert.ok(ids.includes(id), id);
    assert.match(html, /accept="application\/pdf,\.pdf,image\/jpeg,\.jpg,\.jpeg"/);
    assert.match(html, /id="prepare-job" disabled/);
    assert.match(html, /id="what-if-controls" disabled hidden/);
    assert.match(html, /id="what-if-value" type="range"/);
    assert.match(html, /aria-label="Primary navigation"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /<dialog id="approval-dialog" aria-labelledby=/);
    assert.match(html, /No settings are sent to machine controls/);
    assert.match(html, /Arbitrary image uploads are disabled/);
    assert.match(html, /id="load-approved-photos" class="button-secondary" disabled/);
    assert.match(html, /id="classify-approved-photo" class="button-secondary" disabled/);
    assert.doesNotMatch(html, /Screen [1-4] —|sidebar__link|PO-2048|CUST-418|value="1200"/);
    for (const currency of ["INR", "JPY", "KRW", "CNY", "IDR", "SGD", "AUD", "THB", "PHP", "MYR", "USD"]) assert.ok(html.includes(`<option value="${currency}">${currency}</option>`));
    assert.doesNotMatch(html, /<option value="(hi|mr|ja|ko|zh-CN|id)">/);
    let code = "";
    for (const file of ["workflow.js", "components.js", "fields.js", "api.js", "currency-display.js"]) {
      const r = await fetch(`http://127.0.0.1:${PORT}/ui/${file}`);
      assert.equal(r.status, 200, file); assert.match(r.headers.get("content-type"), /text\/javascript/);
      code += await r.text();
    }
    for (const endpoint of ["/orders/extract", "/jobs", "/risk/predict", "/risk/optimize", "/risk/similar-runs", "/risk/explanation", "/evidence/seen-before", "/impact/summary", "/fx?base=", "/api/runs/", "/job-sheets/render.pdf"]) assert.ok(code.includes(endpoint), endpoint);
    for (const guard of ["Idempotency-Key", "reviewFingerprint", "reviewId", "confirmedSourceLine", "conditionsConfirmed", "latestSimilarRunsSource === \"bigquery\"", "createRequestGate", "isCurrent", "durable === true"]) assert.ok(code.includes(guard), guard);
    assert.match(code, /resolved\.origin !== window\.location\.origin/);
    assert.match(code, /currentStoredJob\.status !== "DRAFT"/);
    assert.match(code, /scenario\.levers\[document\.getElementById\("what-if-lever"\)\.value\] = Number/);
    assert.match(code, /"run\.completed": \{ message: "traceCompleted", state: "success" \}/);
    assert.match(code, /"run\.failed": \{ message: "traceFailed", state: "error" \}/);
    assert.match(code, /"run\.cancelled": \{ message: "traceCancelled", state: "incomplete" \}/);
    assert.doesNotMatch(code, /\.innerHTML\s*=|insertAdjacentHTML/);
    assert.doesNotMatch(code, /\/api\/agents\//);
    const cssResponse = await fetch(`http://127.0.0.1:${PORT}/operator-ui.css`);
    assert.equal(cssResponse.status, 200); const css = await cssResponse.text();
    assert.match(css, /--color-accent:/); assert.match(css, /prefers-reduced-motion/); assert.match(css, /focus-visible/);
    assert.match(css, /max-width:768px/); assert.match(css, /max-width:1024px/); assert.match(css, /@font-face/);
    for (const asset of ["/fonts/plex-regular.woff2", "/fonts/plex-medium.woff2", "/fonts/plex-semibold.woff2", "/vendor/chart.umd.js"]) assert.equal((await fetch(`http://127.0.0.1:${PORT}${asset}`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${PORT}/ui/schemas.js`)).status, 404);
    const clientModule = await fetch(`http://127.0.0.1:${PORT}/display-currency.js`);
    assert.equal(clientModule.status, 200); assert.match(await clientModule.text(), /export function formatDisplayCurrency/);
  } finally { child.kill("SIGTERM"); }
});

test("JobSheet PDF route validates input and renders locally without cloud persistence", async () => {
  const { child } = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/job-sheets/render.pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jobSheetFixture),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/pdf/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const pdf = Buffer.from(await response.arrayBuffer());
    assert.equal(pdf.subarray(0, 8).toString("ascii"), "%PDF-1.3");

    const invalid = await fetch(`http://127.0.0.1:${PORT}/job-sheets/render.pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: "incomplete" }),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "VALIDATION_ERROR");

    const unicode = await fetch(`http://127.0.0.1:${PORT}/job-sheets/render.pdf?lang=hi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...jobSheetFixture, explanation: "हिंदी पाठ" }),
    });
    assert.equal(unicode.status, 400, "Hindi job cards are future work under D8");
    const english = await fetch(`http://127.0.0.1:${PORT}/job-sheets/render.pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jobSheetFixture),
    });
    assert.equal(english.status, 200);
    assert.match(english.headers.get("content-type"), /application\/pdf/);
    const unicodePdf = Buffer.from(await english.arrayBuffer());
    assert.equal(unicodePdf.subarray(0, 8).toString("ascii"), "%PDF-1.3");
    assert.equal(unicodePdf.subarray(0, 8).toString("ascii"), "%PDF-1.3");
  } finally {
    await stopServer(child);
  }
});

test("status endpoint separates backend reachability from configured local integrations", async () => {
  const { child } = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/status`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.app, "Ustaad AI");
    assert.equal(payload.mode, "local-development");
    assert.equal(payload.executionMode, "offline");
    assert.equal(payload.backendReachable, true);
    assert.deepEqual(payload.modelAcceptance.requiredR2, {
      WARP: 0.6, DELAM: 0.6, STRENGTH: 0.45, PRINT: 0.6, CRACK: 0.3,
    });
    assert.equal(payload.modelAcceptance.status, "accepted");
    assert.equal(payload.modelAcceptance.evaluationId, "D4-2026-10-16-OM");
    assert.equal(payload.modelAcceptance.completeAcceptanceEvidenceAvailable, false);
    assert.equal(payload.modelAcceptance.linkedToCurrentResourceVersions, true);
    assert.equal(payload.modelAcceptance.models.length, 5);
    assert.deepEqual(payload.runtimeAvailability, {
      productionAdaptersConfigured: false,
      liveModelCallsEnabled: false,
      dailyGeminiCallCap: {
        configured: true,
        enforced: false,
        scope: "single-process",
        globalScopeEnforced: false,
        limit: 100,
        timeZone: "Asia/Kolkata",
        countingPolicy: "attempts",
        reset: "midnight-in-configured-time-zone",
      },
      supervisorAuthentication: {
        provider: "firebase-google",
        enabled: false,
        verifierConfigured: false,
        userVerified: false,
      },
      currentConditions: { adapterConfigured: false, dataChecked: false },
      integrationsVerified: false,
      supervisorAuthorizationAvailable: false,
      jobSheetPersistenceAvailable: false,
      durableIdempotencyConfigured: false,
      idempotencyScope: "unavailable",
      jobCreationAvailable: false,
    });
    assert.equal(payload.isRealModelPrediction, false);
    assert.equal(payload.integrations.prepareJob, false);
    assert.equal(payload.integrations.approveJob, false);
    assert.equal(Array.isArray(payload.localCapabilities), true);
    assert.equal(payload.unconfiguredIntegrations.includes("lever optimization"), true);
    assert.match(payload.notes[0], /local process uses only explicitly configured adapters/);
  } finally {
    await stopServer(child);
  }
});

test("status reports enabled gates separately from untested sensor data and persistence", async () => {
  const { child } = await startServer({
    PROJECT_ID: "prepagent-hack",
    REGION: "asia-south1",
    BUCKET: "prepagent-hack-data",
    USTAAD_PLANT_ID: "PLANT-01",
    USTAAD_ENABLE_LIVE_MODEL_CALLS: "true",
    GEMINI_DAILY_ATTEMPT_CAP: "10",
    GEMINI_DAILY_ATTEMPT_TIMEZONE: "Asia/Kolkata",
    USTAAD_ENABLE_RISK_PREDICTION: "true",
  });
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/status`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.runtimeAvailability.productionAdaptersConfigured, true);
    assert.equal(payload.runtimeAvailability.liveModelCallsEnabled, true);
    assert.deepEqual(payload.runtimeAvailability.dailyGeminiCallCap, {
      configured: true,
      enforced: true,
      scope: "single-process",
      globalScopeEnforced: false,
      limit: 10,
      timeZone: "Asia/Kolkata",
      countingPolicy: "attempts",
      reset: "midnight-in-configured-time-zone",
    });
    assert.deepEqual(payload.runtimeAvailability.currentConditions, {
      adapterConfigured: true,
      dataChecked: false,
    });
    assert.equal(payload.runtimeAvailability.jobSheetPersistenceAvailable, false);
    assert.equal(payload.runtimeAvailability.durableIdempotencyConfigured, false);
    assert.equal(payload.runtimeAvailability.jobCreationAvailable, false);
    assert.equal(payload.integrations.createDraftJobSheet, false);
    assert.equal(payload.integrations.getStoredJobSheet, false);
  } finally {
    await stopServer(child);
  }
});

test("Cloud Run status advertises only configured cloud ports without making calls", async () => {
  const { child } = await startServer({
    K_SERVICE: "prepagent",
    USTAAD_ENABLE_DEMO_MODE: "true",
    PROJECT_ID: "prepagent-hack",
    REGION: "asia-south1",
    BUCKET: "prepagent-hack-data",
    USTAAD_PLANT_ID: "PLANT-01",
    USTAAD_ENABLE_JOB_STORAGE: "true",
    USTAAD_ENABLE_BIGQUERY_WRITES: "true",
    USTAAD_ENABLE_FEEDBACK_WRITES: "true",
  });
  try {
    const health = await fetch(`http://127.0.0.1:${PORT}/health`);
    const healthPayload = await health.json();
    assert.equal(healthPayload.mode, "cloud-run");
    assert.equal(healthPayload.executionMode, "live-service");
    const response = await fetch(`http://127.0.0.1:${PORT}/api/status`);
    const payload = await response.json();
    assert.equal(payload.mode, "cloud-run");
    assert.equal(payload.executionMode, "live-service");
    assert.equal(payload.syntheticOnlyModeRequired, true);
    assert.equal(payload.syntheticOnlyModeEnabled, false);
    assert.equal(payload.approvedPoFixtureAllowlistEnforced, true);
    assert.equal(payload.runtimeAvailability.integrationsVerified, false);
    assert.equal(payload.runtimeAvailability.supervisorAuthorizationAvailable, false);
    assert.equal(payload.integrations.supervisorAuthorizationAvailable, false);
    assert.equal(payload.integrations.approveJob, false);
    assert.equal(payload.integrations.getJobCard, false);
    assert.equal(payload.integrations.getStoredJobSheet, false);
    assert.equal(payload.integrations.createDraftJobSheet, false);
    assert.equal(payload.runtimeAvailability.jobSheetPersistenceAvailable, true);
    assert.equal(payload.runtimeAvailability.durableIdempotencyConfigured, false);
    assert.equal(payload.runtimeAvailability.jobCreationAvailable, false);
    assert.equal(payload.integrations.saveFeedback, false);
    assert.equal(payload.integrations.prepareJob, false);
    assert.equal(payload.integrations.jobCreationAvailable, false);
    assert.equal(payload.integrations.durableIdempotencyConfigured, false);
    assert.equal(payload.unconfiguredIntegrations.includes("approved job-card retrieval"), true);
    assert.equal(payload.unconfiguredIntegrations.includes("production job preparation"), true);
    assert.match(payload.notes[0], /Cloud Run instance uses workload identity/);

    const demoPrediction = await fetch(`http://127.0.0.1:${PORT}/api/agents/predictRisk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: jobSheetFixture.order,
        conditions: jobSheetFixture.conditions,
        levers: jobSheetFixture.baseline.levers,
      }),
    });
    assert.equal(demoPrediction.status, 503);
    assert.equal((await demoPrediction.json()).error.code, "SERVICE_UNAVAILABLE");
  } finally {
    await stopServer(child);
  }
});

test("live decision routes reject missing or forged supervisor identity before validation or service calls", async () => {
  const { child } = await startServer({
    K_SERVICE: "prepagent",
    USTAAD_ENABLE_DEMO_MODE: "true",
    PROJECT_ID: "prepagent-hack",
    USTAAD_ENABLE_BIGQUERY_WRITES: "true",
    USTAAD_ENABLE_JOB_STORAGE: "true",
  });
  try {
    const routes = [
      ["/conditions/current?shift=DAY", "GET"],
      ["/risk/predict", "POST"],
      ["/risk/optimize", "POST"],
      ["/jobs", "POST"],
      ["/jobs/TEST-1/approve", "POST"],
      ["/jobs/TEST-1/card.pdf", "GET"],
      ["/jobs/TEST-1/feedback", "POST"],
    ];
    for (const [path, method] of routes) {
      const response = await fetch(`http://127.0.0.1:${PORT}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-supervisor-id": "forged-supervisor",
          "x-supervisor-role": "supervisor",
          "x-authenticated-user": "owner@example.com",
        },
        ...(method === "POST" ? { body: JSON.stringify({ role: "supervisor", approvedBy: "forged-supervisor" }) } : {}),
      });
      assert.equal(response.status, 503, path);
      assert.equal((await response.json()).error.code, "AUTHENTICATION_NOT_CONFIGURED", path);
    }
  } finally {
    await stopServer(child);
  }
});

test("legacy mock-agent endpoints are unavailable in live-service even when demo is requested", async () => {
  const { child } = await startServer({ K_SERVICE: "prepagent", USTAAD_ENABLE_DEMO_MODE: "true" });
  const paths = [
    "/api/agents/getConditions",
    "/api/agents/predictRisk",
    "/api/agents/optimizeLevers",
    "/api/agents/findSimilarRuns",
    "/api/agents/explainRisk",
    "/api/agents/generateJobSheet",
  ];
  try {
    for (const path of paths) {
      const response = await fetch(`http://127.0.0.1:${PORT}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supervisor-id": "admin",
          "x-supervisor-role": "supervisor",
          authorization: "Bearer unverified-test-token",
        },
        body: JSON.stringify({}),
      });
      const payload = await response.json();
      assert.equal(response.status, 503, path);
      assert.equal(payload.ok, false, path);
      assert.equal(payload.error.code, "SERVICE_UNAVAILABLE", path);
      assert.match(payload.error.message, /explicitly enabled local demo mode/, path);
      assert.doesNotMatch(JSON.stringify(payload), /mock-demo|riskRates|recommended/i, path);
    }
  } finally {
    await stopServer(child);
  }
});

test("legacy mock-agent endpoints are unavailable in offline mode", async () => {
  const { child } = await startServer();
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/agents/predictRisk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.error.code, "SERVICE_UNAVAILABLE");
    assert.match(payload.error.message, /explicitly enabled local demo mode/);
    assert.equal(payload.ratesPct, undefined);
  } finally {
    await stopServer(child);
  }
});

test("Cloud Run job lifecycle routes fail closed without supervisor authorization", async () => {
  const { child } = await startServer({ K_SERVICE: "prepagent", USTAAD_ENABLE_DEMO_MODE: "true" });
  const paths = [
    ["POST", "/jobs"],
    ["GET", "/jobs/TEST-JOB-1"],
    ["POST", "/jobs/TEST-JOB-1/approve"],
    ["GET", "/jobs/TEST-JOB-1/card.pdf"],
    ["POST", "/jobs/TEST-JOB-1/feedback"],
  ];
  try {
    for (const [method, path] of paths) {
      const response = await fetch(`http://127.0.0.1:${PORT}${path}`, {
        method,
        ...(method === "POST" ? {
          headers: {
            "Content-Type": "application/json",
            "x-supervisor-id": "admin",
            "x-supervisor-role": "supervisor",
            authorization: "Bearer unverified-test-token",
          },
          body: JSON.stringify({}),
        } : {}),
      });
      assert.equal(response.status, 503, `${method} ${path}`);
      const payload = await response.json();
      assert.equal(payload.error.code, "AUTHENTICATION_NOT_CONFIGURED", `${method} ${path}`);
      assert.match(payload.error.message, /Firebase Authentication is configured/, `${method} ${path}`);
    }
  } finally {
    await stopServer(child);
  }
});

test("Cloud Run prediction and optimization require an authenticated supervisor", async () => {
  const { child } = await startServer({ K_SERVICE: "prepagent", USTAAD_ENABLE_DEMO_MODE: "true" });
  const conditions = {
    runDate: "2026-10-15", shift: "DAY", ambientRhPct: 64,
    ambientTempC: 26, paperMoisturePct: 8.5,
  };
  const levers = {
    sfSpeedMpm: 42, rollTempC: 168, gumApplication: "MED", gumViscositySec: 40,
    pastingPressure: "MED", dryingHours: 6, printSpeedSpm: 55,
  };
  const requests = [
    ["/risk/predict", {
      order: { itemCode: "PKBX0041", quantity: 1300, paperType: "RECYCLED", paperSupplier: "SUP-D" },
      conditions: { shift: "DAY", ambientRhPct: 64, ambientTempC: 26, paperMoisturePct: 8.5 },
      conditionsConfirmed: true,
      levers,
    }],
    ["/risk/optimize", { order: jobSheetFixture.order, conditions, conditionsConfirmed: true, levers }],
    ["/risk/optimize", { order: jobSheetFixture.order, conditions, levers }],
    ["/risk/explanation", {
      order: jobSheetFixture.order,
      conditions: jobSheetFixture.conditions,
      prediction: jobSheetFixture.baseline.risk,
      optimization: {
        baseline: jobSheetFixture.baseline,
        best: jobSheetFixture.recommended,
        changes: jobSheetFixture.changes,
        savings: jobSheetFixture.savings,
      },
      evidence: [],
    }],
  ];
  try {
    for (const [path, body] of requests) {
      const response = await fetch(`http://127.0.0.1:${PORT}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supervisor-id": "admin",
          "x-supervisor-role": "supervisor",
          authorization: "Bearer unverified-test-token",
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      assert.equal(response.status, 503, path);
      assert.equal(payload.error.code, "AUTHENTICATION_NOT_CONFIGURED", path);
    }
  } finally {
    await stopServer(child);
  }
});

test("direct HTTP prediction and optimization routes remain blocked until Firebase supervisor verification is configured", async () => {
  const { child } = await startServer({
    PROJECT_ID: "prepagent-hack",
    REGION: "asia-south1",
    USTAAD_ENABLE_RISK_PREDICTION: "true",
    USTAAD_OPTIMIZER_CONTRACT_STATUS: "approved",
    USTAAD_OPTIMIZER_CONTRACT_VERSION: "om-d2-d3-v1",
  });
  const body = {
    order: {
      orderId: "TEST-HTTP-ACCEPTANCE", itemCode: "PKBX0041", customerId: "SYNTHETIC",
      boxStyle: "RSC", lengthMm: 400, widthMm: 300, heightMm: 250, ply: 5,
      fluteProfile: "BC", topLinerGsm: 180, fluteGsm: 150, innerLinerGsm: 180,
      linerBf: 24, paperType: "RECYCLED", paperSupplier: "SUP-D", inkColors: 2,
      inkCoveragePct: 15, quantity: 1300,
    },
    conditions: { shift: "DAY", ambientRhPct: 86, ambientTempC: 26, paperMoisturePct: 10.8 },
    conditionsConfirmed: true,
    levers: {
      sfSpeedMpm: 48, rollTempC: 162, gumApplication: "HIGH", gumViscositySec: 32,
      pastingPressure: "MED", dryingHours: 5, printSpeedSpm: 60,
    },
  };
  try {
    for (const path of ["/risk/predict", "/risk/optimize"]) {
      const requestBody = path === "/risk/optimize"
        ? { ...body, conditions: { ...body.conditions, runDate: "2026-10-15" } }
        : body;
      const response = await fetch(`http://127.0.0.1:${PORT}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      assert.equal(response.status, 503, path);
      const result = await response.json();
      assert.equal(result.error.code, "AUTHENTICATION_NOT_CONFIGURED", path);
    }
  } finally {
    await stopServer(child);
  }
});

test("demo PO extraction rejects unapproved bytes even when the caller asserts synthetic provenance", async () => {
  const { child } = await startServer({ USTAAD_ENABLE_DEMO_MODE: "true" });
  try {
    const upload = new FormData();
    upload.append("file", new Blob(["%PDF-1.4 spoofed"], { type: "application/pdf" }), "synthetic.pdf");
    const response = await fetch(`http://127.0.0.1:${PORT}/orders/extract`, {
      method: "POST",
      headers: { "x-synthetic": "true", "x-provenance": "approved-fixture" },
      body: upload,
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
  } finally {
    await stopServer(child);
  }
});

test("Cloud Run PO extraction requires an explicit synthetic-only gate", async () => {
  const { child } = await startServer({ K_SERVICE: "prepagent", USTAAD_SYNTHETIC_ONLY: "false" });
  try {
    const fixture = await readFile(new URL("./fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf", import.meta.url));
    const form = new FormData();
    form.append("file", new Blob([fixture], { type: "application/pdf" }), "approved-po.pdf");
    const response = await fetch(`http://127.0.0.1:${PORT}/orders/extract`, { method: "POST", body: form });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "AUTHENTICATION_NOT_CONFIGURED");
  } finally {
    await stopServer(child);
  }
});

test("Cloud Run PO extraction rejects modified documents in synthetic-only mode", async () => {
  const { child } = await startServer({ K_SERVICE: "prepagent", USTAAD_SYNTHETIC_ONLY: "true" });
  try {
    const fixture = new Uint8Array(await readFile(new URL("./fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf", import.meta.url)));
    fixture[fixture.length - 1] ^= 1;
    const form = new FormData();
    form.append("file", new Blob([fixture], { type: "application/pdf" }), "modified-po.pdf");
    const response = await fetch(`http://127.0.0.1:${PORT}/orders/extract`, {
      method: "POST",
      headers: { "x-synthetic": "true", "x-provenance": "approved-fixture" },
      body: form,
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "AUTHENTICATION_NOT_CONFIGURED");
  } finally {
    await stopServer(child);
  }
});

test("Cloud Run PO extraction rejects oversized decoded JPEGs before storage or model adapters", async () => {
  const { child } = await startServer({ K_SERVICE: "prepagent", USTAAD_SYNTHETIC_ONLY: "true" });
  const jpegHeader = Uint8Array.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08,
    0xff, 0xff, 0xff, 0xff, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9,
  ]);
  try {
    const form = new FormData();
    form.append("file", new Blob([jpegHeader], { type: "image/jpeg" }), "huge-scan.jpg");
    const response = await fetch(`http://127.0.0.1:${PORT}/orders/extract`, { method: "POST", body: form });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "AUTHENTICATION_NOT_CONFIGURED");
  } finally {
    await stopServer(child);
  }
});

test("Cloud Run does not accept JobSheet drafts before supervisor authorization exists", async () => {
  const { child } = await startServer({
    K_SERVICE: "prepagent",
    USTAAD_ENABLE_DEMO_MODE: "true",
    PROJECT_ID: "prepagent-hack",
    REGION: "asia-south1",
    BUCKET: "prepagent-hack-data",
    USTAAD_PLANT_ID: "PLANT-01",
    USTAAD_ENABLE_JOB_STORAGE: "true",
    USTAAD_ENABLE_BIGQUERY_WRITES: "true",
  });
  try {
    const form = new FormData();
    form.append("file", new Blob(["%PDF-1.4 test fixture"], { type: "application/pdf" }), "order.pdf");
    form.append("orderId", "PO-SYNTHETIC-001");
    form.append("paperType", "RECYCLED");
    form.append("paperSupplier", "SUPPLIER-SYNTHETIC");
    form.append("confirmedItemCode", "PKBX0041");
    form.append("confirmedQuantity", "1300");
    form.append("shift", "DAY");
    form.append("runDate", "2026-10-14");
    form.append("ambientRhPct", "70");
    form.append("ambientTempC", "29");
    form.append("paperMoisturePct", "9");
    form.append("conditionsConfirmed", "true");
    for (const [field, value] of Object.entries({
      sfSpeedMpm: 40,
      rollTempC: 165,
      gumApplication: "MED",
      gumViscositySec: 40,
      pastingPressure: "MED",
      dryingHours: 6,
      printSpeedSpm: 50,
    })) form.append(field, String(value));

    const response = await fetch(`http://127.0.0.1:${PORT}/jobs`, {
      method: "POST",
      headers: {
        "x-supervisor-id": "admin",
        "x-supervisor-role": "supervisor",
        authorization: "Bearer unverified-test-token",
      },
      body: form,
    });
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.code, "AUTHENTICATION_NOT_CONFIGURED");
    assert.match(payload.error?.message, /Firebase Authentication is configured/);
    assert.equal(payload.runId, undefined);
    assert.equal(payload.jobSheet, undefined);
  } finally {
    await stopServer(child);
  }
});

test("malformed and non-object JSON return structured validation errors", async () => {
  const { child } = await startServer({ USTAAD_ENABLE_DEMO_MODE: "true" });

  try {
    const malformed = await fetch(`http://127.0.0.1:${PORT}/api/agents/getConditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error.code, "VALIDATION_ERROR");

    for (const body of ["null", "[]", "true"]) {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/agents/getConditions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      assert.equal(response.status, 400);
      const payload = await response.json();
      assert.equal(payload.error.code, "VALIDATION_ERROR");
      assert.match(payload.error.issues[0].message, /JSON object/);
    }
  } finally {
    await stopServer(child);
  }
});

test("oversized request bodies are rejected with a JSON 413 response", async () => {
  const { child } = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/agents/getConditions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "x".repeat(10 * 1024 * 1024 + 1) }),
    });
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body must not exceed 10 MiB.",
      },
    });
  } finally {
    await stopServer(child);
  }
});

test("legacy JSON extraction endpoint does not return a mock result", async () => {
  const { child } = await startServer();

  try {
    const payload = {
      orderId: "PO-2048",
      itemCode: "SKU-2048",
      customerId: "CUST-418",
      boxStyle: "RSC",
      lengthMm: 520,
      widthMm: 360,
      heightMm: 260,
      ply: 3,
      fluteProfile: "B",
      topLinerGsm: 125,
      fluteGsm: 115,
      innerLinerGsm: 125,
      linerBf: 18,
      paperType: "VIRGIN",
      paperSupplier: "SUP-A",
      inkColors: 4,
      inkCoveragePct: 52,
      quantity: 1200,
    };

    const response = await fetch(`http://127.0.0.1:${PORT}/api/agents/extractOrder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assert.equal(response.status, 503);
    const result = await response.json();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
    assert.match(result.error.message, /legacy JSON extraction endpoint is disabled/);
  } finally {
    await stopServer(child);
  }
});

test("multipart purchase-order upload accepts signed PDF, rejects malformed JPEG and never claims extraction", async () => {
  const { child } = await startServer({ USTAAD_ENABLE_LIVE_MODEL_CALLS: "false" });

  try {
    const noFile = await fetch(`http://127.0.0.1:${PORT}/orders/extract`, {
      method: "POST",
      body: new FormData(),
    });
    assert.equal(noFile.status, 400);
    assert.equal((await noFile.json()).error.code, "VALIDATION_ERROR");

    const invalidFile = new FormData();
    invalidFile.append("file", new Blob(["not a PDF"], { type: "text/plain" }), "order.txt");
    const invalid = await fetch(`http://127.0.0.1:${PORT}/orders/extract`, {
      method: "POST",
      body: invalidFile,
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "VALIDATION_ERROR");

    const spoofedPdf = new FormData();
    spoofedPdf.append("file", new Blob(["not a PDF"], { type: "application/pdf" }), "order.pdf");
    const spoofed = await fetch(`http://127.0.0.1:${PORT}/orders/extract`, {
      method: "POST",
      body: spoofedPdf,
    });
    assert.equal(spoofed.status, 400);
    const spoofedResult = await spoofed.json();
    assert.equal(spoofedResult.error.code, "VALIDATION_ERROR");
    assert.equal(spoofedResult.error.issues[0].code, "invalid_format");

    const validPdf = new FormData();
    validPdf.append("file", new Blob(["%PDF-1.4 fixture"], { type: "application/pdf" }), "order.pdf");
    const unavailable = await fetch(`http://127.0.0.1:${PORT}/orders/extract`, {
      method: "POST",
      body: validPdf,
    });
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), {
      ok: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "extractOrderForReview is not configured. Cloud Storage, Gemini and the item catalog are not configured.",
      },
    });

    const validJpeg = new FormData();
    validJpeg.append(
      "file",
      new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }),
      "scanned-order.jpg"
    );
    const jpegUnavailable = await fetch(`http://127.0.0.1:${PORT}/orders/extract`, {
      method: "POST",
      body: validJpeg,
    });
    assert.equal(jpegUnavailable.status, 400);
    assert.equal((await jpegUnavailable.json()).error.code, "VALIDATION_ERROR");
  } finally {
    await stopServer(child);
  }
});

test("job API requires an explicit confirmation for a PO-review selection", async () => {
  const { child } = await startServer();
  try {
    const form = new FormData();
    form.append("file", new Blob(["%PDF-1.4 review"], { type: "application/pdf" }), "order.pdf");
    form.append("orderId", "PO-REVIEW-001");
    form.append("paperType", "RECYCLED");
    form.append("paperSupplier", "SUPPLIER-OPERATOR-CONFIRMED");
    form.append("confirmedItemCode", "PKBX0041");
    form.append("confirmedQuantity", "1300");
    form.append("confirmedLineIndex", "1");
    form.append("reviewId", "00000000-0000-4000-8000-000000000001");
    form.append("reviewFingerprint", "a".repeat(64));
    form.append("confirmedSourceLine", "false");
    form.append("shift", "DAY");
    for (const [field, value] of Object.entries({
      sfSpeedMpm: 40,
      rollTempC: 165,
      gumApplication: "MED",
      gumViscositySec: 40,
      pastingPressure: "MED",
      dryingHours: 6,
      printSpeedSpm: 50,
    })) form.append(field, String(value));

    const response = await fetch(`http://127.0.0.1:${PORT}/jobs`, {
      method: "POST",
      body: form,
    });
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.error.code, "VALIDATION_ERROR");
    assert.equal(payload.error.issues[0].code, "confirmation_required");
    assert.equal(payload.runId, undefined);
  } finally {
    await stopServer(child);
  }
});

test("unknown routes return JSON 404 responses", async () => {
  const { child } = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/not-a-route`);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.equal((await response.json()).ok, false);
  } finally {
    await stopServer(child);
  }
});

test("risk endpoint does not present local heuristics as a production prediction", async () => {
  const { child } = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/agents/predictRisk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: {
          orderId: "PO-TEST-1",
          itemCode: "SKU-TEST-1",
          customerId: "CUSTOMER-TEST-1",
          boxStyle: "RSC",
          lengthMm: 520,
          widthMm: 360,
          heightMm: 260,
          ply: 3,
          fluteProfile: "B",
          topLinerGsm: 125,
          fluteGsm: 115,
          innerLinerGsm: 125,
          linerBf: 18,
          paperType: "VIRGIN",
          paperSupplier: "SUP-A",
          inkColors: 4,
          inkCoveragePct: 52,
          quantity: 1200,
        },
        conditions: {
          runDate: "2026-10-10",
          shift: "DAY",
          ambientRhPct: 54,
          ambientTempC: 29,
          paperMoisturePct: 9,
        },
        levers: {
          sfSpeedMpm: 42,
          rollTempC: 168,
          gumApplication: "MED",
          gumViscositySec: 40,
          pastingPressure: "MED",
          dryingHours: 6,
          printSpeedSpm: 55,
        },
      }),
    });

    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, "SERVICE_UNAVAILABLE");
  } finally {
    await stopServer(child);
  }
});

test("demo-mode smoke test covers extraction, validation, risk outputs, approval, and job-card retrieval", async () => {
  const { child } = await startServer({ USTAAD_ENABLE_DEMO_MODE: "true" });
  const order = {
    orderId: "PO-DEMO-001",
    itemCode: "SKU-TEST-42",
    customerId: "CUSTOMER-TEST-42",
    boxStyle: "RSC",
    lengthMm: 520,
    widthMm: 360,
    heightMm: 260,
    ply: 3,
    fluteProfile: "B",
    topLinerGsm: 125,
    fluteGsm: 115,
    innerLinerGsm: 125,
    linerBf: 18,
    paperType: "VIRGIN",
    paperSupplier: "SUPPLIER-TEST",
    inkColors: 2,
    inkCoveragePct: 40,
    quantity: 100,
  };
  const levers = {
    sfSpeedMpm: 40,
    rollTempC: 165,
    gumApplication: "MED",
    gumViscositySec: 40,
    pastingPressure: "MED",
    dryingHours: 6,
    printSpeedSpm: 50,
  };

  try {
    const demoPoFixture = await readFile(new URL("./fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf", import.meta.url));
    const upload = new FormData();
    upload.append("file", new Blob([demoPoFixture], { type: "application/pdf" }), "demo-order.pdf");
    upload.append("orderId", order.orderId);
    upload.append("paperType", order.paperType);
    upload.append("paperSupplier", order.paperSupplier);
    const extracted = await fetch(`http://127.0.0.1:${PORT}/orders/extract`, { method: "POST", body: upload });
    assert.equal(extracted.status, 200, "PO extraction should succeed in demo mode");
    const extractedPayload = await extracted.json();
    assert.equal(extractedPayload.ok, true);
    assert.equal(extractedPayload.source, "mock-demo");
    assert.equal(extractedPayload.reviewId && extractedPayload.reviewFingerprint ? true : false, true);

    const conditionsResponse = await fetch(`http://127.0.0.1:${PORT}/conditions/current?shift=DAY`);
    assert.equal(conditionsResponse.status, 200);
    const conditionsPayload = await conditionsResponse.json();
    assert.equal(conditionsPayload.ok, true);
    assert.equal(conditionsPayload.data.shift, "DAY");
    assert.equal(conditionsPayload.provenance.source, "simulated");
    assert.equal(conditionsPayload.provenance.freshness, "stale");
    assert.ok(conditionsPayload.provenance.ageSeconds > 86400);

    const riskResponse = await fetch(`http://127.0.0.1:${PORT}/api/agents/predictRisk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order, conditions: conditionsPayload.data, levers }),
    });
    assert.equal(riskResponse.status, 200, "risk prediction should reach demo adapter");
    const riskPayload = await riskResponse.json();
    assert.equal(riskPayload.ok, true);
    assert.deepEqual(Object.keys(riskPayload.ratesPct).sort(), ["CRACK", "DELAM", "PRINT", "STRENGTH", "WARP"].sort());

    const optimizationResponse = await fetch(`http://127.0.0.1:${PORT}/api/agents/optimizeLevers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order, conditions: conditionsPayload.data, levers }),
    });
    assert.equal(optimizationResponse.status, 200);
    const optimizationPayload = await optimizationResponse.json();
    assert.equal(optimizationPayload.ok, true);
    assert.ok(optimizationPayload.savings && Number.isFinite(optimizationPayload.savings.inr));

    const similarRunsResponse = await fetch(`http://127.0.0.1:${PORT}/api/agents/findSimilarRuns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order, conditions: conditionsPayload.data }),
    });
    assert.equal(similarRunsResponse.status, 200);
    const similarRunsPayload = await similarRunsResponse.json();
    assert.equal(similarRunsPayload.ok, true);
    assert.ok(Array.isArray(similarRunsPayload.evidence));

    const explanationResponse = await fetch(`http://127.0.0.1:${PORT}/api/agents/explainRisk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order,
        conditions: conditionsPayload.data,
        riskEvidence: { attributions: [], similarRuns: similarRunsPayload.evidence },
      }),
    });
    assert.equal(explanationResponse.status, 200);
    const explanationPayload = await explanationResponse.json();
    assert.equal(explanationPayload.ok, true);
    assert.match(explanationPayload.explanation, /Local mock demo mode/i);

    const jobForm = new FormData();
    jobForm.append("file", new Blob([demoPoFixture], { type: "application/pdf" }), "demo-order.pdf");
    jobForm.append("orderId", order.orderId);
    jobForm.append("paperType", order.paperType);
    jobForm.append("paperSupplier", order.paperSupplier);
    jobForm.append("confirmedItemCode", order.itemCode);
    jobForm.append("confirmedQuantity", String(order.quantity));
    jobForm.append("confirmedLineIndex", "1");
    jobForm.append("reviewId", extractedPayload.reviewId);
    jobForm.append("reviewFingerprint", extractedPayload.reviewFingerprint);
    jobForm.append("confirmedSourceLine", "true");
    jobForm.append("shift", "DAY");
    jobForm.append("runDate", "2026-10-15");
    jobForm.append("ambientRhPct", "64");
    jobForm.append("ambientTempC", "26");
    jobForm.append("paperMoisturePct", "8.5");
    jobForm.append("conditionsConfirmed", "true");
    for (const [field, value] of Object.entries(levers)) {
      jobForm.append(field, String(value));
    }
    const jobResponse = await fetch(`http://127.0.0.1:${PORT}/jobs`, { method: "POST", body: jobForm });
    const jobPayload = await jobResponse.json();
    assert.equal(jobResponse.status, 200, `job creation should complete in demo mode: ${JSON.stringify(jobPayload)}`);
    const jobId = jobPayload?.jobSheet?.jobId ?? jobPayload?.jobId;
    assert.ok(jobId, "job creation should return a stored job ID");
    assert.equal(jobPayload.jobSheet?.order?.orderId ?? jobPayload.order?.orderId, order.orderId);
    assert.equal(jobPayload.jobSheet?.conditions?.conditionSource, "manual-entry");
    assert.equal(jobPayload.jobSheet?.conditions?.supervisorConfirmed, true);

    const approveResponse = await fetch(`http://127.0.0.1:${PORT}/jobs/${jobId}/approve?lang=en&currency=INR`, { method: "POST" });
    assert.equal(approveResponse.status, 200, "job approval should work in demo mode");
    const approvalPayload = await approveResponse.json();
    assert.equal(approvalPayload.jobSheet.status, "APPROVED");

    const cardResponse = await fetch(`http://127.0.0.1:${PORT}/jobs/${jobId}/card.pdf?lang=en&currency=INR`);
    assert.equal(cardResponse.status, 200, "job card should be renderable");
    assert.match(cardResponse.headers.get("content-type") || "", /application\/pdf|application\/octet-stream/);

    const readBackResponse = await fetch(`http://127.0.0.1:${PORT}/jobs/${jobId}`);
    assert.equal(readBackResponse.status, 200, "stored job sheet should be readable independently");
    const readBackPayload = await readBackResponse.json();
    assert.equal(readBackPayload.jobSheet?.jobId ?? readBackPayload.jobId, jobId);
    assert.equal(readBackPayload.jobSheet?.status ?? readBackPayload.status, "APPROVED");
  } finally {
    await stopServer(child);
  }
});

test("Day 2 mock analysis routes remain unavailable outside explicit demo mode", async () => {
  const { child } = await startServer();
  const order = {
    orderId: "PO-TEST-DAY2",
    itemCode: "SKU-TEST-DAY2",
    customerId: "CUSTOMER-TEST-DAY2",
    boxStyle: "RSC",
    lengthMm: 520,
    widthMm: 360,
    heightMm: 260,
    ply: 3,
    fluteProfile: "B",
    topLinerGsm: 125,
    fluteGsm: 115,
    innerLinerGsm: 125,
    linerBf: 18,
    paperType: "VIRGIN",
    paperSupplier: "SUP-TEST",
    inkColors: 2,
    inkCoveragePct: 40,
    quantity: 100,
  };
  const conditions = {
    runDate: "2026-10-11",
    shift: "DAY",
    ambientRhPct: 50,
    ambientTempC: 28,
    paperMoisturePct: 9,
  };
  const endpoints = [
    ["/api/agents/optimizeLevers", { order, conditions }],
    ["/api/agents/findSimilarRuns", { order, conditions }],
    ["/api/agents/explainRisk", { order, conditions, riskEvidence: { attributions: [], similarRuns: [] } }],
    ["/api/agents/generateJobSheet", { order, conditions, analysis: { risk: {}, optimization: {}, evidence: [] } }],
  ];

  try {
    for (const [endpoint, body] of endpoints) {
      const valid = await fetch(`http://127.0.0.1:${PORT}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(valid.status, 503, endpoint);
      const unavailable = await valid.json();
      assert.equal(unavailable.ok, false, endpoint);
      assert.equal(unavailable.error.code, "SERVICE_UNAVAILABLE", endpoint);
      assert.doesNotMatch(JSON.stringify(unavailable), /savings|riskRates|recommended|attributions/i);

      const invalid = await fetch(`http://127.0.0.1:${PORT}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: { ...order, quantity: 0 }, conditions }),
      });
      assert.equal(invalid.status, 503, endpoint);
      const failure = await invalid.json();
      assert.equal(failure.ok, false, endpoint);
      assert.equal(failure.error.code, "SERVICE_UNAVAILABLE", endpoint);
    }
  } finally {
    await stopServer(child);
  }
});

test("documented Part 2 routes validate requests and expose unconfigured integrations", async () => {
  const { child } = await startServer();

  try {
    const validRisk = await fetch(`http://127.0.0.1:${PORT}/risk/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: { itemCode: "PKBX0041", quantity: 1300, paperType: "RECYCLED", paperSupplier: "SUP-D" },
        conditions: { shift: "DAY", ambientRhPct: 86, ambientTempC: 26, paperMoisturePct: 10.8 },
        conditionsConfirmed: true,
        levers: { sfSpeedMpm: 48, rollTempC: 162, gumApplication: "HIGH", gumViscositySec: 32,
          pastingPressure: "MED", dryingHours: 5, printSpeedSpm: 60 },
      }),
    });
    assert.equal(validRisk.status, 503, "valid contract should reach the configured-service boundary");
    assert.equal((await validRisk.json()).error.code, "SERVICE_UNAVAILABLE");

    const unconfirmedRisk = await fetch(`http://127.0.0.1:${PORT}/risk/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: { itemCode: "PKBX0041", quantity: 1300, paperType: "RECYCLED", paperSupplier: "SUP-D" },
        conditions: { shift: "DAY", ambientRhPct: 86, ambientTempC: 26, paperMoisturePct: 10.8 },
        levers: { sfSpeedMpm: 48, rollTempC: 162, gumApplication: "HIGH", gumViscositySec: 32,
          pastingPressure: "MED", dryingHours: 5, printSpeedSpm: 60 },
      }),
    });
    assert.equal(unconfirmedRisk.status, 400);
    assert.equal((await unconfirmedRisk.json()).error.code, "VALIDATION_ERROR");

    const invalidRisk = await fetch(`http://127.0.0.1:${PORT}/risk/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: { orderId: "PO-TEST-1" } }),
    });
    assert.equal(invalidRisk.status, 400);
    const invalidPayload = await invalidRisk.json();
    assert.equal(invalidPayload.error.code, "VALIDATION_ERROR");
    assert.ok(invalidPayload.error.issues.length > 0);

    const orderUpload = new FormData();
    orderUpload.append(
      "file",
      new Blob(["%PDF-1.4 test fixture"], { type: "application/pdf" }),
      "purchase-order.pdf"
    );
    const extraction = await fetch(`http://127.0.0.1:${PORT}/orders/extract`, {
      method: "POST",
      body: orderUpload,
    });
    const extractionPayload = await extraction.json();
    if (extraction.status !== 503) {
      throw new Error(JSON.stringify(extractionPayload));
    }
    assert.equal(extraction.status, 503, JSON.stringify(extractionPayload));
    assert.equal(extractionPayload.error.code, "SERVICE_UNAVAILABLE");

    const conditions = await fetch(`http://127.0.0.1:${PORT}/conditions/current?shift=DAY`);
    assert.equal(conditions.status, 503);
    assert.equal((await conditions.json()).error.code, "SERVICE_UNAVAILABLE");

    const missingShift = await fetch(`http://127.0.0.1:${PORT}/conditions/current`);
    assert.equal(missingShift.status, 400);
    assert.equal((await missingShift.json()).error.code, "VALIDATION_ERROR");

    const invalidShift = await fetch(`http://127.0.0.1:${PORT}/conditions/current?shift=SWING`);
    assert.equal(invalidShift.status, 400);
    assert.equal((await invalidShift.json()).error.code, "VALIDATION_ERROR");

    const invalidLocale = await fetch(`http://127.0.0.1:${PORT}/conditions/current?lang=fr`);
    assert.equal(invalidLocale.status, 400);
    assert.equal((await invalidLocale.json()).error.code, "VALIDATION_ERROR");

    const unsupportedFxBase = await fetch(`http://127.0.0.1:${PORT}/fx?base=VND`);
    assert.equal(unsupportedFxBase.status, 400);
    assert.equal((await unsupportedFxBase.json()).error.code, "VALIDATION_ERROR");

    const invalidInsightsRange = await fetch(
      `http://127.0.0.1:${PORT}/insights/summary?from=2026-10-11&to=2026-10-10`
    );
    assert.equal(invalidInsightsRange.status, 400);
    assert.equal((await invalidInsightsRange.json()).error.code, "VALIDATION_ERROR");
  } finally {
    await stopServer(child);
  }
});

test("job lifecycle routes do not imply persistence or approval while cloud services are absent", async () => {
  const { child } = await startServer();

  try {
    const unconfirmedForm = new FormData();
    unconfirmedForm.append(
      "file",
      new Blob(["%PDF-1.4 test fixture"], { type: "application/pdf" }),
      "purchase-order.pdf"
    );
    unconfirmedForm.append("orderId", "PO-SYNTHETIC-001");
    unconfirmedForm.append("paperType", "RECYCLED");
    unconfirmedForm.append("paperSupplier", "SUPPLIER-SYNTHETIC");
    unconfirmedForm.append("shift", "DAY");
    unconfirmedForm.append("sfSpeedMpm", "40");
    unconfirmedForm.append("rollTempC", "165");
    unconfirmedForm.append("gumApplication", "MED");
    unconfirmedForm.append("gumViscositySec", "40");
    unconfirmedForm.append("pastingPressure", "MED");
    unconfirmedForm.append("dryingHours", "6");
    unconfirmedForm.append("printSpeedSpm", "50");
    const unconfirmed = await fetch(`http://127.0.0.1:${PORT}/jobs`, {
      method: "POST",
      body: unconfirmedForm,
    });
    assert.equal(unconfirmed.status, 400);
    assert.equal((await unconfirmed.json()).error.code, "VALIDATION_ERROR");

    const createForm = new FormData();
    createForm.append(
      "file",
      new Blob(["%PDF-1.4 test fixture"], { type: "application/pdf" }),
      "purchase-order.pdf"
    );
    createForm.append("orderId", "PO-SYNTHETIC-001");
    createForm.append("paperType", "RECYCLED");
    createForm.append("paperSupplier", "SUPPLIER-SYNTHETIC");
    createForm.append("confirmedItemCode", "PKBX0041");
    createForm.append("confirmedQuantity", "1300");
    createForm.append("shift", "DAY");
    createForm.append("runDate", "2026-10-15");
    createForm.append("ambientRhPct", "64");
    createForm.append("ambientTempC", "26");
    createForm.append("paperMoisturePct", "8.5");
    createForm.append("conditionsConfirmed", "true");
    createForm.append("sfSpeedMpm", "40");
    createForm.append("rollTempC", "165");
    createForm.append("gumApplication", "MED");
    createForm.append("gumViscositySec", "40");
    createForm.append("pastingPressure", "MED");
    createForm.append("dryingHours", "6");
    createForm.append("printSpeedSpm", "50");
    const created = await fetch(`http://127.0.0.1:${PORT}/jobs`, {
      method: "POST",
      body: createForm,
    });
    assert.equal(created.status, 503);
    const creationResult = await created.json();
    assert.equal(creationResult.error.code, "SERVICE_UNAVAILABLE");
    assert.match(creationResult.error.message, /Durable JobSheet persistence is not configured/);
    assert.equal(creationResult.durable, undefined);
    assert.equal(creationResult.jobSheet, undefined);

    // Malformed Idempotency-Key header (contains a space) must return 400.
    const malformedKeyForm = new FormData();
    malformedKeyForm.append(
      "file",
      new Blob(["%PDF-1.4 test fixture"], { type: "application/pdf" }),
      "purchase-order.pdf"
    );
    malformedKeyForm.append("orderId", "PO-SYNTHETIC-001");
    malformedKeyForm.append("paperType", "RECYCLED");
    malformedKeyForm.append("paperSupplier", "SUPPLIER-SYNTHETIC");
    malformedKeyForm.append("confirmedItemCode", "PKBX0041");
    malformedKeyForm.append("confirmedQuantity", "1300");
    malformedKeyForm.append("shift", "DAY");
    malformedKeyForm.append("sfSpeedMpm", "40");
    malformedKeyForm.append("rollTempC", "165");
    malformedKeyForm.append("gumApplication", "MED");
    malformedKeyForm.append("gumViscositySec", "40");
    malformedKeyForm.append("pastingPressure", "MED");
    malformedKeyForm.append("dryingHours", "6");
    malformedKeyForm.append("printSpeedSpm", "50");
    const badKeyResponse = await fetch(`http://127.0.0.1:${PORT}/jobs`, {
      method: "POST",
      headers: { "Idempotency-Key": "invalid key with spaces" },
      body: malformedKeyForm,
    });
    assert.equal(badKeyResponse.status, 400, "malformed Idempotency-Key must be rejected before reaching the coordinator");
    const badKeyResult = await badKeyResponse.json();
    assert.equal(badKeyResult.error.code, "VALIDATION_ERROR");

    const approved = await fetch(`http://127.0.0.1:${PORT}/jobs/JC-TEST/approve`, {
      method: "POST",
    });
    assert.equal(approved.status, 503);
    assert.equal((await approved.json()).error.code, "SERVICE_UNAVAILABLE");

    const invalidFeedbackPayloads = [
      { jobId: "JC-TEST" },
      { jobId: "JC-TEST", rateWarpPct: 25.01 },
      { jobId: "OTHER-JOB", rateWarpPct: 1 },
    ];
    for (const payload of invalidFeedbackPayloads) {
      const invalidFeedback = await fetch(`http://127.0.0.1:${PORT}/jobs/JC-TEST/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      assert.equal(invalidFeedback.status, 400);
      const result = await invalidFeedback.json();
      assert.equal(result.error.code, "VALIDATION_ERROR");
      assert.ok(result.error.issues.length > 0);
    }

    const feedback = await fetch(`http://127.0.0.1:${PORT}/jobs/JC-TEST/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: "JC-TEST", rateWarpPct: 1 }),
    });
    assert.equal(feedback.status, 503);
    assert.equal((await feedback.json()).error.code, "SERVICE_UNAVAILABLE");

    for (const rateWarpPct of [0, 25]) {
      const boundaryFeedback = await fetch(`http://127.0.0.1:${PORT}/jobs/JC-TEST/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: "JC-TEST", rateWarpPct }),
      });
      assert.equal(boundaryFeedback.status, 503);
      assert.equal((await boundaryFeedback.json()).error.code, "SERVICE_UNAVAILABLE");
    }

    const card = await fetch(`http://127.0.0.1:${PORT}/jobs/JC-TEST/card.pdf`);
    assert.equal(card.status, 503);
    assert.equal((await card.json()).error.code, "SERVICE_UNAVAILABLE");

    const stored = await fetch(`http://127.0.0.1:${PORT}/jobs/JC-TEST`);
    assert.equal(stored.status, 503);
    assert.equal((await stored.json()).error.code, "SERVICE_UNAVAILABLE");

    const blankJobId = await fetch(`http://127.0.0.1:${PORT}/jobs/%20`);
    assert.equal(blankJobId.status, 400);
    assert.equal((await blankJobId.json()).error.code, "VALIDATION_ERROR");

    for (const path of ["/jobs", "/jobs/JC-TEST/reject"]) {
      const response = await fetch(`http://127.0.0.1:${PORT}${path}`, {
        method: path.endsWith("/reject") ? "POST" : "GET",
      });
      assert.equal(response.status, 404, `${path} is not part of the current API`);
    }
  } finally {
    await stopServer(child);
  }
});
