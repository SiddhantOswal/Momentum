import { z } from "zod";
import { planLot } from "../../commands/plan-lot.js";
import { LeversSchema, OperatorItemConfirmationSchema, OrderOperatorFieldsSchema, RunConditionsSchema } from "../../schemas.js";
import { Sha256HexSchema } from "../../state-schemas.js";
import { failure, needLot, noArgs, unavailable } from "./policy.js";

const confirmedOrderSchema = OperatorItemConfirmationSchema.extend({
  reviewId: z.uuid(),
  reviewFingerprint: Sha256HexSchema,
});

// Paper moisture kept at its example value stays labelled "Example value" on the lot; the operator
// pressed Confirm conditions with it on screen, as New Lot plans with whatever the field holds.
const planned = ({ confirmed, field, sourceDetail }) => confirmed || (field === "paperMoisturePct" && sourceDetail === "example");

// The revision keeps the example label when the lot holds the moisture as the example value.
const moistureSource = (lot) => (lot.draftConditions ?? [])
  .find(({ field }) => field === "paperMoisturePct")?.sourceDetail === "example" ? "example" : "confirmed";

function confirmedConditions(lot) {
  return RunConditionsSchema.safeParse(Object.fromEntries(
    (lot.draftConditions ?? []).filter(planned).map(({ field, value }) => [field, value]),
  ));
}

export const planLotTool = {
  name: "plan_lot",
  description: "Prepare a draft job card after the operator confirms the order and conditions.",
  schema: () => noArgs,
  precondition(context) {
    const lotFailure = needLot(context);
    if (lotFailure) return lotFailure;
    const { deps, lot, confirmedOrder, planInputs } = context;
    if (!confirmedOrderSchema.safeParse(confirmedOrder).success || confirmedOrder.reviewId !== lot.reviewId ||
        confirmedOrder.itemCode !== lot.orderRef?.itemCode || confirmedOrder.quantity !== lot.orderRef?.quantity ||
        !OrderOperatorFieldsSchema.safeParse(planInputs?.operatorFields ?? {}).success ||
        !confirmedConditions(lot).success || !LeversSchema.safeParse(planInputs?.levers).success ||
        typeof planInputs?.file?.arrayBuffer !== "function") {
      return failure(409, "CONFIRMATION_REQUIRED", "Confirm the order and conditions and enter the machine settings before planning.");
    }
    if (deps.lotRevisions?.enabled !== true || typeof deps.lotRevisions.store?.registerPending !== "function" ||
        typeof deps.submitJob !== "function") {
      return unavailable("Durable lot planning is unavailable.");
    }
  },
  spendsGemini: true,
  execute(_args, { confirmedOrder, planInputs, lot, key, deps }) {
    const { itemCode, quantity, lineIndex, reviewId, reviewFingerprint } = confirmedOrder;
    const levers = LeversSchema.parse(planInputs.levers);
    return planLot({
      idempotencyKey: key,
      fields: {
        ...OrderOperatorFieldsSchema.parse(planInputs.operatorFields ?? {}),
        ...confirmedConditions(lot).data,
        ...Object.fromEntries(Object.entries(levers).map(([field, value]) => [field, String(value)])),
        file: planInputs.file,
        lotId: lot.lotId,
        reviewId,
        reviewFingerprint,
        confirmedItemCode: itemCode,
        confirmedQuantity: quantity,
        ...(lineIndex === undefined ? {} : { confirmedLineIndex: String(lineIndex + 1) }),
        confirmedSourceLine: "true",
        conditionsConfirmed: "true",
        paperMoistureSource: moistureSource(lot),
      },
    }, deps);
  },
};
