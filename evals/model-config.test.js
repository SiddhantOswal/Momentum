// model-config (RAI-5, threshold T12, M1 gate condition EV-2). The expected values
// are read from config/arc-models.json, config/gcp-vertex-ai.json, the prompt
// files, the RAI-5 text and the M1-15 Vertex record, never from the client's own
// constants. Requests are captured from a fake transport behind the real client.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { VERTEX_FAULTS, vertexFunctionCallResponse, vertexTextResponse } from "../src/mock-agents.js";
import { recordedModelText, runRecordedRole } from "../test/fixtures/gemini-recorded-roles.js";
import { arcTurns, recordingVertexClient, text } from "./support/arc-turns.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const models = JSON.parse(read("config/arc-models.json"));
const vertex = JSON.parse(read("config/gcp-vertex-ai.json"));
const scopeCopy = JSON.parse(read("config/arc-scope.json")).replies;
const reference = read("docs/arc/delivery/data/vertex-safety-reference.md");
const rai = read("docs/arc/delivery/responsible-ai.md");

const confirmedCategories = [...reference.matchAll(/^\| Harm category \| `(HARM_CATEGORY_[A-Z_]+)` \| Confirmed \|/gm)].map(([, name]) => name);
const documentedThresholds = [...reference.matchAll(/^\| `(BLOCK_[A-Z_]+)` \|/gm)].map(([, name]) => name);
const documentedMethods = [...reference.matchAll(/^\| `(SEVERITY|PROBABILITY)` \|/gm)].map(([, name]) => name);
const referenceModels = [...reference.match(/^\| Fact \|(.+)\| Source \|$/m)[1].matchAll(/`([a-z0-9.-]+)`/g)].map(([, id]) => id);
const regionRow = reference.match(/^\| `([a-z0-9-]+)` listed under model availability.*\| Yes \| Yes/m);
const [, raiThreshold, raiMethod] = rai.match(/each with `threshold: ([A-Z_]+)` and `method: ([A-Z]+)`/);
const raiCategories = [...rai.match(/sets `safetySettings` explicitly[^.]*/)[0].matchAll(/`(HARM_CATEGORY_[A-Z_]+)`/g)].map(([, name]) => name);

