import assert from "node:assert/strict";
import test from "node:test";
import { createHackathonDemoAuthenticator, demoOwnsJob, demoJobIdentity, isDemoPrincipal } from "../src/hackathon-demo-auth.js";
import { canAccessApprovalJob } from "../src/approval-authorization.js";
import { isVerifiedSupervisorPrincipal } from "../src/firebase-supervisor-auth.js";
import { ApprovalAuditSchema } from "../src/schemas.js";
import { randomUUID } from "node:crypto";

const config = { mode: "HACKATHON_DEMO", signingKey: "a".repeat(64), syntheticOnly: true, auditEnabled: true };
const identity = { keyHash: "b".repeat(64), fingerprint: "c".repeat(64) };
test("hackathon policy is explicit, disabled on incomplete configuration and never fabricates a supervisor", () => {
  for (const change of [{ mode: undefined }, { signingKey: undefined }, { signingKey: "short" }, { syntheticOnly: false }, { auditEnabled: false }]) {
    const auth = createHackathonDemoAuthenticator({ ...config, ...change });
    assert.equal(auth.configured, false);
    assert.equal(auth.authenticate("arbitrary").ok, false);
    assert.throws(() => auth.issue());
  }
  const auth = createHackathonDemoAuthenticator(config);
  const principal = auth.authenticate(auth.issue()).principal;
  assert.equal(isDemoPrincipal(principal), true);
  assert.equal(isVerifiedSupervisorPrincipal(principal), false);
  assert.equal(isDemoPrincipal({ ...principal }), false);
  assert.equal(principal.provider, "server-signed-demo-session");
});
test("signed sessions expire, reject forged identity, survive instance changes only with matching key", () => {
  let time = Date.now();
  const a = createHackathonDemoAuthenticator({ ...config, now: () => time });
  const token = a.issue();
  const b = createHackathonDemoAuthenticator({ ...config, now: () => time });
  assert.equal(b.authenticate(token).ok, true);
  for (const invalid of [undefined, "", token + "x", token.replace(/^./, "!"), "Bearer " + token]) assert.equal(a.authenticate(invalid).ok, false);
  assert.equal(createHackathonDemoAuthenticator({ ...config, signingKey: "d".repeat(64) }).authenticate(token).ok, false);
  time += 7200000;
  assert.equal(a.authenticate(token).ok, false);
});
test("concurrent sessions isolate deterministic job identities and reject legacy TEST records", async () => {
  const auth = createHackathonDemoAuthenticator(config);
  const actors = await Promise.all(Array.from({ length: 20 }, async () => auth.authenticate(auth.issue()).principal));
  const jobs = actors.map(actor => demoJobIdentity(actor, identity));
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 20);
  actors.forEach((actor, i) => {
    assert.deepEqual(demoJobIdentity(actor, identity), jobs[i]);
    assert.equal(demoOwnsJob(actor, jobs[i].jobId), true);
    assert.equal(canAccessApprovalJob(actor, jobs[(i + 1) % 20].jobId), false);
    assert.equal(canAccessApprovalJob({ ...actor }, jobs[i].jobId), false);
    assert.equal(canAccessApprovalJob(actor, "JOB-TEST-42"), false);
  });
});
test("audit requires truthful complete demo provenance tied to the exact session namespace", () => {
  const auth = createHackathonDemoAuthenticator(config);
  const actor = auth.authenticate(auth.issue()).principal;
  const audit = { jobId: demoJobIdentity(actor, identity).jobId, actorUid: actor.uid,
    actorType: "HACKATHON_DEMO_PARTICIPANT", authorizationMode: "HACKATHON_DEMO",
    identityProvider: "server-signed-demo-session", authenticatedHuman: false,
    action: "APPROVE", previousStatus: "DRAFT", newStatus: "APPROVED", decidedAt: new Date().toISOString(),
    correlationId: randomUUID(), decisionId: randomUUID(), cardUri: "gs://prepagent-hack-data/jobcards/test.pdf" };
  assert.equal(ApprovalAuditSchema.safeParse(audit).success, true);
  for (const change of [{ authenticatedHuman: true }, { actorUid: "firebase-forged" }, { jobId: "JOB-TEST-42" }, { authorizationMode: undefined }]) assert.equal(ApprovalAuditSchema.safeParse({ ...audit, ...change }).success, false);
});

test("hackathon mode cannot select local mock adapters or per-process Gemini accounting", async () => {
  const { createConfiguredServicePorts } = await import("../src/service-ports.js");
  const env = { PROJECT_ID: "prepagent-hack", USTAAD_AUTHORIZATION_MODE: "HACKATHON_DEMO", USTAAD_ENABLE_DEMO_MODE: "true", USTAAD_ENABLE_LIVE_MODEL_CALLS: "true" };
  const services = createConfiguredServicePorts({ env, modelConfig: { modelCallsEnabled: true, testModel: "test", location: "asia-south1" }, fetchImpl: async () => assert.fail("No cloud call permitted") });
  assert.equal(services.availability.extractOrder, false);
  assert.equal(services.availability.approveJob, false);
  assert.equal(services.geminiUsage.sharedCounterConfigured, false);
});

test("session-scoped identities retain the existing idempotent persistence contract", async () => {
  const { createIdempotentJobService, InMemoryIdempotencyStore } = await import("../src/job-idempotency.js");
  const auth = createHackathonDemoAuthenticator(config);
  const actor = auth.authenticate(auth.issue()).principal;
  const scoped = demoJobIdentity(actor, identity);
  let writes = 0;
  const service = createIdempotentJobService({ store: new InMemoryIdempotencyStore(), leaseMs: 30000,
    createJob: async ({ jobId }) => { writes++; return { ok: true, durable: true, jobId }; },
    loadJob: async ({ jobId }) => ({ ok: true, durable: true, jobId }),
  });
  assert.equal((await service({ identity: scoped })).ok, true);
  assert.equal((await service({ identity: scoped })).ok, true);
  assert.equal(writes, 1);
  assert.equal((await service({ identity: { ...scoped, fingerprint: "f".repeat(64) } })).error.code, "CONFLICT");
  assert.equal((await service({ identity: { ...scoped, jobId: "JOB-TEST-42" } })).ok, false);
});
