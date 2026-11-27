// Production sign-in: Google accounts through Firebase Authentication, held in an HttpOnly
// Firebase session cookie (works for page requests and the live event stream alike).
// Access is by role, from an email allowlist the plant owner controls:
//   manager    - everything
//   supervisor - plan lots, approve job cards, log defects and actual scrap
//   operator   - plan lots, log defects and actual scrap (cannot approve)
export const SESSION_COOKIE = "__Host-momentum-session";
export const SESSION_DAYS = 5;
const ROLES = ["manager", "supervisor", "operator"];
const verified = new WeakSet();

export const isSessionPrincipal = (p) => p !== null && typeof p === "object" && verified.has(p);
export const canApprove = (p) => p?.role === "manager" || p?.role === "supervisor";

/** "om@plant.in:manager, sid@plant.in:supervisor" -> Map(email -> role). Invalid entries throw. */
export function parseUserRoles(raw = "") {
  const map = new Map();
  for (const entry of String(raw).split(",").map((s) => s.trim()).filter(Boolean)) {
    const [email, role] = entry.split(":").map((s) => s?.trim().toLowerCase());
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? "") || !ROLES.includes(role)) {
      throw new TypeError(`Invalid user role entry: ${entry}`);
    }
    map.set(email, role);
  }
  return map;
}

const fail = (status, code, message) => ({ ok: false, status, error: { code, message } });

export function createUserSessionAuth({ auth, projectId, roles = new Map(), now = () => Date.now() } = {}) {
  const ready = !!auth && typeof auth.verifyIdToken === "function" && typeof auth.createSessionCookie === "function" &&
    typeof auth.verifySessionCookie === "function" && typeof projectId === "string" && roles instanceof Map && roles.size > 0;

  const principalFrom = (decoded) => {
    const email = typeof decoded?.email === "string" ? decoded.email.toLowerCase() : undefined;
    if (!decoded || decoded.aud !== projectId || decoded.firebase?.sign_in_provider !== "google.com" || decoded.email_verified !== true || !email) {
      return fail(401, "INVALID_AUTHENTICATION", "Sign in again with your Google account.");
    }
    const role = roles.get(email);
    if (!role) return fail(403, "ACCOUNT_NOT_APPROVED", "This Google account doesn't have access to Momentum. Ask the plant manager to add it.");
    const principal = Object.freeze({ uid: decoded.uid, email, name: typeof decoded.name === "string" ? decoded.name : email, role, provider: "google.com", authorizationMode: "FIREBASE_SESSION" });
    verified.add(principal);
    return { ok: true, principal };
  };

  return Object.freeze({
    configured: ready,
    /** Exchanges a fresh Google ID token for a session cookie. */
    async startSession(idToken) {
      if (!ready) return fail(503, "AUTHENTICATION_NOT_CONFIGURED", "Sign-in is not configured yet.");
      if (typeof idToken !== "string" || idToken.length > 8192 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(idToken)) return fail(400, "VALIDATION_ERROR", "A Google sign-in token is required.");
      let decoded;
      try { decoded = await auth.verifyIdToken(idToken, true); } catch { return fail(401, "INVALID_AUTHENTICATION", "Sign in again with your Google account."); }
      // Only a recent sign-in may mint a session (Firebase's own guidance: within 5 minutes).
      if (!Number.isSafeInteger(decoded?.auth_time) || now() / 1000 - decoded.auth_time > 5 * 60) return fail(401, "RECENT_SIGN_IN_REQUIRED", "Sign in again to continue.");
      const result = principalFrom(decoded);
      if (!result.ok) return result;
      try {
        const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_DAYS * 24 * 60 * 60 * 1000 });
        return { ok: true, principal: result.principal, cookie, maxAge: SESSION_DAYS * 24 * 60 * 60 };
      } catch {
        return fail(503, "IDENTITY_PROVIDER_UNAVAILABLE", "Sign-in is temporarily unavailable. Try again.");
      }
    },
    /** Verifies the session cookie on every request (revocation is checked too). */
    async authenticate(cookie) {
      if (!ready) return fail(503, "AUTHENTICATION_NOT_CONFIGURED", "Sign-in is not configured yet.");
      if (!cookie) return fail(401, "AUTHENTICATION_REQUIRED", "Sign in with your Google account to continue.");
      try { return principalFrom(await auth.verifySessionCookie(cookie, true)); } catch { return fail(401, "INVALID_AUTHENTICATION", "Your session has ended. Sign in again."); }
    },
  });
}

export async function initializeUserSessionAuth(env = process.env) {
  if (env.USTAAD_AUTH_MODE !== "FIREBASE_SESSION") return undefined;
  const projectId = env.PROJECT_ID ?? env.GOOGLE_CLOUD_PROJECT;
  const roles = parseUserRoles(env.USTAAD_USER_ROLES ?? "");
  const [{ applicationDefault, getApps, initializeApp }, { getAuth }] = await Promise.all([import("firebase-admin/app"), import("firebase-admin/auth")]);
  const name = "momentum-user-session";
  const app = getApps().find((a) => a.name === name) ?? initializeApp({ credential: applicationDefault(), projectId }, name);
  return createUserSessionAuth({ auth: getAuth(app), projectId, roles });
}
