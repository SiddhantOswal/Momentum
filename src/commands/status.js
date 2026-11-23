import { readDailyGeminiCallCapConfig } from "../daily-gemini-call-cap.js";
import { readGeminiBudgetConfig } from "../gemini-budget-config.js";
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
  modelAcceptanceConfig,
}) {
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
  // Under budget-v2 the enforced day limit comes from GEMINI_BUDGET_LIMITS, not GEMINI_DAILY_ATTEMPT_CAP.
  const budgetLimits = budgetPolicy ? readGeminiBudgetConfig(env).limits : undefined;
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
        ...(geminiCapConfig.configured ? {
          limit: budgetLimits?.dayLimit ?? geminiCapConfig.limit,
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
      durableIdempotencyConfigured: false,
      idempotencyScope: idempotencyStore ? "process-local" : "unavailable",
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
      durableIdempotencyConfigured: false,
      idempotencyScope: idempotencyStore ? "process-local" : "unavailable",
      jobCreationAvailable,
    },
    isRealModelPrediction: false,
    modelAcceptance: modelScores(undefined, { modelAcceptanceConfig }),
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

/**
 * The status command plus what remains of the Gemini budget for the caller,
 * read without writing (design 5.2 `peek`). Without budget-v2 it returns the
 * status command's result unchanged.
 */
export async function getStatusWithBudget(input, deps) {
  const status = getStatus(input, deps);
  const usage = deps.servicePorts.geminiUsage;
  if (!usage.policy) return status;
  let geminiBudget = {
    policy: usage.policy,
    configured: usage.sharedCounterConfigured === true,
    status: usage.budgetStatus,
    available: false,
  };
  if (typeof usage.peek === "function") {
    const view = await usage.peek({ principal: deps.principal, signal: deps.signal });
    if (view.ok) {
      const { ok: _ok, pool, reserveWindowActive, limits, ...remaining } = view;
      geminiBudget = { ...geminiBudget, available: true, pool, remaining, limits, reserveWindowActive };
    }
  }
  return { ...status, runtimeAvailability: { ...status.runtimeAvailability, geminiBudget } };
}
