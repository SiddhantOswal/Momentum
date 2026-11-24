import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { readOrder } from "../../commands/read-order.js";
import { SAMPLE_DOCUMENTS } from "../../synthetic-po-allowlist.js";
import { needWriteEffect, unavailable } from "./policy.js";

export const readOrderTool = {
  name: "read_order",
  description: "Read a purchase order from the approved sample list.",
  schema: ({ sampleIds }) => z.strictObject({ sampleId: z.enum(sampleIds) }),
  precondition: needWriteEffect,
  effectScope: "po_review",
  spendsGemini: true,
  async execute({ sampleId }, { deps }) {
    const filename = SAMPLE_DOCUMENTS[sampleId];
    const bytes = await readFile(new URL(`../../../public/samples/${filename}`, import.meta.url), { signal: deps.signal })
      .catch((error) => {
        if (error.name === "AbortError") throw error;
        return null;
      });
    if (!bytes) return unavailable("The approved sample could not be opened.");
    const file = new File([bytes], filename, { type: filename.endsWith(".pdf") ? "application/pdf" : "image/jpeg" });
    return readOrder({ fields: { file } }, deps);
  },
};
