import { JobIdSchema } from "../schemas.js";
import { validateDisplayPrefs, validateWith } from "./validation.js";

/** Returns the approved job-card PDF as `{ ok, bytes, contentType, filename }`. */
export async function getCard({ jobId, lang, currency } = {}, { principal, signal, servicePorts }) {
  const validated = validateWith(JobIdSchema, jobId, "Job ID failed validation.");
  if (!validated.ok) return validated.failure;
  const displayPrefs = validateDisplayPrefs({ lang, currency });
  if (!displayPrefs.ok) return displayPrefs.failure;
  return servicePorts.getJobCard({
    jobId: validated.data,
    lang: displayPrefs.data.lang,
    currency: displayPrefs.data.currency,
    supervisorPrincipal: principal,
    signal,
  });
}
