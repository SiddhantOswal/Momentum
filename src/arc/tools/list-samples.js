import { SAMPLE_DOCUMENTS } from "../../synthetic-po-allowlist.js";
import { noArgs } from "./policy.js";

export const listSamplesTool = {
  name: "list_samples",
  description: "List approved sample purchase orders.",
  schema: () => noArgs,
  execute: () => ({
    ok: true,
    samples: Object.entries(SAMPLE_DOCUMENTS).map(([id, filename]) => ({ id, filename })),
  }),
};
