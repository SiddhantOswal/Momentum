import { readDailyGeminiCallCapConfig } from "../daily-gemini-call-cap.js";
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
        ...(geminiCapConfig.configured ? {
          limit: geminiCapConfig.limit,
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
