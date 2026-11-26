import { DEFECTS } from "../../lib/api";

export type ApprovedPhoto = { id: string; label: string };
export type Classification = { photoId: string; label: string; classifiedAt?: string };

const PHOTO_ID = /^photo-\d{2}$/;
const LABELS: readonly string[] = [...DEFECTS.map((defect) => defect.key), "NONE"];

/** The route must return exactly ten approved photos; anything else is treated as unavailable. */
export function readApprovedPhotos(body: unknown): ApprovedPhoto[] | null {
  const photos = (body as { photos?: unknown })?.photos;
  if (!Array.isArray(photos) || photos.length !== 10) return null;
  const valid = photos.every((photo) => PHOTO_ID.test(photo?.id) && typeof photo?.label === "string");
  return valid ? photos.map(({ id, label }) => ({ id, label })) : null;
}

/** Only a Gemini result for the photo that was asked about, with a known label, is accepted. */
export function readClassification(body: unknown, photoId: string): Classification | null {
  const result = body as { source?: string; photoId?: string; label?: string; classifiedAt?: string };
  if (result?.source !== "vertex-gemini" || result.photoId !== photoId) return null;
  if (typeof result.label !== "string" || !LABELS.includes(result.label)) return null;
  return { photoId, label: result.label, classifiedAt: result.classifiedAt };
}

export function defectName(label: string) {
  if (label === "NONE") return "No visible defect";
  return DEFECTS.find((defect) => defect.key === label)?.label ?? "Not recorded";
}
