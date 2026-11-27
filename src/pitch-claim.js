import { createHash, timingSafeEqual } from "node:crypto";
import { isDemoPrincipal } from "./hackathon-demo-auth.js";

/**
 * The pitch claim lets one session spend the pitch reserve inside its window
 * (ADR-0004 decision 5, design 5.2). A Secret Manager code is exchanged for a
 * signed grant on the demo cookie; the session ID plays no part in it.
 */
export const PITCH_RESERVE_GRANT = "pitch_reserve";

// Only a principal built from a verified cookie is a demo principal, so an object that lists the grant is not a claim.
export function hasPitchReserveClaim(principal) {
  return isDemoPrincipal(principal) && principal.grants?.includes(PITCH_RESERVE_GRANT) === true;
}

const digest = (value) => createHash("sha256").update(value).digest();

/**
 * Holds only the digest of the code. Both sides are hashed first so the
 * constant-time compare sees equal lengths and the length is not revealed.
 */
export function createPitchClaimExchange(secret) {
  const configured = typeof secret === "string" && secret.trim() !== "";
  const expected = configured ? digest(secret) : undefined;
  return Object.freeze({
    configured,
    matches(code) {
      if (!configured || typeof code !== "string") return false;
      return timingSafeEqual(digest(code), expected);
    },
  });
}
