import { arcModelSettings } from "../arc-model-settings.js";
import { VertexGeminiError } from "../google-cloud/vertex-gemini-client.js";
import { createScopeRules } from "./scope-rules.js";

const MAX_HISTORY = 4;

function invalid(message) {
  return new VertexGeminiError("VERTEX_INVALID_RESPONSE", message);
}

function replyDeclarations(scope) {
  return [
    {
      name: "reply_out_of_scope",
      description: "Decline a message that is not about Momentum. Optionally name up to three suggestions.",
      parameters: {
        type: "OBJECT",
        properties: { suggestionIds: { type: "ARRAY", maxItems: 3, items: { type: "STRING", enum: [...scope.suggestionIds] } } },
      },
    },
    {
      name: "ask_clarification",
      description: "Ask the user for the one thing a request is missing.",
      parameters: {
        type: "OBJECT",
        properties: { field: { type: "STRING", enum: [...scope.clarificationFields] } },
        required: ["field"],
      },
    },
    { name: "explain_cannot_approve", description: "Say that Arc cannot approve a job card." },
  ];
}

/**
 * The only fields that go to the router are the message, the tool declarations
 * built from this session's own state, and the intent and tool names of earlier
 * turns. Order fields are never passed, so nothing an order or a photo said can
 * reach this prompt (05 section 5, step 5). The client is the unwrapped Vertex
 * client: the turn runner already puts the budget wrapper around this function.
 */
export function createArcRouter({ client, settings = arcModelSettings, scope = createScopeRules() } = {}) {
  if (typeof client?.generateContent !== "function") throw new TypeError("A Gemini client is required.");
  if (settings.roles.router.functionCallingMode !== "ANY") throw new TypeError("The router role must use function-calling mode ANY.");
  const replies = new Set(scope.replyFunctions);
  const declared = replyDeclarations(scope);

  return async function route({ text, history = [], allowedFunctionNames, declarations, signal, onUsage }) {
    const recentTurns = history.slice(-MAX_HISTORY).map((turn) => ({
      intent: typeof turn?.intent === "string" ? turn.intent : null,
      tools: Array.isArray(turn?.tools) ? turn.tools.filter((tool) => typeof tool === "string") : [],
    }));
    const allowed = [...allowedFunctionNames, ...scope.replyFunctions];
    const content = await client.generateContent({
      role: "router",
      contents: [{ role: "user", parts: [{ text: JSON.stringify({ recentTurns, message: text }) }] }],
      tools: [{ functionDeclarations: [...declarations.flatMap((tool) => tool.functionDeclarations), ...declared] }],
      allowedFunctionNames: allowed,
      signal,
      onUsage,
    });
    const requested = content.parts.filter((part) => part?.functionCall !== undefined).map(({ functionCall }) => functionCall);
    if (requested.length === 0) throw invalid("The router returned no function call.");
    const chosen = requested.filter(({ name }) => replies.has(name));
    if (chosen.length > 1) throw invalid("The router returned more than one reply.");
    const plan = requested.filter(({ name }) => !replies.has(name));
    if (plan.some(({ name }) => !allowedFunctionNames.includes(name))) throw invalid("The router named a function that is not allowed.");
    return {
      calls: plan.map(({ name, args }) => ({ name, args: args ?? {} })),
      ...(chosen.length === 1 && { reply: { code: chosen[0].name, args: chosen[0].args ?? {} } }),
    };
  };
}
