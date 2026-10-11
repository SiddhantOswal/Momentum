import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { PubSub } from "@google-cloud/pubsub";

const projectId = "prepagent-hack";
const topicName = "sensor-readings";

function gcloudValue(args) {
  try {
    return execFileSync("gcloud", args, { encoding: "utf8" }).trim();
  } catch {
    throw new Error(`Required preflight failed: gcloud ${args[0]}.`);
  }
}

if (process.env.PUBLISH_SIMULATED_SENSOR_DATA !== "true") {
  throw new Error(
    "Refusing to publish. Set PUBLISH_SIMULATED_SENSOR_DATA=true only when intentionally testing the simulated sensor stream."
  );
}
if (process.env.PROJECT_ID !== projectId) {
  throw new Error(`PROJECT_ID must be ${projectId}.`);
}
if (gcloudValue(["config", "get-value", "project"]) !== projectId) {
  throw new Error(`Select the ${projectId} project before publishing.`);
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
  throw new Error("Publishing is disabled until project billing is enabled.");
}
if (
  gcloudValue([
    "services",
    "describe",
    "pubsub.googleapis.com",
    `--project=${projectId}`,
    "--format=value(state)",
  ]) !== "ENABLED"
) {
  throw new Error("Pub/Sub API is not enabled for the target project.");
}

const pubsub = new PubSub({ projectId });
const topic = pubsub.topic(topicName);
const [topicExists] = await topic.exists();
if (!topicExists) {
  throw new Error(`Pub/Sub topic ${topicName} does not exist.`);
}

console.log("Publishing simulated sensor readings every 30 seconds; no plant sensor is connected.");
let stopped = false;
process.once("SIGINT", () => {
  stopped = true;
});
process.once("SIGTERM", () => {
  stopped = true;
});

while (!stopped) {
  const rh = 80 + Math.random() * 10;
  const reading = {
    reading_id: randomUUID(),
    ts: new Date().toISOString(),
    plant_id: "PLANT-01",
    ambient_rh_pct: Number(rh.toFixed(1)),
    ambient_temp_c: Number((24 + Math.random() * 4).toFixed(1)),
    paper_moisture_pct: Number(
      (3.5 + 0.085 * rh + (Math.random() - 0.5)).toFixed(2)
    ),
  };

  const messageId = await topic.publishMessage({ json: reading });
  console.log(`[SIMULATED] Published sensor message ${messageId} at ${reading.ts}.`);
  await new Promise((resolve) => setTimeout(resolve, 30_000));
}
