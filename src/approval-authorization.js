import { isVerifiedSupervisorPrincipal } from "./firebase-supervisor-auth.js";
import { isDemoPrincipal, demoOwnsJob } from "./hackathon-demo-auth.js";

// Demo capabilities are deliberately distinct from verified human identities.
export function canAccessApprovalJob(principal, jobId) {
  return isVerifiedSupervisorPrincipal(principal) || demoOwnsJob(principal, jobId);
}
export function approvalActorProvenance(principal) {
  return isDemoPrincipal(principal) ? {
    actorType: "HACKATHON_DEMO_PARTICIPANT", authorizationMode: "HACKATHON_DEMO",
    identityProvider: "server-signed-demo-session", authenticatedHuman: false,
  } : {};
}
