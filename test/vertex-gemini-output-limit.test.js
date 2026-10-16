import assert from "node:assert/strict";
import test from "node:test";
import { createVertexGeminiClient } from "../src/google-cloud/vertex-gemini-client.js";

const contents = [{ role: "user", parts: [{ text: "explain" }] }];
function clientReturning(candidate, requests = []) {
  return createVertexGeminiClient({
    projectId: "prepagent-hack", model: "gemini-3.5-flash", tokenProvider: async () => "test-token",
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return Response.json({ candidates: [candidate], usageMetadata: { promptTokenCount: 1857, candidatesTokenCount: 80, thoughtsTokenCount: 1964 } });
    },
  });
}

test("generateContent keeps the 2048-token default and accepts a bounded per-call output limit", async () => {
  const requests = [];
  const client = clientReturning({ content: { parts: [{ text: "Done." }] }, finishReason: "STOP" }, requests);
  await client.generateContent({ contents });
  await client.generateContent({ contents, maxOutputTokens: 8192 });
  assert.deepEqual(requests.map((r) => r.generationConfig.maxOutputTokens), [2048, 8192]);
  for (const maxOutputTokens of [0, 8193, 1.5, "8192", null]) {
    await assert.rejects(client.generateContent({ contents, maxOutputTokens }), { code: "INVALID_GENERATION_REQUEST" });
  }
  assert.equal(requests.length, 2, "invalid limits are rejected before any provider request");
});

test("an answer cut off at the output token limit is an explicit error, never partial text", async () => {
  // Shape observed live on 16 Oct 2026: thinking exhausted the budget, leaving a checklist fragment.
  const truncated = { content: { parts: [{ text: "83 kg, present)\n * 4426 (present)" }] }, finishReason: "MAX_TOKENS" };
  const usage = [];
  const client = clientReturning(truncated);
  await assert.rejects(client.generateContent({ contents, onUsage: (u) => usage.push(u) }), { code: "VERTEX_OUTPUT_TRUNCATED" });
  assert.equal(usage[0].thoughtsTokenCount, 1964, "usage is still reported for metering");
  await assert.rejects(
    client.generateJson({ fileUri: "gs://prepagent-hack-data/orders/test.pdf", mimeType: "application/pdf", prompt: "extract", responseSchema: {} }),
    { code: "VERTEX_OUTPUT_TRUNCATED" });
});
