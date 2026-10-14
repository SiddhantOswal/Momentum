import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PlantRowSchema } from "../src/schemas.js";

const configDirectory = new URL("../config/", import.meta.url);
const projectId = "prepagent-hack";
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const appSource = readFileSync(new URL("../index.mjs", import.meta.url), "utf8");

function readConfig(fileName) {
  return JSON.parse(readFileSync(new URL(fileName, configDirectory), "utf8"));
}

test("cloud manifests distinguish verified prerequisites from pending operations", () => {
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
  assert.equal(storage.bucket.uniformBucketLevelAccess, true);
  assert.equal(storage.billingEnabled, true);
  assert.equal(storage.provisioningStatus, "verified");

  const pubsub = readConfig("gcp-pubsub.json");
  assert.equal(pubsub.region, "asia-south1");
  assert.equal(pubsub.topic.name, "sensor-readings");
  assert.equal(pubsub.subscription.name, "sensor-readings-df");
  assert.equal(pubsub.subscription.topic, pubsub.topic.name);
  assert.deepEqual(pubsub.bigQuerySubscription, {
    name: "sensor-readings-bq",
    topic: "sensor-readings",
    destinationTable: "prepagent-hack.prepagent.sensor_readings",
    useTableSchema: true,
    state: "ACTIVE",
    sourceField: "source",
    expectedSourceValue: "simulated",
    liveIngestionVerified: false,
  });
  assert.equal(pubsub.publisherServiceAccount, "prepagent-run@prepagent-hack.iam.gserviceaccount.com");
  assert.equal(pubsub.requiredPublisherRole, "roles/pubsub.publisher");
  assert.equal(pubsub.billingEnabled, true);
  assert.equal(pubsub.apiStatus, "verified-enabled");
  assert.equal(pubsub.provisioningStatus, "verified");

  const dataflow = readConfig("gcp-dataflow.json");
  assert.equal(dataflow.region, "asia-south1");
  assert.equal(dataflow.workerServiceAccount, "514663464609-compute@developer.gserviceaccount.com");
  assert.deepEqual(dataflow.requiredWorkerRoles, [
    "roles/dataflow.worker",
    "roles/bigquery.dataEditor",
    "roles/pubsub.subscriber",
    "roles/storage.objectAdmin",
  ]);
  assert.equal(dataflow.requiredWorkerRoleScope, "project:prepagent-hack (per Playbook §2.11)");
  assert.equal(dataflow.workerIamStatus, "verified");
  assert.deepEqual(dataflow.dataflowServiceAgent, {
    principal: "service-514663464609@dataflow-service-producer-prod.iam.gserviceaccount.com",
    requiredRole: "roles/dataflow.serviceAgent",
    requiredRoleScope: "project:prepagent-hack",
    bindingStatus: "verified",
    accountDescribeStatus: "permission-denied",
  });
  assert.equal(dataflow.job.name, "sensor-to-bq");
  assert.equal(dataflow.job.template, "PubSub_Subscription_to_BigQuery");
  assert.equal(
    dataflow.job.templateGcsLocation,
    "gs://dataflow-templates-asia-south1/2026-09-29-00_RC02/PubSub_Subscription_to_BigQuery",
  );
  assert.equal(dataflow.job.stagingLocation, `gs://${storage.bucket.name}/tmp`);
  assert.deepEqual(dataflow.job.runtimeEnvironment, {
    serviceAccountEmail: dataflow.workerServiceAccount,
    machineType: "n1-standard-2",
    numWorkers: 1,
    maxWorkers: 1,
    diskSizeGb: 30,
    enableStreamingEngine: false,
    streamingMode: "STREAMING_MODE_EXACTLY_ONCE",
    tempLocation: dataflow.job.stagingLocation,
  });
  assert.equal(
    dataflow.job.parameters.inputSubscription,
    `projects/${projectId}/subscriptions/${pubsub.subscription.name}`,
  );
  assert.equal(dataflow.job.parameters.outputTableSpec, `${projectId}:prepagent.sensor_readings`);
  assert.equal(
    dataflow.job.parameters.outputDeadletterTable,
    `${projectId}:prepagent.sensor_readings_error_records`,
  );
  assert.equal(dataflow.cleanup.listActiveJobsCommand, "gcloud dataflow jobs list --region asia-south1 --status=active");
  assert.equal(dataflow.cleanup.drainJobCommand, "gcloud dataflow jobs drain JOB_ID --region asia-south1");
  assert.equal(
    dataflow.cleanup.verifyNoActiveJobsCommand,
    dataflow.cleanup.listActiveJobsCommand,
  );
  assert.equal(dataflow.jobStartAuthorized, false);
  assert.equal(dataflow.provisioningStatus, "pending");
  assert.equal(dataflow.billingEnabled, true);
  assert.ok(dataflow.notes.some((note) => /does not authorize a Dataflow job/i.test(note)));
  assert.ok(dataflow.notes.some((note) => /four Playbook-documented worker roles were explicitly authorized/i.test(note)));
  assert.ok(dataflow.notes.some((note) => /Dataflow service agent has the project-level/i.test(note)));
  assert.ok(dataflow.notes.some((note) => /Effective `storage.objects.create` was not confirmed/i.test(note)));
  assert.ok(dataflow.notes.some((note) => /auto-creates the absent table during execution if needed/i.test(note)));
  assert.ok(dataflow.notes.some((note) => /30 GiB disk, Streaming Engine disabled/i.test(note)));
  assert.ok(dataflow.notes.some((note) => /Modeled 15-minute total is about ₹10\.65/i.test(note)));
  assert.ok(dataflow.notes.some((note) => /no enforced shutdown\/billing cap exists/i.test(note)));
  assert.ok(dataflow.notes.some((note) => /ongoing worker charges/i.test(note)));

  const build = readConfig("gcp-cloud-build.json");
  const registry = readConfig("gcp-artifact-registry.json");
  const run = readConfig("gcp-cloud-run.json");
  assert.equal(build.billingEnabled, true);
  assert.equal(build.apiStatus, "verified-enabled");
  assert.equal(build.deploymentEnabled, true);
  assert.equal(build.latestBuildStatus, "SUCCESS");
  assert.equal(build.latestBuildId, "e01b285a-d6d2-4729-a6e4-31dd150b3786");
  assert.equal(build.latestImageDigest, "sha256:7d75f6ea42f67832d0cfb2240592be4b966a68fd68e8cf98038b131cc2117e75");
  assert.equal(build.latestRevision, "prepagent-00011-yew");
  assert.equal(build.latestDefaultTrafficPercent, 0);
  assert.equal(registry.billingEnabled, true);
  assert.equal(registry.repository.location, "asia-south1");
  assert.equal(registry.latestImageDigest, build.latestImageDigest);
  assert.equal(run.region, "asia-south1");
  assert.equal(run.apiStatus, "verified-enabled");
  assert.equal(run.serviceName, "prepagent");
  assert.equal(run.runtimeServiceAccount, "prepagent-run@prepagent-hack.iam.gserviceaccount.com");
  assert.equal(run.startupCommand, "npm start");
  assert.equal(run.healthEndpoint, "/health");
  assert.equal(run.containerPort, 8080);
  assert.equal(run.memory, "1Gi");
  assert.equal(run.maxInstances, 2);
  assert.equal(run.allowUnauthenticated, false);
  assert.equal(run.billingEnabled, true);
  assert.equal(run.deploymentStatus, "deployed-private");
  assert.equal(run.deploymentEvidence.revision, "prepagent-00005-s5x");
  assert.equal(run.deploymentEvidence.imageDigest, "sha256:25395f6c46ff43833b8ecd077bc8950173299cc743425d46baae3c03adaaa9f2");
  assert.equal(run.deploymentEvidence.serviceUrl, "https://prepagent-26mwt2n7ba-el.a.run.app");
  assert.equal(run.releaseCandidateEvidence.buildId, "1b17eb12-d717-4cef-bf96-0398ee12c42a");
  assert.equal(run.releaseCandidateEvidence.revision, "prepagent-00010-pag");
  assert.equal(run.releaseCandidateEvidence.imageDigest, "sha256:75eb3a5af8f18388b309018c4e106f9e168ba202363fbf83f15a7e4eef8e83ec");
  assert.equal(run.releaseCandidateEvidence.defaultTrafficPercent, 0);
  assert.equal(run.releaseCandidateEvidence.productionTrafficRevision, "prepagent-00005-s5x");
  assert.equal(run.releaseCandidateEvidence.publicInvokerMembers, false);
  assert.equal(run.releaseCandidateEvidence.serviceMaxInstances, 2);
  assert.equal(run.releaseCandidateEvidence.revisionReady, true);
  assert.equal(run.remediationCandidateEvidence.buildId, build.latestBuildId);
  assert.equal(run.remediationCandidateEvidence.revision, build.latestRevision);
  assert.equal(run.remediationCandidateEvidence.imageDigest, build.latestImageDigest);
  assert.equal(run.remediationCandidateEvidence.defaultTrafficPercent, 0);
  assert.equal(run.remediationCandidateEvidence.productionTrafficPercent, 100);
  assert.deepEqual(run.runtimeEnvironment, {
    PROJECT_ID: "prepagent-hack",
    REGION: "asia-south1",
    BUCKET: "prepagent-hack-data",
    VERTEX_LOCATION: "asia-south1",
    GEMINI_MODEL: "gemini-3.5-flash",
    USTAAD_PLANT_ID: "PLANT-01",
  });
  assert.ok(
    run.runtimeEnvironmentStatus === "pending-authorized-deployment" ||
      /^applied-to-prepagent-[a-z0-9-]+$/.test(run.runtimeEnvironmentStatus),
  );
  assert.equal(run.runtimeOptIns.USTAAD_ENABLE_LIVE_MODEL_CALLS, true);
  assert.equal(run.runtimeOptIns.USTAAD_ENABLE_RISK_PREDICTION, true);
  assert.equal(run.runtimeOptIns.USTAAD_ENABLE_HISTORICAL_EVIDENCE, true);
  assert.equal(run.runtimeOptIns.USTAAD_ENABLE_IMPACT_SUMMARY, true);
  assert.equal(run.runtimeOptIns.USTAAD_ENABLE_BIGQUERY_WRITES, true);
  assert.equal(run.runtimeOptIns.USTAAD_ENABLE_JOB_STORAGE, true);
  assert.equal(run.runtimeOptIns.USTAAD_ENABLE_FEEDBACK_WRITES, false);
  assert.equal(run.runtimeOptIns.USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY, true);
  assert.equal("USTAAD_PLANT_ID" in run.runtimeOptIns, false);
  assert.notEqual(run.allowUnauthenticated, true);
  assert.equal(packageJson.scripts.start, "node index.mjs");
  assert.match(appSource, /const port = readServerPort\(process\.env\.PORT\);/);
  assert.match(appSource, /app\.get\("\/health",\s*\(c\)\s*=>\s*\{\s*return c\.json\(\{\s*ok:\s*true,\s*mode:\s*process\.env\.K_SERVICE\s*\?\s*"cloud-run"\s*:\s*"local-development"/);
  assert.match(appSource, /serve\(\{\s*fetch:\s*app\.fetch,\s*port,\s*\}\)/);
  assert.doesNotMatch(
    JSON.stringify(run),
    /(?:-----BEGIN [^-]*PRIVATE KEY-----|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]+)/,
  );
  assert.ok(run.notes.some((note) => /unauthenticated access is disabled/i.test(note)));

  // Firestore idempotency config records the explicitly authorized prerequisites.
  const firestore = readConfig("gcp-firestore.json");
  assert.equal(firestore.projectId, projectId);
  assert.equal(firestore.database, "(default)");
  assert.equal(firestore.collection, "job_idempotency");
  assert.equal(firestore.apiStatus, "enabled");
  assert.equal(firestore.databaseStatus, "created");
  assert.equal(firestore.databaseLocation, "asia-south1");
  assert.equal(firestore.runtimeRoleStatus, "granted");
  assert.equal(typeof firestore.leaseMs, "number");
  assert.ok(firestore.leaseMs >= 30_000, "lease must be at least 30 seconds");
  assert.ok(firestore.notes.some((n) => /firestore\.googleapis\.com/i.test(n)),
    "config must document API enablement");
  assert.ok(firestore.notes.some((n) => /roles\/datastore\.user/i.test(n)),
    "config must document the granted runtime role");
  assert.ok(firestore.notes.some((n) => /BigQuery.*optimistic concurrency/i.test(n)),
    "config must document why BigQuery was disqualified");
  assert.equal(run.runtimeOptIns.USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY, true,
    "the explicitly authorized Firestore gate must be configured for deployment");

  const vertex = readConfig("gcp-vertex-ai.json");
  assert.equal(vertex.api, "aiplatform.googleapis.com");
  assert.equal(vertex.apiStatus, "verified-enabled");
  assert.equal(vertex.location, "asia-south1");
  assert.equal(vertex.runtimeServiceAccount, "prepagent-run@prepagent-hack.iam.gserviceaccount.com");
  assert.equal(vertex.requiredIamRole, "roles/aiplatform.user");
  assert.equal(vertex.modelCallsEnabled, true);
  assert.equal(vertex.provisioningStatus, "enabled-unverified");
  assert.equal(vertex.billingEnabled, true);
  assert.equal("model" in vertex, false);
  assert.ok(vertex.notes.some((note) => /explicit user authorization/i.test(note)));

  const translation = readConfig("gcp-translation.json");
  assert.equal(translation.api, "translate.googleapis.com");
  assert.equal(translation.apiStatus, "verified-enabled");
  assert.equal(translation.translationRegion, "us-central1");
  assert.equal(translation.runtimeServiceAccount, "prepagent-run@prepagent-hack.iam.gserviceaccount.com");
  assert.equal(translation.requiredIamRole, "roles/cloudtranslate.user");
  assert.equal(translation.glossary.region, translation.translationRegion);
  assert.deepEqual(translation.glossary.languageCodes, ["en", "hi", "mr", "ja", "ko", "zh-CN", "id"]);
  assert.equal(translation.liveTranslationEnabled, false);
  assert.equal(translation.glossary.source, "Om-provided glossary CSV");
  assert.equal(translation.glossary.provisioningStatus, "pending");
  assert.equal(translation.provisioningStatus, "pending");
  assert.equal(translation.billingEnabled, true);
  assert.ok(translation.notes.some((note) => /CSV is available/i.test(note)));
});

test("Cloud Build and Artifact Registry manifests match the JavaScript source-build contract", () => {
  const build = readConfig("gcp-cloud-build.json");
  const registry = readConfig("gcp-artifact-registry.json");

  assert.equal(build.projectId, projectId);
  assert.equal(build.api, "cloudbuild.googleapis.com");
  assert.equal(build.apiStatus, "verified-enabled");
  assert.equal(build.source, ".");
  assert.equal(build.provisioningStatus, "verified");
  assert.equal(build.billingEnabled, true);
  assert.equal(build.deploymentEnabled, true);

  assert.equal(registry.projectId, projectId);
  assert.equal(registry.api, "artifactregistry.googleapis.com");
  assert.equal(registry.apiStatus, "verified-enabled");
  assert.deepEqual(registry.repository, {
    name: "prepagent",
    format: "DOCKER",
    location: "asia-south1",
  });
  assert.equal(registry.provisioningStatus, "verified");
  assert.equal(registry.billingEnabled, true);

  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.main, "index.mjs");
  assert.equal(packageJson.scripts.start, "node index.mjs");
  assert.equal(packageJson.scripts["gcp-build"], undefined);
});

test("prepared plant seed matches the required row shape without asserting approval or execution", () => {
  const seedSql = readFileSync(new URL("../docs/bigquery-seed-plant.sql", import.meta.url), "utf8");

  assert.match(seedSql, /MERGE `prepagent-hack\.prepagent\.plants` AS target/i);
  assert.match(seedSql, /ON target\.plant_id = source\.plant_id/i);
  assert.match(seedSql, /WHEN MATCHED THEN\s+UPDATE SET/is);
  assert.match(seedSql, /WHEN NOT MATCHED THEN\s+INSERT/is);
  assert.doesNotMatch(seedSql, /\bDELETE\b/i);
  assert.match(seedSql, /prepared locally and has not been executed/i);

  const projection = seedSql.match(/SELECT([\s\S]*?)\)\s+AS source/i)?.[1];
  assert.ok(projection, "seed SQL must define a source projection");

  const row = Object.fromEntries(
    [...projection.matchAll(/'([^']*)'\s+AS\s+([a-z_]+)|(-?\d+(?:\.\d+)?)\s+AS\s+([a-z_]+)/gi)]
      .map(([, stringValue, stringAlias, numberValue, numberAlias]) => [
        stringAlias ?? numberAlias,
        stringValue ?? Number(numberValue),
      ])
  );
  assert.deepEqual(Object.keys(row).sort(), [
    "base_currency",
    "cost_per_kg",
    "default_locale",
    "name",
    "plant_id",
  ]);
  assert.equal(PlantRowSchema.safeParse(row).success, true);
  assert.equal(row.cost_per_kg, 53.3);
  assert.equal(row.default_locale, "en");

  for (const invalidRow of [
    { ...row, default_locale: "fr" },
    { ...row, cost_per_kg: 0 },
    { ...row, name: "" },
    Object.fromEntries(Object.entries(row).filter(([key]) => key !== "default_locale")),
  ]) {
    assert.equal(PlantRowSchema.safeParse(invalidRow).success, false);
  }

  assert.match(seedSql, /'PLANT-01' AS plant_id/);
  assert.match(seedSql, /has not been executed/i);
});
