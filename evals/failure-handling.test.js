// failure-handling (RAI-7, threshold T14). Seven faults on each of the five
// generative paths, scored against evals/failure-handling/expected.json, which is
// written by hand from spec J11 and design section 6. The writer path uses a
// stand-in writer port over the real Vertex client, not createArcWriter (see suites.json).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readDailyGeminiCallCapConfig, withDailyGeminiCallCap } from "../src/daily-gemini-call-cap.js";
import { VERTEX_FAULTS, vertexFunctionCallResponse } from "../src/mock-agents.js";
import { runRecordedRole } from "../test/fixtures/gemini-recorded-roles.js";
import { arcTurns, recordingVertexClient, text } from "./support/arc-turns.js";

const expected = JSON.parse(readFileSync(new URL("./failure-handling/expected.json", import.meta.url), "utf8"));
const refusal = JSON.parse(readFileSync(new URL("../config/arc-scope.json", import.meta.url), "utf8")).replies.reply_out_of_scope;
const faults = Object.keys(expected.codes);
const codeMatches = (fault, code) => [expected.codes[fault]].flat().includes(code);
const requestsFor = (fault) => fault === "cap_reached" ? expected.providerRequests.cap_reached : expected.providerRequests.default;
const TEMPLATE = "Arc read the model scores. The table below lists each figure.";

/** A Vertex client whose every request meets the fault; for cap_reached the daily cap is already used up. */
async function faultyClient(fault) {
  const { client, requests } = recordingVertexClient(() => VERTEX_FAULTS[fault]);
  if (fault !== "cap_reached") return { gemini: client, requests };
  const gemini = withDailyGeminiCallCap(client, readDailyGeminiCallCapConfig({ GEMINI_DAILY_ATTEMPT_CAP: "1" }));
  // This call fails the client's own validation, so it uses the one attempt without a request.
  await gemini.generateJson({}).catch(() => {});
  return { gemini, requests };
}

const paths = {
  async router(fault) {
    const ok = vertexFunctionCallResponse([{ name: "get_status" }]);
    const capped = fault === "cap_reached";
    const arc = arcTurns({ router: capped ? [ok] : [VERTEX_FAULTS[fault]], ...(capped && { budgetLimits: { sessionDayLimit: 1 } }) });
    if (capped) await arc.post(text("How reliable is the warp model?"));
    const before = arc.vertexRequests.length;
    const reservationsBefore = arc.reservations.length;
    const { frames, turn, body } = await arc.post(text("Which defect costs the most?"));
    const rule = capped ? expected.paths.router.cap_reached : expected.paths.router;
    assert.equal(arc.vertexRequests.length - before, requestsFor(fault), "provider requests");
    assert.equal(arc.reservations.length - reservationsBefore, rule.attempts, "attempts counted");
    assert.ok(!frames.some(({ type }) => type.startsWith("step.")), "no tool runs");
    assert.equal(frames.at(-1).type, rule.event);
    assert.ok(!body.includes(refusal), "a failure is never shown as the off-topic refusal");
    if (!capped) {
      assert.ok(codeMatches(fault, frames.at(-1).errorCode), frames.at(-1).errorCode);
      assert.equal(turn.answerText ?? null, null, "nothing from Gemini is shown");
    }
    assert.equal(arc.approvals.length, 0);
  },

  async writer(fault) {
    const capped = fault === "cap_reached";
    const writerVertex = recordingVertexClient(() => VERTEX_FAULTS[fault]);
    const arc = arcTurns({
      router: [vertexFunctionCallResponse([{ name: "get_status" }])],
      renderTemplate: () => TEMPLATE,
      ...(capped && { budgetLimits: { sessionDayLimit: 1 } }),
      async writer({ question, data, signal }) {
        const content = await writerVertex.client.generateContent({
          role: "writer", contents: [{ role: "user", parts: [{ text: JSON.stringify({ question, data }) }] }], signal,
        });
        return { outcome: "shown", text: content.parts.map((part) => part.text ?? "").join("") };
      },
    });
    const { frames, turn } = await arc.post(text("How reliable is the warp model?"));
    const rule = capped ? { ...expected.paths.writer, ...expected.paths.writer.cap_reached } : expected.paths.writer;
    assert.equal(writerVertex.requests.length, requestsFor(fault), "writer provider requests");
    assert.equal(turn.answerText, TEMPLATE, "the template answer is shown, with no error message");
    assert.equal(turn.summary.writerOutcome, rule.writerOutcome);
    assert.equal(turn.summary.attempts, rule.attempts);
    if (capped) assert.equal(turn.summary.fallbackReason, rule.fallbackReason);
    else assert.ok(codeMatches(fault, turn.summary.fallbackReason), turn.summary.fallbackReason);
    assert.deepEqual(frames.map(({ type }) => type), ["run.started", "step.started", "step.succeeded", "answer", "run.completed"]);
    assert.equal(arc.approvals.length, 0);
  },

  async extraction(fault) {
    const { gemini, requests } = await faultyClient(fault);
    const result = await runRecordedRole("extraction", gemini);
    assert.equal(requests.length, requestsFor(fault));
    assert.equal(result.ok, expected.paths.extraction.ok);
    assert.equal(result.reviewId, undefined, "no review stored");
    assert.equal(result.orderProfile, undefined);
    const named = fault === "cap_reached" ? result.error.code : result.error.message.match(/\(([A-Z_]+)\)/)?.[1];
    assert.ok(codeMatches(fault, named), named);
  },

  async explanation(fault) {
    const { gemini, requests } = await faultyClient(fault);
    const result = await runRecordedRole("explanation", gemini);
    assert.ok(requests.length <= expected.providerRequests.explanationRetry);
    if (fault === "cap_reached") assert.equal(requests.length, 0);
    assert.equal(result.ok, expected.paths.explanation.ok);
    assert.equal(result.source, expected.paths.explanation.source);
    assert.equal(result.generation, undefined, "the code-written summary does not claim Gemini settings");
    assert.ok(result.rows.length > 0, "the numbers are kept");
    assert.ok(!result.explanation.includes(refusal));
  },

  async photo(fault) {
    const { gemini, requests } = await faultyClient(fault);
    const result = await runRecordedRole("photoDiagnosis", gemini);
    assert.equal(requests.length, requestsFor(fault));
    assert.equal(result.ok, expected.paths.photo.ok);
    assert.equal(result.diagnosis, undefined, "no result stored");
    assert.equal(result.isRealModelPrediction, undefined);
    if (fault === "cap_reached") assert.ok(codeMatches(fault, result.error.code));
  },
};

// The writer returns plain text, so it has no invalid-JSON case; text that fails a check is
// tested in numeric-fidelity and grounding. The case stays listed as not built here.
const notBuilt = new Set(["writer:invalid_json"]);

for (const [path, run] of Object.entries(paths)) {
  for (const fault of faults.filter((name) => !notBuilt.has(`${path}:${name}`))) {
    test(`FH-${path}-${fault} ${expected.paths[path].rule}`, () => run(fault));
  }
}
