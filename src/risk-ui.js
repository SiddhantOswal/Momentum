/**
 * Project only the fields accepted by the live five-model risk endpoint.
 * The larger order/condition forms contain fields used by other workflows.
 */
export function toRiskPredictionPayload({ order, conditions, levers, conditionsConfirmed } = {}) {
  if (!order || !conditions || !levers) {
    throw new TypeError("Order, conditions, and machine settings are required.");
  }
  if (conditionsConfirmed !== true) {
    throw new TypeError("Condition confirmation is required before prediction.");
  }
  return {
    order: {
      itemCode: order.itemCode,
      quantity: order.quantity,
      paperType: order.paperType,
      paperSupplier: order.paperSupplier,
    },
    conditions: {
      shift: conditions.shift,
      ambientRhPct: conditions.ambientRhPct,
      ambientTempC: conditions.ambientTempC,
      paperMoisturePct: conditions.paperMoisturePct,
    },
    conditionsConfirmed: true,
    levers: { ...levers },
  };
}
