import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const models = ["m_warp", "m_delam", "m_strength", "m_print", "m_crack"];
const groupedCandidates = models.map((model) => `${model}_grouped_v1`);
const targets = [
  "rate_warp_pct",
  "rate_delam_pct",
  "rate_strength_pct",
  "rate_print_pct",
  "rate_crack_pct",
];

function readSql(name) {
  return readFileSync(new URL(`../sql/${name}`, import.meta.url), "utf8");
}

function executableSql(sql) {
  return sql.replace(/^--.*$/gm, "");
}

test("model evaluation query covers all five existing models without mutation", () => {
  const sql = readSql("model_evaluation.sql");

  for (const model of models) {
    assert.ok(sql.includes(`ML.EVALUATE(MODEL \`prepagent-hack.prepagent.${model}\`)`));
    assert.ok(sql.includes(`SELECT '${model}' AS model_name`));
  }
  assert.doesNotMatch(executableSql(sql), /\b(?:CREATE|REPLACE|INSERT|UPDATE|DELETE|MERGE|DROP|ALTER)\b/i);
  assert.match(sql, /saved evaluation split/i);
});

test("model feature-importance query covers all five existing models without mutation", () => {
  const sql = readSql("model_feature_importance.sql");

  for (const model of models) {
    assert.ok(sql.includes(`ML.FEATURE_IMPORTANCE(MODEL \`prepagent-hack.prepagent.${model}\`)`));
    assert.ok(sql.includes(`SELECT '${model}' AS model_name`));
  }
  assert.match(sql, /feature,\s*importance_gain,\s*importance_cover,\s*importance_weight/);
  assert.doesNotMatch(executableSql(sql), /\b(?:CREATE|REPLACE|INSERT|UPDATE|DELETE|MERGE|DROP|ALTER)\b/i);
});

test("grouped candidate training isolates whole customers and never replaces active models", () => {
  const sql = executableSql(readSql("model_grouped_candidate_training.sql"));

  for (const [index, model] of groupedCandidates.entries()) {
    assert.ok(sql.includes(`CREATE MODEL \`prepagent-hack.prepagent.${model}\``));
    assert.ok(sql.includes(`input_label_cols = ['${targets[index]}']`));
  }
  assert.doesNotMatch(sql, /\bCREATE\s+OR\s+REPLACE\s+MODEL\b/i);
  assert.match(sql, /data_split_method\s*=\s*'NO_SPLIT'/i);
  assert.match(sql, /FARM_FINGERPRINT\(customer_id\)/);
  assert.match(sql, /evaluation_bucket\s*<\s*evaluation_bucket_limit/);
  assert.match(sql, /evaluation_bucket\s*>=\s*evaluation_bucket_limit/);
  assert.match(sql, /INTERSECT\s+DISTINCT/i);
  assert.match(sql, /pre-September training rows/i);

  const modelStatements = sql.split("CREATE MODEL ").slice(1);
  assert.equal(modelStatements.length, 5);
  for (const [index, statement] of modelStatements.entries()) {
    const excludedColumns = statement.match(/SELECT \* EXCEPT \(([\s\S]*?)\)/)?.[1];
    assert.ok(excludedColumns);
    assert.match(excludedColumns, /\bcustomer_id\b/);
    assert.match(statement, /\blot_id\b/);
    assert.match(statement, /\border_id\b/);
    assert.match(statement, /\bitem_code\b/);
    assert.doesNotMatch(excludedColumns, /\bsheet_area_m2\b/);
    assert.doesNotMatch(excludedColumns, /\bbox_weight_kg\b/);
    assert.match(statement, /\bprimary_defect\b/);
    assert.doesNotMatch(excludedColumns, new RegExp(`\\b${targets[index]}\\b`));
  }
});

test("grouped candidate evaluation and feature importance are read-only and share one split", () => {
  const evaluationSource = readSql("model_grouped_candidate_evaluation.sql");
  const evaluation = executableSql(evaluationSource);
  const importance = executableSql(readSql("model_grouped_candidate_feature_importance.sql"));

  for (const model of groupedCandidates) {
    assert.ok(evaluation.includes(`ML.EVALUATE(\n  MODEL \`prepagent-hack.prepagent.${model}\``));
    assert.ok(importance.includes(`ML.FEATURE_IMPORTANCE(MODEL \`prepagent-hack.prepagent.${model}\`)`));
  }
  assert.match(evaluation, /customer-fingerprint-mod100-lt51-v1/);
  assert.match(evaluation, /'prepagent-hack\.prepagent\.lots' AS evaluated_dataset/);
  assert.match(evaluation, /training_cutoff_exclusive/);
  assert.match(evaluation, /evaluation_start_date/);
  assert.match(evaluation, /evaluation_end_date/);
  assert.match(evaluation, /AS model_version/);
  assert.match(evaluationSource, /never CREATE OR REPLACE/);
  assert.match(evaluation, /evaluation_bucket\s*<\s*51/);
  assert.match(evaluation, /COUNT\(DISTINCT IF\(evaluation_bucket < 51, customer_id, NULL\)\)\s+AS evaluation_customers/);
  assert.match(importance, /feature,\s*importance_gain,\s*importance_cover,\s*importance_weight/);
  const evaluationInputs = evaluation.split("FROM ML.EVALUATE").slice(1);
  assert.equal(evaluationInputs.length, 5);
  for (const [index, input] of evaluationInputs.entries()) {
    const excludedColumns = input.match(/SELECT \* EXCEPT \(([\s\S]*?)\)/)?.[1];
    assert.ok(excludedColumns);
    assert.match(excludedColumns, /\bcustomer_id\b/);
    assert.doesNotMatch(excludedColumns, new RegExp(`\\b${targets[index]}\\b`));
    assert.match(input, /WHERE evaluation_bucket < 51/);
  }
  assert.doesNotMatch(importance, /\bcustomer_id\b/i);
  assert.doesNotMatch(evaluation, /\b(?:CREATE|REPLACE|INSERT|UPDATE|DELETE|MERGE|DROP|ALTER)\b/i);
  assert.doesNotMatch(importance, /\b(?:CREATE|REPLACE|INSERT|UPDATE|DELETE|MERGE|DROP|ALTER)\b/i);
});
