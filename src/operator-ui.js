import { SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES } from "./schemas.js";

// ─── Language / currency metadata ────────────────────────────────────────────
const languageNames = {
  en: "English",
  hi: "हिन्दी (Hindi)",
  mr: "मराठी (Marathi)",
  ja: "日本語 (Japanese)",
  ko: "한국어 (Korean)",
  "zh-CN": "中文 (Chinese)",
  id: "Bahasa Indonesia",
};
const languageOptions = SUPPORTED_LANGUAGES
  .map((l) => `<option value="${l}">${languageNames[l]} (${l})</option>`)
  .join("");
const currencyOptions = SUPPORTED_CURRENCIES
  .map((c) => `<option value="${c}">${c}</option>`)
  .join("");

// ─── Field definitions ────────────────────────────────────────────────────────
const orderFields = [
  ["orderId",        "Purchase order ID",  "text"],
  ["itemCode",       "Item code",          "text"],
  ["customerId",     "Customer ID",        "text"],
  ["boxStyle",       "Box style",          "select",  ["RSC","DIECUT","TRAY"]],
  ["lengthMm",       "Length (mm)",        "number",  20,   1500, 1],
  ["widthMm",        "Width (mm)",         "number",  20,   1500, 1],
  ["heightMm",       "Height (mm)",        "number",  0,    1500, 1],
  ["ply",            "Ply",                "select",  ["3","5","7"]],
  ["fluteProfile",   "Flute profile",      "select",  ["B","C","E","BC","BCB"]],
  ["topLinerGsm",    "Top liner (GSM)",    "number",  80,   400, 1],
  ["fluteGsm",       "Flute (GSM)",        "number",  80,   400, 1],
  ["innerLinerGsm",  "Inner liner (GSM)",  "number",  80,   400, 1],
  ["linerBf",        "Liner BF",           "number",  12,   40,  1],
  ["paperType",      "Paper type",         "select",  ["VIRGIN","RECYCLED","MIXED"]],
  ["paperSupplier",  "Paper supplier",     "text"],
  ["inkColors",      "Ink colors",         "number",  0,    4,   1],
  ["inkCoveragePct", "Ink coverage (%)",   "number",  0,    100, "any"],
  ["quantity",       "Quantity",           "number",  1,    undefined, 1],
];

const conditionFields = [
  ["runDate",          "Run date",              "date"],
  ["shift",            "Shift",                 "select",  ["DAY","NIGHT"]],
  ["ambientRhPct",     "Ambient humidity (%)",  "number",  0,   100, "any"],
  ["ambientTempC",     "Ambient temperature (°C)", "number", undefined, undefined, "any"],
  ["paperMoisturePct", "Paper moisture (%)",    "number",  0,   20,  "any"],
];

const leverFields = [
  ["sfSpeedMpm",      "Single facer speed (m/min)",   "number", 20,  60,  "any"],
  ["rollTempC",       "Roll temperature (°C)",         "number", 150, 185, "any"],
  ["gumApplication",  "Gum application",               "select", ["LOW","MED","HIGH"]],
  ["gumViscositySec", "Gum viscosity (seconds)",       "number", 25,  60,  "any"],
  ["pastingPressure", "Pasting pressure",              "select", ["LOW","MED","HIGH"]],
  ["dryingHours",     "Drying time (hours)",           "number", 2,   16,  "any"],
  ["printSpeedSpm",   "Print speed (sheets/min)",      "number", 30,  80,  "any"],
];

const whatIfLeverLabelKeys = {
  sfSpeedMpm:      "leverSfSpeedMpm",
  rollTempC:       "leverRollTempC",
  gumViscositySec: "leverGumViscositySec",
  dryingHours:     "leverDryingHours",
  printSpeedSpm:   "leverPrintSpeedSpm",
};

// ─── Field markup helper ──────────────────────────────────────────────────────
function fieldMarkup([name, label, type, optionsOrMin, max, step]) {
  const id = `analysis-${name}`;
  const labelKey = name === "itemCode" ? ' data-i18n="itemCodeField"' : "";
  const control = type === "select"
    ? `<select id="${id}" name="${name}" required><option value="" selected disabled>Select ${label.toLowerCase()}</option>${optionsOrMin.map((o) => `<option value="${o}">${o}</option>`).join("")}</select>`
    : `<input id="${id}" name="${name}" type="${type}"${type === "number" ? ` min="${optionsOrMin ?? ""}" max="${max ?? ""}" step="${step}"` : ""} required />`;
  return `<div class="field"><label for="${id}"${labelKey}>${label}</label>${control}</div>`;
}

const orderFieldsMarkup     = orderFields.map(fieldMarkup).join("");
const conditionFieldsMarkup = conditionFields.map(fieldMarkup).join("");
const leverFieldsMarkup     = leverFields.map(fieldMarkup).join("");

// ─── Navigation — 4 items required by test suite ──────────────────────────────
const navigationItems = [
  ["screen-order-input",        "Screen 1 — Order input",        "M12 16V4m0 0L7 9m5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"],
  ["screen-production-analysis","Screen 2 — Production analysis","M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6"],
  ["screen-job-card-approval",  "Screen 3 — Job card and approval","M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 0v5h5M9 13h6m-6 4h6"],
  ["screen-impact",             "Screen 4 — Impact evidence",    "M4 19V5m0 14h16M8 15v-4m4 4V7m4 8V9"],
];

const navigationMarkup = navigationItems.map(([target, label, icon], index) => `
          <a class="sidebar__link" href="#${target}" data-sidebar-link data-screen-link data-tooltip="${label}" aria-label="${label}"${index === 0 ? ' aria-current="page"' : ""}>
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${icon}" /></svg>
            <span class="sidebar__label">${label}</span>
          </a>`).join("");

// ─── Home page HTML ───────────────────────────────────────────────────────────
export const homePage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0b0d11" />
    <title>Ustaad AI — Production Prep</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..800;1,14..32,300..800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/operator-ui.css" />
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>

    <div class="app-shell" data-sidebar-collapsed="false">

      <!-- SIDEBAR -->
      <aside class="sidebar" id="app-sidebar">
        <div class="sidebar__top">
          <a class="brand" href="#screen-order-input" aria-label="Ustaad AI — Production Prep">
            <span class="brand__mark" aria-hidden="true">U</span>
            <span class="sidebar__label">
              <strong>Ustaad AI</strong>
              <small>Production-Prep Agent</small>
            </span>
          </a>
          <button
            class="icon-button sidebar__toggle"
            id="sidebar-toggle"
            type="button"
            aria-label="Collapse sidebar"
            aria-controls="primary-navigation"
            aria-expanded="true"
            data-tooltip="Collapse sidebar"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m14 5-7 7 7 7m6-14-7 7 7 7" /></svg>
          </button>
        </div>
        <nav class="sidebar__nav" id="primary-navigation" aria-label="Primary navigation">
${navigationMarkup}
        </nav>
        <div class="sidebar__footer">
          <span class="status-dot" aria-hidden="true"></span>
          <span class="sidebar__label" id="runtime-mode-sidebar">Local development</span>
        </div>
      </aside>

      <!-- MAIN -->
      <main class="app-main" id="main-content" tabindex="-1">
        <div class="topbar">
          <div class="topbar__left">
            <p class="eyebrow">USTAAD AI <span aria-hidden="true">/</span> PRODUCTION PREP</p>
            <p class="muted topbar__tagline" data-i18n="tagline">Corrugated production preparation · local development</p>
          </div>
          <span class="badge badge--neutral"><span class="status-dot" aria-hidden="true"></span><span id="runtime-mode-header">Local development</span></span>
        </div>

        <div class="page">

<!-- ═══════════ SCREEN 1 — ORDER INPUT ═══════════ -->
<section class="screen" id="screen-order-input" data-screen-panel aria-labelledby="screen-order-heading">
  <header class="screen-heading">
    <p class="eyebrow">SCREEN 1</p>
    <h1 id="screen-order-heading">Screen 1 — Order input</h1>
    <p class="muted">Enter the order and loaded-reel details confirmed by the operator, then extract and review the purchase order.</p>
  </header>

  <!-- Upload card -->
  <section class="card wide upload-card" aria-labelledby="upload-title">
    <h2 id="upload-title" data-i18n="order">Purchase-order document</h2>
    <p class="muted">Enter the confirmed order context and choose its source document before extraction.</p>
    <div>
      <fieldset class="operator-order-context">
        <legend data-i18n="operatorOrderContext">Operator-confirmed order context</legend>
        <p class="muted" data-i18n="operatorOrderContextHelp">Enter the PO ID and loaded reel details confirmed by the operator. Product specifications come from the item master.</p>
        <div class="field-grid">
          <div class="field"><label for="extraction-order-id" data-i18n="orderIdField">Purchase order ID</label><input id="extraction-order-id" name="orderId" type="text" required /></div>
          <div class="field"><label for="extraction-paper-type" data-i18n="paperTypeField">Loaded paper type</label><select id="extraction-paper-type" name="paperType" required><option value="" selected disabled data-i18n="selectPaperType">Select loaded paper type</option><option value="VIRGIN">VIRGIN</option><option value="RECYCLED">RECYCLED</option><option value="MIXED">MIXED</option></select></div>
          <div class="field"><label for="extraction-paper-supplier" data-i18n="paperSupplierField">Loaded paper supplier</label><input id="extraction-paper-supplier" name="paperSupplier" type="text" required /></div>
        </div>
      </fieldset>
      <label class="dropzone dropzone--compact" id="order-dropzone" for="order-pdf">
        <svg class="icon dropzone__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /></svg>
        <strong data-i18n="choosePdf">Choose purchase-order document</strong>
        <span class="muted">PDF/JPEG · max 10 MiB · drop or browse</span>
        <span id="selected-file-name" class="dropzone__filename" aria-live="polite">No file selected</span>
        <input id="order-pdf" class="dropzone__input" name="file" type="file" accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg" required aria-describedby="selected-file-name upload-result" />
      </label>
      <div class="actions upload-actions">
        <button id="review-order" type="button" data-i18n="submitPdf">Submit PDF for extraction</button>
      </div>
      <pre id="upload-result" class="result" role="status" aria-live="polite">No submission yet. Select a purchase-order document and enter its operator-confirmed context, then submit for extraction and line review.</pre>
      <section id="purchase-order-review" class="operator-order-context" aria-labelledby="purchase-order-review-heading" hidden>
        <h3 id="purchase-order-review-heading">Extracted purchase-order review</h3>
        <p class="muted">Extracted values and catalog values are shown separately. Correct only from the source document; ambiguous catalog choices must use one of the returned candidates.</p>
        <dl id="purchase-order-document-fields" class="field-list"></dl>
        <p id="purchase-order-document-missing" class="muted" role="status"></p>
        <ol id="purchase-order-lines" class="po-line-review"></ol>
        <label class="operator-item-confirmation">
          <input id="confirm-order-line" type="checkbox" />
          I verified the selected line's item code and quantity against this purchase order.
        </label>
      </section>
    </div>
    <details class="diagnostics"><summary>Technical response details</summary><pre id="upload-result-diagnostic" class="result"></pre></details>
  </section>

  <!-- Availability -->
  <details class="availability" open>
    <summary id="service-availability-summary"><span class="status-dot" aria-hidden="true"></span> Checking backend and production integrations…</summary>
    <dl id="runtime-availability" class="field-list" aria-live="polite">
      <dt>Backend</dt><dd id="backend-availability">Checking</dd>
      <dt>Production adapters</dt><dd id="production-adapters-availability">Checking</dd>
      <dt>Live model calls</dt><dd id="model-calls-availability">Checking</dd>
      <dt>Current conditions</dt><dd id="current-conditions-availability">Checking</dd>
      <dt>JobSheet persistence</dt><dd id="job-persistence-availability">Checking</dd>
      <dt>Durable idempotency</dt><dd id="job-idempotency-availability">Checking</dd>
      <dt>Persisted job creation</dt><dd id="job-creation-availability">Checking</dd>
    </dl>
    <p class="muted" role="note" id="runtime-availability-note">Adapter configuration does not prove cloud connectivity or data availability.</p>
  </details>

  <div class="grid">
    <details class="card wide workflow-guide">
      <summary>Workflow guide</summary>
      <h2 id="workflow-title" data-i18n="workflow">Production preparation workflow</h2>
      <p id="workflow-current" class="notice" role="status" aria-live="polite" data-i18n="currentStage">Current stage: purchase-order input required. No order has been accepted, and no downstream stage can proceed.</p>
      <ol class="workflow">
        <li data-workflow-stage="order">
          <strong data-i18n="orderStage">1. Purchase-order input</strong>
          <p id="extraction-workflow-description" data-i18n="orderDescription">Required input: an operator-supplied PDF or JPEG scan. The same-origin backend validates the file; extraction depends on its configured service.</p>
          <a href="#order-pdf" data-i18n="goToPdf">Go to purchase-order input</a>
          <span id="extraction-workflow-badge" class="badge" data-workflow-state="blocked" data-i18n="extractionUnavailable">Extraction unavailable</span>
        </li>
        <li data-workflow-stage="trace">
          <strong data-i18n="traceStage">2. Agent execution trace</strong>
          <p data-i18n="traceDescription">A genuine run and shared trace are required before showing tool activity.</p>
          <span class="badge" data-workflow-state="blocked" data-i18n="traceUnavailable">Unavailable: orchestration and trace are not configured</span>
        </li>
        <li data-workflow-stage="analysis">
          <strong data-i18n="analysisStage">3. Conditions, risk, evidence, and what-if</strong>
          <p data-i18n="analysisDescription">Requires an accepted order and genuine conditions, prediction, optimization, and evidence responses. These service ports are unavailable.</p>
          <nav aria-label="Analysis request forms" data-i18n-aria="analysisStage">
            <a href="#screen-production-analysis" data-i18n="conditions">Conditions</a> ·
            <a href="#screen-production-analysis" data-i18n="risk">Risk</a> ·
            <a href="#screen-production-analysis" data-i18n="optimization">Optimization and evidence</a>
          </nav>
          <span id="analysis-workflow-badge" class="badge" data-workflow-state="blocked" data-i18n="analysisUnavailable">Unavailable: production analysis services are not configured</span>
        </li>
        <li data-workflow-stage="approval">
          <strong data-i18n="approvalStage">4. Approval</strong>
          <p data-i18n="approvalDescription">Approval requires a persisted job and the source-defined approval service; neither is available.</p>
          <span id="approval-workflow-badge" class="badge" data-workflow-state="blocked" data-i18n="approvalUnavailable">Unavailable: job persistence and approval are not configured</span>
        </li>
        <li data-workflow-stage="print">
          <strong data-i18n="printStage">5. Print</strong>
          <p data-i18n="printDescription">The local PDF renderer accepts a caller-supplied JobSheet only. It is not a substitute for an approved, stored production job card.</p>
          <a href="#screen-job-card-approval" data-i18n="localRenderer">Open local renderer (not workflow printing)</a>
          <span class="badge" data-workflow-state="blocked" data-i18n="printUnavailable">Workflow printing unavailable</span>
        </li>
      </ol>
    </details>

    <details class="card wide diagnostics status-diagnostics">
      <summary id="status-title" data-i18n="status">Application and integration status</summary>
      <p class="muted">Adapter configuration does not prove service connectivity or data availability.</p>
      <button type="button" class="button-secondary" data-json-get="/api/status" data-output="status-result" data-i18n="loadStatus">Load local service status</button>
      <pre id="status-result" class="result" role="status" aria-live="polite" data-i18n="statusLoading">Status has not been requested.</pre>
      <details class="diagnostics"><summary>Raw status response</summary><pre id="status-result-diagnostic" class="result"></pre></details>
    </details>
  </div>
