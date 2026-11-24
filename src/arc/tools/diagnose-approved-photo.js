import { z } from "zod";
import { classifyApprovedPhoto } from "../../commands/photos.js";

export const diagnoseApprovedPhotoTool = {
  name: "diagnose_approved_photo",
  description: "Classify a photo from the approved reference list.",
  schema: ({ photoIds }) => z.strictObject({ photoId: z.enum(photoIds) }),
  spendsGemini: true,
  execute: (args, { deps }) => classifyApprovedPhoto(args, deps),
};
