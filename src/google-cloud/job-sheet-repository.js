import { isDeepStrictEqual } from "node:util";
import { mapJobSheetFromBigQuery, mapJobSheetToBigQuery } from "../bigquery-mapper.js";
import { StoredJobSheetSchema } from "../schemas.js";
import { BigQueryReadError } from "./bigquery-read-client.js";

const JOB_SHEET_COLUMNS = Object.freeze([
  "job_id", "created_at", "plant_id", "status", "order_json", "conditions_json",
  "baseline_json", "recommended_json", "changes_json", "evidence_json", "explanation_en",
  "savings_kg", "savings_cost", "currency", "approved_at", "card_uri",
]);

function matchesDraftReadBack(stored, row, requireNewTimestamp) {
  const parsed = StoredJobSheetSchema.safeParse(stored);
  if (!parsed.success) return false;
  const sheet = parsed.data;
  const persistedJson = (value) => JSON.parse(JSON.stringify(value));
  return sheet.jobId === row.job_id &&
    (!requireNewTimestamp || sheet.createdAt === row.created_at) &&
    sheet.plantId === row.plant_id &&
    sheet.status === "DRAFT" &&
    isDeepStrictEqual(sheet.order, persistedJson(row.order_json)) &&
    isDeepStrictEqual(sheet.conditions, persistedJson(row.conditions_json)) &&
    isDeepStrictEqual(sheet.baseline, persistedJson(row.baseline_json)) &&
    isDeepStrictEqual(sheet.recommended, persistedJson(row.recommended_json)) &&
    isDeepStrictEqual(sheet.changes, persistedJson(row.changes_json)) &&
    isDeepStrictEqual(sheet.evidence, persistedJson(row.evidence_json)) &&
    sheet.explanation === row.explanation_en &&
    sheet.savings.kg === row.savings_kg &&
    sheet.savings.amount === row.savings_cost &&
    sheet.savings.currency === row.currency &&
    sheet.approvedAt === null &&
    sheet.cardUri === null;
}

function approvedReadBack(stored, jobId, cardUri) {
  const parsed = StoredJobSheetSchema.safeParse(stored);
  return parsed.success &&
    parsed.data.jobId === jobId &&
    parsed.data.status === "APPROVED" &&
    parsed.data.approvedAt !== null &&
    parsed.data.cardUri === cardUri;
}

function decodeRow(result) {
  const row = result?.rows?.[0];
  if (!row) return undefined;
  const fields = result?.schema?.fields;
  if (!Array.isArray(fields) || fields.length !== JOB_SHEET_COLUMNS.length ||
      fields.some((field, index) => field.name !== JOB_SHEET_COLUMNS[index])) {
    throw new BigQueryReadError("JOB_SHEET_SCHEMA_MISMATCH", "The stored job sheet has an unexpected schema.");
  }
  if (!Array.isArray(row.f) || row.f.length !== fields.length) {
    throw new BigQueryReadError("JOB_SHEET_ROW_INVALID", "The stored job sheet row is malformed.");
  }
  const values = Object.fromEntries(fields.map((field, index) => {
    const raw = row.f[index]?.v;
    if (raw === null || raw === undefined) return [field.name, null];
    if (field.type === "JSON") {
      try {
        return [field.name, typeof raw === "string" ? JSON.parse(raw) : raw];
      } catch {
        throw new BigQueryReadError("JOB_SHEET_ROW_INVALID", "The stored job sheet contains invalid JSON.");
      }
    }
    if (["FLOAT", "FLOAT64", "INTEGER", "INT64", "NUMERIC"].includes(field.type)) {
      const number = Number(raw);
      if (!Number.isFinite(number)) throw new BigQueryReadError("JOB_SHEET_ROW_INVALID", "The stored job sheet contains an invalid number.");
      return [field.name, number];
    }
    if (field.type === "TIMESTAMP") {
      // BigQuery's query API returns TIMESTAMP values as Unix seconds (often
      // in scientific notation), while the application contract is ISO 8601.
      const timestamp = typeof raw === "string" && Number.isFinite(Date.parse(raw))
        ? new Date(raw)
        : Number.isFinite(Number(raw)) ? new Date(Number(raw) * 1000) : undefined;
      if (!timestamp || !Number.isFinite(timestamp.getTime())) {
        throw new BigQueryReadError("JOB_SHEET_ROW_INVALID", "The stored job sheet contains an invalid timestamp.");
      }
      return [field.name, timestamp.toISOString()];
    }
    return [field.name, raw];
  }));
  return mapJobSheetFromBigQuery(values);
}

