import { getLot } from "../../commands/get-lot.js";
import { noArgs } from "./policy.js";

export const listNextActionsTool = {
  name: "list_next_actions",
  description: "List the current stages of this session's lots.",
  schema: () => noArgs,
  async execute(_args, { lotIds, deps }) {
    const results = await Promise.all(lotIds.map((lotId) => getLot({ lotId }, deps)));
    const failure = results.find((result) => !result.ok && result.error.code !== "LOT_NOT_FOUND");
    if (failure) return failure;
    return {
      ok: true,
      actions: results.filter(({ ok }) => ok).map(({ lot }) => ({ lotId: lot.lotId, stage: lot.stage })),
    };
  },
};
