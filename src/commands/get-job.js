import { JobIdSchema } from "../schemas.js";
import { validateWith } from "./validation.js";

export async function getJob({ jobId } = {}, { signal, lookupStoredJobSheet }) {
  const validated = validateWith(JobIdSchema, jobId, "Job ID failed validation.");
  if (!validated.ok) return validated.failure;
  return lookupStoredJobSheet({ jobId: validated.data, signal });
}