</section>

<!-- ═══════════ SCREEN 2 — PRODUCTION ANALYSIS ═══════════ -->
<section class="screen" id="screen-production-analysis" data-screen-panel aria-labelledby="screen-analysis-heading" hidden>
  <header class="screen-heading">
    <p class="eyebrow">SCREEN 2</p>
    <h1 id="screen-analysis-heading">Screen 2 — Production analysis</h1>
    <p class="muted">Review genuine agent activity, production conditions, five-defect risk, recommendations and historical evidence. Results remain empty until real services return them.</p>
  </header>

  <details class="card wide request-inputs" open>
    <summary>Production request inputs</summary>
    <p class="muted">Enter actual values from an accepted order and current production measurements. Fields and limits follow the existing request schema; no values are prefilled.</p>
    <div class="request-groups">
      <fieldset>
        <legend>Order profile</legend>
        <div class="field-grid" id="order-profile-fields">${orderFieldsMarkup}</div>
      </fieldset>
      <fieldset>
        <legend>Production conditions</legend>
        <div class="field-grid" id="condition-request-fields">${conditionFieldsMarkup}</div>
      </fieldset>
      <details class="settings-disclosure">
        <summary>Current machine settings <span class="muted">(required for risk prediction)</span></summary>
        <p class="muted">Enter the actual current settings. These fields do not change machine controls.</p>
        <div class="field-grid" id="lever-request-fields">${leverFieldsMarkup}</div>
      </details>
    </div>
    <div class="actions">
      <button type="button" id="request-risk" data-i18n="requestRisk">Request risk prediction</button>
      <button type="button" id="request-optimization" class="button-secondary" data-i18n="requestOptimization">Request optimization</button>
    </div>
    <p class="muted">Requests go to existing API routes. Results remain unavailable until genuine services are configured.</p>
  </details>

  <div class="grid">
    <section class="card" aria-labelledby="conditions-title">
      <h2 id="conditions-title" data-i18n="conditions">Current conditions</h2>
      <p class="muted">Requests the latest conditions from the existing endpoint. No local sensor values are substituted.</p>
      <button type="button" data-json-get="/conditions/current" data-output="conditions-result" data-i18n="loadConditions">Load conditions</button>
      <pre id="conditions-result" class="result" role="status" aria-live="polite" data-i18n="noConditions">No conditions request made.</pre>
      <dl id="conditions-fields" class="field-list" hidden></dl>
      <details class="diagnostics"><summary>Technical response details</summary><pre id="conditions-result-diagnostic" class="result"></pre></details>
    </section>

    <section class="card" aria-labelledby="risk-title">
      <h2 id="risk-title" data-i18n="risk">Risk prediction</h2>
      <p class="muted">Requires a complete order, conditions and actual machine settings. The contract covers WARP, DELAM, STRENGTH, PRINT and CRACK; values appear only from a real API response.</p>
      <pre id="risk-result" class="result" role="status" aria-live="polite" data-i18n="noRisk">No risk request made.</pre>
      <div id="risk-metrics" class="metric-grid" hidden></div>
      <details class="diagnostics"><summary>Technical response details</summary><pre id="risk-result-diagnostic" class="result"></pre></details>
    </section>

    <section class="card" aria-labelledby="optimization-title">
      <h2 id="optimization-title" data-i18n="optimization">Optimization and evidence</h2>
      <p class="muted">Shows an optimizer response only when the existing service returns one. Historical evidence remains a separate dependency.</p>
      <pre id="optimization-result" class="result" role="status" aria-live="polite" data-i18n="noOptimization">No optimization request made.</pre>
      <dl id="optimization-settings" class="field-list" hidden></dl>
      <div id="optimization-changes" class="change-list" hidden></div>
      <details class="diagnostics"><summary>Technical response details</summary><pre id="optimization-result-diagnostic" class="result"></pre></details>
    </section>

    <section class="card wide" aria-labelledby="currency-title">
      <h2 id="currency-title" data-i18n="currencyConversion">Display-only currency conversion</h2>
      <p class="muted">Converts only the amount you enter to the display currency selected above, using the existing dated FX endpoint. No order or production value is prefilled or changed.</p>
      <form id="currency-form">
        <div class="preference-grid">
          <div>
            <label for="display-currency" data-i18n="currency">Display currency</label>
            <select id="display-currency">${currencyOptions}</select>
            <p class="muted">Display preference only; it does not update application data.</p>
          </div>
          <div>
            <label for="currency-amount" data-i18n="amount">Amount to display</label>
            <input id="currency-amount" name="amount" type="number" step="any" required />
          </div>
          <div>
            <label for="source-currency" data-i18n="sourceCurrency">Source currency</label>
            <select id="source-currency">${currencyOptions}</select>
          </div>
        </div>
        <button type="submit" data-i18n="convert">Convert for display</button>
      </form>
      <pre id="currency-result" class="result" role="status" aria-live="polite" data-i18n="noConversion">No conversion requested. The converter does not update application data.</pre>
    </section>

    <section class="card wide" aria-labelledby="trace-title">
      <h2 id="trace-title" data-i18n="tracePanel">Agent execution trace</h2>
      <p class="muted" data-i18n="tracePanelDescription">Subscribe only with a run ID returned by genuine orchestration. Test traces are not production runs.</p>
      <form id="trace-form">
        <label for="trace-run-id" data-i18n="runId">Run ID</label>
        <input id="trace-run-id" name="runId" type="text" autocomplete="off" />
        <button type="submit" data-i18n="connectTrace">Connect to trace</button>
      </form>
      <pre id="trace-result" class="result" role="status" aria-live="polite" data-i18n="traceInitial">No genuine run is available to display.</pre>
      <ol id="trace-events" class="timeline" aria-label="Trace events" data-i18n-aria="traceEvents"></ol>
    </section>

    <section class="card" aria-labelledby="evidence-title">
      <h2 id="evidence-title">Similar historical runs</h2>
      <p id="similar-runs-availability" class="muted">The production evidence query is not configured. No sample or mock runs are shown.</p>
      <button type="button" id="load-similar-runs" class="button-secondary" disabled
              data-output="similar-runs-result" data-available-text="Load similar runs">Load similar runs</button>
      <pre id="similar-runs-result" class="result" role="status" aria-live="polite">No similar runs requested.</pre>
      <ol id="similar-runs-list" class="po-line-review" hidden></ol>
      <details class="diagnostics"><summary>Technical response details</summary><pre id="similar-runs-result-diagnostic" class="result"></pre></details>
    </section>

    <section class="card" aria-labelledby="explanation-title">
      <h2 id="explanation-title">Model-grounded explanations</h2>
      <button type="button" id="request-risk-explanation" class="button-secondary" disabled
              data-output="explanation-result" data-available-text="Request explanation">Request explanation</button>
      <p id="risk-explanation-availability" class="muted">Unavailable — a real risk prediction, optimization and historical evidence are required.</p>
      <pre id="explanation-result" class="result" role="status" aria-live="polite">No explanation requested.</pre>
      <div id="risk-explanation-content" class="result" hidden></div>
      <details class="diagnostics"><summary>Technical response details</summary><pre id="explanation-result-diagnostic" class="result"></pre></details>
    </section>

    <section class="card" aria-labelledby="what-if-title">
      <h2 id="what-if-title">What-if re-scoring</h2>
      <p class="muted" data-i18n="whatIfHelp">Choose a numeric machine lever and drag its slider. The model re-scores once when you release the slider; this avoids sending a BigQuery request for every pointer movement.</p>
      <fieldset id="what-if-controls" disabled hidden>
        <div class="field-grid">
          <div class="field"><label for="what-if-lever" data-i18n="whatIfLever">Machine lever</label><select id="what-if-lever">${leverFields.filter(([,,type]) => type === "number").map(([name, label]) => `<option value="${name}" data-i18n="${whatIfLeverLabelKeys[name]}">${label}</option>`).join("")}</select></div>
          <div class="field"><label for="what-if-value" data-i18n="whatIfScenarioValue">Scenario value</label><input id="what-if-value" type="range" /></div>
        </div>
        <output id="what-if-value-label" for="what-if-value"></output>
        <button id="what-if-rescore" type="button" data-i18n="whatIfRescore">Re-score setting</button>
      </fieldset>
      <p id="what-if-unavailable" class="empty-state" role="status" data-state="unavailable" data-i18n="whatIfUnavailable">Request a genuine risk prediction before exploring lever settings.</p>
      <pre id="what-if-result" class="result" role="status" aria-live="polite" data-i18n="whatIfNoResult">No what-if result requested.</pre>
      <div id="what-if-metrics" class="metric-grid" hidden></div>
    </section>
  </div>
</section>

