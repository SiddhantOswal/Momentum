import { isConditionsDisplay, isJobDisplay } from "./contracts.js";
import { markMoney, refreshMoney } from "./currency-display.js";
import { apiUrl, request, createRequestGate, setResponseAuthorizationMode, isLocalSyntheticRuntime } from "./api.js";
import { REQUEST_FIELDS, LEVER_DEFINITIONS } from "./fields.js";
import { initShell, toast, renderRisk, renderComparison, renderStoredSheet, renderImpactCharts, clearCharts, initDefectCheck } from "./components.js";

import { formatDisplayCurrency } from "/display-currency.js";
import { toRiskPredictionPayload } from "/risk-ui.js";
import { isImpactSummary } from "/impact-ui.js";
import { translate } from "/localization.js";

const requestFieldNames = REQUEST_FIELDS;
const leverDefinitions = LEVER_DEFINITIONS;

initShell();
initDefectCheck();
const languagePreference = document.getElementById("language-preference");
const t = (key) => translate(languagePreference.value, key);
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
  if (state === "error" || (state === "incomplete" && id === "conditions-result")) {
    let disclosure = output.closest("details");
    while (disclosure) { disclosure.open = true; disclosure = disclosure.parentElement?.closest("details"); }
  }
  if (state === "error" && output.closest("[hidden]")) toast(message.split("\n")[0]);
};

function showBackendUnavailable() {
  document.getElementById("backend-availability").textContent = "Unreachable";
  document.getElementById("connection-label").textContent = "Backend offline";
  document.getElementById("connection-dot").dataset.state = "error";
  document.getElementById("service-availability-summary").textContent =
    "Backend unreachable · production capabilities unknown";
}

function updateConditionsAvailability(response, payload) {
  const target = document.getElementById("current-conditions-availability");
  if (response.ok) {
    target.textContent = payload.sensorSource === "simulated" ? "Simulated reading · confirmation required" : "Reading returned by backend · verify provenance";
  } else if (payload?.error?.code === "SERVICE_UNAVAILABLE") {
    target.textContent = "Unavailable: backend has no usable sensor reading";
  } else {
    target.textContent = "Request failed; sensor data not verified";
  }
}

let hackathonUI = false;
let localSyntheticUI = false;
let supervisorSessionModule;
async function configureSupervisorSession(status) {
  localSyntheticUI = isLocalSyntheticRuntime(status, location.hostname);
  hackathonUI = localSyntheticUI || status.authorizationMode === "HACKATHON_DEMO";
  setResponseAuthorizationMode(status.authorizationMode, status);
  if (localSyntheticUI) {
    if (!document.getElementById("local-synthetic-demo-note")) {
      const note = document.createElement("p"); note.id = "local-synthetic-demo-note"; note.className = "method-note"; note.setAttribute("role", "note");
      note.textContent = "LOCAL MOCK BACKUP — deterministic mock outputs, not live Gemini or accepted models. Records and feedback exist only in this process memory; restarting resets them. PDFs are generated locally, not stored in Cloud Storage.";
      document.getElementById("main-content").prepend(note);
    }
    document.getElementById("supervisor-auth-status").textContent = "Local simulated approval only — no authenticated human or cloud persistence.";
    for (const id of ["supervisor-sign-in", "supervisor-sign-out", "supervisor-refresh-session"]) { const control = document.getElementById(id); if (control) control.hidden = true; }
    return;
  }
  // The authentication adapter belongs to the backend integration. Load it only
  // when that server advertises the capability; older/local servers still boot.
  if (!status.runtimeAvailability?.supervisorAuthentication) {
    document.getElementById("supervisor-auth-status").textContent = "Supervisor sign-in is unavailable in this environment.";
    return;
  }
  supervisorSessionModule ??= import("/supervisor-auth-client.js");
  await supervisorSessionModule;
}
function applyRuntimeAvailability(status = {}) {
  document.getElementById("connection-label").textContent = status.backendReachable === true ? "Backend reachable" : "Backend offline";
  document.getElementById("connection-dot").dataset.state = status.backendReachable === true ? "reachable" : "error";
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
      : "Unavailable: required persistence, model or supervisor gates are not satisfied";
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

function operatorDiagnostic(value) {
  if (hackathonUI || value?.authorizationMode === "HACKATHON_DEMO") return value;
  if (typeof value === "string" && /synthetic|simulated/i.test(value)) {
    return "Production provenance remains unverified. Consult backend acceptance records before operational use.";
  }
  if (Array.isArray(value)) return value.map(operatorDiagnostic);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/synthetic|simulated|approvedPoFixtureAllowlistEnforced/i.test(key))
    .map(([key, entry]) => [key, operatorDiagnostic(entry)]));
}
function setDiagnostic(outputId, payload) {
  const diagnostic = document.getElementById(outputId + "-diagnostic");
  if (!diagnostic) return;
  if (payload === undefined) { diagnostic.textContent = ""; return; }
  const display = operatorDiagnostic(payload);
  if (outputId === "status-result" && payload.approvedPoFixtureAllowlistEnforced) {
    display.orderProcessingPolicy = "Restricted purchase-order processing; real-order enablement requires backend configuration.";
  }
  diagnostic.textContent = JSON.stringify(display, null, 2);
}