export function createJobSheetRepository({ bigquery, writer, projectId = "prepagent-hack", now = () => new Date() } = {}) {
  if (!bigquery || typeof bigquery.query !== "function" ||
      !writer || typeof writer.insertJobSheet !== "function" || typeof writer.approveDraft !== "function") {
    throw new TypeError("Bounded BigQuery read and write clients are required.");
  }
  if (typeof projectId !== "string" || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new TypeError("A valid Google Cloud project ID is required.");
  }

  const table = `\`${projectId}.prepagent.job_sheets\``;
  const columnList = JOB_SHEET_COLUMNS.join(", ");
  return Object.freeze({
    async createDraft({ jobSheet, plantId, savingsCost, currency = "INR", signal } = {}) {
      if (typeof jobSheet?.order?.orderId !== "string" || !jobSheet.order.orderId.startsWith("TEST-")) {
        throw new BigQueryReadError("TEST_RECORD_REQUIRED", "JobSheet writes are restricted to TEST- orders.");
      }
      const createdAt = now().toISOString();
      const row = mapJobSheetToBigQuery(jobSheet, {
        plantId,
        createdAt,
        savingsCost,
        currency,
        approvedAt: null,
        cardUri: null,
      });
      if (row.status !== "DRAFT") throw new TypeError("Only a DRAFT JobSheet can be initially persisted.");
      const write = await writer.insertJobSheet({ row, signal });
      if (typeof write?.inserted !== "boolean") {
        throw new BigQueryReadError("JOB_SHEET_WRITE_UNCONFIRMED", "The job sheet write returned an invalid result.");
      }
      const existing = await this.get(row.job_id, { signal });
      if (!matchesDraftReadBack(existing, row, write.inserted)) {
        throw new BigQueryReadError(
          "JOB_SHEET_WRITE_UNCONFIRMED",
          "The stored job sheet does not match the requested DRAFT."
        );
      }
      return Object.freeze({ ...jobSheet, plantId, status: "DRAFT", createdAt: existing.createdAt });
    },

    async get(jobId, { signal } = {}) {
      const result = await bigquery.query({
        sql: `SELECT ${columnList} FROM ${table} WHERE job_id = @jobId LIMIT 2`,
        parameters: { jobId },
        signal,
      });
      if ((result.rows ?? []).length > 1) {
        throw new BigQueryReadError("JOB_SHEET_NOT_UNIQUE", "More than one job sheet has this job ID.");
      }
      return decodeRow(result);
    },

    async approve({ jobId, cardUri, signal } = {}) {
      const current = await this.get(jobId, { signal });
      if (!current) return { ok: false, error: { code: "NOT_FOUND", message: "The job sheet was not found." } };
      if (!current.order.orderId.startsWith("TEST-")) {
        return {
          ok: false,
          error: { code: "TEST_RECORD_REQUIRED", message: "JobSheet approval writes are restricted to TEST- orders." },
        };
      }
      if (current.status === "APPROVED" && current.cardUri) return { ok: true, data: current };
      if (current.status !== "DRAFT") {
        return { ok: false, error: { code: "CONFLICT", message: "Only a DRAFT job can be approved." } };
      }
      const approvedAt = now().toISOString();
      const update = await writer.approveDraft({ jobId, approvedAt, cardUri, signal });
      const saved = await this.get(jobId, { signal });
      if (approvedReadBack(saved, jobId, cardUri)) {
        return { ok: true, data: saved };
      }
      if (update.affectedRows !== 1) {
        return { ok: false, error: { code: "CONFLICT", message: "The job changed before approval could be recorded." } };
      }
      throw new BigQueryReadError(
        "JOB_SHEET_APPROVAL_UNCONFIRMED",
        "The approval update could not be confirmed by reading the stored job sheet."
      );
    },
  });
}

export { decodeRow as decodeStoredJobSheetRow, JOB_SHEET_COLUMNS };
