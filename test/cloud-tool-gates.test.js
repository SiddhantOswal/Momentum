import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  createSimulatedSensorReading,
  DEFAULT_PUBLISH_INTERVAL_MS,
  MAX_PUBLISH_MESSAGES,
  publishUpToLimit,
  readPublisherConfig,
  runPublisher as runPublisherWithPreflight,
} from "../tools/publisher-runtime.mjs";
import { validateReadyResponse } from "../tools/test-gemini.mjs";
import { readVertexTestConfig } from "../tools/vertex-test-config.mjs";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

test("simulated publisher readings match the seasonal BigQuery sensor row contract", () => {
  const reading = createSimulatedSensorReading({
    readingId: "synthetic-reading-1",
    timestamp: "2026-10-11T10:00:00.000Z",
    random: () => 0.5,
  });

  assert.deepEqual(Object.keys(reading).sort(), [
    "ambient_rh_pct",
    "ambient_temp_c",
    "paper_moisture_pct",
    "plant_id",
    "reading_id",
    "source",
    "ts",
  ]);
  assert.deepEqual(reading, {
    reading_id: "synthetic-reading-1",
    ts: "2026-10-11T10:00:00.000Z",
    plant_id: "PLANT-01",
    ambient_rh_pct: 60,
    ambient_temp_c: 25,
    paper_moisture_pct: 8.6,
    source: "simulated",
  });
  assert.equal(JSON.parse(JSON.stringify(reading)).reading_id, "synthetic-reading-1");
});

test("simulated readings follow every Blueprint monthly humidity and temperature band", () => {
  const expected = [
    [0, 40, 20],
    [1, 40, 20],
    [2, 35, 32.5],
    [3, 35, 32.5],
    [4, 35, 32.5],
    [5, 85, 26],
    [6, 85, 26],
    [7, 85, 26],
    [8, 85, 26],
    [9, 60, 25],
    [10, 60, 25],
    [11, 40, 20],
  ];

  for (const [month, humidity, temperature] of expected) {
    const reading = createSimulatedSensorReading({
      readingId: `reading-${month}`,
      timestamp: `2026-${String(month + 1).padStart(2, "0")}-15T10:00:00.000Z`,
      random: () => 0.5,
    });
    assert.equal(reading.ambient_rh_pct, humidity);
    assert.equal(reading.ambient_temp_c, temperature);
    assert.equal(reading.source, "simulated");
  }
});

test("simulated readings use the Pune calendar month at a UTC month boundary", () => {
  const reading = createSimulatedSensorReading({
    readingId: "pune-month-boundary",
    timestamp: "2026-09-30T20:00:00.000Z",
    random: () => 0.5,
  });

  assert.equal(reading.ambient_rh_pct, 60);
  assert.equal(reading.ambient_temp_c, 25);
});

test("simulated paper moisture uses the documented clamp and rejects an invalid timestamp", () => {
  const values = [0, 0, 0.00001, 0.75];
  const reading = createSimulatedSensorReading({
    readingId: "clamped-reading",
    timestamp: "2026-12-15T10:00:00.000Z",
    random: () => values.shift(),
  });

  assert.equal(reading.paper_moisture_pct, 5);
  assert.throws(
    () => createSimulatedSensorReading({
      readingId: "invalid-reading",
      timestamp: "not-a-timestamp",
    }),
    /valid sensor-reading timestamp/
  );
});

function runPublisher(toolPath, envOverrides = {}, args = []) {
  const env = { ...process.env };
  delete env.PUBLISH_SIMULATED_SENSOR_DATA;
  delete env.PUBLISH_MAX_MESSAGES;
  delete env.PUBLISH_INTERVAL_MS;
  delete env.PROJECT_ID;
  delete env.GEMINI_MODEL;
  delete env.VERTEX_LOCATION;
  env.PATH = "";

  return spawnSync(process.execPath, [path.join(repositoryRoot, toolPath), ...args], {
    cwd: repositoryRoot,
    env: { ...env, ...envOverrides },
    encoding: "utf8",
    timeout: 30_000,
  });
}

test("sensor publisher refuses to run without opt-in before cloud preflights", () => {
  const result = runPublisher("tools/publisher.mjs");
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(output, /Refusing to publish/);
  assert.doesNotMatch(output, /BEGIN PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]+/);
});

