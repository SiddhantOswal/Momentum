import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { serve } from "@hono/node-server";
import {
  FeedbackInputSchema,
  DisplayPrefsQuerySchema,
  InsightsQuerySchema,
  JobIdSchema,
  JobSheetSchema,
  LeversSchema,
  LaunchCurrencySchema,
  LocaleSchema,
  OperatorItemConfirmationSchema,
  OrderOperatorFieldsSchema,
  RiskOptimizationRequestSchema,
  RiskExplanationRequestSchema,
  RiskPredictionRequestSchema,
  RunConditionsSchema,
  SeenBeforeRequestSchema,
  SimilarRunsRequestSchema,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
  ValidationFailureSchema,
} from "./src/schemas.js";
import { PdfFontUnavailableError, renderJobSheetPdf } from "./src/job-sheet-pdf.js";
import { readServerPort } from "./src/runtime-config.js";
import { homePage } from "./src/operator-ui.js";
import { createTraceRoutes } from "./src/trace-routes.js";
import { traceRegistry } from "./src/trace-registry.js";
import { fxRatesService } from "./src/fx-rates.js";
import { servicePorts } from "./src/service-ports.js";
import modelAcceptanceConfig from "./config/model-acceptance.json" with { type: "json" };
import { getModelAcceptanceSummary, isModelSetAccepted } from "./src/model-acceptance.js";
import { createJobCoordinator } from "./src/job-coordinator.js";
import { createLinkedFeedbackService } from "./src/linked-feedback-service.js";
import { createStoredJobSheetLookup } from "./src/stored-job-sheet-lookup.js";
import { createJobRequestIdentity, InMemoryIdempotencyStore } from "./src/job-idempotency.js";
import { createJobSubmissionHandler } from "./src/job-draft-persistence.js";
import { identifyPurchaseOrderMimeType } from "./src/purchase-order-file.js";
import { isApprovedSyntheticPurchaseOrder } from "./src/synthetic-po-allowlist.js";
import {
  createPerIpRateLimitMiddleware,
  createRequestTimeoutMiddleware,
  REQUEST_SIGNAL_CONTEXT_KEY,
} from "./src/request-guardrails.js";
import {
  findSimilarRuns,
  generateJobSheet,
  getConditions,
  explainRisk,
  optimizeLevers,
  predictRisk,
} from "./src/mock-agents.js";

const app = new Hono();
const isCloudRun = Boolean(process.env.K_SERVICE);
const demoMode = !isCloudRun && process.env.USTAAD_ENABLE_DEMO_MODE === "true";
const executionMode = demoMode ? "demo" : isCloudRun ? "live-service" : "offline";
const plantId = process.env.USTAAD_PLANT_ID ??
  (demoMode ? "PLANT-DEMO-01" : undefined);
const prepareJob = createJobCoordinator({
  services: servicePorts,
  traceRegistry,
  plantId,
  allowSyntheticDemoConditions: demoMode,
});
const jobSheetPersistenceAvailable =
  servicePorts.availability.createDraftJobSheet === true &&
  servicePorts.availability.getStoredJobSheet === true;
// Om's approved prototype contract uses the durable BigQuery JobSheet row and
// process-local idempotency/trace state. Cloud Run is capped at two instances;
// cross-instance coordination is explicitly future work for this prototype.
const idempotencyStore = (jobSheetPersistenceAvailable || demoMode)
  ? new InMemoryIdempotencyStore({ leaseMs: 30_000 })
  : undefined;
const jobCreationAvailable = jobSheetPersistenceAvailable &&
  typeof idempotencyStore?.claim === "function" &&
  executionMode === "demo";

const submitJob = createJobSubmissionHandler({
  prepareJob,
  createDraftJobSheet: servicePorts.createDraftJobSheet,
  getStoredJobSheet: servicePorts.getStoredJobSheet,
  draftPersistenceEnabled: jobCreationAvailable,
  storedJobLookupEnabled: servicePorts.availability.getStoredJobSheet === true,
  plantId,
  store: idempotencyStore,
  leaseMs: 30_000,
});

const saveLinkedFeedback = createLinkedFeedbackService({
  getStoredJobSheet: servicePorts.getStoredJobSheet,
  getLotOrder: servicePorts.getLotOrder,
  saveFeedback: servicePorts.saveFeedback,
});
const lookupStoredJobSheet = createStoredJobSheetLookup({
  getStoredJobSheet: servicePorts.getStoredJobSheet,
});
const MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024;
const perIpRateLimit = createPerIpRateLimitMiddleware();

const requestTimeout = createRequestTimeoutMiddleware();
app.use("*", (c, next) => {
  if (c.req.method === "GET" && /^\/api\/runs\/[^/]+\/events$/.test(c.req.path)) {
    return next();
  }
  return requestTimeout(c, next);
});

