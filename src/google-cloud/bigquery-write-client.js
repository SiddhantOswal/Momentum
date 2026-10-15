import { createCloudRunAccessTokenProvider } from "./bigquery-read-client.js";
import { ApprovalAuditSchema } from "../schemas.js";

const BIGQUERY_API = "https://bigquery.googleapis.com/bigquery/v2";
const ALLOWED_TABLES = new Set(["feedback"]);

export class BigQueryWriteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BigQueryWriteError";
    this.code = code;
  }
}

export function createBigQueryWriteClient({ projectId, datasetId = "prepagent", location = "asia-south1", fetchImpl = fetch, tokenProvider, requireApprovalAudit = false } = {}) {
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new TypeError("A valid Google Cloud project ID is required.");
  }
  if (datasetId !== "prepagent") throw new TypeError("Only the configured prepagent dataset is supported.");
  if (typeof fetchImpl !== "function") throw new TypeError("Fetch provider must be a function.");
  const provideToken = tokenProvider ?? createCloudRunAccessTokenProvider({ fetchImpl });

  async function request(url, options, signal) {
    const token = await provideToken({ signal });
    if (typeof token !== "string" || token.length === 0) {
      throw new BigQueryWriteError("CLOUD_IDENTITY_UNAVAILABLE", "Cloud Run workload identity is unavailable.");
    }
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
        signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new BigQueryWriteError("BIGQUERY_UNAVAILABLE", "BigQuery could not be reached.");
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new BigQueryWriteError("BIGQUERY_INVALID_RESPONSE", "BigQuery returned an invalid response.");
    }
    if (!response.ok || payload?.error) {
      throw new BigQueryWriteError("BIGQUERY_WRITE_FAILED", "BigQuery did not accept the write operation.");
    }
    return payload;
  }

  return Object.freeze({
    async insertJobSheet({ row, signal } = {}) {
      if (typeof row?.order_json?.orderId !== "string" || !row.order_json.orderId.startsWith("TEST-")) {
        throw new BigQueryWriteError("TEST_RECORD_REQUIRED", "JobSheet writes require a validated TEST- order.");
      }
      if (!row || typeof row !== "object" || row.status !== "DRAFT" ||
          typeof row.job_id !== "string" || row.job_id.length < 1 || row.job_id.length > 128) {
        throw new BigQueryWriteError("INVALID_JOB_SHEET", "A valid DRAFT job-sheet row is required.");
      }
      const jsonFields = ["order_json", "conditions_json", "baseline_json", "recommended_json", "changes_json", "evidence_json"];
      const jsonParameters = Object.fromEntries(jsonFields.map((name) => {
        const value = JSON.stringify(row[name]);
        if (typeof value !== "string" || value.length > 1024 * 1024) {
          throw new BigQueryWriteError("JOB_SHEET_TOO_LARGE", "Job-sheet JSON fields exceed the bounded write size.");
        }
        return [name, value];
      }));
      const sql = `MERGE \`${projectId}.${datasetId}.job_sheets\` AS target
USING (SELECT @jobId AS job_id) AS source
ON target.job_id = source.job_id
WHEN NOT MATCHED THEN INSERT (
  job_id, created_at, plant_id, status, order_json, conditions_json,
  baseline_json, recommended_json, changes_json, evidence_json, explanation_en,
  savings_kg, savings_cost, currency, approved_at, card_uri
) VALUES (
  @jobId, @createdAt, @plantId, 'DRAFT', PARSE_JSON(@orderJson), PARSE_JSON(@conditionsJson),
  PARSE_JSON(@baselineJson), PARSE_JSON(@recommendedJson), PARSE_JSON(@changesJson),
  PARSE_JSON(@evidenceJson), @explanation, @savingsKg, @savingsCost, @currency,
  NULL, NULL
)`;
      const params = [
        ["jobId", "STRING", row.job_id],
        ["createdAt", "TIMESTAMP", row.created_at],
        ["plantId", "STRING", row.plant_id],
        ["orderJson", "STRING", jsonParameters.order_json],
        ["conditionsJson", "STRING", jsonParameters.conditions_json],
        ["baselineJson", "STRING", jsonParameters.baseline_json],
        ["recommendedJson", "STRING", jsonParameters.recommended_json],
        ["changesJson", "STRING", jsonParameters.changes_json],
        ["evidenceJson", "STRING", jsonParameters.evidence_json],
        ["explanation", "STRING", row.explanation_en],
        ["savingsKg", "FLOAT64", row.savings_kg],
        ["savingsCost", "FLOAT64", row.savings_cost],
        ["currency", "STRING", row.currency],
      ].map(([name, type, value]) => ({
        name,
        parameterType: { type },
        parameterValue: { value: String(value) },
      }));
      const payload = await request(`${BIGQUERY_API}/projects/${encodeURIComponent(projectId)}/queries`, {
        method: "POST",
        body: JSON.stringify({
          query: sql,
          useLegacySql: false,
          location,
          maximumBytesBilled: "52428800",
          parameterMode: "NAMED",
          queryParameters: params,
        }),
      }, signal);
      if (payload.jobComplete !== true || payload.errors?.length) {
        throw new BigQueryWriteError("BIGQUERY_WRITE_PENDING", "The job-sheet write did not finish successfully.");
      }
      return Object.freeze({ inserted: Number(payload.numDmlAffectedRows ?? 0) === 1 });
    },

    async insertRow({ table, insertId, row, testOrderId, signal } = {}) {
      if (!ALLOWED_TABLES.has(table)) throw new BigQueryWriteError("TABLE_NOT_ALLOWED", "This BigQuery table is not enabled for writes.");
      if (typeof testOrderId !== "string" || !testOrderId.startsWith("TEST-")) {
        throw new BigQueryWriteError("TEST_RECORD_REQUIRED", "Feedback writes require the validated stored TEST- order identity.");
      }
      if (typeof insertId !== "string" || insertId.length < 1 || insertId.length > 128 || !row || typeof row !== "object" || Array.isArray(row)) {
        throw new BigQueryWriteError("INVALID_INSERT", "A bounded insert ID and row object are required.");
      }
      const url = `${BIGQUERY_API}/projects/${encodeURIComponent(projectId)}/datasets/${datasetId}/tables/${table}/insertAll`;
      const payload = await request(url, {
        method: "POST",
        body: JSON.stringify({
          skipInvalidRows: false,
          ignoreUnknownValues: false,
          rows: [{ insertId, json: row }],
        }),
      }, signal);
      if (Array.isArray(payload.insertErrors) && payload.insertErrors.length > 0) {
        throw new BigQueryWriteError("BIGQUERY_ROW_REJECTED", "BigQuery rejected the row against the table schema.");
      }
      return Object.freeze({ inserted: true, insertId });
    },

    async approveDraft({ jobId, approvedAt, cardUri, approvalAudit, signal } = {}) {
      if (typeof jobId !== "string" || jobId.length < 1 || jobId.length > 128 ||
          typeof approvedAt !== "string" || typeof cardUri !== "string" || !cardUri.startsWith("gs://")) {
        throw new BigQueryWriteError("INVALID_APPROVAL", "A job ID, approval timestamp, and Cloud Storage URI are required.");
      }
      const audit = approvalAudit === undefined ? undefined : ApprovalAuditSchema.parse(approvalAudit);
      if (requireApprovalAudit && !audit) throw new BigQueryWriteError("INVALID_APPROVAL_AUDIT", "A complete verified actor audit is required.");
      if (audit && (audit.jobId !== jobId || audit.cardUri !== cardUri || audit.decidedAt !== approvedAt)) {
        throw new BigQueryWriteError("INVALID_APPROVAL_AUDIT", "The approval actor audit does not match the decision.");
      }
      const sql = `UPDATE \`${projectId}.${datasetId}.job_sheets\`
SET status = 'APPROVED', approved_at = @approvedAt, card_uri = @cardUri${audit ? ", approval_audit_json = PARSE_JSON(@approvalAudit)" : ""}
WHERE job_id = @jobId AND status = 'DRAFT'
  AND STARTS_WITH(JSON_VALUE(order_json, '$.orderId'), 'TEST-')`;
      const payload = await request(`${BIGQUERY_API}/projects/${encodeURIComponent(projectId)}/queries`, {
        method: "POST",
        body: JSON.stringify({
          query: sql,
          useLegacySql: false,
          location,
          maximumBytesBilled: "52428800",
          parameterMode: "NAMED",
          queryParameters: [
            { name: "approvedAt", parameterType: { type: "TIMESTAMP" }, parameterValue: { value: approvedAt } },
            { name: "cardUri", parameterType: { type: "STRING" }, parameterValue: { value: cardUri } },
            { name: "jobId", parameterType: { type: "STRING" }, parameterValue: { value: jobId } },
            ...(audit ? [{ name: "approvalAudit", parameterType: { type: "STRING" }, parameterValue: { value: JSON.stringify(audit) } }] : []),
          ],
        }),
      }, signal);
      if (payload.jobComplete !== true || payload.errors?.length) {
        throw new BigQueryWriteError("BIGQUERY_APPROVAL_PENDING", "The approval update did not finish successfully.");
      }
      return Object.freeze({ affectedRows: Number(payload.numDmlAffectedRows ?? 0) });
    },
  });
}