test("sensor publisher rejects the wrong project before cloud preflights", () => {
  const result = runPublisher("tools/publisher.mjs", {
    PUBLISH_SIMULATED_SENSOR_DATA: "true",
    PUBLISH_MAX_MESSAGES: "1",
    PROJECT_ID: "another-project",
  });
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(output, /PROJECT_ID must be prepagent-hack/);
  assert.doesNotMatch(output, /Required preflight failed|gcloud /);
});

test("sensor publisher rejects missing message limit before cloud preflights", () => {
  const result = runPublisher("tools/publisher.mjs", {
    PUBLISH_SIMULATED_SENSOR_DATA: "true",
    PROJECT_ID: "prepagent-hack",
  });
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(output, /PUBLISH_MAX_MESSAGES must be an integer/);
  assert.doesNotMatch(output, /Required preflight failed|gcloud /);
});

test("sensor publisher rejects invalid message limits before cloud preflights", () => {
  const result = runPublisher("tools/publisher.mjs", {
    PUBLISH_SIMULATED_SENSOR_DATA: "true",
    PUBLISH_MAX_MESSAGES: "1.5",
    PROJECT_ID: "prepagent-hack",
  });
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(output, /PUBLISH_MAX_MESSAGES must be an integer/);
  assert.doesNotMatch(output, /Required preflight failed|gcloud /);
});

test("sensor publisher configuration requires a bounded positive message limit", () => {
  const common = { PUBLISH_SIMULATED_SENSOR_DATA: "true" };
  for (const limit of [undefined, "", "0", "-1", "2.5", "101", "1e2"]) {
    assert.throws(
      () => readPublisherConfig({ ...common, PUBLISH_MAX_MESSAGES: limit }),
      /PUBLISH_MAX_MESSAGES must be an integer/
    );
  }
  assert.equal(
    readPublisherConfig({ ...common, PUBLISH_MAX_MESSAGES: "2" }).intervalMs,
    DEFAULT_PUBLISH_INTERVAL_MS
  );
  assert.equal(
    readPublisherConfig({
      ...common,
      PUBLISH_MAX_MESSAGES: String(MAX_PUBLISH_MESSAGES),
      PUBLISH_INTERVAL_MS: "1000",
    }).intervalMs,
    1000
  );
  assert.throws(
    () =>
      readPublisherConfig({
        ...common,
        PUBLISH_MAX_MESSAGES: "1",
        PUBLISH_INTERVAL_MS: "999",
      }),
    /PUBLISH_INTERVAL_MS must be an integer/
  );
});

test("sensor publisher requires the exact explicit simulated-data opt-in", () => {
  for (const optIn of [undefined, "", "false", "TRUE", "1"]) {
    assert.throws(
      () =>
        readPublisherConfig({
          PUBLISH_SIMULATED_SENSOR_DATA: optIn,
          PUBLISH_MAX_MESSAGES: "1",
        }),
      /Refusing to publish/
    );
  }
});

test("sensor publisher uses a valid narrowly filtered command and proceeds through topic check with a one-message limit", async () => {
  const gcloudCalls = [];
  const steps = [];
  const result = await runPublisherWithPreflight({
    env: {
      PROJECT_ID: "prepagent-hack",
      PUBLISH_SIMULATED_SENSOR_DATA: "true",
      PUBLISH_MAX_MESSAGES: "1",
    },
    projectId: "prepagent-hack",
    topicName: "sensor-readings",
    getGcloudValue: (args) => {
      gcloudCalls.push(args);
      if (args[0] === "config") return "prepagent-hack";
      if (args[0] === "billing") return "true";
      if (args[0] === "services") return "pubsub.googleapis.com";
      throw new Error(`Unexpected gcloud command: ${args.join(" ")}`);
    },
    getTopic: async (name) => {
      steps.push(`topic:${name}`);
      return { name };
    },
    onReady: ({ maxMessages }) => steps.push(`ready:${maxMessages}`),
    publish: async (topic) => steps.push(`publish:${topic.name}`),
    wait: async () => assert.fail("one allowed publication must not wait"),
  });

  assert.deepEqual(gcloudCalls[2], [
    "services",
    "list",
    "--enabled",
    "--project=prepagent-hack",
    "--filter=config.name=pubsub.googleapis.com",
    "--format=value(config.name)",
  ]);
  assert.equal(result, 1);
  assert.deepEqual(steps, [
    "topic:sensor-readings",
    "ready:1",
    "publish:sensor-readings",
  ]);
});

