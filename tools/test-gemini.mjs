import { execFileSync } from "node:child_process";
import { GoogleGenAI } from "@google/genai";

const projectId = "prepagent-hack";
const confirmationFlag = "--allow-live-model-call";

function gcloudValue(args) {
  try {
    return execFileSync("gcloud", args, { encoding: "utf8" }).trim();
  } catch {
    throw new Error(`Required preflight failed: gcloud ${args[0]}.`);
  }
}

if (!process.argv.includes(confirmationFlag)) {
  throw new Error(
    `Live inference is disabled by default. Re-run with ${confirmationFlag} only when an explicitly authorized Vertex AI test is intended.`
  );
}
if (process.env.PROJECT_ID !== projectId) {
  throw new Error(`PROJECT_ID must be ${projectId}.`);
}
if (!process.env.GEMINI_MODEL || !process.env.VERTEX_LOCATION) {
  throw new Error("Set GEMINI_MODEL and VERTEX_LOCATION before the live test.");
}
if (gcloudValue(["config", "get-value", "project"]) !== projectId) {
  throw new Error(`Select the ${projectId} project before testing Vertex AI.`);
}
if (
  gcloudValue([
    "billing",
    "projects",
    "describe",
    projectId,
    "--format=value(billingEnabled)",
  ]).toLowerCase() !== "true"
) {
  throw new Error("Live inference is disabled until project billing is enabled.");
}
if (
  gcloudValue([
    "services",
    "describe",
    "aiplatform.googleapis.com",
    `--project=${projectId}`,
    "--format=value(state)",
  ]) !== "ENABLED"
) {
  throw new Error("Vertex AI API is not enabled for the target project.");
}
if (
  !gcloudValue(["auth", "application-default", "print-access-token"])
) {
  throw new Error("Application Default Credentials are unavailable.");
}

const ai = new GoogleGenAI({
  vertexai: true,
  project: projectId,
  location: process.env.VERTEX_LOCATION,
});
const response = await ai.models.generateContent({
  model: process.env.GEMINI_MODEL,
  contents: "Reply with one word: ready",
});

console.log(response.text?.trim() ?? "(no response text)");
