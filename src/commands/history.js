import { SeenBeforeRequestSchema } from "../schemas.js";
import { validateWith } from "./validation.js";

/** Past lots that showed the same defect at similar humidity. */
export async function findSeenBefore(input, { signal, servicePorts }) {
  const validated = validateWith(SeenBeforeRequestSchema, input, "Historical defect-evidence request failed validation.");
  if (!validated.ok) return validated.failure;
  return servicePorts.findSeenBefore({ ...validated.data, signal });
}