function clearStructuredResponse(outputId) {
  if (outputId === "risk-result") document.getElementById("risk-overview").hidden = true;
  if (outputId === "optimization-result") document.getElementById("optimization-summary").hidden = true;
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
  clearCharts();
  document.getElementById("impact-content").hidden = true;
  document.getElementById("impact-kpis").replaceChildren();
  document.getElementById("impact-secondary-kpis").replaceChildren();
  for (const id of ["impact-monthly", "impact-seasonal", "impact-items"]) {
    document.getElementById(id).replaceChildren();
  }
  document.getElementById("impact-coverage").textContent = "";
}

function impactMoney(amount, currency) { return { amount, currency }; }

function appendImpactMetric(label, value) {
  const card = document.createElement("div");
  card.className = "metric";
  const title = document.createElement("span");
  title.className = "metric__label";
  title.textContent = label;
  const result = document.createElement("strong");
  result.className = "metric__value";
  if (value && typeof value === "object") markMoney(result, value.amount, value.currency);
  else result.textContent = value;
  card.append(title, result);
  const primary = document.getElementById("impact-kpis");
  (primary.children.length < 3 ? primary : document.getElementById("impact-secondary-kpis")).append(card);
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
      if (value && typeof value === "object") markMoney(cell, value.amount, value.currency);
      else cell.textContent = String(value);
      row.append(cell);
    }
    body.append(row);
  }
}

function renderImpactSummary(payload) {
  if (!(localSyntheticUI ? isImpactSummary(payload, { allowLocalDemo: true }) : isImpactSummary(payload))) {
    throw new Error("The Impact endpoint returned malformed data; no results were displayed.");
  }
  const { kpis, counterfactual } = payload;
  const lastMonth = payload.monthly.reduce(
    (latest, row) => row.month > latest ? row.month : latest, "");
  const queryStatus = localSyntheticUI ? "LOCAL MOCK BACKUP — illustrative fixed values, no BigQuery query." : payload.source === "bigquery-cache"
    ? "Cached successful BigQuery response (cache lifetime: at most one hour)."
    : "Queried from BigQuery for this request.";
  const latestMonth = lastMonth
    ? " Latest returned monthly row: " + lastMonth + "."
    : " The monthly query returned no rows.";
  document.getElementById("impact-coverage").textContent =
    (hackathonUI ? "Held-out/simulated estimates, not measured factory outcomes. No annualization. " : "") + queryStatus + " SQL coverage: records before 1 October 2026." + latestMonth;
  appendImpactMetric("Estimated net savings · after slower-production allowance", impactMoney(kpis.netSavingMonth, kpis.currency));
  appendImpactMetric("Estimated scrap reduction", kpis.kgSavedMonth.toLocaleString("en-IN") + " kg");
  appendImpactMetric("Held-out lots scored / settings changed", kpis.lotsScored + " / " + kpis.lotsChanged);
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
    row.label, row.lots, row.avgScrapPct + "%",
    impactMoney(row.scrapCost12m, kpis.currency), row.mainDefect,
  ]), ["item group", "lots", "average scrap", "scrap cost", "main defect"]);
  document.getElementById("impact-content").hidden = false;
  renderImpactCharts(payload);
  refreshMoney();
}

function renderStructuredResponse(outputId, payload) {
  if (!payload || (!localSyntheticUI && payload.source === "mock-demo")) throw new Error("Production data is unavailable for this action.");
  if (!localSyntheticUI && ["risk-result", "what-if-result", "optimization-result"].includes(outputId) &&
      (payload.source !== "bigquery-ml" || payload.isRealModelPrediction !== true)) throw new Error("The production analysis response has an unverified source.");
  if (outputId === "upload-result" && payload.orderProfile &&
      typeof payload.orderProfile === "object") {
    renderFieldList("extracted-order-fields", payload.orderProfile);
    return;
  }
  if (outputId === "conditions-result") {
    const data = payload.data ?? payload;
    if (!isConditionsDisplay(data)) throw new Error("The conditions response was incomplete. Enter values manually or retry.");
    if (isConditionsDisplay(data)) {
      for (const field of requestFieldNames.conditions) { const input = document.getElementById("analysis-" + field); if (input && data[field] !== undefined) input.value = String(data[field]); }
      document.getElementById("conditions-supervisor-confirmed").checked = false;
      document.getElementById("condition-source-label").textContent = payload.sensorSource === "simulated" ? "Simulated reading · review required" : "Stored reading · review required";
      invalidateAnalysisResults();
      const sensorSource = {
        simulated: "Simulated — not physical factory telemetry",
        manual: "Manually entered",
        live: "Unverified source",
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
        freshness: provenance.freshness === "stale"
          ? "STALE — reading is over 24 hours old (" + Math.floor(provenance.ageSeconds / 3600) + " h)"
          : provenance.freshness,
      });
    }
    return;
  }
  if (outputId === "risk-result" || outputId === "what-if-result") {
    renderRisk(payload, outputId);
    return;
  }
  if (outputId === "optimization-result") renderComparison(payload);
}

