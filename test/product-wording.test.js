import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Founder decision, 2026-11-26 (CLAUDE.md section 4): Momentum is presented as a product, so no
// string a user can read names the hackathon or the competition. Identifiers such as the
// HACKATHON_DEMO mode, module paths and element IDs are code, not text, and are allowed.
const root = fileURLToPath(new URL("..", import.meta.url));
const SOURCES = ["index.mjs", "src", "web/src", "public/impact.html", "prompts"];
const LITERAL = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|>[^<>{}\n]+</g;
const WORDING = /hackathon|builder cup|competition/i;
const CODE = /^["'`>]?(?:HACKATHON_DEMO(?::v\d+)?|[\w./-]*hackathon[\w./-]*)["'`<]?$/i;

function files(entry) {
  const full = path.join(root, entry);
  let stats;
  try { stats = statSync(full); } catch { return []; }
  if (stats.isFile()) return [entry];
  return readdirSync(full).flatMap((name) => files(path.join(entry, name)));
}

test("no user-facing string names the hackathon or the competition", () => {
  const found = [];
  for (const file of SOURCES.flatMap(files).filter((f) => /\.(?:m?js|tsx?|html|md|txt)$/.test(f))) {
    for (const literal of readFileSync(path.join(root, file), "utf8").match(LITERAL) ?? []) {
      if (WORDING.test(literal) && !CODE.test(literal.trim())) found.push(`${file}: ${literal.slice(0, 120)}`);
    }
  }
  assert.deepEqual(found, []);
});
