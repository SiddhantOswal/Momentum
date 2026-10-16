import assert from "node:assert/strict";
import test from "node:test";
import { jobSheetFixture } from "./fixtures/job-sheet.js";
import { createTraceRegistry } from "../src/trace-registry.js";
import { createJobCoordinator } from "../src/job-coordinator.js";
import {
  createJobRequestIdentity,
  InMemoryIdempotencyStore,
} from "../src/job-idempotency.js";
import {
  createJobSubmissionHandler,
  createPersistableJobCreator,
  mergeDraftWriteArgs,
  readPersistedDraft,
} from "../src/job-draft-persistence.js";

const FILE_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const TEST_CONDITIONS_PROVENANCE = {
  readingId: "READ-OFFLINE-TEST-001",
  timestamp: "2026-10-11T11:59:00.000Z",
  plantId: "PLANT-01",
  source: "simulated",
  recordedSource: "offline test adapter",
  retrievedAt: "2026-10-11T12:00:00.000Z",
  ageSeconds: 60,
  freshness: "fresh",
};

function request() {
  return {
    file: { arrayBuffer: async () => FILE_BYTES.buffer },
    operatorFields: {
      orderId: jobSheetFixture.order.orderId,
      paperType: jobSheetFixture.order.paperType,
      paperSupplier: jobSheetFixture.order.paperSupplier,
    },
    operatorItemConfirmation: {
      itemCode: jobSheetFixture.order.itemCode,
      quantity: jobSheetFixture.order.quantity,
    },
    shift: jobSheetFixture.conditions.shift,
    levers: jobSheetFixture.baseline.levers,
    conditionsConfirmed: true,
  };
}

function identityFor(overrides = {}) {
  return createJobRequestIdentity({
    fileBytes: FILE_BYTES,
    operatorFields: request().operatorFields,
    operatorItemConfirmation: request().operatorItemConfirmation,
    shift: request().shift,
    levers: request().levers,
    conditions: request().manualConditions,
    ...overrides,
  }).identity;
}

function succeedingPorts(calls) {
  const evidence = [{
    lotId: "LOT-SYNTHETIC-001",
    orderId: jobSheetFixture.order.orderId,
    runDate: jobSheetFixture.conditions.runDate,
    primaryDefect: "WARP",
    ratesPct: jobSheetFixture.baseline.risk.ratesPct,
    levers: jobSheetFixture.baseline.levers,
  }];
  return {
    extractOrder: async (input) => {
      calls.push(["extractOrder", input]);
      return {
        ok: true,
        orderProfile: jobSheetFixture.order,
        missingFields: [],
        needsClarification: false,
      };
    },
    currentConditions: async (input) => {
      calls.push(["getConditions", input]);
      return { ok: true, data: jobSheetFixture.conditions, provenance: TEST_CONDITIONS_PROVENANCE };
    },
    predictRisk: async (input) => {
      calls.push(["predictRisk", input]);
      return { ok: true, ...jobSheetFixture.baseline.risk };
    },
    optimizeRisk: async (input) => {
      calls.push(["optimizeRisk", input]);
      return {
        ok: true,
        baseline: jobSheetFixture.baseline,
        best: jobSheetFixture.recommended,
        changes: [],
        savings: jobSheetFixture.savings,
      };
    },
    findSimilarRuns: async (input) => {
      calls.push(["findSimilarRuns", input]);
      return { ok: true, evidence };
    },
    explainRisk: async (input) => {
      calls.push(["explainRisk", input]);
      return { ok: true, explanation: jobSheetFixture.explanation };
    },
  };
}

function unavailableExtractPorts(calls) {
  return {
    extractOrder: async () => {
      calls.push("extractOrder");
      return {
        ok: false,
        error: { code: "SERVICE_UNAVAILABLE", message: "Extraction is not configured." },
      };
    },
    currentConditions: async () => {
      calls.push("getConditions");
      return { ok: true, data: jobSheetFixture.conditions };
    },
    predictRisk: async () => {
      calls.push("predictRisk");
      return { ok: true, ...jobSheetFixture.baseline.risk };
    },
    optimizeRisk: async () => {
      calls.push("optimizeRisk");
      return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Optimizer is not configured." } };
    },
  };
}

