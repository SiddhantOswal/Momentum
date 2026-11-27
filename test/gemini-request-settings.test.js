import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createVertexGeminiClient } from "../src/google-cloud/vertex-gemini-client.js";
import { ARC_MODEL_ROLES, arcModelSettings, loadArcModelSettings } from "../src/arc-model-settings.js";
import { RECORDED_ROLES, recordedModelText, runRecordedRole, vertexPayload } from "./fixtures/gemini-recorded-roles.js";

const config = JSON.parse(readFileSync(new URL("../config/arc-models.json", import.meta.url), "utf8"));
const before = JSON.parse(readFileSync(new URL("./fixtures/gemini-requests-before-settings.json", import.meta.url), "utf8"));
const contents = [{ role: "user", parts: [{ text: "Which lot is next?" }] }];
const tools = [{ functionDeclarations: [{ name: "getLotStatus", parameters: { type: "OBJECT" } }] }];
const RAI5_SAFETY = ["HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_DANGEROUS_CONTENT", "HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_SEXUALLY_EXPLICIT"]
  .map((category) => ({ category, threshold: "BLOCK_MEDIUM_AND_ABOVE", method: "PROBABILITY" }));

function recordingClient(payload, requests = [], options = {}) {
  return createVertexGeminiClient({
    projectId: "prepagent-hack", tokenProvider: async () => "test-token", ...options,
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(init.body) });
      return Response.json(typeof payload === "function" ? payload() : payload);
    },
  });
}

function callFor(client, role) {
  const settings = arcModelSettings.roles[role];
  if (["extraction", "photo"].includes(role)) {
    return client.generateJson({ role, fileUri: "gs://prepagent-hack-data/orders/a.pdf", mimeType: "application/pdf", prompt: "Read it", responseSchema: { type: "OBJECT" } });
  }
  if (settings.functionCallingMode === "ANY") return client.generateContent({ role, contents, tools, allowedFunctionNames: ["getLotStatus"] });
  if (settings.functionCallingMode === "AUTO") return client.generateContent({ role, contents, tools });
  return client.generateContent({ role, contents });
}

test("the settings file holds the RAI-5 safety block and the ADR-0008 thinking levels per role", () => {
  assert.equal(config.version, "arc-models-v1");
  assert.deepEqual(config.safetySettings, RAI5_SAFETY);
  assert.deepEqual(Object.keys(config.roles).sort(), [...ARC_MODEL_ROLES].sort());
  assert.deepEqual(Object.fromEntries(Object.entries(config.roles).map(([role, r]) => [role, [r.model, r.location, r.thinkingLevel, r.functionCallingMode]])), {
    extraction: ["gemini-3.5-flash", "asia-south1", "MEDIUM", null],
    explanation: ["gemini-3.5-flash", "asia-south1", "MEDIUM", null],
    photo: ["gemini-3.5-flash", "asia-south1", "MEDIUM", null],
    router: ["gemini-3.5-flash-lite", "asia-south1", "MINIMAL", "ANY"],
    writer: ["gemini-3.5-flash", "asia-south1", "LOW", null],
    agent: ["gemini-3.5-flash", "asia-south1", "MEDIUM", "AUTO"],
  });
  for (const role of Object.values(config.roles)) assert.equal(role.includeThoughts, false);
});

test("the settings loader rejects thinkingBudget, a missing harm category and an unblocked threshold", () => {
  const withRole = (patch) => ({ ...config, roles: { ...config.roles, writer: { ...config.roles.writer, ...patch } } });
  assert.throws(() => loadArcModelSettings({ config: withRole({ thinkingBudget: 1024 }) }));
  assert.throws(() => loadArcModelSettings({ config: { ...config, safetySettings: config.safetySettings.slice(1) } }));
  assert.throws(() => loadArcModelSettings({ config: { ...config, safetySettings: [{ ...RAI5_SAFETY[0], threshold: "BLOCK_NONE" }, ...RAI5_SAFETY.slice(1)] } }));
  assert.throws(() => loadArcModelSettings({ config: { ...config, safetySettings: [RAI5_SAFETY[0], ...RAI5_SAFETY.slice(0, 3)] } }));
});

