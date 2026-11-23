import { FirestoreRestError } from "../google-cloud/firestore-rest.js";
import { isDemoPrincipal } from "../hackathon-demo-auth.js";
import { JobIdSchema } from "../schemas.js";
import { validateWith } from "./validation.js";

export async function getJob({ jobId } = {}, { principal, signal, lookupStoredJobSheet, lotRevisions }) {
  const validated = validateWith(JobIdSchema, jobId, "Job ID failed validation.");
  if (!validated.ok) return validated.failure;
  const stored = await lookupStoredJobSheet({ jobId: validated.data, signal });
  if (!stored.ok || lotRevisions?.enabled !== true || !isDemoPrincipal(principal)) return stored;
  try {
    const revision = await lotRevisions.store.getRevision({ jobId: validated.data, signal });
    return revision === null ? stored : {
      ...stored,
      revision: { lotId: revision.lotId, number: revision.number, fingerprint: revision.revisionFingerprint, status: revision.status },
    };
  } catch (error) {
    // Reading the job does not depend on Firestore. Without the block the client cannot send a fingerprint, so approval stays closed.
    if (error instanceof FirestoreRestError) return stored;
    throw error;
  }
}
