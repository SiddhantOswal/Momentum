import { readFileSync, writeFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { validateModelEvidenceBundle } from "../src/model-evidence-bundle.js";
export function readEvidenceJson(file) {
  const stat = statSync(file);
  if (!stat.isFile() || stat.size > 16 * 1024 * 1024) throw new Error("Evidence must be a JSON file no larger than16MiB.");
  return JSON.parse(readFileSync(file, "utf8"));
}
export function validateFiles({ bundleFile, metadataFile, outputFile }) {
  const metadata = readEvidenceJson(metadataFile);
  const models = Array.isArray(metadata) ? metadata : metadata.records?.filter(r => r.purpose?.startsWith("current model ") && r.exitCode === 0).map(r => r.result);
  const bundle = readEvidenceJson(bundleFile);
  const preparedQueries = {};
  if (bundle?.evidenceKind === "NEW_EVALUATION") {
    for (const name of ["warp", "delam", "strength", "print", "crack"]) {
      preparedQueries[`prepagent.m_${name}`] = readFileSync(new URL(`../ops/evaluation-proposed/m_${name}.sql`, import.meta.url), "utf8");
    }
    preparedQueries.source = readFileSync(new URL("../ops/evaluation-proposed/source_rows.sql", import.meta.url), "utf8");
  }
  const result = validateModelEvidenceBundle(bundle, models, { preparedQueries });
  if (outputFile) writeFileSync(outputFile, JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 6 || args[0] !== "--bundle" || args[2] !== "--metadata" || args[4] !== "--output") throw new Error("Usage: node tools/validate-model-evidence.mjs --bundle OWNER_BUNDLE.json --metadata CURRENT_MODEL_METADATA.json --output NEW_REPORT.json");
    const result = validateFiles({ bundleFile: args[1], metadataFile: args[3], outputFile: args[5] });
    console.log(JSON.stringify({ ok: result.ok, status: result.status, issues: result.issues }));
    process.exitCode = result.ok ? 0 : 1;
  } catch { console.error("Evidence validation failed. Check arguments, JSON, size and exclusive output path. No configuration changed."); process.exitCode = 2; }
}
