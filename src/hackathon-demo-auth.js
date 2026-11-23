import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const principals = new WeakSet();
export const HACKATHON_APPROVAL_NOTE = "Hackathon Demonstration Mode: Supervisor approval is available to all participants for demonstration purposes. In production, approval is restricted to authorised supervisors.";
const SESSION_SECONDS = 7200;
const SID = /^[a-f0-9]{32}$/;
const POLICY_V1 = "HACKATHON_DEMO:v1";
// v2 differs only by a signed grants list; v1 cookies stay valid and carry none.
const POLICY_V2 = "HACKATHON_DEMO:v2";
const KNOWN_GRANTS = ["pitch_reserve"];
export function isDemoPrincipal(value) { return value !== null && typeof value === "object" && principals.has(value); }
export function demoOwnsJob(principal, jobId) {
  return isDemoPrincipal(principal) && typeof jobId === "string" &&
    new RegExp(`^JOB-HACK-${principal.sessionId}-[a-f0-9]{40}$`).test(jobId);
}
export function demoOwnsLot(principal, lotId) {
  return isDemoPrincipal(principal) && typeof lotId === "string" &&
    new RegExp(`^LOT-HACK-${principal.sessionId}-[a-f0-9]{12}$`).test(lotId);
}
export function demoJobIdentity(principal, identity) {
  if (!isDemoPrincipal(principal)) throw new TypeError("Verified demo session required.");
  const keyHash = createHmac("sha256", principal.sessionId).update(identity.keyHash).digest("hex");
  return { ...identity, keyHash,
    jobNamespace: `HACK-${principal.sessionId}`,
    jobId: `JOB-HACK-${principal.sessionId}-${keyHash.slice(0, 40)}` };
}
export function createHackathonDemoAuthenticator({ mode, signingKey, syntheticOnly = false, auditEnabled = false, now = Date.now } = {}) {
  const enabled = mode === "HACKATHON_DEMO";
  // A stable shared secret must be provisioned separately, never generated per instance.
  const configured = enabled && syntheticOnly && auditEnabled && typeof signingKey === "string" && /^[a-f0-9]{64}$/.test(signingKey);
  const mac = (payload) => createHmac("sha256", Buffer.from(signingKey, "hex")).update(payload).digest("base64url");
  const seal = (data) => {
    const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
    return `${payload}.${mac(payload)}`;
  };
  function verify(token) {
    if (typeof token !== "string" || token.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new Error();
    const [payload, signature] = token.split(".");
    const expected = Buffer.from(mac(payload)); const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    const current = Math.floor(now() / 1000);
    const grantsValid = data.policy === POLICY_V1
      ? data.grants === undefined
      : data.policy === POLICY_V2 && Array.isArray(data.grants) && data.grants.length > 0 &&
        data.grants.every((grant) => KNOWN_GRANTS.includes(grant)) && new Set(data.grants).size === data.grants.length;
    if (!SID.test(data.sid) || !grantsValid || !Number.isSafeInteger(data.iat) ||
        data.iat > current || data.exp !== data.iat + SESSION_SECONDS || data.exp <= current) throw new Error();
    return data;
  }
  return Object.freeze({ enabled, configured,
    issue() {
      if (!configured) throw new Error("Hackathon session authorization is not configured.");
      const iat = Math.floor(now() / 1000);
      return seal({ sid: randomUUID().replaceAll("-", ""), iat, exp: iat + SESSION_SECONDS, policy: POLICY_V1 });
    },
    /** Re-signs a valid session with one more grant, keeping its session and expiry. Undefined if the token or grant is not valid. */
    grant(token, grant) {
      if (!configured || !KNOWN_GRANTS.includes(grant)) return undefined;
      try {
        const data = verify(token);
        return seal({ sid: data.sid, iat: data.iat, exp: data.exp, policy: POLICY_V2, grants: [...new Set([...(data.grants ?? []), grant])] });
      } catch { return undefined; }
    },
    authenticate(token) {
      if (!configured) return { ok: false, status: 503, error: { code: "DEMO_AUTHORIZATION_NOT_CONFIGURED", message: "Hackathon authorization requires approved-data restrictions, approval auditing and a shared signing key." } };
      try {
        const data = verify(token);
        const principal = Object.freeze({ uid: `demo:${data.sid}`, sessionId: data.sid, role: "hackathon-participant", provider: "server-signed-demo-session", authorizationMode: "HACKATHON_DEMO", expiresAt: data.exp, grants: Object.freeze([...(data.grants ?? [])]) });
        principals.add(principal);
        return { ok: true, principal };
      } catch { return { ok: false, status: 401, error: { code: "DEMO_SESSION_REQUIRED", message: "Start or renew the temporary hackathon session." } }; }
    },
  });
}
