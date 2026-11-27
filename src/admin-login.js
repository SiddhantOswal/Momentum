// Email and password sign-in for the plant owner's own admin account. It is off unless both
// MOMENTUM_ADMIN_EMAIL and MOMENTUM_ADMIN_PASSWORD_HASH are set, and the hash is made with
// tools/hash-admin-password.mjs, so no password is ever stored or committed.
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 32;
const COST = 16384;
const MIN_COST = 16384;
const MAX_COST = 65536;
const HASH_FORMAT = /^scrypt\$(\d+)\$([A-Za-z0-9_-]{16,})\$([A-Za-z0-9_-]{43})$/;
export const MAX_FAILURES = 5;
export const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 5000;

const derive = (password, salt, cost) => new Promise((resolve, reject) => {
  scrypt(password, salt, KEY_LENGTH, { N: cost, maxmem: 256 * 1024 * 1024 }, (error, key) => (error ? reject(error) : resolve(key)));
});
const digest = (value) => createHash("sha256").update(String(value)).digest();

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const key = await derive(password, salt, COST);
  return `scrypt$${COST}$${salt}$${key.toString("base64url")}`;
}

const fail = (status, code, message) => ({ ok: false, status, error: { code, message } });

export function createAdminLogin({ email, passwordHash, now = Date.now } = {}) {
  const normalisedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const parts = typeof passwordHash === "string" ? HASH_FORMAT.exec(passwordHash.trim()) : null;
  // The cost is read from the stored hash, so a typo there must not turn on a login that then fails.
  const costOk = parts !== null && Number(parts[1]) >= MIN_COST && Number(parts[1]) <= MAX_COST && (Number(parts[1]) & (Number(parts[1]) - 1)) === 0;
  const configured = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisedEmail) && costOk;
  const failures = new Map();
  // The failure counter is kept in this process, so on a service with several instances the real
  // limit is the attempt cap times the number of instances.

  const recent = (key) => {
    const entry = failures.get(key);
    if (!entry) return 0;
    if (now() - entry.first > FAILURE_WINDOW_MS) { failures.delete(key); return 0; }
    return entry.count;
  };
  const record = (key) => {
    const entry = failures.get(key);
    if (entry && now() - entry.first <= FAILURE_WINDOW_MS) { entry.count += 1; return; }
    if (failures.size >= MAX_TRACKED_KEYS) failures.delete(failures.keys().next().value);
    failures.set(key, { first: now(), count: 1 });
  };

  return Object.freeze({
    configured,
    async verify({ email: givenEmail, password, clientKey }) {
      if (!configured) return fail(404, "ADMIN_LOGIN_NOT_ENABLED", "Email sign-in is not switched on for this server.");
      const key = typeof clientKey === "string" && clientKey ? clientKey : "unknown";
      if (recent(key) >= MAX_FAILURES) return fail(429, "TOO_MANY_ATTEMPTS", "Too many attempts. Wait a few minutes, then try again.");
      if (typeof givenEmail !== "string" || typeof password !== "string" || givenEmail.length > 320 || password.length === 0 || password.length > 256) {
        return fail(400, "VALIDATION_ERROR", "Enter your email and password.");
      }
      // The password is hashed before either half is compared, so a wrong email takes as long as a wrong password.
      const [, cost, salt, expected] = parts;
      const actual = await derive(password, salt, Number(cost));
      const emailMatches = timingSafeEqual(digest(givenEmail.trim().toLowerCase()), digest(normalisedEmail));
      const passwordMatches = timingSafeEqual(actual, Buffer.from(expected, "base64url"));
      if (!emailMatches || !passwordMatches) {
        record(key);
        return fail(401, "INVALID_CREDENTIALS", "That email and password don't match.");
      }
      failures.delete(key);
      return { ok: true, email: normalisedEmail };
    },
  });
}

export const ADMIN_COOKIE = "__Host-momentum-admin";
export const ADMIN_SESSION_HOURS = 4;

// A signed, expiring cookie that proves the admin password was accepted. With no shared key (one
// local process) a random key is used, so the cookie dies with the process; a deployed service sets
// the shared signing key so every instance accepts it.
export function createAdminSession({ key, now = Date.now } = {}) {
  const secret = typeof key === "string" && /^[a-f0-9]{64}$/.test(key) ? Buffer.from(key, "hex") : randomBytes(32);
  const mac = (payload) => createHmac("sha256", secret).update(`momentum-admin-session:${payload}`).digest("base64url");
  return Object.freeze({
    maxAge: ADMIN_SESSION_HOURS * 60 * 60,
    issue(email) {
      const payload = Buffer.from(JSON.stringify({ e: email, x: now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000 })).toString("base64url");
      return `${payload}.${mac(payload)}`;
    },
    verify(token) {
      if (typeof token !== "string" || token.length > 512) return undefined;
      const [payload, signature, extra] = token.split(".");
      if (!payload || !signature || extra !== undefined) return undefined;
      const expected = Buffer.from(mac(payload));
      const given = Buffer.from(signature);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
      try {
        const { e, x } = JSON.parse(Buffer.from(payload, "base64url").toString());
        return typeof e === "string" && Number.isFinite(x) && x > now() ? { email: e } : undefined;
      } catch { return undefined; }
    },
  });
}
