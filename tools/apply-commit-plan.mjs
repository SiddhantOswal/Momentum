import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const MAX_SUBJECT = 72;

export function validatePlan(plan) {
  if (!Array.isArray(plan) || plan.length === 0) throw new Error("The plan must be a non-empty array.");
  plan.forEach((group, index) => {
    const label = `Group ${index + 1}`;
    if (typeof group?.message !== "string" || group.message.trim() === "" || group.message.length > MAX_SUBJECT || group.message.includes("\n")) {
      throw new Error(`${label}: the message must be one line of at most ${MAX_SUBJECT} characters.`);
    }
    if (!Array.isArray(group.files) || group.files.length === 0) throw new Error(`${label}: list at least one file.`);
    for (const file of group.files) {
      const normal = typeof file === "string" ? path.posix.normalize(file) : "";
      if (!normal || normal.startsWith("..") || path.isAbsolute(normal) || normal === ".git" || normal.startsWith(".git/")) {
        throw new Error(`${label}: "${file}" is not a path inside the repository.`);
      }
    }
  });
}

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}`.trim() };
}

export function applyCommitPlan({ cwd, plan }) {
  validatePlan(plan);
  const made = [];
  for (const [index, group] of plan.entries()) {
    const added = git(cwd, ["add", "--", ...group.files]);
    if (added.status !== 0) return { ok: false, failedGroup: index + 1, output: added.output, made };
    const committed = git(cwd, ["commit", "-m", group.message]);
    if (committed.status !== 0) return { ok: false, failedGroup: index + 1, output: committed.output, made };
    made.push({ message: group.message, hash: git(cwd, ["rev-parse", "--short", "HEAD"]).output });
  }
  const leftover = git(cwd, ["status", "--porcelain"]).output.split("\n").filter(Boolean);
  return { ok: true, made, leftover };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [planFile, cwd = process.cwd()] = process.argv.slice(2);
  if (!planFile) {
    console.error("Usage: node tools/apply-commit-plan.mjs <plan.json> [repository]");
    process.exit(2);
  }
  const result = applyCommitPlan({ cwd, plan: JSON.parse(readFileSync(planFile, "utf8")) });
  for (const commit of result.made) console.log(`${commit.hash} ${commit.message}`);
  if (!result.ok) {
    console.error(`Stopped at group ${result.failedGroup}:\n${result.output}`);
    process.exit(1);
  }
  if (result.leftover.length > 0) console.log(`Not in any group:\n${result.leftover.join("\n")}`);
}
