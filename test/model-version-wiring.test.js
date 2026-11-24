import assert from "node:assert/strict";
import test from "node:test";
import modelAcceptanceConfig from "../config/model-acceptance.json" with { type: "json" };
import { getStatus } from "../src/commands/status.js";
import { createConfiguredServicePorts } from "../src/service-ports.js";
import { MODEL_VERSION_MISMATCH } from "../src/google-cloud/model-version-binding.js";

const ACCEPTED = modelAcceptanceConfig.currentModelVersions;
const MODELS_URL = "https://bigquery.googleapis.com/bigquery/v2/projects/prepagent-hack/datasets/prepagent/models/";
const TOKEN = "test-token-value";
const acceptedEtags = () => Object.fromEntries(Object.entries(ACCEPTED).map(([defect, etag]) => [`m2_${defect.toLowerCase()}`, etag]));

// Answers models.get from `etags`; any other request (a BigQuery query, for one) fails as if offline.
function fakeModelsApi(etags = acceptedEtags()) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method });
    const etag = url.startsWith(MODELS_URL) ? etags[url.slice(MODELS_URL.length)] : undefined;
    if (etag === undefined) throw new TypeError("fetch failed");
    return Response.json({ etag });
  };
  return { calls, fetchImpl };
}

const PORTS_ENV = {
  PROJECT_ID: "prepagent-hack",
  REGION: "asia-south1",
  USTAAD_ENABLE_RISK_PREDICTION: "true",
  USTAAD_OPTIMIZER_CONTRACT_STATUS: "approved",
  USTAAD_OPTIMIZER_CONTRACT_VERSION: "om-d2-d3-v1",
};

function statusDeps(env, servicePorts) {
  return {
    env, servicePorts, executionMode: "live-service",
    hackathonAuth: { enabled: true, configured: true },
    supervisorAuthenticator: { enabled: false, configured: false },
    approvalAuthorizationConfigured: false, jobSheetPersistenceAvailable: false, jobCreationAvailable: false,
    modelAcceptanceConfig,
  };
}

test("with USTAAD_ENFORCE_MODEL_VERSIONS=true the configured ports and status use the binding", async () => {
  const env = { ...PORTS_ENV, USTAAD_ENFORCE_MODEL_VERSIONS: "true" };
  const fake = fakeModelsApi({ ...acceptedEtags(), m2_warp: "bmV3LXJ1bi1ldGFn" });
  const ports = createConfiguredServicePorts({ env, fetchImpl: fake.fetchImpl, tokenProvider: async () => TOKEN });
  try {
    await ports.modelVersions.check();
    assert.equal(fake.calls.length, 5, "startup check and the awaited check share one in-flight read");
    for (const port of ["predictRisk", "optimizeRisk"]) {
      const result = await ports[port]({ conditionsConfirmed: true });
      assert.equal(result.error.code, MODEL_VERSION_MISMATCH, port);
      assert.deepEqual(result.error.targets, ["WARP"], port);
    }
    assert.ok(fake.calls.every((call) => call.method === "GET" && call.url.startsWith(MODELS_URL)), "no BigQuery query ran");
    const status = getStatus({}, statusDeps(env, ports));
    assert.deepEqual(status.modelVersions, ports.modelVersions.snapshot());
    assert.equal(status.modelVersions.state, "mismatch");
    assert.equal(status.modelVersions.targets.find((target) => target.defect === "WARP").observed, "bmV3LXJ1bi1ldGFn");
    assert.equal(JSON.stringify(status).includes(TOKEN), false);
  } finally {
    ports.modelVersions.stop();
  }
});

test("any other value of USTAAD_ENFORCE_MODEL_VERSIONS keeps today's behaviour", async () => {
  for (const value of [undefined, "", "TRUE", "1", "yes", " true"]) {
    const env = value === undefined ? PORTS_ENV : { ...PORTS_ENV, USTAAD_ENFORCE_MODEL_VERSIONS: value };
    const fake = fakeModelsApi();
    const ports = createConfiguredServicePorts({ env, fetchImpl: fake.fetchImpl, tokenProvider: async () => TOKEN });
    assert.equal(ports.modelVersions, undefined, String(value));
    assert.equal("modelVersions" in ports, false, String(value));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fake.calls.length, 0, String(value));
    assert.equal("modelVersions" in getStatus({}, statusDeps(env, ports)), false, String(value));
    const result = await ports.predictRisk({ conditionsConfirmed: false });
    assert.equal(result.error.code, "VALIDATION_ERROR", "the unguarded service answers directly");
  }
});