app.use("/api/*", perIpRateLimit);
app.use("/orders/*", perIpRateLimit);
app.use("/conditions/*", perIpRateLimit);
app.use("/fx", perIpRateLimit);
app.use("/risk/*", perIpRateLimit);
app.use("/jobs", perIpRateLimit);
app.use("/jobs/*", perIpRateLimit);
app.use("/job-sheets/*", perIpRateLimit);
app.use("/insights/*", perIpRateLimit);
app.use("/impact/*", perIpRateLimit);
app.use("/evidence/*", perIpRateLimit);

app.use("*", bodyLimit({
  maxSize: MAX_REQUEST_BODY_BYTES,
  onError: (c) => c.json({
    ok: false,
    error: {
      code: "PAYLOAD_TOO_LARGE",
      message: "Request body must not exceed 10 MiB.",
    },
  }, 413),
}));

function responseForResult(c, result) {
  if (result.ok) {
    return c.json(result);
  }

  const status = result.error?.code === "SERVICE_UNAVAILABLE" ? 503
    : result.error?.code === "NOT_FOUND" ? 404
      : result.error?.code === "CONFLICT" || result.error?.code === "IDEMPOTENCY_IN_PROGRESS" ? 409
        : 400;
  return c.json(result, status);
}

function demoAgentUnavailable(c) {
  if (executionMode === "demo") return undefined;
  return c.json({
    ok: false,
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "Legacy demo-agent routes are available only in explicitly enabled local demo mode.",
    },
  }, 503);
}

function supervisorWorkflowUnavailable(c) {
  if (executionMode !== "live-service") return undefined;
  return c.json({
    ok: false,
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "Job lifecycle routes require an authenticated supervisor identity and authorization policy; only local demo mode may use simulated approval.",
    },
  }, 503);
}

function syntheticPurchaseOrderUnavailable(c, bytes) {
  if (executionMode !== "live-service") return undefined;
  if (process.env.USTAAD_SYNTHETIC_ONLY !== "true") {
    return c.json({
      ok: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Synthetic-only mode must be explicitly enabled before live-service PO processing.",
      },
    }, 503);
  }
  if (!isApprovedSyntheticPurchaseOrder(bytes)) {
    return c.json({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Only the owner-approved synthetic purchase-order fixtures are accepted in this prototype.",
      },
    }, 400);
  }
  return undefined;
}

function invalidJsonResponse(c) {
  return validationResponse(c, [{
    field: "body",
    path: [],
    code: "invalid_json",
    message: "Request body must be valid JSON.",
  }], "Request body must be valid JSON.");
}

function validationResponse(c, issues, message = "Request fields failed validation.") {
  return c.json(ValidationFailureSchema.parse({
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message,
      issues,
    },
  }), 400);
}

function validateInput(c, schema, input, message) {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      response: validationResponse(
        c,
        parsed.error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          path: issue.path,
          code: issue.code,
          message: issue.message,
        })),
        message
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

function validateDisplayPrefs(c) {
  return validateInput(
    c,
    DisplayPrefsQuerySchema,
    {
      lang: c.req.query("lang"),
      currency: c.req.query("currency"),
    },
    "Display preferences failed validation."
  );
}

async function readJsonBody(c) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return { ok: false, response: invalidJsonResponse(c) };
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      response: validationResponse(c, [{
        field: "body",
        path: [],
        code: "invalid_type",
        message: "Request body must be a JSON object.",
      }], "Request body must be a JSON object."),
    };
  }

  return { ok: true, body };
}

app.onError((err, c) => {
  if (c.get(REQUEST_SIGNAL_CONTEXT_KEY)?.aborted) {
    return c.json({
      ok: false,
      error: {
        code: "REQUEST_TIMEOUT",
        message: "Request exceeded the 60-second processing limit.",
      },
    }, 504);
  }

  console.error("Request failed.");

  return c.json(
    {
      ok: false,
      error: "Internal server error",
      message: "The request failed unexpectedly. Please retry.",
      mode: isCloudRun ? "cloud-run" : "local-development",
      isRealModelPrediction: false,
    },
    500
  );
});

app.notFound((c) => {
  return c.json(
    {
      ok: false,
      error: "Not found",
      path: c.req.path,
      mode: isCloudRun ? "cloud-run" : "local-development",
      message: "The requested endpoint was not found.",
    },
    404
  );
});

app.get("/display-currency.js", async (c) => {
  const source = await readFile(new URL("./src/display-currency.js", import.meta.url));
  return c.body(source, 200, {
    "Content-Type": "text/javascript; charset=utf-8",
    "Cache-Control": "no-store",
  });
});

app.get("/operator-ui.css", async (c) => {
  const source = await readFile(new URL("./src/operator-ui.css", import.meta.url));
  return c.body(source, 200, {
    "Content-Type": "text/css; charset=utf-8",
    "Cache-Control": "no-store",
  });
});

