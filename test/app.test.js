import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import test from "node:test";
import { jobSheetFixture } from "./fixtures/job-sheet.js";

const PORT = 4100;

async function startServer() {
  const child = spawn(process.execPath, ["index.mjs"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, PORT: String(PORT) },
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
    assert.match(startupMessage, /http:\/\/localhost:/i);
  } finally {
    child.kill("SIGTERM");
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
    child.kill("SIGTERM");
  }
});

test("root URL serves the local operator UI", async () => {
  const { child } = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const html = await response.text();
    assert.match(html, /Ustaad AI/);
    assert.match(html, /Local development/);
    assert.match(html, /Language preference/);
    assert.match(html, /Static translations cover ordinary interface labels only/);
    for (const language of ["en", "hi", "mr", "ja", "ko", "zh-CN", "id"]) {
      assert.match(html, new RegExp(`<option value="${language}">`));
    }
    for (const currency of ["INR", "JPY", "KRW", "CNY", "IDR", "SGD", "AUD", "THB", "PHP", "MYR", "USD"]) {
      assert.match(html, new RegExp(`<option value="${currency}">${currency}</option>`));
    }
    assert.match(html, /Display-only currency conversion/);
    assert.match(html, /t\("rateDateLabel"\)/);
    assert.match(html, /does not update application data/);
    assert.match(html, /import \{ formatDisplayCurrency \} from "\/display-currency\.js"/);
    assert.match(html, /Purchase-order PDF/);
    assert.match(html, /Current conditions/);
    assert.match(html, /Risk prediction/);
    assert.match(html, /Optimization and evidence/);
    assert.match(html, /Render a supplied JobSheet PDF/);
    assert.match(html, /Agent traces, job creation, approval, stored job cards and feedback are also unavailable/);
    assert.match(html, /t\("requestFailed"\)/);
    assert.match(html, /aria-busy/);
    assert.match(html, /<link rel="stylesheet" href="\/operator-ui\.css"/);
    assert.match(html, /class="app-shell" data-sidebar-collapsed="false"/);
    assert.match(html, /id="sidebar-toggle"[\s\S]*?aria-expanded="true"/);
    assert.match(html, /aria-label="Primary navigation"/);
    assert.match(html, /data-sidebar-link data-screen-link data-tooltip="Screen 1 — Order input" aria-label="Screen 1 — Order input"/);
    const sidebarLinks = [...html.matchAll(/<a class="sidebar__link"[\s\S]*?<\/a>/g)];
    assert.equal(sidebarLinks.length, 3);
    assert.deepEqual(
      sidebarLinks.map(([link]) => link.match(/href="#([^"]+)"/)?.[1]),
      ["screen-order-input", "screen-production-analysis", "screen-job-card-approval"]
    );
    for (const [link] of sidebarLinks) {
      assert.match(link, /<svg class="icon" viewBox="0 0 24 24"/);
      assert.match(link, /<span class="sidebar__label">Screen [123] — /);
    }
    assert.match(html, /appShell\.dataset\.sidebarCollapsed = String\(collapsed\)/);
    assert.equal((html.match(/<section class="screen"[^>]*data-screen-panel/g) || []).length, 3);
    assert.match(html, /id="screen-order-input"[\s\S]*?Screen 1 — Order input/);
    assert.match(html, /id="screen-production-analysis"[\s\S]*?Screen 2 — Production analysis/);
    assert.match(html, /id="screen-job-card-approval"[\s\S]*?Screen 3 — Job card and approval/);
    assert.match(html, /Production preparation workflow/);
    assert.match(html, /Current stage: purchase-order input required/);
    assert.equal((html.match(/data-workflow-stage=/g) || []).length, 5);
    assert.match(html, /Agent execution trace/);
    assert.match(html, /Workflow printing unavailable/);
    assert.match(html, /href="#order-pdf" data-i18n="goToPdf"/);
    assert.match(html, /Clarification required before prediction/);
    assert.match(html, /id="clarification-form"/);
    assert.match(html, /id="trace-form"/);
    assert.match(html, /Similar historical runs/);
    assert.match(html, /Model-grounded explanations/);
    assert.match(html, /What-if re-scoring/);
    assert.match(html, /id="approval-form"/);
    assert.match(html, /Reject unavailable/);
    assert.match(html, /WARP, DELAM, STRENGTH, PRINT and CRACK/);
    assert.match(html, /id="feedback-form"/);
    assert.doesNotMatch(html, /\/api\/agents\/findSimilarRuns|\/api\/agents\/explainRisk|\/api\/agents\/generateJobSheet/);
    assert.match(html, /url: "\/jobs"/);
    assert.match(html, /\/jobs\/" \+ encodeURIComponent\(jobId\) \+ "\/approve/);
    assert.match(html, /\/card\.pdf\?lang=/);
    assert.match(html, /\/feedback/);
    assert.match(html, /data-i18n="localRenderer">Open local renderer \(not workflow printing\)/);
    assert.match(html, /id="trace-run-id"/);
    assert.match(html, /EventSource\("\/api\/runs\/"/);
    assert.match(html, /"run\.completed": \{ message: "traceCompleted", state: "success" \}/);
    assert.match(html, /"run\.failed": \{ message: "traceFailed", state: "error" \}/);
    assert.match(html, /"run\.cancelled": \{ message: "traceCancelled", state: "incomplete" \}/);
    assert.match(html, /data-i18n="workflow"/);
    assert.match(html, /class="dropzone" id="order-dropzone"/);
    assert.match(html, /id="order-pdf" class="dropzone__input"[^>]*accept="application\/pdf,\.pdf"/);
    assert.match(html, /id="selected-file-name"/);
    assert.match(html, /new DataTransfer\(\)/);
    assert.match(html, /id="request-risk"/);
    assert.match(html, /id="request-optimization"/);
    assert.match(html, /name="orderId"/);
    assert.match(html, /name="ambientRhPct"/);
    assert.match(html, /name="sfSpeedMpm"/);
    assert.match(html, /body: JSON\.stringify\(payload\)/);
    assert.match(html, /id="risk-metrics"/);
    assert.match(html, /id="optimization-changes"/);
    assert.match(html, /Raw status response/);
    assert.match(html, /class="timeline"/);
    assert.match(html, /Approval unavailable/);
    assert.match(html, /Stored card unavailable/);
    assert.match(html, /id="shared-job-id"/);
    assert.match(html, /id="local-job-sheet-preview"/);
    assert.doesNotMatch(html, /data-json-post="\/api\/agents\/extractOrder"/);
    assert.doesNotMatch(html, /id="order-json"/);
    assert.doesNotMatch(html, /PO-2048|CUST-418|value="1200"/);
    assert.match(html, /aria-live="polite"/);

    const stylesheet = await fetch(`http://127.0.0.1:${PORT}/operator-ui.css`);
    assert.equal(stylesheet.status, 200);
    assert.match(stylesheet.headers.get("content-type"), /text\/css/);
    const css = await stylesheet.text();
    assert.match(css, /--color-accent:/);
    assert.match(css, /\.link-button\[hidden\]\s*\{\s*display:\s*none;\s*\}/);
    assert.match(css, /\.app-shell\[data-sidebar-collapsed="true"\]/);
    assert.match(css, /prefers-reduced-motion/);

    const clientModule = await fetch(`http://127.0.0.1:${PORT}/display-currency.js`);
    assert.equal(clientModule.status, 200);
    assert.match(clientModule.headers.get("content-type"), /text\/javascript/);
    assert.match(await clientModule.text(), /export function formatDisplayCurrency/);

    const localization = await fetch(`http://127.0.0.1:${PORT}/localization.js`);
    assert.equal(localization.status, 200);
    assert.match(localization.headers.get("content-type"), /text\/javascript/);
    assert.match(await localization.text(), /export function translate/);
    for (const language of ["en", "hi", "mr", "ja", "ko", "zh-CN", "id"]) {
      const localeResponse = await fetch(`http://127.0.0.1:${PORT}/locales/${language}.json`);
      assert.equal(localeResponse.status, 200);
      assert.match(localeResponse.headers.get("content-type"), /application\/json/);
      assert.equal(typeof (await localeResponse.json()).workflow, "string");
    }
    const unsupportedLocale = await fetch(`http://127.0.0.1:${PORT}/locales/fr.json`);
    assert.equal(unsupportedLocale.status, 404);

    const moneyContracts = await fetch(`http://127.0.0.1:${PORT}/money-contracts.js`);
    assert.equal(moneyContracts.status, 200);
    assert.match(moneyContracts.headers.get("content-type"), /text\/javascript/);
    assert.match(await moneyContracts.text(), /getDisplayableProductionAmounts/);
  } finally {
    child.kill("SIGTERM");
  }
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
    assert.equal(unicode.status, 200);
    assert.match(unicode.headers.get("content-type"), /application\/pdf/);
    const unicodePdf = Buffer.from(await unicode.arrayBuffer());
    assert.equal(unicodePdf.subarray(0, 8).toString("ascii"), "%PDF-1.3");
    assert.ok(unicodePdf.toString("latin1").includes("NotoSansDevanagari"));
  } finally {
    child.kill("SIGTERM");
  }
});

