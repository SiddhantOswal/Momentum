/**
 * The durable effect handler the tool registry runs each write step through
 * (`runWriteEffect`). A step resumed after a lost lease keeps its effect key,
 * so each scope finds the record that key already wrote instead of writing a
 * second one. Nothing here is held in process memory.
 *
 * - po_review: read_order stores its review under an ID derived from the key.
 *   If that review exists, its stored result is returned and Gemini is not
 *   called again. An expired one blocks with ORDER_REVIEW_EXPIRED.
 * - lot_conditions: the lot ID (confirm_order) is derived from the key, and a
 *   condition save merges the same values by field, so running the step again
 *   leaves the same head. A replaced draft is reported only by the first run.
 * Any other scope fails closed.
 */

import { reviewIdForEffect } from "./lot-flow.js";
import { failure, unavailable } from "./tools/policy.js";

export function createArcWriteEffects({ servicePorts } = {}) {
  const scopes = {
    async po_review({ key, principal, deps }, run) {
      const reviewId = reviewIdForEffect(principal.sessionId, key);
      const loaded = await deps.servicePorts?.loadPurchaseOrderReview?.({
        reviewId, ownerSessionId: principal.sessionId, signal: deps.signal,
      });
      if (!loaded?.ok) return loaded?.error ? loaded : unavailable("Stored order reviews are unavailable.");
      if (!loaded.review) return run();
      if (loaded.review.expired) return failure(409, "ORDER_REVIEW_EXPIRED", "This order review has expired. Read the order again.");
      return { ...loaded.review.result, reviewId, reviewFingerprint: loaded.review.reviewFingerprint };
    },
    lot_conditions: (_claim, run) => run(),
  };

  return function runWriteEffect({ scope, key, principal, signal }, run) {
    const handler = Object.hasOwn(scopes, scope) ? scopes[scope] : null;
    if (!handler) return unavailable("This action has no durable replay.");
    return handler({ key, principal, deps: { servicePorts, signal } }, run);
  };
}
