import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

// fileURLToPath decodes %20, so the scripts are found when the checkout path has spaces.
const script = (name) => fileURLToPath(new URL(`../tools/orchestrator/${name}`, import.meta.url));
const dry = (...args) => spawnSync("bash", [script("codex-session.sh"), ...args], { encoding: "utf8", env: { ...process.env, DRY_RUN: "1" } });

test("a builder session has no network, a fixed model and effort, and no sandbox bypass", () => {
  const result = dry("builder", "backend-engineer", "ARC-M2-05.md", "/tmp/wt", "/tmp/report.md");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /-s workspace-write/);
  assert.match(result.stdout, /-m gpt-6\.2-sol/);
  assert.match(result.stdout, /model_reasoning_effort=medium/);
  assert.match(result.stdout, /--ephemeral/);
  assert.match(result.stdout, /CLOUDSDK_CONFIG=/);
  assert.doesNotMatch(result.stdout, /dangerously|danger-full-access|network_access/);
  assert.match(result.stdout, /commit-plan\.json/);
  assert.match(result.stdout, /roles\/backend-engineer\.md/);
  assert.match(result.stdout, /packets\/ARC-M2-05\.md/);
});

test("a reviewer session is told never to commit and keeps the same sandbox", () => {
  const result = dry("reviewer", "qa-lead", "ARC-M2-05-QA.md", "/tmp/wt", "/tmp/report.md");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /-s workspace-write/);
  assert.match(result.stdout, /never\\ commit/);
  assert.doesNotMatch(result.stdout, /dangerously|network_access/);
});

test("the model and effort can be overridden only by the environment", () => {
  const result = spawnSync("bash", [script("codex-session.sh"), "builder", "ai-engineer", "p.md", "/tmp/wt", "/tmp/r.md"], {
    encoding: "utf8", env: { ...process.env, DRY_RUN: "1", CODEX_MODEL: "gpt-6.1-sol", CODEX_EFFORT: "high" },
  });
  assert.match(result.stdout, /-m gpt-6\.1-sol/);
  assert.match(result.stdout, /model_reasoning_effort=high/);
});

test("EXTERNAL_DIR moves the role and packet paths to another worktree", () => {
  const result = spawnSync("bash", [script("codex-session.sh"), "builder", "pitch-writer", "PITCH-01.md", "/tmp/wt", "/tmp/r.md"], {
    encoding: "utf8", env: { ...process.env, DRY_RUN: "1", EXTERNAL_DIR: "/tmp/other/external" },
  });
  assert.match(result.stdout, /\/tmp\/other\/external\/roles\/pitch-writer\.md/);
  assert.match(result.stdout, /\/tmp\/other\/external\/packets\/PITCH-01\.md/);
});

test("an unknown session kind is refused", () => {
  const result = dry("operator", "qa-lead", "p.md", "/tmp/wt", "/tmp/r.md");
  assert.equal(result.status, 2);
});

test("every orchestrator script is executable and the resume script reports the branch tip", () => {
  for (const name of ["codex-session.sh", "suite-twice.sh", "new-worktree.sh", "resume.sh"]) accessSync(script(name), constants.X_OK);
  const result = spawnSync("bash", [script("resume.sh")], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /== v3 tip/);
  assert.match(result.stdout, /== arc branches not merged/);
});
