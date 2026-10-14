import assert from "node:assert/strict";
import test from "node:test";
import { AGENT_TOOLS, createTraceRegistry } from "../src/trace-registry.js";
import { createGeminiFunctionRunner } from "../src/google-cloud/gemini-function-runner.js";

function traceIdFactory() {
  let sequence = 0;
  return () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
}

function toolDefinitions(overrides = {}) {
  return Object.fromEntries(AGENT_TOOLS.map((name) => [name, {
    description: `${name} tool`,
    parameters: { type: "OBJECT", properties: {} },
    execute: async () => ({ ok: true }),
    ...overrides[name],
  }]));
}

test("Gemini function loop executes allow-listed tools and traces actual calls without payloads", async () => {
  const registry = createTraceRegistry({ idFactory: traceIdFactory() });
  const calls = [];
  let invocation = 0;
  const gemini = {
    generateContent: async (request) => {
      calls.push(request);
      invocation += 1;
      return invocation === 1
        ? { role: "model", parts: [{ functionCall: { id: "model-call-1", name: "getConditions", args: { shift: "DAY" } } }] }
        : { role: "model", parts: [{ text: "Ready for risk analysis." }] };
    },
  };
  const tools = toolDefinitions({
    getConditions: { execute: async ({ shift }) => ({ ok: true, shift, secret: "do-not-trace" }) },
  });
  const run = createGeminiFunctionRunner({ gemini, traceRegistry: registry, tools });

  const result = await run({ contents: [{ role: "user", parts: [{ text: "Start the production workflow." }] }] });
  const events = registry.getEventsAfter(result.runId);
  assert.equal(result.text, "Ready for risk analysis.");
  assert.deepEqual(events.map((event) => event.type), [
    "run.started", "tool.started", "tool.succeeded", "run.completed",
  ]);
  assert.equal(events[1].tool, "getConditions");
  assert.equal(JSON.stringify(events).includes("do-not-trace"), false);
  assert.equal(calls[0].tools[0].functionDeclarations.length, 7);
  assert.deepEqual(calls[1].contents.at(-1).parts[0].functionResponse, {
    name: "getConditions",
    id: "model-call-1",
    response: { result: { ok: true, shift: "DAY", secret: "do-not-trace" } },
  });
});

test("Gemini function loop refuses out-of-registry calls and records a failed run", async () => {
  const registry = createTraceRegistry({ idFactory: traceIdFactory() });
  const run = createGeminiFunctionRunner({
    traceRegistry: registry,
    gemini: { generateContent: async () => ({ role: "model", parts: [{ functionCall: { name: "deletePlant", args: {} } }] }) },
    tools: toolDefinitions(),
  });

  await assert.rejects(run({ contents: [{ role: "user", parts: [{ text: "Run." }] }] }), /outside the Blueprint registry/);
  assert.equal(registry.getRun("00000000-0000-4000-8000-000000000001").status, "failed");
});
