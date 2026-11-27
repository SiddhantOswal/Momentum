// Defect diagnosis from a photo of a bad sheet: the photo is stored in Cloud Storage and
// Gemini (vision) names the visible defect, how severe it looks and what it can see.
// Causes and fixes are NOT asked of Gemini; they come from our lot history (seen-before query).
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { geminiUsageFailure } from "../daily-gemini-call-cap.js";
import { arcModelSettings } from "../arc-model-settings.js";

export const DIAGNOSIS_LABELS = ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK", "NONE"];
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const DiagnosisSchema = z.object({
  isCorrugatedBoard: z.boolean(),
  label: z.enum(DIAGNOSIS_LABELS),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  confidence: z.number().min(0).max(1),
  visibleSigns: z.array(z.string().min(1).max(120)).max(3),
}).strict();

const responseSchema = {
  type: "OBJECT",
  properties: {
    isCorrugatedBoard: { type: "BOOLEAN" },
    label: { type: "STRING", enum: DIAGNOSIS_LABELS },
    severity: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH"] },
    confidence: { type: "NUMBER" },
    visibleSigns: { type: "ARRAY", items: { type: "STRING" }, maxItems: 3 },
  },
  required: ["isCorrugatedBoard", "label", "severity", "confidence", "visibleSigns"],
};

const prompt = arcModelSettings.taskPrompt("photo", "diagnosis");

/** Recognises JPEG, PNG and WebP by their first bytes; anything else is refused. */
export function identifyPhotoMimeType(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 12) return undefined;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  return undefined;
}

const unavailable = () => ({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "The photo could not be diagnosed right now. Nothing was substituted; please try again." } });

export function createDefectDiagnosisService({ storage, gemini, bucket, model, now = () => new Date(), id = randomUUID } = {}) {
  if (!storage?.upload || !gemini?.generateJson || typeof bucket !== "string" || !bucket) {
    throw new TypeError("Cloud Storage, a metered Gemini client and a bucket are required.");
  }
  return Object.freeze({
    async diagnose({ bytes, signal } = {}) {
      const photo = bytes instanceof Uint8Array ? bytes : bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : undefined;
      if (!photo || photo.byteLength === 0 || photo.byteLength > MAX_PHOTO_BYTES) {
        return { ok: false, error: { code: "VALIDATION_ERROR", message: "Upload a photo up to 8 MB." } };
      }
      const mimeType = identifyPhotoMimeType(photo);
      if (!mimeType) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Upload a JPEG, PNG or WebP photo." } };
      const at = now();
      const extension = mimeType.split("/")[1].replace("jpeg", "jpg");
      const name = `defects/${at.toISOString().slice(0, 10)}/${id()}.${extension}`;
      try {
        await storage.upload({ name, contentType: mimeType, bytes: photo, signal });
        let modelUsage;
        const raw = await gemini.generateJson({ role: "photo", fileUri: `gs://${bucket}/${name}`, mimeType, prompt, responseSchema, signal, onUsage: (usage) => { modelUsage = usage; } });
        const parsed = DiagnosisSchema.safeParse(raw);
        if (!parsed.success) return unavailable();
        const diagnosis = parsed.data;
        if (!diagnosis.isCorrugatedBoard) {
          return { ok: true, source: "vertex-gemini", isRealModelPrediction: true, recognised: false, photo: { uri: `gs://${bucket}/${name}`, contentType: mimeType },
            message: "This doesn't look like corrugated board. Take a closer photo of the affected sheet.", model, diagnosedAt: at.toISOString(),
            generation: arcModelSettings.generation("photo") };
        }
        return {
          ok: true, source: "vertex-gemini", isRealModelPrediction: true, recognised: true,
          diagnosis: { label: diagnosis.label, severity: diagnosis.severity, confidence: Math.round(diagnosis.confidence * 100) / 100, visibleSigns: diagnosis.visibleSigns },
          photo: { uri: `gs://${bucket}/${name}`, contentType: mimeType },
          model, diagnosedAt: at.toISOString(),
          note: "Visual diagnosis by Gemini. Causes and fixes come from our lot history, not from the photo.",
          ...(modelUsage ? { modelUsage } : {}),
          generation: arcModelSettings.generation("photo"),
        };
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        return geminiUsageFailure(error) ?? unavailable();
      }
    },
  });
}
