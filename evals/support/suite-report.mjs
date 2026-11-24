// node:test reporter that prints the pass count per eval suite. A suite is one
// evals/<suite>.test.js file and a case is one leaf test in it. Suites listed in
// evals/suites.json with no file in the run are printed as NOT BUILT, so a gate
// report never reads a missing suite as passing.
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const manifest = JSON.parse(readFileSync(new URL("../suites.json", import.meta.url), "utf8"));

function suiteName(file) {
  return typeof file === "string" ? basename(file).replace(/\.test\.m?js$/, "") : "(unknown file)";
}

export default async function* suiteReport(source) {
  const counts = new Map();
  const bump = (file, field) => {
    const name = suiteName(file);
    const entry = counts.get(name) ?? { passed: 0, failed: 0, skipped: 0 };
    entry[field] += 1;
    counts.set(name, entry);
  };
  for await (const event of source) {
    if (event.type !== "test:pass" && event.type !== "test:fail") continue;
    if (event.data.details?.type === "suite") continue;
    // A skipped or todo case did not pass, so it is never counted as one.
    if (event.data.skip !== undefined || event.data.todo !== undefined) bump(event.data.file, "skipped");
    else bump(event.data.file, event.type === "test:pass" ? "passed" : "failed");
  }

  const lines = ["", "Offline evals: pass count per suite (offline run, no Gemini, not the live service)"];
  const names = [...new Set([...Object.keys(manifest.suites), ...counts.keys()])];
  const width = Math.max(...names.map((name) => name.length));
  for (const name of names) {
    const entry = counts.get(name);
    const spec = manifest.suites[name];
    const thresholds = spec ? spec.thresholds.join(", ") : "not in evals/suites.json";
    const label = `  ${name.padEnd(width)}  ${thresholds.padEnd(8)}`;
    if (!entry) {
      lines.push(`${label}  NOT BUILT. ${spec?.notBuilt ?? ""}`.trimEnd());
      continue;
    }
    const total = entry.passed + entry.failed + entry.skipped;
    const extra = [entry.failed && `${entry.failed} failed`, entry.skipped && `${entry.skipped} skipped`].filter(Boolean);
    lines.push(`${label}  ${entry.passed} of ${total} passed${extra.length ? ` (${extra.join(", ")})` : ""}`);
    if (spec?.gaps) lines.push(`  ${"".padEnd(width)}  ${"".padEnd(8)}  Gaps: ${spec.gaps}`);
  }
  yield `${lines.join("\n")}\n`;
}
