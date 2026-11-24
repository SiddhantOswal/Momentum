import { z } from "zod";
import { getJob } from "../../commands/get-job.js";

export const getJobTool = {
  name: "get_job",
  description: "Read a job from this session's history.",
  schema: ({ jobIds }) => z.strictObject({ jobId: z.enum(jobIds) }),
  execute: (args, { deps }) => getJob(args, deps),
};
