import { demoOwnsJob } from "../hackathon-demo-auth.js";
import { canApprove } from "../user-session-auth.js";

const READ_METHODS = ["GET", "HEAD"];

function rejection(status, code, message) {
  return { ok: false, status, error: { code, message } };
}

function authenticatorRejection(result) {
  return { ok: false, status: result.status, error: result.error };
}

/**
 * Decides whether a request may reach a supervisor-only operation. A failure
 * carries the HTTP status the authenticators chose; a success carries the
 * verified principal, or none in local demo and adapter-free offline runs.
 */
export async function authorizeSupervisor({
  method,
  path,
  jobId,
  sessionCookie,
  demoCookie,
  authorization,
  origin,
  requestUrl,
} = {}, {
  userSessionAuth,
  hackathonAuth,
  supervisorAuthenticator,
  executionMode,
  localPrivilegedAdapterConfigured,
  traceOwners,
  isSameOrigin,
}) {
  const crossOriginWrite = () => !READ_METHODS.includes(method) && !isSameOrigin({ origin, requestUrl });
  if (userSessionAuth) {
    const result = await userSessionAuth.authenticate(sessionCookie);
    if (!result.ok) return authenticatorRejection(result);
    if (crossOriginWrite()) return rejection(403, "ORIGIN_REQUIRED", "A same-origin request is required.");
    return { ok: true, principal: result.principal };
  }
  if (hackathonAuth.enabled) {
    const result = hackathonAuth.authenticate(demoCookie);
    if (!result.ok) return authenticatorRejection(result);
    if (crossOriginWrite()) return rejection(403, "ORIGIN_REQUIRED", "A same-origin request is required.");
    if (path === "/insights/summary") return rejection(403, "DEMO_SCOPE_REQUIRED", "Use the anonymized impact summary.");
    const jobMatch = /^\/jobs\/([^/]+)/.exec(path);
    if (jobMatch && !demoOwnsJob(result.principal, jobId ?? jobMatch[1])) {
      return rejection(403, "DEMO_SCOPE_REQUIRED", "This record does not belong to this demo session.");
    }
    if (path.startsWith("/api/runs/") && traceOwners.get(path.split("/")[3]) !== result.principal.sessionId) {
      return rejection(403, "DEMO_SCOPE_REQUIRED", "This trace does not belong to this demo session.");
    }
    return { ok: true, principal: result.principal };
  }
  if (executionMode === "demo") return { ok: true };
  if (executionMode === "offline" && !localPrivilegedAdapterConfigured) return { ok: true };
  const result = await supervisorAuthenticator.authenticate(authorization);
  if (!result.ok) return authenticatorRejection(result);
  return { ok: true, principal: result.principal };
}

/** With Google sign-in, only supervisors and managers may approve a job card. */
export function authorizeApproval(principal, { userSessionAuth }) {
  if (userSessionAuth && !canApprove(principal)) {
    return rejection(403, "APPROVER_ROLE_REQUIRED", "Only a supervisor or manager can approve a job card.");
  }
  return { ok: true };
}
