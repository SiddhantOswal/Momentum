import { arcModelSettings } from "../arc-model-settings.js";
import { createCloudRunAccessTokenProvider } from "./bigquery-read-client.js";

const USAGE_FIELDS = [
  "promptTokenCount",
  "candidatesTokenCount",
  "totalTokenCount",
  "cachedContentTokenCount",
  "thoughtsTokenCount",
];

function reportUsage(onUsage, payload) {
  if (onUsage === undefined) return;
  const metadata = payload?.usageMetadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return;
  const usage = Object.fromEntries(USAGE_FIELDS
    .filter((field) => Number.isSafeInteger(metadata[field]) && metadata[field] >= 0)
    .map((field) => [field, metadata[field]]));
  if (Object.keys(usage).length > 0) onUsage(Object.freeze(usage));
}

// Gemini 3.x counts thinking tokens against maxOutputTokens, so a long reasoning
// pass can exhaust the budget and return a cut-off fragment as the answer.
const MAX_OUTPUT_TOKENS_LIMIT = 8192;
const MAX_REQUEST_BYTES = 65536;

// Finish reasons that mean a filter withheld the answer (vertex-safety-reference.md section 6).
const SAFETY_FINISH_REASONS = new Set(["SAFETY", "PROHIBITED_CONTENT", "SPII", "BLOCKLIST", "MODEL_ARMOR", "IMAGE_SAFETY"]);
const TOOL_FINISH_REASONS = new Set(["MALFORMED_FUNCTION_CALL", "UNEXPECTED_TOOL_CALL", "TOO_MANY_TOOL_CALLS"]);
const ENUM_VALUE = /^[A-Z][A-Z0-9_]{0,63}$/;

function blockedCategories(ratings) {
  return Array.isArray(ratings)
    ? ratings.filter((rating) => rating?.blocked === true && ENUM_VALUE.test(rating.category ?? ""))
      .map((rating) => rating.category)
    : [];
}

// A blocked prompt has no candidates and a blocked answer has no content, so both
// would otherwise look like an empty response. They are reported as blocks instead.
function assertNotBlocked(payload) {
  const blockReason = payload?.promptFeedback?.blockReason;
  if (blockReason !== undefined) {
    throw new VertexGeminiError("GEMINI_SAFETY_BLOCKED", "Gemini blocked the request under its safety settings.", {
      blockedAt: "prompt",
      reason: ENUM_VALUE.test(blockReason) ? blockReason : "UNKNOWN",
      categories: blockedCategories(payload.promptFeedback.safetyRatings),
    });
  }
  const candidate = payload?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  if (SAFETY_FINISH_REASONS.has(finishReason)) {
    throw new VertexGeminiError("GEMINI_SAFETY_BLOCKED", "Gemini withheld its answer under its safety settings.", {
      blockedAt: "response", reason: finishReason, categories: blockedCategories(candidate.safetyRatings),
    });
  }
  if (finishReason === "RECITATION") {
    throw new VertexGeminiError("GEMINI_RESPONSE_BLOCKED", "Gemini withheld its answer because it recited source material.", {
      blockedAt: "response", reason: finishReason, categories: [],
    });
  }
  if (TOOL_FINISH_REASONS.has(finishReason)) {
    throw new VertexGeminiError("GEMINI_TOOL_CALL_INVALID", "Gemini returned a function call that could not be used.", {
      reason: finishReason,
    });
  }
}

function assertComplete(payload) {
  if (payload?.candidates?.[0]?.finishReason === "MAX_TOKENS") {
    throw new VertexGeminiError("VERTEX_OUTPUT_TRUNCATED", "Vertex AI stopped at the output token limit before completing its answer.");
  }
}

export class VertexGeminiError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "VertexGeminiError";
    this.code = code;
    if (detail !== undefined) this.detail = Object.freeze(detail);
  }
}

function invalidRequest(message = "Generation contents or function-calling tools are invalid.") {
  return new VertexGeminiError("INVALID_GENERATION_REQUEST", message);
}

