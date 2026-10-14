import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readVertexTestConfig } from "./vertex-test-config.mjs";

const confirmationFlag = "--allow-live-model-call";
const configCheckFlag = "--check-config";
const responseTimeoutMs = 30_000;

export function validateReadyResponse(responseText) {
  if (typeof responseText !== "string" || responseText.trim().toLowerCase() !== "ready") {
    throw new Error("Gemini response did not match the required ready result.");
  }
  return "ready";
}

function sanitizedErrorMessage(error) {
  const message = error instanceof Error ? error.message : "Unknown request error.";
  return message
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]")
    .replace(/ya29\.[0-9A-Za-z_-]+/g, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(
      /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g,
      "[REDACTED KEY]"
    )
    .slice(0, 1000);
}

function gcloudValue(args) {
  try {
    return execFileSync("gcloud", args, { encoding: "utf8" }).trim();
  } catch {
    throw new Error(`Required preflight failed: gcloud ${args[0]}.`);
  }
}

function gcloudCheck(args) {
  try {
    execFileSync("gcloud", args, { stdio: "ignore" });
  } catch {
    throw new Error(`Required preflight failed: gcloud ${args[0]}.`);
  }
}

async function runLiveTest() {
  if (process.argv.includes(configCheckFlag)) {
    const config = readVertexTestConfig(process.env);
    console.log(
      `Vertex test configuration valid: project=${config.projectId}, model=${config.model}, location=${config.location}, apiVersion=${config.apiVersion}.`
    );
    return;
  }

  if (!process.argv.includes(confirmationFlag)) {
    throw new Error(
      `Live inference is disabled by default. Re-run with ${confirmationFlag} only when an explicitly authorized Vertex AI test is intended.`
    );
  }

  const config = readVertexTestConfig(process.env);
  if (gcloudValue(["config", "get-value", "project"]) !== config.projectId) {
    throw new Error(
      `Select the ${config.projectId} project before testing Vertex AI.`
    );
  }
  if (
    gcloudValue([
      "billing",
      "projects",
      "describe",
      config.projectId,
      "--format=value(billingEnabled)",
    ]).toLowerCase() !== "true"
  ) {
    throw new Error("Live inference is disabled until project billing is enabled.");
  }
  if (
    gcloudValue([
      "services",
      "list",
      "--enabled",
      `--project=${config.projectId}`,
      `--filter=config.name=${config.api}`,
      "--format=value(config.name)",
    ]) !== config.api
  ) {
    throw new Error("Vertex AI API is not enabled for the target project.");
  }
  gcloudCheck(["auth", "application-default", "print-access-token"]);

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({
    vertexai: true,
    project: config.projectId,
    location: config.location,
    apiVersion: config.apiVersion,
  });
  let response;
  try {
    response = await ai.models.generateContent({
      model: config.model,
      contents: "Return exactly the single lowercase word ready, with no punctuation or other text.",
      config: { abortSignal: AbortSignal.timeout(responseTimeoutMs) },
    });
  } catch (error) {
    throw new Error(`Vertex AI generateContent failed: ${sanitizedErrorMessage(error)}`);
  }

  console.log(`Gemini test successful: ${validateReadyResponse(response.text)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runLiveTest();
}
