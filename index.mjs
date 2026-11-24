import { isSameApplicationOrigin } from "./src/request-origin.js";
import { getCookie, setCookie } from "hono/cookie";
import { createHackathonDemoAuthenticator, HACKATHON_APPROVAL_NOTE } from "./src/hackathon-demo-auth.js";
import { createGeminiCallerMiddleware } from "./src/gemini-caller-context.js";
import { createPitchClaimExchange, PITCH_RESERVE_GRANT } from "./src/pitch-claim.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { serve } from "@hono/node-server";
import {
  FeedbackInputSchema,
  InsightsQuerySchema,
  JobIdSchema,
  JobSheetSchema,
  LaunchCurrencySchema,
  LocaleSchema,
  RiskOptimizationRequestSchema,
  RiskExplanationRequestSchema,
  GuardedRiskPredictionRequestSchema,
  SimilarRunsRequestSchema,
} from "./src/schemas.js";
import { PdfFontUnavailableError, renderJobSheetPdf } from "./src/job-sheet-pdf.js";
import { readServerPort } from "./src/runtime-config.js";
import { homePage } from "./src/operator-ui.js";
import { createTraceRoutes } from "./src/trace-routes.js";
import { createArcRoutes } from "./src/arc/routes.js";
import { createFirestoreArcSessionStore } from "./src/google-cloud/firestore-arc-session-store.js";
import { createFirestoreArcTaskRunStore } from "./src/google-cloud/firestore-arc-task-run-store.js";
import { streamSSE } from "hono/streaming";
import { createLiveStore } from "./src/google-cloud/live-store.js";
import { canApprove, initializeUserSessionAuth, SESSION_COOKIE } from "./src/user-session-auth.js";
import { createWeatherProviderFromEnv } from "./src/google-cloud/weather-service.js";
import { configureDurableTraces, traceRegistry } from "./src/trace-registry.js";
import { createFirestoreTraceStore } from "./src/google-cloud/firestore-trace-store.js";
import { fxRatesService } from "./src/fx-rates.js";
import { servicePorts } from "./src/service-ports.js";
import modelAcceptanceConfig from "./config/model-acceptance.json" with { type: "json" };
import { getModelAcceptanceSummary, isModelSetAccepted } from "./src/model-acceptance.js";
import { createJobCoordinator } from "./src/job-coordinator.js";
import { createLinkedFeedbackService } from "./src/linked-feedback-service.js";
import { createStoredJobSheetLookup } from "./src/stored-job-sheet-lookup.js";
import { selectJobIdempotencyStore } from "./src/job-idempotency.js";
import { createJobSubmissionHandler } from "./src/job-draft-persistence.js";
import { authorizeSupervisor } from "./src/commands/authorize.js";
import { validateDisplayPrefs as validateDisplayPrefsInput, validateWith, validationFailure } from "./src/commands/validation.js";
import { getStatusWithBudget, impactSummary } from "./src/commands/status.js";
import { liveActor } from "./src/commands/live-events.js";
import { readOrder } from "./src/commands/read-order.js";
import { planLot } from "./src/commands/plan-lot.js";
import { getJob } from "./src/commands/get-job.js";
import { getLot } from "./src/commands/get-lot.js";
import { updateLotConditions } from "./src/commands/update-conditions.js";
import { approveJob } from "./src/commands/approve-job.js";
import { getCard } from "./src/commands/get-card.js";
import { createWeatherCache, readWeather } from "./src/commands/read-weather.js";
import { classifyApprovedPhoto, diagnoseUploadedPhoto, listApprovedPhotos } from "./src/commands/photos.js";
import { findSeenBefore } from "./src/commands/history.js";
import {
  firebaseWebClientConfig,
  initializeFirebaseSupervisorAuthenticator,
} from "./src/firebase-supervisor-auth.js";
import {
  createApiRateLimitMiddleware,
  createClientKeyResolver,
  createIpKeyDeriver,
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
const demoMode = !isCloudRun && process.env.USTAAD_AUTHORIZATION_MODE !== "HACKATHON_DEMO" && process.env.USTAAD_ENABLE_DEMO_MODE === "true";
const executionMode = demoMode ? "demo" : isCloudRun ? "live-service" : "offline";
const supervisorAuthenticator = await initializeFirebaseSupervisorAuthenticator(process.env);
const supervisorWebConfig = firebaseWebClientConfig(process.env);
// Production sign-in (USTAAD_AUTH_MODE=FIREBASE_SESSION): Google accounts, session cookie, roles by email.
const userSessionAuth = await initializeUserSessionAuth(process.env);
const sessionWebConfig = userSessionAuth ? firebaseWebClientConfig({ ...process.env, USTAAD_FIREBASE_AUTH_ENABLED: "true" }) : undefined;
const hackathonAuth = createHackathonDemoAuthenticator({ mode: process.env.USTAAD_AUTHORIZATION_MODE,
  signingKey: process.env.USTAAD_DEMO_SESSION_SIGNING_KEY,
  syntheticOnly: process.env.USTAAD_SYNTHETIC_ONLY === "true",
  auditEnabled: process.env.USTAAD_ENABLE_APPROVAL_AUDIT === "true" });
const approvalAuthorizationConfigured = hackathonAuth.enabled ? hackathonAuth.configured : supervisorAuthenticator.configured;
const demoTraceOwners = new Map();
// USTAAD_ENABLE_DURABLE_TRACES: trace events and owners also go to Firestore, so any instance can serve a run.
const durableTraces = configureDurableTraces({
  env: process.env,
  registry: traceRegistry,
  createStore: () => createFirestoreTraceStore({ projectId: process.env.PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT }),
});
// Central live store: Firestore in the cloud (opt-in), memory locally. Publishing never fails a request,
// but is awaited: Cloud Run throttles CPU once a response is sent, so a fire-and-forget write can stall.
const liveStore = createLiveStore({
  enabled: process.env.USTAAD_ENABLE_LIVE_STORE === "true",
  projectId: process.env.PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT,
});
function isSameOrigin({ origin, requestUrl }) {
  return isSameApplicationOrigin({ origin, requestUrl, cloudRun: isCloudRun, configuredOrigin: process.env.USTAAD_PUBLIC_ORIGIN });
}
function sameOrigin(c) {
  return isSameOrigin({ origin: c.req.header("Origin"), requestUrl: c.req.url });
}

const plantId = process.env.USTAAD_PLANT_ID ??
  (demoMode ? "PLANT-DEMO-01" : undefined);
const prepareJob = createJobCoordinator({
  services: servicePorts,
  traceRegistry: durableTraces.registry,
  plantId,
  allowSyntheticDemoConditions: demoMode,
});
const jobSheetPersistenceAvailable =
  servicePorts.availability.createDraftJobSheet === true &&
  servicePorts.availability.getStoredJobSheet === true;
// Shared Firestore claims prevent two service instances from creating the same job.
const jobIdempotency = selectJobIdempotencyStore({
  jobIdempotency: servicePorts.jobIdempotency,
  demoMode,
});
const idempotencyStore = jobIdempotency.store;
const jobCreationAvailable = jobSheetPersistenceAvailable &&
  typeof idempotencyStore?.claim === "function" &&
  (executionMode === "demo" ||
    (isModelSetAccepted(modelAcceptanceConfig) && approvalAuthorizationConfigured));

const submitJob = createJobSubmissionHandler({
  prepareJob,
  createDraftJobSheet: servicePorts.createDraftJobSheet,
  getStoredJobSheet: servicePorts.getStoredJobSheet,
  draftPersistenceEnabled: jobCreationAvailable,
  storedJobLookupEnabled: servicePorts.availability.getStoredJobSheet === true,
  plantId,
  store: idempotencyStore,
  leaseMs: jobIdempotency.leaseMs,
});

const saveLinkedFeedback = createLinkedFeedbackService({
  getStoredJobSheet: servicePorts.getStoredJobSheet,
  getLotOrder: servicePorts.getLotOrder,
  saveFeedback: servicePorts.saveFeedback,
});
const lookupStoredJobSheet = createStoredJobSheetLookup({
  getStoredJobSheet: servicePorts.getStoredJobSheet,
  testOnly: executionMode !== "demo",
});
const MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024;
const isArcRequest = (c) => c.req.path === "/api/arc" || c.req.path.startsWith("/api/arc/");
const limitRequestBody = bodyLimit({
  maxSize: MAX_REQUEST_BODY_BYTES,
  onError: (c) => c.json({
    ok: false,
    error: {
      code: "PAYLOAD_TOO_LARGE",
      message: "Request body must not exceed 10 MiB.",
    },
  }, 413),
});
const resolveClientKey = createClientKeyResolver(process.env);
const clientIpKey = (c) => createIpKeyDeriver(process.env.USTAAD_DEMO_SESSION_SIGNING_KEY)(resolveClientKey(c));
// The code is read once from the Secret Manager value the service mounts as an env var, and only its digest is kept.
const pitchExchange = createPitchClaimExchange(process.env.ARC_PITCH_RESERVE_CODE);
const apiRateLimit = createApiRateLimitMiddleware({
  ipLimit: 300,
  getClientIp: resolveClientKey,
  getSessionId: (c) => {
    if (!hackathonAuth.configured) return undefined;
    const session = hackathonAuth.authenticate(getCookie(c, "__Host-ustaad-demo"));
    return session.ok ? session.principal.sessionId : undefined;
  },
});

app.use("/api/arc/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  return next();
});