function declaredFunctionNames(tools) {
  return new Set(tools.flatMap((tool) => Array.isArray(tool?.functionDeclarations)
    ? tool.functionDeclarations.map((declaration) => declaration?.name)
    : []));
}

function toolConfigFor(roleSettings, tools, allowedFunctionNames) {
  if (tools === undefined) {
    if (allowedFunctionNames !== undefined) throw invalidRequest();
    return undefined;
  }
  const mode = roleSettings.functionCallingMode;
  if (mode === null) throw invalidRequest("This model role does not accept function-calling tools.");
  if (mode !== "ANY") {
    if (allowedFunctionNames !== undefined) throw invalidRequest("Allowed function names apply only to mode ANY.");
    return { functionCallingConfig: { mode } };
  }
  const declared = declaredFunctionNames(tools);
  if (!Array.isArray(allowedFunctionNames) || allowedFunctionNames.length === 0 ||
      allowedFunctionNames.some((name) => typeof name !== "string" || !declared.has(name))) {
    throw invalidRequest("Mode ANY needs allowed function names taken from the declared tools.");
  }
  return { functionCallingConfig: { mode, allowedFunctionNames: [...allowedFunctionNames] } };
}

function generationConfigFor(roleSettings, maxOutputTokens, extra = {}) {
  return {
    ...(roleSettings.temperature === null ? {} : { temperature: roleSettings.temperature }),
    maxOutputTokens,
    ...extra,
    thinkingConfig: { thinkingLevel: roleSettings.thinkingLevel, includeThoughts: roleSettings.includeThoughts },
  };
}

