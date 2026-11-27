import { createHash } from "node:crypto";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Binds an approval to the draft the supervisor saw (design 4.2). Status is
 * left out on purpose: approving the draft must not change its fingerprint.
 * It is an integrity check on the server's own records, not a credential.
 */
export function revisionFingerprint({ jobSheet, lotId, number, requestFingerprint, conditions }) {
  return createHash("sha256").update(canonical({
    jobId: jobSheet.jobId,
    lotId,
    number,
    requestFingerprint,
    conditions,
    baseline: jobSheet.baseline,
    recommended: jobSheet.recommended,
    changes: jobSheet.changes,
    explanation: jobSheet.explanation,
  })).digest("hex");
}