test("status endpoint documents local mock mode", async () => {
  const { child } = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/status`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.app, "Ustaad AI");
    assert.equal(payload.mode, "local-development");
    assert.equal(payload.isRealModelPrediction, false);
  } finally {
    child.kill("SIGTERM");
  }
});

test("malformed and non-object JSON return structured validation errors", async () => {
  const { child } = await startServer();

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
    child.kill("SIGTERM");
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
    child.kill("SIGTERM");
  }
});

test("extract order endpoint validates and returns mock payload", async () => {
  const { child } = await startServer();

  try {
    const payload = {
      orderId: "PO-2048",
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

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.ok, true);
    assert.equal(result.agent, "extractOrder");
    assert.equal(result.source, "mock-demo");
    assert.equal(result.isRealModelPrediction, false);
  } finally {
    child.kill("SIGTERM");
  }
});

test("multipart order upload requires a PDF file and never claims extraction", async () => {
  const { child } = await startServer();

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
    assert.equal(spoofedResult.error.issues[0].code, "invalid_pdf");

    const validPdf = new FormData();
    validPdf.append("file", new Blob(["%PDF-1.4 fixture"], { type: "application/pdf" }), "order.pdf");
    const unavailable = await fetch(`http://127.0.0.1:${PORT}/orders/extract`, {
      method: "POST",
      body: validPdf,
    });
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).error.code, "SERVICE_UNAVAILABLE");
  } finally {
    child.kill("SIGTERM");
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
    child.kill("SIGTERM");
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
    child.kill("SIGTERM");
  }
});

