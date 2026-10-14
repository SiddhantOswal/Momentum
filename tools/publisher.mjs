import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { PubSub } from "@google-cloud/pubsub";
import {
  createSimulatedSensorReading,
  runPublisher,
} from "./publisher-runtime.mjs";

const projectId = "prepagent-hack";
const topicName = "sensor-readings";

function gcloudValue(args) {
  try {
    return execFileSync("gcloud", args, { encoding: "utf8" }).trim();
  } catch {
    throw new Error(`Required preflight failed: gcloud ${args.join(" ")}.`);
  }
}

const shutdown = new AbortController();
const requestShutdown = () => shutdown.abort();
process.once("SIGINT", requestShutdown);
process.once("SIGTERM", requestShutdown);

try {
  const published = await runPublisher({
    env: process.env,
    projectId,
    topicName,
    getGcloudValue: gcloudValue,
    getTopic: async (name) => {
      const pubsub = new PubSub({ projectId });
      const topic = pubsub.topic(name);
      const [topicExists] = await topic.exists();
      return topicExists ? topic : null;
    },
    onReady: ({ maxMessages, intervalMs }) => {
      console.log(
        `Publishing up to ${maxMessages} simulated sensor readings every ${intervalMs}ms; no plant sensor is connected.`
      );
    },
    signal: shutdown.signal,
    publish: async (topic) => {
      const reading = createSimulatedSensorReading({
        readingId: randomUUID(),
        timestamp: new Date().toISOString(),
      });

      const messageId = await topic.publishMessage({ json: reading });
      console.log(`[SIMULATED] Published sensor message ${messageId} at ${reading.ts}.`);
    },
  });
  console.log(`Stopped after ${published} successful simulated publish(es).`);
} finally {
  process.removeListener("SIGINT", requestShutdown);
  process.removeListener("SIGTERM", requestShutdown);
}
