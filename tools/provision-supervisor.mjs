import { readFile, stat, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

/** Administrator-only tool. Never imported by the HTTP server or container. */
export async function provisionSupervisor({ auth, uid, expectedEmail, apply = false, saveBackup } = {}) {
  if (!auth || typeof auth.getUser !== "function" || typeof auth.setCustomUserClaims !== "function" ||
      !/^[A-Za-z0-9:_-]{1,128}$/.test(uid ?? "") || typeof expectedEmail !== "string" || !expectedEmail.includes("@")) {
    throw new TypeError("An administrative Auth client, exact approved UID and expected email are required.");
  }
  const user = await auth.getUser(uid);
  if (user.uid !== uid || user.disabled || user.emailVerified !== true ||
      user.email?.toLowerCase() !== expectedEmail.toLowerCase() ||
      !user.providerData?.some(p => p.providerId === "google.com" && p.email?.toLowerCase() === expectedEmail.toLowerCase())) {
    throw new Error("The Firebase user does not match the owner's approved Google identity.");
  }
  const previousClaims = user.customClaims ?? {};
  const nextClaims = { ...previousClaims, role: "supervisor" };
  if (Buffer.byteLength(JSON.stringify(nextClaims)) > 1000) throw new Error("Custom claims exceed Firebase's size bound.");
  if (!apply) return { applied: false, uid, existingClaimNames: Object.keys(previousClaims), newRole: "supervisor" };
  if (typeof saveBackup !== "function") throw new Error("A private claims backup is required before applying a role change.");
  await saveBackup({ projectId: "prepagent-hack", uid, previousClaims, backedUpAt: new Date().toISOString() });
  await auth.setCustomUserClaims(uid, nextClaims);
  const readBack = await auth.getUser(uid);
  if (!isDeepStrictEqual(readBack.customClaims, nextClaims)) throw new Error("Supervisor claim read-back differs from the requested claims.");
  return { applied: true, uid, tokenRefreshRequired: true, instruction: "Sign out and sign in again, or select Refresh access before acceptance." };
}

/** Roll back only this tool's role assignment, retaining other current claims. */
export async function restoreSupervisorRole({ auth, uid, expectedEmail, backup, apply = false, saveBackup } = {}) {
  // Reuse the dry-run identity checks; this never changes claims.
  await provisionSupervisor({ auth, uid, expectedEmail });
  if (backup?.projectId !== "prepagent-hack" || backup.uid !== uid ||
      !backup.previousClaims || typeof backup.previousClaims !== "object" || Array.isArray(backup.previousClaims) ||
      (backup.previousClaims.role !== undefined && typeof backup.previousClaims.role !== "string")) {
    throw new Error("The private claims backup does not match this project and UID.");
  }
  const current = (await auth.getUser(uid)).customClaims ?? {};
  const next = { ...current };
  if (backup.previousClaims.role === undefined) delete next.role;
  else next.role = backup.previousClaims.role;
  if (isDeepStrictEqual(current, next)) return { applied: false, uid, alreadyRestored: true };
  if (current.role !== "supervisor") throw new Error("The current role changed independently; rollback needs owner review.");
  if (!apply) return { applied: false, uid, restoresPreviousRoleOnly: true };
  if (typeof saveBackup !== "function" || typeof auth.revokeRefreshTokens !== "function") {
    throw new Error("Private current-claims backup and token revocation are required for rollback.");
  }
  await saveBackup({ projectId: "prepagent-hack", uid, previousClaims: current, backedUpAt: new Date().toISOString() });
  await auth.setCustomUserClaims(uid, next);
  if (!isDeepStrictEqual((await auth.getUser(uid)).customClaims, next)) throw new Error("Restored role read-back differs from the request.");
  await auth.revokeRefreshTokens(uid);
  return { applied: true, uid, restoredPreviousRoleOnly: true, refreshTokensRevoked: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = Object.fromEntries(process.argv.slice(2).filter(v => v.includes("=")).map(v => {
    const i = v.indexOf("="); return [v.slice(0, i), v.slice(i + 1)];
  }));
  const apply = process.argv.includes("--apply");
  if (args["--project"] !== "prepagent-hack" || !args["--uid"] || !args["--expected-email"] ||
      (apply && !args["--backup"])) throw new Error("Usage: --project=prepagent-hack --uid=<approved-uid> --expected-email=<approved-email> [--apply --backup=/private/tmp/claims-backup.json]");
  const { initializeApp, applicationDefault } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const auth = getAuth(initializeApp({ projectId: "prepagent-hack", credential: applicationDefault() }, "ustaad-owner-provisioning"));
  const options = { auth, uid: args["--uid"], expectedEmail: args["--expected-email"], apply,
    saveBackup: async data => writeFile(args["--backup"], JSON.stringify(data, null, 2) + "\n", { mode: 0o600, flag: "wx" }) };
  let result;
  if (args["--restore-role-backup"]) {
    const path = args["--restore-role-backup"];
    if ((await stat(path)).mode & 0o077) throw new Error("The claims backup must not be group/world accessible.");
    result = await restoreSupervisorRole({ ...options, backup: JSON.parse(await readFile(path, "utf8")) });
  } else result = await provisionSupervisor(options);
  // No email, token, password or full claims are printed.
  console.info(JSON.stringify(result));
}
