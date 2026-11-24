import { z } from "zod";
import { demoOwnsLot } from "../../hackathon-demo-auth.js";

export const noArgs = z.strictObject({});

export function failure(status, code, message) {
  return { ok: false, status, error: { code, message } };
}

export function unavailable(message) {
  return failure(503, "SERVICE_UNAVAILABLE", message);
}

export function needLot({ principal, lot, lotIds }) {
  if (!demoOwnsLot(principal, lot?.lotId) || lot.ownerSessionId !== principal.sessionId ||
      !lotIds.includes(lot.lotId)) {
    return failure(409, "LOT_NOT_FOUND", "Choose a lot in this session.");
  }
}

export const needWriteEffect = ({ deps }) => typeof deps.runWriteEffect !== "function"
  ? unavailable("This action requires durable replay.")
  : undefined;