test("sensor publisher stops on a failed API preflight before topic lookup or publication", async () => {
  const gcloudCalls = [];
  let topicLookups = 0;
  let publications = 0;
  await assert.rejects(
    runPublisherWithPreflight({
      env: {
        PROJECT_ID: "prepagent-hack",
        PUBLISH_SIMULATED_SENSOR_DATA: "true",
        PUBLISH_MAX_MESSAGES: "1",
      },
      projectId: "prepagent-hack",
      topicName: "sensor-readings",
      getGcloudValue: (args) => {
        gcloudCalls.push(args);
        if (args[0] === "config") return "prepagent-hack";
        if (args[0] === "billing") return "true";
        if (args[0] === "services") return "";
        throw new Error(`Unexpected gcloud command: ${args.join(" ")}`);
      },
      getTopic: async () => {
        topicLookups += 1;
        return { name: "sensor-readings" };
      },
      publish: async () => {
        publications += 1;
      },
    }),
    /Pub\/Sub API is not enabled/
  );

  assert.deepEqual(gcloudCalls[2].slice(0, 2), ["services", "list"]);
  assert.equal(topicLookups, 0);
  assert.equal(publications, 0);
});

test("sensor publisher enforces opt-in and the one-message limit before cloud preflights", async () => {
  let preflights = 0;
  let publications = 0;
  const dependencies = {
    projectId: "prepagent-hack",
    topicName: "sensor-readings",
    getGcloudValue: (args) => {
      preflights += 1;
      if (args[0] === "billing") return "true";
      if (args[0] === "services") return "pubsub.googleapis.com";
      return "prepagent-hack";
    },
    getTopic: async () => ({ name: "sensor-readings" }),
    publish: async () => {
      publications += 1;
    },
  };

  await assert.rejects(
    runPublisherWithPreflight({
      ...dependencies,
      env: { PROJECT_ID: "prepagent-hack", PUBLISH_MAX_MESSAGES: "1" },
    }),
    /Refusing to publish/
  );
  await assert.rejects(
    runPublisherWithPreflight({
      ...dependencies,
      env: {
        PROJECT_ID: "prepagent-hack",
        PUBLISH_SIMULATED_SENSOR_DATA: "true",
        PUBLISH_MAX_MESSAGES: "0",
      },
    }),
    /PUBLISH_MAX_MESSAGES must be an integer/
  );

  assert.equal(preflights, 0);
  assert.equal(publications, 0);
});

test("sensor publisher stops after the configured number of successful publishes", async () => {
  let publishes = 0;
  let waits = 0;
  const total = await publishUpToLimit({
    maxMessages: 3,
    intervalMs: 1000,
    publish: async () => {
      publishes += 1;
    },
    wait: async () => {
      waits += 1;
    },
  });

  assert.equal(total, 3);
  assert.equal(publishes, 3);
  assert.equal(waits, 2);
});

test("sensor publisher uses the documented 30-second default interval", async () => {
  let waitInterval;
  await publishUpToLimit({
    maxMessages: 2,
    intervalMs: readPublisherConfig({
      PUBLISH_SIMULATED_SENSOR_DATA: "true",
      PUBLISH_MAX_MESSAGES: "2",
    }).intervalMs,
    publish: async () => {},
    wait: async (intervalMs) => {
      waitInterval = intervalMs;
    },
  });

  assert.equal(waitInterval, 30_000);
});

test("sensor publisher does not start another publish after shutdown is requested", async () => {
  const shutdown = new AbortController();
  let publishes = 0;
  const total = await publishUpToLimit({
    maxMessages: 3,
    intervalMs: 1000,
    signal: shutdown.signal,
    publish: async () => {
      publishes += 1;
    },
    wait: async () => {
      shutdown.abort();
    },
  });

  assert.equal(total, 1);
  assert.equal(publishes, 1);
});

test("Gemini utility refuses to run without explicit live-call authorization", () => {
  const result = runPublisher("tools/test-gemini.mjs");
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(output, /Live inference is disabled by default/);
  assert.doesNotMatch(output, /BEGIN PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]+/);
});

test("Gemini utility reports missing configuration before cloud preflights", () => {
  const result = runPublisher(
    "tools/test-gemini.mjs",
    { PROJECT_ID: "prepagent-hack" },
    ["--allow-live-model-call"]
  );
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(output, /GEMINI_MODEL must be the verified model gemini-3\.5-flash/);
  assert.doesNotMatch(output, /Required preflight failed|gcloud /);
  assert.doesNotMatch(output, /BEGIN PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]+/);
});

