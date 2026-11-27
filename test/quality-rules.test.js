import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  addedLinesFromDiff,
  checkCommitMessage,
  checkLine,
  checkPath,
  commitRange,
  formatFinding,
} from "../scripts/quality/rules.mjs";

// Fixtures are assembled from pieces so this file does not trip the checks it tests.
const join = (...parts) => parts.join("");

test("commit messages: a plain imperative subject passes", () => {
  assert.deepEqual(checkCommitMessage("Persist PO review state in Firestore\n\nUses the job id as key.\n"), []);
});

test("commit messages: attribution, tool names and emoji are rejected", () => {
  const cases = [
    join("Fix cap\n\nCo-", "Authored-By: Someone <a@b.c>"),
    join("Fix cap\n\n", "Generated", " with a tool"),
    join("Ask ", "Claude", " to fix cap"),
    join("Ask ", "Chat", "GPT", " to fix cap"),
    join("Ask ", "Co", "dex", " to fix cap"),
    join("Add ", "AI", "-generated summary"),
    join("Fix cap ", String.fromCodePoint(0x1f680)),
  ];
  for (const message of cases) {
    assert.notDeepEqual(checkCommitMessage(message), [], message);
  }
});

test("commit messages: CLAUDE.md, .claude/ and the rupee sign are allowed", () => {
  assert.deepEqual(checkCommitMessage("Update CLAUDE.md and .claude/agents for the gate"), []);
  assert.deepEqual(checkCommitMessage("Show savings in ₹ on the impact card"), []);
});

test("commit messages: subject limit is 72 characters", () => {
  assert.deepEqual(checkCommitMessage("a".repeat(72)), []);
  assert.match(checkCommitMessage("a".repeat(73)).join(), /73 characters/);
});

test("commit messages: git comment lines and the scissors section are ignored", () => {
  const message = join(
    "Fix cap\n# Please enter the commit message\n",
    "# ------------------------ >8 ------------------------\n",
    "+ ", "Claude", " in the diff below the scissors\n",
  );
  assert.deepEqual(checkCommitMessage(message), []);
});

test("paths: reference material and credential files are blocked", () => {
  assert.notDeepEqual(checkPath("docs/arc/reference/V5/pack.pdf"), []);
  assert.notDeepEqual(checkPath("config/prod-service-account.json"), []);
  assert.notDeepEqual(checkPath("certs/server.pem"), []);
  assert.notDeepEqual(checkPath(".env.production"), []);
  assert.deepEqual(checkPath(".env.example"), []);
  assert.deepEqual(checkPath("docs/arc/delivery/STATUS.md"), []);
});

test("lines: banned phrases are found with word boundaries", () => {
  assert.notDeepEqual(checkLine("README.md", 1, join("A ", "seam", "less", " flow")), []);
  assert.notDeepEqual(checkLine("src/a.js", 1, join("// ", "TODO", ": implement", " retries")), []);
  // The banned verb is a substring of "modelVersion", which must not match.
  assert.deepEqual(checkLine("src/a.js", 1, "record.modelVersion === expected"), []);
});

test("lines: files that define the rules may quote the phrases", () => {
  assert.deepEqual(checkLine("CLAUDE.md", 1, join("words like \"", "seam", "less", "\"")), []);
});

test("lines: secrets are found and never echoed", () => {
  const apiKey = join("AI", "za", "Sy", "A".repeat(33));
  const findings = checkLine("src/config.js", 4, `const key = "${apiKey}";`);
  assert.equal(findings.length, 1);
  assert.doesNotMatch(formatFinding(findings[0]), new RegExp(apiKey));
  assert.match(formatFinding(findings[0]), /src\/config\.js:4/);

  const pem = join("\"private_key\": \"-----BEGIN ", "PRIVATE KEY-----\\nMIIEvQ\"");
  assert.notDeepEqual(checkLine("x.json", 1, pem), []);
  assert.notDeepEqual(checkLine("x.json", 1, join("\"type\": \"service", "_account\"")), []);
});