// Every Gemini call made while serving a request is charged to this session and address.
app.use("*", createGeminiCallerMiddleware({
  getPrincipal: (c) => {
    if (!hackathonAuth.configured) return undefined;
    const session = hackathonAuth.authenticate(getCookie(c, "__Host-ustaad-demo"));
    return session.ok ? session.principal : undefined;
  },
  getIpKey: clientIpKey,
}));

const requestTimeout = createRequestTimeoutMiddleware();
app.use("*", (c, next) => {
  if (c.req.method === "GET" && /^\/api\/runs\/[^/]+\/events$/.test(c.req.path)) {
    return next();
  }
  return requestTimeout(c, next);
});

// Arc checks the global body limit before charging either rate-limit bucket.
app.use("/api/arc/*", limitRequestBody);
app.use("/api/*", apiRateLimit);
app.use("/orders/*", apiRateLimit);
app.use("/conditions/*", apiRateLimit);
app.use("/fx", apiRateLimit);
app.use("/risk/*", apiRateLimit);
app.use("/jobs", apiRateLimit);
app.use("/jobs/*", apiRateLimit);
app.use("/lots/*", apiRateLimit);
app.use("/job-sheets/*", apiRateLimit);
app.use("/insights/*", apiRateLimit);
app.use("/impact/*", apiRateLimit);
app.use("/evidence/*", apiRateLimit);

