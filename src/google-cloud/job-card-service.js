import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { StoredJobSheetSchema, JobSheetSchema } from "../schemas.js";
import { BigQueryWriteError } from "./bigquery-write-client.js";
import { CloudStorageError } from "./storage-client.js";

function unavailable(message = "Job-card storage is temporarily unavailable.") {
  return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message } };
}

function asPrintableJobSheet(stored, status) {
  const job = StoredJobSheetSchema.parse(stored);
  return JobSheetSchema.parse({
    jobId: job.jobId,
    plantId: job.plantId,
    order: job.order,
    conditions: job.conditions,
    baseline: job.baseline,
    recommended: job.recommended,
    changes: job.changes,
    evidence: job.evidence,
    explanation: job.explanation,
    savings: { kg: job.savings.kg, inr: job.savings.amount },
    status,
  });
}

function parseBucketUri(uri, bucket) {
  const prefix = `gs://${bucket}/`;
  if (typeof uri !== "string" || !uri.startsWith(prefix)) return undefined;
  const name = uri.slice(prefix.length);
  return name.length ? name : undefined;
}

async function cleanUploadedObject(storage, uploaded, signal) {
  try {
    await storage.delete({ name: uploaded.name, generation: uploaded.generation, signal });
    return true;
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    return false;
  }
}

function approvedJobSheet(value, jobId, cardUri) {
  const parsed = StoredJobSheetSchema.safeParse(value);
  return parsed.success &&
    parsed.data.jobId === jobId &&
    parsed.data.status === "APPROVED" &&
    parsed.data.approvedAt !== null &&
    parsed.data.cardUri === cardUri
    ? parsed.data
    : undefined;
}

async function reconcileApproval({ repository, storage, uploaded, jobId, approval, signal }) {
  let stored;
  try {
    stored = await repository.get(jobId, { signal });
  } catch (error) {
    if (error?.name === "AbortError" || signal?.aborted) throw error;
    return unavailable("Approval outcome could not be confirmed; the uploaded card was retained for recovery.");
  }

  const parsed = stored === null || stored === undefined
    ? undefined
    : StoredJobSheetSchema.safeParse(stored);
  if (stored !== null && stored !== undefined &&
      (!parsed?.success || parsed.data.jobId !== jobId)) {
    return unavailable("The stored approval state is invalid; the uploaded card was retained for recovery.");
  }
  if (parsed?.success && parsed.data.status === "APPROVED" &&
      parsed.data.approvedAt !== null && parsed.data.cardUri) {
    if (parsed.data.cardUri !== uploaded.gcsUri &&
        !await cleanUploadedObject(storage, uploaded, signal)) {
      return unavailable("Approval is confirmed but unused uploaded-card cleanup could not be confirmed.");
    }
    return { ok: true, agent: "approveJob", jobSheet: parsed.data, cardUri: parsed.data.cardUri };
  }
  if (parsed?.success && parsed.data.cardUri === uploaded.gcsUri) {
    return unavailable("The stored job references this card without a valid APPROVED state; the card was retained.");
  }
  if (!await cleanUploadedObject(storage, uploaded, signal)) {
    return unavailable("Approval was not confirmed and uploaded-card cleanup could not be confirmed.");
  }
  if (approval?.ok === false) return approval;
  return unavailable(
    parsed?.success && parsed.data.status !== "DRAFT"
      ? "The job changed before approval could be confirmed."
      : "The approval update could not be confirmed.",
  );
}