<!-- ═══════════ SCREEN 3 — JOB CARD AND APPROVAL ═══════════ -->
<section class="screen" id="screen-job-card-approval" data-screen-panel aria-labelledby="screen-job-heading" hidden>
  <header class="screen-heading">
    <p class="eyebrow">SCREEN 3</p>
    <h1 id="screen-job-heading">Screen 3 — Job card and approval</h1>
    <p class="muted">Generate or review a contract-valid JobSheet, request supervisor approval and print only a supplied sheet. Persistence and workflow approval are not configured.</p>
  </header>

  <div class="grid">
    <section class="card wide" aria-labelledby="job-preparation-title">
      <h2 id="job-preparation-title">Job-sheet generation</h2>
      <p class="muted">Request job preparation for the document selected on Screen 1. The coordinator reports the first unavailable or invalid stage; it does not invent missing production results.</p>
      <button id="prepare-job" type="button" data-i18n="prepareJobSheet">Prepare job sheet</button>
      <pre id="prepare-job-result" class="result" role="status" aria-live="polite">Not started — no job sheet has been generated.</pre>
    </section>

    <section class="card wide job-context" aria-labelledby="job-context-title">
      <h2 id="job-context-title">Persisted job context</h2>
      <p class="muted">Enter the genuine persisted job ID once to load the stored sheet and use the available job actions below.</p>
      <form id="load-stored-job-form">
        <label for="shared-job-id" data-i18n="persistedJobId">Persisted job ID</label>
        <input id="shared-job-id" autocomplete="off" />
        <div class="actions">
          <button type="submit" disabled data-i18n="loadStoredJob">Load stored job</button>
        </div>
      </form>
      <pre id="stored-job-result" class="result" role="status" aria-live="polite" data-i18n="noStoredJob">Not started — no stored job has been loaded.</pre>
    </section>

    <nav class="card wide lifecycle" aria-label="Job-sheet lifecycle">
      <ol class="lifecycle__steps">
        <li data-state="unavailable"><span>1</span><strong>Generate draft</strong><small>Workflow unavailable</small></li>
        <li data-state="incomplete"><span>2</span><strong>Review</strong><small>Requires a genuine draft</small></li>
        <li data-state="incomplete"><span>3</span><strong>Supervisor approval</strong><small>Approval service unavailable</small></li>
        <li data-state="incomplete"><span>4</span><strong>Print card</strong><small>Stored card unavailable</small></li>
      </ol>
    </nav>

    <section class="card" aria-labelledby="approval-title">
      <h2 id="approval-title">Supervisor approval</h2>
      <p class="muted">Approval requires a persisted job returned by the genuine workflow. A rejection operation is not defined by the existing API contract.</p>
      <form id="approval-form">
        <div class="actions">
          <button type="submit" disabled data-i18n="approveJob" aria-describedby="approval-unavailable">Approval unavailable</button>
          <button type="button" disabled aria-describedby="rejection-unavailable">Reject unavailable</button>
        </div>
      </form>
      <p id="approval-unavailable" class="muted">Approval service is not configured.</p>
      <p id="rejection-unavailable" class="muted">No reject endpoint or rejection contract is available.</p>
      <pre id="approval-result" class="result" role="status" aria-live="polite">Not started — no approval has been requested.</pre>
    </section>

    <section class="card" aria-labelledby="stored-card-title">
      <h2 id="stored-card-title">Approved job-card printing</h2>
      <p class="muted">Fetches a stored card only from the existing job-card route. This is separate from the local supplied-JobSheet renderer below.</p>
      <form id="stored-card-form">
        <button type="submit" disabled data-i18n="fetchCard" aria-describedby="stored-card-result">Stored card unavailable</button>
        <a id="stored-card-link" class="link-button" hidden target="_blank" rel="noopener">Open job card to print</a>
      </form>
      <pre id="stored-card-result" class="result" role="status" aria-live="polite">Not started — no stored job card requested.</pre>
    </section>

    <section class="card" aria-labelledby="preferences-title">
      <h2 id="preferences-title" data-i18n="preferences">Display preferences</h2>
      <label for="language-preference" data-i18n="language">Language preference</label>
      <select id="language-preference">${languageOptions}</select>
      <p id="language-result" class="result" role="status" aria-live="polite" data-i18n="translationNote">Static translations cover ordinary interface labels only. Glossary-backed production text and live translation are unavailable.</p>
    </section>

    <section class="card wide" aria-labelledby="feedback-title">
      <h2 id="feedback-title">Production feedback and defect photo</h2>
      <p class="muted">Submit only observed outcomes using the existing feedback contract. Photo classification, photo upload and feedback persistence are unavailable until their real services are configured.</p>
      <form id="feedback-form" class="feedback-form">
        <fieldset>
          <legend>Observed defect rates (%)</legend>
          <div class="field-grid field-grid--compact">
            <div class="field"><label for="feedback-warp">WARP</label><input id="feedback-warp" name="rateWarpPct" type="number" min="0" max="25" step="any" /></div>
            <div class="field"><label for="feedback-delam">DELAM</label><input id="feedback-delam" name="rateDelamPct" type="number" min="0" max="25" step="any" /></div>
            <div class="field"><label for="feedback-strength">STRENGTH</label><input id="feedback-strength" name="rateStrengthPct" type="number" min="0" max="25" step="any" /></div>
            <div class="field"><label for="feedback-print">PRINT</label><input id="feedback-print" name="ratePrintPct" type="number" min="0" max="25" step="any" /></div>
            <div class="field"><label for="feedback-crack">CRACK</label><input id="feedback-crack" name="rateCrackPct" type="number" min="0" max="25" step="any" /></div>
          </div>
        </fieldset>
        <div class="field"><label for="feedback-lot-id">Lot ID (optional)</label><input id="feedback-lot-id" name="lotId" /></div>
        <div class="field"><label for="feedback-photo-uri">Photo URI (optional)</label><input id="feedback-photo-uri" name="photoUri" /></div>
        <p class="muted">Enter observed production values only. Photo classification and feedback persistence are not configured.</p>
        <button type="submit" disabled data-i18n="submitFeedback" aria-describedby="feedback-result">Feedback unavailable</button>
      </form>
      <pre id="feedback-result" class="result" role="status" aria-live="polite">Not started — no feedback has been submitted.</pre>
    </section>

    <section class="card wide" aria-labelledby="job-sheet-title">
      <h2 id="job-sheet-title" data-i18n="jobSheet">Render a supplied JobSheet PDF</h2>
      <p class="muted">This local renderer validates and prints only the JobSheet JSON you provide. It does not create a job record, approve a job, or upload to Cloud Storage. Bundled Noto Sans fonts support Devanagari, Japanese, Korean and Simplified Chinese.</p>
      <form id="job-sheet-form">
        <label for="job-sheet-json" data-i18n="jobSheetInput">Validated JobSheet JSON</label>
        <textarea id="job-sheet-json" name="payload" placeholder="Paste a complete JobSheet object that has been produced by a genuine workflow."></textarea>
        <div class="actions"><button type="submit" data-i18n="render">Validate and render PDF</button><a id="pdf-link" class="link-button" hidden target="_blank" rel="noopener" data-i18n="openPdf">Open PDF to print</a></div>
      </form>
      <pre id="job-sheet-result" class="result" role="status" aria-live="polite" data-i18n="noJobSheet">No JobSheet rendered.</pre>
      <section id="local-job-sheet-preview" class="document-preview" hidden aria-labelledby="local-job-sheet-preview-title">
        <h3 id="local-job-sheet-preview-title">Locally validated supplied JobSheet</h3>
        <p class="muted">This preview is from the operator-supplied document accepted by the local renderer. It is not a generated, persisted, or approved production card.</p>
        <div id="local-job-sheet-sections"></div>
      </section>
    </section>
  </div>
</section>

<!-- ═══════════ SCREEN 4 — IMPACT EVIDENCE ═══════════ -->
<section class="screen" id="screen-impact" data-screen-panel aria-labelledby="screen-impact-heading" hidden>
  <header class="screen-heading">
    <p class="eyebrow">SCREEN 4</p>
    <h1 id="screen-impact-heading">Screen 4 — Impact evidence</h1>
    <p class="muted">Loads only the existing read-only Impact summary API. Query values are shown with their source period; no preview data is substituted.</p>
  </header>
  <section class="card wide" aria-labelledby="impact-summary-title">
    <h2 id="impact-summary-title">Impact summary</h2>
    <p class="muted">Load application and integration status on Screen 1 first. A configured adapter does not prove connectivity or data availability.</p>
    <button id="load-impact" type="button" disabled data-available-text="Load Impact summary" aria-describedby="impact-availability impact-result">Impact unavailable</button>
    <p id="impact-availability" class="muted" role="status">Check application status before requesting Impact data.</p>
    <pre id="impact-result" class="result" role="status" aria-live="polite">No Impact request made. No preview or sample values are displayed.</pre>
    <details class="diagnostics"><summary>Technical response details</summary><pre id="impact-result-diagnostic" class="result"></pre></details>
    <div id="impact-content" hidden>
      <p id="impact-coverage" class="notice" role="note"></p>
      <h3>September 2026 held-out evaluation — modelled counterfactual</h3>
      <p class="muted">The supplied evaluation SQL re-scores held-out synthetic lots with the generator's true rules under agent settings. Baseline/agent-setting differences are counterfactual estimates, not measured production outcomes, factory savings, or evidence of causation.</p>
      <div id="impact-kpis" class="metric-grid impact-metrics" aria-label="Held-out evaluation metrics"></div>
      <h3>Historical lot data returned by the supplied SQL</h3>
      <p class="muted">These are values from the historical lot tables, not verified real-world factory outcomes. Query coverage excludes dates on or after 1 October 2026.</p>
      <div class="impact-table-wrap">
        <table class="impact-table">
          <caption>Monthly lot history</caption>
          <thead><tr><th scope="col">Month</th><th scope="col">Lots</th><th scope="col">Scrap cost</th><th scope="col">Scrap kg</th><th scope="col">Average scrap %</th></tr></thead>
          <tbody id="impact-monthly"></tbody>
        </table>
      </div>
      <div class="impact-table-wrap">
        <table class="impact-table">
          <caption>Historical defect rates by season</caption>
          <thead><tr><th scope="col">Season</th><th scope="col">WARP %</th><th scope="col">DELAM %</th><th scope="col">STRENGTH %</th><th scope="col">PRINT %</th><th scope="col">CRACK %</th></tr></thead>
          <tbody id="impact-seasonal"></tbody>
        </table>
      </div>
      <div class="impact-table-wrap">
        <table class="impact-table">
          <caption>Highest-cost items in the supplied 12-month query window</caption>
          <thead><tr><th scope="col">Item code</th><th scope="col">Description</th><th scope="col">Lots</th><th scope="col">Average scrap %</th><th scope="col">Scrap cost</th><th scope="col">Main defect</th></tr></thead>
          <tbody id="impact-items"></tbody>
        </table>
      </div>
    </div>
  </section>