app.use("*", (c, next) => isArcRequest(c) ? next() : limitRequestBody(c, next));

function responseForResult(c, result) {
  const actor = c.get("verifiedSupervisorPrincipal");
  if (hackathonAuth.enabled && actor && result?.runId) {
    if (durableTraces.claimOwner) {
      return durableTraces.claimOwner(result.runId, actor.sessionId).then(() => resultResponse(c, result));
    }
    while (demoTraceOwners.size >= 1000) demoTraceOwners.delete(demoTraceOwners.keys().next().value);
    demoTraceOwners.set(result.runId, actor.sessionId);
  }
  return resultResponse(c, result);
}

function resultResponse(c, result) {
  if (result.ok) {
    return c.json(result);
  }

  const status = result.error?.code === "GEMINI_DAILY_CAP_EXCEEDED" ? 429
    : result.error?.code === "SERVICE_UNAVAILABLE" ? 503
    : result.error?.code === "NOT_FOUND" ? 404
      : result.error?.code === "CONFLICT" || result.error?.code === "IDEMPOTENCY_IN_PROGRESS" ? 409
        : 400;
  return c.json(result, status);
}

// Command failures that choose their own HTTP status carry it beside the body.
function commandResponse(c, result) {
  if (result?.ok === false && Number.isInteger(result.status)) {
    const { status, ...body } = result;
    return c.json(body, status);
  }
  return responseForResult(c, result);
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

const SUPERVISOR_PRINCIPAL_CONTEXT_KEY = "verifiedSupervisorPrincipal";
const privilegedPortNames = [
  "getApprovedPhotos", "classifyApprovedPhoto", "extractOrder", "currentConditions", "predictRisk", "optimizeRisk", "explainRisk",
  "findSimilarRuns", "findSeenBefore", "prepareJob", "createDraftJobSheet",
  "getStoredJobSheet", "approveJob", "getJobCard", "saveFeedback", "getInsights",
];
const localPrivilegedAdapterConfigured = privilegedPortNames.some((name) => servicePorts.availability[name] === true);

// Shared by every command call from a route; Arc tools build the same set.
const commandDeps = Object.freeze({
  userSessionAuth,
  hackathonAuth,
  supervisorAuthenticator,
  executionMode,
  localPrivilegedAdapterConfigured,
  traceOwners: demoTraceOwners,
  traceOwnerLookup: durableTraces.ownerOf,
  isSameOrigin,
  env: process.env,
  servicePorts,
  lotRevisions: servicePorts.lotRevisions,
  approvalAuthorizationConfigured,
  jobSheetPersistenceAvailable,
  jobCreationAvailable,
  idempotencyStore,
  idempotencyScope: jobIdempotency.scope,
  modelAcceptanceConfig,
  liveStore,
  submitJob,
  demoMode,
  lookupStoredJobSheet,
  newCorrelationId: randomUUID,
  now: Date.now,
  log: (line) => console.info(line),
  weatherProvider: createWeatherProviderFromEnv(process.env),
  weatherCache: createWeatherCache(),
  purchaseOrderPolicy: Object.freeze({
    acceptRealOrders: Boolean(userSessionAuth?.configured) && process.env.USTAAD_ACCEPT_REAL_ORDERS === "true",
    extractionAdapterConfigured: servicePorts.availability.extractOrderForReview === true,
    syntheticOnly: process.env.USTAAD_SYNTHETIC_ONLY === "true",
  }),
});

function commandContext(c) {
  return {
    ...commandDeps,
    principal: c.get(SUPERVISOR_PRINCIPAL_CONTEXT_KEY),
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  };
}

async function requireSupervisor(c) {
  const result = await authorizeSupervisor({
    method: c.req.method,
    path: c.req.path,
    jobId: c.req.param("id"),
    sessionCookie: getCookie(c, SESSION_COOKIE),
    demoCookie: getCookie(c, "__Host-ustaad-demo"),
    authorization: c.req.header("Authorization"),
    origin: c.req.header("Origin"),
    requestUrl: c.req.url,
  }, commandDeps);
  if (!result.ok) return commandResponse(c, result);
  if (result.principal) c.set(SUPERVISOR_PRINCIPAL_CONTEXT_KEY, result.principal);
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

function validationResponse(c, issues, message) {
  return c.json(validationFailure(issues, message), 400);
}

function validationResult(c, validated) {
  return validated.ok ? validated : { ok: false, response: c.json(validated.failure, 400) };
}

function validateInput(c, schema, input, message) {
  return validationResult(c, validateWith(schema, input, message));
}

function validateDisplayPrefs(c) {
  return validationResult(c, validateDisplayPrefsInput({
    lang: c.req.query("lang"),
    currency: c.req.query("currency"),
  }));
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
const presentationModules = new Set(["workflow.js", "fields.js", "api.js", "components.js", "currency-display.js", "contracts.js", "dashboard.js", "welcome.js"]);
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

// The v2 React app (web/, built into public/app). Hash routing, so only real files are served;
// any other path under /app gets the app shell. Paths never leave public/app.
const webAppRoot = new URL("./public/app/", import.meta.url);
const webAppTypes = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff",
};
const webAppShell = async (c) => {
  try {
    return c.body(await readFile(new URL("index.html", webAppRoot)), 200, { "Content-Type": webAppTypes[".html"], "Cache-Control": "no-store" });
  } catch {
    return c.notFound();
  }
};
app.get("/app", (c) => c.redirect("/app/", 301));
app.get("/app/", webAppShell);
app.get("/app/*", async (c) => {
  let relative = "";
  try { relative = decodeURIComponent(c.req.path.slice("/app/".length)); } catch { return c.notFound(); }
  const extension = relative.slice(relative.lastIndexOf(".")).toLowerCase();
  if (!/^[\w./-]+$/.test(relative) || relative.split("/").some((part) => part === ".." || part === "." || part === "") || !webAppTypes[extension]) {
    return webAppShell(c);
  }
  const file = new URL(relative, webAppRoot);
  if (!file.href.startsWith(webAppRoot.href)) return c.notFound();
  try {
    return c.body(await readFile(file), 200, {
      "Content-Type": webAppTypes[extension],
      // Vite fingerprints files in assets/; everything else may change between releases.
      "Cache-Control": relative.startsWith("assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600",
    });
  } catch {
    return c.notFound();
  }
});

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

app.get("/supervisor-auth-client.js", async (c) => {
  const source = await readFile(new URL("./src/supervisor-auth-client.js", import.meta.url));
  return c.body(source, 200, {
    "Content-Type": "text/javascript; charset=utf-8",
    "Cache-Control": "no-store",
  });
});

app.use("/api/runs/*", async (c, next) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
  return next();
});

app.route("/api/runs", createTraceRoutes(durableTraces.registry, { store: durableTraces.store }));

// USTAAD_ENABLE_ARC (exact "true") turns the Arc routes on; off, every /api/arc path answers 404 ARC_NOT_ENABLED.
// The turn runner and the event routes arrive with ARC-M2-03 and ARC-M2-06.
const arcEnabled = process.env.USTAAD_ENABLE_ARC === "true";
const arcProjectId = process.env.PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT;
app.route("/api/arc", createArcRoutes({
  enabled: arcEnabled,
  commandDeps,
  sessionStore: arcEnabled && arcProjectId ? createFirestoreArcSessionStore({ projectId: arcProjectId }) : undefined,
  taskRunStore: arcEnabled && arcProjectId ? createFirestoreArcTaskRunStore({ projectId: arcProjectId }) : undefined,
  lotStore: servicePorts.lotRevisions.store,
}));

// One canonical application. Old dashboard bookmarks retain query/fragment state.
for (const path of ["/dashboard", "/dashboard/", "/dasboard", "/dasboard/"]) {
  app.get(path, (c) => c.redirect("/" + new URL(c.req.url).search, 302));
}
app.get("/dashboard.css", async (c) => c.body(await readFile(new URL("./public/dashboard.css", import.meta.url)), 200, {
  "Content-Type": "text/css; charset=utf-8", "Cache-Control": "no-store",
}));
app.get("/", (c) => c.html(homePage));

app.get("/health", (c) => {
  return c.json({ ok: true, mode: process.env.K_SERVICE ? "cloud-run" : "local-development", executionMode });
});

const budgetPolicyRequested = servicePorts.geminiUsage.policy !== undefined;
const budgetUnavailable = (c) => c.json({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Sessions cannot be issued right now. Try again shortly." } }, 503);

function admissionRefusal(c, result, message) {
  if (result.ok) return undefined;
  if (result.code === "BUDGET_UNAVAILABLE") return budgetUnavailable(c);
  c.header("Retry-After", String(result.retryAfterSeconds));
  return c.json({ ok: false, error: { code: result.code, message, retryAfterSeconds: result.retryAfterSeconds } }, 429);
}

async function admit(c, name) {
  const ipKey = clientIpKey(c);
  if (ipKey === null || typeof servicePorts.geminiUsage[name] !== "function") return { ok: false, code: "BUDGET_UNAVAILABLE" };
  try {
    return await servicePorts.geminiUsage[name]({ ipKey, signal: c.req.raw.signal });
  } catch {
    return { ok: false, code: "BUDGET_UNAVAILABLE" };
  }
}

// Minting sessions would otherwise reset the per-session Gemini limit (ADR-0004 decision 4). Off with the budget flag.
async function refuseNewSession(c) {
  if (!budgetPolicyRequested) return undefined;
  return admissionRefusal(c, await admit(c, "admitSession"), "Too many sessions were started from this network. Try again later.");
}

const PitchClaimBodySchema = z.object({ code: z.string().min(1).max(128) }).strict();

app.post("/api/auth/pitch-claim", async (c) => {
  if (!hackathonAuth.configured) return c.json({ ok: false, error: { code: "DEMO_AUTHORIZATION_NOT_CONFIGURED", message: "Hackathon authorization is disabled or incomplete." } }, 503);
  if (!sameOrigin(c)) return c.json({ ok: false, error: { code: "ORIGIN_REQUIRED", message: "A same-origin request is required." } }, 403);
  const cookie = getCookie(c, "__Host-ustaad-demo");
  if (!hackathonAuth.authenticate(cookie).ok) return c.json({ ok: false, error: { code: "DEMO_SESSION_REQUIRED", message: "Start or renew the temporary hackathon session." } }, 401);
  if (!budgetPolicyRequested || !pitchExchange.configured) return c.json({ ok: false, error: { code: "PITCH_CLAIM_UNAVAILABLE", message: "The pitch claim is not available." } }, 503);
  const body = PitchClaimBodySchema.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ ok: false, error: { code: "INVALID_REQUEST", message: "Send a JSON body with a code of at most 128 characters." } }, 400);
  // The attempt is counted before the compare, so guessing is limited whatever the answer.
  const refused = admissionRefusal(c, await admit(c, "admitPitchClaim"), "Too many pitch code attempts from this network. Try again later.");
  if (refused) {
    console.error(JSON.stringify({ event: "arc_pitch_claim", outcome: "rate_limited" }));
    return refused;
  }
  if (!pitchExchange.matches(body.data.code)) {
    console.error(JSON.stringify({ event: "arc_pitch_claim", outcome: "rejected" }));
    return c.json({ ok: false, error: { code: "PITCH_CODE_INVALID", message: "That code is not valid." } }, 403);
  }
  const claimed = hackathonAuth.grant(cookie, PITCH_RESERVE_GRANT);
  if (claimed === undefined) return c.json({ ok: false, error: { code: "DEMO_SESSION_REQUIRED", message: "Start or renew the temporary hackathon session." } }, 401);
  console.error(JSON.stringify({ event: "arc_pitch_claim", outcome: "granted" }));
  setCookie(c, "__Host-ustaad-demo", claimed, { secure: true, httpOnly: true, sameSite: "Strict", path: "/" });
  return c.json({ ok: true, grant: PITCH_RESERVE_GRANT, expiresAt: new Date(hackathonAuth.authenticate(claimed).principal.expiresAt * 1000).toISOString() }, 200, { "Cache-Control": "no-store" });
});

app.post("/api/auth/demo-session", async (c) => {
  if (!hackathonAuth.configured) return c.json({ ok: false, error: { code: "DEMO_AUTHORIZATION_NOT_CONFIGURED", message: "Hackathon authorization is disabled or incomplete." } }, 503);
  if (!sameOrigin(c)) return c.json({ ok: false, error: { code: "ORIGIN_REQUIRED", message: "A same-origin request is required." } }, 403);
  const existing = getCookie(c, "__Host-ustaad-demo");
  let token = existing;
  if (!hackathonAuth.authenticate(existing).ok) {
    const refused = await refuseNewSession(c);
    if (refused) return refused;
    token = hackathonAuth.issue();
  }
  setCookie(c, "__Host-ustaad-demo", token, { secure: true, httpOnly: true, sameSite: "Strict", path: "/" });
  return c.json({ ok: true, authorizationMode: "HACKATHON_DEMO", authenticatedHuman: false, expiresAt: new Date(hackathonAuth.authenticate(token).principal.expiresAt * 1000).toISOString(), approvalNote: HACKATHON_APPROVAL_NOTE }, 200, { "Cache-Control": "no-store" });
});

// Google sign-in: a fresh Firebase ID token becomes an HttpOnly session cookie.
app.post("/api/auth/session", async (c) => {
  if (!userSessionAuth) return c.json({ ok: false, error: { code: "NOT_FOUND", message: "Google sign-in is not enabled here." } }, 404);
  if (!sameOrigin(c)) return c.json({ ok: false, error: { code: "ORIGIN_REQUIRED", message: "A same-origin request is required." } }, 403);
  const body = await c.req.json().catch(() => ({}));
  const result = await userSessionAuth.startSession(body?.idToken);
  if (!result.ok) return c.json({ ok: false, error: result.error }, result.status);
  setCookie(c, SESSION_COOKIE, result.cookie, { secure: true, httpOnly: true, sameSite: "Lax", path: "/", maxAge: result.maxAge });
  const { email, name, role } = result.principal;
  return c.json({ ok: true, user: { email, name, role } }, 200, { "Cache-Control": "no-store" });
});
app.post("/api/auth/logout", (c) => {
  if (!sameOrigin(c)) return c.json({ ok: false, error: { code: "ORIGIN_REQUIRED", message: "A same-origin request is required." } }, 403);
  setCookie(c, SESSION_COOKIE, "", { secure: true, httpOnly: true, sameSite: "Lax", path: "/", maxAge: 0 });
  return c.json({ ok: true }, 200, { "Cache-Control": "no-store" });
});
app.get("/api/auth/me", async (c) => {
  if (!userSessionAuth) return c.json({ ok: false, error: { code: "NOT_FOUND", message: "Google sign-in is not enabled here." } }, 404);
  const result = await userSessionAuth.authenticate(getCookie(c, SESSION_COOKIE));
  if (!result.ok) return c.json({ ok: false, error: result.error }, result.status);
  const { email, name, role } = result.principal;
  return c.json({ ok: true, user: { email, name, role, canApprove: canApprove(result.principal) } }, 200, { "Cache-Control": "no-store" });
});

app.get("/api/auth/config", (c) => {
  if (userSessionAuth) {
    return c.json({ enabled: userSessionAuth.configured && sessionWebConfig !== undefined, authorizationMode: "FIREBASE_SESSION", provider: "firebase-google",
      ...(sessionWebConfig ? { clientConfig: sessionWebConfig } : { reasonCode: "FIREBASE_WEB_CONFIG_MISSING" }) }, 200, { "Cache-Control": "no-store" });
  }
  if (hackathonAuth.enabled) return c.json({ enabled: false, authorizationMode: "HACKATHON_DEMO", demoSessionConfigured: hackathonAuth.configured, sessionEndpoint: "/api/auth/demo-session", approvalNote: HACKATHON_APPROVAL_NOTE }, 200, { "Cache-Control": "no-store" });
  // Sign-in must be possible before the owner can verify/provision a first UID.
  // Publishing public Firebase web config grants no supervisor authorization.
  const enabled = executionMode !== "demo" && supervisorWebConfig !== undefined;
  return c.json({
    enabled,
    provider: "firebase-google",
    supervisorAccessConfigured: supervisorAuthenticator.configured,
    ...(enabled
      ? { clientConfig: supervisorWebConfig }
      : { reasonCode: "FIREBASE_AUTH_NOT_CONFIGURED" }),
  }, 200, { "Cache-Control": "no-store" });
});

app.get("/api/status", async (c) => {
  // The session comes only from a verified demo cookie, never from the request body or query.
  const session = hackathonAuth.configured ? hackathonAuth.authenticate(getCookie(c, "__Host-ustaad-demo")) : undefined;
  return c.json(await getStatusWithBudget({}, {
    ...commandDeps, principal: session?.ok ? session.principal : undefined, signal: c.req.raw.signal,
  }));
});

app.post("/orders/extract", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
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
  return commandResponse(c, await readOrder({ fields: form }, commandContext(c)));
});

app.get("/conditions/current", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
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
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }

  const validated = validateInput(
    c,
    GuardedRiskPredictionRequestSchema,
    request.body,
    "Risk prediction request failed validation."
  );
  if (!validated.ok) {
    return validated.response;
  }

  if (validated.data.conditionsConfirmed !== true) {
    return validationResponse(c, [{
      field: "conditionsConfirmed",
      path: ["conditionsConfirmed"],
      code: "confirmation_required",
      message: "Confirm or edit the displayed plant conditions before requesting prediction.",
    }], "Plant-condition confirmation is required.");
  }

  return responseForResult(c, await servicePorts.predictRisk({
    ...validated.data,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.post("/risk/optimize", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
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

  if (validated.data.conditionsConfirmed !== true) {
    return validationResponse(c, [{
      field: "conditionsConfirmed",
      path: ["conditionsConfirmed"],
      code: "confirmation_required",
      message: "Confirm or edit the displayed plant conditions before requesting optimization.",
    }], "Plant-condition confirmation is required.");
  }

  return responseForResult(c, await servicePorts.optimizeRisk({
    ...validated.data,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  }));
});

app.post("/jobs", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
  if (!idempotencyStore && (isCloudRun || jobSheetPersistenceAvailable || servicePorts.lotRevisions.enabled)) {
    return commandResponse(c, {
      ok: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Job creation requires a shared idempotency store." },
    });
  }
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
  return commandResponse(c, await planLot({ fields: form, idempotencyKey: c.req.header("Idempotency-Key") }, commandContext(c)));
});

app.post("/job-sheets/render.pdf", async (c) => {
  if (executionMode === "live-service") {
    return c.json({
      ok: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Caller-supplied PDF rendering is a local demo utility and is disabled in Cloud Run.",
      },
    }, 503);
  }
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
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
  return commandResponse(c, await getJob({ jobId: c.req.param("id") }, commandContext(c)));
});

app.get("/lots/:lotId", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
  return commandResponse(c, await getLot({ lotId: c.req.param("lotId") }, commandContext(c)));
});

