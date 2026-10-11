import { SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES } from "./schemas.js";

const languageNames = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  ja: "Japanese",
  ko: "Korean",
  "zh-CN": "Chinese (Simplified)",
  id: "Indonesian",
};
const languageOptions = SUPPORTED_LANGUAGES
  .map((language) => `<option value="${language}">${languageNames[language]} (${language})</option>`)
  .join("");
const currencyOptions = SUPPORTED_CURRENCIES
  .map((currency) => `<option value="${currency}">${currency}</option>`)
  .join("");

const orderFields = [
  ["orderId", "Purchase order ID", "text"],
  ["customerId", "Customer ID", "text"],
  ["boxStyle", "Box style", "select", ["RSC", "DIECUT", "TRAY"]],
  ["lengthMm", "Length (mm)", "number", 50, 1200, 1],
  ["widthMm", "Width (mm)", "number", 50, 1200, 1],
  ["heightMm", "Height (mm)", "number", 50, 1200, 1],
  ["ply", "Ply", "select", ["3", "5", "7"]],
  ["fluteProfile", "Flute profile", "select", ["B", "C", "E", "BC", "BCB"]],
  ["topLinerGsm", "Top liner (GSM)", "number", 80, 400, 1],
  ["fluteGsm", "Flute (GSM)", "number", 80, 400, 1],
  ["innerLinerGsm", "Inner liner (GSM)", "number", 80, 400, 1],
  ["linerBf", "Liner BF", "number", 12, 40, 1],
  ["paperType", "Paper type", "select", ["VIRGIN", "RECYCLED", "MIXED"]],
  ["paperSupplier", "Paper supplier", "text"],
  ["inkColors", "Ink colors", "number", 0, 4, 1],
  ["inkCoveragePct", "Ink coverage (%)", "number", 0, 100, "any"],
  ["quantity", "Quantity", "number", 1, undefined, 1],
];

const conditionFields = [
  ["runDate", "Run date", "date"],
  ["shift", "Shift", "select", ["DAY", "NIGHT"]],
  ["ambientRhPct", "Ambient humidity (%)", "number", 0, 100, "any"],
  ["ambientTempC", "Ambient temperature (°C)", "number", undefined, undefined, "any"],
  ["paperMoisturePct", "Paper moisture (%)", "number", 0, 20, "any"],
];

const leverFields = [
  ["sfSpeedMpm", "Single facer speed (m/min)", "number", 20, 60, "any"],
  ["rollTempC", "Roll temperature (°C)", "number", 150, 185, "any"],
  ["gumApplication", "Gum application", "select", ["LOW", "MED", "HIGH"]],
  ["gumViscositySec", "Gum viscosity (seconds)", "number", 25, 60, "any"],
  ["pastingPressure", "Pasting pressure", "select", ["LOW", "MED", "HIGH"]],
  ["dryingHours", "Drying time (hours)", "number", 2, 16, "any"],
  ["printSpeedSpm", "Print speed (sheets/min)", "number", 30, 80, "any"],
];

function fieldMarkup([name, label, type, optionsOrMin, max, step]) {
  const id = `analysis-${name}`;
  const control = type === "select"
    ? `<select id="${id}" name="${name}" required><option value="" selected disabled>Select ${label.toLowerCase()}</option>${optionsOrMin.map((option) => `<option value="${option}">${option}</option>`).join("")}</select>`
    : `<input id="${id}" name="${name}" type="${type}"${type === "number" ? ` min="${optionsOrMin ?? ""}" max="${max ?? ""}" step="${step}"` : ""} required />`;
  return `<div class="field"><label for="${id}">${label}</label>${control}</div>`;
}

const orderFieldsMarkup = orderFields.map(fieldMarkup).join("");
const conditionFieldsMarkup = conditionFields.map(fieldMarkup).join("");
const leverFieldsMarkup = leverFields.map(fieldMarkup).join("");