const CONFIGURED_PLANT_ID = "PLANT-01";

function prepareFromPorts(ports, plantId) {
  return createJobCoordinator({
    services: ports,
    ...(plantId === undefined ? {} : { plantId }),
    traceRegistry: createTraceRegistry({
      idFactory: (() => {
        let n = 0;
        return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
      })(),
    }),
  });
}

function durableSubmitHandler(options = {}) {
  const plantId = Object.hasOwn(options, "plantId") ? options.plantId : CONFIGURED_PLANT_ID;
  return createJobSubmissionHandler({
    prepareJob: prepareFromPorts(options.ports ?? succeedingPorts([]), plantId),
    createDraftJobSheet: options.persist,
    getStoredJobSheet: options.getStored ?? (async () => null),
    draftPersistenceEnabled: true,
    storedJobLookupEnabled: true,
    plantId,
    store: options.store ?? new InMemoryIdempotencyStore({ leaseMs: 30_000 }),
    leaseMs: 30_000,
  });
}

test("mergeDraftWriteArgs copies plant, savings, and currency from the JobSheet when omitted", () => {
  const merged = mergeDraftWriteArgs({ jobSheet: jobSheetFixture, jobId: jobSheetFixture.jobId }, "PLANT-01");
  assert.equal(merged.plantId, "PLANT-01");
  assert.equal(merged.savingsCost, jobSheetFixture.savings.inr);
  assert.equal(merged.currency, jobSheetFixture.baseline.risk.currency);
  assert.equal(merged.jobId, jobSheetFixture.jobId);
  const explicit = mergeDraftWriteArgs({
    jobSheet: { ...jobSheetFixture, plantId: "PLANT-SHEET" },
    plantId: "PLANT-CALLER",
    savingsCost: 9,
    currency: "JPY",
  }, "PLANT-01");
  assert.equal(explicit.plantId, "PLANT-CALLER");
  assert.equal(explicit.savingsCost, 9);
  assert.equal(explicit.currency, "JPY");
  assert.equal(mergeDraftWriteArgs({ jobSheet: { savings: {} } }).plantId, undefined);
});

test("readPersistedDraft accepts a repository createDraft document without an ok envelope", () => {
  const saved = { ...jobSheetFixture, plantId: "PLANT-01", status: "DRAFT", createdAt: "2026-10-12T10:00:00.000Z" };
  assert.equal(readPersistedDraft(saved, jobSheetFixture.jobId).jobId, jobSheetFixture.jobId);
  assert.equal(readPersistedDraft({ ok: true, jobSheet: jobSheetFixture }, jobSheetFixture.jobId).jobId, jobSheetFixture.jobId);
  assert.equal(readPersistedDraft({ ok: true }, jobSheetFixture.jobId), undefined);
  assert.equal(readPersistedDraft({ ok: false, error: { code: "SERVICE_UNAVAILABLE" } }, jobSheetFixture.jobId), undefined);
  assert.equal(readPersistedDraft({ ...saved, jobId: "OTHER" }, jobSheetFixture.jobId), undefined);
  assert.equal(readPersistedDraft({ ...saved, status: "APPROVED" }, jobSheetFixture.jobId), undefined);
});

test("draft persistence is not called when an earlier workflow stage is unavailable", async () => {
  const workflowCalls = [];
  const persistCalls = [];
  const identity = identityFor();
  const submitJob = durableSubmitHandler({
    ports: unavailableExtractPorts(workflowCalls),
    persist: async (input) => {
      persistCalls.push(input);
      return { ok: true, jobSheet: input.jobSheet };
    },
  });

  const result = await submitJob({ identity, request: request() });
  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "extractOrder");
  assert.equal(result.durable, undefined);
  assert.deepEqual(workflowCalls, ["extractOrder"]);
  assert.deepEqual(persistCalls, []);
});

