// Shared by the git hooks and CI so a commit that passes locally passes in CI.

export const REFERENCE_PREFIX = "docs/arc/reference/";

export const MAX_SUBJECT_LENGTH = 72;

// Om's V2 history predates these rules, so commit checks start where a branch leaves it.
export const BASE_REF = "origin/v2";

// These files define or quote the banned phrases on purpose.
export const PHRASE_EXEMPT_PATHS = new Set([
  "CLAUDE.md",
  ".claude/agents/copy-editor.md",
  "scripts/quality/rules.mjs",
]);

export const PHRASE_RULES = [
  { label: "seamless", pattern: /\bseamless(ly)?\b/i },
  { label: "robust solution", pattern: /\brobust solutions?\b/i },
  { label: "leverage", pattern: /\bleverag(e|es|ed|ing)\b/i },
  { label: "delve", pattern: /\bdelv(e|es|ed|ing)\b/i },
  { label: "cutting-edge", pattern: /\bcutting[- ]edge\b/i },
  { label: "AI-powered", pattern: /\bAI[- ]powered\b/i },
  { label: "As an AI", pattern: /\bas an AI\b/i },
  { label: "Certainly!", pattern: /\bcertainly!/i },
  { label: "TODO: implement", pattern: /\bTODO:\s*implement\b/i },
];

export const SECRET_RULES = [
  // A PEM header followed by key material, either on the next line or after an escaped newline in JSON.
  { label: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----(\s*$|\\n[A-Za-z0-9+/])/ },
  { label: "service-account JSON", pattern: /"type"\s*:\s*"service_account"/ },
  { label: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { label: "Google OAuth access token", pattern: /\bya29\.[0-9A-Za-z_-]{20,}/ },
  { label: "AWS access key", pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { label: "GitHub token", pattern: /\b(gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,})\b/ },
  { label: "Slack token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  {
    label: "hard-coded credential",
    pattern: /\b(api[_-]?key|client[_-]?secret|secret[_-]?key|access[_-]?token|password)["']?\s*[:=]\s*["'][A-Za-z0-9_\-/+=.]{24,}["']/i,
  },
];

const BLOCKED_FILE_PATTERNS = [
  { label: "service-account key file", pattern: /(^|\/)[^/]*service[-_]account[^/]*\.json$/i },
  { label: "application default credentials", pattern: /(^|\/)application_default_credentials\.json$/ },
  { label: "key or certificate file", pattern: /\.(pem|key|p12|pfx)$/i },
  { label: "environment file", pattern: /(^|\/)\.env(\.(?!example$)[^/]+)?$/ },
];

// Commit-message markers. "Claude" is case-sensitive so file names such as CLAUDE.md and .claude/ stay usable.
const COMMIT_MARKERS = [
  { label: "Co-Authored-By trailer", pattern: /co-authored-by/i },
  { label: "\"Generated with\" line", pattern: /generated with/i },
  { label: "\"Claude\"", pattern: /\bClaude\b/ },
  { label: "\"ChatGPT\"", pattern: /\bchatgpt\b/i },
  { label: "\"Codex\"", pattern: /\bcodex\b/i },
  { label: "\"AI-generated\"", pattern: /\bAI[- ]generated\b/i },
];

// Extended_Pictographic includes the copyright, registered and trade mark signs, which are not emoji.
const EMOJI = /(?![©®™])[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u;

export function checkPath(path) {
  const findings = [];
  if (path === REFERENCE_PREFIX.slice(0, -1) || path.startsWith(REFERENCE_PREFIX)) {
    findings.push({ path, line: 0, rule: "reference material", text: "files under docs/arc/reference/ must never be committed" });
  }
  for (const { label, pattern } of BLOCKED_FILE_PATTERNS) {
    if (pattern.test(path)) findings.push({ path, line: 0, rule: label, text: "file type must never be committed" });
  }
  return findings;
}

export function checkLine(path, line, text) {
  const findings = [];
  for (const { label, pattern } of SECRET_RULES) {
    if (pattern.test(text)) findings.push({ path, line, rule: `secret: ${label}`, text });
  }
  if (!PHRASE_EXEMPT_PATHS.has(path)) {
    for (const { label, pattern } of PHRASE_RULES) {
      if (pattern.test(text)) findings.push({ path, line, rule: `banned phrase: ${label}`, text });
    }
  }
  return findings;
}

// Drops the lines git strips before storing the message: comments and everything below the -v scissors line.
export function cleanCommitMessage(raw) {
  const lines = [];
  for (const line of raw.split(/\r?\n/)) {
    if (/^# -+ >8 -+/.test(line)) break;
    if (line.startsWith("#")) continue;
    lines.push(line);
  }
  return lines.join("\n").trim();
}

export function checkCommitMessage(raw) {
  const message = cleanCommitMessage(raw);
  const problems = [];
  if (message === "") return problems;
  const subject = message.split("\n")[0];
  if ([...subject].length > MAX_SUBJECT_LENGTH) {
    problems.push(`subject is ${[...subject].length} characters; the limit is ${MAX_SUBJECT_LENGTH}`);
  }
  for (const { label, pattern } of COMMIT_MARKERS) {
    if (pattern.test(message)) problems.push(`contains ${label}`);
  }
  if (EMOJI.test(message)) problems.push("contains an emoji");
  return problems;
}

// runGit(args) returns stdout and throws on a non-zero exit, like execFileSync.
export function commitRange(range, runGit) {
  if (range) return range;
  try {
    runGit(["rev-parse", "--verify", "--quiet", `${BASE_REF}^{commit}`]);
  } catch {
    throw new Error(`${BASE_REF} is not available. Run "git fetch origin v2" or pass a RANGE.`);
  }
  let base;
  try {
    base = runGit(["merge-base", BASE_REF, "HEAD"]).trim();
  } catch {
    throw new Error(`HEAD has no common ancestor with ${BASE_REF}. Pass a RANGE.`);
  }
  if (!base) throw new Error(`git merge-base ${BASE_REF} HEAD returned nothing. Pass a RANGE.`);
  return `${base}..HEAD`;
}

// Returns the added lines of a zero-context unified diff, with their line numbers in the new file.
export function addedLinesFromDiff(diff) {
  const added = [];
  let path = null;
  let inHeader = false;
  let nextLine = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      inHeader = true;
      path = null;
      continue;
    }
    // Only read "+++" as a header before the first hunk; inside a hunk it is an added line starting with "++".
    if (inHeader && line.startsWith("+++ ")) {
      path = line === "+++ /dev/null" ? null : line.slice("+++ b/".length);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      inHeader = false;
      nextLine = Number(hunk[1]);
      continue;
    }
    if (path === null || inHeader) continue;
    if (line.startsWith("+")) {
      added.push({ path, line: nextLine, text: line.slice(1) });
      nextLine += 1;
    } else if (line.startsWith(" ")) {
      nextLine += 1;
    }
  }
  return added;
}

export function formatFinding({ path, line, rule, text }) {
  const where = line > 0 ? `${path}:${line}` : path;
  // Never echo a suspected secret into a terminal or CI log.
  const excerpt = rule.startsWith("secret: ") ? "(line not shown)" : text.trim().slice(0, 120);
  return `${where}  [${rule}]  ${excerpt}`;
}