const navigationItems = [
  ["screen-order-input", "Screen 1 — Order input", "M12 16V4m0 0L7 9m5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"],
  ["screen-production-analysis", "Screen 2 — Production analysis", "M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6"],
  ["screen-job-card-approval", "Screen 3 — Job card and approval", "M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 0v5h5M9 13h6m-6 4h6"],
];

const navigationMarkup = navigationItems.map(([target, label, icon], index) => `
          <a class="sidebar__link" href="#${target}" data-sidebar-link data-screen-link data-tooltip="${label}" aria-label="${label}"${index === 0 ? ' aria-current="page"' : ""}>
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${icon}" /></svg>
            <span class="sidebar__label">${label}</span>
          </a>`).join("");

export const homePage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#101216" />
    <title>Ustaad AI | Production Prep</title>
    <link rel="stylesheet" href="/operator-ui.css" />
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <div class="app-shell" data-sidebar-collapsed="false">
      <aside class="sidebar" id="app-sidebar">
        <div class="sidebar__top">
          <a class="brand" href="#screen-order-input" aria-label="Ustaad AI">
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
          <span class="sidebar__label">Local development</span>
        </div>
      </aside>
      <main class="app-main" id="main-content" tabindex="-1">
        <div class="page">
          <header class="page-header">
            <div>
              <p class="eyebrow">USTAAD AI <span aria-hidden="true">/</span> PRODUCTION PREP</p>
              <p class="muted" data-i18n="tagline">Corrugated production preparation · local development</p>
            </div>
            <span class="badge badge--neutral"><span class="status-dot" aria-hidden="true"></span><span data-i18n="local">Local development</span></span>
          </header>
      <section class="screen" id="screen-order-input" data-screen-panel aria-labelledby="screen-order-heading">
        <header class="screen-heading">
          <p class="eyebrow">SCREEN 1</p>
          <h1 id="screen-order-heading">Screen 1 — Order input</h1>
          <p class="muted">Upload a purchase order and begin the order-to-job-card workflow. Extraction and missing-field confirmation depend on the configured service.</p>
        </header>
        <details class="availability">
          <summary><span class="status-dot" aria-hidden="true"></span> Local development · production services unavailable</summary>
          <p class="muted" role="note" data-i18n="integrationNotice">Cloud-backed extraction, conditions, predictions, optimization, evidence, job persistence, translation and photo classification are unavailable until their real integrations are configured. Agent traces, job creation, approval, stored job cards and feedback are also unavailable. No production values or sample orders are prefilled.</p>
        </details>

        <div class="grid">
        <details class="card wide workflow-guide">
          <summary>Workflow guide</summary>
          <h2 id="workflow-title" data-i18n="workflow">Production preparation workflow</h2>
          <p id="workflow-current" class="notice" role="status" aria-live="polite" data-i18n="currentStage">Current stage: purchase-order input required. No order has been accepted, and no downstream stage can proceed.</p>
          <ol class="workflow">
            <li data-workflow-stage="order">
              <strong data-i18n="orderStage">1. Purchase-order input</strong>
              <p data-i18n="orderDescription">Required input: an operator-supplied PDF. The endpoint validates the PDF, but extraction is unavailable until its genuine service is configured.</p>
              <a href="#order-pdf" data-i18n="goToPdf">Go to PDF input</a>
              <span class="badge" data-workflow-state="blocked" data-i18n="extractionUnavailable">Extraction unavailable</span>
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
              <span class="badge" data-workflow-state="blocked" data-i18n="analysisUnavailable">Unavailable: production analysis services are not configured</span>
            </li>
            <li data-workflow-stage="approval">
              <strong data-i18n="approvalStage">4. Approval</strong>
              <p data-i18n="approvalDescription">Approval requires a persisted job and the source-defined approval service; neither is available.</p>
              <span class="badge" data-workflow-state="blocked" data-i18n="approvalUnavailable">Unavailable: job persistence and approval are not configured</span>
            </li>
            <li data-workflow-stage="print">
              <strong data-i18n="printStage">5. Print</strong>
              <p data-i18n="printDescription">The local PDF renderer accepts a caller-supplied JobSheet only. It is not a substitute for an approved, stored production job card.</p>
              <a href="#screen-job-card-approval" data-i18n="localRenderer">Open local renderer (not workflow printing)</a>
              <span class="badge" data-workflow-state="blocked" data-i18n="printUnavailable">Workflow printing unavailable</span>
            </li>
          </ol>
        </details>

        <section class="card wide upload-card" aria-labelledby="upload-title">
          <h2 id="upload-title" data-i18n="order">Purchase-order PDF</h2>
          <p class="muted">Choose a purchase-order PDF to submit. The local endpoint validates the PDF signature only; extraction and storage are unavailable.</p>
          <form data-json-post="/orders/extract" data-output="upload-result" data-kind="file">
            <label class="dropzone" id="order-dropzone" for="order-pdf">
              <svg class="dropzone__icon icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /></svg>
              <strong data-i18n="choosePdf">Choose purchase-order PDF</strong>
              <span class="muted">Drop a PDF here or browse files · PDF only · maximum 10 MiB</span>
              <span id="selected-file-name" class="dropzone__filename" aria-live="polite">No file selected</span>
              <input id="order-pdf" class="dropzone__input" name="file" type="file" accept="application/pdf,.pdf" required aria-describedby="selected-file-name upload-result" />
            </label>
            <div class="actions upload-actions">
              <button type="submit" data-i18n="submitPdf">Submit PDF for extraction</button>
              <button type="button" class="button-secondary" data-json-get="/api/status" data-output="status-result" data-i18n="loadStatus">Load local service status</button>
            </div>
          </form>
          <pre id="upload-result" class="result" role="status" aria-live="polite" data-i18n="noUpload">No upload submitted.</pre>
          <details class="diagnostics"><summary>Technical response details</summary><pre id="upload-result-diagnostic" class="result"></pre></details>
          <section id="extraction-clarification" class="empty-state" aria-live="polite" hidden>
            <h3>Extraction and missing-field review</h3>
            <p id="extraction-summary" class="muted">Not started — no extracted fields are available.</p>
            <ul id="missing-order-fields"></ul>
            <dl id="extracted-order-fields" class="field-list" hidden></dl>
            <details class="diagnostics" hidden>
              <summary>Extraction response details</summary>
              <pre id="extracted-order" class="result"></pre>
            </details>
            <form id="clarification-form" hidden>
              <label for="clarification-json">Operator-supplied values for the listed missing fields</label>
              <textarea id="clarification-json" name="payload" placeholder='Enter a JSON object containing only actual values for listed missing fields. No values are prefilled.'></textarea>
              <button type="submit">Apply clarification locally</button>
            </form>
            <pre id="clarified-order" class="result" hidden></pre>
            <p class="muted">Local clarification is not accepted or persisted by an extraction service. The existing prediction endpoint must validate a complete request before any prediction.</p>
          </section>
        </section>
        <details class="card wide diagnostics status-diagnostics">
          <summary id="status-title" data-i18n="status">Application and integration status</summary>
          <p class="muted">This local status response does not verify a live cloud connection.</p>
          <pre id="status-result" class="result" role="status" aria-live="polite" data-i18n="statusLoading">Status has not been requested.</pre>
          <details class="diagnostics"><summary>Raw status response</summary><pre id="status-result-diagnostic" class="result"></pre></details>
        </details>
        </div>
      </section>

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
            <button type="button" id="request-risk">Request risk prediction</button>
            <button type="button" id="request-optimization" class="button-secondary">Request optimization</button>
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
                <p class="muted">Display preference only; it never changes order, production, or job-sheet data.</p>
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
          <p class="muted">The production evidence query is not configured. No sample or mock runs are shown.</p>
          <p class="empty-state" role="status" data-state="unavailable">Unavailable — the five nearest historical runs require the approved BigQuery similarity query and genuine production data.</p>
        </section>
        <section class="card" aria-labelledby="explanation-title">
          <h2 id="explanation-title">Model-grounded explanations</h2>
          <p class="empty-state" role="status" data-state="unavailable">Unavailable — explanations require a genuine model result and its attribution response.</p>
        </section>
        <section class="card" aria-labelledby="what-if-title">
          <h2 id="what-if-title">What-if re-scoring</h2>
          <p class="empty-state" role="status" data-state="unavailable">Unavailable — the current service contract does not provide live lever re-scoring. No simulated control or score is shown.</p>
        </section>
        </div>
      </section>

      <section class="screen" id="screen-job-card-approval" data-screen-panel aria-labelledby="screen-job-heading" hidden>
        <header class="screen-heading">
          <p class="eyebrow">SCREEN 3</p>
          <h1 id="screen-job-heading">Screen 3 — Job card and approval</h1>
          <p class="muted">Generate or review a contract-valid JobSheet, request supervisor approval and print only a supplied sheet. Persistence and workflow approval are not configured.</p>
        </header>
        <div class="grid">
        <section class="card wide" aria-labelledby="job-preparation-title">
          <h2 id="job-preparation-title">Job-sheet generation</h2>
          <p class="muted">Request job preparation for the PDF selected on Screen 1. The existing workflow service is unavailable until real storage, Gemini, BigQuery and model integrations are configured.</p>
          <button id="prepare-job" type="button" disabled>Job preparation unavailable</button>
          <pre id="prepare-job-result" class="result" role="status" aria-live="polite">Not started — no job sheet has been generated.</pre>
        </section>

        <section class="card wide job-context" aria-labelledby="job-context-title">
          <h2 id="job-context-title">Persisted job context</h2>
          <p class="muted">Enter the genuine persisted job ID once to use the available job actions below.</p>
          <label for="shared-job-id">Persisted job ID</label>
          <input id="shared-job-id" autocomplete="off" />
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
              <button type="submit" disabled aria-describedby="approval-unavailable">Approval unavailable</button>
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
            <button type="submit" disabled aria-describedby="stored-card-result">Stored card unavailable</button>
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
            <button type="submit" disabled aria-describedby="feedback-result">Feedback unavailable</button>
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
      </div>
    </main>
    </div>
    <script type="module">
      import { formatDisplayCurrency } from "/display-currency.js";
      import { getDisplayableProductionAmounts } from "/money-contracts.js";
      import { translate } from "/localization.js";

      const requestFieldNames = {
        order: ${JSON.stringify(orderFields.map(([name]) => name))},
        conditions: ${JSON.stringify(conditionFields.map(([name]) => name))},
        levers: ${JSON.stringify(leverFields.map(([name]) => name))},
      };
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
        sidebarToggle.setAttribute(
          "aria-label",
          collapsed ? "Expand sidebar" : "Collapse sidebar"
        );
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
        const targetId = {
          "conditions-result": "conditions-fields",
          "risk-result": "risk-metrics",
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

      function renderStructuredResponse(outputId, payload) {
        if (!payload || payload.source === "mock-demo" || payload.isRealModelPrediction === false) return;

        if (outputId === "upload-result" && payload.orderProfile &&
            typeof payload.orderProfile === "object") {
          renderFieldList("extracted-order-fields", payload.orderProfile);
          return;
        }

        if (outputId === "conditions-result") {
          const conditions = payload.data ?? payload;
          if (conditions && typeof conditions === "object" &&
              ["runDate", "shift", "ambientRhPct", "ambientTempC", "paperMoisturePct"]
                .every((field) => Object.hasOwn(conditions, field))) {
            renderFieldList("conditions-fields", conditions);
          }
          return;
        }

        if (outputId === "risk-result") {
          const risk = payload.ratesPct ? payload : payload.risk;
          const defects = ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"];
          if (!risk?.ratesPct || !defects.every((defect) => Number.isFinite(risk.ratesPct[defect]))) return;
          const metrics = document.getElementById("risk-metrics");
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
            heading.textContent = "Permitted changes returned by optimizer";
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
          target.hidden = target.childElementCount === 0;
        }
      }

      async function sendRequest(url, options = {}) {
        let response;
        try {
          response = await fetch(url, options);
        } catch {
          throw new Error(t("networkError"));
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/pdf")) {
          if (!response.ok) {
            throw new Error(t("requestFailed"));
          }
          return { response, pdf: await response.blob() };
        }

        let payload;
        try {
          payload = await response.json();
        } catch {
          throw new Error(t("unreadable"));
        }
        return { response, payload };
      }

      function describeResponse(response, payload) {
        if (response.ok) {
          return "HTTP " + response.status + " — response received. Review the structured result and expand technical details if needed.";
        }

        const code = payload?.error?.code;
        const messages = {
          VALIDATION_ERROR: t("validation"),
          SERVICE_UNAVAILABLE: t("unavailable"),
          REQUEST_TIMEOUT: "The request exceeded the 60-second processing deadline.",
          RATE_LIMIT_EXCEEDED: "Too many requests. Wait before retrying.",
          RATE_LIMIT_CAPACITY: "Request rate limiting is temporarily at capacity. Retry later.",
          CLIENT_IP_UNAVAILABLE: "The server could not safely identify the request client.",
          PAYLOAD_TOO_LARGE: "The request exceeds the server's 10 MiB limit.",
          PDF_FONT_UNAVAILABLE: "A required Noto Sans font is unavailable; the PDF was not rendered.",
        };
        const message = messages[code] || t("requestFailed");
        const issues = code === "VALIDATION_ERROR" && Array.isArray(payload?.error?.issues)
          ? payload.error.issues
            .filter((issue) => typeof issue?.field === "string" && typeof issue?.message === "string")
            .map((issue) => issue.field + ": " + issue.message)
            .join("\\n")
          : "";
        return "HTTP " + response.status + (code ? " - " + code : "") + ": " + message +
          (issues ? "\\n" + issues : "");
      }

      let extractedOrderProfile;
      let extractionMissingFields = [];

      function showOrderExtraction(payload) {
        const panel = document.getElementById("extraction-clarification");
        const summary = document.getElementById("extraction-summary");
        const missingFields = document.getElementById("missing-order-fields");
        const extractedOrder = document.getElementById("extracted-order");
        const extractedOrderFields = document.getElementById("extracted-order-fields");
        const clarificationForm = document.getElementById("clarification-form");
        panel.hidden = false;
        missingFields.replaceChildren();
        extractedOrder.hidden = true;
        extractedOrderFields.hidden = true;
        clarificationForm.hidden = true;
        document.getElementById("clarified-order").hidden = true;
        extractedOrderProfile = undefined;
        extractionMissingFields = [];

        if (payload?.source === "mock-demo" || payload?.isRealModelPrediction === false) {
          summary.textContent = "Non-production response — extraction is not being presented as a genuine order.";
          return;
        }
        if (!payload || !payload.orderProfile || typeof payload.orderProfile !== "object" ||
            Array.isArray(payload.orderProfile) ||
            !Array.isArray(payload.missingFields) ||
            typeof payload.needsClarification !== "boolean" ||
            payload.needsClarification !== (payload.missingFields.length > 0)) {
          summary.textContent = "The response did not match the structured purchase-order extraction contract.";
          return;
        }

        extractedOrderProfile = payload.orderProfile;
        extractionMissingFields = payload.missingFields.filter((field) => typeof field === "string");
        summary.textContent = payload.needsClarification
          ? "Clarification required before prediction. Missing fields are listed below."
          : "The extraction response reports no missing purchase-order fields.";
        for (const field of extractionMissingFields) {
          const item = document.createElement("li");
          item.textContent = field;
          missingFields.append(item);
        }
        renderFieldList("extracted-order-fields", payload.orderProfile);
        extractedOrder.textContent = JSON.stringify(payload, null, 2);
        extractedOrder.parentElement.hidden = false;
        clarificationForm.hidden = !payload.needsClarification;
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
                  style: "currency",
                  currency: entry.currency,
                }).format(entry.amount);
              } catch {
                original = entry.amount + " " + entry.currency;
              }
              return entry.path + ": display conversion unavailable; original " + original;
            }
            const converted = formatDisplayCurrency({
              amount: entry.amount,
              from: entry.currency,
              to: target,
              language,
              rates,
            });
            const source = converted.source === "frankfurter"
              ? t("frankfurterSource")
              : t("fallbackSource");
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

      async function runJsonRequest({ url, options, outputId, button, idleText }) {
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
          if (response.ok) renderStructuredResponse(outputId, payload);
          const description = response.ok
            ? await appendDisplayOnlyMoney(describeResponse(response, payload), payload)
            : describeResponse(response, payload);
          setResult(outputId, description, unavailable ? "unavailable" : response.ok ? "success" : "error");
          if (outputId === "upload-result" && response.ok) {
            showOrderExtraction(payload);
          }
          button.dataset.busyKey = "";
          button.textContent = response.ok ? button.dataset.originalText : t("retry");
        } catch (error) {
          setResult(outputId, error.message, "error");
          button.dataset.busyKey = "";
          button.textContent = t("retry");
        } finally {
          button.disabled = false;
        }
      }

      document.querySelectorAll("[data-json-get]").forEach((button) => {
        button.addEventListener("click", () => runJsonRequest({
          url: button.dataset.jsonGet,
          outputId: button.dataset.output,
          button,
          options: { headers: { Accept: "application/json" } },
        }));
      });

      document.querySelectorAll("form[data-json-post]").forEach((form) => {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const button = form.querySelector("button[type=submit]");
          const outputId = form.dataset.output;
          if (form.dataset.kind === "file") {
            const file = form.elements.file.files[0];
            if (!file) {
              setResult(outputId, t("selectPdf"), "error");
              return;
            }
            if (!validateSelectedFile(file)) return;
            const body = new FormData();
            body.append("file", file);
            await runJsonRequest({
              url: form.dataset.jsonPost,
              options: { method: "POST", body },
              outputId,
              button,
            });
            return;
          }

          let payload;
          try {
            payload = JSON.parse(form.elements.payload.value);
          } catch {
            setResult(outputId, t("invalidJson"), "error");
            return;
          }
          if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            setResult(outputId, t("jsonObject"), "error");
            return;
          }
          await runJsonRequest({
            url: form.dataset.jsonPost,
            options: {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify(payload),
            },
            outputId,
            button,
          });
        });
      });

      languagePreference.addEventListener("change", applyLanguage);
      applyLanguage();

      const orderFile = document.getElementById("order-pdf");
      const dropzone = document.getElementById("order-dropzone");
      const selectedFileName = document.getElementById("selected-file-name");
      function validateSelectedFile(file) {
        dropzone.dataset.state = "";
        if (!file) {
          selectedFileName.textContent = "No file selected";
          return false;
        }
        selectedFileName.textContent = file.name + " · " +
          (file.size / (1024 * 1024)).toFixed(2) + " MiB";
        const pdfName = file.name.toLowerCase().endsWith(".pdf");
        const pdfType = !file.type || file.type === "application/pdf";
        if (!pdfName || !pdfType) {
          dropzone.dataset.state = "error";
          setResult("upload-result", "Select a PDF file. The server will verify its signature before accepting the upload.", "error");
          return false;
        }
        if (file.size > 10 * 1024 * 1024) {
          dropzone.dataset.state = "error";
          setResult("upload-result", "This file exceeds the 10 MiB request limit.", "error");
          return false;
        }
        dropzone.dataset.state = "selected";
        setResult("upload-result", "PDF selected. It has not been submitted or extracted.", "incomplete");
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
            ? Number(control.value)
            : control.value;
        }
        return result;
      }

      async function submitAnalysisRequest(kind) {
        const order = readFieldGroup("order-profile-fields", requestFieldNames.order);
        if (!order) return;
        const conditions = readFieldGroup("condition-request-fields", requestFieldNames.conditions);
        if (!conditions) return;
        let payload = { order, conditions };
        let outputId = "optimization-result";
        if (kind === "risk") {
          const settings = document.querySelector(".settings-disclosure");
          settings.open = true;
          const levers = readFieldGroup("lever-request-fields", requestFieldNames.levers);
          if (!levers) return;
          payload = { ...payload, levers };
          outputId = "risk-result";
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
        });
      }

      document.getElementById("request-risk").addEventListener("click", () => submitAnalysisRequest("risk"));
      document.getElementById("request-optimization").addEventListener("click", () => submitAnalysisRequest("optimization"));

      document.getElementById("clarification-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        let supplied;
        try {
          supplied = JSON.parse(form.elements.payload.value);
        } catch {
          setResult("clarified-order", t("invalidJson"), "error");
          document.getElementById("clarified-order").hidden = false;
          return;
        }
        if (!supplied || typeof supplied !== "object" || Array.isArray(supplied)) {
          setResult("clarified-order", t("jsonObject"), "error");
          document.getElementById("clarified-order").hidden = false;
          return;
        }
        const suppliedFields = Object.keys(supplied);
        const unexpected = suppliedFields.filter((field) => !extractionMissingFields.includes(field));
        if (!extractedOrderProfile || unexpected.length > 0) {
          setResult(
            "clarified-order",
            unexpected.length
              ? "Only fields identified as missing may be supplied: " + unexpected.join(", ")
              : "No extracted order is available to clarify.",
            "error"
          );
          document.getElementById("clarified-order").hidden = false;
          return;
        }

        extractedOrderProfile = { ...extractedOrderProfile, ...supplied };
        const remaining = extractionMissingFields.filter(
          (field) => !Object.prototype.hasOwnProperty.call(extractedOrderProfile, field)
        );
        const missingList = document.getElementById("missing-order-fields");
        missingList.replaceChildren(...remaining.map((field) => {
          const item = document.createElement("li");
          item.textContent = field;
          return item;
        }));
        document.getElementById("extraction-summary").textContent = remaining.length
          ? "Clarification is still incomplete. Remaining fields: " + remaining.join(", ")
          : "Values supplied for all listed fields. The candidate is not service-validated or persisted.";
        form.hidden = remaining.length === 0;
        const clarifiedOrder = document.getElementById("clarified-order");
        clarifiedOrder.hidden = false;
        setResult(
          "clarified-order",
          "Local candidate only; server-side OrderProfile validation is still required.\\n\\n" +
            JSON.stringify(extractedOrderProfile, null, 2),
          "incomplete"
        );
      });

      document.getElementById("prepare-job").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const file = document.getElementById("order-pdf").files[0];
        if (!file) {
          setResult("prepare-job-result", "Select the purchase-order PDF on Screen 1 before requesting job preparation.", "error");
          return;
        }
        const body = new FormData();
        body.append("file", file);
        await runJsonRequest({
          url: "/jobs",
          options: { method: "POST", body },
          outputId: "prepare-job-result",
          button,
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
          url: "/jobs/" + encodeURIComponent(jobId) + "/approve",
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
            setResult(
              "stored-card-result",
              describeResponse(response, payload),
              unavailable ? "unavailable" : response.ok ? "success" : "error"
            );
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
          setResult("feedback-result", "Enter a genuine persisted job ID before submitting feedback.", "error");
          return;
        }
        const payload = { jobId };
        for (const control of form.querySelectorAll("input[name]")) {
          if (control.value === "") continue;
          payload[control.name] = control.type === "number" ? Number(control.value) : control.value;
        }
        if (!Object.keys(payload).some((key) => key.startsWith("rate") || key === "photoUri")) {
          setResult("feedback-result", "Enter at least one actual defect rate or a photo URI.", "error");
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
      const traceOutput = document.getElementById("trace-result");
      const traceEvents = document.getElementById("trace-events");
      let traceSource;

      traceForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const runId = traceRunId.value.trim();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
          setResult("trace-result", t("invalidRunId"), "error");
          return;
        }
        if (traceSource) traceSource.close();
        traceEvents.replaceChildren();
        setResult("trace-result", t("traceWaiting"), "loading");
        traceSource = new EventSource("/api/runs/" + encodeURIComponent(runId) + "/events");
        traceSource.onopen = () => setResult("trace-result", t("traceConnected"), "success");

        const eventTypes = [
          "run.started",
          "tool.started",
          "tool.succeeded",
          "tool.failed",
          "tool.unavailable",
          "run.completed",
          "run.failed",
          "run.cancelled",
        ];
        const terminalStates = {
          "run.completed": { message: "traceCompleted", state: "success" },
          "run.failed": { message: "traceFailed", state: "error" },
          "run.cancelled": { message: "traceCancelled", state: "incomplete" },
        };
        for (const type of eventTypes) {
          traceSource.addEventListener(type, (message) => {
            let traceEvent;
            try {
              traceEvent = JSON.parse(message.data);
            } catch {
              setResult("trace-result", t("requestFailed"), "error");
              traceSource.close();
              return;
            }
            if (traceEvent.runId !== runId || !Number.isInteger(traceEvent.sequence) ||
                traceEvent.id !== runId + ":" + traceEvent.sequence) {
              setResult("trace-result", t("requestFailed"), "error");
              traceSource.close();
              return;
            }
            const item = document.createElement("li");
            item.textContent = traceEvent.sequence + ". " + traceEvent.type +
              (traceEvent.tool ? " — " + traceEvent.tool : "") +
              (traceEvent.errorCode ? " (" + traceEvent.errorCode + ")" : "");
            traceEvents.append(item);
            while (traceEvents.children.length > 250) {
              traceEvents.firstElementChild.remove();
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
          setResult(resultId, t("invalidAmount"), "error");
          return;
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
            button.textContent = t("retry");
            return;
          }

          const conversion = formatDisplayCurrency({
            amount,
            from,
            to,
            language,
            rates: payload,
          });
          const rateSource = conversion.source === "frankfurter"
            ? t("frankfurterSource")
            : t("fallbackSource");
          setResult(
            resultId,
            t("currencyOriginal") + ": " + conversion.original +
              "\\n" + t("currencyApprox") + ": ≈ " + conversion.converted +
              "\\n" + t("rateLabel") + ": 1 " + from + " = " + conversion.rate + " " + to +
              "\\n" + t("rateDateLabel") + ": " + conversion.date +
              "\\n" + t("sourceLabel") + ": " + rateSource +
              (conversion.stale ? "\\n" + t("staleRate") : "") +
              "\\n" + t("unchanged"),
            "success"
          );
          button.textContent = button.dataset.originalText;
        } catch (error) {
          setResult(
            resultId,
            (error instanceof Error
              ? error.message
              : t("requestFailed")) +
              " " + t("unchanged"),
            "unavailable"
          );
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
        if (pdfObjectUrl) {
          URL.revokeObjectURL(pdfObjectUrl);
          pdfObjectUrl = undefined;
        }
      };

      window.addEventListener("pagehide", () => {
        if (pdfObjectUrl) {
          URL.revokeObjectURL(pdfObjectUrl);
        }
        if (storedCardObjectUrl) {
          URL.revokeObjectURL(storedCardObjectUrl);
        }
      });

      document.getElementById("job-sheet-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector("button[type=submit]");
        const resultId = "job-sheet-result";
        clearRenderedPdf();
        const link = document.getElementById("pdf-link");
        let payload;
        try {
          payload = JSON.parse(form.elements.payload.value);
        } catch {
          setResult(resultId, t("jobJson"), "error");
          return;
        }
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          setResult(resultId, t("jobObject"), "error");
          return;
        }

        button.disabled = true;
        button.textContent = t("loading");
        setResult(resultId, t("progress"), "loading");
        try {
          const locale = encodeURIComponent(languagePreference.value);
          const { response, pdf, payload: errorPayload } = await sendRequest("/job-sheets/render.pdf?lang=" + locale, {
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
            setResult(resultId, describeResponse(response, errorPayload), unavailable ? "unavailable" : response.ok ? "success" : "error");
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

      document.querySelector("[data-json-get='/api/status']").click();
    </script>
  </body>
</html>`;
