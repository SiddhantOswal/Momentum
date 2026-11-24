import { listApprovedPhotos } from "../../commands/photos.js";
import { noArgs } from "./policy.js";

export const listApprovedPhotosTool = {
  name: "list_approved_photos",
  description: "List approved reference photos.",
  schema: () => noArgs,
  execute: (args, { deps }) => listApprovedPhotos(args, deps),
};
