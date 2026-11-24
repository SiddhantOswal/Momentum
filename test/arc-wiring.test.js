import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createConfiguredServicePorts, createServicePorts } from "../src/service-ports.js";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";
import { events, fixture, text } from "./fixtures/arc-turn-runner.js";

async function loadNewModule(path) {
  try {
    return await import(path);
  } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" || error.url !== new URL(path, import.meta.url).href) throw error;
    return {};
  }
}

const { createArcModelPorts } = await loadNewModule("../src/arc/model-ports.js");

const LIMITS = JSON.stringify({ pool: "live", dayLimit: 300, sessionDayLimit: 40, ipDayLimit: 120, minuteLimit: 20, sessionMinuteLimit: 6 });
const liveEnv = {
  PROJECT_ID: "prepagent-hack", BUCKET: "test-bucket", USTAAD_ENABLE_LIVE_MODEL_CALLS: "true",
  USTAAD_GEMINI_BUDGET_POLICY: "budget-v2", GEMINI_BUDGET_LIMITS: LIMITS,
  GEMINI_MODEL: "gemini-3.5-flash", VERTEX_LOCATION: "us-central1", REGION: "us-central1",
};

const routedToStatus = () => ({ role: "model", parts: [{ functionCall: { name: "get_status", args: {} } }] });

function ports(env, vertexRequests = [], respond = routedToStatus) {
  const budget = fakeFirestore();
  return createConfiguredServicePorts({
    env,
    modelConfig: { modelCallsEnabled: true, testModel: "gemini-3.5-flash", location: "us-central1", projectId: "prepagent-hack" },
    tokenProvider: async () => "test",
    fetchImpl: async (url, init) => {
      if (String(url).includes("aiplatform")) {
        const body = JSON.parse(init.body);
        vertexRequests.push({ url: String(url), body });
        return Response.json({ candidates: [{ content: respond(body), finishReason: "STOP" }] });
      }
      return budget.fetchImpl(url, init);
    },
  });
}

test("service ports expose the budget store, the daily cap and a router client when live calls are permitted", async () => {
  const requests = [];
  const { arcGemini } = ports(liveEnv, requests);
  assert.equal(typeof arcGemini.attemptStore.reserveAttempt, "function");
  assert.equal(arcGemini.attemptStore.scope, "shared-firestore-transaction");
  assert.equal(arcGemini.dailyCap.configured, true);
  const content = await arcGemini.routerClient.generateContent({
    role: "router", contents: [{ role: "user", parts: [{ text: "x" }] }],
    tools: [{ functionDeclarations: [{ name: "get_status", description: "d" }] }], allowedFunctionNames: ["get_status"],
  });
  assert.equal(content.parts[0].functionCall.name, "get_status");
  assert.match(requests[0].url, /^https:\/\/asia-south1-aiplatform\.googleapis\.com\/.*\/models\/gemini-3\.5-flash-lite:generateContent$/,
    "the router model and region come from config, not from GEMINI_MODEL or VERTEX_LOCATION");
});

test("without the live-call opt-in nothing is exposed and Arc has no router", () => {
  const { GEMINI_BUDGET_LIMITS: _unused, ...rest } = liveEnv;
  for (const env of [{ ...liveEnv, USTAAD_ENABLE_LIVE_MODEL_CALLS: "false" }, { ...rest, GEMINI_BUDGET_LIMITS: "{}" }]) {
    const { arcGemini } = ports(env);
    assert.equal(arcGemini.routerClient, undefined);
    assert.equal(arcGemini.attemptStore, undefined);
  }
  assert.deepEqual(createServicePorts({}).arcGemini, {});
  assert.equal(typeof createArcModelPorts, "function", "createArcModelPorts must exist");
  const none = createArcModelPorts(createServicePorts({}));
  assert.equal(none.router, undefined);
  assert.equal(none.attemptStore, undefined);
});

test("the Arc model ports hand the runner the router, the rules and the budget store", async () => {
  assert.equal(typeof createArcModelPorts, "function", "createArcModelPorts must exist");
  const live = createArcModelPorts(ports(liveEnv));
  assert.equal(typeof live.router, "function");
  assert.equal(typeof live.preRoute, "function");
  assert.equal(typeof live.renderReply, "function");
  assert.equal(typeof live.attemptStore.reserveAttempt, "function");
  assert.equal(live.geminiCap.configured, true);
  assert.equal((await live.preRoute({ text: "Approve it" })).intent, "explain_cannot_approve");
  const routed = await live.router({
    text: "How far can I trust the models?", history: [], allowedFunctionNames: ["get_status"],
    declarations: [{ functionDeclarations: [{ name: "get_status", description: "d" }] }],
  });
  assert.deepEqual(routed, { calls: [{ name: "get_status", args: {} }] });
});

test("index.mjs hands the Arc turn runner the model ports", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../index.mjs", import.meta.url), "utf8");
  const block = source.slice(source.indexOf("createArcTurnRunner({"), source.indexOf("}));", source.indexOf("createArcTurnRunner({")));
  assert.match(block, /\.\.\.createArcModelPorts\(servicePorts/);
});

test("with live ports a typed data question is routed, written and checked instead of SERVICE_UNAVAILABLE", { timeout: 3000 }, async () => {
  const requests = [];
  const written = "Print scores the highest R2, 0.64, on 219 modeled lots.";
  const live = createArcModelPorts(ports(liveEnv, requests, (body) => body.tools
    ? routedToStatus() : { role: "model", parts: [{ text: written }] }));
  assert.equal(typeof live.writer, "function");
  assert.equal(typeof live.renderTemplate, "function");
  const setup = fixture({ router: live.router, writer: live.writer, renderTemplate: live.renderTemplate });
  const clientTurnId = randomUUID();
  const frames = await events(await setup.post(text("How far can I trust the models?"), { clientTurnId }));
  assert.equal(frames.at(-1).type, "run.completed");
  const turn = await setup.sessionStore.getTurn(setup.principal.sessionId, clientTurnId);
  assert.deepEqual([turn.answerText, turn.summary.writerOutcome, turn.summary.attempts], [written, "shown", 2]);
  assert.equal(requests.length, 2);
  const [, writer] = requests;
  assert.match(writer.url, /^https:\/\/asia-south1-aiplatform\.googleapis\.com\/.*\/models\/gemini-3\.5-flash:generateContent$/);
  assert.equal(writer.body.tools, undefined, "the writer declares no tools");
  const prompt = readFileSync(new URL("../prompts/writer/v1/system.txt", import.meta.url), "utf8").replace(/\n$/, "");
  assert.deepEqual(writer.body.systemInstruction, { parts: [{ text: prompt }] });
  const sent = JSON.parse(writer.body.contents[0].parts[0].text);
  assert.deepEqual(Object.keys(sent), ["question", "facts"]);
  assert.equal(sent.question, "How far can I trust the models?");
  assert.doesNotMatch(writer.body.contents[0].parts[0].text, /prepagent\.m2_|modelVersion|bqjob_/, "only writer fields leave the tool result");
});

test("without the live-call opt-in the model ports have no writer", () => {
  const none = createArcModelPorts(createServicePorts({}));
  assert.equal(none.writer, undefined);
  assert.equal(typeof none.renderTemplate, "function");
});