async function sendRequest(url, options = {}) {
  try { return await request(url, options); }
  catch (error) { if (error.name === "AbortError") throw error; throw new Error(error.message || t("networkError")); }
}

function describeResponse(response, payload) {
  if (response.ok) {
    const adapterNote = payload?.source === "offline-test-adapter"
      ? " OFFLINE TEST ADAPTER — no production data was read or written."
      : "";
    const acceptanceNote = payload?.isRealModelPrediction === true &&
      payload?.modelAcceptance?.status !== "accepted"
      ? " Model output is not accepted against the required R² threshold and current model versions; production preparation is blocked."
      : "";
    return "Response received. Review the result below." +
      adapterNote + acceptanceNote;
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
    AUTHENTICATION_REQUIRED: "Supervisor sign-in is required. Open Supervisor session above.",
    INVALID_AUTHENTICATION: "Your supervisor session expired. Sign in again.",
    FORBIDDEN: "This account is not authorized for this action.",
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
        .join("\n")
    : "";
  return "HTTP " + response.status + (code ? " - " + code : "") + ": " + message +
    (serverMessage && serverMessage !== message ? "\n" + serverMessage : "") + (blockedAt ? "\n" + blockedAt : "") + (issues ? "\n" + issues : "");
}

async function runJsonRequest({ url, options = {}, outputId, button, idleText, onSuccess, isCurrent = () => true }) {
  button.dataset.originalText ||= button.textContent;
  if (button.dataset.busyKey) return;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.dataset.busyKey = "loading";
  button.textContent = t(button.dataset.busyKey);
  setDiagnostic(outputId, undefined);
  clearStructuredResponse(outputId);
  setResult(outputId, t("progress"), "loading");
  try {
    const { response, payload } = await sendRequest(url, options);
    if (!isCurrent()) return undefined;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("The server returned a malformed response.");
    const unavailable = payload?.error?.code === "SERVICE_UNAVAILABLE";
    setDiagnostic(outputId, payload);
    if (outputId === "conditions-result") updateConditionsAvailability(response, payload);
    if (response.ok) {
      renderStructuredResponse(outputId, payload);
      if (outputId === "status-result") {
        await configureSupervisorSession(payload);
        applyIntegrationAvailability(payload.integrations);
        applyRuntimeAvailability(payload);
      }
      if (typeof onSuccess === "function") onSuccess(payload);
    } else if (outputId === "status-result") {
      showBackendUnavailable();
    }
    const description = describeResponse(response, payload);
    if (!isCurrent()) return undefined;
    setResult(outputId, description, unavailable ? "unavailable" : response.ok ? "success" : "error");
    button.dataset.busyKey = "";
    button.textContent = response.ok ? button.dataset.originalText : t("retry");
    if (response.ok && ["approval-result", "stored-job-result"].includes(outputId)) toast(outputId === "approval-result" ? "Supervisor approval confirmed by the backend." : "Stored job loaded.");
    return payload;
  } catch (error) {
    if (!isCurrent()) return undefined;
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
    button.dataset.busyKey = "";
    button.removeAttribute("aria-busy");
    button.disabled = false;
    applyIntegrationAvailability();
  }
}

let currentStoredJob = null;
let latestIntegrations = {};
function applyIntegrationAvailability(integrations = latestIntegrations) {
  latestIntegrations = localSyntheticUI ? { ...(integrations ?? {}), predictRisk: false, optimizeRisk: false, findSimilarRuns: false, explainRisk: false, findSeenBefore: false } : integrations ?? {};
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
    ["getApprovedPhotos", document.getElementById("load-approved-photos"), null],
  ];
  for (const [key, button, availableKey] of controls) {
    if (!button) continue;
    const available = integrations[key] === true;
    if (button.dataset.busyKey) continue;
    button.disabled = !available;
    button.dataset.originalText ||= button.textContent;
    button.textContent = button.dataset.originalText;
    button.title = available ? "" : "This integration is unavailable in the current runtime.";
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
  const analysisConfigured = localSyntheticUI || [
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
  const evidenceButton = document.getElementById("find-seen-before");
  evidenceButton.dataset.available = String(latestIntegrations.findSeenBefore === true);
  if (evidenceButton.getAttribute("aria-busy") !== "true") evidenceButton.disabled = latestIntegrations.findSeenBefore !== true;
  document.getElementById("seen-before-availability").textContent = latestIntegrations.findSeenBefore === true
    ? "Searches historical evidence. No image classification is performed."
    : "Historical evidence is unavailable: its backend adapter is not configured.";
  syncRiskExplanationAvailability();
  syncPlanReadiness();
  syncJobControls();
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
let intakeRevision = 0;

function clearPurchaseOrderReview() {
  intakeRevision += 1;
  activePurchaseOrderReview = undefined;
  selectedReviewLineIndex = undefined;
  document.getElementById("purchase-order-review").hidden = true;
  document.getElementById("purchase-order-document-fields").replaceChildren();
  document.getElementById("purchase-order-lines").replaceChildren();
  document.getElementById("purchase-order-document-missing").textContent = "";
  document.getElementById("confirm-order-line").checked = false;
  invalidateAnalysisResults();
  syncPlanReadiness();
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
  clearPurchaseOrderReview();
  const revision = intakeRevision;
  await runJsonRequest({
    url: "/orders/extract",
    isCurrent: () => revision === intakeRevision,
    options: { method: "POST", body },
    outputId: "upload-result",
    button,
    onSuccess: (payload) => {
      if (payload?.source !== "vertex-gemini" && !(localSyntheticUI && payload?.source === "mock-demo")) throw new Error("The extraction response has an unverified source. No order was accepted.");
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
  if (file.size < 1 || file.size > 10 * 1024 * 1024) {
    dropzone.dataset.state = "error";
    setResult("upload-result", "Choose a non-empty PDF or JPEG up to 10 MiB.", "error");
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
  clearPurchaseOrderReview();
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
    if (!control) return null;
    if (!control.checkValidity()) {
      let parent = control.closest("details");
      while (parent) { parent.open = true; parent = parent.parentElement?.closest("details"); }
      location.hash = "screen-order-input";
      requestAnimationFrame(() => { control.focus(); control.reportValidity(); });
      return null;
    }
    result[name] = control.type === "number" || name === "ply"
      ? Number(control.value) : control.value;
  }
  return result;
}

async function submitAnalysisRequest(kind) {
  const orderFieldsForRequest = kind === "risk" ? requestFieldNames.riskOrder : requestFieldNames.order;
  const conditionFieldsForRequest = kind === "risk" ? requestFieldNames.riskConditions : requestFieldNames.conditions;
  const confirmation = document.getElementById("conditions-supervisor-confirmed");
  if (!document.getElementById("machine-settings-confirmed").checked) {
    setResult("conditions-result", "Review and confirm your planned machine settings first.", "incomplete");
    location.hash = "screen-order-input";
    return;
  }
  if (!confirmation.checked) {
    setResult("conditions-result", "Supervisor confirmation required: review or edit the condition values, then confirm before prediction or optimization.", "incomplete");
    return;
  }
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
    payload = toRiskPredictionPayload({
      order,
      conditions,
      levers,
      conditionsConfirmed: confirmation.checked,
    });
    outputId = "risk-result";
    onSuccess = (result) => {
      if (generation !== analysisGeneration || !result || result.source !== "bigquery-ml" ||
          result.isRealModelPrediction !== true || result.modelAcceptance?.status !== "accepted" ||
          !result.ratesPct) return;
      latestRiskPayload = payload;
      latestRiskResult = pickRiskResult(result);
      document.querySelector(".what-if-section").open = true;
      document.getElementById("what-if-controls").hidden = false;
      document.getElementById("what-if-controls").disabled = false;
      document.getElementById("what-if-unavailable").hidden = true;
      syncWhatIfControl();
      syncRiskExplanationAvailability();
    };
  } else {
    const levers = readFieldGroup("lever-request-fields", requestFieldNames.levers);
    if (!levers) return;
    // Use the server-delivered projection to match its confirmation contract.
    // Operator confirmation above remains mandatory for either API version.
    const projected = toRiskPredictionPayload({ order, conditions, levers, conditionsConfirmed: confirmation.checked });
    payload = { order, conditions, ...(projected.conditionsConfirmed === true ? { conditionsConfirmed: true } : {}), levers };
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
    isCurrent: () => generation === analysisGeneration,
  });
  if (generation !== analysisGeneration) {
    clearStructuredResponse(outputId);
    setResult(outputId, "Inputs changed while this request was running. Its response was discarded; retry with the current inputs.", "incomplete");
  }
}

const whatIfGate = createRequestGate();
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
  button.textContent = button.dataset.availableText;
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
  whatIfGate.invalidate();
  for (const id of ["risk-result", "optimization-result", "what-if-result"]) clearStructuredResponse(id);
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
  syncPlanReadiness();
}

function renderSimilarRuns(payload) {
  const evidence = payload?.evidence;
  if (!Array.isArray(evidence) || evidence.length > 5 ||
      !(["bigquery", "offline-test-adapter"].includes(payload.source) || localSyntheticUI && payload.source === "mock-demo") ||
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
    const expanded = document.createElement("details");
    const summary = document.createElement("summary"); summary.textContent = "Historical settings & notes";
    const settings = document.createElement("dl"); settings.className = "field-list";
    for (const [key, value] of Object.entries(run.levers)) {
      const term = document.createElement("dt"); term.textContent = humanizeFieldName(key);
      const description = document.createElement("dd"); description.textContent = String(value);
      settings.append(term, description);
    }
    expanded.append(summary, settings);
    if (run.operatorNote) { const note = document.createElement("p"); note.textContent = run.operatorNote; expanded.append(note); }
    item.append(expanded);
    list.append(item);
  }
  list.hidden = evidence.length === 0;
  document.getElementById("similar-runs-availability").textContent = localSyntheticUI ? "Local mock examples, not queried production history." : payload.source === "offline-test-adapter"
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
  const details = document.createElement("details");
  const summary = document.createElement("summary"); summary.textContent = "Model attribution evidence";
  const rows = document.createElement("ul"); rows.className = "change-reasons";
  for (const row of payload.rows) {
    if (typeof row.driver !== "string" || !Number.isFinite(row.attributionPts)) continue;
    const li = document.createElement("li");
    li.textContent = row.defect + " · " + row.driver + " · attribution " + row.attributionPts + " percentage points";
    rows.append(li);
  }
  details.append(summary, rows); content.append(details);
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
  whatIfGate.invalidate();
  const output = document.getElementById("what-if-value-label");
  output.value = event.currentTarget.value;
  output.textContent = event.currentTarget.value;
});

async function rescoreWhatIf() {
  if (!latestRiskPayload) return;
  const active = whatIfGate.begin();
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
    isCurrent: active.current,
    button: document.getElementById("what-if-rescore"),
  });
}

