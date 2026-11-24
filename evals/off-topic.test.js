// off-topic (RAI-4, threshold T7). The offline cases cover the rule paths, the
// AC5.2 length and the J5 suggestions. Precision and recall over the labelled set
// need the router itself, so they are measured only in the live half.
import assert from "node:assert/strict";
import test from "node:test";
import { vertexFunctionCallResponse } from "../src/mock-agents.js";
import { action, arcConfig, arcTurns, text } from "./support/arc-turns.js";

// J5 step 2 gives these two sentences.
const J5_REFUSAL = ["That is not something Arc does.", "Arc works on lots, conditions, settings, defects, job cards and plant data."];

// [case, message, words an answer to it would contain]
const offTopic = [
  ["OT-01", "Where is Phoenix Market City?", /mall|kurla|mumbai|pune|bengaluru/i],
  ["OT-02", "Tell me a joke", /knock|why did/i],
  ["OT-03", "What is the capital of France?", /paris/i],
  ["OT-04", "Write me a poem about the monsoon", /rain|cloud/i],
  ["OT-05", "Who won the IPL final?", /won|champion|runs/i],
  ["OT-06", "What is the bitcoin price today?", /usd|\$|inr|₹/i],
  ["OT-07", "Give me a recipe for dal", /lentil|turmeric|boil/i],
];

const sentences = (value) => value.split(/(?<=[.!?])\s+/).filter(Boolean);

for (const [caseId, message, answerWords] of offTopic) {
  test(`${caseId} "${message}" gets the two-sentence refusal with no answer, before any model call`, async () => {
    const arc = arcTurns({ router: () => assert.fail("the router must not run") });
    const { frames, turn } = await arc.post(text(message));
    assert.deepEqual(frames.map(({ type }) => type), ["answer"]);
    assert.ok(sentences(turn.answerText).length <= 2, "AC5.2: at most two sentences");
    assert.deepEqual(sentences(turn.answerText), J5_REFUSAL);
    assert.doesNotMatch(turn.answerText, answerWords, "AC5.2: no answer to the off-topic question");
    assert.equal(turn.summary.intent, "reply_out_of_scope");
    assert.equal(turn.summary.attempts, 0);
  });
}

test("OT-08 a refusal offers three in-scope suggestions, and picking each costs no Gemini attempt", async () => {
  const arc = arcTurns({ router: () => assert.fail("a suggestion must not reach the router") });
  const { suggestions } = arc.scope.check("Tell me a joke");
  assert.equal(suggestions.length, 3, "J5 step 3");
  for (const { actionId, label } of suggestions) {
    assert.ok(label.length > 0 && label.length <= 60);
    assert.ok(Object.hasOwn(arcConfig.actions, actionId), `${actionId} is a fixed action`);
    const { status, turn } = await arc.post(action(actionId));
    assert.equal(status, 200, actionId);
    assert.equal(turn.summary.attempts, 0, actionId);
  }
  assert.deepEqual(arc.reservations, []);
});

test("OT-09 a mixed message is left for the router, which answers the in-scope part (AC5.4)", async () => {
  const arc = arcTurns({ router: [vertexFunctionCallResponse([{ name: "get_weather" }, { name: "reply_out_of_scope", args: {} }])] });
  const message = "what's the weather in Goa and the moisture for this lot";
  assert.equal(arc.scope.check(message), null);
  await arc.post(text(message));
  assert.equal(arc.vertexRequests.length, 1);
  assert.ok(arc.vertexRequests[0].body.contents[0].parts[0].text.includes(message));
});

test("OT-10 an off-topic message past the rules gets the fixed refusal from the router's reply, not model text", async () => {
  const arc = arcTurns({ router: [vertexFunctionCallResponse([{ name: "reply_out_of_scope", args: { suggestionIds: ["list_samples"] } }])] });
  const { turn } = await arc.post(text("Can you recommend a good laptop for college?"));
  assert.deepEqual(sentences(turn.answerText), J5_REFUSAL);
  assert.equal(turn.summary.attempts, 1);
  assert.deepEqual(turn.summary.tools, []);
});