test("Gemini utility requires an explicitly selected model before cloud preflights", () => {
  const result = runPublisher(
    "tools/test-gemini.mjs",
    { PROJECT_ID: "prepagent-hack", VERTEX_LOCATION: "asia-south1" },
    ["--allow-live-model-call"]
  );
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(output, /GEMINI_MODEL must be the verified model gemini-3\.5-flash/);
  assert.doesNotMatch(output, /Required preflight failed|gcloud /);
});

test("Gemini utility requires an explicitly selected location before cloud preflights", () => {
  const result = runPublisher(
    "tools/test-gemini.mjs",
    { PROJECT_ID: "prepagent-hack", GEMINI_MODEL: "gemini-3.5-flash" },
    ["--allow-live-model-call"]
  );
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(output, /VERTEX_LOCATION must be asia-south1 or global/);
  assert.doesNotMatch(output, /Required preflight failed|gcloud /);
});

test("Vertex test configuration matches the project and documented model locations", () => {
  assert.deepEqual(
    readVertexTestConfig({
      PROJECT_ID: "prepagent-hack",
      GEMINI_MODEL: "gemini-3.5-flash",
      VERTEX_LOCATION: "asia-south1",
    }),
    {
      projectId: "prepagent-hack",
      model: "gemini-3.5-flash",
      location: "asia-south1",
      api: "aiplatform.googleapis.com",
      apiVersion: "v1",
    }
  );
  assert.equal(
    readVertexTestConfig({
      PROJECT_ID: "prepagent-hack",
      GEMINI_MODEL: "gemini-3.5-flash",
      VERTEX_LOCATION: "global",
    }).location,
    "global"
  );
});

test("Vertex test configuration rejects missing or mismatched settings", () => {
  const validConfig = {
    PROJECT_ID: "prepagent-hack",
    GEMINI_MODEL: "gemini-3.5-flash",
    VERTEX_LOCATION: "asia-south1",
  };

  for (const invalidConfig of [
    { ...validConfig, PROJECT_ID: undefined },
    { ...validConfig, PROJECT_ID: "another-project" },
    { ...validConfig, GEMINI_MODEL: undefined },
    { ...validConfig, GEMINI_MODEL: "gemini-2.5-flash" },
    { ...validConfig, GEMINI_MODEL: "operator-selected-model" },
    { ...validConfig, VERTEX_LOCATION: undefined },
    { ...validConfig, VERTEX_LOCATION: "us-central1" },
  ]) {
    assert.throws(() => readVertexTestConfig(invalidConfig));
  }
});

test("Gemini configuration check is offline and does not require live-call opt-in", () => {
  const result = runPublisher(
    "tools/test-gemini.mjs",
    {
      PROJECT_ID: "prepagent-hack",
      GEMINI_MODEL: "gemini-3.5-flash",
      VERTEX_LOCATION: "asia-south1",
    },
    ["--check-config"]
  );

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /project=prepagent-hack/);
  assert.match(result.stdout, /model=gemini-3\.5-flash/);
  assert.match(result.stdout, /location=asia-south1/);
  assert.match(result.stdout, /apiVersion=v1/);
  assert.doesNotMatch(result.stdout, /ready/);
});

test("Gemini response validation accepts only the expected ready response", () => {
  assert.equal(validateReadyResponse("ready"), "ready");
  assert.equal(validateReadyResponse("  READY  "), "ready");
  assert.throws(
    () => validateReadyResponse("ready, here you go"),
    /did not match the required ready result/
  );
  assert.throws(() => validateReadyResponse(undefined), /did not match/);
});

test("importing the Gemini utility does not run preflights or inference", () => {
  const utilityPath = path.join(repositoryRoot, "tools/test-gemini.mjs");
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `await import(${JSON.stringify(utilityPath)})`],
    {
      cwd: repositoryRoot,
      env: { ...process.env, PATH: "" },
      encoding: "utf8",
      timeout: 30_000,
    }
  );

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /gcloud|ready/);
});

test("Gemini utility stops at unavailable local cloud preflight before attempting inference", () => {
  const result = runPublisher(
    "tools/test-gemini.mjs",
    {
      PROJECT_ID: "prepagent-hack",
      GEMINI_MODEL: "gemini-3.5-flash",
      VERTEX_LOCATION: "asia-south1",
    },
    ["--allow-live-model-call"]
  );
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(output, /Required preflight failed: gcloud config/);
  assert.doesNotMatch(output, /ready|BEGIN PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]+/);
});