document.getElementById("what-if-rescore").addEventListener("click", rescoreWhatIf);
document.getElementById("what-if-value").addEventListener("change", () => {
  document.getElementById("what-if-rescore").click();
});

for (const groupId of ["order-profile-fields", "condition-request-fields", "lever-request-fields"]) {
  document.getElementById(groupId).addEventListener("input", () => {
    if (groupId === "lever-request-fields") document.getElementById("machine-settings-confirmed").checked = false;
    if (groupId === "condition-request-fields") {
      document.getElementById("condition-source-label").textContent = "Operator-entered / edited values";
      document.getElementById("conditions-supervisor-confirmed").checked = false;
    }
    invalidateAnalysisResults();
  });
  document.getElementById(groupId).addEventListener("change", () => {
    if (groupId === "lever-request-fields") document.getElementById("machine-settings-confirmed").checked = false;
    if (groupId === "condition-request-fields") {
      document.getElementById("condition-source-label").textContent = "Operator-entered / edited values";
      document.getElementById("conditions-supervisor-confirmed").checked = false;
    }
    invalidateAnalysisResults();
  });
}

document.getElementById("request-risk").addEventListener("click", () => submitAnalysisRequest("risk"));
document.getElementById("request-optimization").addEventListener("click", () => submitAnalysisRequest("optimization"));

