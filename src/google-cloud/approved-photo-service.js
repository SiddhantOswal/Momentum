import { createHash } from "node:crypto";
import { z } from "zod";
import { identifyPurchaseOrderMimeType } from "../purchase-order-file.js";
import { geminiUsageFailure } from "../daily-gemini-call-cap.js";
import { arcModelSettings } from "../arc-model-settings.js";

export const PhotoClassificationRequestSchema = z.object({ photoId: z.string().regex(/^photo-\d{2}$/) }).strict();
const Label = z.enum(["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK", "NONE"]);
const Result = z.object({ label: Label }).strict();
const responseSchema = { type: "OBJECT", properties: { label: { type: "STRING", enum: Label.options } }, required: ["label"] };
const prompt = arcModelSettings.taskPrompt("photo", "classification");
const unavailable = () => ({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Approved-photo classification could not be verified. No result has been substituted." } });

export function createApprovedPhotoService({ storage, gemini, inventory, model, now = () => new Date() } = {}) {
  if (!storage?.getMetadata || !storage?.download || !gemini?.generateJson || inventory?.bucket !== "prepagent-hack-data" ||
      !Array.isArray(inventory.photos) || inventory.photos.length !== 10 || new Set(inventory.photos.map(p=>p.id)).size !== 10 ||
      inventory.photos.some(p=> !/^photo-\d{2}$/.test(p.id) || !/^photos\/photos\/(?:crack|crushed|delam|good|print|warp)\/[a-z]+_\d{3}\.jpg$/.test(p.name) ||
        !/^[0-9]+$/.test(p.generation) || !/^[a-f0-9]{64}$/.test(p.sha256) || !Number.isSafeInteger(p.size) || p.size<1 || p.size>10*1024*1024)) throw new TypeError("The exact approved ten-photo registry and metered provider are required.");
  const photos = new Map(inventory.photos.map(p=>[p.id,Object.freeze({...p})]));
  const current = (metadata,p) => metadata?.name===p.name && metadata.generation===p.generation && metadata.size===p.size && metadata.contentType==="image/jpeg";
  return Object.freeze({
    async list() {
      return { ok: true, photos: [...photos.values()].map((p,i)=>({ id:p.id,label:`Approved photo ${i+1}` })), provenance:"Owner-consented demo/testing photos; image bytes and identifying branding are not exposed by this endpoint." };
    },
    async classify({ photoId, signal } = {}) {
      const photo = photos.get(photoId);
      if (!photo) return { ok:false,error:{code:"VALIDATION_ERROR",message:"Select an existing approved photo ID. Arbitrary image uploads and URIs are not accepted."} };
      try {
        if (!current(await storage.getMetadata({name:photo.name,signal}),photo)) return unavailable();
        const image = await storage.download({name:photo.name,generation:photo.generation,signal});
        if (image.contentType!=="image/jpeg" || image.bytes.byteLength!==photo.size || createHash("sha256").update(image.bytes).digest("hex")!==photo.sha256 ||
            identifyPurchaseOrderMimeType({type:"image/jpeg"},image.bytes)!=="image/jpeg") return unavailable();
        let modelUsage;
        const raw = await gemini.generateJson({ role:"photo",fileUri:`gs://${inventory.bucket}/${photo.name}`,mimeType:"image/jpeg",prompt,responseSchema,signal,onUsage:usage=>{modelUsage=usage;} });
        const result = Result.safeParse(raw);
        // Vertex reads the object URI. Latest generation must remain the approved
        // generation for the entire call; a changed/restored object fails closed.
        if (!result.success || !current(await storage.getMetadata({name:photo.name,signal}),photo)) return unavailable();
        return { ok:true,source:"vertex-gemini",isRealModelPrediction:true,photoId:photo.id,label:result.data.label,model,
          photoSha256:photo.sha256,classifiedAt:now().toISOString(),provenance:"Owner-approved real demo photo; not simulated, not a calibrated factory quality assessment.",
          ...(modelUsage ? {modelUsage} : {}),generation:arcModelSettings.generation("photo") };
      } catch(error) {
        if (error?.name==="AbortError") throw error;
        return geminiUsageFailure(error) ?? unavailable();
      }
    },
  });
}
