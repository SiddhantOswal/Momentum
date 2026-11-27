import { PhotoClassificationRequestSchema } from "../google-cloud/approved-photo-service.js";
import { liveActor } from "./live-events.js";
import { validateWith, validationFailure } from "./validation.js";

const defectNames = { WARP: "Warp", DELAM: "Delamination", STRENGTH: "Crushed board", PRINT: "Print defect", CRACK: "Crease cracking" };

export async function listApprovedPhotos(_input, { servicePorts }) {
  return servicePorts.getApprovedPhotos();
}

export async function classifyApprovedPhoto(input, { signal, servicePorts }) {
  const validated = validateWith(PhotoClassificationRequestSchema, input, "Select one approved photo ID only.");
  if (!validated.ok) return validated.failure;
  return servicePorts.classifyApprovedPhoto({ ...validated.data, signal });
}

/**
 * Defect Intelligence: a photo of a bad sheet, then a Gemini diagnosis, then past lots
 * with that defect at similar humidity. Causes come from our history only.
 * `fields` holds the multipart upload: `file`, optional `ambientRhPct` and `lotId`.
 */
export async function diagnoseUploadedPhoto({ fields = {} } = {}, { principal, signal, servicePorts, liveStore }) {
  const file = fields.file;
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return validationFailure([{ field: "file", path: ["file"], code: "invalid_type", message: "A photo is required in the file field." }], "Photo upload is invalid.");
  }
  const rawRh = typeof fields.ambientRhPct === "string" && fields.ambientRhPct.trim() !== "" ? Number(fields.ambientRhPct) : undefined;
  if (rawRh !== undefined && !(Number.isFinite(rawRh) && rawRh >= 0 && rawRh <= 100)) {
    return validationFailure([{ field: "ambientRhPct", path: ["ambientRhPct"], code: "invalid_value", message: "Humidity must be between 0 and 100%." }], "Photo upload is invalid.");
  }
  const lotId = typeof fields.lotId === "string" && /^[A-Za-z0-9_-]{1,120}$/.test(fields.lotId) ? fields.lotId : undefined;
  const result = await servicePorts.diagnoseDefectPhoto({ bytes: new Uint8Array(await file.arrayBuffer()), signal });
  if (!result?.ok || !result.recognised || result.diagnosis.label === "NONE") return result;
  const pastCases = rawRh === undefined ? undefined
    : await servicePorts.findSeenBefore({ defect: result.diagnosis.label, ambientRhPct: rawRh, signal }).catch(() => undefined);
  const defectName = defectNames[result.diagnosis.label];
  await liveStore.publish({ event: { type: "defect.logged", ...(lotId ? { lotId } : {}), text: `${defectName} spotted on a photo · ${result.diagnosis.severity.toLowerCase()} severity`, actor: liveActor(principal) } });
  return { ...result, ...(rawRh === undefined ? {} : { ambientRhPct: rawRh }), ...(pastCases?.ok ? { pastCases } : {}) };
}
