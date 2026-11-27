import { FirestoreRestError } from "../google-cloud/firestore-rest.js";
import { demoOwnsLot } from "../hackathon-demo-auth.js";
import { LotIdSchema } from "../state-schemas.js";
import { validateWith } from "./validation.js";

export function lotFailure(status, code, message, extra = {}) {
  return { ok: false, status, error: { code, message, ...extra } };
}

export const lotsUnavailable = () => lotFailure(503, "SERVICE_UNAVAILABLE", "Lot records are not available.");

/**
 * Shared checks for the lot commands, in the order a caller can fix them:
 * feature on, a demo session, a well-formed lot ID, then ownership.
 */
export function checkLotAccess(lotId, { principal, lotRevisions }) {
  if (lotRevisions?.enabled !== true || typeof lotRevisions.store?.getLot !== "function") return lotsUnavailable();
  if (!principal) return lotFailure(403, "DEMO_SCOPE_REQUIRED", "A session is required for lot records.");
  const validated = validateWith(LotIdSchema, lotId, "Lot ID failed validation.");
  if (!validated.ok) return validated.failure;
  if (!demoOwnsLot(principal, validated.data)) {
    return lotFailure(403, "DEMO_SCOPE_REQUIRED", "This lot does not belong to this session.");
  }
  return { ok: true, lotId: validated.data, store: lotRevisions.store };
}

/** Fails closed: a Firestore fault is 503, never an empty or in-memory answer. */
export function lotStoreFailure(error) {
  if (error?.name === "AbortError" || !(error instanceof FirestoreRestError)) throw error;
  return lotsUnavailable();
}