test("lines: a PEM header used as a scan marker is not a secret", () => {
  const marker = join("markers = [b'-----BEGIN ", "PRIVATE KEY-----']");
  assert.deepEqual(checkLine("tools/scan.py", 1, marker), []);
});

test("diff parsing: added lines carry new-file line numbers", () => {
  const diff = [
    "diff --git a/src/a.js b/src/a.js",
    "--- a/src/a.js",
    "+++ b/src/a.js",
    "@@ -3,0 +4,2 @@",
    "+first",
    "+++counter;",
    "diff --git a/new.md b/new.md",
    "--- /dev/null",
    "+++ b/new.md",
    "@@ -0,0 +1 @@",
    "+hello",
  ].join("\n");
  assert.deepEqual(addedLinesFromDiff(diff), [
    { path: "src/a.js", line: 4, text: "first" },
    { path: "src/a.js", line: 5, text: "++counter;" },
    { path: "new.md", line: 1, text: "hello" },
  ]);
});

function fakeGit(responses) {
  const calls = [];
  const runGit = (args) => {
    calls.push(args);
    const response = responses[args[0]];
    if (response instanceof Error) throw response;
    if (response === undefined) throw new Error(`unexpected git ${args.join(" ")}`);
    return response;
  };
  return { calls, runGit };
}

test("commit range: no RANGE starts at the merge-base with origin/v2", () => {
  const { calls, runGit } = fakeGit({ "rev-parse": "abc123\n", "merge-base": "abc123\n" });
  assert.equal(commitRange(undefined, runGit), "abc123..HEAD");
  assert.deepEqual(calls[0], ["rev-parse", "--verify", "--quiet", "origin/v2^{commit}"]);
  assert.deepEqual(calls.at(-1), ["merge-base", "origin/v2", "HEAD"]);
});

test("commit range: a missing origin/v2 fails instead of checking nothing", () => {
  const { calls, runGit } = fakeGit({ "rev-parse": new Error("exit 1"), "merge-base": "abc123\n" });
  assert.throws(() => commitRange(undefined, runGit), /origin\/v2 is not available/);
  assert.equal(calls.some(([command]) => command === "merge-base"), false);
});

test("commit range: no common ancestor with origin/v2 fails", () => {
  const { runGit } = fakeGit({ "rev-parse": "abc123\n", "merge-base": new Error("exit 1") });
  assert.throws(() => commitRange(undefined, runGit), /no common ancestor/);
});

test("commit range: an empty merge-base fails", () => {
  const { runGit } = fakeGit({ "rev-parse": "abc123\n", "merge-base": "\n" });
  assert.throws(() => commitRange(undefined, runGit), /returned nothing/);
});

test("commit range: an explicit RANGE passes through without calling git", () => {
  const { calls, runGit } = fakeGit({});
  assert.equal(commitRange("base123..head456", runGit), "base123..head456");
  assert.deepEqual(calls, []);
});

test("check.mjs commits: exits 1 without origin/v2 or with a bad RANGE", () => {
  const checkScript = fileURLToPath(new URL("../scripts/quality/check.mjs", import.meta.url));
  const repo = mkdtempSync(joinPath(tmpdir(), "quality-no-v2-"));
  const runCheck = (...args) => {
    try {
      execFileSync(process.execPath, [checkScript, "commits", ...args], { cwd: repo, encoding: "utf8", stdio: "pipe" });
      return { status: 0, stderr: "" };
    } catch (error) {
      return { status: error.status, stderr: error.stderr };
    }
  };
  try {
    execFileSync("git", ["init", "-q"], { cwd: repo, stdio: "pipe" });

    const missingBase = runCheck();
    assert.equal(missingBase.status, 1);
    assert.match(missingBase.stderr, /NOT CHECKED: origin\/v2 is not available/);

    const badRange = runCheck("bogus..HEAD");
    assert.equal(badRange.status, 1);
    assert.match(badRange.stderr, /NOT CHECKED: git rev-list could not read the range bogus\.\.HEAD/);
    assert.doesNotMatch(badRange.stderr, /\n\s+at /);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
