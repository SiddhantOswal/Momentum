import { z } from "zod";
import { getCard } from "../../commands/get-card.js";
import { DisplayPrefsQuerySchema } from "../../schemas.js";

export const getJobCardTool = {
  name: "get_job_card",
  description: "Open the stored PDF for an approved job in this session.",
  schema: ({ jobIds }) => DisplayPrefsQuerySchema.extend({ jobId: z.enum(jobIds) }),
  execute: (args, { deps }) => getCard(args, deps),
};
