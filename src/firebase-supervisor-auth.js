const INVALID_TOKEN_CODES = new Set([
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-id-token",
  "auth/user-disabled",
  "auth/user-not-found",
]);
const verifiedPrincipals = new WeakSet();

export function isVerifiedSupervisorPrincipal(principal) {
  return principal !== null && typeof principal === "object" && verifiedPrincipals.has(principal);
}

function authError(status, code, message) {
  return Object.freeze({ ok: false, status, error: Object.freeze({ code, message }) });
}

function parseBearerToken(header) {
  if (header === undefined || header === null || header === "") return undefined;
  if (typeof header !== "string" || header.length > 8192) return null;
  const match = header.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  return match?.[1] ?? null;
}

export function parseSupervisorUidAllowlist(raw = "") {
  if (typeof raw !== "string") throw new TypeError("Supervisor UID allowlist must be a string.");
  const values = raw.split(",").map((value) => value.trim()).filter(Boolean);
  if (values.some((uid) => !/^[A-Za-z0-9:_-]{1,128}$/.test(uid))) {
    throw new TypeError("Supervisor UID allowlist contains an invalid UID.");
  }
  return Object.freeze([...new Set(values)]);
}

export function createFirebaseSupervisorAuthenticator({
  enabled = false,
  projectId,
  auth,
  allowedUids = [],
  now = () => Date.now(),
} = {}) {
  const ready = enabled === true && typeof projectId === "string" && projectId.length > 0 &&
    auth && typeof auth.verifyIdToken === "function" && Array.isArray(allowedUids) && allowedUids.length > 0 &&
    allowedUids.every((uid) => typeof uid === "string" && uid.length > 0) && typeof now === "function";

  return Object.freeze({
    configured: ready,
    enabled: enabled === true,
    projectId: ready ? projectId : undefined,
    async authenticate(authorizationHeader) {
      if (!ready) {
        return authError(503, "AUTHENTICATION_NOT_CONFIGURED", "Supervisor sign-in is unavailable until Firebase Authentication is configured.");
      }
      const token = parseBearerToken(authorizationHeader);
      if (token === undefined) {
        return authError(401, "AUTHENTICATION_REQUIRED", "Sign in with an approved supervisor account to continue.");
      }
      if (token === null) {
        return authError(401, "INVALID_AUTHENTICATION", "The supervisor sign-in token is invalid or expired. Sign in again.");
      }

      let decoded;
      try {
        decoded = await auth.verifyIdToken(token, true);
      } catch (error) {
        if (INVALID_TOKEN_CODES.has(error?.code)) {
          return authError(401, "INVALID_AUTHENTICATION", "The supervisor sign-in token is invalid, expired, or revoked. Sign in again.");
        }
        return authError(503, "IDENTITY_PROVIDER_UNAVAILABLE", "Supervisor identity could not be verified. Try again later.");
      }

      const nowSeconds = Math.floor(now() / 1000);
      const expectedIssuer = `https://securetoken.google.com/${projectId}`;
      if (!decoded || decoded.aud !== projectId || decoded.iss !== expectedIssuer ||
          typeof decoded.uid !== "string" || decoded.uid.length === 0 ||
          decoded.sub !== decoded.uid || !Number.isSafeInteger(decoded.exp) || decoded.exp <= nowSeconds ||
          !Number.isSafeInteger(decoded.auth_time) || decoded.auth_time > nowSeconds ||
          decoded.firebase?.sign_in_provider !== "google.com") {
        return authError(401, "INVALID_AUTHENTICATION", "The supervisor sign-in token is not valid for this application.");
      }
      if (decoded.role !== "supervisor") {
        return authError(403, "SUPERVISOR_ROLE_REQUIRED", "This account is signed in but does not have supervisor access.");
      }
      if (allowedUids.length > 0 && !allowedUids.includes(decoded.uid)) {
        return authError(403, "SUPERVISOR_NOT_APPROVED", "This supervisor account is not on the approved account list.");
      }
      const principal = Object.freeze({ uid: decoded.uid, role: "supervisor", provider: "google.com" });
      verifiedPrincipals.add(principal);
      return Object.freeze({ ok: true, principal });
    },
  });
}

export async function initializeFirebaseSupervisorAuthenticator(env = process.env) {
  const projectId = env.PROJECT_ID ?? env.GOOGLE_CLOUD_PROJECT;
  const enabled = env.USTAAD_FIREBASE_AUTH_ENABLED === "true";
  if (!enabled) return createFirebaseSupervisorAuthenticator({ enabled: false });
  if (!projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    return createFirebaseSupervisorAuthenticator({ enabled: true });
  }

  try {
    const [{ applicationDefault, getApps, initializeApp }, { getAuth }] = await Promise.all([
      import("firebase-admin/app"),
      import("firebase-admin/auth"),
    ]);
    const appName = "ustaad-supervisor-auth";
    let app = getApps().find((candidate) => candidate.name === appName);
    if (app && app.options.projectId !== projectId) {
      return createFirebaseSupervisorAuthenticator({ enabled: true });
    }
    if (!app) {
      app = initializeApp({ credential: applicationDefault(), projectId }, appName);
    }
    const auth = getAuth(app);
    return createFirebaseSupervisorAuthenticator({
      enabled: true,
      projectId,
      auth,
      allowedUids: parseSupervisorUidAllowlist(env.USTAAD_SUPERVISOR_UID_ALLOWLIST ?? ""),
    });
  } catch {
    return createFirebaseSupervisorAuthenticator({ enabled: true });
  }
}

export function firebaseWebClientConfig(env = process.env) {
  if (env.USTAAD_FIREBASE_AUTH_ENABLED !== "true") return undefined;
  const projectId = env.PROJECT_ID ?? env.GOOGLE_CLOUD_PROJECT;
  const apiKey = env.USTAAD_FIREBASE_WEB_API_KEY;
  const authDomain = env.USTAAD_FIREBASE_AUTH_DOMAIN;
  const appId = env.USTAAD_FIREBASE_WEB_APP_ID;
  if (!projectId || !apiKey || !authDomain || !appId ||
      !/^[A-Za-z0-9_-]{20,}$/.test(apiKey) ||
      !/^[A-Za-z0-9.-]+$/.test(authDomain) ||
      !/^1:\d+:web:[A-Za-z0-9]+$/.test(appId)) return undefined;
  return Object.freeze({ apiKey, authDomain, projectId, appId });
}
