import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { jobSheetFixture } from "./fixtures/job-sheet.js";

const PORT = 4100;

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
    child.kill("SIGTERM");
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
    child.kill("SIGTERM");
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
    child.kill("SIGTERM");
  }
});

test("Impact dashboard is served from the application origin and fails without showing preview estimates", async () => {
  const { child } = await startServer();
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/impact`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const html = await response.text();
    assert.match(html, /fetch\("\/impact\/summary"/);
    assert.match(html, /no sample values are shown/);
    assert.doesNotMatch(html, /Showing the verified BigQuery results/);
  } finally {
    child.kill("SIGTERM");
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
    child.kill("SIGTERM");
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
    assert.match((await explanationUnavailable.json()).error.message, /explainRisk is not configured/);
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
    assert.match(html, /Prototype with synthetic data/);
    assert.match(html, /Local development/);
    assert.match(html, /const API_BASE_URL = window\.location\.origin;/);
    assert.match(html, /fetch\(apiUrl\(url\), options\)/);
    assert.match(html, /new EventSource\(apiUrl\(/);
    assert.match(html, /id="backend-availability"/);
    assert.match(html, /id="production-adapters-availability"/);
    assert.match(html, /id="model-calls-availability"/);
    assert.match(html, /Model output is not accepted against the required R² threshold and current model versions/);
    assert.match(html, /id="current-conditions-availability"/);
    assert.match(html, /id="job-persistence-availability"/);
    assert.match(html, /id="runtime-mode-sidebar"/);
    assert.match(html, /id="runtime-mode-header"/);
    assert.match(html, /status\.mode === "cloud-run" \? "Cloud Run" : "Local development"/);
    assert.doesNotMatch(html, /https:\/\/prepagent-26mwt2n7ba-el\.a\.run\.app/);
    assert.match(html, /Language preference/);
    assert.match(html, /English-only prototype\. No glossary dependency is required/);
    assert.match(html, /<option value="en">/);
    assert.doesNotMatch(html, /<option value="(hi|mr|ja|ko|zh-CN|id)">/);
    for (const currency of ["INR", "JPY", "KRW", "CNY", "IDR", "SGD", "AUD", "THB", "PHP", "MYR", "USD"]) {
      assert.match(html, new RegExp(`<option value="${currency}">${currency}</option>`));
    }
    assert.match(html, /Display-only currency conversion/);
    assert.match(html, /t\("rateDateLabel"\)/);
    assert.match(html, /does not update application data/);
    assert.match(html, /import \{ formatDisplayCurrency \} from "\/display-currency\.js"/);
    assert.match(html, /Purchase-order document/);
    assert.match(html, /data-i18n="itemCodeField">Item code/);
    assert.match(html, /id="analysis-lengthMm" name="lengthMm" type="number" min="20" max="1500"/);
    assert.match(html, /id="analysis-widthMm" name="widthMm" type="number" min="20" max="1500"/);
    assert.match(html, /id="analysis-heightMm" name="heightMm" type="number" min="0" max="1500"/);
    assert.match(html, /Current conditions/);
    assert.match(html, /analysis-shift/);
    assert.match(html, /if \(url === "\/conditions\/current"\)[\s\S]*?url \+= "\?shift="/);
    assert.match(html, /selectShift/);
    assert.match(html, /Risk prediction/);
    assert.match(html, /Optimization and evidence/);
    assert.match(html, /Render a supplied JobSheet PDF/);
    assert.match(html, /same-origin backend validates the file, but no extraction adapter is configured/);
    assert.match(html, /t\("requestFailed"\)/);
    assert.match(html, /aria-busy/);
    assert.match(html, /<link rel="stylesheet" href="\/operator-ui\.css"/);
    assert.match(html, /class="app-shell" data-sidebar-collapsed="false"/);
    assert.match(html, /id="sidebar-toggle"[\s\S]*?aria-expanded="true"/);
    assert.match(html, /aria-label="Primary navigation"/);
    assert.match(html, /data-sidebar-link data-screen-link data-tooltip="Screen 1 — Order input" aria-label="Screen 1 — Order input"/);
    const sidebarLinks = [...html.matchAll(/<a class="sidebar__link"[\s\S]*?<\/a>/g)];
    assert.equal(sidebarLinks.length, 4);
    assert.deepEqual(
      sidebarLinks.map(([link]) => link.match(/href="#([^"]+)"/)?.[1]),
      ["screen-order-input", "screen-production-analysis", "screen-job-card-approval", "screen-impact"]
    );
    for (const [link] of sidebarLinks) {
      assert.match(link, /<svg class="icon" viewBox="0 0 24 24"/);
      assert.match(link, /<span class="sidebar__label">Screen [1234] — /);
    }
    assert.match(html, /appShell\.dataset\.sidebarCollapsed = String\(collapsed\)/);
    assert.match(html, /candidate\.classList\.toggle\("is-active", candidate === panel\)/);
    assert.equal((html.match(/<section class="screen"[^>]*data-screen-panel/g) || []).length, 4);
    assert.match(html, /id="screen-order-input"[\s\S]*?Screen 1 — Order input/);
    assert.match(html, /id="screen-production-analysis"[\s\S]*?Screen 2 — Production analysis/);
    assert.match(html, /id="screen-job-card-approval"[\s\S]*?Screen 3 — Job card and approval/);
    assert.match(html, /id="screen-impact"[\s\S]*?Screen 4 — Impact evidence/);
    assert.match(html, /id="load-impact"[^>]*disabled/);
    assert.match(html, /\/impact\/summary/);
    assert.match(html, /not measured production outcomes, factory savings, or evidence of causation/);
    assert.match(html, /not verified real-world factory outcomes/);
    assert.match(html, /No preview or sample values are displayed/);
    assert.match(html, /Cached successful BigQuery response \(cache lifetime: at most one hour\)/);
    assert.match(html, /Production preparation workflow/);
    assert.match(html, /Current stage: purchase-order input required/);
    assert.equal((html.match(/data-workflow-stage=/g) || []).length, 5);
    assert.match(html, /Agent execution trace/);
    assert.match(html, /Workflow printing unavailable/);
    assert.match(html, /href="#order-pdf" data-i18n="goToPdf"/);
    assert.match(html, /Enter the confirmed order context and choose its source document before extraction/);
    assert.match(html, /id="purchase-order-review"/);
    assert.match(html, /id="purchase-order-lines"/);
    assert.doesNotMatch(html, /data-json-post="\/orders\/extract"/);
    assert.match(html, /id="trace-form"/);
    assert.match(html, /Similar historical runs/);
    assert.match(html, /Model-grounded explanations/);
    assert.match(html, /id="load-similar-runs"/);
    assert.match(html, /id="request-risk-explanation"/);
    assert.match(html, /\/risk\/similar-runs/);
    assert.match(html, /\/risk\/explanation/);
    assert.match(html, /url: "\/risk\/similar-runs"[\s\S]*?method: "POST"/);
    assert.match(html, /url: "\/risk\/explanation"[\s\S]*?method: "POST"/);
    assert.match(html, /OFFLINE TEST ADAPTER — these test observations are not production history/);
    assert.match(html, /latestSimilarRunsSource === "bigquery"/);
    assert.match(html, /What-if re-scoring/);
    assert.match(html, /id="approval-form"/);
    assert.match(html, /Reject unavailable/);
    assert.match(html, /WARP, DELAM, STRENGTH, PRINT and CRACK/);
    assert.match(html, /id="feedback-form"/);
    assert.match(
      html,
      /<form id="feedback-form"[\s\S]*?<button type="submit" disabled data-i18n="submitFeedback" aria-describedby="feedback-result">Feedback unavailable<\/button>/
    );
    assert.match(html, /id="what-if-controls" disabled hidden/);
    assert.match(html, /id="what-if-value" type="range"/);
    assert.match(html, /The model re-scores once when you release the slider/);
    assert.match(html, /document\.querySelectorAll\("\[data-json-get\]"\)\.forEach\([\s\S]*?\n      \}\);\s+document\.getElementById\("load-impact"\)\.addEventListener/);
    assert.match(html, /url: "\/impact\/summary"[\s\S]*?onSuccess: renderImpactSummary/);
    assert.match(html, /import \{ toRiskPredictionPayload \} from "\/risk-ui\.js"/);
    assert.match(html, /scenario\.levers\[document\.getElementById\("what-if-lever"\)\.value\] = Number/);
    const riskUiModule = await fetch(`http://127.0.0.1:${PORT}/risk-ui.js`);
    assert.equal(riskUiModule.status, 200);
    assert.match(riskUiModule.headers.get("content-type"), /text\/javascript/);
    assert.match(await riskUiModule.text(), /export function toRiskPredictionPayload/);
    assert.doesNotMatch(html, /\/api\/agents\/findSimilarRuns|\/api\/agents\/explainRisk|\/api\/agents\/generateJobSheet/);
    assert.match(html, /url: "\/jobs"/);
    assert.match(html, /\/jobs\/" \+ encodeURIComponent\(jobId\) \+ "\/approve\?lang=/);
    assert.match(html, /\/card\.pdf\?lang=/);
    assert.match(html, /\/feedback/);
    assert.match(html, /data-i18n="localRenderer">Open local renderer \(not workflow printing\)/);
    assert.match(html, /id="trace-run-id"/);
    assert.match(html, /new EventSource\(apiUrl\("\/api\/runs\/"/);
    assert.match(html, /"run\.completed": \{ message: "traceCompleted", state: "success" \}/);
    assert.match(html, /"run\.failed": \{ message: "traceFailed", state: "error" \}/);
    assert.match(html, /"run\.cancelled": \{ message: "traceCancelled", state: "incomplete" \}/);
    assert.match(html, /data-i18n="workflow"/);
    assert.match(html, /class="dropzone dropzone--compact" id="order-dropzone"/);
    assert.match(html, /id="order-pdf" class="dropzone__input"[^>]*accept="application\/pdf,\.pdf,image\/jpeg,\.jpg,\.jpeg"/);
    assert.match(html, /name="orderId" type="text" required/);
    assert.match(html, /name="paperType" required/);
    assert.match(html, /name="paperSupplier" type="text" required/);
    assert.match(html, /body\.append\(field, form\.elements\[field\]\.value\)/);
    assert.match(html, /body\.append\("shift", shift\)/);
    assert.match(html, /body\.append\(name, String\(value\)\)/);
    assert.match(html, /if \(result\?\.runId\) connectTrace\(result\.runId\)/);
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
    assert.match(html, /Simulated sensor/);
    assert.match(html, /Unverified source/);
    assert.match(html, /ambientTempC: String\(data\.ambientTempC\) \+ " °C"/);
    assert.match(html, /readingTimestamp: provenance\.timestamp/);
    assert.match(html, /Raw status response/);
    assert.match(html, /class="timeline"/);
    assert.match(html, /Approval unavailable/);
    assert.match(html, /Stored card unavailable/);
    assert.match(html, /id="shared-job-id"/);
    assert.match(html, /id="load-stored-job-form"/);
    assert.match(html, /id="prepare-job"/);
    assert.match(html, /id="confirm-order-line"/);
    assert.match(html, /id="purchase-order-document-fields"/);
    assert.match(html, /id="purchase-order-lines"/);
    assert.match(html, /candidates\.dataset\.role = "catalog-candidates"/);
    assert.match(html, /id="review-order" type="button" data-i18n="submitPdf"/);
    assert.ok(html.indexOf('id="review-order"') < html.indexOf('id="service-availability-summary"'));
    assert.ok(html.indexOf('id="extraction-paper-supplier"') < html.indexOf('id="review-order"'));
    assert.ok(html.indexOf('id="extraction-paper-supplier"') < html.indexOf('id="order-pdf"'));
    assert.ok(html.indexOf('id="review-order"') < html.indexOf('id="upload-result"'));
    assert.match(html, /data-json-get="\/api\/status" data-output="status-result"/);
    assert.match(html, /No submission yet\. Select a purchase-order document and enter its operator-confirmed context, then submit for extraction and line review\./);
    assert.match(html, /Select a PDF or JPEG scan before submitting it for extraction and PO-line review\./);
    assert.match(html, /Enter the operator-confirmed " \+ fieldLabels\[name\] \+ " before extraction\./);
    assert.doesNotMatch(html, /selected purchase-order document is sent once when you prepare a job sheet on Screen 2/);
    assert.match(html, /url: "\/orders\/extract"/);
    assert.match(html, /body\.append\("confirmedItemCode", itemCode\)/);
    assert.match(html, /body\.append\("confirmedQuantity", String\(quantity\)\)/);
    assert.match(html, /body\.append\("confirmedLineIndex", String\(selectedReviewLineIndex \+ 1\)\)/);
    assert.match(html, /body\.append\("reviewId", activePurchaseOrderReview\.reviewId\)/);
    assert.match(html, /body\.append\("reviewFingerprint", activePurchaseOrderReview\.reviewFingerprint\)/);
    assert.doesNotMatch(html, /id="confirmed-line-index"/);
    assert.doesNotMatch(html, /id="confirmed-item-code"/);
    assert.doesNotMatch(html, /id="confirmed-quantity"/);
    assert.match(html, /url: "\/jobs"/);
    assert.match(html, /data-i18n="prepareJobSheet"/);
    assert.match(html, /Idempotency-Key/);
    assert.match(html, /payload\?\.durable === true/);
    assert.match(html, /blockedAtExtractOrder/);
    assert.match(html, /url: "\/jobs\/" \+ encodeURIComponent\(jobId\)/);
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
    assert.match(css, /\.dropzone--compact\s*\{\s*display:\s*flex;\s*min-height:\s*3\.5rem;/);
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
    for (const language of ["en"]) {
      const localeResponse = await fetch(`http://127.0.0.1:${PORT}/locales/${language}.json`);
      assert.equal(localeResponse.status, 200);
      assert.match(localeResponse.headers.get("content-type"), /application\/json/);
      const locale = await localeResponse.json();
      assert.equal(typeof locale.workflow, "string");
      for (const key of ["operatorOrderContext", "operatorOrderContextHelp", "orderIdField", "paperTypeField", "paperSupplierField", "selectPaperType"]) {
        assert.equal(typeof locale[key], "string", `${language} locale includes ${key}`);
      }
    }
    for (const language of ["hi", "mr", "ja", "ko", "zh-CN", "id"]) {
      assert.equal((await fetch(`http://127.0.0.1:${PORT}/locales/${language}.json`)).status, 404);
    }
    const unsupportedLocale = await fetch(`http://127.0.0.1:${PORT}/locales/fr.json`);
    assert.equal(unsupportedLocale.status, 404);

    const moneyContracts = await fetch(`http://127.0.0.1:${PORT}/money-contracts.js`);
    assert.equal(moneyContracts.status, 200);
    assert.match(moneyContracts.headers.get("content-type"), /text\/javascript/);
    assert.match(await moneyContracts.text(), /getDisplayableProductionAmounts/);

    const impactUi = await fetch(`http://127.0.0.1:${PORT}/impact-ui.js`);
    assert.equal(impactUi.status, 200);
    assert.match(impactUi.headers.get("content-type"), /text\/javascript/);
    assert.match(await impactUi.text(), /export function isImpactSummary/);
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
    child.kill("SIGTERM");
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
    assert.equal(payload.modelAcceptance.status, "prototype-thresholds-met");
    assert.equal(payload.modelAcceptance.completeAcceptanceEvidenceAvailable, false);
    assert.equal(payload.modelAcceptance.linkedToCurrentResourceVersions, false);
    assert.equal(payload.modelAcceptance.models.length, 5);
    assert.deepEqual(payload.runtimeAvailability, {
      productionAdaptersConfigured: false,
      liveModelCallsEnabled: false,
      currentConditions: { adapterConfigured: false, dataChecked: false },
      integrationsVerified: false,
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
    child.kill("SIGTERM");
  }
});

test("status reports enabled gates separately from untested sensor data and persistence", async () => {
  const { child } = await startServer({
    PROJECT_ID: "prepagent-hack",
    REGION: "asia-south1",
    BUCKET: "prepagent-hack-data",
    USTAAD_PLANT_ID: "PLANT-01",
    USTAAD_ENABLE_LIVE_MODEL_CALLS: "true",
    USTAAD_ENABLE_RISK_PREDICTION: "true",
  });
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/status`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.runtimeAvailability.productionAdaptersConfigured, true);
    assert.equal(payload.runtimeAvailability.liveModelCallsEnabled, true);
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
    child.kill("SIGTERM");
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
    child.kill("SIGTERM");
  }
});

test("legacy mock-agent endpoints are unavailable in Cloud Run mode", async () => {
  const { child } = await startServer({ K_SERVICE: "prepagent" });
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(response.status, 503, path);
      const payload = await response.json();
      assert.equal(payload.ok, false, path);
      assert.equal(payload.error.code, "SERVICE_UNAVAILABLE", path);
      assert.match(payload.error.message, /explicitly enabled local demo mode/, path);
    }
  } finally {
    child.kill("SIGTERM");
  }
});

test("Cloud Run job lifecycle routes fail closed without supervisor authorization", async () => {
  const { child } = await startServer({ K_SERVICE: "prepagent" });
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        } : {}),
      });
      assert.equal(response.status, 503, `${method} ${path}`);
      const payload = await response.json();
      assert.equal(payload.error.code, "SERVICE_UNAVAILABLE", `${method} ${path}`);
      assert.match(payload.error.message, /authenticated supervisor identity/, `${method} ${path}`);
    }
  } finally {
    child.kill("SIGTERM");
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
    assert.match((await response.json()).error.message, /Synthetic-only mode must be explicitly enabled/);
  } finally {
    child.kill("SIGTERM");
  }
});

test("Cloud Run PO extraction rejects modified documents in synthetic-only mode", async () => {
  const { child } = await startServer({ K_SERVICE: "prepagent", USTAAD_SYNTHETIC_ONLY: "true" });
  try {
    const fixture = new Uint8Array(await readFile(new URL("./fixtures/synthetic_POs/PO1_ClientA_single_B1047.pdf", import.meta.url)));
    fixture[fixture.length - 1] ^= 1;
    const form = new FormData();
    form.append("file", new Blob([fixture], { type: "application/pdf" }), "modified-po.pdf");
    const response = await fetch(`http://127.0.0.1:${PORT}/orders/extract`, { method: "POST", body: form });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error.message, /Only the owner-approved synthetic purchase-order fixtures/);
  } finally {
    child.kill("SIGTERM");
  }
});

test("Cloud Run reports local idempotency separately from unavailable JobSheet persistence", async () => {
  const { child } = await startServer({
    K_SERVICE: "prepagent",
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

    const response = await fetch(`http://127.0.0.1:${PORT}/jobs`, { method: "POST", body: form });
    assert.ok(response.status >= 400);
    const payload = await response.json();
    assert.notEqual(payload.ok, true);
    assert.ok(["SERVICE_UNAVAILABLE", "VALIDATION_ERROR"].includes(payload.error?.code));
    assert.equal(typeof payload.runId, "string");
    assert.equal(payload.jobSheet, undefined);
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
    child.kill("SIGTERM");
  }
});

test("multipart purchase-order upload accepts signed PDF or JPEG and never claims extraction", async () => {
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
    assert.equal(jpegUnavailable.status, 503);
    assert.equal((await jpegUnavailable.json()).error.code, "SERVICE_UNAVAILABLE");
  } finally {
    child.kill("SIGTERM");
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
    child.kill("SIGTERM");
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
    const upload = new FormData();
    upload.append("file", new Blob(["%PDF-1.4 demo fixture"], { type: "application/pdf" }), "demo-order.pdf");
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
    assert.equal(conditionsPayload.provenance.freshness, "unassessed");

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
    assert.match(explanationPayload.explanation, /Synthetic demo mode/i);

    const jobForm = new FormData();
    jobForm.append("file", new Blob(["%PDF-1.4 demo fixture"], { type: "application/pdf" }), "demo-order.pdf");
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
    child.kill("SIGTERM");
  }
});

test("Day 2 analysis routes validate inputs and never fabricate unavailable results", async () => {
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
      assert.equal(invalid.status, 400, endpoint);
      const failure = await invalid.json();
      assert.equal(failure.ok, false, endpoint);
      assert.equal(failure.error.code, "VALIDATION_ERROR", endpoint);
      assert.ok(failure.error.issues.length > 0, endpoint);
    }
  } finally {
    child.kill("SIGTERM");
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
        levers: { sfSpeedMpm: 48, rollTempC: 162, gumApplication: "HIGH", gumViscositySec: 32,
          pastingPressure: "MED", dryingHours: 5, printSpeedSpm: 60 },
      }),
    });
    assert.equal(validRisk.status, 503, "valid contract should reach the configured-service boundary");
    assert.equal((await validRisk.json()).error.code, "SERVICE_UNAVAILABLE");

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
    child.kill("SIGTERM");
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
    child.kill("SIGTERM");
  }
});