app.put("/lots/:lotId/conditions", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
  const request = await readJsonBody(c);
  if (!request.ok) return request.response;
  return commandResponse(c, await updateLotConditions({ lotId: c.req.param("lotId"), body: request.body }, commandContext(c)));
});

app.post("/jobs/:id/approve", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
  return commandResponse(c, await approveJob({
    jobId: c.req.param("id"),
    lang: c.req.query("lang"),
    currency: c.req.query("currency"),
    // Read only by the approve guard; with the guard off the body stays ignored, as before.
    body: await c.req.json().catch(() => undefined),
  }, commandContext(c)));
});

app.get("/jobs/:id/card.pdf", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
  const result = await getCard({
    jobId: c.req.param("id"),
    lang: c.req.query("lang"),
    currency: c.req.query("currency"),
  }, commandContext(c));
  if (result.ok && result.bytes instanceof Uint8Array) {
    return c.body(result.bytes, 200, {
      "Content-Type": result.contentType,
      "Content-Disposition": `inline; filename="${result.filename}"`,
      "Cache-Control": "private, no-store",
    });
  }
  return commandResponse(c, result);
});

app.post("/jobs/:id/feedback", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
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

  const savedFeedback = await saveLinkedFeedback({
    ...feedback.data,
    signal: c.get(REQUEST_SIGNAL_CONTEXT_KEY),
  });
  if (savedFeedback?.ok) {
    await liveStore.publish({ event: { type: "feedback.saved", lotId: feedback.data.jobId, text: `Actual scrap recorded for lot ${feedback.data.jobId}`, actor: liveActor(c.get(SUPERVISOR_PRINCIPAL_CONTEXT_KEY)) } });
  }
  return responseForResult(c, savedFeedback);
});