let lastJobIdempotency = { fingerprint: "", key: "" };
function jobPreparationIdempotencyKey(file, operatorFields, itemConfirmation, shift, levers, reviewFingerprint, conditions) {
  const fingerprint = JSON.stringify([
    file.name, String(file.size), String(file.lastModified),
    operatorFields.orderId, operatorFields.paperType, operatorFields.paperSupplier,
    String(itemConfirmation.lineIndex), itemConfirmation.itemCode, String(itemConfirmation.quantity),
    reviewFingerprint, shift, JSON.stringify(levers), JSON.stringify(conditions),
  ]);
  if (fingerprint !== lastJobIdempotency.fingerprint) {
    lastJobIdempotency = { fingerprint, key: crypto.randomUUID() };
  }
  return lastJobIdempotency.key;
}

function applyStoredJobContext(jobSheet) {
  if (!isJobDisplay(jobSheet)) {
    throw new Error("The stored job response was incomplete. Approval remains blocked.");
  }
  const displaySheet = jobSheet.savings?.inr === undefined
    ? { ...jobSheet, savings: { kg: jobSheet.savings.kg, inr: jobSheet.savings.amount } }
    : jobSheet;
  currentStoredJob = displaySheet;
  renderStoredSheet(displaySheet);
  syncJobControls();
  document.getElementById("shared-job-id").value = jobSheet.jobId;
  const steps = document.querySelectorAll(".lifecycle__steps li");
  const status = jobSheet.status;
  const states = status === "APPROVED"
    ? ["complete", "complete", "complete", jobSheet.cardUri ? "complete" : "incomplete"]
    : status === "DRAFT"
      ? ["complete", "complete", "incomplete", "incomplete"]
      : ["unavailable", "incomplete", "incomplete", "incomplete"];
  steps.forEach((step, index) => {
    if (states[index]) {
      step.dataset.state = states[index];
      step.querySelector("small").textContent = states[index] === "complete" ? "Complete" : "Pending";
    }
  });
}