test("every role sends safetySettings, the thinking setting and its system instruction, and never thinkingBudget", async () => {
  for (const role of ARC_MODEL_ROLES) {
    const requests = [];
    const text = ["extraction", "photo"].includes(role) ? "{}" : "ok";
    await callFor(recordingClient(vertexPayload(text), requests), role);
    assert.equal(requests.length, 1, role);
    const { url, body } = requests[0];
    const settings = config.roles[role];
    assert.deepEqual(body.safetySettings, RAI5_SAFETY, `${role} must send explicit safetySettings`);
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: settings.thinkingLevel, includeThoughts: false }, role);
    assert.equal(JSON.stringify(body).includes("thinkingBudget"), false, role);
    assert.equal(body.generationConfig.maxOutputTokens, settings.maxOutputTokens, role);
    assert.equal(body.generationConfig.temperature, settings.temperature ?? undefined, role);
    assert.match(url, new RegExp(`/locations/asia-south1/publishers/google/models/${settings.model}:generateContent$`), role);
    if (settings.prompt === null) assert.equal(body.systemInstruction, undefined, role);
    else assert.deepEqual(body.systemInstruction, { parts: [{ text: readFileSync(new URL(`../prompts/${settings.prompt}/system.txt`, import.meta.url), "utf8").replace(/\n$/, "") }] }, role);
  }
});

test("a call without a configured role is refused before any request", async () => {
  const requests = [];
  const client = recordingClient(vertexPayload("ok"), requests);
  await assert.rejects(client.generateContent({ contents }), { code: "INVALID_GENERATION_REQUEST" });
  await assert.rejects(client.generateContent({ role: "toString", contents }), { code: "INVALID_GENERATION_REQUEST" });
  await assert.rejects(client.generateJson({ fileUri: "gs://prepagent-hack-data/a.pdf", mimeType: "application/pdf", prompt: "x", responseSchema: {} }), { code: "INVALID_GENERATION_REQUEST" });
  assert.equal(requests.length, 0);
});

test("function-calling mode comes from the role; ANY needs declared allowedFunctionNames", async () => {
  const requests = [];
  const client = recordingClient(vertexPayload("ok"), requests);
  await client.generateContent({ role: "router", contents, tools, allowedFunctionNames: ["getLotStatus"] });
  assert.deepEqual(requests[0].body.toolConfig, { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["getLotStatus"] } });
  await client.generateContent({ role: "agent", contents, tools });
  assert.deepEqual(requests[1].body.toolConfig, { functionCallingConfig: { mode: "AUTO" } });
  for (const call of [
    { role: "router", contents, tools },
    { role: "router", contents, tools, allowedFunctionNames: [] },
    { role: "router", contents, tools, allowedFunctionNames: ["approveJob"] },
    { role: "agent", contents, tools, allowedFunctionNames: ["getLotStatus"] },
    { role: "writer", contents, tools },
    { role: "writer", contents, allowedFunctionNames: ["getLotStatus"] },
  ]) {
    await assert.rejects(client.generateContent(call), { code: "INVALID_GENERATION_REQUEST" }, JSON.stringify(call));
  }
  assert.equal(requests.length, 2);
});

test("the system instruction counts toward the request size limit", async () => {
  const settings = loadArcModelSettings();
  const large = { ...settings, roles: { ...settings.roles, writer: { ...settings.roles.writer, systemInstruction: "x".repeat(65000) } } };
  const requests = [];
  const client = recordingClient(vertexPayload("ok"), requests, { settings: large });
  await assert.rejects(client.generateContent({ role: "writer", contents: [{ role: "user", parts: [{ text: "y".repeat(1000) }] }] }), { code: "INVALID_GENERATION_REQUEST" });
  assert.equal(requests.length, 0);
});

