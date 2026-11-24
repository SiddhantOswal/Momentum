import { findSeenBefore } from "../../commands/history.js";
import { SeenBeforeRequestSchema } from "../../schemas.js";

export const searchDefectHistoryTool = {
  name: "search_defect_history",
  description: "Find past modeled cases of a defect at similar humidity.",
  schema: () => SeenBeforeRequestSchema,
  execute: (args, { deps }) => findSeenBefore(args, deps),
};