document.getElementById("prepare-job").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  if (!document.getElementById("machine-settings-confirmed").checked) return;
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
  const conditionConfirmation = document.getElementById("conditions-supervisor-confirmed");
  if (!conditionConfirmation.checked) {
    setResult("prepare-job-result", "Confirm the measured condition values before preparing this job.", "error");
    return;
  }
  const manualConditions = readFieldGroup("condition-request-fields", requestFieldNames.conditions);
  if (!manualConditions) return;
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
  for (const [name, value] of Object.entries({ ...manualConditions, shift })) {
    body.append(name, String(value));
  }
  body.append("conditionsConfirmed", "true");
  for (const [name, value] of Object.entries(levers)) body.append(name, String(value));
  const confirmedLine = { lineIndex: selectedReviewLineIndex, itemCode, quantity };
  location.hash = "screen-production-analysis";
  const result = await runJsonRequest({
    url: "/jobs",
    options: {
      method: "POST",
      headers: {
        "Idempotency-Key": jobPreparationIdempotencyKey(
          file, operatorFields, confirmedLine, shift, levers,
          activePurchaseOrderReview.reviewFingerprint, manualConditions,
        ),
      },
      body,
    },
    outputId: "prepare-job-result",
    button,
    onSuccess: (payload) => {
      if (payload?.durable === true || (localSyntheticUI && payload?.storageScope === "process-memory")) {
        applyStoredJobContext(payload.jobSheet);
        renderRisk(payload.jobSheet.baseline.risk);
        setResult("risk-result", "Prediction from the persisted draft’s planned settings.", "success");
        setResult("optimization-result", "Recommendation from the persisted draft. Review before approval.", "success");
        setResult("stored-job-result", localSyntheticUI ? "Local in-memory draft loaded; not cloud persisted." : "Persisted draft returned and loaded for review.", "success");
        renderComparison({ baseline: payload.jobSheet.baseline, best: payload.jobSheet.recommended, changes: payload.jobSheet.changes, savings: payload.jobSheet.savings });
        if (payload.jobSheet.explanation) {
          const text = document.getElementById("risk-explanation-content"); text.textContent = payload.jobSheet.explanation; text.hidden = false;
        }
        if (payload.jobSheet.evidence) renderSimilarRuns({ source: localSyntheticUI ? "mock-demo" : "bigquery", evidence: payload.jobSheet.evidence });
        toast("Draft saved. Review the recommendation before approval.");
      }
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
    isCurrent: () => document.getElementById("shared-job-id").value.trim() === jobId,
    button: form.querySelector("button[type=submit]"),
    onSuccess: (payload) => { applyStoredJobContext(payload?.jobSheet); },
  });
});

document.getElementById("approval-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentStoredJob || currentStoredJob.status !== "DRAFT") return;
  document.getElementById("approval-review-summary").textContent = "Job " + currentStoredJob.jobId + " · " + currentStoredJob.order.itemCode + " · " + currentStoredJob.order.quantity + " units";
  document.getElementById("approval-dialog").showModal();
});
document.getElementById("confirm-approval").addEventListener("click", async () => {
  if (!currentStoredJob || currentStoredJob.status !== "DRAFT") return;
  const form = document.getElementById("approval-form");
  const jobId = document.getElementById("shared-job-id").value.trim();
  if (jobId !== currentStoredJob.jobId) return;
  document.getElementById("approval-dialog").close();
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
    onSuccess: (payload) => {
      if (payload.jobSheet) applyStoredJobContext(payload.jobSheet);
      else { currentStoredJob = null; syncJobControls(); setResult("approval-result", "Approval response received. Reload the stored job to verify its status.", "incomplete"); }
    },
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
      setResult("stored-card-result", localSyntheticUI ? "Local mock PDF generated; not a Cloud Storage object." : "Stored job card received. Open it to print.", "success");
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

function openAuthenticatedTraceStream(url) {
  const controller = new AbortController();
  const listeners = new Map();
  const source = {
    readyState: 0,
    onopen: null,
    onerror: null,
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) ?? [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    close() {
      if (source.readyState === 2) return;
      source.readyState = 2;
      controller.abort();
    },
  };
  const dispatch = (block) => {
    let type = "message";
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) type = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (data.length === 0) return;
    const event = { type, data: data.join("\n") };
    for (const callback of listeners.get(type) ?? []) callback(event);
  };
  (async () => {
    try {
      const response = await fetch(url, {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok || !response.body) throw new Error("Trace stream unavailable");
      source.readyState = 1;
      if (typeof source.onopen === "function") source.onopen(new Event("open"));
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";
        for (const block of blocks) dispatch(block);
      }
      if (!controller.signal.aborted) {
        source.readyState = 2;
        if (typeof source.onerror === "function") source.onerror(new Event("error"));
      }
    } catch {
      if (!controller.signal.aborted) {
        source.readyState = 2;
        if (typeof source.onerror === "function") source.onerror(new Event("error"));
      }
    }
  })();
  return source;
}

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
  traceSource = openAuthenticatedTraceStream(apiUrl("/api/runs/" + encodeURIComponent(runId) + "/events"));
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
      const eventLabels = { "run.started": "Run started", "tool.started": "Started", "tool.succeeded": "Completed", "tool.failed": "Failed", "tool.unavailable": "Unavailable", "run.completed": "Run completed", "run.failed": "Run failed", "run.cancelled": "Run cancelled" };
      item.dataset.state = traceEvent.type.includes("failed") || traceEvent.type.includes("unavailable") ? "error" : traceEvent.type.includes("succeeded") || traceEvent.type === "run.completed" ? "success" : "running";
      item.title = traceEvent.type + " · " + traceEvent.id;
      item.textContent = traceEvent.sequence + ". " + eventLabels[traceEvent.type] +
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
    if (traceSource.readyState === 2) {
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
        "\n" + t("currencyApprox") + ": ≈ " + conversion.converted +
        "\n" + t("rateLabel") + ": 1 " + from + " = " + conversion.rate + " " + to +
        "\n" + t("rateDateLabel") + ": " + conversion.date +
        "\n" + t("sourceLabel") + ": " + rateSource +
        (conversion.stale ? "\n" + t("staleRate") : "") +
        "\n" + t("unchanged"),
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
  whatIfGate.invalidate();
  clearCharts();
});

