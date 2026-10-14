import { AGENT_TOOLS } from "../trace-registry.js";

const MAX_ROUNDS = 8;
const MAX_TOOL_CALLS = 12;
const MAX_TOOL_RESULT_BYTES = 256 * 1024;
const TRACE_ERROR_CODES = new Set([
  "TOOL_ERROR", "SERVICE_UNAVAILABLE", "VALIDATION_ERROR", "TIMEOUT", "CANCELLED",
]);

function normalizedToolResult(result) {
  if (result === undefined) {
    return { ok: false, error: { code: "TOOL_ERROR", message: "Tool returned no result." } };
  }
  const encoded = JSON.stringify({ result });
  if (typeof encoded !== "string" || Buffer.byteLength(encoded, "utf8") > MAX_TOOL_RESULT_BYTES) {
    return { ok: false, error: { code: "TOOL_ERROR", message: "Tool output exceeded the allowed response size." } };
  }
  return result;
}

function traceErrorCode(error) {
  const code = error?.error?.code ?? error?.code;
  return TRACE_ERROR_CODES.has(code) ? code : "TOOL_ERROR";
}

function assertFunctionCall(part) {
  const call = part?.functionCall;
  if (!call || typeof call.name !== "string" || !call.name ||
      call.args === null || typeof call.args !== "object" || Array.isArray(call.args)) {
    throw new TypeError("Gemini returned an invalid function call.");
  }
  return call;
}

export function createGeminiFunctionRunner({ gemini, traceRegistry, tools } = {}) {
  if (!gemini || typeof gemini.generateContent !== "function") {
    throw new TypeError("A Vertex Gemini function-calling client is required.");
  }
  if (!traceRegistry || typeof traceRegistry.startRun !== "function" ||
      typeof traceRegistry.startTool !== "function" || typeof traceRegistry.finishTool !== "function" ||
      typeof traceRegistry.finishRun !== "function") {
    throw new TypeError("A trace registry is required.");
  }
  if (!tools || typeof tools !== "object" || Array.isArray(tools) ||
      AGENT_TOOLS.some((name) => !tools[name] || typeof tools[name].execute !== "function" ||
        typeof tools[name].description !== "string" || !tools[name].parameters)) {
    throw new TypeError("All seven Blueprint agent tools must have descriptions, parameter schemas, and handlers.");
  }

  const declarations = [{
    functionDeclarations: AGENT_TOOLS.map((name) => ({
      name,
      description: tools[name].description,
      parameters: tools[name].parameters,
    })),
  }];

  return async function run({ contents, signal } = {}) {
    if (!Array.isArray(contents) || contents.length === 0) {
      throw new TypeError("Gemini conversation contents are required.");
    }
    const runId = traceRegistry.startRun();
    const conversation = [...contents];
    let callCount = 0;

    try {
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const modelContent = await gemini.generateContent({ contents: conversation, tools: declarations, signal });
        const parts = modelContent?.parts;
        if (!Array.isArray(parts) || parts.length === 0) {
          throw new TypeError("Gemini returned an empty response.");
        }
        const calls = parts.filter((part) => part?.functionCall !== undefined);
        if (calls.length === 0) {
          const text = parts.map((part) => part.text).filter((value) => typeof value === "string").join("");
          if (!text) throw new TypeError("Gemini returned neither text nor a function call.");
          traceRegistry.finishRun(runId, "completed");
          return Object.freeze({ runId, text });
        }
        if (callCount + calls.length > MAX_TOOL_CALLS) {
          throw new TypeError("Gemini exceeded the tool-call limit for this run.");
        }
        conversation.push(modelContent);
        const functionResponses = [];
        for (const part of calls) {
          const call = assertFunctionCall(part);
          if (!AGENT_TOOLS.includes(call.name)) throw new TypeError("Gemini requested a tool outside the Blueprint registry.");
          const started = traceRegistry.startTool(runId, call.name);
          const traceCallId = started.toolCallId ?? started.toolCall?.toolCallId;
          if (typeof traceCallId !== "string") throw new TypeError("Trace registry did not return a tool call ID.");
          let result;
          let outcome = "succeeded";
          let errorCode;
          try {
            result = normalizedToolResult(await tools[call.name].execute(call.args, { signal, runId }));
            if (result?.ok === false) {
              outcome = result.error?.code === "SERVICE_UNAVAILABLE" ? "unavailable" : "failed";
              errorCode = traceErrorCode(result);
            }
          } catch (error) {
            outcome = error?.name === "AbortError" ? "failed" : "failed";
            errorCode = error?.name === "AbortError" ? "CANCELLED" : traceErrorCode(error);
            result = {
              ok: false,
              error: {
                code: errorCode,
                message: error?.name === "AbortError" ? "Tool execution was cancelled." : "Tool execution failed.",
              },
            };
          }
          traceRegistry.finishTool(runId, traceCallId, outcome, errorCode);
          callCount += 1;
          functionResponses.push({
            functionResponse: {
              name: call.name,
              ...(typeof call.id === "string" ? { id: call.id } : {}),
              response: { result },
            },
          });
        }
        conversation.push({ role: "user", parts: functionResponses });
      }
      throw new TypeError("Gemini exceeded the function-calling round limit.");
    } catch (error) {
      const outcome = error?.name === "AbortError" || signal?.aborted ? "cancelled" : "failed";
      try {
        traceRegistry.finishRun(runId, outcome);
      } catch {
        // Preserve the original execution error if trace cleanup itself fails.
      }
      throw error;
    }
  };
}

export { MAX_ROUNDS, MAX_TOOL_CALLS, MAX_TOOL_RESULT_BYTES };