test("documented Part 2 routes validate requests and expose unconfigured integrations", async () => {
  const { child } = await startServer();

  try {
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
    child.kill("SIGTERM");
  }
});

test("job lifecycle routes do not imply persistence or approval while cloud services are absent", async () => {
  const { child } = await startServer();

  try {
    const createForm = new FormData();
    createForm.append(
      "file",
      new Blob(["%PDF-1.4 test fixture"], { type: "application/pdf" }),
      "purchase-order.pdf"
    );
    const created = await fetch(`http://127.0.0.1:${PORT}/jobs`, {
      method: "POST",
      body: createForm,
    });
    assert.equal(created.status, 503);
    assert.equal((await created.json()).error.code, "SERVICE_UNAVAILABLE");

    const approved = await fetch(`http://127.0.0.1:${PORT}/jobs/JC-TEST/approve`, {
      method: "POST",
    });
    assert.equal(approved.status, 503);
    assert.equal((await approved.json()).error.code, "SERVICE_UNAVAILABLE");

    const feedback = await fetch(`http://127.0.0.1:${PORT}/jobs/JC-TEST/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: "JC-TEST", rateWarpPct: 1 }),
    });
    assert.equal(feedback.status, 503);
    assert.equal((await feedback.json()).error.code, "SERVICE_UNAVAILABLE");

    const card = await fetch(`http://127.0.0.1:${PORT}/jobs/JC-TEST/card.pdf`);
    assert.equal(card.status, 503);
    assert.equal((await card.json()).error.code, "SERVICE_UNAVAILABLE");

    for (const path of ["/jobs", "/jobs/JC-TEST", "/jobs/JC-TEST/reject"]) {
      const response = await fetch(`http://127.0.0.1:${PORT}${path}`, {
        method: path.endsWith("/reject") ? "POST" : "GET",
      });
      assert.equal(response.status, 404, `${path} is not part of the current API`);
    }
  } finally {
    child.kill("SIGTERM");
  }
});
