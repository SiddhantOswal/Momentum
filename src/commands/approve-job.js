import { getModelAcceptanceSummary, isModelSetAccepted } from "../model-acceptance.js";
import { JobIdSchema } from "../schemas.js";
import { authorizeApproval } from "./authorize.js";
import { liveActor, liveLot } from "./live-events.js";
import { validateDisplayPrefs, validateWith } from "./validation.js";

/**
 * Approves a stored draft. Only the dashboard Approve route calls this; no
 * Arc tool may reach it, because approval stays a human step.
 */
export async function approveJob({ jobId, lang, currency } = {}, {
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
