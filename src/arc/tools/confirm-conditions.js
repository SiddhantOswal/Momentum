import { z } from "zod";
import { updateLotConditions } from "../../commands/update-conditions.js";
import { LeversSchema, RunConditionsSchema } from "../../schemas.js";
import { LotIdSchema } from "../../state-schemas.js";
import { failure, needLot, needWriteEffect } from "./policy.js";

const CONDITION_FIELDS = Object.keys(RunConditionsSchema.shape);

// Flat scalars, as the wire contract allows for action params (06 section 4.4, decision D12).
// The lot is the one on the card the person pressed; the runner plans it only if this session holds it.
export const ConfirmConditionsSchema = z.strictObject({
  lotId: LotIdSchema,
  ...RunConditionsSchema.shape,
  paperMoistureSource: z.enum(["confirmed", "example"]),
  ...LeversSchema.shape,
});

/**
 * The operator's Confirm conditions press. Code-only, like confirm_order. It
 * saves the five values through the command behind PUT /lots/:lotId/conditions,
 * labelled as confirmed by the operator, or as the example value for paper
 * moisture the operator kept. The planned settings in the same params go to
 * plan_lot, the next step; this step does not store them.
 */
export const confirmConditionsTool = {
  name: "confirm_conditions",
  description: "Save the conditions the operator confirmed for this lot.",
  codeOnly: true,
  schema: () => ConfirmConditionsSchema,
  precondition(context) {
    const blocked = needLot(context) ?? needWriteEffect(context);
    if (blocked) return blocked;
    if (!context.lot.orderRef || !context.lot.reviewId) {
      return failure(409, "CONFIRMATION_REQUIRED", "Confirm the order before the conditions.");
    }
  },
  effectScope: "lot_conditions",
  execute(params, { deps, lot }) {
    if (params.lotId !== lot.lotId) return failure(409, "LOT_NOT_FOUND", "Choose a lot in this session.");
    return updateLotConditions({
      lotId: lot.lotId,
      body: {
        conditions: CONDITION_FIELDS.map((field) => ({
          field, value: params[field],
          source: field === "paperMoisturePct" ? params.paperMoistureSource : "confirmed",
        })),
      },
    }, deps);
  },
};
