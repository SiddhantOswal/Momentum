import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createConfiguredServicePorts, readOptimizerQueryBudget, getJobLifecycleAvailability } from "../src/service-ports.js";
import { createVertexGeminiClient } from "../src/google-cloud/vertex-gemini-client.js";

function runtimeFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? runtimeFiles(`${dir}/${e.name}`) : e.name.endsWith(".js") ? [`${dir}/${e.name}`] : []);
}

test("runtime provider construction and REST invocation have one centrally metered entry point", () => {
  const root = fileURLToPath(new URL("../src", import.meta.url));
  for (const file of runtimeFiles(root)) {
    const source = readFileSync(file, "utf8");
    if (file.endsWith("/service-ports.js") || file.endsWith("/vertex-gemini-client.js")) continue;
    assert.doesNotMatch(source, /createVertexGeminiClient|:generateContent/, `${file} bypasses centralized provider wiring`);
  }
});

test("Cloud Run Gemini requires explicit shared-counter opt-in and an approved database; construction is not live verification", () => {
  let requests = 0;
  const base = { K_SERVICE: "prepagent", PROJECT_ID: "prepagent-hack", BUCKET: "prepagent-hack-data", USTAAD_ENABLE_LIVE_MODEL_CALLS: "true" };
  const create = env => createConfiguredServicePorts({ env,
    modelConfig: { modelCallsEnabled: true, testModel: "gemini-3.5-flash", location: "asia-south1" },
    fetchImpl: async () => { requests += 1; throw new Error("No network is expected during construction"); },
  });
  assert.equal(create(base).availability.extractOrder, false);
  assert.equal(create({ ...base, USTAAD_ENABLE_FIRESTORE_GEMINI_CAP: "true", USTAAD_GEMINI_COUNTER_DATABASE: "new-unapproved-db" }).availability.extractOrder, false);
  const shared = create({ ...base, USTAAD_ENABLE_FIRESTORE_GEMINI_CAP: "true", USTAAD_GEMINI_COUNTER_DATABASE: "(default)" });
  assert.equal(shared.availability.extractOrder, true);
  assert.equal(shared.geminiUsage.sharedCounterConfigured, true);
  assert.equal(shared.geminiUsage.liveConnectivityVerified, false);
  assert.equal(requests, 0);
});

test("optimizer byte budget stays 80 MiB unless the proposed 100 MiB limit is explicitly configured; invalid limits disable optimization", () => {
  assert.equal(readOptimizerQueryBudget({}), 83886080);
  assert.equal(readOptimizerQueryBudget({ USTAAD_OPTIMIZER_MAX_BYTES_BILLED: "104857600" }), 104857600);
  for (const value of ["0", "unlimited", "104857601", "NaN", "100", ""]) {
    const env = { PROJECT_ID: "prepagent-hack", USTAAD_ENABLE_RISK_PREDICTION: "true",
      USTAAD_OPTIMIZER_CONTRACT_STATUS: "approved", USTAAD_OPTIMIZER_CONTRACT_VERSION: "om-plan-relative-v1",
      USTAAD_OPTIMIZER_MAX_BYTES_BILLED: value };
    assert.equal(readOptimizerQueryBudget(env), undefined);
    assert.equal(createConfiguredServicePorts({ env }).availability.optimizeRisk, false);
  }
});

test("lifecycle status reports gated live configuration without permanently restricting it to demo mode", () => {
  const options = { availability: { approveJob: true, getJobCard: true, getStoredJobSheet: true, createDraftJobSheet: true, saveFeedback: true },
    executionMode: "live-service", supervisorConfigured: true, modelsAccepted: true, jobCreationAvailable: true };
  assert.deepEqual(getJobLifecycleAvailability(options), options.availability);
  assert.deepEqual(getJobLifecycleAvailability({ ...options, supervisorConfigured: false, jobCreationAvailable: false }),
    Object.fromEntries(Object.keys(options.availability).map(k => [k, false])));
  assert.deepEqual(getJobLifecycleAvailability({ ...options, modelsAccepted: false, jobCreationAvailable: false }),
    { ...options.availability, approveJob: false, createDraftJobSheet: false });
  assert.equal(getJobLifecycleAvailability({ ...options, availability: { ...options.availability, approveJob: false } }).approveJob, false);
});

test("Gemini rejects oversized contents and prompts before provider requests and bounds JSON output", async () => {
  let request;
  const client = createVertexGeminiClient({ projectId: "prepagent-hack", model: "gemini-3.5-flash", tokenProvider: async () => "test-token",
    fetchImpl: async (_url, options) => { request = JSON.parse(options.body); return Response.json({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }); } });
  await assert.rejects(client.generateContent({ contents: [{ role: "user", parts: [{ text: "x".repeat(65537) }] }] }), { code: "INVALID_GENERATION_REQUEST" });
  await assert.rejects(client.generateContent({ contents: [{ role: "user", parts: [{ text: "短".repeat(22000) }] }] }), { code: "INVALID_GENERATION_REQUEST" });
  await assert.rejects(client.generateContent({ contents: [{ role: "user", parts: [{ text: "explain" }] }], tools: [{ description: "x".repeat(65537) }] }), { code: "INVALID_GENERATION_REQUEST" });
  await assert.rejects(client.generateJson({ fileUri: "gs://prepagent-hack-data/orders/test.pdf", mimeType: "application/pdf", prompt: "x".repeat(12001), responseSchema: {} }), { code: "INVALID_GENERATION_REQUEST" });
  assert.equal(request, undefined);
  await client.generateJson({ fileUri: "gs://prepagent-hack-data/orders/test.pdf", mimeType: "application/pdf", prompt: "extract", responseSchema: {} });
  assert.equal(request.generationConfig.maxOutputTokens, 2048);
});

test("a reservation crossing IST midnight never starts a provider request under yesterday's key", async () => {
  const { withDailyGeminiCallCap, readDailyGeminiCallCapConfig } = await import("../src/daily-gemini-call-cap.js");
  let now = Date.parse("2026-10-14T18:29:59.999Z");
  const reservations = [];
  let calls = 0;
  const wrapper = withDailyGeminiCallCap({ generateJson() { calls += 1; }, generateContent() { calls += 1; } }, readDailyGeminiCallCapConfig({}), {
    now: () => now, store: { scope: "shared-firestore-transaction", async reserveAttempt({ dayKey }) { reservations.push(dayKey); now += 1; } },
  });
  await assert.rejects(wrapper.generateJson({}), { code: "GEMINI_USAGE_UNAVAILABLE" });
  assert.deepEqual(reservations, ["2026-10-14"]);
  assert.equal(calls, 0);
  await wrapper.generateJson({});
  assert.deepEqual(reservations, ["2026-10-14", "2026-10-15"]);
  assert.equal(calls, 1);
});
