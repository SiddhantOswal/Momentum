import { z } from "zod";
import { lotStoreFailure } from "../../commands/lot-access.js";
import { confirmableLine, liveReview, lotIdForEffect } from "../lot-flow.js";
import { failure, needWriteEffect, unavailable } from "./policy.js";

const BY_ROLE = "Supervisor session";

export const ConfirmOrderSchema = z.strictObject({ reviewId: z.uuid(), lineIndex: z.number().int().min(0).max(99) });

/**
 * The operator's Confirm order press. Code-only: the router never sees it, and
 * a fixed action reaches it only from the button. The client names the review
 * and the line; the item, quantity and order ID are read from the stored review.
 */
export const confirmOrderTool = {
  name: "confirm_order",
  description: "Open a lot for the order line the operator confirmed.",
  codeOnly: true,
  schema: () => ConfirmOrderSchema,
  precondition(context) {
    return needWriteEffect(context) ?? (context.deps.lotRevisions?.enabled === true &&
      typeof context.deps.lotRevisions.store?.saveConditions === "function"
      ? undefined : unavailable("Lot records are not available."));
  },
  effectScope: "lot_conditions",
  async execute({ reviewId, lineIndex }, { deps, principal, key }) {
    const loaded = await liveReview({ reviewId, principal, deps });
    if (!loaded.ok) return loaded;
    const line = confirmableLine(loaded.review, lineIndex);
    if (!line) {
      return failure(409, "ORDER_LINE_NOT_CONFIRMABLE", "This line is not matched to one catalog item with a quantity.");
    }
    const lotId = lotIdForEffect(principal.sessionId, key);
    let saved;
    try {
      saved = await deps.lotRevisions.store.saveConditions({
        lotId, ownerSessionId: principal.sessionId, conditions: [], byRole: BY_ROLE, reviewId,
        orderRef: {
          orderId: loaded.review.operatorFields.orderId ?? loaded.review.result.orderProfile?.orderId ?? "",
          itemCode: line.itemCode, quantity: line.quantity, lineIndex: line.lineIndex,
        },
        signal: deps.signal,
      });
    } catch (error) {
      return lotStoreFailure(error);
    }
    if (!saved.ok) return failure(403, "DEMO_SCOPE_REQUIRED", "This lot does not belong to this demo session.");
    return { ok: true, lot: { lotId, stage: saved.head.stage } };
  },
};