const systemPrompt = (prompt) => read(`prompts/${prompt}/system.txt`).replace(/\n$/, "");
const endpoint = ({ model, location }) =>
  `https://${location}-${vertex.api}/${vertex.apiVersion}/projects/${vertex.projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

// Every request any case captures, so the last case can check that none left for another host.
const captured = [];

// Request builders: the role whose settings they send and how to run them once.
const builders = {
  router: { role: "router" },
  extraction: { role: "extraction", recorded: "extraction" },
  explanation: { role: "explanation", recorded: "explanation" },
  "photo-diagnosis": { role: "photo", recorded: "photoDiagnosis" },
  "photo-classification": { role: "photo", recorded: "photoClassification" },
};

/** Runs a builder once against `payload` and returns the captured request and what the path produced. */
async function runBuilder(name, payload) {
  const builder = builders[name];
  if (builder.role === "router") {
    const arc = arcTurns({ router: [payload] });
    const turn = await arc.post(text("How reliable is the warp model?"));
    captured.push(...arc.vertexRequests);
    return { request: arc.vertexRequests[0], turn, requests: arc.vertexRequests };
  }
  const { client, requests } = recordingVertexClient([payload]);
  const result = await runRecordedRole(builder.recorded, client).catch((error) => ({ thrown: error }));
  captured.push(...requests);
  return { request: requests[0], result, requests };
}

const okPayload = (name) => builders[name].role === "router"
  ? vertexFunctionCallResponse([{ name: "get_status" }])
  : vertexTextResponse(recordedModelText[builders[name].recorded]);

function assertNotShownAsAnswer(name, outcome, blockedText) {
  assert.equal(outcome.requests.length, 1, "the block is not retried into a second request");
  if (builders[name].role === "router") {
    const { turn } = outcome;
    assert.deepEqual(turn.frames.map(({ type }) => type), ["run.failed"]);
    assert.equal(turn.frames[0].errorCode, "GEMINI_SAFETY_BLOCKED");
    assert.equal(turn.turn.answerText ?? null, null, "a blocked router call shows no answer");
    assert.ok(!turn.body.includes(scopeCopy.reply_out_of_scope), "a safety block is not the off-topic refusal");
    assert.deepEqual(turn.turn.summary ?? null, null, "no tool ran");
    return;
  }
  const { result } = outcome;
  assert.equal(result.thrown, undefined, "the path returns a result, it does not crash");
  const serialized = JSON.stringify(result);
  if (blockedText) assert.ok(!serialized.includes(blockedText));
  if (builders[name].role === "explanation") {
    // Spec J1 "Explanation fails twice": the numbers stay and the text is the code-written summary, not Gemini's.
    assert.equal(result.ok, true);
    assert.equal(result.source, "bigquery-ml-attribution-summary");
    assert.equal(result.generation, undefined, "a code-written summary does not claim Gemini settings");
    return;
  }
  assert.equal(result.ok, false, "no extraction or diagnosis result is accepted");
  assert.equal(result.isRealModelPrediction, undefined);
  assert.ok(!serialized.includes(scopeCopy.reply_out_of_scope));
}

test("MC-00 the configured models and safety values are the ones the M1-15 record and RAI-5 confirm", () => {
  assert.deepEqual(confirmedCategories.toSorted(), raiCategories.toSorted(), "the oracle files agree with each other");
  for (const [role, settings] of Object.entries(models.roles)) {
    assert.ok(referenceModels.includes(settings.model), `${role} model ${settings.model} is in the M1-15 model table`);
    if (settings.fallbackModel) assert.ok(referenceModels.includes(settings.fallbackModel), `${role} fallback`);
    assert.equal(settings.location, regionRow?.[1], `${role} runs in the region the record lists for both models`);
    assert.equal(settings.location, vertex.location, `${role} region matches config/gcp-vertex-ai.json`);
    assert.equal(settings.includeThoughts, false, role);
    assert.ok(!("thinkingBudget" in settings), `${role} must not set the deprecated thinkingBudget`);
  }
  for (const setting of models.safetySettings) {
    assert.equal(setting.threshold, raiThreshold);
    assert.equal(setting.method, raiMethod);
    assert.ok(documentedThresholds.includes(setting.threshold) && documentedMethods.includes(setting.method));
  }
});

for (const name of Object.keys(builders)) {
  const settings = models.roles[builders[name].role];

  test(`MC-${name}-settings the ${name} request sends the configured model, region, temperature, output limit, thinking and prompt`, async () => {
    const { request } = await runBuilder(name, okPayload(name));
    assert.equal(request.url, endpoint(settings));
    const config = request.body.generationConfig;
    if (settings.temperature === null) assert.ok(!("temperature" in config), "a fixed-temperature model gets no temperature");
    else assert.equal(config.temperature, settings.temperature);
    assert.equal(config.maxOutputTokens, settings.maxOutputTokens);
    assert.deepEqual(config.thinkingConfig, { thinkingLevel: settings.thinkingLevel, includeThoughts: settings.includeThoughts });
    assert.ok(!JSON.stringify(request.body).includes("thinkingBudget"));
    assert.deepEqual(request.body.systemInstruction, { parts: [{ text: systemPrompt(settings.prompt) }] });
    if (settings.functionCallingMode === null) assert.equal(request.body.toolConfig, undefined);
    else assert.equal(request.body.toolConfig.functionCallingConfig.mode, settings.functionCallingMode);
  });

  test(`MC-${name}-safety the ${name} request lists the four harm categories with the configured threshold and method`, async () => {
    const { request } = await runBuilder(name, okPayload(name));
    assert.deepEqual(request.body.safetySettings, models.safetySettings);
    assert.deepEqual(request.body.safetySettings.map(({ category }) => category).toSorted(), confirmedCategories.toSorted());
    for (const setting of request.body.safetySettings) {
      assert.deepEqual(Object.keys(setting).toSorted(), ["category", "method", "threshold"]);
      assert.ok(!["BLOCK_NONE", "OFF", "HARM_BLOCK_THRESHOLD_UNSPECIFIED"].includes(setting.threshold));
    }
  });

  test(`MC-${name}-finish-safety a finishReason SAFETY response on the ${name} path is never shown as an answer`, async () => {
    assertNotShownAsAnswer(name, await runBuilder(name, VERTEX_FAULTS.safety_block.json));
  });

  test(`MC-${name}-prompt-blocked a promptFeedback.blockReason response on the ${name} path is never shown as an answer`, async () => {
    assertNotShownAsAnswer(name, await runBuilder(name, VERTEX_FAULTS.prompt_blocked.json));
  });

  if (builders[name].role !== "router") {
    test(`MC-${name}-version the stored ${name} result records the settings and prompt version it ran with`, async () => {
      const { result } = await runBuilder(name, okPayload(name));
      assert.equal(result.ok, true);
      assert.deepEqual(result.generation, { settingsVersion: models.version, promptVersion: settings.prompt });
    });
  }
}

test("MC-client-allow-list the router's allowedFunctionNames equal the registry's state table plus the three replies", async () => {
  const replies = ["reply_out_of_scope", "ask_clarification", "explain_cannot_approve"];
  const arc = arcTurns({
    router: [vertexFunctionCallResponse([{ name: "list_samples" }]), vertexFunctionCallResponse([{ name: "get_status" }])], commandDeps: { runWriteEffect: async (_claim, run) => run() } });
  for (const message of ["Show the sample orders", "How reliable is the warp model?"]) {
    const expected = await arc.registryAllowList();
    const before = arc.vertexRequests.length;
    await arc.post(text(message));
    const request = arc.vertexRequests[before];
    captured.push(request);
    assert.deepEqual(request.body.toolConfig.functionCallingConfig.allowedFunctionNames, [...expected, ...replies], message);
    const declared = request.body.tools.flatMap(({ functionDeclarations }) => functionDeclarations.map(({ name }) => name));
    assert.deepEqual(declared.toSorted(), [...expected, ...replies].toSorted(), message);
    assert.ok(!declared.some((name) => /(^|_)approve(_|$)/.test(name) && name !== "explain_cannot_approve"), "no declaration reaches approval");
  }
  assert.ok((await arc.registryAllowList()).includes("read_order"), "listing the samples changes the state table, and the request follows it");
});

test("MC-client-writer-no-tools the writer role cannot send function declarations", async () => {
  assert.equal(models.roles.writer.functionCallingMode, null);
  const { client, requests } = recordingVertexClient([vertexTextResponse("ok")]);
  const contents = [{ role: "user", parts: [{ text: "Write the answer." }] }];
  const tools = [{ functionDeclarations: [{ name: "get_status", parameters: { type: "OBJECT" } }] }];
  await assert.rejects(client.generateContent({ role: "writer", contents, tools }), { code: "INVALID_GENERATION_REQUEST" });
  await assert.rejects(client.generateContent({ role: "writer", contents, allowedFunctionNames: ["get_status"] }), { code: "INVALID_GENERATION_REQUEST" });
  assert.equal(requests.length, 0);
});

test("MC-client-endpoint no request in this suite went anywhere but the configured Vertex AI endpoint", () => {
  assert.ok(captured.length >= 20, `expected the requests of the cases above, saw ${captured.length}`);
  const allowed = new Set(Object.values(models.roles).map(endpoint));
  for (const { url, method } of captured) {
    assert.ok(allowed.has(url), url);
    assert.equal(method, "POST");
  }
});