test("a completed workflow persists the validated JobSheet under the request identity", async () => {
  const persistCalls = [];
  const identity = identityFor();
  const stored = new Map();
  const controller = new AbortController();
  const submitJob = durableSubmitHandler({
    persist: async (input) => {
      persistCalls.push(input);
      const document = {
        ...input.jobSheet,
        plantId: input.plantId,
        status: "DRAFT",
        createdAt: "2026-10-13T00:00:00.000Z",
      };
      stored.set(input.jobId, document);
      return document;
    },
    getStored: async ({ jobId }) => stored.get(jobId) ?? null,
  });

  const result = await submitJob({ identity, request: request(), signal: controller.signal });
  assert.equal(result.ok, true);
  assert.equal(result.durable, true);
  assert.equal(result.jobId, identity.jobId);
  assert.equal(result.jobSheet.jobId, identity.jobId);
  assert.equal(result.jobSheet.status, "DRAFT");
  assert.equal(result.jobSheet.plantId, CONFIGURED_PLANT_ID);
  assert.equal(result.jobSheet.order.orderId, jobSheetFixture.order.orderId);
  assert.equal(persistCalls.length, 1);
  assert.equal(persistCalls[0].jobId, identity.jobId);
  assert.equal(persistCalls[0].plantId, CONFIGURED_PLANT_ID);
  assert.equal(persistCalls[0].savingsCost, jobSheetFixture.savings.inr);
  assert.equal(persistCalls[0].currency, jobSheetFixture.baseline.risk.currency);
  assert.equal(persistCalls[0].signal, controller.signal);
  assert.equal(persistCalls[0].jobSheet.jobId, identity.jobId);
  assert.equal(persistCalls[0].jobSheet.status, "DRAFT");
  assert.deepEqual(persistCalls[0].jobSheet.order, jobSheetFixture.order);
  assert.equal(
    persistCalls[0].jobSheet.explanation,
    `Savings are optimizer-reported estimates, not verified production outcomes. ${jobSheetFixture.explanation}`,
  );
});

test("a repository-shaped createDraft success is treated as durable, not as adapter failure", async () => {
  const identity = identityFor({ idempotencyKey: "draft-repo-shape" });
  const createJob = createPersistableJobCreator({
    draftPersistenceEnabled: true,
    prepareJob: async ({ jobId }) => ({
      ok: true,
      jobSheet: { ...jobSheetFixture, jobId, status: "DRAFT" },
    }),
    plantId: CONFIGURED_PLANT_ID,
    createDraftJobSheet: async ({ jobSheet, jobId }) => ({
      ...jobSheet,
      jobId,
      plantId: CONFIGURED_PLANT_ID,
      status: "DRAFT",
      createdAt: "2026-10-13T00:00:00.000Z",
    }),
  });

  const result = await createJob({ jobId: identity.jobId, request: request() });
  assert.equal(result.ok, true);
  assert.equal(result.durable, true);
  assert.equal(result.jobSheet.jobId, identity.jobId);
});

test("persistence failure does not report success and releases the idempotency claim", async () => {
  const identity = identityFor({ idempotencyKey: "draft-fail" });
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  let attempts = 0;
  const submitJob = durableSubmitHandler({
    store,
    persist: async ({ jobSheet }) => {
      attempts += 1;
      if (attempts === 1) {
        return { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "BigQuery write refused." } };
      }
      return {
        ok: true,
        jobSheet: {
          ...jobSheet,
          plantId: CONFIGURED_PLANT_ID,
          status: "DRAFT",
        },
      };
    },
  });

  const first = await submitJob({ identity, request: request() });
  assert.equal(first.ok, false);
  assert.equal(first.error.code, "SERVICE_UNAVAILABLE");
  assert.equal(first.durable, undefined);
  assert.equal(store.inspect(identity.keyHash), undefined);

  const second = await submitJob({ identity, request: request() });
  assert.equal(second.ok, true);
  assert.equal(second.durable, true);
  assert.equal(attempts, 2);
});