app.post("/evidence/diagnose-photo", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
  let form;
  try { form = await c.req.parseBody(); } catch {
    return validationResponse(c, [{ field: "body", path: [], code: "invalid_multipart", message: "Send the photo as a multipart upload." }], "Photo upload is invalid.");
  }
  return commandResponse(c, await diagnoseUploadedPhoto({ fields: form }, commandContext(c)));
});

app.get("/conditions/weather", async (c) => {
  const result = await readWeather({}, commandContext(c));
  if (!result.ok) return commandResponse(c, result);
  return c.json(result, 200, { "Cache-Control": "no-store" });
});

// Live floor view: the latest lots and events, now and on every change, as server-sent events.
app.get("/api/live", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
  return streamSSE(c, async (stream) => {
    let closed = false;
    const queue = [];
    let wake;
    const stop = await liveStore.watch((view) => { queue.push(view); wake?.(); });
    stream.onAbort(() => { closed = true; stop(); wake?.(); });
    while (!closed) {
      if (queue.length === 0) {
        // Heartbeat every 25 s keeps proxies from closing an idle stream.
        await Promise.race([new Promise((resolve) => { wake = resolve; }), stream.sleep(25_000)]);
        if (queue.length === 0 && !closed) await stream.writeSSE({ event: "ping", data: "" });
        continue;
      }
      const view = queue.splice(0).at(-1);
      await stream.writeSSE({ event: "floor", data: JSON.stringify({ mode: liveStore.mode, ...view }) });
    }
  });
});

