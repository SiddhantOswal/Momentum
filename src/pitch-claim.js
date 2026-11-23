/**
 * The pitch claim lets one session spend the pitch reserve inside its window
 * (ADR-0004 decision 5, design 5.2). ARC-M1-17 issues it as a signed grant on
 * the demo cookie. Until that ships no principal carries a verified claim, so
 * the reserve stays unspent; an object that merely lists the grant is not one.
 */
export const PITCH_RESERVE_GRANT = "pitch_reserve";

export function hasPitchReserveClaim(_principal) {
  return false;
}
