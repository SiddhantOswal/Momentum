import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { applyCommitPlan, validatePlan } from "../tools/apply-commit-plan.mjs";

function repo() {
  const dir = mkdtempSync(path.join(tmpdir(), "commit-plan-"));
  for (const args of [["init", "-q"], ["config", "user.name", "Test"], ["config", "user.email", "test@example.com"], ["config", "commit.gpgsign", "false"]]) {
    spawnSync("git", args, { cwd: dir });
  }
  return dir;
}

const subjects = (dir) => spawnSync("git", ["log", "--format=%s"], { cwd: dir, encoding: "utf8" }).stdout.trim().split("\n").reverse();

test("makes one commit per group in order and reports files left out", () => {
  const dir = repo();
  writeFileSync(path.join(dir, "a.txt"), "a");
  writeFileSync(path.join(dir, "b.txt"), "b");
  writeFileSync(path.join(dir, "left.txt"), "left");
  const result = applyCommitPlan({ cwd: dir, plan: [{ message: "Add a", files: ["a.txt"] }, { message: "Add b", files: ["b.txt"] }] });
  assert.equal(result.ok, true);
  assert.deepEqual(subjects(dir), ["Add a", "Add b"]);
  assert.deepEqual(result.leftover, ["?? left.txt"]);
});

test("stops at the first group that cannot be committed and keeps the earlier commits", () => {
  const dir = repo();
  writeFileSync(path.join(dir, "a.txt"), "a");
  const result = applyCommitPlan({ cwd: dir, plan: [{ message: "Add a", files: ["a.txt"] }, { message: "Add missing", files: ["missing.txt"] }] });
  assert.equal(result.ok, false);
  assert.equal(result.failedGroup, 2);
  assert.deepEqual(subjects(dir), ["Add a"]);
});

test("rejects plans that would escape the repository or break the message rule", () => {
  assert.throws(() => validatePlan([]), /non-empty/);
  assert.throws(() => validatePlan([{ message: "x".repeat(73), files: ["a"] }]), /72/);
  assert.throws(() => validatePlan([{ message: "Ok", files: ["../outside"] }]), /not a path inside/);
  assert.throws(() => validatePlan([{ message: "Ok", files: ["/etc/passwd"] }]), /not a path inside/);
  assert.throws(() => validatePlan([{ message: "Ok", files: [".git/config"] }]), /not a path inside/);
  assert.throws(() => validatePlan([{ message: "Two\nlines", files: ["a"] }]), /one line/);
  assert.throws(() => validatePlan([{ message: "Ok", files: [] }]), /at least one file/);
});
