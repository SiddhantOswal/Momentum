import { z } from "zod";
import { readOrder } from "../../commands/read-order.js";
import { SAMPLE_ORDER_CONTEXT } from "../../synthetic-po-allowlist.js";
import { readSampleFile, reviewIdForEffect } from "../lot-flow.js";
import { needWriteEffect, unavailable } from "./policy.js";

export const readOrderTool = {
  name: "read_order",
  description: "Read a purchase order from the approved sample list.",
  schema: ({ sampleIds }) => z.strictObject({ sampleId: z.enum(sampleIds) }),
  precondition: needWriteEffect,
  effectScope: "po_review",
  spendsGemini: true,
  async execute({ sampleId }, { deps, principal, key }) {
    const file = await readSampleFile(sampleId, deps.signal);
    if (!file) return unavailable("The approved sample could not be opened.");
    return readOrder({
      fields: { file, ...SAMPLE_ORDER_CONTEXT[sampleId] },
      reviewId: reviewIdForEffect(principal.sessionId, key),
    }, deps);
  },
};