document.getElementById("shared-job-id").addEventListener("input", () => {
  currentStoredJob = null;
  document.getElementById("stored-job-preview").hidden = true;
  document.getElementById("job-status-badge").textContent = "Job not loaded";
  document.getElementById("stored-card-link").hidden = true;
  syncJobControls();
});
document.getElementById("display-currency").addEventListener("change", () => {
  refreshMoney();
  toast("Display currency changed. Stored amounts retain their base currency; conversions show ≈ and a rate date.");
});
document.querySelector("[data-json-get='/api/status']").click();

function syncJobControls() {
  const id = document.getElementById("shared-job-id").value.trim();
  const matches = currentStoredJob?.jobId === id;
  const approve = document.querySelector("#approval-form button[type=submit]");
  if (!approve.dataset.busyKey) approve.disabled = !(matches && currentStoredJob.status === "DRAFT" && latestIntegrations.approveJob === true);
  document.getElementById("approval-unavailable").textContent = !matches ? "Load a persisted draft and review its recommendation first."
    : currentStoredJob.status === "APPROVED" ? "This job is already approved. Retrieve its stored card below."
    : latestIntegrations.approveJob !== true ? "Supervisor approval is unavailable in this runtime." : "Review the draft, then request supervisor approval.";
  document.querySelector("#stored-card-form button[type=submit]").disabled = !(matches && currentStoredJob.status === "APPROVED" && latestIntegrations.getJobCard === true);
  document.querySelector("#feedback-form button[type=submit]").disabled = !(matches && latestIntegrations.saveFeedback === true);
}
function reviewSelection() {
  const line = activePurchaseOrderReview?.lines?.find((line) => line.lineIndex === selectedReviewLineIndex);
  const row = line && document.querySelector('.po-line-review__item[data-line-index="' + line.lineIndex + '"]');
  const itemCode = row?.querySelector('[data-role="confirmed-item-code"]')?.value.trim();
  const quantity = Number(row?.querySelector('[data-role="confirmed-quantity"]')?.value);
  const validCode = itemCode && (line?.candidates?.length ? line.candidates.includes(itemCode) : line?.status === "UNKNOWN_CODE" || line?.catalogStatus === "UNKNOWN_CODE" ? itemCode !== line.extractedItemCode : true);
  return { line, row, itemCode, quantity, valid: !!validCode && Number.isSafeInteger(quantity) && quantity > 0 };
}
function syncPlanReadiness() {
  const selection = reviewSelection();
  const confirmed = document.getElementById("confirm-order-line").checked && selection.valid;
  const conditionsReady = document.getElementById("conditions-supervisor-confirmed").checked && [...document.querySelectorAll("#condition-request-fields [name]")].every((c) => c.checkValidity());
  const settingsReady = document.getElementById("machine-settings-confirmed").checked && [...document.querySelectorAll("#lever-request-fields [name]")].every((c) => c.checkValidity());
  const button = document.getElementById("prepare-job");
  if (!button.dataset.busyKey) button.disabled = !(confirmed && conditionsReady && settingsReady && latestIntegrations.jobCreationAvailable === true);
  const missing = [!confirmed && "verify a source line", !conditionsReady && "confirm production conditions", !settingsReady && "confirm planned settings"].filter(Boolean);
  document.getElementById("workflow-current").textContent = confirmed
    ? "Current stage: source line confirmed. " + (missing.length ? "Production inputs still require review." : "Production inputs reviewed; request a draft when the backend is ready.")
    : "Current stage: purchase-order input and source-line confirmation required.";
  document.getElementById("plan-readiness").textContent = missing.length ? "Complete the lot before planning" : "Lot inputs reviewed";
  document.getElementById("plan-prerequisites").textContent = missing.length ? "Next: " + missing.join(" · ") + "." : latestIntegrations.jobCreationAvailable !== true ? "Job preparation is unavailable in this runtime. Open backend status for details." : "Ready to request a persisted draft. Supervisor approval follows review.";
  document.getElementById("active-lot-name").textContent = selection.itemCode || document.getElementById("analysis-itemCode").value || "No lot selected";
  document.getElementById("active-lot-detail").textContent = selection.valid ? selection.quantity.toLocaleString("en-IN") + " units · " + document.getElementById("extraction-order-id").value : "Complete New Lot or retrieve a stored job below.";
}
function syncSelectedLine() {
  const selection = reviewSelection();
  if (document.getElementById("confirm-order-line").checked && !selection.valid) {
    document.getElementById("confirm-order-line").checked = false;
    setResult("upload-result", "Resolve the selected catalog item and enter a positive whole quantity before confirming.", "error");
  }
  if (selection.line && document.getElementById("confirm-order-line").checked) {
    document.getElementById("production-setup").open = true;
    const values = { ...selection.line.orderProfile, orderId: document.getElementById("extraction-order-id").value, paperType: document.getElementById("extraction-paper-type").value, paperSupplier: document.getElementById("extraction-paper-supplier").value, itemCode: selection.itemCode, quantity: selection.quantity };
    for (const name of requestFieldNames.order) document.getElementById("analysis-" + name).value = "";
    for (const [key, value] of Object.entries(values)) { const input = document.getElementById("analysis-" + key); if (input && value !== undefined && value !== null) input.value = String(value); }
    invalidateAnalysisResults();
  }
  syncPlanReadiness();
}
document.getElementById("confirm-order-line").addEventListener("change", syncSelectedLine);
for (const id of ["conditions-supervisor-confirmed", "machine-settings-confirmed"]) document.getElementById(id).addEventListener("change", (event) => { if (!event.currentTarget.checked) invalidateAnalysisResults(); syncPlanReadiness(); });
document.getElementById("purchase-order-lines").addEventListener("input", syncPlanReadiness);
document.getElementById("purchase-order-lines").addEventListener("change", syncPlanReadiness);


