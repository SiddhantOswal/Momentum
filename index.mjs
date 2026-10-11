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
  LaunchCurrencySchema,
  LocaleSchema,
  RiskOptimizationRequestSchema,
  RiskPredictionRequestSchema,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
  ValidationFailureSchema,
} from "./src/schemas.js";
import { PdfFontUnavailableError, renderJobSheetPdf } from "./src/job-sheet-pdf.js";
import { homePage } from "./src/operator-ui.js";
import { createTraceRoutes } from "./src/trace-routes.js";
import { traceRegistry } from "./src/trace-registry.js";
import { fxRatesService } from "./src/fx-rates.js";
import { servicePorts } from "./src/service-ports.js";
import {
  createPerIpRateLimitMiddleware,
  createRequestTimeoutMiddleware,
  REQUEST_SIGNAL_CONTEXT_KEY,
} from "./src/request-guardrails.js";
import {
  extractOrder,
  findSimilarRuns,
  generateJobSheet,
  getConditions,
  explainRisk,
  optimizeLevers,
  predictRisk,
} from "./src/mock-agents.js";

const app = new Hono();
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

  return c.json(result, result.error?.code === "SERVICE_UNAVAILABLE" ? 503 : 400);
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
      mode: "local-development",
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
      mode: "local-development",
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

app.route("/api/runs", createTraceRoutes(traceRegistry));

app.get("/", (c) => c.html(homePage));

app.get("/health", (c) => {
  return c.json({ ok: true, mode: "local-development" });
});

app.get("/api/status", (c) => {
  return c.json({
    ok: true,
    app: "Ustaad AI",
    description: "Corrugated Production-Prep Agent",
    status: "running",
    mode: "local-development",
    isRealModelPrediction: false,
    localCapabilities: [
      "purchase-order field validation",
      "run-condition validation",
      "currency formatting",
      "daily cached FX rates with a static fallback",
      "local PDF rendering for a caller-supplied validated JobSheet",
    ],
    unconfiguredIntegrations: [
      "Gemini on Vertex AI",
      "BigQuery and BigQuery ML",
      "Cloud Storage",
      "Cloud Translation",
      "Pub/Sub and Dataflow",
    ],
    supportedCurrencies: SUPPORTED_CURRENCIES,
    supportedLanguages: SUPPORTED_LANGUAGES,
    notes: [
      "This local build does not contact Google Cloud resources.",
      "Cloud-backed predictions, evidence, optimizations, JobSheet generation, persistence, and job-card storage are unavailable until integrations are configured.",
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
      message: "Request must contain a valid multipart PDF upload.",
    }], "Purchase order upload is invalid.");
  }

  const file = form.file;
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return validationResponse(c, [{
      field: "file",
      path: ["file"],
      code: "invalid_type",
      message: "A purchase-order PDF file is required in the file field.",
    }], "Purchase order upload is invalid.");
  }

  const name = typeof file.name === "string" ? file.name.toLowerCase() : "";
  if (file.type !== "application/pdf" && !name.endsWith(".pdf")) {
    return validationResponse(c, [{
      field: "file",
      path: ["file"],
      code: "invalid_format",
      message: "The uploaded purchase order must be a PDF.",
    }], "Purchase order upload is invalid.");
  }

  const header = Buffer.from(await file.slice(0, 1024).arrayBuffer());
  if (!header.includes(Buffer.from("%PDF-"))) {
    return validationResponse(c, [{
      field: "file",
      path: ["file"],
      code: "invalid_pdf",
      message: "The uploaded file does not contain a PDF header.",
    }], "Purchase order upload is invalid.");
  }

  return responseForResult(c, await servicePorts.extractOrder({
    file,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.get("/conditions/current", async (c) => {
  const displayPrefs = validateDisplayPrefs(c);
  if (!displayPrefs.ok) {
    return displayPrefs.response;
  }

  const shift = c.req.query("shift");
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
  let form;
  try {
    form = await c.req.parseBody();
  } catch {
    return validationResponse(c, [{
      field: "body",
      path: [],
      code: "invalid_multipart",
      message: "Request must contain a valid multipart PDF upload.",
    }], "Job request is invalid.");
  }

  const file = form.file;
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return validationResponse(c, [{
      field: "file",
      path: ["file"],
      code: "invalid_type",
      message: "A purchase-order PDF file is required in the file field.",
    }], "Job request is invalid.");
  }

  const name = typeof file.name === "string" ? file.name.toLowerCase() : "";
  if (file.type !== "application/pdf" && !name.endsWith(".pdf")) {
    return validationResponse(c, [{
      field: "file",
      path: ["file"],
      code: "invalid_format",
      message: "The uploaded purchase order must be a PDF.",
    }], "Job request is invalid.");
  }

  return responseForResult(c, await servicePorts.prepareJob({
    form,
    file,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
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

app.post("/jobs/:id/approve", async (c) => {
  const validated = validateInput(c, JobIdSchema, c.req.param("id"), "Job ID failed validation.");
  if (!validated.ok) {
    return validated.response;
  }

  return responseForResult(c, await servicePorts.approveJob({
    jobId: validated.data,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.get("/jobs/:id/card.pdf", async (c) => {
  const validated = validateInput(c, JobIdSchema, c.req.param("id"), "Job ID failed validation.");
  if (!validated.ok) {
    return validated.response;
  }
  const displayPrefs = validateDisplayPrefs(c);
  if (!displayPrefs.ok) {
    return displayPrefs.response;
  }

  return responseForResult(c, await servicePorts.getJobCard({
    jobId: validated.data,
    lang: displayPrefs.data.lang,
    currency: displayPrefs.data.currency,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.post("/jobs/:id/feedback", async (c) => {
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

  return responseForResult(c, await servicePorts.saveFeedback({
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

app.post("/api/agents/extractOrder", async (c) => {
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  return responseForResult(c, extractOrder(request.body));
});

app.post("/api/agents/getConditions", async (c) => {
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  return responseForResult(c, getConditions(request.body));
});

app.post("/api/agents/predictRisk", async (c) => {
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const { order, conditions, levers } = request.body;
  return responseForResult(c, predictRisk(order, conditions, levers));
});

app.post("/api/agents/optimizeLevers", async (c) => {
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const { order, conditions } = request.body;
  return responseForResult(c, optimizeLevers(order, conditions));
});

app.post("/api/agents/findSimilarRuns", async (c) => {
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const { order, conditions } = request.body;
  return responseForResult(c, findSimilarRuns(order, conditions));
});

app.post("/api/agents/explainRisk", async (c) => {
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const { order, conditions, riskEvidence } = request.body;
  return responseForResult(c, explainRisk(order, conditions, riskEvidence));
});

app.post("/api/agents/generateJobSheet", async (c) => {
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const { order, conditions, analysis } = request.body;
  return responseForResult(c, generateJobSheet(order, conditions, analysis));
});

const port = Number(process.env.PORT) || 8080;

serve({
  fetch: app.fetch,
  port,
});

console.log(`Ustaad AI Prep Agent running at http://localhost:${port}`);