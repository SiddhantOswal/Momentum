import { readDailyGeminiCallCapConfig } from "../daily-gemini-call-cap.js";
import { isDemoPrincipal } from "../hackathon-demo-auth.js";
import { getModelAcceptanceSummary, isModelSetAccepted } from "../model-acceptance.js";
import { SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES } from "../schemas.js";
import { getJobLifecycleAvailability } from "../service-ports.js";

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

export function modelScores(_input, { modelAcceptanceConfig }) {
  return getModelAcceptanceSummary(modelAcceptanceConfig);
}

export async function impactSummary(_input, { signal, servicePorts }) {
  return servicePorts.getImpactSummary({ signal });
}

/** Configuration state only: nothing here proves a cloud call or a verified user. */
export function getStatus(_input, {
  env,
  servicePorts,
  executionMode,
  hackathonAuth,
  supervisorAuthenticator,
  approvalAuthorizationConfigured,
  jobSheetPersistenceAvailable,
  jobCreationAvailable,
  idempotencyStore,
  idempotencyScope = idempotencyStore ? "process-local" : "unavailable",
  modelAcceptanceConfig,
}) {
  const durableIdempotencyConfigured = idempotencyScope === "shared-firestore";
  const mode = env.K_SERVICE ? "cloud-run" : "local-development";
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
  const productionAdaptersConfigured = productionAdapterKeys.some(
    (key) => servicePorts.availability[key] === true
  );
  const geminiCapConfig = readDailyGeminiCallCapConfig(env);
  const liveModelCallsEnabled = geminiCapConfig.configured &&
    env.USTAAD_ENABLE_LIVE_MODEL_CALLS === "true" &&
    (!env.K_SERVICE || servicePorts.geminiUsage.sharedCounterConfigured) &&
    (servicePorts.availability.extractOrder || servicePorts.availability.explainRisk);
  const globalGeminiCapEnforced = liveModelCallsEnabled && servicePorts.geminiUsage.sharedCounterConfigured;
  const budgetPolicy = servicePorts.geminiUsage.policy;
  return {
    ok: true,
    app: "Momentum",
    description: "Corrugated Production-Prep Agent",
    status: "running",
    mode,
    executionMode,
    backendReachable: true,
    authorizationMode: hackathonAuth.enabled ? "HACKATHON_DEMO" : "FIREBASE_SUPERVISOR",
    demoSessionConfigured: hackathonAuth.configured,
    syntheticOnlyModeRequired: executionMode === "live-service",
    syntheticOnlyModeEnabled: env.USTAAD_SYNTHETIC_ONLY === "true",
    approvedPoFixtureAllowlistEnforced: true,
    runtimeAvailability: {
      productionAdaptersConfigured,
      liveModelCallsEnabled,
      dailyGeminiCallCap: {
        configured: geminiCapConfig.configured,
        enforced: liveModelCallsEnabled,
        scope: servicePorts.geminiUsage.sharedCounterConfigured ? "shared-firestore-transaction" : geminiCapConfig.scope,
        globalScopeEnforced: globalGeminiCapEnforced,
        ...(servicePorts.geminiUsage.sharedCounterConfigured ? { liveConnectivityVerified: false } : {}),
        ...(budgetPolicy ? { policy: budgetPolicy } : {}),
        // The day limit is left out: the global cap is not shown to callers (SEC-2).
        ...(geminiCapConfig.configured ? {
          timeZone: geminiCapConfig.timeZone,
          countingPolicy: geminiCapConfig.countingPolicy,
          reset: "midnight-in-configured-time-zone",
        } : { missing: geminiCapConfig.missing, invalid: geminiCapConfig.invalid }),
      },
      supervisorAuthentication: {
        provider: "firebase-google",
        enabled: supervisorAuthenticator.enabled,
        verifierConfigured: supervisorAuthenticator.configured,
        userVerified: false,
      },
      currentConditions: {
        adapterConfigured: servicePorts.availability.currentConditions,
        dataChecked: false,
      },
      integrationsVerified: false,
      supervisorAuthorizationAvailable: executionMode === "demo" || approvalAuthorizationConfigured,
      jobSheetPersistenceAvailable,
      durableIdempotencyConfigured,
      idempotencyScope,
      jobCreationAvailable,
    },
    integrations: {
      ...servicePorts.availability,
      ...getJobLifecycleAvailability({ availability: servicePorts.availability, executionMode,
        supervisorConfigured: approvalAuthorizationConfigured,
        modelsAccepted: isModelSetAccepted(modelAcceptanceConfig), jobCreationAvailable }),
      prepareJob: jobCreationAvailable,
      supervisorAuthorizationAvailable: executionMode === "demo" || approvalAuthorizationConfigured,
      jobSheetPersistenceAvailable,
      durableIdempotencyConfigured,
      idempotencyScope,
      jobCreationAvailable,
    },
    isRealModelPrediction: false,
    modelAcceptance: modelScores(undefined, { modelAcceptanceConfig }),
    ...(servicePorts.modelVersions ? { modelVersions: servicePorts.modelVersions.snapshot() } : {}),
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
  };
}

