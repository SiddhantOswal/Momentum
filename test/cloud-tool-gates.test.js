import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function runWithoutLivePrerequisites(toolPath) {
  const env = { ...process.env };
  delete env.PUBLISH_SIMULATED_SENSOR_DATA;
  delete env.PROJECT_ID;
  delete env.GEMINI_MODEL;
  delete env.VERTEX_LOCATION;
  env.PATH = "";

  return spawnSync(process.execPath, [path.join(repositoryRoot, toolPath)], {
    cwd: repositoryRoot,
    env,
    encoding: "utf8",
    timeout: 30_000,
  });
}

test("sensor publisher refuses to run without opt-in before cloud preflights", () => {
  const result = runWithoutLivePrerequisites("tools/publisher.mjs");
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(output, /Refusing to publish/);
  assert.doesNotMatch(output, /BEGIN PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]+/);
});

test("Gemini utility refuses to run without explicit live-call authorization", () => {
  const result = runWithoutLivePrerequisites("tools/test-gemini.mjs");
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(output, /Live inference is disabled by default/);
  assert.doesNotMatch(output, /BEGIN PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]+/);
});