test("duplicate submissions reuse the idempotency contract and do not create a second draft", async () => {
  const identity = identityFor({ idempotencyKey: "draft-dup" });
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const persistCalls = [];
  const stored = new Map();
  const submitJob = durableSubmitHandler({
    store,
    persist: async (input) => {
      persistCalls.push(input);
      stored.set(input.jobId, { ...input.jobSheet, status: "DRAFT" });
      return { ok: true, jobSheet: stored.get(input.jobId) };
    },
    getStored: async ({ jobId }) => stored.get(jobId) ?? null,
  });

  const first = await submitJob({ identity, request: request() });
  const second = await submitJob({ identity, request: request() });
  assert.equal(first.ok, true);
  assert.equal(first.durable, true);
  assert.equal(second.ok, true);
  assert.equal(second.durable, true);
  assert.equal(second.jobSheet.jobId, identity.jobId);
  assert.equal(persistCalls.length, 1);
  assert.equal(store.inspect(identity.keyHash).status, "complete");
});

test("malformed persistence results are not treated as durable drafts", async () => {
  const cases = [
    undefined,
    null,
    { ok: true },
    { ok: true, jobSheet: { jobId: "OTHER-JOB", status: "DRAFT" } },
    { jobId: "OTHER-JOB", status: "DRAFT" },
    { ok: true, jobSheet: { jobId: identityFor().jobId, status: "APPROVED" } },
  ];
  for (const [index, saved] of cases.entries()) {
    const identity = identityFor({ idempotencyKey: `malformed-${index}` });
    const expectedId = identity.jobId;
    const createJob = createPersistableJobCreator({
      draftPersistenceEnabled: true,
      plantId: CONFIGURED_PLANT_ID,
      prepareJob: async ({ jobId }) => ({
        ok: true,
        jobSheet: { ...jobSheetFixture, jobId, status: "DRAFT" },
      }),
      createDraftJobSheet: async () => {
        if (saved?.ok === true && saved.jobSheet?.status === "APPROVED") {
          return { ok: true, jobSheet: { jobId: expectedId, status: "APPROVED" } };
        }
        return saved;
      },
    });
    const result = await createJob({ jobId: expectedId, request: request() });
    assert.equal(result.ok, false, JSON.stringify(saved));
    assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
    assert.notEqual(result.durable, true);
  }
});

test("an unconfigured persistence adapter never claims that a durable draft was created", async () => {
  let preparationCalls = 0;
  const persistCalls = [];
  const identity = identityFor({ idempotencyKey: "no-persist" });
  const submitJob = createJobSubmissionHandler({
    prepareJob: async () => {
      preparationCalls += 1;
      return { ok: true, jobSheet: jobSheetFixture };
    },
    createDraftJobSheet: async (input) => {
      persistCalls.push(input);
      return { ok: true, jobSheet: input.jobSheet };
    },
    getStoredJobSheet: async () => null,
    draftPersistenceEnabled: false,
    storedJobLookupEnabled: false,
    store: new InMemoryIdempotencyStore({ leaseMs: 30_000 }),
    leaseMs: 30_000,
  });

  const result = await submitJob({ identity, request: request() });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  assert.match(result.error.message, /Durable JobSheet persistence is not configured/);
  assert.equal(result.jobSheet, undefined);
  assert.equal(preparationCalls, 0);
  assert.deepEqual(persistCalls, []);
});

test("persistence is not attempted when a later workflow stage is unavailable", async () => {
  const workflowCalls = [];
  const persistCalls = [];
  const ports = succeedingPorts(workflowCalls);
  ports.findSimilarRuns = async (input) => {
    workflowCalls.push(["findSimilarRuns", input]);
    return {
      ok: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Om's similar-run query is not configured." },
    };
  };
  const submitJob = durableSubmitHandler({
    ports,
    persist: async (input) => {
      persistCalls.push(input);
      return { ok: true, jobSheet: input.jobSheet };
    },
  });

  const result = await submitJob({ identity: identityFor({ idempotencyKey: "later-stage" }), request: request() });
  assert.equal(result.ok, false);
  assert.equal(result.blockedAt, "findSimilarRuns");
  assert.notEqual(result.durable, true);
  assert.deepEqual(persistCalls, []);
  assert.deepEqual(workflowCalls.map(([name]) => name), [
    "extractOrder", "getConditions", "predictRisk", "optimizeRisk", "findSimilarRuns",
  ]);
});

