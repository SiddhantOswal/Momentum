import { readFileSync } from "node:fs";

const vertexConfig = JSON.parse(
  readFileSync(new URL("../config/gcp-vertex-ai.json", import.meta.url), "utf8")
);

const supportedLocations = new Set([vertexConfig.location, "global"]);

export function readVertexTestConfig(env) {
  const projectId =
    typeof env.PROJECT_ID === "string" ? env.PROJECT_ID.trim() : "";
  const model =
    typeof env.GEMINI_MODEL === "string" ? env.GEMINI_MODEL.trim() : "";
  const location =
    typeof env.VERTEX_LOCATION === "string" ? env.VERTEX_LOCATION.trim() : "";

  if (projectId !== vertexConfig.projectId) {
    throw new Error(`PROJECT_ID must be ${vertexConfig.projectId}.`);
  }
  if (!model || model !== vertexConfig.testModel) {
    throw new Error(
      `GEMINI_MODEL must be the verified model ${vertexConfig.testModel}.`
    );
  }
  if (!location || !supportedLocations.has(location)) {
    throw new Error(
      `VERTEX_LOCATION must be ${vertexConfig.location} or global.`
    );
  }

  return {
    projectId,
    model,
    location,
    api: vertexConfig.api,
    apiVersion: vertexConfig.apiVersion,
  };
}