const promptBlocked = {
  promptFeedback: { blockReason: "SAFETY", safetyRatings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", probability: "HIGH", blocked: true }] },
  usageMetadata: { promptTokenCount: 9, totalTokenCount: 9 },
};
const responseBlocked = {
  candidates: [{ finishReason: "SAFETY", safetyRatings: [
    { category: "HARM_CATEGORY_HARASSMENT", probability: "MEDIUM", blocked: true },
    { category: "HARM_CATEGORY_HATE_SPEECH", probability: "NEGLIGIBLE" },
  ] }],
  usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 0, totalTokenCount: 9 },
};

test("a blocked prompt and a blocked answer map to GEMINI_SAFETY_BLOCKED, not an empty response", async () => {
  for (const [payload, blockedAt, categories] of [
    [promptBlocked, "prompt", ["HARM_CATEGORY_DANGEROUS_CONTENT"]],
    [responseBlocked, "response", ["HARM_CATEGORY_HARASSMENT"]],
  ]) {
    for (const role of ["writer", "extraction"]) {
      const usage = [];
      const client = recordingClient(payload);
      const call = role === "writer"
        ? client.generateContent({ role, contents, onUsage: (u) => usage.push(u) })
        : client.generateJson({ role, fileUri: "gs://prepagent-hack-data/a.pdf", mimeType: "application/pdf", prompt: "x", responseSchema: {}, onUsage: (u) => usage.push(u) });
      await assert.rejects(call, (error) => {
        assert.equal(error.code, "GEMINI_SAFETY_BLOCKED");
        assert.notEqual(error.code, "VERTEX_EMPTY_RESPONSE");
        assert.deepEqual({ ...error.detail }, { blockedAt, reason: "SAFETY", categories });
        return true;
      });
      assert.equal(usage.length, 1, "a blocked call is still metered");
    }
  }
});

test("other block and tool finish reasons get their own codes", async () => {
  const cases = [
    ["PROHIBITED_CONTENT", "GEMINI_SAFETY_BLOCKED"],
    ["SPII", "GEMINI_SAFETY_BLOCKED"],
    ["RECITATION", "GEMINI_RESPONSE_BLOCKED"],
    ["MALFORMED_FUNCTION_CALL", "GEMINI_TOOL_CALL_INVALID"],
  ];
  for (const [finishReason, code] of cases) {
    await assert.rejects(recordingClient({ candidates: [{ finishReason }] }).generateContent({ role: "writer", contents }), { code }, finishReason);
  }
  await assert.rejects(recordingClient({ candidates: [{ finishReason: "STOP" }] }).generateContent({ role: "writer", contents }), { code: "VERTEX_EMPTY_RESPONSE" });
});

function withoutNewSettings(body) {
  const { safetySettings, systemInstruction, ...rest } = structuredClone(body);
  delete rest.generationConfig.thinkingConfig;
  return rest;
}

test("extraction, explanation and photo send the same request as before apart from the new settings, and parse the same fields", async () => {
  for (const role of RECORDED_ROLES) {
    const requests = [];
    const client = recordingClient(vertexPayload(recordedModelText[role]), requests, { model: "gemini-3.5-flash", location: "asia-south1" });
    const result = await runRecordedRole(role, client);
    const previous = before.roles[role];
    assert.equal(requests.length, previous.requests.length, role);
    assert.equal(requests[0].url, previous.requests[0].url, role);
    assert.deepEqual(withoutNewSettings(requests[0].body), previous.requests[0].body, role);
    assert.deepEqual(requests[0].body.safetySettings, RAI5_SAFETY, role);
    const { generation, ...parsed } = result;
    assert.deepEqual(parsed, previous.result, role);
    const promptRole = role.startsWith("photo") ? "photo" : role;
    assert.deepEqual(generation, { settingsVersion: "arc-models-v1", promptVersion: `${promptRole}/v1` }, role);
  }
});
