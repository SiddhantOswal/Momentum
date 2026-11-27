import test from "node:test";
import assert from "node:assert/strict";
import { canApprove, createUserSessionAuth, isSessionPrincipal, parseUserRoles } from "../src/user-session-auth.js";

const NOW = Date.parse("2026-11-21T10:00:00Z");
const token = "aaa.bbb.ccc";
const claims = (over = {}) => ({ uid: "u1", aud: "prepagent-hack", email: "Om@Plant.in", email_verified: true, name: "Om", auth_time: NOW / 1000 - 30, firebase: { sign_in_provider: "google.com" }, ...over });
const fakeAuth = (decoded, { cookieFails = false } = {}) => ({
  verifyIdToken: async () => decoded,
  createSessionCookie: async (t, o) => { if (cookieFails) throw new Error("x"); return `session-for-${t}-${o.expiresIn}`; },
  verifySessionCookie: async (c) => { if (c !== "good") throw new Error("revoked"); return decoded; },
});
const roles = parseUserRoles("om@plant.in:manager, op@plant.in:operator");

test("parses the role allowlist and rejects bad entries", () => {
  assert.equal(roles.get("om@plant.in"), "manager");
  assert.throws(() => parseUserRoles("om@plant.in:admin"));
  assert.throws(() => parseUserRoles("not-an-email:manager"));
});

test("a recent Google sign-in on an approved account gets a session cookie", async () => {
  const auth = createUserSessionAuth({ auth: fakeAuth(claims()), projectId: "prepagent-hack", roles, now: () => NOW });
  const r = await auth.startSession(token);
  assert.equal(r.ok, true);
  assert.equal(r.principal.role, "manager");
  assert.equal(r.principal.email, "om@plant.in");
  assert.match(r.cookie, /^session-for-aaa\.bbb\.ccc-432000000$/);
  assert.ok(isSessionPrincipal(r.principal));
  assert.ok(canApprove(r.principal));
});

test("unapproved, unverified, non-Google, stale or wrong-project sign-ins are refused", async () => {
  const start = (c) => createUserSessionAuth({ auth: fakeAuth(c), projectId: "prepagent-hack", roles, now: () => NOW }).startSession(token);
  assert.equal((await start(claims({ email: "stranger@x.com" }))).error.code, "ACCOUNT_NOT_APPROVED");
  assert.equal((await start(claims({ email_verified: false }))).error.code, "INVALID_AUTHENTICATION");
  assert.equal((await start(claims({ firebase: { sign_in_provider: "password" } }))).error.code, "INVALID_AUTHENTICATION");
  assert.equal((await start(claims({ auth_time: NOW / 1000 - 3600 }))).error.code, "RECENT_SIGN_IN_REQUIRED");
  assert.equal((await start(claims({ aud: "other" }))).error.code, "INVALID_AUTHENTICATION");
  assert.equal((await createUserSessionAuth({ auth: fakeAuth(claims()), projectId: "prepagent-hack", roles, now: () => NOW }).startSession("nope")).error.code, "VALIDATION_ERROR");
});

test("session cookies are verified per request; operators cannot approve", async () => {
  const auth = createUserSessionAuth({ auth: fakeAuth(claims({ email: "op@plant.in" })), projectId: "prepagent-hack", roles, now: () => NOW });
  const ok = await auth.authenticate("good");
  assert.equal(ok.principal.role, "operator");
  assert.equal(canApprove(ok.principal), false);
  assert.equal((await auth.authenticate("revoked")).error.code, "INVALID_AUTHENTICATION");
  assert.equal((await auth.authenticate(undefined)).error.code, "AUTHENTICATION_REQUIRED");
});

test("an unconfigured auth refuses clearly", async () => {
  const auth = createUserSessionAuth({});
  assert.equal(auth.configured, false);
  assert.equal((await auth.authenticate("good")).error.code, "AUTHENTICATION_NOT_CONFIGURED");
});
