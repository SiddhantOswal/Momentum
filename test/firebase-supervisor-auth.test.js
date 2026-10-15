import assert from "node:assert/strict";
import test from "node:test";
import {
  createFirebaseSupervisorAuthenticator,
  firebaseWebClientConfig,
  initializeFirebaseSupervisorAuthenticator,
  parseSupervisorUidAllowlist,
} from "../src/firebase-supervisor-auth.js";

const NOW = Date.parse("2026-10-15T12:00:00.000Z");
const projectId = "prepagent-hack";
const validClaims = {
  aud: projectId,
  iss: `https://securetoken.google.com/${projectId}`,
  uid: "supervisor-1",
  sub: "supervisor-1",
  exp: Math.floor(NOW / 1000) + 3600,
  auth_time: Math.floor(NOW / 1000) - 30,
  firebase: { sign_in_provider: "google.com" },
  role: "supervisor",
};
const token = "header.payload.signature";

function authenticator(claims = validClaims, options = {}) {
  const calls = [];
  const value = createFirebaseSupervisorAuthenticator({
    enabled: true,
    projectId,
    allowedUids: ["supervisor-1"],
    now: () => NOW,
    auth: { verifyIdToken: async (...args) => { calls.push(args); return claims; } },
    ...options,
  });
  return { value, calls };
}

test("Firebase supervisor auth rejects missing, malformed, oversized and unconfigured credentials", async () => {
  const { value } = authenticator();
  assert.equal((await value.authenticate(undefined)).status, 401);
  assert.equal((await value.authenticate("Bearer not-a-jwt")).error.code, "INVALID_AUTHENTICATION");
  assert.equal((await value.authenticate(`Bearer ${"a".repeat(8200)}`)).status, 401);
  const disabled = createFirebaseSupervisorAuthenticator({ enabled: false });
  assert.equal((await disabled.authenticate(`Bearer ${token}`)).status, 503);
});

test("Firebase supervisor auth verifies revocation and accepts only the expected Google supervisor", async () => {
  const { value, calls } = authenticator();
  const result = await value.authenticate(`Bearer ${token}`);
  assert.deepEqual(calls, [[token, true]]);
  assert.deepEqual(result, {
    ok: true,
    principal: { uid: "supervisor-1", role: "supervisor", provider: "google.com" },
  });
});

test("Firebase supervisor auth rejects wrong project, issuer, expiry, future sign-in and provider", async (t) => {
  const mutations = [
    ["audience", { aud: "different-project" }],
    ["issuer", { iss: "https://securetoken.google.com/different-project" }],
    ["expiry", { exp: Math.floor(NOW / 1000) }],
    ["auth time", { auth_time: Math.floor(NOW / 1000) + 10 }],
    ["uid binding", { sub: "different-uid" }],
    ["provider", { firebase: { sign_in_provider: "password" } }],
  ];
  for (const [name, patch] of mutations) {
    await t.test(name, async () => {
      const { value } = authenticator({ ...validClaims, ...patch });
      assert.equal((await value.authenticate(`Bearer ${token}`)).status, 401);
    });
  }
});

test("Firebase supervisor auth rejects non-supervisors, unapproved UIDs and revoked tokens", async (t) => {
  const noRole = authenticator({ ...validClaims, role: "operator" });
  assert.equal((await noRole.value.authenticate(`Bearer ${token}`)).error.code, "SUPERVISOR_ROLE_REQUIRED");
  const notAllowlisted = authenticator(validClaims, { allowedUids: ["other-user"] });
  assert.equal((await notAllowlisted.value.authenticate(`Bearer ${token}`)).error.code, "SUPERVISOR_NOT_APPROVED");
  await t.test("revoked token", async () => {
    const value = createFirebaseSupervisorAuthenticator({
      enabled: true, projectId, allowedUids: ["supervisor-1"], now: () => NOW,
      auth: { verifyIdToken: async () => { throw Object.assign(new Error("revoked"), { code: "auth/id-token-revoked" }); } },
    });
    assert.equal((await value.authenticate(`Bearer ${token}`)).error.code, "INVALID_AUTHENTICATION");
  });
});

test("supervisor allowlist and public Firebase config validate without trusting identity headers", () => {
  assert.deepEqual(parseSupervisorUidAllowlist("uid-1, uid-2,uid-1"), ["uid-1", "uid-2"]);
  assert.throws(() => parseSupervisorUidAllowlist("bad uid"), /invalid UID/);
  const config = firebaseWebClientConfig({
    USTAAD_FIREBASE_AUTH_ENABLED: "true", PROJECT_ID: projectId,
    USTAAD_FIREBASE_WEB_API_KEY: "A".repeat(30),
    USTAAD_FIREBASE_AUTH_DOMAIN: "prepagent-hack.firebaseapp.com",
    USTAAD_FIREBASE_WEB_APP_ID: "1:123456:web:abcdef",
  });
  assert.deepEqual(config, {
    apiKey: "A".repeat(30),
    authDomain: "prepagent-hack.firebaseapp.com",
    projectId,
    appId: "1:123456:web:abcdef",
  });
  assert.equal(firebaseWebClientConfig({ USTAAD_FIREBASE_AUTH_ENABLED: "false" }), undefined);
});

test("Firebase authentication initialization remains disabled until explicitly configured", async () => {
  const auth = await initializeFirebaseSupervisorAuthenticator({
    PROJECT_ID: projectId,
    USTAAD_FIREBASE_AUTH_ENABLED: "false",
  });
  assert.equal(auth.enabled, false);
  assert.equal(auth.configured, false);
  assert.equal(authenticator(validClaims, { allowedUids: [] }).value.configured, false,
    "A trusted role without the owner's explicit UID allowlist must not enable live supervision.");
});
