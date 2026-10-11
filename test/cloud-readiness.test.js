import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const configDirectory = new URL("../config/", import.meta.url);
const projectId = "prepagent-hack";

function readConfig(fileName) {
  return JSON.parse(readFileSync(new URL(fileName, configDirectory), "utf8"));
}

test("cloud manifests are valid, target the documented project and remain pending", () => {
  const manifests = [
    "gcp-artifact-registry.json",
    "gcp-cloud-build.json",
    "gcp-cloud-run.json",
    "gcp-dataflow.json",
    "gcp-logging.json",
    "gcp-pubsub.json",
    "gcp-storage.json",
    "gcp-translation.json",
    "gcp-vertex-ai.json",
  ].map(readConfig);

  for (const manifest of manifests) {
    assert.equal(manifest.projectId, projectId);
  }

  const storage = readConfig("gcp-storage.json");
  assert.equal(storage.bucket.name, "prepagent-hack-data");
  assert.equal(storage.bucket.location, "asia-south1");
  assert.equal(storage.billingEnabled, false);
  assert.equal(storage.provisioningStatus, "pending");

  const pubsub = readConfig("gcp-pubsub.json");
  assert.equal(pubsub.topic.name, "sensor-readings");
  assert.equal(pubsub.subscription.name, "sensor-readings-df");
  assert.equal(pubsub.subscription.topic, pubsub.topic.name);
  assert.equal(pubsub.billingEnabled, false);
  assert.equal(pubsub.provisioningStatus, "pending");

  const dataflow = readConfig("gcp-dataflow.json");
  assert.equal(dataflow.region, "asia-south1");
  assert.equal(dataflow.jobStartAuthorized, false);
  assert.equal(dataflow.provisioningStatus, "pending");

  const build = readConfig("gcp-cloud-build.json");
  const registry = readConfig("gcp-artifact-registry.json");
  const run = readConfig("gcp-cloud-run.json");
  assert.equal(build.deploymentEnabled, false);
  assert.equal(registry.repository.location, "asia-south1");
  assert.equal(run.region, "asia-south1");
  assert.equal(run.serviceName, "prepagent");
  assert.equal(run.runtimeServiceAccount, "prepagent-run@prepagent-hack.iam.gserviceaccount.com");
  assert.equal(run.startupCommand, "npm start");
  assert.equal(run.healthEndpoint, "/health");
  assert.ok(run.notes.some((note) => note.includes("Do not enable public unauthenticated access")));

  const vertex = readConfig("gcp-vertex-ai.json");
  assert.equal(vertex.location, "asia-south1");
  assert.equal(vertex.modelCallsEnabled, false);
  assert.equal(vertex.billingEnabled, false);

  const translation = readConfig("gcp-translation.json");
  assert.equal(translation.translationRegion, "us-central1");
  assert.equal(translation.liveTranslationEnabled, false);
  assert.equal(translation.glossary.source, "Om-provided glossary CSV");
  assert.equal(translation.glossary.provisioningStatus, "pending");
});

test("plant seed is a scoped idempotent MERGE and is not executed by local checks", () => {
  const seedSql = readFileSync(new URL("../docs/bigquery-seed-plant.sql", import.meta.url), "utf8");

  assert.match(seedSql, /MERGE `prepagent-hack\.prepagent\.plants` AS target/i);
  assert.match(seedSql, /ON target\.plant_id = source\.plant_id/i);
  assert.match(seedSql, /WHEN MATCHED THEN\s+UPDATE SET/is);
  assert.match(seedSql, /WHEN NOT MATCHED THEN\s+INSERT/is);
  assert.doesNotMatch(seedSql, /\bDELETE\b/i);
  assert.match(seedSql, /'PLANT-01' AS plant_id/);
  assert.match(seedSql, /has not been executed/i);
});
