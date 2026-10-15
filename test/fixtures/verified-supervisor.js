import { createFirebaseSupervisorAuthenticator } from "../../src/firebase-supervisor-auth.js";

// Deterministic Firebase test double. This is never a real identity credential.
export async function testSupervisor(uid = "local-test-supervisor") {
  const now = Date.parse("2026-10-15T10:00:00Z");
  const auth = createFirebaseSupervisorAuthenticator({
    enabled: true, projectId: "prepagent-hack", allowedUids: [uid], now: () => now,
    auth: { verifyIdToken: async () => ({
      uid, sub: uid, aud: "prepagent-hack", iss: "https://securetoken.google.com/prepagent-hack",
      exp: now / 1000 + 3600, auth_time: now / 1000 - 10,
      role: "supervisor", firebase: { sign_in_provider: "google.com" },
    }) },
  });
  return (await auth.authenticate("Bearer test.mock.signature")).principal;
}
