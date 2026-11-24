// Scores a lot file on one BigQuery ML model set without writing anything to
// BigQuery: the lots travel as a query parameter, and every job has a bytes cap.
// It also writes the matching labels file, so tools/ml/evaluate.mjs can pair
// candidate, incumbent and naive predictions on exactly the same lots.
//
// node tools/ml/score-holdout.mjs --lots <lots.jsonl> --models m2 --out <dir>
//   [--project prepagent-hack] [--dataset prepagent] [--location asia-south1]
//   [--max-bytes 104857600] [--token-command "gcloud auth print-access-token"]
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { RATE_UNIT, sha256, TARGETS } from "./lot-files.mjs";

// The model inputs, typed as in prepagent.lots. Labels and outcome columns are
// left out on purpose: a model must never see the answer it is scored on.
export const INPUT_COLUMNS = Object.freeze([
  ["lot_id", "STRING"], ["customer_id", "STRING"], ["box_style", "STRING"],
  ["length_mm", "INT64"], ["width_mm", "INT64"], ["height_mm", "INT64"], ["ply", "INT64"],
  ["flute_profile", "STRING"], ["top_liner_gsm", "INT64"], ["flute_gsm", "INT64"],
  ["inner_liner_gsm", "INT64"], ["liner_bf", "INT64"], ["paper_type", "STRING"],
  ["paper_supplier", "STRING"], ["ink_colors", "INT64"], ["ink_coverage_pct", "FLOAT64"],
  ["quantity", "INT64"], ["shift", "STRING"], ["ambient_rh_pct", "FLOAT64"],
  ["ambient_temp_c", "FLOAT64"], ["paper_moisture_pct", "FLOAT64"], ["sf_speed_mpm", "FLOAT64"],
  ["roll_temp_c", "FLOAT64"], ["gum_application", "STRING"], ["gum_viscosity_sec", "FLOAT64"],
  ["pasting_pressure", "STRING"], ["drying_hours", "FLOAT64"], ["print_speed_spm", "FLOAT64"],
  ["sheet_area_m2", "FLOAT64"], ["box_weight_kg", "FLOAT64"],
]);

export const MODEL_SETS = Object.freeze({ m: "m_", m2: "m2_" });

export function buildQuery(dataset, prefix) {
  const ctes = TARGETS.map((target) => {
    const name = target.toLowerCase();
    return `p_${name} AS (SELECT lot_id, predicted_rate_${name}_pct AS v FROM ML.PREDICT(MODEL \`${dataset}.${prefix}${name}\`, (SELECT * FROM input)))`;
  });
  const columns = TARGETS.map((target) => `p_${target.toLowerCase()}.v AS ${target.toLowerCase()}`).join(", ");
  const joins = TARGETS.slice(1).map((target) => `JOIN p_${target.toLowerCase()} USING (lot_id)`).join(" ");
  return `WITH input AS (SELECT * FROM UNNEST(@lots)), ${ctes.join(", ")} SELECT p_warp.lot_id, ${columns} FROM p_warp ${joins}`;
}

export function lotsParameter(lots) {
  const value = (row, name) => {
    const raw = row[name];
    if (raw === undefined || raw === null) throw new Error(`lot ${row.lot_id}: ${name} is missing`);
    return { value: String(raw) };
  };
  return {
    name: "lots",
    parameterType: {
      type: "ARRAY",
      arrayType: { type: "STRUCT", structTypes: INPUT_COLUMNS.map(([name, type]) => ({ name, type: { type } })) },
    },
    parameterValue: {
      arrayValues: lots.map((row) => ({
        structValues: Object.fromEntries(INPUT_COLUMNS.map(([name]) => [name, value(row, name)])),
      })),
    },
  };
}

export function labelRows(lots) {
  return lots.map((row) => ({
    lotId: row.lot_id,
    unit: RATE_UNIT,
    split: row.dataset,
    source: row.label,
    ambientRhPct: row.ambient_rh_pct,
    rates: Object.fromEntries(TARGETS.map((target) => [target, row[`rate_${target.toLowerCase()}_pct`]])),
  }));
}

function cell(field) {
  return field?.v === null || field?.v === undefined ? null : Number(field.v);
}

async function runQuery({ project, location, query, parameter, maxBytes, token }) {
  const response = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${project}/queries`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query, useLegacySql: false, location, parameterMode: "NAMED", queryParameters: [parameter],
      maximumBytesBilled: String(maxBytes), timeoutMs: 120000, maxResults: 100000,
      labels: { purpose: "holdout-eval" },
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`BigQuery ${response.status}: ${body?.error?.message ?? "no message"}`);
  if (!body.jobComplete) throw new Error(`BigQuery job ${body.jobReference?.jobId} did not finish within the timeout`);
  return body;
}

async function main() {
  const { values } = parseArgs({
    options: {
      lots: { type: "string" }, models: { type: "string" }, out: { type: "string" },
      project: { type: "string", default: "prepagent-hack" }, dataset: { type: "string", default: "prepagent" },
      location: { type: "string", default: "asia-south1" }, "max-bytes": { type: "string", default: "104857600" },
      "token-command": { type: "string", default: "gcloud auth print-access-token" },
    },
  });
  if (!values.lots || !values.out || !MODEL_SETS[values.models]) {
    throw new Error("Usage: --lots <file> --models m|m2 --out <dir>");
  }
  const text = readFileSync(values.lots, "utf8");
  const lots = text.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
  const [command, ...args] = values["token-command"].split(" ");
  const token = execFileSync(command, args, { encoding: "utf8" }).trim();
  const body = await runQuery({
    project: values.project, location: values.location, maxBytes: Number(values["max-bytes"]), token,
    query: buildQuery(values.dataset, MODEL_SETS[values.models]), parameter: lotsParameter(lots),
  });
  const predictions = (body.rows ?? []).map((row) => ({
    lotId: row.f[0].v,
    unit: RATE_UNIT,
    rates: Object.fromEntries(TARGETS.map((target, index) => [target, cell(row.f[index + 1])])),
  }));
  if (predictions.length !== lots.length) {
    throw new Error(`expected ${lots.length} predictions, got ${predictions.length}`);
  }
  mkdirSync(values.out, { recursive: true });
  const toJsonl = (rows) => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  writeFileSync(join(values.out, `predictions-${values.models}.jsonl`), toJsonl(predictions));
  writeFileSync(join(values.out, "labels.jsonl"), toJsonl(labelRows(lots)));
  const record = {
    models: values.models, dataset: `${values.project}.${values.dataset}`, lotsFile: values.lots,
    lotsSha256: sha256(text), lots: lots.length, jobId: body.jobReference?.jobId,
    totalBytesProcessed: body.totalBytesProcessed, totalBytesBilled: body.totalBytesBilled ?? null,
  };
  writeFileSync(join(values.out, `job-${values.models}.json`), JSON.stringify(record, null, 2) + "\n");
  console.log(JSON.stringify(record));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