const sampleDocuments = new Set([
  "PO1_ClientA_single_B1047.pdf", "PO2_ClientA_multiline.pdf", "PO3_ClientP_electronics_with_fitment.pdf", "PO4_ClientQ_ambiguous_set.pdf", "PO5_ClientB_scanned.jpg",
]);
app.get("/samples/:filename", async (c) => {
  const name = c.req.param("filename");
  if (!sampleDocuments.has(name)) return c.notFound();
  const source = await readFile(new URL("./public/samples/" + name, import.meta.url));
  return c.body(source, 200, { "Content-Type": name.endsWith(".pdf") ? "application/pdf" : "image/jpeg", "Cache-Control": "public, max-age=86400" });
});

// Explicit static allowlists: presentation modules and locally bundled assets only.
const presentationModules = new Set(["workflow.js", "fields.js", "api.js", "components.js", "currency-display.js", "contracts.js"]);
app.get("/ui/:filename", async (c) => {
  const name = c.req.param("filename");
  if (!presentationModules.has(name)) return c.notFound();
  const source = await readFile(new URL("./src/ui/" + name, import.meta.url));
  return c.body(source, 200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
});
const presentationAssets = {
  "/vendor/chart.umd.js": ["./public/vendor/chart.umd.js", "text/javascript; charset=utf-8"],
  "/fonts/plex-regular.woff2": ["./public/fonts/plex-regular.woff2", "font/woff2"],
  "/fonts/plex-medium.woff2": ["./public/fonts/plex-medium.woff2", "font/woff2"],
  "/fonts/plex-semibold.woff2": ["./public/fonts/plex-semibold.woff2", "font/woff2"],
};
for (const [path, [file, contentType]] of Object.entries(presentationAssets)) {
  app.get(path, async (c) => c.body(await readFile(new URL(file, import.meta.url)), 200, {
    "Content-Type": contentType, "Cache-Control": "public, max-age=86400",
  }));
}

app.get("/impact", async (c) => {
  const source = await readFile(new URL("./public/impact.html", import.meta.url));
  return c.body(source, 200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
});

app.get("/localization.js", async (c) => {
  const source = await readFile(new URL("./src/localization.js", import.meta.url));
  return c.body(source, 200, {
    "Content-Type": "text/javascript; charset=utf-8",
    "Cache-Control": "no-store",
  });
});

app.get("/locales/*", async (c) => {
  const match = /^\/locales\/([A-Za-z-]+)\.json$/.exec(c.req.path);
  const locale = match && LocaleSchema.safeParse(match[1]);
  if (!locale?.success) {
    return c.json({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "The requested locale file is not available.",
      },
    }, 404);
  }

  const source = await readFile(
    new URL(`./src/locales/${locale.data}.json`, import.meta.url)
  );
  return c.body(source, 200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
});

app.get("/money-contracts.js", async (c) => {
  const source = await readFile(new URL("./src/money-contracts.js", import.meta.url));
  return c.body(source, 200, {
    "Content-Type": "text/javascript; charset=utf-8",
    "Cache-Control": "no-store",
  });
});

app.get("/risk-ui.js", async (c) => {
  const source = await readFile(new URL("./src/risk-ui.js", import.meta.url));
  return c.body(source, 200, {
    "Content-Type": "text/javascript; charset=utf-8",
    "Cache-Control": "no-store",
  });
});

app.get("/impact-ui.js", async (c) => {
  const source = await readFile(new URL("./src/impact-ui.js", import.meta.url));
  return c.body(source, 200, {
    "Content-Type": "text/javascript; charset=utf-8",
    "Cache-Control": "no-store",
  });
});

app.route("/api/runs", createTraceRoutes(traceRegistry));

app.get("/", (c) => c.html(homePage));

app.get("/health", (c) => {
  return c.json({ ok: true, mode: process.env.K_SERVICE ? "cloud-run" : "local-development", executionMode });
});

app.get("/api/status", (c) => {
  const mode = process.env.K_SERVICE ? "cloud-run" : "local-development";
  const integrationNames = {
    extractOrder: "PDF order extraction",
    currentConditions: "stored sensor conditions",
    predictRisk: "five-defect risk prediction",
    optimizeRisk: "lever optimization",
    findSimilarRuns: "historical similar-run evidence",
    explainRisk: "evidence-grounded risk explanation",
    findSeenBefore: "historical defect evidence",
    prepareJob: "production job preparation",
    approveJob: "job approval and card generation",
    getJobCard: "approved job-card retrieval",
    saveFeedback: "feedback persistence",
    getLotOrder: "feedback lot-to-order association lookup",
    getStoredJobSheet: "stored job-sheet retrieval",
    createDraftJobSheet: "draft job-sheet persistence",
    getInsights: "historical production insights",
    getImpactSummary: "live Impact dashboard summary",
  };
  const unconfiguredIntegrations = Object.entries(servicePorts.availability)
    .filter(([key, configured]) => key === "prepareJob"
      ? !jobCreationAvailable
      : executionMode === "live-service" && [
        "createDraftJobSheet", "getStoredJobSheet", "approveJob", "getJobCard",
        "saveFeedback", "getLotOrder",
      ].includes(key)
        ? true
      : configured !== true)
    .map(([key]) => integrationNames[key]);
  const productionAdapterKeys = [
    "extractOrder",
    "currentConditions",
    "predictRisk",
    "optimizeRisk",
    "findSimilarRuns",
    "explainRisk",
    "findSeenBefore",
    "createDraftJobSheet",
    "getStoredJobSheet",
    "approveJob",
    "getJobCard",
    "saveFeedback",
    "getInsights",
    "getImpactSummary",
  ];
  const productionAdaptersConfigured = productionAdapterKeys.some(
    (key) => servicePorts.availability[key] === true
  );
  const liveModelCallsEnabled = process.env.USTAAD_ENABLE_LIVE_MODEL_CALLS === "true" &&
    (servicePorts.availability.extractOrder || servicePorts.availability.explainRisk);
  return c.json({
    ok: true,
    app: "Ustaad AI",
    description: "Corrugated Production-Prep Agent",
    status: "running",
    mode,
    executionMode,
    backendReachable: true,
    runtimeAvailability: {
      productionAdaptersConfigured,
      liveModelCallsEnabled,
      currentConditions: {
        adapterConfigured: servicePorts.availability.currentConditions,
        dataChecked: false,
      },
      integrationsVerified: false,
      supervisorAuthorizationAvailable: executionMode === "demo",
      jobSheetPersistenceAvailable,
      durableIdempotencyConfigured: false,
      idempotencyScope: idempotencyStore ? "process-local" : "unavailable",
      jobCreationAvailable,
    },
    integrations: {
      ...servicePorts.availability,
      approveJob: servicePorts.availability.approveJob && executionMode === "demo",
      getJobCard: servicePorts.availability.getJobCard && executionMode === "demo",
      getStoredJobSheet: servicePorts.availability.getStoredJobSheet && executionMode === "demo",
      createDraftJobSheet: servicePorts.availability.createDraftJobSheet && executionMode === "demo",
      saveFeedback: servicePorts.availability.saveFeedback && executionMode === "demo",
      prepareJob: jobCreationAvailable,
      supervisorAuthorizationAvailable: executionMode === "demo",
      jobSheetPersistenceAvailable,
      durableIdempotencyConfigured: false,
      idempotencyScope: idempotencyStore ? "process-local" : "unavailable",
      jobCreationAvailable,
    },
    isRealModelPrediction: false,
    modelAcceptance: getModelAcceptanceSummary(modelAcceptanceConfig),
    localCapabilities: [
      "purchase-order field validation",
      "run-condition validation",
      "currency formatting",
      "daily cached FX rates with a static fallback",
      "local PDF rendering for a caller-supplied validated JobSheet",
    ],
    unconfiguredIntegrations,
    supportedCurrencies: SUPPORTED_CURRENCIES,
    supportedLanguages: SUPPORTED_LANGUAGES,
    notes: [
      mode === "cloud-run"
        ? "This Cloud Run instance uses workload identity; only explicitly configured integrations are available, and status does not prove their connectivity."
        : "This local process uses only explicitly configured adapters; status does not prove Google Cloud connectivity.",
      "Model calls and BigQuery or Storage writes remain disabled unless their runtime gates are explicitly enabled.",
      "The local PDF renderer does not create job records or upload files.",
    ],
  });
});

app.post("/orders/extract", async (c) => {
  let form;
  try {
    form = await c.req.parseBody();
  } catch {
    return validationResponse(c, [{
      field: "body",
      path: [],
      code: "invalid_multipart",
      message: "Request must contain a valid multipart purchase-order file.",
    }], "Purchase order upload is invalid.");
  }

  const file = form.file;
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return validationResponse(c, [{
      field: "file",
      path: ["file"],
      code: "invalid_type",
      message: "A purchase-order PDF or JPEG file is required in the file field.",
    }], "Purchase order upload is invalid.");
  }

  const mimeType = identifyPurchaseOrderMimeType(
    file,
    new Uint8Array(await file.slice(0, 1024).arrayBuffer()),
  );
  if (!mimeType) {
    return validationResponse(c, [{
      field: "file",
      path: ["file"],
      code: "invalid_format",
      message: "The uploaded purchase order must be a valid PDF or JPEG image.",
    }], "Purchase order upload is invalid.");
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const syntheticOnlyResponse = syntheticPurchaseOrderUnavailable(c, fileBytes);
  if (syntheticOnlyResponse) return syntheticOnlyResponse;

  const rawOperatorFields = {};
  for (const field of ["orderId", "paperType", "paperSupplier"]) {
    const value = form[field];
    if (value === undefined || value === "") continue;
    rawOperatorFields[field] = value;
  }
  const operatorFields = OrderOperatorFieldsSchema.safeParse(rawOperatorFields);
  if (!operatorFields.success) {
    return validationResponse(c, operatorFields.error.issues.map((issue) => ({
      field: issue.path.join(".") || "operatorFields",
      path: ["operatorFields", ...issue.path],
      code: issue.code,
      message: issue.message,
    })), "Operator-supplied order context is invalid.");
  }

  const rawLineIndex = form.selectedLineIndex;
  const selectedLineIndex = rawLineIndex === undefined || rawLineIndex === ""
    ? undefined
    : Number(rawLineIndex);
  if (selectedLineIndex !== undefined &&
      (!Number.isSafeInteger(selectedLineIndex) || selectedLineIndex < 0)) {
    return validationResponse(c, [{
      field: "selectedLineIndex",
      path: ["selectedLineIndex"],
      code: "invalid_value",
      message: "selectedLineIndex must be a non-negative PO line number.",
    }], "Purchase order line selection is invalid.");
  }

  return responseForResult(c, await servicePorts.extractOrderForReview({
    file,
    operatorFields: operatorFields.data,
    ...(selectedLineIndex === undefined ? {} : { selectedLineIndex }),
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.get("/conditions/current", async (c) => {
  const displayPrefs = validateDisplayPrefs(c);
  if (!displayPrefs.ok) {
    return displayPrefs.response;
  }

  const shift = c.req.query("shift");
  if (shift === undefined) {
    return validationResponse(c, [{
      field: "shift",
      path: ["shift"],
      code: "invalid_value",
      message: "shift is required and must be DAY or NIGHT.",
    }], "Condition query failed validation.");
  }
  if (shift !== undefined && shift !== "DAY" && shift !== "NIGHT") {
    return validationResponse(c, [{
      field: "shift",
      path: ["shift"],
      code: "invalid_value",
      message: "shift must be DAY or NIGHT.",
    }], "Condition query failed validation.");
  }

  return responseForResult(c, await servicePorts.currentConditions({
    shift,
    lang: displayPrefs.data.lang,
    currency: displayPrefs.data.currency,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.get("/fx", async (c) => {
  const displayPrefs = validateDisplayPrefs(c);
  if (!displayPrefs.ok) {
    return displayPrefs.response;
  }

  const base = c.req.query("base") ?? "INR";
  const validated = validateInput(
    c,
    LaunchCurrencySchema,
    base,
    "FX base currency is not supported."
  );
  if (!validated.ok) {
    return validated.response;
  }

  return c.json(await fxRatesService.getRates(validated.data));
});

app.post("/risk/predict", async (c) => {
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const validated = validateInput(
    c,
    RiskPredictionRequestSchema,
    request.body,
    "Risk prediction request failed validation."
  );
  if (!validated.ok) {
    return validated.response;
  }

  return responseForResult(c, await servicePorts.predictRisk({
    ...validated.data,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.post("/risk/optimize", async (c) => {
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const validated = validateInput(
    c,
    RiskOptimizationRequestSchema,
    request.body,
    "Risk optimization request failed validation."
  );
  if (!validated.ok) {
    return validated.response;
  }

  return responseForResult(c, await servicePorts.optimizeRisk({
    ...validated.data,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.post("/jobs", async (c) => {
  const unavailableResponse = supervisorWorkflowUnavailable(c);
  if (unavailableResponse) return unavailableResponse;
  let form;
  try {
    form = await c.req.parseBody();
  } catch {
    return validationResponse(c, [{
      field: "body",
      path: [],
      code: "invalid_multipart",
      message: "Request must contain a valid multipart purchase-order file.",
    }], "Job request is invalid.");
  }

  const file = form.file;
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return validationResponse(c, [{
      field: "file",
      path: ["file"],
      code: "invalid_type",
      message: "A purchase-order PDF or JPEG file is required in the file field.",
    }], "Job request is invalid.");
  }

  const mimeType = identifyPurchaseOrderMimeType(
    file,
    new Uint8Array(await file.slice(0, 1024).arrayBuffer()),
  );
  if (!mimeType) {
    return validationResponse(c, [{
      field: "file",
      path: ["file"],
      code: "invalid_format",
      message: "The uploaded purchase order must be a valid PDF or JPEG image.",
    }], "Job request is invalid.");
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const syntheticOnlyResponse = syntheticPurchaseOrderUnavailable(c, fileBytes);
  if (syntheticOnlyResponse) return syntheticOnlyResponse;

  const rawOperatorFields = {};
  for (const field of ["orderId", "paperType", "paperSupplier"]) {
    const value = form[field];
    if (typeof value === "string" && value.trim() !== "") rawOperatorFields[field] = value;
  }
  const operatorFields = OrderOperatorFieldsSchema.safeParse(rawOperatorFields);
  const numericLevers = new Set([
    "sfSpeedMpm", "rollTempC", "gumViscositySec", "dryingHours", "printSpeedSpm",
  ]);
  const rawLevers = {};
  for (const field of [
    "sfSpeedMpm", "rollTempC", "gumApplication", "gumViscositySec",
    "pastingPressure", "dryingHours", "printSpeedSpm",
  ]) {
    const value = form[field];
    if (typeof value === "string" && value.trim() !== "") {
      rawLevers[field] = numericLevers.has(field) ? Number(value) : value;
    }
  }
  const levers = LeversSchema.safeParse(rawLevers);
  const rawItemConfirmation = {
    itemCode: form.confirmedItemCode,
    quantity: typeof form.confirmedQuantity === "string" ? Number(form.confirmedQuantity) : form.confirmedQuantity,
    ...(typeof form.confirmedLineIndex === "string" && form.confirmedLineIndex.trim() !== ""
      ? { lineIndex: Number(form.confirmedLineIndex) - 1 }
      : {}),
  };
  const operatorItemConfirmation = OperatorItemConfirmationSchema.safeParse(rawItemConfirmation);
  const reviewId = form.reviewId;
  const reviewFingerprint = form.reviewFingerprint;
  const hasReviewReference = reviewId !== undefined || reviewFingerprint !== undefined;
  const hasReviewId = typeof reviewId === "string" && reviewId.trim() !== "";
  const hasReviewFingerprint = typeof reviewFingerprint === "string" && reviewFingerprint.trim() !== "";
  if (hasReviewReference && (!hasReviewId || !hasReviewFingerprint ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(reviewId) ||
      !/^[a-f0-9]{64}$/.test(reviewFingerprint))) {
    return validationResponse(c, [{
      field: "purchaseOrderReview",
      path: ["reviewId"],
      code: "incomplete_review_reference",
      message: "Both reviewId and reviewFingerprint are required to use the reviewed PO.",
    }], "The purchase-order review reference is invalid.");
  }
  if (hasReviewId && form.confirmedSourceLine !== "true") {
    return validationResponse(c, [{
      field: "confirmedSourceLine",
      path: ["confirmedSourceLine"],
      code: "confirmation_required",
      message: "Confirm the selected item's code and quantity against the displayed source PO line.",
    }], "The selected PO line has not been confirmed.");
  }
  const shift = form.shift;
  const rawManualConditions = {
    runDate: form.runDate,
    shift,
    ambientRhPct: typeof form.ambientRhPct === "string" ? Number(form.ambientRhPct) : form.ambientRhPct,
    ambientTempC: typeof form.ambientTempC === "string" ? Number(form.ambientTempC) : form.ambientTempC,
    paperMoisturePct: typeof form.paperMoisturePct === "string" ? Number(form.paperMoisturePct) : form.paperMoisturePct,
  };
  const manualConditions = RunConditionsSchema.safeParse(rawManualConditions);
  const conditionsConfirmed = form.conditionsConfirmed === "true";
  const issues = [
    ...(operatorFields.success ? [] : operatorFields.error.issues.map((issue) => ({
      field: issue.path.join("."),
      path: ["operatorFields", ...issue.path],
      code: issue.code,
      message: issue.message,
    }))),
    ...(levers.success ? [] : levers.error.issues.map((issue) => ({
      field: issue.path.join("."),
      path: ["levers", ...issue.path],
      code: issue.code,
      message: issue.message,
    }))),
    ...(operatorItemConfirmation.success ? [] : operatorItemConfirmation.error.issues.map((issue) => ({
      field: issue.path.join("."),
      path: ["operatorItemConfirmation", ...issue.path],
      code: issue.code,
      message: issue.message,
    }))),
    ...(shift === "DAY" || shift === "NIGHT" ? [] : [{
      field: "shift",
      path: ["shift"],
      code: "invalid_value",
      message: "Select the actual DAY or NIGHT shift.",
    }]),
    ...(manualConditions.success ? [] : manualConditions.error.issues.map((issue) => ({
      field: issue.path.join("."),
      path: ["conditions", ...issue.path],
      code: issue.code,
      message: issue.message,
    }))),
    ...(conditionsConfirmed ? [] : [{
      field: "conditionsConfirmed",
      path: ["conditionsConfirmed"],
      code: "confirmation_required",
      message: "A supervisor must confirm or edit the manual condition values before prediction.",
    }]),
  ];
  if (issues.length) {
    return validationResponse(c, issues, "Job preparation requires confirmed order context, shift and actual machine settings.");
  }

  // Idempotency: read the optional client-supplied key from the request header.
  // When present, the key is bound to a fingerprint of the validated request.
  // Resubmitting the same key with different inputs returns 409 CONFLICT.
  // Without durable persistence and a shared idempotency store, the submission
  // handler returns SERVICE_UNAVAILABLE before running job preparation.
  const rawIdempotencyKey = c.req.header("Idempotency-Key");
  const identity = createJobRequestIdentity({
    idempotencyKey: rawIdempotencyKey,
    fileBytes,
    operatorFields: operatorFields.data,
    operatorItemConfirmation: operatorItemConfirmation.data,
    shift,
    levers: levers.data,
    conditions: manualConditions.data,
    ...(hasReviewFingerprint ? { purchaseOrderReviewFingerprint: reviewFingerprint } : {}),
  });
  if (!identity.ok) {
    // Key is present but malformed — return a validation error.
    return validationResponse(c, identity.error.issues ?? [], identity.error.message);
  }

  const signal = c.get(REQUEST_SIGNAL_CONTEXT_KEY);
  return responseForResult(c, await submitJob({
    identity: identity.identity,
    request: {
      file: { arrayBuffer: async () => fileBytes.buffer },
      operatorFields: operatorFields.data,
      operatorItemConfirmation: operatorItemConfirmation.data,
      ...(hasReviewId ? {
        purchaseOrderReview: {
          reviewId,
          reviewFingerprint,
          confirmedSourceLine: form.confirmedSourceLine === "true",
        },
      } : {}),
      shift,
      levers: levers.data,
      manualConditions: manualConditions.data,
      conditionsConfirmed,
    },
    signal,
  }));
});

app.post("/job-sheets/render.pdf", async (c) => {
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const validated = validateInput(
    c,
    JobSheetSchema,
    request.body,
    "JobSheet failed validation."
  );
  if (!validated.ok) {
    return validated.response;
  }

  const locale = validateInput(
    c,
    LocaleSchema,
    c.req.query("lang") ?? "en",
    "PDF language preference failed validation."
  );
  if (!locale.ok) {
    return locale.response;
  }

  try {
    const pdf = await renderJobSheetPdf(validated.data, { locale: locale.data });
    return c.body(pdf, 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="job-sheet.pdf"',
      "Cache-Control": "no-store",
    });
  } catch (error) {
    if (!(error instanceof PdfFontUnavailableError)) {
      throw error;
    }

    return c.json({
      ok: false,
      error: {
        code: error.code,
        message: error.message,
      },
    }, 503);
  }
});

app.get("/jobs/:id", async (c) => {
  const unavailableResponse = supervisorWorkflowUnavailable(c);
  if (unavailableResponse) return unavailableResponse;
  const validated = validateInput(c, JobIdSchema, c.req.param("id"), "Job ID failed validation.");
  if (!validated.ok) {
    return validated.response;
  }

  return responseForResult(c, await lookupStoredJobSheet({
    jobId: validated.data,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.post("/jobs/:id/approve", async (c) => {
  const unavailableResponse = supervisorWorkflowUnavailable(c);
  if (unavailableResponse) return unavailableResponse;
  const validated = validateInput(c, JobIdSchema, c.req.param("id"), "Job ID failed validation.");
  if (!validated.ok) {
    return validated.response;
  }
  const displayPrefs = validateDisplayPrefs(c);
  if (!displayPrefs.ok) {
    return displayPrefs.response;
  }

  return responseForResult(c, await servicePorts.approveJob({
    jobId: validated.data,
    lang: displayPrefs.data.lang,
    currency: displayPrefs.data.currency,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.get("/jobs/:id/card.pdf", async (c) => {
  const unavailableResponse = supervisorWorkflowUnavailable(c);
  if (unavailableResponse) return unavailableResponse;
  const validated = validateInput(c, JobIdSchema, c.req.param("id"), "Job ID failed validation.");
  if (!validated.ok) {
    return validated.response;
  }
  const displayPrefs = validateDisplayPrefs(c);
  if (!displayPrefs.ok) {
    return displayPrefs.response;
  }

  const result = await servicePorts.getJobCard({
    jobId: validated.data,
    lang: displayPrefs.data.lang,
    currency: displayPrefs.data.currency,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  });
  if (result.ok && result.bytes instanceof Uint8Array) {
    return c.body(result.bytes, 200, {
      "Content-Type": result.contentType,
      "Content-Disposition": `inline; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    });
  }
  return responseForResult(c, result);
});

app.post("/jobs/:id/feedback", async (c) => {
  const unavailableResponse = supervisorWorkflowUnavailable(c);
  if (unavailableResponse) return unavailableResponse;
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const jobId = validateInput(c, JobIdSchema, c.req.param("id"), "Job ID failed validation.");
  if (!jobId.ok) {
    return jobId.response;
  }
  const feedback = validateInput(
    c,
    FeedbackInputSchema,
    request.body,
    "Feedback request failed validation."
  );
  if (!feedback.ok) {
    return feedback.response;
  }
  if (feedback.data.jobId !== jobId.data) {
    return validationResponse(c, [{
      field: "jobId",
      path: ["jobId"],
      code: "custom",
      message: "Feedback jobId must match the job ID in the URL.",
    }], "Feedback request failed validation.");
  }

  return responseForResult(c, await saveLinkedFeedback({
    ...feedback.data,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.get("/insights/summary", async (c) => {
  const displayPrefs = validateDisplayPrefs(c);
  if (!displayPrefs.ok) {
    return displayPrefs.response;
  }
  const query = validateInput(
    c,
    InsightsQuerySchema,
    { from: c.req.query("from"), to: c.req.query("to") },
    "Insights date range failed validation."
  );
  if (!query.ok) {
    return query.response;
  }

  return responseForResult(c, await servicePorts.getInsights({
    ...query.data,
    lang: displayPrefs.data.lang,
    currency: displayPrefs.data.currency,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.get("/impact/summary", async (c) => {
  return responseForResult(c, await servicePorts.getImpactSummary({
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.post("/evidence/seen-before", async (c) => {
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }
  const validated = validateInput(
    c,
    SeenBeforeRequestSchema,
    request.body,
    "Historical defect-evidence request failed validation."
  );
  if (!validated.ok) {
    return validated.response;
  }
  return responseForResult(c, await servicePorts.findSeenBefore({
    ...validated.data,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.post("/risk/similar-runs", async (c) => {
  const request = await readJsonBody(c);
  if (!request.ok) return request.response;
  const validated = validateInput(
    c,
    SimilarRunsRequestSchema,
    request.body,
    "Similar-run request failed validation."
  );
  if (!validated.ok) return validated.response;
  return responseForResult(c, await servicePorts.findSimilarRuns({
    ...validated.data,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.post("/risk/explanation", async (c) => {
  const request = await readJsonBody(c);
  if (!request.ok) return request.response;
  const validated = validateInput(
    c,
    RiskExplanationRequestSchema,
    request.body,
    "Risk explanation request failed validation."
  );
  if (!validated.ok) return validated.response;
  if (!isModelSetAccepted(modelAcceptanceConfig)) {
    return c.json({
      ok: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Risk explanation is blocked until the current five-model set has complete version-linked acceptance evidence.",
      },
      modelAcceptance: getModelAcceptanceSummary(modelAcceptanceConfig),
    }, 503);
  }
  return responseForResult(c, await servicePorts.explainRisk({
    ...validated.data,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.post("/api/agents/extractOrder", async (c) => {
  return c.json({
    ok: false,
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "This legacy JSON extraction endpoint is disabled. Use POST /orders/extract with a PDF or JPEG and a configured extraction adapter.",
    },
  }, 503);
});

app.post("/api/agents/getConditions", async (c) => {
  const unavailableResponse = demoAgentUnavailable(c);
  if (unavailableResponse) return unavailableResponse;
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  return responseForResult(c, getConditions(request.body));
});

app.post("/api/agents/predictRisk", async (c) => {
  const unavailableResponse = demoAgentUnavailable(c);
  if (unavailableResponse) return unavailableResponse;
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const { order, conditions, levers } = request.body;
  return responseForResult(c, predictRisk(order, conditions, levers));
});

app.post("/api/agents/optimizeLevers", async (c) => {
  const unavailableResponse = demoAgentUnavailable(c);
  if (unavailableResponse) return unavailableResponse;
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const { order, conditions } = request.body;
  return responseForResult(c, optimizeLevers(order, conditions));
});

app.post("/api/agents/findSimilarRuns", async (c) => {
  const unavailableResponse = demoAgentUnavailable(c);
  if (unavailableResponse) return unavailableResponse;
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const { order, conditions } = request.body;
  return responseForResult(c, findSimilarRuns(order, conditions));
});

app.post("/api/agents/explainRisk", async (c) => {
  const unavailableResponse = demoAgentUnavailable(c);
  if (unavailableResponse) return unavailableResponse;
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const { order, conditions, riskEvidence } = request.body;
  return responseForResult(c, explainRisk(order, conditions, riskEvidence));
});

app.post("/api/agents/generateJobSheet", async (c) => {
  const unavailableResponse = demoAgentUnavailable(c);
  if (unavailableResponse) return unavailableResponse;
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const { order, conditions, analysis } = request.body;
  return responseForResult(c, generateJobSheet(order, conditions, analysis));
});

const port = readServerPort(process.env.PORT);

serve({
  fetch: app.fetch,
  port,
});

console.log(`Ustaad AI Prep Agent running at http://localhost:${port}`);
