import { VertexGeminiError } from "../google-cloud/vertex-gemini-client.js";

/**
 * The answer writer (founder decision A3). It sends the typed question and the
 * projected facts as user content, never as instructions, and declares no tools,
 * so it cannot start a loop. Its text is not shown yet: the turn runner checks it
 * against the same facts first. The client is the unwrapped Vertex client; the
 * runner puts the budget wrapper and the caller context around this function.
 */
export function createArcWriter({ client } = {}) {
  if (typeof client?.generateContent !== "function") throw new TypeError("A Gemini client is required.");
  return async function write({ question, data, signal, onUsage }) {
    const content = await client.generateContent({
      role: "writer",
      contents: [{ role: "user", parts: [{ text: JSON.stringify({ question, facts: data }) }] }],
      signal,
      onUsage,
    });
    const text = content.parts.filter((part) => typeof part?.text === "string" && part.thought !== true)
      .map(({ text: piece }) => piece).join("").trim();
    if (!text) throw new VertexGeminiError("VERTEX_EMPTY_RESPONSE", "The answer writer returned no text.");
    return { outcome: "shown", text };
  };
}
