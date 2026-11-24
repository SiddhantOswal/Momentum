// grounding (RAI-3, thresholds T1 and T2). What runs now is the turn runner's
// side: the writer sees only the same turn's tool results, and any writer output
// that fails falls back to the template. The 20 recorded turns and the 15 writer
// outputs with planted wrong numbers are not written yet; the checks they need
// exist since ARC-M2-05, and numeric-fidelity covers them case by case.
import assert from "node:assert/strict";
import test from "node:test";
import { createArcWriter } from "../src/arc/answer-writer.js";
import { vertexFunctionCallResponse, vertexTextResponse } from "../src/mock-agents.js";
import { arcTurns, recordingVertexClient, text } from "./support/arc-turns.js";

const TEMPLATE = "Arc read the figures. The table below lists each one with its source.";
const weatherDeps = (provider) => ({
  now: Date.now, weatherCache: { get: () => null, set() {} },
  weatherProvider: provider ?? (async () => ({ ok: true, ambientRhPct: 61, ambientTempC: 23 })),
});

// A config-backed metric: its card is rebuilt on read with its label, so the writer may run (ARC-M2-05).
const crackScore = {
  availability: { queryMetric: true },
  queryMetric: async () => ({
    ok: true, status: "ok", metric: "model_holdout_r2", label: "Modeled, tested on 219 lots", filters: { defect: "CRACK" },
    rows: [{ defect: "CRACK", r2: 0.1081, maePp: 0.5, sampleCount: 219, evaluationId: "D4-2026-11-20-OM" }],
  }),
};

function writerTurn(writer, { router = [vertexFunctionCallResponse([{ name: "get_status" }])], commandDeps, services } = {}) {
  const seen = [];
  const arc = arcTurns({
    router, renderTemplate: () => TEMPLATE, commandDeps, services,
    writer: async (request) => { seen.push(request); return writer(request); },
  });
  return { arc, seen };
}

test("GR-01 the writer gets only the tool results of its own turn, not an earlier turn's", async () => {
  const { arc, seen } = writerTurn(() => ({ outcome: "shown", text: "Figures from this turn." }), {
    router: [
      vertexFunctionCallResponse([{ name: "get_status" }]),
      vertexFunctionCallResponse([{ name: "query_metric", args: { metric: "model_holdout_r2", filters: { defect: "CRACK" } } }]),
    ],
    services: crackScore,
  });
  await arc.post(text("How reliable is the warp model?"));
  await arc.post(text("What is the crack model's R2?"));
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[0].data.map(({ tool }) => tool), ["get_status"]);
  assert.deepEqual(seen[1].data.map(({ tool }) => tool), ["query_metric"]);
  assert.ok(!JSON.stringify(seen[1]).includes("modelAcceptance"), "turn 1 results do not reach turn 2");
});

// The writer sees the question and the writer fields only, not the template (05 section 4 and line 137, ADR-0009 item 6).
test("GR-02 the writer request carries the question and the data, and no tool declarations", async () => {
  const { arc, seen } = writerTurn(() => ({ outcome: "shown", text: "The model scores are listed." }));
  await arc.post(text("How reliable is the warp model?"));
  assert.deepEqual(Object.keys(seen[0]).filter((key) => !["signal", "onUsage", "reservationKey"].includes(key)).toSorted(), ["data", "question"]);
  const vertex = recordingVertexClient(() => vertexTextResponse("The model scores are listed."));
  await createArcWriter({ client: vertex.client })(seen[0]);
  assert.equal(vertex.requests.length, 1);
  assert.equal(vertex.requests[0].body.tools, undefined, "the writer request declares no tools");
  assert.equal(vertex.requests[0].body.toolConfig, undefined);
});

// T2: every writer output that fails a check falls back to the template.
const failedOutputs = [
  ["GR-03", "an empty text", { outcome: "shown", text: "   " }, "INVALID_WRITER_RESULT"],
  ["GR-04", "a text over the 1200-character limit", { outcome: "shown", text: "x".repeat(1201) }, "INVALID_WRITER_RESULT"],
  ["GR-05", "an output with no outcome", { text: "Warp is 3.42%." }, "INVALID_WRITER_RESULT"],
  ["GR-06", "a fallback the writer's own check reported", { outcome: "fallback", reason: "NUMBER_NOT_IN_TOOL_RESULTS" }, "NUMBER_NOT_IN_TOOL_RESULTS"],
];

for (const [caseId, label, output, reason] of failedOutputs) {
  test(`${caseId} ${label} falls back to the template and records why`, async () => {
    const { arc } = writerTurn(() => output);
    const { turn, body } = await arc.post(text("How reliable is the warp model?"));
    assert.equal(turn.answerText, TEMPLATE);
    assert.equal(turn.summary.writerOutcome, "fallback");
    assert.equal(turn.summary.fallbackReason, reason);
    assert.equal(turn.summary.attempts, 2);
    if (output.text?.trim()) assert.ok(!body.includes(output.text.slice(0, 40)));
  });
}

test("GR-07 a writer that throws falls back to the template with no error message (AC11.2)", async () => {
  const { arc } = writerTurn(() => { throw Object.assign(new Error("provider down"), { code: "VERTEX_UNAVAILABLE" }); });
  const { turn, frames } = await arc.post(text("How reliable is the warp model?"));
  assert.equal(turn.answerText, TEMPLATE);
  assert.equal(turn.summary.fallbackReason, "VERTEX_UNAVAILABLE");
  assert.ok(!frames.some(({ type }) => type.endsWith("failed")));
});

test("GR-08 a data step that failed calls no writer and shows no number (AC11.6)", async () => {
  const { arc, seen } = writerTurn(() => assert.fail("the writer must not run"), {
    router: [vertexFunctionCallResponse([{ name: "get_weather" }])],
    commandDeps: weatherDeps(async () => ({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Weather is down." } })),
  });
  const { frames, turn } = await arc.post(text("What is the humidity at the plant?"));
  assert.equal(seen.length, 0);
  assert.equal(frames.at(-1).type, "step.failed");
  assert.equal(turn.answerText ?? null, null);
  assert.equal(arc.reservations.length, 1, "only the router attempt was spent");
});