const approvedPhotoSelect = document.getElementById("approved-photo-id");
const classifyPhotoButton = document.getElementById("classify-approved-photo");
const photoRequestGate = createRequestGate();
approvedPhotoSelect.addEventListener("change", () => {
  photoRequestGate.invalidate();
  classifyPhotoButton.disabled = !approvedPhotoSelect.value || latestIntegrations.classifyApprovedPhoto !== true;
  document.getElementById("approved-photo-result").textContent = "Selection changed. No classification requested.";
});
document.getElementById("load-approved-photos").addEventListener("click", async (event) => {
  const button = event.currentTarget; button.disabled = true;
  try {
    const {response,payload} = await sendRequest("/evidence/approved-photos");
    if (!response.ok || payload?.ok !== true || !Array.isArray(payload.photos) || payload.photos.length !== 10 || payload.photos.some(photo=>!/^photo-\d{2}$/.test(photo.id) || typeof photo.label !== "string")) throw new Error("The approved photo set is unavailable.");
    approvedPhotoSelect.replaceChildren(new Option("Select an approved photo", ""));
    for (const photo of payload.photos) approvedPhotoSelect.append(new Option(photo.label, photo.id));
    document.getElementById("approved-photo-result").textContent = "Ten approved photos loaded. No model call was made.";
  } catch(error) {document.getElementById("approved-photo-result").textContent=error.message;}
  finally {button.disabled = latestIntegrations.getApprovedPhotos !== true;}
});
classifyPhotoButton.addEventListener("click", async () => {
  const photoId=approvedPhotoSelect.value;if(!photoId)return;
  const gate=photoRequestGate.begin();classifyPhotoButton.disabled=true;
  document.getElementById("approved-photo-result").textContent="Classifying the approved image…";
  try {
    const {response,payload}=await sendRequest("/evidence/classify-photo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({photoId}),signal:gate.signal});
    if(!gate.current())return;
    if(!response.ok || payload?.ok!==true || payload.source!=="vertex-gemini" || payload.photoId!==photoId || !["WARP","DELAM","STRENGTH","PRINT","CRACK","NONE"].includes(payload.label)) throw new Error(payload?.error?.message ?? "The photo classification was invalid.");
    document.getElementById("approved-photo-result").textContent=`${photoId}: ${payload.label}. Real Gemini classification at ${payload.classifiedAt}. Owner-approved demo photo; not a calibrated factory quality assessment.`;
  } catch(error) {if(gate.current())document.getElementById("approved-photo-result").textContent=error.message;}
  finally {if(gate.current())classifyPhotoButton.disabled=latestIntegrations.classifyApprovedPhoto!==true;}
});
