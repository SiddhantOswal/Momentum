import { DEFECTS, type Defect } from "../../lib/api";
import { send } from "../../lib/session";

export type Label = Defect | "NONE";

/** `GET /evidence/approved-photos`: IDs and labels only; the image bytes stay on the server. */
export type ApprovedPhotos = { photos: { id: string; label: string }[]; provenance?: string };

/** `POST /evidence/classify-photo`: one label for one approved photo. */
export type Classification = { source: string; photoId: string; label: Label; model?: string; classifiedAt?: string };

/** `POST /evidence/diagnose-photo`: a visual diagnosis of an uploaded photo. */
export type UploadDiagnosis = {
  source: string; recognised: boolean; message?: string; note?: string;
  diagnosis?: { label: Label; severity: "LOW" | "MEDIUM" | "HIGH"; confidence: number; visibleSigns: string[] };
};

/** `POST /evidence/seen-before`: past lots at similar humidity where this defect was the main one. */
export type SeenBefore = { source?: string; defect?: Defect; caseCount?: number; avgRateWhenMain?: number; costWhenMain?: number };

/** `GET /conditions/weather`: the public weather record for the plant's city. */
export type Weather = { ambientRhPct: number; observedAt?: string; location?: string };

export const classifyPhoto = (photoId: string) =>
  send<Classification>("/evidence/classify-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId }) });

export function diagnoseUpload(file: File) {
  const body = new FormData();
  body.append("file", file);
  return send<UploadDiagnosis>("/evidence/diagnose-photo", { method: "POST", body });
}

export const findSeenBefore = (defect: Defect, ambientRhPct: number) =>
  send<SeenBefore>("/evidence/seen-before", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defect, ambientRhPct }) });

// The same limits the server applies (identifyPhotoMimeType in src/google-cloud/defect-diagnosis-service.js),
// checked first so a refused file never spends a Gemini attempt. The file's first bytes decide, not
// its name or the type the browser guessed from it.
const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp";
export const UPLOAD_REFUSED = "Upload a JPEG, PNG or WebP photo up to 8 MiB.";

function isPhotoSignature(bytes: Uint8Array) {
  if (bytes.byteLength < 12) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}

export async function uploadAllowed(file: File) {
  if (file.size === 0 || file.size > UPLOAD_MAX_BYTES) return false;
  try {
    return isPhotoSignature(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  } catch {
    return false;
  }
}

export const defectName = (label: Label) => (label === "NONE" ? "No defect seen" : DEFECTS.find((d) => d.key === label)?.label ?? label);
