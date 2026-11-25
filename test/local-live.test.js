import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createCloudRunAccessTokenProvider, metadataTokenUrl } from "../src/google-cloud/bigquery-read-client.js";
import { createGcloudTokenSource, createLocalMetadataServer, RELEASE_FLAGS, serviceEnvironment } from "../tools/run-local-live.mjs";

const launcher = fileURLToPath(new URL("../tools/run-local-live.mjs", import.meta.url));

test("the metadata address defaults to Cloud Run and accepts only loopback overrides", () => {
  assert.equal(metadataTokenUrl({}), "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token");
  assert.equal(metadataTokenUrl({ GCE_METADATA_HOST: "127.0.0.1:8099" }), "http://127.0.0.1:8099/computeMetadata/v1/instance/service-accounts/default/token");
  for (const host of ["evil.example.com", "127.0.0.1@evil.example.com", "localhost/../x", "10.0.0.1:80"]) {
    assert.throws(() => metadataTokenUrl({ GCE_METADATA_HOST: host }), /loopback/, host);
  }
});

test("the token provider asks the configured metadata address with the Google header", async () => {
  let seen;
  const provider = createCloudRunAccessTokenProvider({
    env: { GCE_METADATA_HOST: "127.0.0.1:9" },
    fetchImpl: async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ access_token: "t" }), { status: 200 }); },
  });
  await provider();
  assert.equal(seen.url, "http://127.0.0.1:9/computeMetadata/v1/instance/service-accounts/default/token");
  assert.equal(seen.init.headers["Metadata-Flavor"], "Google");
});

test("the local metadata endpoint refuses requests without the Google header", async (t) => {
  const server = createLocalMetadataServer({ getToken: async () => ({ value: "tok", expiresIn: 60 }), projectId: "p" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const bare = await fetch(`${base}/computeMetadata/v1/instance/service-accounts/default/token`);
  assert.equal(bare.status, 403);
  const token = await fetch(`${base}/computeMetadata/v1/instance/service-accounts/default/token`, { headers: { "Metadata-Flavor": "Google" } });
  assert.equal(token.status, 200);
  assert.deepEqual(await token.json(), { access_token: "tok", expires_in: 60, token_type: "Bearer" });
  const project = await fetch(`${base}/computeMetadata/v1/project/project-id`, { headers: { "Metadata-Flavor": "Google" } });
  assert.equal(await project.text(), "p");
  const other = await fetch(`${base}/computeMetadata/v1/instance/attributes/x`, { headers: { "Metadata-Flavor": "Google" } });
  assert.equal(other.status, 404);
});

test("the local metadata endpoint refuses rebinding hosts and browser requests", async (t) => {
  const { request } = await import("node:http");
  const server = createLocalMetadataServer({ getToken: async () => ({ value: "tok", expiresIn: 60 }), projectId: "p" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const port = server.address().port;
  const get = (headers) => new Promise((resolve, reject) => {
    request({ host: "127.0.0.1", port, path: "/computeMetadata/v1/instance/service-accounts/default/token", headers: { "Metadata-Flavor": "Google", ...headers } },
      (response) => { response.resume(); resolve(response.statusCode); }).on("error", reject).end();
  });
  assert.equal(await get({}), 200, "a plain local client gets the token");
  assert.equal(await get({ Host: "attacker.example:" + port }), 403, "a rebound hostname is refused");
  assert.equal(await get({ Host: "localhost:" + port }), 403, "only the exact loopback address is accepted");
  assert.equal(await get({ Origin: "http://127.0.0.1:" + port }), 403);
  assert.equal(await get({ "Sec-Fetch-Site": "same-origin" }), 403);
  assert.equal(await get({ "Sec-Fetch-Dest": "empty" }), 403);
  assert.equal(await get({ "Sec-Fetch-Mode": "cors" }), 200, "Node fetch sends Sec-Fetch-Mode and must still work");
});

test("the gcloud token is fetched once and refreshed after 5 minutes", async () => {
  let now = 0;
  let calls = 0;
  const source = createGcloudTokenSource({ fetchToken: async () => `tok-${++calls}`, now: () => now });
  const [a, b] = await Promise.all([source(), source()]);
  assert.equal(calls, 1, "two requests at once share one gcloud call");
  assert.equal(a.value, "tok-1");
  assert.equal(b.value, "tok-1");
  now = 4 * 60 * 1000;
  assert.equal((await source()).value, "tok-1");
  now = 6 * 60 * 1000;
  assert.equal((await source()).value, "tok-2");
});

test("service settings keep plain values apart from secret references", () => {
  const { plain, secrets } = serviceEnvironment({ spec: { template: { spec: { containers: [{ env: [
    { name: "PROJECT_ID", value: "prepagent-hack" },
    { name: "WEATHER_API_KEY", valueFrom: { secretKeyRef: { name: "momentum-weather-api-key", key: "latest" } } },
  ] }] } } } });
  assert.deepEqual(plain, { PROJECT_ID: "prepagent-hack" });
  assert.deepEqual(secrets, [{ name: "WEATHER_API_KEY", secret: "momentum-weather-api-key", version: "latest" }]);
});

test("every release flag is on and Gemini uses the live pool under the F2 rupee cap", () => {
  for (const flag of ["USTAAD_ENABLE_ARC", "USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY", "USTAAD_ENABLE_DURABLE_PO_REVIEWS", "USTAAD_ENABLE_DURABLE_TRACES", "USTAAD_ENABLE_LOT_REVISIONS", "USTAAD_ENFORCE_APPROVE_GUARD", "USTAAD_ENFORCE_MODEL_VERSIONS", "USTAAD_ENABLE_ARC_METRICS"]) {
    assert.equal(RELEASE_FLAGS[flag], "true", flag);
  }
  assert.equal(RELEASE_FLAGS.USTAAD_GEMINI_BUDGET_POLICY, "budget-v2");
  const limits = JSON.parse(RELEASE_FLAGS.GEMINI_BUDGET_LIMITS);
  assert.equal(limits.pool, "live");
  assert.ok(limits.dayCostCapInr <= 100, "laptop spend stays well under the F2 live cap");
});

test("the server binds to loopback off Cloud Run when asked, and the launcher asks", async () => {
  const { readFileSync } = await import("node:fs");
  const index = readFileSync(new URL("../index.mjs", import.meta.url), "utf8");
  assert.match(index, /!isCloudRun && process\.env\.USTAAD_BIND_HOST === "127\.0\.0\.1"/);
  assert.match(readFileSync(launcher, "utf8"), /USTAAD_BIND_HOST: "127\.0\.0\.1"/);
});

test("the launcher refuses to run on Cloud Run", () => {
  const result = spawnSync(process.execPath, [launcher], { env: { ...process.env, K_SERVICE: "momentum" }, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refuses to run on Cloud Run/);
});
