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

export class VertexGeminiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "VertexGeminiError";
    this.code = code;
  }
}

export function createVertexGeminiClient({
  projectId,
  location = "asia-south1",
  model,
  tokenProvider,
  fetchImpl = fetch,
} = {}) {
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new TypeError("A valid Google Cloud project ID is required.");
  }
  if (typeof location !== "string" || !/^[a-z0-9-]+$/.test(location)) {
    throw new TypeError("A valid Vertex AI location is required.");
  }
  if (typeof model !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(model)) {
    throw new TypeError("A valid Vertex AI model ID is required.");
  }
  if (tokenProvider !== undefined && typeof tokenProvider !== "function") {
    throw new TypeError("Token provider must be a function.");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("Fetch provider must be a function.");
  }

  const provideToken = tokenProvider ?? createCloudRunAccessTokenProvider({ fetchImpl });
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
    `/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;

  return Object.freeze({
    async generateContent({ contents, tools, signal, onUsage } = {}) {
      if (!Array.isArray(contents) || contents.length === 0 ||
          Buffer.byteLength(JSON.stringify({ contents, tools }), "utf8") > 65536 ||
          (tools !== undefined && (!Array.isArray(tools) || tools.length === 0)) ||
          (onUsage !== undefined && typeof onUsage !== "function")) {
        throw new VertexGeminiError("INVALID_GENERATION_REQUEST", "Generation contents or function-calling tools are invalid.");
      }
      const accessToken = await provideToken({ signal });
      if (typeof accessToken !== "string" || accessToken.length === 0) {
        throw new VertexGeminiError("CLOUD_IDENTITY_UNAVAILABLE", "No access token was provided.");
      }
      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            ...(tools === undefined ? {} : {
              tools,
              toolConfig: { functionCallingConfig: { mode: "AUTO" } },
            }),
            generationConfig: { temperature: 0, maxOutputTokens: 2048 },
          }),
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
      reportUsage(onUsage, payload);
      if (!Array.isArray(payload?.candidates?.[0]?.content?.parts)) {
        throw new VertexGeminiError("VERTEX_EMPTY_RESPONSE", "Vertex AI returned no candidate parts.");
      }
      return payload.candidates[0].content;
    },

    async generateJson({ fileUri, mimeType, prompt, responseSchema, signal, onUsage } = {}) {
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
        throw new VertexGeminiError("INVALID_GENERATION_REQUEST", "Vertex AI generation request is invalid.");
      }

      const accessToken = await provideToken({ signal });
      if (typeof accessToken !== "string" || accessToken.length === 0) {
        throw new VertexGeminiError("CLOUD_IDENTITY_UNAVAILABLE", "No cloud access token was provided.");
      }

      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { fileData: { fileUri, mimeType } },
                { text: prompt },
              ],
            }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 2048,
              responseMimeType: "application/json",
              responseSchema,
            },
          }),
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
      reportUsage(onUsage, payload);

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
