import { z } from "zod";
import { updateLotConditions } from "../../commands/update-conditions.js";
import { RunConditionsSchema } from "../../schemas.js";
import { needLot, needWriteEffect } from "./policy.js";

export const setConditionsTool = {
  name: "set_conditions",
  description: "Save operator-entered condition values for review.",
  schema: () => z.strictObject({ conditions: RunConditionsSchema.partial() })
    .superRefine(({ conditions }, ctx) => {
      if (Object.keys(conditions).length === 0) {
        ctx.addIssue({ code: "custom", path: ["conditions"], message: "Enter at least one condition." });
      }
    }),
  precondition: (context) => needLot(context) ?? needWriteEffect(context),
  effectScope: "lot_conditions",
  execute: ({ conditions }, { deps, lot }) => updateLotConditions({
    lotId: lot.lotId,
    body: {
      conditions: Object.entries(conditions).map(([field, value]) => ({ field, value, source: "typed" })),
    },
  }, deps),
};