export function createVertexGeminiClient({
  projectId,
  location,
  model,
  tokenProvider,
  fetchImpl = fetch,
  settings = arcModelSettings,
} = {}) {
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new TypeError("A valid Google Cloud project ID is required.");
  }
  if (location !== undefined && (typeof location !== "string" || !/^[a-z0-9-]+$/.test(location))) {
    throw new TypeError("A valid Vertex AI location is required.");
  }
  if (model !== undefined && (typeof model !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(model))) {
    throw new TypeError("A valid Vertex AI model ID is required.");
  }
  if (tokenProvider !== undefined && typeof tokenProvider !== "function") {
    throw new TypeError("Token provider must be a function.");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("Fetch provider must be a function.");
  }
  if (!settings || typeof settings.version !== "string" || !Array.isArray(settings.safetySettings) ||
      settings.safetySettings.length === 0 || !settings.roles || typeof settings.roles !== "object") {
    throw new TypeError("Versioned model settings with safety settings are required.");
  }

  const provideToken = tokenProvider ?? createCloudRunAccessTokenProvider({ fetchImpl });

  function roleSettingsFor(role) {
    if (typeof role !== "string" || !Object.hasOwn(settings.roles, role)) {
      throw invalidRequest("A configured model role is required for every Gemini request.");
    }
    return settings.roles[role];
  }

  // A constructor model or location overrides the role's configured value, so the
  // GEMINI_MODEL and VERTEX_LOCATION environment overrides keep working.
  function endpointFor(roleSettings) {
    const callModel = model ?? roleSettings.model;
    const callLocation = location ?? roleSettings.location;
    return `https://${callLocation}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
      `/locations/${encodeURIComponent(callLocation)}/publishers/google/models/${encodeURIComponent(callModel)}:generateContent`;
  }

  // Every request goes through here, so none can leave without the configured safety settings.
  function requestBody(roleSettings, fields) {
    return {
      ...fields,
      ...(roleSettings.systemInstruction === null ? {} : {
        systemInstruction: { parts: [{ text: roleSettings.systemInstruction }] },
      }),
      safetySettings: settings.safetySettings.map((setting) => ({ ...setting })),
    };
  }

  async function post(roleSettings, body, signal) {
    const accessToken = await provideToken({ signal });
    if (typeof accessToken !== "string" || accessToken.length === 0) {
      throw new VertexGeminiError("CLOUD_IDENTITY_UNAVAILABLE", "No access token was provided.");
    }
    let response;
    try {
      response = await fetchImpl(endpointFor(roleSettings), {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new VertexGeminiError("VERTEX_UNAVAILABLE", "Vertex AI could not be reached.");
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new VertexGeminiError("VERTEX_INVALID_RESPONSE", "Vertex AI returned an invalid response.");
    }
    if (!response.ok || payload?.error) {
      throw new VertexGeminiError("VERTEX_GENERATION_FAILED", "The Vertex AI request failed.");
    }
    return payload;
  }

  return Object.freeze({
    settingsVersion: settings.version,

    async generateContent({ role, contents, tools, allowedFunctionNames, signal, onUsage, maxOutputTokens } = {}) {
      const roleSettings = roleSettingsFor(role);
      const outputLimit = maxOutputTokens === undefined ? roleSettings.maxOutputTokens : maxOutputTokens;
      if (!Array.isArray(contents) || contents.length === 0 ||
          (tools !== undefined && (!Array.isArray(tools) || tools.length === 0)) ||
          !Number.isInteger(outputLimit) || outputLimit < 1 || outputLimit > MAX_OUTPUT_TOKENS_LIMIT ||
          (onUsage !== undefined && typeof onUsage !== "function")) {
        throw invalidRequest();
      }
      const toolConfig = toolConfigFor(roleSettings, tools, allowedFunctionNames);
      const body = requestBody(roleSettings, {
        contents,
        ...(tools === undefined ? {} : { tools, toolConfig }),
        generationConfig: generationConfigFor(roleSettings, outputLimit),
      });
      if (Buffer.byteLength(JSON.stringify({ contents, tools, systemInstruction: body.systemInstruction }), "utf8") > MAX_REQUEST_BYTES) {
        throw invalidRequest();
      }
      const payload = await post(roleSettings, body, signal);
      reportUsage(onUsage, payload);
      assertNotBlocked(payload);
      assertComplete(payload);
      if (!Array.isArray(payload?.candidates?.[0]?.content?.parts)) {
        throw new VertexGeminiError("VERTEX_EMPTY_RESPONSE", "Vertex AI returned no candidate parts.");
      }
      return payload.candidates[0].content;
    },

    async generateJson({ role, fileUri, mimeType, prompt, responseSchema, signal, onUsage } = {}) {
      const roleSettings = roleSettingsFor(role);
      const uriMatch = typeof fileUri === "string"
        ? fileUri.match(/^gs:\/\/([a-z0-9][a-z0-9._-]*)\/(.+)$/)
        : undefined;
      if (!uriMatch || uriMatch[2].split("/").some((part) => part === "" || part === "." || part === "..") ||
          !/^[A-Za-z0-9._/-]+$/.test(uriMatch[2])) {
        throw new VertexGeminiError("INVALID_FILE_URI", "Vertex AI file URI is invalid.");
      }
      if (typeof mimeType !== "string" || !/^[\w.+-]+\/[\w.+-]+$/.test(mimeType) ||
          typeof prompt !== "string" || prompt.length === 0 || prompt.length > 12000 ||
          responseSchema === null || typeof responseSchema !== "object" ||
          Buffer.byteLength(JSON.stringify(responseSchema), "utf8") > 16384 ||
          (onUsage !== undefined && typeof onUsage !== "function")) {
        throw invalidRequest("Vertex AI generation request is invalid.");
      }

      const payload = await post(roleSettings, requestBody(roleSettings, {
        contents: [{
          role: "user",
          parts: [
            { fileData: { fileUri, mimeType } },
            { text: prompt },
          ],
        }],
        generationConfig: generationConfigFor(roleSettings, roleSettings.maxOutputTokens, {
          responseMimeType: "application/json",
          responseSchema,
        }),
      }), signal);
      reportUsage(onUsage, payload);
      assertNotBlocked(payload);
      assertComplete(payload);

      const text = payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .filter((part) => typeof part === "string")
        .join("");
      if (!text) {
        throw new VertexGeminiError("VERTEX_EMPTY_RESPONSE", "Vertex AI returned no structured content.");
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new VertexGeminiError("VERTEX_INVALID_JSON", "Vertex AI returned invalid structured JSON.");
      }
    },
  });
}
