#!/usr/bin/env node
// Usage:
//   check.mjs staged            added lines and paths in the index (pre-commit hook)
//   check.mjs tree              every tracked file (CI)
//   check.mjs commit-msg FILE   one commit message (commit-msg hook)
//   check.mjs commits [RANGE]   every commit message in a git range; default: merge-base with origin/v2 to HEAD
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  addedLinesFromDiff,
  checkCommitMessage,
  checkLine,
  checkPath,
  commitRange,
  formatFinding,
} from "./rules.mjs";

function git(args) {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
}

function isBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0);
}

function checkStaged() {
  const findings = [];
  const paths = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]).split("\0").filter(Boolean);
  for (const path of paths) findings.push(...checkPath(path));
  const diff = git([
    "diff", "--cached", "--diff-filter=ACMR", "-U0", "--no-color", "--no-ext-diff", "--no-textconv",
    "--src-prefix=a/", "--dst-prefix=b/",
  ]);
  for (const { path, line, text } of addedLinesFromDiff(diff)) findings.push(...checkLine(path, line, text));
  return findings;
}

function checkTree() {
  const findings = [];
  const paths = git(["ls-files", "-z"]).split("\0").filter(Boolean);
  for (const path of paths) {
    findings.push(...checkPath(path));
    let buffer;
    try {
      buffer = readFileSync(path);
    } catch (error) {
      // A tracked file deleted in the working tree has nothing to scan.
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (isBinary(buffer)) continue;
    buffer.toString("utf8").split(/\r?\n/).forEach((text, index) => {
      findings.push(...checkLine(path, index + 1, text));
    });
  }
  return findings;
}

function reportFindings(findings, scope) {
  if (findings.length === 0) return 0;
  console.error(`Quality check failed (${scope}): ${findings.length} problem(s).`);
  for (const finding of findings) console.error(`  ${formatFinding(finding)}`);
  console.error("Fix these and try again. Do not bypass the check with --no-verify.");
  return 1;
}

function checkMessageFile(file) {
  const problems = checkCommitMessage(readFileSync(file, "utf8"));
  if (problems.length === 0) return 0;
  console.error("Commit message rejected:");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("Use a short, imperative subject of 72 characters or fewer, with no AI attribution or emoji.");
  return 1;
}

function checkCommitRange(range) {
  let output;
  try {
    output = git(["rev-list", range]);
  } catch {
    throw new Error(`git rev-list could not read the range ${range}.`);
  }
  const hashes = output.split("\n").filter(Boolean);
  let failed = 0;
  for (const hash of hashes) {
    const problems = checkCommitMessage(git(["log", "-1", "--format=%B", hash]));
    if (problems.length === 0) continue;
    failed += 1;
    console.error(`${hash.slice(0, 12)}: ${problems.join("; ")}`);
  }
  if (failed > 0) {
    console.error(`${failed} of ${hashes.length} commit message(s) in ${range} break the rules.`);
    return 1;
  }
  console.log(`${hashes.length} commit message(s) in ${range} checked.`);
  return 0;
}

const [mode, argument] = process.argv.slice(2);
let exitCode;
switch (mode) {
  case "staged":
    exitCode = reportFindings(checkStaged(), "staged changes");
    break;
  case "tree":
    exitCode = reportFindings(checkTree(), "tracked files");
    if (exitCode === 0) console.log("Phrase, secret and path checks passed on all tracked files.");
    break;
  case "commit-msg":
    exitCode = argument ? checkMessageFile(argument) : 2;
    break;
  case "commits": {
    try {
      exitCode = checkCommitRange(commitRange(argument, git));
    } catch (error) {
      console.error(`Commit messages NOT CHECKED: ${error.message}`);
      exitCode = 1;
    }
    break;
  }
  default:
    exitCode = 2;
}
if (exitCode === 2) console.error("Usage: check.mjs staged | tree | commit-msg FILE | commits [RANGE]");
process.exit(exitCode);
