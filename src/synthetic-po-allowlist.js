import { createHash } from "node:crypto";

// Exact SHA-256 hashes of the five owner-approved purchase-order documents.
// Changes to any fixture require an explicit review and a corresponding test.
const APPROVED_FIXTURE_SHA256 = new Set([
  "d789722039e0d9f29d2106655416aae0447159d23df56c7dc215ee875c8fb44a",
  "df209f4fbbca1de47fb5f7e4d7e50a14b8fe8caaf3a7ee03b3a981f5f10a0880",
  "24922e7fbbcc0840367866facc824d9b8a1e4d6b7e9d9b7cef2944064f97a9e7",
  "7b78bef03d26397a825286ad2c2a82e9524a4da6ffa2f170154773b0a842d8ee",
  "8ee13a3b023f34ab2408e44c7484dc09aa1b4b4832334a562b89cb78297b1833",
]);

export function isApprovedSyntheticPurchaseOrder(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) return false;
  const digest = createHash("sha256").update(bytes).digest("hex");
  return APPROVED_FIXTURE_SHA256.has(digest);
}

export const SAMPLE_DOCUMENTS = Object.freeze({
  PO1: "PO1_ClientA_single_B1047.pdf",
  PO2: "PO2_ClientA_multiline.pdf",
  PO3: "PO3_ClientP_electronics_with_fitment.pdf",
  PO4: "PO4_ClientQ_ambiguous_set.pdf",
  PO5: "PO5_ClientB_scanned.jpg",
});

// The order context New Lot sends with each sample (web/src/pages/newlot/store.ts). Arc reads the
// sample with the same context, so both routes reach the same review and the same job identity.
export const SAMPLE_ORDER_CONTEXT = Object.freeze({
  PO1: Object.freeze({ orderId: "TEST-CLA/PO/2026/1047", paperType: "RECYCLED", paperSupplier: "SUP-D" }),
});

export function isSampleDocument(filename) {
  return Object.values(SAMPLE_DOCUMENTS).includes(filename);
}
