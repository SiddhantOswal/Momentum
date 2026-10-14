import { SensorReadingRowSchema } from "../src/schemas.js";

export const DEFAULT_PUBLISH_INTERVAL_MS = 30_000;
export const MAX_PUBLISH_MESSAGES = 100;
export const MIN_PUBLISH_INTERVAL_MS = 1_000;

function seasonForMonth(month) {
  if (month >= 5 && month <= 8) return { humidity: [75, 95], temperature: [22, 30] };
  if (month === 9 || month === 10) return { humidity: [50, 70], temperature: [18, 32] };
  if (month === 11 || month <= 1) return { humidity: [30, 50], temperature: [10, 30] };
  return { humidity: [25, 45], temperature: [25, 40] };
}

function sampleNormal(random) {
  const first = random();
  const second = random();
  if (![first, second].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
    throw new TypeError("The sensor reading random source must return values from 0 to 1.");
  }

  const nonZeroFirst = Math.max(Number.EPSILON, first);
  return Math.sqrt(-2 * Math.log(nonZeroFirst)) * Math.sin(2 * Math.PI * second);
}

export function createSimulatedSensorReading({
  readingId,
  timestamp,
  plantId = "PLANT-01",
  random = Math.random,
}) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError("A valid sensor-reading timestamp is required.");
  }

  const puneMonth = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Kolkata",
      month: "numeric",
    }).format(date)
  ) - 1;
  const season = seasonForMonth(puneMonth);
  const humiditySample = random();
  const temperatureSample = random();
  if (![humiditySample, temperatureSample].every(
    (value) => Number.isFinite(value) && value >= 0 && value <= 1
  )) {
    throw new TypeError("The sensor reading random source must return values from 0 to 1.");
  }

  const rh = season.humidity[0] + humiditySample * (season.humidity[1] - season.humidity[0]);
  const temperature = season.temperature[0] +
    temperatureSample * (season.temperature[1] - season.temperature[0]);
  const paperMoisture = Math.min(12, Math.max(5, 3.5 + 0.085 * rh + 0.6 * sampleNormal(random)));

  return SensorReadingRowSchema.parse({
    reading_id: readingId,
    ts: timestamp,
    plant_id: plantId,
    ambient_rh_pct: Number(rh.toFixed(1)),
    ambient_temp_c: Number(temperature.toFixed(1)),
    paper_moisture_pct: Number(paperMoisture.toFixed(2)),
    source: "simulated",
  });
}

export function readPublisherConfig(env) {
  if (env.PUBLISH_SIMULATED_SENSOR_DATA !== "true") {
    throw new Error(
      "Refusing to publish. Set PUBLISH_SIMULATED_SENSOR_DATA=true only when intentionally testing the simulated sensor stream."
    );
  }

  const maxMessages = /^\d+$/.test(env.PUBLISH_MAX_MESSAGES ?? "")
    ? Number(env.PUBLISH_MAX_MESSAGES)
    : NaN;
  if (
    !env.PUBLISH_MAX_MESSAGES ||
    !Number.isInteger(maxMessages) ||
    maxMessages < 1 ||
    maxMessages > MAX_PUBLISH_MESSAGES
  ) {
    throw new Error(
      `PUBLISH_MAX_MESSAGES must be an integer from 1 to ${MAX_PUBLISH_MESSAGES}.`
    );
  }

  let intervalMs = DEFAULT_PUBLISH_INTERVAL_MS;
  if (env.PUBLISH_INTERVAL_MS !== undefined) {
    intervalMs = /^\d+$/.test(env.PUBLISH_INTERVAL_MS)
      ? Number(env.PUBLISH_INTERVAL_MS)
      : NaN;
    if (
      !Number.isInteger(intervalMs) ||
      intervalMs < MIN_PUBLISH_INTERVAL_MS ||
      intervalMs > DEFAULT_PUBLISH_INTERVAL_MS
    ) {
      throw new Error(
        `PUBLISH_INTERVAL_MS must be an integer from ${MIN_PUBLISH_INTERVAL_MS} to ${DEFAULT_PUBLISH_INTERVAL_MS}.`
      );
    }
  }

  return { maxMessages, intervalMs };
}

export async function runPublisher({
  env,
  projectId,
  topicName,
  getGcloudValue,
  getTopic,
  publish,
  onReady,
  wait,
  signal,
}) {
  const { maxMessages, intervalMs } = readPublisherConfig(env);
  if (env.PROJECT_ID !== projectId) {
    throw new Error(`PROJECT_ID must be ${projectId}.`);
  }
  if (getGcloudValue(["config", "get-value", "project"]) !== projectId) {
    throw new Error(`Select the ${projectId} project before publishing.`);
  }
  if (
    getGcloudValue([
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
    getGcloudValue([
      "services",
      "list",
      "--enabled",
      `--project=${projectId}`,
      "--filter=config.name=pubsub.googleapis.com",
      "--format=value(config.name)",
    ]) !== "pubsub.googleapis.com"
  ) {
    throw new Error("Pub/Sub API is not enabled for the target project.");
  }

  const topic = await getTopic(topicName);
  if (!topic) {
    throw new Error(`Pub/Sub topic ${topicName} does not exist.`);
  }

  onReady?.({ maxMessages, intervalMs });
  return publishUpToLimit({
    maxMessages,
    intervalMs,
    signal,
    wait,
    publish: () => publish(topic),
  });
}

export function waitForInterval(intervalMs, signal) {
  if (signal?.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, intervalMs);
    signal?.addEventListener("abort", finish, { once: true });
  });
}

export async function publishUpToLimit({
  maxMessages,
  intervalMs,
  publish,
  wait = waitForInterval,
  signal,
}) {
  let published = 0;

  while (published < maxMessages && !signal?.aborted) {
    await publish();
    published += 1;

    if (published < maxMessages && !signal?.aborted) {
      await wait(intervalMs, signal);
    }
  }

  return published;
}
