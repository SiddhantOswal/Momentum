/**
 * Server-side pieces of Arc's lot preparation (ARC-M3-01). The order line, the
 * order file and the review fingerprint always come from the stored review and
 * the lot head, never from the client or the model: the client names only the
 * review and the line it ticked, and the operator's condition and setting values.
 */

import { createHash } from "node:crypto";
import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import { SAMPLE_DOCUMENTS } from "../synthetic-po-allowlist.js";

const SAMPLE_DIRECTORY = new URL("../../public/samples/", import.meta.url);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

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

// Derived from the step's effect key, so a resumed step names the same record instead of making a second one.
export function reviewIdForEffect(sessionId, key) {
  const digest = sha256(`arc-review-v1:${sessionId}:${key}`);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-8${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}
