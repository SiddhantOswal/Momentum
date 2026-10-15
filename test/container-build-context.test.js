import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const dockerignore = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const storageConfig = readFileSync(new URL("../config/gcp-storage.json", import.meta.url), "utf8");
const vertexConfig = readFileSync(new URL("../config/gcp-vertex-ai.json", import.meta.url), "utf8");
const approvedPhotoConfig = readFileSync(new URL("../config/approved-photos.json", import.meta.url), "utf8");
const modelAcceptanceConfig = readFileSync(new URL("../config/model-acceptance.json", import.meta.url), "utf8");

test("container build excludes local credentials and uses an explicit source allowlist", () => {
  for (const pattern of [
    ".git",
    ".env",
    ".env.*",
    "env.sh",
    ".npmrc",
    "*.pem",
    "*.key",
    "*.p12",
    "*.pfx",
    "*credentials*.json",
    "*service-account*.json",
    "*service_account*.json",
    "node_modules",
  ]) {
    assert.ok(dockerignore.includes(pattern), `Missing Docker ignore rule: ${pattern}`);
  }
  assert.ok(dockerignore.includes("config"));
  assert.ok(dockerignore.includes("!config/gcp-storage.json"));
  assert.ok(dockerignore.includes("!config/gcp-vertex-ai.json"));
  assert.ok(dockerignore.includes("!config/model-acceptance.json"));
  assert.ok(dockerignore.includes("!config/approved-photos.json"));
  assert.ok(!dockerignore.includes("!config/gcp-cloud-run.json"));
  assert.ok(!dockerignore.includes("!config/gcp-firestore.json"));

  const copyLines = dockerfile.split(/\r?\n/).filter((line) => /^\s*COPY\b/.test(line));
  assert.deepEqual(copyLines, [
    "COPY --chown=node:node package.json package-lock.json ./",
    "COPY --chown=node:node index.mjs ./index.mjs",
    "COPY --chown=node:node src ./src",
    "COPY --chown=node:node public ./public",
    "COPY --chown=node:node sql ./sql",
    "COPY --chown=node:node assets ./assets",
    "COPY --chown=node:node config ./config",
  ]);

  const looksSensitive =
    /-----BEGIN [A-Z ]*PRIVATE KEY-----|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]+|AKIA[0-9A-Z]{16}/;
  for (const configText of [storageConfig, vertexConfig, modelAcceptanceConfig, approvedPhotoConfig]) {
    assert.equal(looksSensitive.test(configText), false,
      "A copied runtime manifest contains a credential-like value.");
  }
  assert.equal(packageJson.scripts.start, "node index.mjs");
  assert.ok(packageJson.engines.node.includes("20.10.0"));
  assert.match(dockerfile, /^ENV PORT=8080$/m);
});