const PUBLIC_STATUS_FIELDS = ["ok", "app", "status", "backendReachable", "mode", "executionMode", "authorizationMode", "modelAcceptance"];

/** What a caller without a session may see: that the service runs, in which mode, and the model scores Home shows before a session exists. */
export function publicStatus(status) {
  return Object.fromEntries(PUBLIC_STATUS_FIELDS.filter((field) => field in status).map((field) => [field, status[field]]));
}

// 5 s keeps one session's status reads to at most 12 budget reads a minute, and is shorter
// than an Arc turn that spends Gemini, so the count read after a turn is normally fresh.
export const BUDGET_VIEW_TTL_MS = 5_000;
const BUDGET_VIEW_MAX_ENTRIES = 1_000;

/** In-process cache of budget reads by session, so repeated status calls do not each read Firestore. */
export function createBudgetViewCache({ ttlMs = BUDGET_VIEW_TTL_MS, maxEntries = BUDGET_VIEW_MAX_ENTRIES, now = Date.now } = {}) {
  const entries = new Map();
  return Object.freeze({
    read(key, load) {
      const currentTime = now();
      const cached = entries.get(key);
      if (cached && currentTime < cached.expiresAt) return cached.value;
      entries.delete(key);
      if (entries.size >= maxEntries) {
        for (const [trackedKey, entry] of entries) if (currentTime >= entry.expiresAt) entries.delete(trackedKey);
        if (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
      }
      const value = Promise.resolve().then(load);
      entries.set(key, { expiresAt: currentTime + ttlMs, value });
      return value;
    },
  });
}

function callsLeftToday(view) {
  if (!(view.costInr > 0)) return 0;
  const counts = [view.day, view.session].filter((count) => Number.isSafeInteger(count));
  return counts.length > 0 ? Math.min(...counts) : null;
}

/**
 * The status the /api/status route returns. Where this deployment issues sessions, a
 * caller without a verified one gets `publicStatus` only. With a session, budget-v2
 * adds the Gemini calls this session can still make today, read without writing
 * (design 5.2 `peek`) through `deps.budgetViewCache`; the global cap, spend, reserve
 * and limits are never returned.
 */
export async function getStatusWithBudget(input, deps) {
  const status = getStatus(input, deps);
  const issuesSessions = deps.hackathonAuth?.enabled === true || Boolean(deps.userSessionAuth);
  if (issuesSessions && deps.sessionVerified !== true) return publicStatus(status);
  const usage = deps.servicePorts.geminiUsage;
  if (!usage.policy) return status;
  let geminiBudget = {
    policy: usage.policy,
    configured: usage.sharedCounterConfigured === true,
    status: usage.budgetStatus,
    available: false,
  };
  const principal = deps.principal;
  if (isDemoPrincipal(principal) && typeof usage.peek === "function") {
    const peek = () => usage.peek({ principal, signal: deps.signal });
    const key = `${principal.sessionId}:${principal.grants.join(",")}`;
    const read = deps.budgetViewCache ? deps.budgetViewCache.read(key, peek) : Promise.resolve().then(peek);
    const view = await read.catch(() => ({ ok: false }));
    if (view.ok) geminiBudget = { ...geminiBudget, available: true, callsLeftToday: callsLeftToday(view) };
  }
  return { ...status, runtimeAvailability: { ...status.runtimeAvailability, geminiBudget } };
}