export function createJobCardService({ repository, storage, renderPdf, bucket } = {}) {
  if (!repository || typeof repository.get !== "function" || typeof repository.approve !== "function" ||
      !storage || typeof storage.upload !== "function" || typeof storage.download !== "function" ||
      typeof storage.delete !== "function" || typeof renderPdf !== "function" ||
      typeof bucket !== "string" || !/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket)) {
    throw new TypeError("Job-sheet repository, Cloud Storage, PDF rendering, and bucket are required.");
  }

  return Object.freeze({
    async approveJob({ jobId, lang = "en", currency = "INR", signal } = {}) {
      if (lang !== "en" || currency !== "INR") {
        return unavailable("Translated or converted stored job cards are not configured.");
      }

      let uploaded;
      let approvalAttempted = false;
      try {
        const existing = await repository.get(jobId, { signal });
        if (!existing) return { ok: false, error: { code: "NOT_FOUND", message: "The job sheet was not found." } };
        const stored = StoredJobSheetSchema.parse(existing);
        if (!stored.order.orderId.startsWith("TEST-")) {
          return {
            ok: false,
            error: { code: "TEST_RECORD_REQUIRED", message: "Job-card generation is restricted to TEST- orders." },
          };
        }
        if (stored.status === "APPROVED" && stored.cardUri) {
          return { ok: true, agent: "approveJob", jobSheet: stored, cardUri: stored.cardUri };
        }
        if (stored.status !== "DRAFT") {
          return { ok: false, error: { code: "CONFLICT", message: "Only a DRAFT job can be approved." } };
        }

        const printable = asPrintableJobSheet(stored, "APPROVED");
        const bytes = await renderPdf(printable, { locale: "en" });
        const objectName = `jobcards/${encodeURIComponent(stored.jobId)}-${randomUUID()}.pdf`;
        uploaded = await storage.upload({
          name: objectName,
          contentType: "application/pdf",
          bytes,
          signal,
        });
        const expectedUri = `gs://${bucket}/${objectName}`;
        if (uploaded?.name !== objectName ||
            uploaded?.gcsUri !== expectedUri ||
            typeof uploaded?.generation !== "string" ||
            uploaded.generation.length === 0) {
          if (uploaded?.name && uploaded?.generation) {
            const cleaned = await cleanUploadedObject(storage, uploaded, signal);
            if (!cleaned) return unavailable("Storage returned an invalid card reference and cleanup could not be confirmed.");
          } else {
            return unavailable("Storage returned an invalid card reference; the uploaded object could not be safely identified for cleanup.");
          }
          return unavailable("Storage returned an invalid uploaded-card reference.");
        }
        approvalAttempted = true;
        const approval = await repository.approve({ jobId: stored.jobId, cardUri: uploaded.gcsUri, signal });
        const approved = approval?.ok === true
          ? approvedJobSheet(approval.data, stored.jobId, uploaded.gcsUri)
          : undefined;
        if (!approved) {
          return reconcileApproval({ repository, storage, uploaded, jobId: stored.jobId, approval, signal });
        }
        return { ok: true, agent: "approveJob", jobSheet: approved, cardUri: approved.cardUri };
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        if (uploaded?.name && uploaded?.generation) {
          if (approvalAttempted) {
            return reconcileApproval({ repository, storage, uploaded, jobId, signal });
          }
          if (!await cleanUploadedObject(storage, uploaded, signal)) {
            return unavailable("Job-card generation failed and uploaded-card cleanup could not be confirmed.");
          }
        }
        if (error instanceof BigQueryWriteError || error instanceof CloudStorageError) return unavailable();
        return unavailable();
      }
    },

    async getJobCard({ jobId, lang = "en", currency = "INR", signal } = {}) {
      if (lang !== "en" || currency !== "INR") {
        return unavailable("Translated or converted stored job cards are not configured.");
      }
      try {
        const stored = await repository.get(jobId, { signal });
        if (!stored) return { ok: false, error: { code: "NOT_FOUND", message: "The job sheet was not found." } };
        const parsed = StoredJobSheetSchema.parse(stored);
        if (parsed.status !== "APPROVED" || !parsed.approvedAt || !parsed.cardUri) {
          return { ok: false, error: { code: "CONFLICT", message: "The job card is not available until approval." } };
        }
        const name = parseBucketUri(parsed.cardUri, bucket);
        if (!name) return unavailable("The stored job-card reference is invalid.");
        const file = await storage.download({ name, signal });
        if (file.contentType !== "application/pdf" || Buffer.from(file.bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") {
          return unavailable("The stored job card is not a valid PDF.");
        }
        return { ok: true, contentType: "application/pdf", bytes: file.bytes, filename: `${parsed.jobId}.pdf` };
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        if (error instanceof BigQueryWriteError || error instanceof CloudStorageError) return unavailable();
        return unavailable();
      }
    },
  });
}