test("a missing plant ID does not call the adapter or claim a durable draft", async () => {
  const persistCalls = [];
  const identity = identityFor({ idempotencyKey: "no-plant" });
  const submitJob = durableSubmitHandler({
    plantId: undefined,
    ports: succeedingPorts([]),
    persist: async (input) => {
      persistCalls.push(input);
      return { ok: true, jobSheet: input.jobSheet };
    },
  });
  const result = await submitJob({
    identity,
    request: request(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  assert.notEqual(result.durable, true);
  assert.deepEqual(persistCalls, []);
});

test("a thrown persistence error does not report success and releases the claim for retry", async () => {
  const identity = identityFor({ idempotencyKey: "draft-throw" });
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  let attempts = 0;
  const submitJob = durableSubmitHandler({
    store,
    persist: async (input) => {
      attempts += 1;
      if (attempts === 1) throw new Error("writer unavailable");
      return { ok: true, jobSheet: { ...input.jobSheet, status: "DRAFT" } };
    },
  });

  const first = await submitJob({ identity, request: request() });
  assert.equal(first.ok, false);
  assert.equal(first.error.code, "SERVICE_UNAVAILABLE");
  assert.equal(store.inspect(identity.keyHash), undefined);

  const second = await submitJob({ identity, request: request() });
  assert.equal(second.ok, true);
  assert.equal(second.durable, true);
  assert.equal(attempts, 2);
});

test("enabled persistence without a shared store does not return a non-durable success", async () => {
  const persistCalls = [];
  const submitJob = createJobSubmissionHandler({
    prepareJob: prepareFromPorts(succeedingPorts([]), CONFIGURED_PLANT_ID),
    createDraftJobSheet: async (input) => {
      persistCalls.push(input);
      return { ok: true, jobSheet: input.jobSheet };
    },
    draftPersistenceEnabled: true,
    plantId: CONFIGURED_PLANT_ID,
  });
  const result = await submitJob({
    identity: identityFor({ idempotencyKey: "no-store" }),
    request: request(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  assert.notEqual(result.durable, true);
  assert.deepEqual(persistCalls, []);
});

test("persistence AbortError is propagated and releases the idempotency claim", async () => {
  const identity = identityFor({ idempotencyKey: "draft-abort" });
  const store = new InMemoryIdempotencyStore({ leaseMs: 30_000 });
  const submitJob = durableSubmitHandler({
    store,
    persist: async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    },
  });

  await assert.rejects(submitJob({ identity, request: request() }), { name: "AbortError" });
  assert.equal(store.inspect(identity.keyHash), undefined);
});

test("completed request replay retains the durable APPROVED lifecycle and audit", async () => {
  const { createStoredJobReplayLoader } = await import("../src/job-draft-persistence.js");
  const approvedAt = "2026-10-16T12:00:00.000Z";
  const cardUri = "gs://prepagent-hack-data/jobcards/TEST-approved.pdf";
  const approved = { ...structuredClone(jobSheetFixture), plantId: "PLANT-01", status: "APPROVED",
    createdAt: "2026-10-16T11:59:00.000Z", approvedAt, cardUri,
    savings: { kg: jobSheetFixture.savings.kg, amount: jobSheetFixture.savings.inr, currency: "INR" },
    approvalAudit: { jobId: jobSheetFixture.jobId, actorUid: "test-supervisor", action: "APPROVE",
      previousStatus: "DRAFT", newStatus: "APPROVED", decidedAt: approvedAt, cardUri,
      correlationId: "b7380926-8709-4cda-8395-27a742686de2", decisionId: "16d914b6-7315-43f2-8f6b-41063f909e24" } };
  const load = createStoredJobReplayLoader({ storedJobLookupEnabled: true, getStoredJobSheet: async () => approved });
  const result = await load({ jobId: approved.jobId });
  assert.equal(result?.jobSheet.status, "APPROVED");
  assert.deepEqual(result.jobSheet.approvalAudit, approved.approvalAudit);
  assert.equal(await load({ jobId: "WRONG-JOB" }), null);
  approved.approvalAudit.cardUri = "gs://prepagent-hack-data/jobcards/OTHER.pdf";
  assert.equal(await load({ jobId: approved.jobId }), null);
});
