/**
 * Durable PO reviews in `po_reviews/{reviewId}` (design 2.1), so a review read
 * on one Cloud Run instance can be confirmed on another.
 *
 * The store only reads and writes; expiry and ownership are decided by the
 * review service. Every failure is a FirestoreRestError: SERVICE_UNAVAILABLE
 * for anything Firestore did not clearly answer, DOCUMENT_TOO_LARGE before a
 * write over the limit. A stored document that fails PoReviewDocSchema is
 * SERVICE_UNAVAILABLE, never an absent review.
 */

import { createCloudRunAccessTokenProvider } from "./bigquery-read-client.js";
import {
  createFirestoreRestClient,
  encodeDocument,
  FirestoreRestError,
  parseDocument,
  readJson,
} from "./firestore-rest.js";
import { BASE_TIMESTAMP_FIELDS, PoReviewDocSchema } from "../state-schemas.js";

export const PO_REVIEW_COLLECTION = "po_reviews";
// Well under Firestore's 1 MiB cap; a review this large means an extraction worth checking by hand.
export const MAX_PO_REVIEW_DOCUMENT_BYTES = 256 * 1024;

const TIMESTAMP_FIELDS = [...BASE_TIMESTAMP_FIELDS, "reviewExpiresAt"];
const REVIEW_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unavailable(message) {
  return new FirestoreRestError("SERVICE_UNAVAILABLE", message);
}

export function createFirestorePoReviewStore({
  projectId,
  database = "(default)",
  fetchImpl = fetch,
  tokenProvider,
  timeoutMs = 5000,
} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) {
    throw new TypeError("The Firestore request timeout must be between 1 and 10000 ms.");
  }
  const firestore = createFirestoreRestClient({ projectId, database, fetchImpl });
  const provideToken = tokenProvider ?? createCloudRunAccessTokenProvider({ fetchImpl });
  const collectionUrl = `${firestore.documentsUrl}/${PO_REVIEW_COLLECTION}`;
  const documentName = (reviewId) => `${firestore.databaseName}/documents/${PO_REVIEW_COLLECTION}/${reviewId}`;

  async function call(url, { method, body, signal } = {}) {
    const bounded = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs);
    let token;
    try {
      token = await provideToken({ signal: bounded });
    } catch (error) {
      if (signal?.aborted) throw error;
      token = undefined;
    }
    if (typeof token !== "string" || token.length === 0) {
      throw new FirestoreRestError("CLOUD_IDENTITY_UNAVAILABLE", "Cloud Run workload identity is unavailable.");
    }
    try {
      const response = await firestore.send(url, { method, body, token, signal: bounded });
      return { status: response.status, ok: response.ok, payload: await readJson(response) };
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof FirestoreRestError) throw error;
      throw unavailable("Cloud Firestore did not answer in time.");
    }
  }

  return Object.freeze({
    /** Set-if-absent: a review is written once and never replaced. */
    async create(review, { signal } = {}) {
      const fields = encodeDocument(PoReviewDocSchema, review, { timestamps: TIMESTAMP_FIELDS });
      const body = JSON.stringify({ fields });
      if (Buffer.byteLength(body, "utf8") > MAX_PO_REVIEW_DOCUMENT_BYTES) {
        throw new FirestoreRestError("DOCUMENT_TOO_LARGE", "The PO review is larger than the 256 KiB document limit.");
      }
      const reviewId = review.reviewId;
      const written = await call(`${collectionUrl}?documentId=${encodeURIComponent(reviewId)}`, {
        method: "POST",
        body,
        signal,
      });
      if (!written.ok || written.payload?.name !== documentName(reviewId)) {
        throw unavailable("Firestore did not store the PO review.");
      }
      return parseDocument(PoReviewDocSchema, written.payload);
    },

    /** Returns null only when Firestore says the review does not exist. */
    async get(reviewId, { signal } = {}) {
      if (typeof reviewId !== "string" || !REVIEW_ID_PATTERN.test(reviewId)) return null;
      const read = await call(`${collectionUrl}/${encodeURIComponent(reviewId)}`, { signal });
      if (read.status === 404) return null;
      if (!read.ok || read.payload?.name !== documentName(reviewId)) {
        throw unavailable("Firestore did not return the PO review.");
      }
      const review = parseDocument(PoReviewDocSchema, read.payload);
      if (review.reviewId !== reviewId) throw unavailable("Firestore returned a PO review under another ID.");
      return review;
    },
  });
}
