import test from "node:test";
import assert from "node:assert/strict";
import { provisionSupervisor, restoreSupervisorRole } from "../tools/provision-supervisor.mjs";

test("administrator provisioning preserves unrelated claims and requires explicit apply plus private backup", async () => {
  let user = { uid: "test-uid", email: "owner@example.test", emailVerified: true, customClaims: { existing: "retained" },
    providerData: [{ providerId: "google.com", email: "owner@example.test" }] };
  let writes = 0; let backup;
  const auth = { getUser: async () => structuredClone(user), setCustomUserClaims: async (_uid, claims) => {
    writes += 1; user = { ...user, customClaims: claims };
  } };
  const options = { auth, uid: user.uid, expectedEmail: user.email };
  assert.equal((await provisionSupervisor(options)).applied, false);
  assert.equal(writes, 0);
  await assert.rejects(provisionSupervisor({ ...options, apply: true }), /backup/);
  const result = await provisionSupervisor({ ...options, apply: true, saveBackup: async data => { backup = data; } });
  assert.equal(result.applied, true);
  assert.equal(result.tokenRefreshRequired, true);
  assert.deepEqual(backup.previousClaims, { existing: "retained" });
  assert.deepEqual(user.customClaims, { existing: "retained", role: "supervisor" });
  await assert.rejects(provisionSupervisor({ ...options, expectedEmail: "wrong@example.test", apply: true }), /approved Google identity/);
  assert.equal(writes, 1);
});

test("administrator rollback restores only the backed-up role, retains later unrelated claims and revokes refresh tokens", async () => {
  let user = { uid: "test-uid", email: "owner@example.test", emailVerified: true,
    providerData: [{ providerId: "google.com", email: "owner@example.test" }], customClaims: { role: "supervisor", laterClaim: "retain" } };
  let writes = 0; let revocations = 0;
  const auth = { getUser: async () => structuredClone(user), setCustomUserClaims: async (_uid, claims) => { writes += 1; user.customClaims = claims; },
    revokeRefreshTokens: async () => { revocations += 1; } };
  const options = { auth, uid: user.uid, expectedEmail: user.email, backup: { projectId: "prepagent-hack", uid: user.uid, previousClaims: { oldClaim: true } } };
  assert.equal((await restoreSupervisorRole(options)).applied, false);
  assert.equal(writes, 0);
  await assert.rejects(restoreSupervisorRole({ ...options, backup: { ...options.backup, uid: "other" }, apply: true }), /does not match/);
  await assert.rejects(restoreSupervisorRole({ ...options, apply: true }), /backup/);
  await restoreSupervisorRole({ ...options, apply: true, saveBackup: async () => {} });
  assert.deepEqual(user.customClaims, { laterClaim: "retain" });
  assert.equal(revocations, 1);
  assert.equal((await restoreSupervisorRole({ ...options, apply: true })).alreadyRestored, true);
  user.customClaims.role = "administrator";
  await assert.rejects(restoreSupervisorRole({ ...options, apply: true, saveBackup: async () => {} }), /changed independently/);
  assert.equal(writes, 1);
});