app.get("/api/lots", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
  // Firestore delivers its first snapshot shortly after the listener starts; wait up to 2 s for it.
  let latest = { lots: [], events: [] }, calls = 0, wake;
  const stop = await liveStore.watch((v) => { latest = v; calls += 1; wake?.(); });
  if (liveStore.mode === "firestore" && calls < 2) {
    await Promise.race([new Promise((resolve) => { wake = resolve; }), new Promise((resolve) => setTimeout(resolve, 2000))]);
  }
  stop();
  const view = latest;
  return c.json({ ok: true, mode: liveStore.mode, ...view }, 200, { "Cache-Control": "no-store" });
});

app.get("/insights/summary", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
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
  return commandResponse(c, await impactSummary({}, commandContext(c)));
});

app.get("/evidence/approved-photos", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
  return commandResponse(c, await listApprovedPhotos({}, commandContext(c)));
});
app.post("/evidence/classify-photo", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
  const request = await readJsonBody(c);
  if (!request.ok) return request.response;
  return commandResponse(c, await classifyApprovedPhoto(request.body, commandContext(c)));
});

app.post("/evidence/seen-before", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
  const request = await readJsonBody(c);
  if (!request.ok) {
    return request.response;
  }
  return commandResponse(c, await findSeenBefore(request.body, commandContext(c)));
});

app.post("/risk/similar-runs", async (c) => {
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
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
  const authorizationFailure = await requireSupervisor(c);
  if (authorizationFailure) return authorizationFailure;
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
  ...(demoMode ? { hostname: "127.0.0.1" } : {}),
  port,
}, () => {
  console.log(`Momentum production prep running at http://localhost:${port}`);
});
