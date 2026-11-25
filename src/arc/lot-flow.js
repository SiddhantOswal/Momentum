/**
 * Server-side pieces of Arc's lot preparation (ARC-M3-01). The order line, the
 * order file and the review fingerprint always come from the stored review and
 * the lot head, never from the client or the model: the client names only the
 * review and the line it ticked, and the operator's condition and setting values.
 */

import { createHash } from "node:crypto";
import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import { LeversSchema } from "../schemas.js";
import { SAMPLE_DOCUMENTS } from "../synthetic-po-allowlist.js";
import { failure, unavailable } from "./tools/policy.js";

const SAMPLE_DIRECTORY = new URL("../../public/samples/", import.meta.url);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export const LEVER_FIELDS = Object.freeze(Object.keys(LeversSchema.shape));

/** The approved sample, read from the server's own copy. Null when the file cannot be opened. */
export async function readSampleFile(sampleId, signal) {
  const filename = Object.hasOwn(SAMPLE_DOCUMENTS, sampleId) ? SAMPLE_DOCUMENTS[sampleId] : undefined;
  if (!filename) return null;
  const bytes = await readFile(new URL(filename, SAMPLE_DIRECTORY), { signal }).catch((error) => {
    if (error.name === "AbortError") throw error;
    return null;
  });
  return bytes && new File([bytes], filename, { type: filename.endsWith(".pdf") ? "application/pdf" : "image/jpeg" });
}

/** The approved sample whose bytes the stored review was read from, matched by the digest the review keeps. */
async function sampleFileForDigest(fileDigest, signal) {
  for (const sampleId of Object.keys(SAMPLE_DOCUMENTS)) {
    const file = await readSampleFile(sampleId, signal);
    if (file && sha256(new Uint8Array(await file.arrayBuffer())) === fileDigest) return file;
  }
  return null;
}

// Derived from the step's effect key, so a resumed step names the same record instead of making a second one.
export function reviewIdForEffect(sessionId, key) {
  const digest = sha256(`arc-review-v1:${sessionId}:${key}`);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-8${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

export function lotIdForEffect(sessionId, key) {
  return `LOT-HACK-${sessionId}-${sha256(`arc-lot-v1:${sessionId}:${key}`).slice(0, 12)}`;
}

/**
 * The stored review of this session, if it has not expired. A review that is
 * missing, expired or another session's gets the same code, so review IDs
 * cannot be probed.
 */
export async function liveReview({ reviewId, principal, deps }) {
  const load = deps.servicePorts?.loadPurchaseOrderReview;
  if (typeof load !== "function") return unavailable("Stored order reviews are unavailable.");
  const loaded = await load({ reviewId, ownerSessionId: principal.sessionId, signal: deps.signal });
  if (!loaded?.ok) return loaded?.error ? loaded : unavailable("Stored order reviews are unavailable.");
  if (!loaded.review || loaded.review.expired) {
    return failure(409, "ORDER_REVIEW_EXPIRED", "This order review has expired. Read the order again.");
  }
  return { ok: true, review: loaded.review };
}

/** A line the operator may confirm: matched to one catalog item, with a quantity, stored at its own index. */
export function confirmableLine(review, lineIndex) {
  const line = review.result.lines?.[lineIndex];
  if (!line || line.lineIndex !== lineIndex || line.status !== "MATCHED") return null;
  if (typeof line.resolvedItemCode !== "string" || !Number.isSafeInteger(line.quantity) || line.quantity < 1) return null;
  return { lineIndex, itemCode: line.resolvedItemCode, quantity: line.quantity };
}

/**
 * The confirmed order and the plan inputs for plan_lot, rebuilt on the server:
 * the line from the lot head (checked again against the stored review), the
 * review fingerprint and order context from the review, the file from the
 * approved sample the review was read from, and only the planned settings
 * from the operator's action.
 */
export async function preparePlanInputs({ lot, params, principal, deps }) {
  if (!lot) return failure(409, "LOT_NOT_FOUND", "Choose a lot in this session.");
  const order = lot.orderRef;
  if (!order || !lot.reviewId || order.lineIndex === undefined) {
    return failure(409, "CONFIRMATION_REQUIRED", "Confirm the order before the conditions.");
  }
  const loaded = await liveReview({ reviewId: lot.reviewId, principal, deps });
  if (!loaded.ok) return loaded;
  const { review } = loaded;
  const line = confirmableLine(review, order.lineIndex);
  if (!line || line.itemCode !== order.itemCode || line.quantity !== order.quantity) {
    return failure(409, "CONFIRMATION_REQUIRED", "The confirmed line no longer matches the stored review. Read the order again.");
  }
  const file = await sampleFileForDigest(review.fileDigest, deps.signal);
  if (!file) return failure(409, "ORDER_SAMPLE_REQUIRED", "Arc plans approved sample orders only.");
  return {
    ok: true,
    context: {
      confirmedOrder: { ...line, reviewId: lot.reviewId, reviewFingerprint: review.reviewFingerprint },
      planInputs: {
        file,
        operatorFields: review.operatorFields,
        levers: Object.fromEntries(LEVER_FIELDS.map((field) => [field, params[field]])),
      },
    },
  };
}
