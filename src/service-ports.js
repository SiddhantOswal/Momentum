const requirements = {
  extractOrder: "Cloud Storage and Gemini on Vertex AI are not configured.",
  currentConditions: "BigQuery sensor readings are not configured.",
  predictRisk: "The BigQuery ML models and predict query are not configured.",
  optimizeRisk: "The BigQuery ML models and optimizer query are not configured.",
  prepareJob: "Cloud Storage, Gemini, BigQuery, and the BigQuery ML models are not configured.",
  approveJob: "Job-sheet persistence and Cloud Storage card generation are not configured.",
  getJobCard: "Cloud Storage job-card files are not configured.",
  saveFeedback: "BigQuery, Cloud Storage photo uploads, and note translation are not configured.",
  getInsights: "BigQuery historical lot and feedback data are not configured.",
};

function unavailable(operation) {
  return async () => ({
    ok: false,
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: `${operation} is not configured. ${requirements[operation]}`,
    },
  });
}

export function createServicePorts(adapters = {}) {
  return Object.freeze({
    extractOrder: adapters.extractOrder ?? unavailable("extractOrder"),
    currentConditions: adapters.currentConditions ?? unavailable("currentConditions"),
    predictRisk: adapters.predictRisk ?? unavailable("predictRisk"),
    optimizeRisk: adapters.optimizeRisk ?? unavailable("optimizeRisk"),
    prepareJob: adapters.prepareJob ?? unavailable("prepareJob"),
    approveJob: adapters.approveJob ?? unavailable("approveJob"),
    getJobCard: adapters.getJobCard ?? unavailable("getJobCard"),
    saveFeedback: adapters.saveFeedback ?? unavailable("saveFeedback"),
    getInsights: adapters.getInsights ?? unavailable("getInsights"),
  });
}

export const servicePorts = createServicePorts();
