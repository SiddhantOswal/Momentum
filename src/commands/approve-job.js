import { z } from "zod";
import { FirestoreRestError } from "../google-cloud/firestore-rest.js";
import { getModelAcceptanceSummary, isModelSetAccepted } from "../model-acceptance.js";
import { JobIdSchema } from "../schemas.js";
import { authorizeApproval } from "./authorize.js";
import { liveActor, liveLot } from "./live-events.js";
import { Sha256HexSchema } from "../state-schemas.js";
import { lotFailure } from "./lot-access.js";
import { validateDisplayPrefs, validateWith } from "./validation.js";

const ApproveRequestSchema = z.object({
  reviewConfirmed: z.literal(true),
  revisionFingerprint: Sha256HexSchema,
}).strict();

const GUARD_MESSAGES = {
  REVISION_NOT_REGISTERED: "This draft has no registered revision. Plan the lot again to approve it.",
  REVISION_SUPERSEDED: "An input changed after this draft was prepared, so it is replaced and read only.",
  REVISION_FINGERPRINT_MISMATCH: "This draft is not the one that was reviewed. Reload the lot and review it again.",
  APPROVAL_IN_PROGRESS: "This draft is already being approved. Wait for the result.",
};

/**
 * The approve guard (ADR-0003, design 4.3). Returns `{ ok: true, began }`, where
 * `began` means this call holds the APPROVING lease, or a failure to return as is.
 * It fails closed: no store, or a Firestore fault, approves nothing.
 */
async function guardApproval({ jobId, body }, { lotRevisions, signal }) {
  const store = lotRevisions.store;
  if (typeof store?.beginApproval !== "function") {
    return lotFailure(503, "SERVICE_UNAVAILABLE", "Approval is unavailable until lot records are reachable.");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body) || body.reviewConfirmed !== true) {
    return lotFailure(400, "REVIEW_CONFIRMATION_REQUIRED", "Confirm that you reviewed this draft before approving it.");
  }
  const request = validateWith(ApproveRequestSchema, body, "Approval request failed validation.");
  if (!request.ok) return request.failure;
  const validatedJob = validateWith(JobIdSchema, jobId, "Job ID failed validation.");
  if (!validatedJob.ok) return validatedJob.failure;
  let begun;
  try {
    begun = await store.beginApproval({ jobId: validatedJob.data, revisionFingerprint: request.data.revisionFingerprint, signal });
  } catch (error) {
    if (error instanceof FirestoreRestError) {
      return lotFailure(503, "SERVICE_UNAVAILABLE", "Approval is unavailable until lot records are reachable.");
    }
    throw error;
  }
  if (!begun.ok) {
    const { code, ...rest } = begun;
    return lotFailure(409, code, GUARD_MESSAGES[code] ?? "This draft cannot be approved.", rest);
  }
  return { ok: true, began: begun.alreadyApproved !== true };
}

/**
 * Approves a stored draft. Only the dashboard Approve route calls this; no
 * Arc tool may reach it, because approval stays a human step.
 */
export async function approveJob(input = {}, deps) {
  if (deps.lotRevisions?.enforceGuard !== true) return approveStoredDraft(input, deps);
  const approver = authorizeApproval(deps.principal, deps);
  if (!approver.ok) return approver;
  const guard = await guardApproval(input, deps);
  if (!guard.ok) return guard;
  let result;
  try {
    result = await approveStoredDraft(input, deps);
  } catch (error) {
    if (guard.began) await settleRevision(input.jobId, false, deps);
    throw error;
  }
  if (guard.began) await settleRevision(input.jobId, result?.ok === true, deps);
  return result;
}

// The approval already ran. If this write is lost, the lease expires and the next approve takes it over.
async function settleRevision(jobId, approved, { lotRevisions, signal, log }) {
  try {
    await lotRevisions.store.finishApproval({ jobId, approved, signal });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    log(JSON.stringify({ event: "ustaad_revision_state_not_recorded", jobId, approved }));
  }
}

async function approveStoredDraft({ jobId, lang, currency } = {}, {
  principal,
  signal,
  servicePorts,
  liveStore,
  userSessionAuth,
  executionMode,
  modelAcceptanceConfig,
  newCorrelationId,
  now,
  log,
}) {
  const approver = authorizeApproval(principal, { userSessionAuth });
  if (!approver.ok) return approver;
  if (executionMode !== "demo" && !isModelSetAccepted(modelAcceptanceConfig)) {
    return {
      ok: false,
      status: 503,
      error: {
        code: "MODEL_ACCEPTANCE_REQUIRED",
        message: "Job approval is blocked until the current five-model set has complete version-linked acceptance evidence.",
      },
      modelAcceptance: getModelAcceptanceSummary(modelAcceptanceConfig),
    };
  }
  const validated = validateWith(JobIdSchema, jobId, "Job ID failed validation.");
  if (!validated.ok) return validated.failure;
  const displayPrefs = validateDisplayPrefs({ lang, currency });
  if (!displayPrefs.ok) return displayPrefs.failure;

  const approval = await servicePorts.approveJob({
    jobId: validated.data,
    lang: displayPrefs.data.lang,
    currency: displayPrefs.data.currency,
    ...(principal ? { supervisorPrincipal: principal, correlationId: newCorrelationId() } : {}),
    signal,
  });
  if (approval.ok && principal) {
    log(JSON.stringify({
      event: "ustaad_supervisor_action",
      action: "job_approval_request",
      actorUid: principal.uid,
      authorizationMode: principal.authorizationMode ?? "FIREBASE_SUPERVISOR",
      authenticatedHuman: principal.provider === "google.com",
      jobId: validated.data,
      decisionAt: new Date(now()).toISOString(),
      newStatus: approval.jobSheet?.status ?? approval.data?.status ?? "APPROVED",
      auditStorage: approval.jobSheet?.approvalAudit ? "bigquery-readback-and-structured-log" : "structured-cloud-log-only",
    }));
  }
  if (approval.ok && approval.jobSheet) {
    await liveStore.publish({
      lot: liveLot(approval.jobSheet, "approved"),
      event: { type: "lot.approved", lotId: approval.jobSheet.jobId, text: `Lot ${approval.jobSheet.order?.itemCode ?? approval.jobSheet.jobId} approved for production`, actor: liveActor(principal) },
    });
  }
  return approval;
}
