import { modelScores } from "../../commands/status.js";
import { noArgs } from "./policy.js";

export const getStatusTool = {
  name: "get_status",
  description: "Read model acceptance and score evidence.",
  schema: () => noArgs,
  execute: (args, { deps }) => ({ ok: true, modelAcceptance: modelScores(args, deps) }),
};
