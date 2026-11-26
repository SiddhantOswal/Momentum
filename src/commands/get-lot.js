import { checkLotAccess, lotFailure, lotStoreFailure } from "./lot-access.js";

/** The lot in progress and its current revision, for "Next for you" and the replaced-draft view. */
export async function getLot({ lotId } = {}, { principal, signal, lotRevisions }) {
  const access = checkLotAccess(lotId, { principal, lotRevisions });
  if (!access.ok) return access;
  let found;
  try {
    found = await access.store.getLot({ lotId: access.lotId, ownerSessionId: principal.sessionId, signal });
  } catch (error) {
    return lotStoreFailure(error);
  }
  if (!found) return lotFailure(404, "LOT_NOT_FOUND", "No lot with this ID in this session.");
  const { head, revision } = found;
  return {
    ok: true,
    lot: {
      lotId: head.lotId,
      stage: head.stage,
      currentRevision: head.currentRevision,
      currentJobId: head.currentJobId,
      // The confirmed catalog item and quantity only; the order ID stays on the server.
      order: head.orderRef && { itemCode: head.orderRef.itemCode, quantity: head.orderRef.quantity },
      draftConditions: head.draftConditions,
      version: head.version,
      updatedAt: head.updatedAt,
    },
    revision: revision && {
      jobId: revision.jobId,
      number: revision.number,
      status: revision.status,
      fingerprint: revision.revisionFingerprint,
      supersededBy: revision.supersededBy,
      supersededReason: revision.supersededReason,
      conditions: revision.conditions,
    },
  };
}