</section>

        </div><!-- /page -->
      </main>
    </div><!-- /app-shell -->
    <script type="module">
      import { formatDisplayCurrency } from "/display-currency.js";
      import { getDisplayableProductionAmounts } from "/money-contracts.js";
      import { toRiskPredictionPayload } from "/risk-ui.js";
      import { isImpactSummary } from "/impact-ui.js";
      import { translate } from "/localization.js";

      const requestFieldNames = {
        order: ${JSON.stringify(orderFields.map(([n]) => n))},
        riskOrder: ["itemCode", "quantity", "paperType", "paperSupplier"],
        conditions: ${JSON.stringify(conditionFields.map(([n]) => n))},
        riskConditions: ["shift", "ambientRhPct", "ambientTempC", "paperMoisturePct"],
        levers: ${JSON.stringify(leverFields.map(([n]) => n))},
      };
      const leverDefinitions = ${JSON.stringify(Object.fromEntries(leverFields
        .filter(([,,type]) => type === "number")
        .map(([name, label,, min, max, step]) => [name, { label, min, max, step }])))};

      const languagePreference = document.getElementById("language-preference");
      const t = (key) => translate(languagePreference.value, key);
      const appShell = document.querySelector(".app-shell");
      const sidebarToggle = document.getElementById("sidebar-toggle");
      const screenPanels = [...document.querySelectorAll("[data-screen-panel]")];
      const screenLinks = [...document.querySelectorAll("[data-screen-link]")];

      function showScreenFromHash() {
        const hashId = location.hash.slice(1);
        const target = hashId ? document.getElementById(hashId) : null;
        const panel = target?.matches("[data-screen-panel]")
          ? target
          : target?.closest("[data-screen-panel]") ?? screenPanels[0];
        for (const candidate of screenPanels) {
          candidate.hidden = candidate !== panel;
          candidate.classList.toggle("is-active", candidate === panel);
        }
        for (const link of screenLinks) {
          if (link.hash === "#" + panel.id) {
            link.setAttribute("aria-current", "page");
          } else {
            link.removeAttribute("aria-current");
          }
        }
        if (!location.hash) {
          history.replaceState(null, "", "#" + panel.id);
        }
      }

      window.addEventListener("hashchange", showScreenFromHash);
      showScreenFromHash();

      sidebarToggle.addEventListener("click", () => {
        const collapsed = appShell.dataset.sidebarCollapsed !== "true";
        appShell.dataset.sidebarCollapsed = String(collapsed);
        sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
        sidebarToggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
        sidebarToggle.dataset.tooltip = collapsed ? "Expand sidebar" : "Collapse sidebar";
      });

      function applyLanguage() {
        const language = languagePreference.value;
        document.documentElement.lang = language;
        document.querySelectorAll("[data-i18n]").forEach((element) => {
          if (element.dataset.updated === "true") return;
          element.textContent = translate(language, element.dataset.i18n);
        });
        document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
          element.setAttribute("aria-label", translate(language, element.dataset.i18nAria));
        });
        document.querySelectorAll("[data-sidebar-link]").forEach((link) => {
          const label = link.querySelector(".sidebar__label").textContent.trim();
          link.setAttribute("aria-label", label);
          link.dataset.tooltip = label;
        });
        document.querySelectorAll("button[data-i18n]").forEach((button) => {
          button.dataset.originalText = translate(language, button.dataset.i18n);
          if (button.dataset.busyKey) {
            button.textContent = translate(language, button.dataset.busyKey);
          }
        });
      }

      const setResult = (id, message, state = "idle") => {
        const output = document.getElementById(id);
        output.dataset.state = state;
        output.dataset.updated = "true";
        output.setAttribute("aria-busy", String(state === "loading"));
        output.textContent = message;
      };

      const API_BASE_URL = window.location.origin;
      function apiUrl(path) {
        const resolved = new URL(path, API_BASE_URL);
        if (resolved.origin !== API_BASE_URL) {
          throw new Error("API requests must use the current application origin.");
        }
        return resolved.toString();
      }

      function showBackendUnavailable() {
        document.getElementById("backend-availability").textContent = "Unreachable";
        document.getElementById("service-availability-summary").textContent =
          "Backend unreachable · production capabilities unknown";
      }

      function updateConditionsAvailability(response, payload) {
        const target = document.getElementById("current-conditions-availability");
        if (response.ok) {
          target.textContent = "Sensor reading returned by backend";
        } else if (payload?.error?.code === "SERVICE_UNAVAILABLE") {
          target.textContent = "Unavailable: backend has no usable sensor reading";
        } else {
          target.textContent = "Request failed; sensor data not verified";
        }
      }

      function applyRuntimeAvailability(status = {}) {
        const runtimeMode = status.mode === "cloud-run" ? "Cloud Run" : "Local development";
        document.getElementById("runtime-mode-sidebar").textContent = runtimeMode;
        document.getElementById("runtime-mode-header").textContent = runtimeMode;
        document.getElementById("backend-availability").textContent =
          status.backendReachable === true ? "Reachable" : "Unreachable";
        document.getElementById("production-adapters-availability").textContent =
          status.runtimeAvailability?.productionAdaptersConfigured === true
            ? "Configured; connectivity not checked" : "None configured";
        document.getElementById("model-calls-availability").textContent =
          status.runtimeAvailability?.liveModelCallsEnabled === true
            ? "Enabled; model connectivity not checked" : "Disabled by runtime configuration";
        const conditions = status.runtimeAvailability?.currentConditions;
        document.getElementById("current-conditions-availability").textContent =
          conditions?.adapterConfigured === true
            ? "Adapter configured; sensor reading not checked" : "Adapter not configured";
        document.getElementById("job-persistence-availability").textContent =
          status.runtimeAvailability?.jobSheetPersistenceAvailable === true
            ? "Configured; persistence not tested" : "Not configured";
        document.getElementById("job-idempotency-availability").textContent =
          status.runtimeAvailability?.durableIdempotencyConfigured === true
            ? "Configured; claim operation not tested" : "Not configured";
        document.getElementById("job-creation-availability").textContent =
          status.runtimeAvailability?.jobCreationAvailable === true
            ? "Configured; end-to-end operation not tested"
            : "Unavailable: persistence and durable idempotency are both required";
        latestIntegrations.jobCreationAvailable =
          status.runtimeAvailability?.jobCreationAvailable === true;
        applyIntegrationAvailability(latestIntegrations);
        document.getElementById("service-availability-summary").textContent =
          status.backendReachable === true
            ? "Backend reachable · production adapter status shown below"
            : "Backend unreachable · production capabilities unknown";
        document.getElementById("runtime-availability-note").textContent =
          "Backend reachability is verified by this status response. Adapter configuration does not prove cloud connectivity, current sensor data, or successful persistence.";
        if (status.runtimeAvailability?.currentConditions?.adapterConfigured !== true) {
          document.getElementById("current-conditions-availability").textContent = "Adapter not configured";
        }
      }

      function humanizeFieldName(name) {
        return name.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
      }

      function renderFieldList(targetId, values) {
        const target = document.getElementById(targetId);
        target.replaceChildren();
        for (const [key, value] of Object.entries(values)) {
          if (value === undefined || value === null || typeof value === "object") continue;
          const term = document.createElement("dt");
          term.textContent = humanizeFieldName(key);
          const description = document.createElement("dd");
          description.textContent = String(value);
          target.append(term, description);
        }
        target.hidden = target.childElementCount === 0;
      }

      function renderJobSheetPreview(sheet) {
        const target = document.getElementById("local-job-sheet-sections");
        target.replaceChildren();
        const groups = [
          ["Job", { jobId: sheet.jobId, plantId: sheet.plantId, status: sheet.status }],
          ["Order", sheet.order],
          ["Production conditions", sheet.conditions],
          ["Baseline settings", sheet.baseline?.levers],
          ["Baseline risk", sheet.baseline?.risk?.ratesPct],
          ["Recommended settings", sheet.recommended?.levers],
          ["Recommended risk", sheet.recommended?.risk?.ratesPct],
          ["Savings", sheet.savings],
        ];
        for (const [label, values] of groups) {
          if (!values || typeof values !== "object") continue;
          const section = document.createElement("section");
          section.className = "document-preview__section";
          const heading = document.createElement("h4");
          heading.textContent = label;
          const fields = document.createElement("dl");
          fields.className = "field-list";
          for (const [key, value] of Object.entries(values)) {
            if (value === undefined || value === null || typeof value === "object") continue;
            const term = document.createElement("dt");
            term.textContent = humanizeFieldName(key);
            const description = document.createElement("dd");
            description.textContent = String(value);
            fields.append(term, description);
          }
          if (fields.childElementCount) {
            section.append(heading, fields);
            target.append(section);
          }
        }
        const explanation = document.createElement("p");
        explanation.className = "document-preview__explanation";
        explanation.textContent = sheet.explanation;
        target.append(explanation);
        const preview = document.getElementById("local-job-sheet-preview");
        preview.hidden = false;
      }

      function setDiagnostic(outputId, payload) {
        const diagnostic = document.getElementById(outputId + "-diagnostic");
        if (diagnostic) {
          diagnostic.textContent = payload === undefined ? "" : JSON.stringify(payload, null, 2);
        }
      }

      function clearStructuredResponse(outputId) {
        if (outputId === "impact-result") {
          clearImpactSummary();
          return;
        }
        const targetId = {
          "conditions-result": "conditions-fields",
          "risk-result": "risk-metrics",
          "what-if-result": "what-if-metrics",
          "optimization-result": "optimization-settings",
        }[outputId];
        if (!targetId) return;
        const target = document.getElementById(targetId);
        target.replaceChildren();
        target.hidden = true;
        if (outputId === "optimization-result") {
          const changes = document.getElementById("optimization-changes");
          changes.replaceChildren();
          changes.hidden = true;
        }
      }

      function clearImpactSummary() {
        document.getElementById("impact-content").hidden = true;
        document.getElementById("impact-kpis").replaceChildren();
        for (const id of ["impact-monthly", "impact-seasonal", "impact-items"]) {
          document.getElementById(id).replaceChildren();
        }
        document.getElementById("impact-coverage").textContent = "";
      }

      function impactMoney(amount, currency) {
        return currency + " " + amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
      }

      function appendImpactMetric(label, value) {
        const card = document.createElement("div");
        card.className = "metric";
        const title = document.createElement("span");
        title.className = "metric__label";
        title.textContent = label;
        const result = document.createElement("strong");
        result.className = "metric__value";
        result.textContent = value;
        card.append(title, result);
        document.getElementById("impact-kpis").append(card);
      }

      function renderImpactTable(bodyId, rows, columns) {
        const body = document.getElementById(bodyId);
        if (rows.length === 0) {
          const row = document.createElement("tr");
          const cell = document.createElement("td");
          cell.colSpan = columns.length;
          cell.textContent = "No rows returned by the Impact query.";
          row.append(cell);
          body.append(row);
          return;
        }
        for (const values of rows) {
          const row = document.createElement("tr");
          for (const value of values) {
            const cell = document.createElement("td");
            cell.textContent = String(value);
            row.append(cell);
          }
          body.append(row);
        }
      }

      function renderImpactSummary(payload) {
        if (!isImpactSummary(payload)) {
          throw new Error("The Impact endpoint returned malformed data; no results were displayed.");
        }
        const { kpis, counterfactual } = payload;
        const lastMonth = payload.monthly.reduce(
          (latest, row) => row.month > latest ? row.month : latest, "");
        const queryStatus = payload.source === "bigquery-cache"
          ? "Cached successful BigQuery response (cache lifetime: at most one hour)."
          : "Queried from BigQuery for this request.";
        const latestMonth = lastMonth
          ? " Latest returned monthly row: " + lastMonth + "."
          : " The monthly query returned no rows.";
        document.getElementById("impact-coverage").textContent =
          queryStatus + " SQL coverage: records before 1 October 2026." + latestMonth;
        appendImpactMetric("Held-out lots scored", String(kpis.lotsScored));
        appendImpactMetric("Lots with changed settings", String(kpis.lotsChanged));
        appendImpactMetric("Estimated net savings after throughput penalty", impactMoney(kpis.netSavingMonth, kpis.currency));
        appendImpactMetric("Estimated scrap difference (kg)", String(kpis.kgSavedMonth));
        appendImpactMetric("Held-out baseline scrap cost", impactMoney(kpis.scrapCostBefore, kpis.currency));
        appendImpactMetric("Agent-settings scrap cost before throughput penalty", impactMoney(kpis.scrapCostAfter, kpis.currency));
        appendImpactMetric("Implied modelled cost after throughput penalty", impactMoney(counterfactual.scrapCost, counterfactual.currency));
        appendImpactMetric("Held-out baseline scrap rate", kpis.scrapPctBefore + "%");
        appendImpactMetric("Agent-settings counterfactual scrap rate", kpis.scrapPctAfter + "%");
        renderImpactTable("impact-monthly", payload.monthly.map((row) => [
          row.month, row.lots, impactMoney(row.scrapCost, kpis.currency), row.scrapKg, row.avgScrapPct + "%",
        ]), ["month", "lots", "scrap cost", "scrap kg", "average scrap"]);
        renderImpactTable("impact-seasonal", payload.seasonal.map((row) => [
          row.season, row.warp + "%", row.delam + "%", row.strength + "%", row.print + "%", row.crack + "%",
        ]), ["season", "warp", "delam", "strength", "print", "crack"]);
        renderImpactTable("impact-items", payload.topItems.map((row) => [
          row.itemCode, row.description, row.lots, row.avgScrapPct + "%",
          impactMoney(row.scrapCost12m, kpis.currency), row.mainDefect,
        ]), ["item code", "description", "lots", "average scrap", "scrap cost", "main defect"]);
        document.getElementById("impact-content").hidden = false;
      }

      function renderStructuredResponse(outputId, payload) {
        if (!payload || payload.source === "mock-demo" ||
            (payload.isRealModelPrediction === false && outputId !== "conditions-result")) return;
        if (outputId === "upload-result" && payload.orderProfile &&
            typeof payload.orderProfile === "object") {
          renderFieldList("extracted-order-fields", payload.orderProfile);
          return;
        }
        if (outputId === "conditions-result") {
          const data = payload.data ?? payload;
          if (data && typeof data === "object" &&
              ["runDate", "shift", "ambientRhPct", "ambientTempC", "paperMoisturePct"]
                .every((field) => Object.hasOwn(data, field))) {
            const sensorSource = {
              simulated: "Simulated sensor data",
              live: "Live sensor data",
              unverified: "Source unverified",
            }[payload.sensorSource] ?? "Source not supplied";
            const provenance = payload.provenance ?? {};
            renderFieldList("conditions-fields", {
              runDate: data.runDate,
              shift: data.shift,
              ambientRhPct: String(data.ambientRhPct) + " % RH",
              ambientTempC: String(data.ambientTempC) + " °C",
              paperMoisturePct: String(data.paperMoisturePct) + " %",
              sensorSource,
              plantId: provenance.plantId,
              readingId: provenance.readingId,
              readingTimestamp: provenance.timestamp,
              readingAgeSeconds: provenance.ageSeconds,
              freshness: provenance.freshness,
            });
          }
          return;
        }
        if (outputId === "risk-result" || outputId === "what-if-result") {
          const risk = payload.ratesPct ? payload : payload.risk;
          const defects = ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"];
          if (!risk?.ratesPct || !defects.every((defect) => Number.isFinite(risk.ratesPct[defect]))) return;
          const metrics = document.getElementById(outputId === "risk-result" ? "risk-metrics" : "what-if-metrics");
          metrics.replaceChildren();
          for (const defect of defects) {
            const card = document.createElement("div");
            card.className = "metric";
            const label = document.createElement("span");
            label.className = "metric__label";
            label.textContent = defect;
            const value = document.createElement("strong");
            value.className = "metric__value";
            value.textContent = risk.ratesPct[defect] + "%";
            card.append(label, value);
            metrics.append(card);
          }
          metrics.hidden = false;
          return;
        }
        if (outputId === "optimization-result" && payload.best?.levers &&
            Array.isArray(payload.changes)) {
          renderFieldList("optimization-settings", payload.best.levers);
          const target = document.getElementById("optimization-changes");
          target.replaceChildren();
          if (payload.changes.length) {
            const heading = document.createElement("h3");
            heading.textContent = "Provisional model-predicted changes (not plant-approved)";
            const list = document.createElement("ul");
            for (const change of payload.changes) {
              if (!change || typeof change.lever !== "string" ||
                  !Object.hasOwn(change, "from") || !Object.hasOwn(change, "to") ||
                  typeof change.reason !== "string") continue;
              const item = document.createElement("li");
              item.textContent = humanizeFieldName(change.lever) + ": " + change.from +
                " → " + change.to + " — " + change.reason;
              list.append(item);
            }
            target.append(heading, list);
          }
          if (typeof payload.note === "string") {
            const note = document.createElement("p");
            note.className = "muted";
            note.textContent = payload.note;
            target.append(note);
          }
          target.hidden = target.childElementCount === 0;
        }
      }

      async function appendDisplayOnlyMoney(text, payload) {
        const amounts = getDisplayableProductionAmounts(payload);
        if (amounts.length === 0) return text;
        const target = document.getElementById("display-currency").value;
        const language = languagePreference.value;
        const lines = await Promise.all(amounts.map(async (entry) => {
          try {
            const { response, payload: rates } = await sendRequest(
              "/fx?base=" + encodeURIComponent(entry.currency),
              { headers: { Accept: "application/json" } }
            );
            if (!response.ok) {
              let original;
              try {
                original = new Intl.NumberFormat("en-IN", {
                  style: "currency", currency: entry.currency,
                }).format(entry.amount);
              } catch { original = entry.amount + " " + entry.currency; }
              return entry.path + ": display conversion unavailable; original " + original;
            }
            const converted = formatDisplayCurrency({
              amount: entry.amount, from: entry.currency, to: target, language, rates,
            });
            const source = converted.source === "frankfurter"
              ? t("frankfurterSource") : t("fallbackSource");
            return entry.path + ": " + t("currencyOriginal") + ": " + converted.original +
              " → " + t("currencyApprox") + ": ≈ " + converted.converted +
              " (" + t("rateDateLabel") + ": " + converted.date + ", " + t("sourceLabel") + ": " + source +
              (converted.stale ? ", " + t("staleRate") : "") + ")";
          } catch {
            return entry.path + ": " + t("conversionUnavailable") + " " + t("unchanged");
          }
        }));
        return text + "\\n\\n" + t("currencyApprox") + " (" + t("unchanged") + "):\\n" +
          lines.join("\\n");
      }

      async function sendRequest(url, options = {}) {
        let response;
        try {
          response = await fetch(apiUrl(url), options);
        } catch {
          throw new Error(t("networkError"));
        }
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/pdf")) {
          if (!response.ok) throw new Error(t("requestFailed"));
          return { response, pdf: await response.blob() };
        }
        let payload;
        try { payload = await response.json(); } catch { throw new Error(t("unreadable")); }
        return { response, payload };
      }

      function describeResponse(response, payload) {
        if (response.ok) {
          const adapterNote = payload?.source === "offline-test-adapter"
            ? " OFFLINE TEST ADAPTER — no production data was read or written."
            : "";
          return "HTTP " + response.status + " — response received. Review the structured result and expand technical details if needed." +
            adapterNote;
        }
        const code = payload?.error?.code;
        const serverMessage = typeof payload?.error?.message === "string" ? payload.error.message : "";
        const blockedAtKeys = {
          extractOrder: "blockedAtExtractOrder",
          getConditions: "blockedAtGetConditions",
          predictRisk: "blockedAtPredictRisk",
          optimizeLevers: "blockedAtOptimizeLevers",
          findSimilarRuns: "blockedAtFindSimilarRuns",
          explainRisk: "blockedAtExplainRisk",
          generateJobSheet: "blockedAtGenerateJobSheet",
        };
        const messages = {
          VALIDATION_ERROR: t("validation"),
          SERVICE_UNAVAILABLE: t("unavailable"),
          REQUEST_TIMEOUT: "The request exceeded the 60-second processing deadline.",
          RATE_LIMIT_EXCEEDED: "Too many requests. Wait before retrying.",
          RATE_LIMIT_CAPACITY: "Request rate limiting is temporarily at capacity. Retry later.",
          CLIENT_IP_UNAVAILABLE: "The server could not safely identify the request client.",
          PAYLOAD_TOO_LARGE: "The request exceeds the server's 10 MiB limit.",
          PDF_FONT_UNAVAILABLE: "A required Noto Sans font is unavailable; the PDF was not rendered.",
          CONFLICT: serverMessage || t("conflictGeneric"),
          IDEMPOTENCY_IN_PROGRESS: serverMessage || t("idempotencyInProgress"),
          NOT_FOUND: serverMessage || t("notFoundGeneric"),
        };
        const message = messages[code] || t("requestFailed");
        const blockedAt = typeof payload?.blockedAt === "string" && blockedAtKeys[payload.blockedAt]
          ? t(blockedAtKeys[payload.blockedAt]) : "";
        const issues = code === "VALIDATION_ERROR" && Array.isArray(payload?.error?.issues)
          ? payload.error.issues
              .filter((issue) => typeof issue?.field === "string" && typeof issue?.message === "string")
              .map((issue) => issue.field + ": " + issue.message)
              .join("\\n")
          : "";
        return "HTTP " + response.status + (code ? " - " + code : "") + ": " + message +
          (blockedAt ? "\\n" + blockedAt : "") + (issues ? "\\n" + issues : "");
      }

      async function runJsonRequest({ url, options = {}, outputId, button, idleText, onSuccess }) {
        button.dataset.originalText ||= button.textContent;
        button.disabled = true;
        button.dataset.busyKey = "loading";
        button.textContent = t(button.dataset.busyKey);
        setDiagnostic(outputId, undefined);
        clearStructuredResponse(outputId);
        setResult(outputId, t("progress"), "loading");
        try {
          const { response, payload } = await sendRequest(url, options);
          const unavailable = payload?.error?.code === "SERVICE_UNAVAILABLE";
          setDiagnostic(outputId, payload);
          if (outputId === "conditions-result") updateConditionsAvailability(response, payload);
          if (response.ok) {
            renderStructuredResponse(outputId, payload);
            if (outputId === "status-result") {
              applyIntegrationAvailability(payload.integrations);
              applyRuntimeAvailability(payload);
            }
            if (typeof onSuccess === "function") onSuccess(payload);
          } else if (outputId === "status-result") {
            showBackendUnavailable();
          }
          const description = response.ok
            ? await appendDisplayOnlyMoney(describeResponse(response, payload), payload)
            : describeResponse(response, payload);
          setResult(outputId, description, unavailable ? "unavailable" : response.ok ? "success" : "error");
          button.dataset.busyKey = "";
          button.textContent = response.ok ? button.dataset.originalText : t("retry");
          return payload;
        } catch (error) {
          if (outputId === "status-result") showBackendUnavailable();
          if (outputId === "conditions-result") {
            document.getElementById("current-conditions-availability").textContent =
              "Request failed; sensor data not verified";
          }
          setResult(outputId, error.message, "error");
          button.dataset.busyKey = "";
          button.textContent = t("retry");
          return undefined;
        } finally {
          button.disabled = false;
        }
      }

      let latestIntegrations = {};
      function applyIntegrationAvailability(integrations = latestIntegrations) {
        latestIntegrations = integrations ?? {};
        const controls = [
          ["jobCreationAvailable", document.getElementById("prepare-job"), "prepareJobSheet"],
          ["currentConditions", document.querySelector("button[data-json-get='/conditions/current']"), "loadConditions"],
          ["predictRisk", document.getElementById("request-risk"), "requestRisk"],
          ["optimizeRisk", document.getElementById("request-optimization"), "requestOptimization"],
          ["findSimilarRuns", document.getElementById("load-similar-runs"), null],
          ["explainRisk", document.getElementById("request-risk-explanation"), null],
          ["approveJob", document.querySelector("#approval-form button[type=submit]"), "approveJob"],
          ["getJobCard", document.querySelector("#stored-card-form button[type=submit]"), "fetchCard"],
          ["saveFeedback", document.querySelector("#feedback-form button[type=submit]"), "submitFeedback"],
          ["getStoredJobSheet", document.querySelector("#load-stored-job-form button[type=submit]"), "loadStoredJob"],
          ["getImpactSummary", document.getElementById("load-impact"), "loadImpact"],
        ];
        for (const [key, button, availableKey] of controls) {
          if (!button) continue;
          const available = integrations[key] === true;
          button.disabled = !available;
          button.textContent = available
            ? (availableKey ? t(availableKey) : button.dataset.availableText)
            : t("unavailable");
          button.dataset.updated = "true";
          button.setAttribute("aria-disabled", String(!available));
        }
        const setWorkflowBadge = (id, configured, readyText, unavailableText) => {
          const badge = document.getElementById(id);
          if (!badge) return;
          badge.textContent = configured ? readyText : unavailableText;
          badge.dataset.updated = "true";
          badge.dataset.workflowState = configured ? "configured" : "blocked";
        };
        const extractionConfigured = latestIntegrations.extractOrder === true;
        setWorkflowBadge("extraction-workflow-badge", extractionConfigured,
          "Extraction adapter configured", "Extraction unavailable");
        const analysisConfigured = [
          "currentConditions", "predictRisk", "optimizeRisk", "findSimilarRuns", "explainRisk",
        ].every((key) => latestIntegrations[key] === true);
        setWorkflowBadge("analysis-workflow-badge", analysisConfigured,
          "Analysis adapters configured",
          "Unavailable: required production analysis adapters are not configured");
        const approvalConfigured = latestIntegrations.jobCreationAvailable === true &&
          latestIntegrations.getStoredJobSheet === true &&
          latestIntegrations.approveJob === true &&
          latestIntegrations.getJobCard === true;
        setWorkflowBadge("approval-workflow-badge", approvalConfigured,
          "Durable job creation, retrieval and approval adapters configured",
          "Unavailable: durable JobSheet persistence, idempotency and approval are required");
        const impactAvailability = document.getElementById("impact-availability");
        if (impactAvailability) {
          impactAvailability.textContent = latestIntegrations.getImpactSummary === true
            ? "Impact adapter is configured; load the summary to check data availability."
            : "Impact data is unavailable because its read-only integration is not configured.";
        }
        const extractionDescription = document.getElementById("extraction-workflow-description");
        if (extractionDescription) {
          extractionDescription.textContent = extractionConfigured
            ? "Required input: an operator-supplied PDF or JPEG scan. Extraction uses the configured backend adapter; a request is still required to verify service connectivity."
            : "Required input: an operator-supplied PDF or JPEG scan. The same-origin backend validates the file, but no extraction adapter is configured.";
          extractionDescription.dataset.updated = "true";
        }
        const similarRunsAvailability = document.getElementById("similar-runs-availability");
        if (similarRunsAvailability) {
          similarRunsAvailability.textContent = latestIntegrations.findSimilarRuns === true
            ? "Historical observations are loaded only when requested; they are not predictions for this order."
            : "Unavailable — the approved BigQuery similarity query and genuine production data are not configured.";
        }
        syncRiskExplanationAvailability();
      }

      document.querySelectorAll("[data-json-get]").forEach((button) => {
        button.addEventListener("click", () => {
          let url = button.dataset.jsonGet;
          if (url === "/conditions/current") {
            const shift = document.getElementById("analysis-shift").value;
            if (!shift) {
              setResult(button.dataset.output, t("selectShift"), "error");
              return;
            }
            url += "?shift=" + encodeURIComponent(shift);
          }
          return runJsonRequest({
            url,
            outputId: button.dataset.output,
            button,
            options: { headers: { Accept: "application/json" } },
          });
        });
      });

      document.getElementById("load-impact").addEventListener("click", (event) => {
        const button = event.currentTarget;
        return runJsonRequest({
          url: "/impact/summary",
          outputId: "impact-result",
          button,
          options: { headers: { Accept: "application/json" } },
          onSuccess: renderImpactSummary,
        });
      });

      languagePreference.addEventListener("change", () => {
        applyLanguage();
        applyIntegrationAvailability();
      });
      applyLanguage();

      const orderFile = document.getElementById("order-pdf");
      const dropzone = document.getElementById("order-dropzone");
      const selectedFileName = document.getElementById("selected-file-name");
      let activePurchaseOrderReview;
      let selectedReviewLineIndex;

      function clearPurchaseOrderReview() {
        activePurchaseOrderReview = undefined;
        selectedReviewLineIndex = undefined;
        document.getElementById("purchase-order-review").hidden = true;
        document.getElementById("purchase-order-document-fields").replaceChildren();
        document.getElementById("purchase-order-lines").replaceChildren();
        document.getElementById("purchase-order-document-missing").textContent = "";
        document.getElementById("confirm-order-line").checked = false;
      }

      function appendReviewField(list, label, value) {
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = value ?? "Not extracted";
        list.append(term, description);
      }

      function renderPurchaseOrderReview(payload) {
        activePurchaseOrderReview = payload;
        selectedReviewLineIndex = undefined;
        const panel = document.getElementById("purchase-order-review");
        const metadata = document.getElementById("purchase-order-document-fields");
        const missing = document.getElementById("purchase-order-document-missing");
        const lines = document.getElementById("purchase-order-lines");
        const documentData = payload.purchaseOrderDocument ?? {};
        metadata.replaceChildren();
        lines.replaceChildren();
        appendReviewField(metadata, "PO number (extracted)", documentData.poNumber);
        appendReviewField(metadata, "Buyer (extracted)", documentData.buyer);
        appendReviewField(metadata, "Delivery date (extracted)", documentData.deliveryDate);
        const missingFields = Array.isArray(payload.documentMissingFields)
          ? payload.documentMissingFields : [];
        missing.textContent = missingFields.length
          ? "Document metadata not extracted or invalid: " + missingFields.join(", ") +
            ". Confirm the required PO number in operator order context; do not infer missing buyer/date values."
          : "All supported document-level fields were extracted.";
        for (const line of payload.lines ?? []) {
          const row = document.createElement("li");
          row.className = "po-line-review__item";
          row.dataset.lineIndex = String(line.lineIndex);
          const title = document.createElement("h4");
          title.textContent = "Source line " + String(line.lineIndex + 1) +
            " · Page " + (line.sourcePage ?? "unverified");
          row.append(title);
          const facts = document.createElement("p");
          facts.textContent = "Extracted item code: " + (line.extractedItemCode ?? "Missing") +
            " · Extracted quantity: " + (line.quantity ?? "Missing") +
            " · Line validation: " + (line.validationIssues?.length
              ? "MALFORMED (" + line.validationIssues.join(", ") + ")"
              : line.status);
          row.append(facts);
          const catalog = document.createElement("p");
          catalog.textContent = "Catalog outcome: " + (line.catalogStatus ?? line.status);
          row.append(catalog);
          if (line.validationIssues?.length) {
            const warning = document.createElement("p");
            warning.className = "muted";
            warning.textContent = "Review the original line and correct the invalid extracted fields below.";
            row.append(warning);
          }
          if (line.candidates?.length) {
            const candidateLabel = document.createElement("label");
            candidateLabel.textContent = "Catalog candidates returned for this line";
            const candidates = document.createElement("select");
            candidates.dataset.role = "catalog-candidates";
            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "Select an actual catalog candidate";
            candidates.append(placeholder);
            for (const code of line.candidates) {
              const option = document.createElement("option");
              option.value = code;
              option.textContent = code;
              candidates.append(option);
            }
            candidates.addEventListener("change", () => {
              if (candidates.value) codeInput.value = candidates.value;
              document.getElementById("confirm-order-line").checked = false;
            });
            candidateLabel.append(candidates);
            row.append(candidateLabel);
          }
          const fields = document.createElement("div");
          fields.className = "field-grid";
          const codeField = document.createElement("div");
          codeField.className = "field";
          const codeLabel = document.createElement("label");
          codeLabel.textContent = "Operator-confirmed item code";
          const codeInput = document.createElement("input");
          codeInput.type = "text";
          codeInput.autocomplete = "off";
          codeInput.value = line.extractedItemCode ?? "";
          codeInput.dataset.role = "confirmed-item-code";
          codeLabel.append(codeInput);
          codeField.append(codeLabel);
          const quantityField = document.createElement("div");
          quantityField.className = "field";
          const quantityLabel = document.createElement("label");
          quantityLabel.textContent = "Operator-confirmed quantity";
          const quantityInput = document.createElement("input");
          quantityInput.type = "number";
          quantityInput.min = "1";
          quantityInput.step = "1";
          quantityInput.value = line.quantity === undefined ? "" : String(line.quantity);
          quantityInput.dataset.role = "confirmed-quantity";
          quantityLabel.append(quantityInput);
          quantityField.append(quantityLabel);
          fields.append(codeField, quantityField);
          row.append(fields);
          for (const input of [codeInput, quantityInput]) {
            input.addEventListener("input", () => {
              document.getElementById("confirm-order-line").checked = false;
            });
          }
          const chooseLabel = document.createElement("label");
          chooseLabel.className = "po-line-review__select";
          const choose = document.createElement("input");
          choose.type = "radio";
          choose.name = "selected-po-line";
          choose.value = String(line.lineIndex);
          choose.setAttribute("aria-label", "Select source PO line " + String(line.lineIndex + 1));
          choose.addEventListener("change", () => {
            selectedReviewLineIndex = line.lineIndex;
            document.getElementById("confirm-order-line").checked = false;
          });
          chooseLabel.append(choose, document.createTextNode("Use this exact source line"));
          row.append(chooseLabel);
          lines.append(row);
        }
        document.getElementById("confirm-order-line").checked = false;
        panel.hidden = false;
      }

      document.getElementById("review-order").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const file = orderFile.files[0];
        if (!validateSelectedFile(file)) return;
        const fields = {
          orderId: document.getElementById("extraction-order-id"),
          paperType: document.getElementById("extraction-paper-type"),
          paperSupplier: document.getElementById("extraction-paper-supplier"),
        };
        const body = new FormData();
        body.append("file", file);
        for (const [name, input] of Object.entries(fields)) {
          if (!input.value) {
            const fieldLabels = {
              orderId: "purchase order ID",
              paperType: "loaded paper type",
              paperSupplier: "loaded paper supplier",
            };
            setResult("upload-result",
              "Enter the operator-confirmed " + fieldLabels[name] + " before extraction.", "error");
            input.reportValidity();
            return;
          }
          if (!input.reportValidity()) return;
          body.append(name, input.value);
        }
        await runJsonRequest({
          url: "/orders/extract",
          options: { method: "POST", body },
          outputId: "upload-result",
          button,
          onSuccess: (payload) => {
            if (payload?.reviewId && payload?.reviewFingerprint && Array.isArray(payload.lines)) {
              renderPurchaseOrderReview(payload);
            }
          },
        });
      });

      document.getElementById("confirm-order-line").addEventListener("change", (event) => {
        if (event.currentTarget.checked && selectedReviewLineIndex === undefined) {
          event.currentTarget.checked = false;
          setResult("upload-result", "Select one extracted PO line before confirming it.", "error");
        }
      });

      for (const id of ["extraction-order-id", "extraction-paper-type", "extraction-paper-supplier"]) {
        document.getElementById(id).addEventListener("input", clearPurchaseOrderReview);
        document.getElementById(id).addEventListener("change", clearPurchaseOrderReview);
      }

      orderFile.addEventListener("change", () => {
        clearPurchaseOrderReview();
      });

      function validateSelectedFile(file) {
        dropzone.dataset.state = "";
        if (!file) {
          selectedFileName.textContent = "No file selected";
          setResult("upload-result",
            "Select a PDF or JPEG scan before submitting it for extraction and PO-line review.", "error");
          return false;
        }
        selectedFileName.textContent = file.name + " · " +
          (file.size / (1024 * 1024)).toFixed(2) + " MiB";
        const lowerName = file.name.toLowerCase();
        const pdf = lowerName.endsWith(".pdf") &&
          (!file.type || file.type === "application/pdf" || file.type === "application/octet-stream");
        const jpeg = (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) &&
          (!file.type || file.type === "image/jpeg" || file.type === "application/octet-stream");
        if (!pdf && !jpeg) {
          dropzone.dataset.state = "error";
          setResult("upload-result",
            "Select a PDF or JPEG scan. The server verifies its signature before accepting the file.", "error");
          return false;
        }
        if (file.size > 10 * 1024 * 1024) {
          dropzone.dataset.state = "error";
          setResult("upload-result", "This file exceeds the 10 MiB request limit.", "error");
          return false;
        }
        dropzone.dataset.state = "selected";
        setResult("upload-result",
          "Purchase-order document selected. Submit it for extraction and PO-line review.", "incomplete");
        return true;
      }

      orderFile.addEventListener("change", () => validateSelectedFile(orderFile.files[0]));
      for (const eventName of ["dragenter", "dragover"]) {
        dropzone.addEventListener(eventName, (event) => {
          event.preventDefault();
          dropzone.dataset.dragging = "true";
        });
      }
      for (const eventName of ["dragleave", "drop"]) {
        dropzone.addEventListener(eventName, (event) => {
          event.preventDefault();
          delete dropzone.dataset.dragging;
        });
      }
      dropzone.addEventListener("drop", (event) => {
        const [file] = event.dataTransfer.files;
        if (!file) return;
        const transfer = new DataTransfer();
        transfer.items.add(file);
        orderFile.files = transfer.files;
        validateSelectedFile(file);
      });

      function readFieldGroup(containerId, fieldNames) {
        const result = {};
        for (const name of fieldNames) {
          const control = document.querySelector("#" + containerId + ' [name="' + name + '"]');
          if (!control || !control.reportValidity()) return null;
          result[name] = control.type === "number" || name === "ply"
            ? Number(control.value) : control.value;
        }
        return result;
      }

      async function submitAnalysisRequest(kind) {
        const orderFieldsForRequest = kind === "risk" ? requestFieldNames.riskOrder : requestFieldNames.order;
        const conditionFieldsForRequest = kind === "risk" ? requestFieldNames.riskConditions : requestFieldNames.conditions;
        const order = readFieldGroup("order-profile-fields", orderFieldsForRequest);
        if (!order) return;
        const conditions = readFieldGroup("condition-request-fields", conditionFieldsForRequest);
        if (!conditions) return;
        let payload = { order, conditions };
        let outputId = "optimization-result";
        let onSuccess;
        let generation;
        if (kind === "risk") {
          invalidateAnalysisResults(false);
          generation = analysisGeneration;
          document.getElementById("what-if-controls").hidden = true;
          document.getElementById("what-if-controls").disabled = true;
          document.getElementById("what-if-unavailable").hidden = false;
          const settings = document.querySelector(".settings-disclosure");
          settings.open = true;
          const levers = readFieldGroup("lever-request-fields", requestFieldNames.levers);
          if (!levers) return;
          payload = toRiskPredictionPayload({ order, conditions, levers });
          outputId = "risk-result";
          onSuccess = (result) => {
            if (generation !== analysisGeneration || !result || result.source !== "bigquery-ml" ||
                result.isRealModelPrediction !== true || !result.ratesPct) return;
            latestRiskPayload = payload;
            latestRiskResult = pickRiskResult(result);
            document.getElementById("what-if-controls").hidden = false;
            document.getElementById("what-if-controls").disabled = false;
            document.getElementById("what-if-unavailable").hidden = true;
            syncWhatIfControl();
            syncRiskExplanationAvailability();
          };
        } else {
          generation = analysisGeneration;
          latestOptimizationResult = null;
          latestSimilarRuns = null;
          latestSimilarRunsSource = null;
          syncRiskExplanationAvailability();
          onSuccess = (result) => {
            if (generation !== analysisGeneration || !result || result.source !== "bigquery-ml" ||
                result.isRealModelPrediction !== true || !result.baseline ||
                !result.best || !Array.isArray(result.changes) || !result.savings) return;
            latestOptimizationResult = pickOptimizationResult(result);
            syncRiskExplanationAvailability();
          };
        }
        const button = document.getElementById(kind === "risk" ? "request-risk" : "request-optimization");
        await runJsonRequest({
          url: kind === "risk" ? "/risk/predict" : "/risk/optimize",
          options: {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload),
          },
          outputId,
          button,
          onSuccess,
        });
        if (generation !== analysisGeneration) {
          clearStructuredResponse(outputId);
          setResult(outputId, "Inputs changed while this request was running. Its response was discarded; retry with the current inputs.", "incomplete");
        }
      }

      let latestRiskPayload = null;
      let latestRiskResult = null;
      let latestOptimizationResult = null;
      let latestSimilarRuns = null;
      let latestSimilarRunsSource = null;
      let analysisGeneration = 0;

      function pickRiskResult(result) {
        return {
          ratesPct: result.ratesPct,
          ...(result.totalScrapPct === undefined ? {} : { totalScrapPct: result.totalScrapPct }),
          totalScrapKg: result.totalScrapKg,
          scrapCost: result.scrapCost,
          currency: result.currency,
          primaryDefect: result.primaryDefect,
        };
      }

      function pickOptimizationResult(result) {
        return {
          baseline: result.baseline,
          best: result.best,
          changes: result.changes,
          savings: result.savings,
          ...(result.modelPredicted === true ? { modelPredicted: true } : {}),
          ...(typeof result.note === "string" ? { note: result.note } : {}),
        };
      }

      function syncRiskExplanationAvailability() {
        const button = document.getElementById("request-risk-explanation");
        const message = document.getElementById("risk-explanation-availability");
        if (!button || !message) return;
        const adapterConfigured = latestIntegrations.explainRisk === true;
        const evidenceIsProductionAdapter = latestSimilarRunsSource === "bigquery";
        const ready = adapterConfigured && latestRiskResult !== null &&
          latestOptimizationResult !== null && Array.isArray(latestSimilarRuns) &&
          evidenceIsProductionAdapter;
        button.disabled = !ready;
        button.setAttribute("aria-disabled", String(!ready));
        button.textContent = ready ? button.dataset.availableText : t("unavailable");
        message.textContent = !adapterConfigured
          ? "Unavailable — the validated BigQuery attribution and Vertex explanation adapters are not configured."
          : !ready
            ? "Requires a real prediction and optimizer response plus a completed similar-run request using the configured BigQuery adapter."
            : "Ready from the current analysis responses. Model attribution is not proof of causation.";
      }

      function invalidateAnalysisResults(markStale = true) {
        const hadResults = latestRiskResult !== null || latestOptimizationResult !== null ||
          latestSimilarRuns !== null;
        analysisGeneration += 1;
        latestRiskPayload = null;
        latestRiskResult = null;
        latestOptimizationResult = null;
        latestSimilarRuns = null;
        latestSimilarRunsSource = null;
        document.getElementById("similar-runs-list").replaceChildren();
        document.getElementById("similar-runs-list").hidden = true;
        document.getElementById("risk-explanation-content").replaceChildren();
        document.getElementById("risk-explanation-content").hidden = true;
        document.getElementById("what-if-controls").hidden = true;
        document.getElementById("what-if-controls").disabled = true;
        document.getElementById("what-if-unavailable").hidden = false;
        if (markStale && hadResults) {
          setResult("risk-result", "Inputs changed; the previous prediction and dependent evidence are stale.", "incomplete");
          setResult("optimization-result", "Inputs changed; the previous optimization and dependent evidence are stale.", "incomplete");
          setResult("similar-runs-result", "Inputs changed; the previous historical evidence is stale.", "incomplete");
          setResult("explanation-result", "Inputs changed; the previous explanation is stale.", "incomplete");
        }
        syncRiskExplanationAvailability();
      }

      function renderSimilarRuns(payload) {
        const evidence = payload?.evidence;
        if (!Array.isArray(evidence) || evidence.length > 5 ||
            !["bigquery", "offline-test-adapter"].includes(payload.source) ||
            evidence.some((run) => !run || typeof run.lotId !== "string" ||
              !run.lotId || typeof run.orderId !== "string" || !run.orderId ||
              typeof run.runDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(run.runDate) ||
              !["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"].includes(run.primaryDefect) ||
              !run.levers || typeof run.levers !== "object")) {
          throw new Error("The similar-run endpoint returned malformed historical evidence.");
        }
        const list = document.getElementById("similar-runs-list");
        list.replaceChildren();
        for (const run of evidence) {
          const item = document.createElement("li");
          const details = [
            "Lot " + run.lotId,
            "Order " + run.orderId,
            "Run date " + run.runDate,
            "Primary defect " + run.primaryDefect,
          ];
          if (Number.isFinite(run.ambientRhPct)) details.push("Ambient RH " + run.ambientRhPct + "%");
          if (Number.isFinite(run.totalScrapPct)) details.push("Observed scrap " + run.totalScrapPct + "%");
          if (Number.isFinite(run.totalScrapKg)) details.push("Observed scrap mass " + run.totalScrapKg + " kg");
          if (Number.isFinite(run.scrapCost) && typeof run.currency === "string") {
            details.push("Observed scrap cost " + run.currency + " " + run.scrapCost);
          }
          item.textContent = details.join(" · ");
          list.append(item);
        }
        list.hidden = evidence.length === 0;
        document.getElementById("similar-runs-availability").textContent = payload.source === "offline-test-adapter"
          ? "OFFLINE TEST ADAPTER — these test observations are not production history."
          : evidence.length === 0
            ? "No matching historical lots were returned by the configured query."
            : "Historical observations returned for the selected item and humidity; they are not predictions for this order.";
        latestSimilarRuns = evidence;
        latestSimilarRunsSource = payload.source;
        syncRiskExplanationAvailability();
      }

      function renderRiskExplanation(payload) {
        if (payload?.source !== "bigquery-ml-and-gemini" ||
            typeof payload.explanation !== "string" || !payload.explanation.trim() ||
            !Array.isArray(payload.rows)) {
          throw new Error("The explanation endpoint returned malformed attribution evidence.");
        }
        const content = document.getElementById("risk-explanation-content");
        content.textContent = payload.explanation;
        content.hidden = false;
      }

      document.getElementById("load-similar-runs").addEventListener("click", async (event) => {
        const order = readFieldGroup("order-profile-fields", requestFieldNames.order);
        const conditions = readFieldGroup("condition-request-fields", requestFieldNames.conditions);
        if (!order || !conditions) return;
        latestSimilarRuns = null;
        latestSimilarRunsSource = null;
        document.getElementById("similar-runs-list").replaceChildren();
        document.getElementById("similar-runs-list").hidden = true;
        document.getElementById("risk-explanation-content").replaceChildren();
        document.getElementById("risk-explanation-content").hidden = true;
        syncRiskExplanationAvailability();
        const generation = analysisGeneration;
        await runJsonRequest({
          url: "/risk/similar-runs",
          options: {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ order, conditions }),
          },
          outputId: "similar-runs-result",
          button: event.currentTarget,
          onSuccess: (payload) => {
            if (generation === analysisGeneration) renderSimilarRuns(payload);
          },
        });
        if (generation !== analysisGeneration) {
          document.getElementById("similar-runs-list").replaceChildren();
          document.getElementById("similar-runs-list").hidden = true;
          setResult("similar-runs-result", "Inputs changed while this request was running. Its response was discarded; retry with the current inputs.", "incomplete");
        }
      });

      document.getElementById("request-risk-explanation").addEventListener("click", async (event) => {
        if (latestRiskResult === null || latestOptimizationResult === null ||
            !Array.isArray(latestSimilarRuns) || latestSimilarRunsSource !== "bigquery") {
          syncRiskExplanationAvailability();
          return;
        }
        const order = readFieldGroup("order-profile-fields", requestFieldNames.order);
        const conditions = readFieldGroup("condition-request-fields", requestFieldNames.conditions);
        if (!order || !conditions) return;
        document.getElementById("risk-explanation-content").replaceChildren();
        document.getElementById("risk-explanation-content").hidden = true;
        const generation = analysisGeneration;
        await runJsonRequest({
          url: "/risk/explanation",
          options: {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              order,
              conditions,
              prediction: latestRiskResult,
              optimization: latestOptimizationResult,
              evidence: latestSimilarRuns,
            }),
          },
          outputId: "explanation-result",
          button: event.currentTarget,
          onSuccess: (payload) => {
            if (generation === analysisGeneration) renderRiskExplanation(payload);
          },
        });
        if (generation !== analysisGeneration) {
          document.getElementById("risk-explanation-content").replaceChildren();
          document.getElementById("risk-explanation-content").hidden = true;
          setResult("explanation-result", "Inputs changed while this request was running. Its response was discarded; retry with the current inputs.", "incomplete");
        }
      });

      function syncWhatIfControl() {
        if (!latestRiskPayload) return;
        const select = document.getElementById("what-if-lever");
        const slider = document.getElementById("what-if-value");
        const definition = leverDefinitions[select.value];
        slider.min = String(definition.min);
        slider.max = String(definition.max);
        slider.step = String(definition.step);
        slider.value = String(latestRiskPayload.levers[select.value]);
        document.getElementById("what-if-value-label").value = slider.value;
        document.getElementById("what-if-value-label").textContent = slider.value;
      }

      document.getElementById("what-if-lever").addEventListener("change", syncWhatIfControl);
      document.getElementById("what-if-value").addEventListener("input", (event) => {
        const output = document.getElementById("what-if-value-label");
        output.value = event.currentTarget.value;
        output.textContent = event.currentTarget.value;
      });

      async function rescoreWhatIf() {
        if (!latestRiskPayload) return;
        const scenario = {
          ...latestRiskPayload,
          order: { ...latestRiskPayload.order },
          conditions: { ...latestRiskPayload.conditions },
          levers: { ...latestRiskPayload.levers },
        };
        scenario.levers[document.getElementById("what-if-lever").value] = Number(
          document.getElementById("what-if-value").value
        );
        await runJsonRequest({
          url: "/risk/predict",
          options: {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(scenario),
          },
          outputId: "what-if-result",
          button: document.getElementById("what-if-rescore"),
        });
      }

      document.getElementById("what-if-rescore").addEventListener("click", rescoreWhatIf);
      document.getElementById("what-if-value").addEventListener("change", () => {
        document.getElementById("what-if-rescore").click();
      });

      for (const groupId of ["order-profile-fields", "condition-request-fields", "lever-request-fields"]) {
        document.getElementById(groupId).addEventListener("input", () => {
          invalidateAnalysisResults();
        });
        document.getElementById(groupId).addEventListener("change", () => invalidateAnalysisResults());
      }

      document.getElementById("request-risk").addEventListener("click", () => submitAnalysisRequest("risk"));
      document.getElementById("request-optimization").addEventListener("click", () => submitAnalysisRequest("optimization"));

      let lastJobIdempotency = { fingerprint: "", key: "" };
      function jobPreparationIdempotencyKey(file, operatorFields, itemConfirmation, shift, levers, reviewFingerprint) {
        const fingerprint = JSON.stringify([
          file.name, String(file.size), String(file.lastModified),
          operatorFields.orderId, operatorFields.paperType, operatorFields.paperSupplier,
          String(itemConfirmation.lineIndex), itemConfirmation.itemCode, String(itemConfirmation.quantity),
          reviewFingerprint, shift, JSON.stringify(levers),
        ]);
        if (fingerprint !== lastJobIdempotency.fingerprint) {
          lastJobIdempotency = { fingerprint, key: crypto.randomUUID() };
        }
        return lastJobIdempotency.key;
      }

      function applyStoredJobContext(jobSheet) {
        if (!jobSheet || typeof jobSheet.jobId !== "string" || jobSheet.jobId.length === 0) return;
        document.getElementById("shared-job-id").value = jobSheet.jobId;
        const steps = document.querySelectorAll(".lifecycle__steps li");
        const status = jobSheet.status;
        const states = status === "APPROVED"
          ? ["complete", "complete", "complete", jobSheet.cardUri ? "complete" : "incomplete"]
          : status === "DRAFT"
            ? ["complete", "complete", "incomplete", "incomplete"]
            : ["unavailable", "incomplete", "incomplete", "incomplete"];
        steps.forEach((step, index) => {
          if (states[index]) step.dataset.state = states[index];
        });
      }

      document.getElementById("prepare-job").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const file = document.getElementById("order-pdf").files[0];
        if (!file) {
          setResult("prepare-job-result",
            "Select the purchase-order document on Screen 1 before requesting job preparation.", "error");
          return;
        }
        if (!activePurchaseOrderReview || selectedReviewLineIndex === undefined) {
          setResult("prepare-job-result",
            "Extract and review the current purchase order, then select one source line.", "error");
          return;
        }
        const itemConfirmation = document.getElementById("confirm-order-line");
        const selectedRow = document.querySelector(
          '.po-line-review__item[data-line-index="' + String(selectedReviewLineIndex) + '"]'
        );
        const itemCode = selectedRow?.querySelector('[data-role="confirmed-item-code"]')?.value.trim();
        const quantity = Number(selectedRow?.querySelector('[data-role="confirmed-quantity"]')?.value);
        if (!itemConfirmation.checked || !itemCode || !Number.isSafeInteger(quantity) || quantity < 1) {
          setResult("prepare-job-result",
            "Select one line, resolve its item code and quantity, and confirm both against the source purchase order.", "error");
          return;
        }
        const shift = document.getElementById("analysis-shift").value;
        if (!shift) {
          setResult("prepare-job-result", t("selectShift"), "error");
          return;
        }
        const levers = readFieldGroup("lever-request-fields", requestFieldNames.levers);
        if (!levers) return;
        const operatorFields = {};
        const body = new FormData();
        body.append("file", file);
        const operatorFieldIds = {
          orderId: "extraction-order-id",
          paperType: "extraction-paper-type",
          paperSupplier: "extraction-paper-supplier",
        };
        for (const [field, id] of Object.entries(operatorFieldIds)) {
          const input = document.getElementById(id);
          const value = input.value;
          if (!value || !input.reportValidity()) return;
          operatorFields[field] = value;
          body.append(field, value);
        }
        body.append("confirmedItemCode", itemCode);
        body.append("confirmedQuantity", String(quantity));
        body.append("confirmedLineIndex", String(selectedReviewLineIndex + 1));
        body.append("reviewId", activePurchaseOrderReview.reviewId);
        body.append("reviewFingerprint", activePurchaseOrderReview.reviewFingerprint);
        body.append("confirmedSourceLine", String(itemConfirmation.checked));
        body.append("shift", shift);
        for (const [name, value] of Object.entries(levers)) body.append(name, String(value));
        const confirmedLine = { lineIndex: selectedReviewLineIndex, itemCode, quantity };
        const result = await runJsonRequest({
          url: "/jobs",
          options: {
            method: "POST",
            headers: {
              "Idempotency-Key": jobPreparationIdempotencyKey(
                file, operatorFields, confirmedLine, shift, levers,
                activePurchaseOrderReview.reviewFingerprint,
              ),
            },
            body,
          },
          outputId: "prepare-job-result",
          button,
          onSuccess: (payload) => {
            if (payload?.durable === true) applyStoredJobContext(payload.jobSheet);
          },
        });
        if (result?.runId) connectTrace(result.runId);
      });

      document.getElementById("load-stored-job-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const jobId = document.getElementById("shared-job-id").value.trim();
        if (!jobId) {
          setResult("stored-job-result", t("storedJobNotFound"), "error");
          return;
        }
        await runJsonRequest({
          url: "/jobs/" + encodeURIComponent(jobId),
          options: { headers: { Accept: "application/json" } },
          outputId: "stored-job-result",
          button: form.querySelector("button[type=submit]"),
          onSuccess: (payload) => { applyStoredJobContext(payload?.jobSheet); },
        });
      });

      document.getElementById("approval-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const jobId = document.getElementById("shared-job-id").value.trim();
        if (!jobId) {
          setResult("approval-result", "A persisted job ID is required.", "error");
          return;
        }
        await runJsonRequest({
          url: "/jobs/" + encodeURIComponent(jobId) + "/approve?lang=" +
            encodeURIComponent(languagePreference.value) + "&currency=" +
            encodeURIComponent(document.getElementById("display-currency").value),
          options: { method: "POST", headers: { Accept: "application/json" } },
          outputId: "approval-result",
          button: form.querySelector("button[type=submit]"),
        });
      });

      let storedCardObjectUrl;
      document.getElementById("stored-card-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const jobId = document.getElementById("shared-job-id").value.trim();
        const button = form.querySelector("button[type=submit]");
        const link = document.getElementById("stored-card-link");
        link.hidden = true;
        link.removeAttribute("href");
        if (storedCardObjectUrl) {
          URL.revokeObjectURL(storedCardObjectUrl);
          storedCardObjectUrl = undefined;
        }
        if (!jobId) {
          setResult("stored-card-result", "A persisted job ID is required.", "error");
          return;
        }
        button.disabled = true;
        setResult("stored-card-result", t("progress"), "loading");
        try {
          const lang = encodeURIComponent(languagePreference.value);
          const currency = encodeURIComponent(document.getElementById("display-currency").value);
          const { response, pdf, payload } = await sendRequest(
            "/jobs/" + encodeURIComponent(jobId) + "/card.pdf?lang=" + lang + "&currency=" + currency,
            { headers: { Accept: "application/pdf, application/json" } }
          );
          if (pdf) {
            storedCardObjectUrl = URL.createObjectURL(pdf);
            link.href = storedCardObjectUrl;
            link.hidden = false;
            setResult("stored-card-result", "Stored job card received. Open it to print.", "success");
          } else {
            const unavailable = payload?.error?.code === "SERVICE_UNAVAILABLE";
            setResult("stored-card-result", describeResponse(response, payload),
              unavailable ? "unavailable" : response.ok ? "success" : "error");
          }
        } catch (error) {
          setResult("stored-card-result", error.message, "error");
        } finally {
          button.disabled = false;
        }
      });

      document.getElementById("feedback-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const jobId = document.getElementById("shared-job-id").value.trim();
        if (!jobId) {
          setResult("feedback-result",
            "Enter a genuine persisted job ID before submitting feedback.", "error");
          return;
        }
        const payload = { jobId };
        for (const control of form.querySelectorAll("input[name]")) {
          if (control.value === "") continue;
          payload[control.name] = control.type === "number" ? Number(control.value) : control.value;
        }
        if (!Object.keys(payload).some((key) => key.startsWith("rate") || key === "photoUri")) {
          setResult("feedback-result",
            "Enter at least one actual defect rate or a photo URI.", "error");
          return;
        }
        await runJsonRequest({
          url: "/jobs/" + encodeURIComponent(jobId) + "/feedback",
          options: {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload),
          },
          outputId: "feedback-result",
          button: form.querySelector("button[type=submit]"),
        });
      });

      const traceForm = document.getElementById("trace-form");
      const traceRunId = document.getElementById("trace-run-id");
      let traceSource;

      function connectTrace(runIdValue) {
        const runId = runIdValue.trim();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
          setResult("trace-result", t("invalidRunId"), "error");
          return false;
        }
        traceRunId.value = runId;
        if (traceSource) traceSource.close();
        document.getElementById("trace-events").replaceChildren();
        setResult("trace-result", t("traceWaiting"), "loading");
        traceSource = new EventSource(apiUrl("/api/runs/" + encodeURIComponent(runId) + "/events"));
        traceSource.onopen = () => setResult("trace-result", t("traceConnected"), "success");
        const eventTypes = [
          "run.started", "tool.started", "tool.succeeded", "tool.failed", "tool.unavailable",
          "run.completed", "run.failed", "run.cancelled",
        ];
        const terminalStates = {
          "run.completed": { message: "traceCompleted", state: "success" },
          "run.failed": { message: "traceFailed", state: "error" },
          "run.cancelled": { message: "traceCancelled", state: "incomplete" },
        };
        for (const type of eventTypes) {
          traceSource.addEventListener(type, (message) => {
            let traceEvent;
            try { traceEvent = JSON.parse(message.data); } catch {
              setResult("trace-result", t("requestFailed"), "error");
              traceSource.close(); return;
            }
            if (traceEvent.runId !== runId || !Number.isInteger(traceEvent.sequence) ||
                traceEvent.id !== runId + ":" + traceEvent.sequence) {
              setResult("trace-result", t("requestFailed"), "error");
              traceSource.close(); return;
            }
            const item = document.createElement("li");
            item.textContent = traceEvent.sequence + ". " + traceEvent.type +
              (traceEvent.tool ? " — " + traceEvent.tool : "") +
              (traceEvent.errorCode ? " (" + traceEvent.errorCode + ")" : "");
            document.getElementById("trace-events").append(item);
            while (document.getElementById("trace-events").children.length > 250) {
              document.getElementById("trace-events").firstElementChild.remove();
            }
            const terminalState = terminalStates[traceEvent.type];
            if (terminalState) {
              traceSource.close();
              setResult("trace-result", t(terminalState.message), terminalState.state);
            }
          });
        }
        traceSource.addEventListener("stream.error", () => {
          traceSource.close();
          setResult("trace-result", t("requestFailed"), "error");
        });
        traceSource.onerror = () => {
          if (traceSource.readyState === EventSource.CLOSED) {
            setResult("trace-result", t("traceDisconnected"), "error");
          } else {
            setResult("trace-result", t("traceDisconnected"), "loading");
          }
        };
        return true;
      }

      traceForm.addEventListener("submit", (event) => {
        event.preventDefault();
        connectTrace(traceRunId.value);
      });

      document.getElementById("currency-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector("button[type=submit]");
        const amountText = form.elements.amount.value;
        const amount = Number(amountText);
        const from = document.getElementById("source-currency").value;
        const to = document.getElementById("display-currency").value;
        const language = languagePreference.value;
        const resultId = "currency-result";
        if (amountText === "" || !Number.isFinite(amount)) {
          setResult(resultId, t("invalidAmount"), "error"); return;
        }
        button.disabled = true;
        button.dataset.originalText ||= button.textContent;
        button.textContent = t("loading");
        setResult(resultId, t("progress"), "loading");
        try {
          const { response, payload } = await sendRequest(
            "/fx?base=" + encodeURIComponent(from),
            { headers: { Accept: "application/json" } }
          );
          if (!response.ok) {
            const unavailable = payload?.error?.code === "SERVICE_UNAVAILABLE";
            setResult(resultId, describeResponse(response, payload), unavailable ? "unavailable" : "error");
            button.textContent = t("retry"); return;
          }
          const conversion = formatDisplayCurrency({ amount, from, to, language, rates: payload });
          const rateSource = conversion.source === "frankfurter"
            ? t("frankfurterSource") : t("fallbackSource");
          setResult(resultId,
            t("currencyOriginal") + ": " + conversion.original +
              "\\n" + t("currencyApprox") + ": ≈ " + conversion.converted +
              "\\n" + t("rateLabel") + ": 1 " + from + " = " + conversion.rate + " " + to +
              "\\n" + t("rateDateLabel") + ": " + conversion.date +
              "\\n" + t("sourceLabel") + ": " + rateSource +
              (conversion.stale ? "\\n" + t("staleRate") : "") +
              "\\n" + t("unchanged"),
            "success");
          button.textContent = button.dataset.originalText;
        } catch (error) {
          setResult(resultId,
            (error instanceof Error ? error.message : t("requestFailed")) + " " + t("unchanged"),
            "unavailable");
          button.textContent = t("retry");
        } finally {
          button.disabled = false;
        }
      });

      let pdfObjectUrl;
      const clearRenderedPdf = () => {
        const link = document.getElementById("pdf-link");
        link.hidden = true;
        link.removeAttribute("href");
        if (pdfObjectUrl) { URL.revokeObjectURL(pdfObjectUrl); pdfObjectUrl = undefined; }
      };

      window.addEventListener("pagehide", () => {
        if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
        if (storedCardObjectUrl) URL.revokeObjectURL(storedCardObjectUrl);
      });

      document.getElementById("job-sheet-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector("button[type=submit]");
        const resultId = "job-sheet-result";
        clearRenderedPdf();
        const link = document.getElementById("pdf-link");
        let payload;
        try { payload = JSON.parse(form.elements.payload.value); } catch {
          setResult(resultId, t("jobJson"), "error"); return;
        }
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          setResult(resultId, t("jobObject"), "error"); return;
        }
        button.disabled = true;
        button.textContent = t("loading");
        setResult(resultId, t("progress"), "loading");
        try {
          const locale = encodeURIComponent(languagePreference.value);
          const { response, pdf, payload: errorPayload } = await sendRequest(
            "/job-sheets/render.pdf?lang=" + locale, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/pdf, application/json" },
              body: JSON.stringify(payload),
            });
          if (pdf) {
            if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
            pdfObjectUrl = URL.createObjectURL(pdf);
            link.href = pdfObjectUrl;
            link.hidden = false;
            renderJobSheetPreview(payload);
            setResult(resultId, t("pdfRendered"), "success");
          } else {
            const unavailable = errorPayload?.error?.code === "PDF_FONT_UNAVAILABLE";
            setResult(resultId, describeResponse(response, errorPayload),
              unavailable ? "unavailable" : response.ok ? "success" : "error");
          }
        } catch (error) {
          setResult(resultId, error.message, "error");
        } finally {
          button.disabled = false;
          button.textContent = t("render");
        }
      });

      window.addEventListener("pagehide", () => {
        if (traceSource) traceSource.close();
      });

      // Generic multipart form handler used by any form marked data-json-post + data-kind="file"
      document.querySelectorAll("form[data-json-post]").forEach((form) => {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const button = form.querySelector("button[type=submit]");
          const outputId = form.dataset.output;
          if (form.dataset.kind === "file") {
            const file = form.elements.file?.files[0];
            if (!file) { setResult(outputId, t("selectPdf"), "error"); return; }
            const body = new FormData();
            body.append("file", file);
            for (const field of ["orderId", "paperType", "paperSupplier"]) {
              body.append(field, form.elements[field].value);
            }
            await runJsonRequest({ url: form.dataset.jsonPost, options: { method: "POST", body }, outputId, button });
            return;
          }
          let payload;
          try { payload = JSON.parse(form.elements.payload?.value); } catch {
            setResult(outputId, t("invalidJson"), "error"); return;
          }
          if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            setResult(outputId, t("jsonObject"), "error"); return;
          }
          await runJsonRequest({
            url: form.dataset.jsonPost,
            options: { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) },
            outputId, button,
          });
        });
      });

      document.querySelector("[data-json-get='/api/status']").click();
    </script>
  </body>
</html>`;
