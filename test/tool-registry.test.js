import assert from "node:assert/strict";
import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import { createHackathonDemoAuthenticator } from "../src/hackathon-demo-auth.js";
import { readDailyGeminiCallCapConfig, withDailyGeminiCallCap } from "../src/daily-gemini-call-cap.js";
import { createApprovedPhotoService } from "../src/google-cloud/approved-photo-service.js";
import { budgetCapStore, createFirestoreBudgetStore } from "../src/google-cloud/firestore-budget-store.js";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";

const module = await import("../src/arc/tools/index.js").catch((error) => {
  if (error.code !== "ERR_MODULE_NOT_FOUND" || !error.url?.endsWith("/src/arc/tools/index.js")) throw error;
  return {};
});

const names = [
  "get_status", "list_samples", "read_order", "get_weather", "set_conditions", "plan_lot",
  "retry_explanation", "get_lot", "list_next_actions", "get_job", "get_job_card",
  "list_approved_photos", "diagnose_approved_photo", "search_defect_history", "query_metric",
  "confirm_order", "confirm_conditions",
];
// Reached only from a fixed plan: never declared to the model and never in its allow-list.
const codeOnly = ["retry_explanation", "confirm_order", "confirm_conditions"];
const auth = createHackathonDemoAuthenticator({
  mode: "HACKATHON_DEMO", syntheticOnly: true, auditEnabled: true, signingKey: "a".repeat(64),
});
const principal = auth.authenticate(auth.issue()).principal;
const ipKey = "a".repeat(16);
const lotId = `LOT-HACK-${principal.sessionId}-${"a".repeat(12)}`;
const jobId = `JOB-HACK-${principal.sessionId}-${"b".repeat(40)}`;
const foreignJob = `JOB-HACK-${"c".repeat(32)}-${"d".repeat(40)}`;
const step = {
  taskRunId: "6f1c2a44-8b0e-4d51-9c7a-3e5d1b7f0a21", stepId: "read_order", attempt: 0,
  leaseOwner: "3f1c2a44-8b0e-4d51-9c7a-3e5d1b7f0a21",
};
const session = { sessionId: principal.sessionId, activeLotIds: [lotId], jobIds: [jobId] };
const sampleFilename = "PO1_ClientA_single_B1047.pdf";
const purchaseOrderPolicy = { syntheticOnly: true, extractionAdapterConfigured: true };
const orderDeps = { executionMode: "live-service", purchaseOrderPolicy, liveStore: { publish: async () => {} } };

function registry(options = {}) {
  assert.equal(typeof module.createToolRegistry, "function", "Arc tool registry must exist");
  return module.createToolRegistry({ principal, ipKey, session, ...options });
}

test("the complete registry supplies strict schemas, preconditions, keys and executors", async () => {
  const arc = registry();
  const tools = arc.tools;
  assert.deepEqual(Object.keys(tools), names);
  for (const tool of Object.values(tools)) {
    assert.equal(typeof tool.precondition, "function");
    assert.equal(typeof tool.key, "function");
    assert.equal(typeof tool.execute, "function");
    assert.equal(tool.schema().safeParse({ unexpected: true }).success, false);
  }
  assert.equal((await arc.execute("get_status", {})).ok, true);
});

test("Vertex declarations match the full parameter contract at each discovery state", { timeout: 2000 }, async (t) => {
  const reviewId = step.taskRunId;
  const line = { itemCode: "B1047", quantity: 10 };
  const deps = {
    ...orderDeps,
    runWriteEffect: async (_claim, run) => run(),
    servicePorts: {
      extractOrderForReview: async () => ({ ok: true, reviewId, lines: [line] }),
      getApprovedPhotos: async () => ({ ok: true, photos: [{ id: "photo-01" }, { id: "photo-03" }] }),
    },
  };
  const empty = { type: "OBJECT", properties: {} };
  const parameters = {
    get_status: empty,
    list_samples: empty,
    get_weather: empty,
    set_conditions: {
      type: "OBJECT",
      properties: {
        conditions: {
          type: "OBJECT",
          properties: {
            runDate: { type: "STRING", format: "date" },
            shift: { type: "STRING", enum: ["DAY", "NIGHT"] },
            ambientRhPct: { type: "NUMBER", minimum: 0, maximum: 100 },
            ambientTempC: { type: "NUMBER" },
            paperMoisturePct: { type: "NUMBER", minimum: 0, maximum: 20 },
          },
        },
      },
      required: ["conditions"],
    },
    plan_lot: empty,
    get_lot: empty,
    list_next_actions: empty,
    list_approved_photos: empty,
    search_defect_history: {
      type: "OBJECT",
      properties: {
        defect: { type: "STRING", enum: ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"] },
        ambientRhPct: { type: "NUMBER", minimum: 0, maximum: 100 },
      },
      required: ["defect", "ambientRhPct"],
    },
    query_metric: {
      type: "OBJECT",
      properties: {
        metric: { type: "STRING", enum: ["model_holdout_r2", "defect_history_at_humidity", "top_scrap_items", "catalog_item"] },
        filters: {
          type: "OBJECT",
          properties: {
            defect: { type: "STRING", enum: ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"] },
            ambientRhPct: { type: "NUMBER", minimum: 0, maximum: 100 },
            limit: { type: "INTEGER", minimum: 1, maximum: 10 },
            itemCode: { type: "STRING", pattern: "^[A-Za-z0-9][A-Za-z0-9-]{0,31}$" },
          },
        },
      },
      required: ["metric", "filters"],
    },
  };
  function assertContract(arc, allowed, context) {
    const expectedNames = names.filter((name) => Object.hasOwn(parameters, name));
    assert.deepEqual(expectedNames.filter((name) => codeOnly.includes(name)), []);
    assert.deepEqual(arc.declarations(), [{
      functionDeclarations: expectedNames.map((name) => ({
        name, description: arc.tools[name].description, parameters: parameters[name],
      })),
    }]);
    assert.deepEqual(arc.allowedFunctionNames(context), names.filter((name) => allowed.includes(name)));
  }

  const arc = registry({ session: { ...session, activeLotIds: [], jobIds: [] }, deps });
  const initial = ["get_status", "list_samples", "get_weather", "list_next_actions",
    "list_approved_photos", "search_defect_history"];
  await t.test("nothing discovered", () => assertContract(arc, initial));

  await t.test("one order read", async () => {
    assert.equal((await arc.execute("list_samples", {})).ok, true);
    assert.deepEqual(await arc.execute("read_order", { sampleId: "PO1" }, { step }), {
      ok: true, reviewId, lines: [line],
    });
    parameters.read_order = {
      type: "OBJECT", properties: { sampleId: { type: "STRING", enum: ["PO1", "PO2", "PO3", "PO4", "PO5"] } },
      required: ["sampleId"],
    };
    const sample = arc.declarations()[0].functionDeclarations.find(({ name }) => name === "read_order").parameters;
    assert.deepEqual(sample.properties.sampleId.enum, arc.tools.read_order.schema().shape.sampleId.options);
    assertContract(arc, [...initial, "read_order"]);
  });

  const lot = { lotId, ownerSessionId: principal.sessionId, reviewId, orderRef: line };
  const confirmedOrder = { ...line, lineIndex: 0, reviewId, reviewFingerprint: "b".repeat(64) };
  const context = { lot, confirmedOrder };
  const chosen = [...initial, "read_order", "get_lot", "set_conditions", "diagnose_approved_photo"];
  const chosenSession = { ...session, jobIds: [] };
  await t.test("lines chosen", async () => {
    const withLot = registry({ session: chosenSession, deps });
    assert.equal((await withLot.execute("list_samples", {})).ok, true);
    assert.equal((await withLot.execute("list_approved_photos", {})).ok, true);
    parameters.diagnose_approved_photo = {
      type: "OBJECT", properties: { photoId: { type: "STRING", enum: ["photo-01", "photo-03"] } },
      required: ["photoId"],
    };
    assertContract(withLot, chosen, context);
  });

  await t.test("a draft present", async () => {
    const withDraft = registry({ session: { ...session, jobIds: [jobId, foreignJob] }, deps });
    assert.equal((await withDraft.execute("list_samples", {})).ok, true);
    assert.equal((await withDraft.execute("list_approved_photos", {})).ok, true);
    const job = { type: "STRING", enum: [jobId] };
    parameters.get_job = { type: "OBJECT", properties: { jobId: job }, required: ["jobId"] };
    parameters.get_job_card = {
      type: "OBJECT",
      properties: {
        lang: { type: "STRING", enum: ["en"] },
        currency: { type: "STRING", enum: ["INR", "JPY", "KRW", "CNY", "IDR", "SGD", "AUD", "THB", "PHP", "MYR", "USD"] },
        jobId: job,
      },
      required: ["jobId"],
    };
    assertContract(withDraft, [...chosen, "get_job", "get_job_card"], {
      ...context, lot: { ...lot, stage: "draft_review", jobId },
    });
  });
});

test("approval names and inherited object properties never select a tool", async () => {
  const arc = registry();
  for (const name of ["approve", "approve_job", "confirm_order", "confirm_conditions", "__proto__", "constructor"]) {
    assert.equal((await arc.execute(name, {})).error.code, "VALIDATION_ERROR");
    assert.ok(!arc.allowedFunctionNames().includes(name));
  }
});

test("unknown arguments, nested keys and confirmation inputs fail validation", async () => {
  const arc = registry();
  for (const [name, args] of [
    ["get_status", { sessionId: principal.sessionId }],
    ["get_job_card", { jobId, reviewConfirmed: true }],
    ["plan_lot", { conditionsConfirmed: true }],
    ["set_conditions", { conditions: { shift: "DAY", confirmed: true } }],
    ["search_defect_history", { defect: "WARP", ambientRhPct: 42, sql: "arbitrary" }],
  ]) assert.equal((await arc.execute(name, args)).error.code, "VALIDATION_ERROR");
});

test("an approved sample is selectable only after discovery in this registry", async () => {
  const extracted = [];
  const claims = [];
  const arc = registry({ deps: {
    ...orderDeps,
    runWriteEffect: async (claim, run) => { claims.push(claim); return run(); },
    servicePorts: { async extractOrderForReview(input) {
      extracted.push(input);
      return { ok: true, reviewId: "6f1c2a44-8b0e-4d51-9c7a-3e5d1b7f0a21" };
    } },
  } });
  assert.equal(arc.tools.read_order.schema().safeParse({ sampleId: "PO1" }).success, false);
  const list = await arc.execute("list_samples", {});
  assert.ok(list.samples.some(({ id }) => id === "PO1"));
  assert.equal(arc.tools.read_order.schema().safeParse({ sampleId: "PO1" }).success, true);
  assert.equal(arc.tools.read_order.schema().safeParse({ sampleId: "../PO1" }).success, false);
  const other = registry();
  assert.equal(other.tools.read_order.schema().safeParse({ sampleId: "PO1" }).success, false);
  await other.execute("list_samples", {});
  assert.equal((await other.execute("read_order", { sampleId: "PO1" }, { step })).error.code, "SERVICE_UNAVAILABLE");
  assert.equal((await arc.execute("read_order", { sampleId: "PO1" }, { step })).ok, true);
  assert.equal(extracted[0].ownerSessionId, principal.sessionId);
  assert.equal(extracted[0].file.name, sampleFilename);
  assert.equal(claims[0].scope, "po_review");
  assert.equal(claims[0].key, arc.tools.read_order.key(step, { sampleId: "PO1" }));
});

test("photos are selectable only from a successful approved inventory read", async () => {
  const arc = registry({ deps: { servicePorts: {
    getApprovedPhotos: async () => ({ ok: true, photos: [{ id: "photo-01" }] }),
  } } });
  assert.equal(arc.tools.diagnose_approved_photo.schema().safeParse({ photoId: "photo-01" }).success, false);
  assert.ok(!arc.allowedFunctionNames().includes("diagnose_approved_photo"));
  await arc.execute("list_approved_photos", {});
  assert.ok(arc.allowedFunctionNames().includes("diagnose_approved_photo"));
  assert.equal(arc.tools.diagnose_approved_photo.schema().safeParse({ photoId: "photo-01" }).success, true);
  assert.equal(arc.tools.diagnose_approved_photo.schema().safeParse({ photoId: "photo-02" }).success, false);
});

test("only owned jobs from session history reach the stored-job command", async () => {
  const ids = [];
  const cardRequests = [];
  const bytes = Buffer.from("%PDF-");
  const arc = registry({ session: { ...session, jobIds: [jobId, foreignJob] }, deps: {
    lookupStoredJobSheet: async ({ jobId }) => { ids.push(jobId); return { ok: true }; },
    servicePorts: {
      async getJobCard(input) {
        cardRequests.push(input);
        return { ok: true, contentType: "application/pdf", bytes };
      },
      approveJob: () => assert.fail("The registry cannot call approve"),
    },
  } });
  assert.equal((await arc.execute("get_job", { jobId: foreignJob })).error.code, "VALIDATION_ERROR");
  assert.equal((await arc.execute("get_job", { jobId: jobId.replace(/b$/, "c") })).error.code, "VALIDATION_ERROR");
  assert.equal((await arc.execute("get_job", { jobId })).ok, true);
  assert.deepEqual(ids, [jobId]);
  assert.equal((await arc.execute("get_job_card", { jobId: foreignJob })).error.code, "VALIDATION_ERROR");
  assert.deepEqual(await arc.execute("get_job_card", { jobId }), { ok: true, contentType: "application/pdf", bytes });
  assert.deepEqual(cardRequests.map(({ jobId, supervisorPrincipal }) => [jobId, supervisorPrincipal]), [[jobId, principal]]);
});

test("next actions read only owned lot heads from the session", async () => {
  const reads = [];
  const arc = registry({ session: { ...session, activeLotIds: [lotId, lotId.replace(principal.sessionId, "c".repeat(32))] },
    deps: { lotRevisions: { enabled: true, store: { async getLot(input) {
      reads.push([input.lotId, input.ownerSessionId]);
      return { head: { lotId, stage: "conditions" }, revision: null };
    } } } } });
  const result = await arc.execute("list_next_actions", {});
  assert.deepEqual(result.actions, [{ lotId, stage: "conditions" }]);
  assert.deepEqual(reads, [[lotId, principal.sessionId]]);
});

test("planning requires a human-confirmed order and each current condition", async () => {
  const submitted = [];
  const arc = registry({ deps: {
    ...orderDeps,
    hackathonAuth: auth,
    lotRevisions: { enabled: true, store: {
      registerPending: async () => ({ ok: true, revision: { number: 1 } }),
      markFailed: async () => {},
    } },
    async submitJob(input) {
      submitted.push(input);
      return { ok: false, error: { code: "SERVICE_UNAVAILABLE" } };
    },
  } });
  const confirmedOrder = { itemCode: "B1047", quantity: 10, lineIndex: 0,
    reviewId: "6f1c2a44-8b0e-4d51-9c7a-3e5d1b7f0a21", reviewFingerprint: "b".repeat(64) };
  const conditions = { runDate: "2026-11-24", shift: "DAY", ambientRhPct: 42, ambientTempC: 22, paperMoisturePct: 8 };
  const lot = { lotId, ownerSessionId: principal.sessionId, reviewId: confirmedOrder.reviewId, orderRef: confirmedOrder,
    draftConditions: Object.entries(conditions).map(([field, value]) => ({ field, value, confirmed: field !== "shift" })) };
  const filename = sampleFilename;
  const planInputs = {
    file: new File([await readFile(new URL(`../public/samples/${filename}`, import.meta.url))], filename, { type: "application/pdf" }),
    levers: { sfSpeedMpm: 40, rollTempC: 170, gumApplication: "MED", gumViscositySec: 40,
      pastingPressure: "MED", dryingHours: 8, printSpeedSpm: 40 },
  };
  const planStep = { ...step, stepId: "plan_lot" };
  const context = { lot, step: planStep, confirmedOrder, planInputs };
  assert.equal((await arc.execute("plan_lot", {}, { ...context, confirmedOrder: undefined })).error.code, "CONFIRMATION_REQUIRED");
  assert.equal((await arc.execute("plan_lot", {}, context)).error.code, "CONFIRMATION_REQUIRED");
  assert.equal(submitted.length, 0);
  lot.draftConditions.find(({ field }) => field === "shift").confirmed = true;
  assert.equal((await arc.execute("plan_lot", {}, context)).error.code, "SERVICE_UNAVAILABLE");
  assert.equal(submitted.length, 1);
  const key = arc.tools.plan_lot.key(planStep, {});
  const keyHash = createHash("sha256").update(`ustaad-jobs:v3:client:${key}`).digest("hex");
  assert.equal(submitted[0].identity.keyHash, createHmac("sha256", principal.sessionId).update(keyHash).digest("hex"));
  assert.deepEqual(submitted[0].request.manualConditions, conditions);
  assert.equal(submitted[0].request.conditionsConfirmed, true);
  assert.equal(submitted[0].request.purchaseOrderReview.confirmedSourceLine, true);
});

test("draft conditions use the effect key and only the typed source", async () => {
  const saved = [];
  const effects = [];
  const arc = registry({ deps: {
    runWriteEffect: async (claim, run) => { effects.push(claim); return run(); },
    lotRevisions: { enabled: true, store: {
      getLot: async () => { throw new Error("Unexpected read"); },
      saveConditions: async ({ conditions }) => {
        saved.push(conditions);
        return { ok: true, head: { lotId, draftConditions: conditions }, superseded: null };
      },
    } },
  } });
  const args = { conditions: { shift: "DAY" } };
  const conditionStep = { ...step, stepId: "set_conditions" };
  assert.equal((await arc.execute("set_conditions", args, { lot: { lotId, ownerSessionId: principal.sessionId }, step: conditionStep })).ok, true);
  assert.equal(effects[0].scope, "lot_conditions");
  assert.equal(effects[0].key, arc.tools.set_conditions.key(conditionStep, args));
  assert.deepEqual(saved[0].map(({ sourceDetail, confirmed }) => ({ sourceDetail, confirmed })), [{ sourceDetail: "typed", confirmed: false }]);
});

test("effect keys are canonical and absent on reads without model spend", () => {
  const arc = registry();
  const args = { conditions: { shift: "DAY", ambientRhPct: 42 } };
  const hash = createHash("sha256").update('{"conditions":{"ambientRhPct":42,"shift":"DAY"}}').digest("hex");
  const expected = `arc1.6f1c2a448b0e4d519c7a3e5d1b7f0a21.read_order.0.${hash.slice(0, 16)}`;
  for (const name of names) {
    const keyed = ["read_order", "set_conditions", "plan_lot", "retry_explanation", "diagnose_approved_photo",
      "confirm_order", "confirm_conditions"].includes(name);
    if (keyed) {
      assert.notEqual(arc.tools[name].key(step, { conditions: { shift: "DAY", ambientRhPct: 43 } }),
        arc.tools[name].key(step, args), `${name} must key different argument values separately`);
      assert.equal(arc.tools[name].key(step, { conditions: { ambientRhPct: 42, shift: "DAY" } }), expected);
      assert.notEqual(arc.tools[name].key({ ...step, attempt: 1 }, args), expected);
    }
    assert.equal(arc.tools[name].key(step, args), keyed ? expected : null);
  }
});

test("concurrent photo dispatches under one claim reserve and call Gemini once", { timeout: 2000 }, async () => {
  const fake = fakeFirestore();
  const now = () => Date.parse("2026-11-24T06:00:00Z");
  const budget = createFirestoreBudgetStore({
    projectId: "prepagent-hack", fetchImpl: fake.fetchImpl, tokenProvider: async () => "test-token", now,
    limits: { pool: "live", dayLimit: 300, sessionDayLimit: 40, ipDayLimit: 120,
      minuteLimit: 20, sessionMinuteLimit: 6, dayCostCapInr: 600 },
  });
  const providerCalls = [];
  const provider = {
    generateContent: () => assert.fail("Unexpected provider method"),
    generateJson: async (args) => { providerCalls.push(args); return { label: "WARP" }; },
  };
  const gemini = withDailyGeminiCallCap(provider, readDailyGeminiCallCapConfig({}),
    { store: budgetCapStore(budget), now });
  const bytes = await readFile(new URL("./fixtures/synthetic_POs/PO5_ClientB_scanned.jpg", import.meta.url));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const photos = Array.from({ length: 10 }, (_, index) => ({
    id: `photo-${String(index + 1).padStart(2, "0")}`,
    name: `photos/photos/warp/warp_${String(index + 1).padStart(3, "0")}.jpg`,
    generation: "1", size: bytes.length, sha256,
  }));
  const service = createApprovedPhotoService({
    gemini, model: "test-provider-double", inventory: { bucket: "prepagent-hack-data", photos },
    storage: {
      getMetadata: async ({ name }) => ({ name, generation: "1", size: bytes.length, contentType: "image/jpeg" }),
      download: async () => ({ bytes, contentType: "image/jpeg" }),
    },
  });
  const arc = registry({ deps: { servicePorts: {
    getApprovedPhotos: service.list, classifyApprovedPhoto: service.classify,
  } } });
  assert.equal((await arc.execute("list_approved_photos", {})).ok, true);

  const dispatch = () => arc.execute("diagnose_approved_photo", { photoId: "photo-01" }, {
    step: { ...step, stepId: "diagnose_approved_photo" },
  });
  const results = await Promise.all([dispatch(), dispatch()]);
  assert.equal(providerCalls.length, 1);
  assert.deepEqual(results.filter(({ ok }) => ok).map(({ label }) => label), ["WARP"]);
  assert.deepEqual(results.filter(({ ok }) => !ok), [{
    ok: false, error: { code: "GEMINI_CALL_REPLAYED", message: "This Gemini call was already reserved." },
  }]);
  const reservations = [...fake.docs.keys()].filter((name) => name.includes("/budget_reservations/"));
  assert.equal(reservations.length, 1);
});

test("photo execution reserves Gemini spend for the verified session, IP and step", async () => {
  const reservations = [];
  const provider = async () => ({ label: "WARP" });
  const store = budgetCapStore({
    reserve: async (input) => { reservations.push(input); return { ok: true }; },
    peek: async () => ({}),
    recordUsage: async () => ({}),
  });
  const gemini = withDailyGeminiCallCap({ generateContent: provider, generateJson: provider },
    { configured: true, countingPolicy: "attempts", limit: 40, timeZone: "Asia/Kolkata" }, { store });
  const arc = registry({ deps: { servicePorts: {
    getApprovedPhotos: async () => ({ ok: true, photos: [{ id: "photo-01" }] }),
    classifyApprovedPhoto: async () => ({ ok: true, ...await gemini.generateJson({ role: "photo" }) }),
  } } });
  await arc.execute("list_approved_photos", {});
  const args = { photoId: "photo-01" };
  const photoStep = { ...step, stepId: "diagnose_approved_photo" };
  assert.equal((await arc.execute("diagnose_approved_photo", args, { step: photoStep })).label, "WARP");
  assert.equal(reservations.length, 1);
  assert.equal(reservations[0].principal, principal);
  assert.equal(reservations[0].ipKey, ipKey);
  assert.equal(reservations[0].reservationKey, `${arc.tools.diagnose_approved_photo.key(photoStep, args)}.3f1c2a448b0e.0`);
  assert.equal((await arc.execute("retry_explanation", {}, { step })).error.code, "VALIDATION_ERROR");
  assert.equal((await arc.execute("retry_explanation", {}, { step, source: "code" })).error.code, "SERVICE_UNAVAILABLE");
  assert.ok(!arc.allowedFunctionNames().includes("query_metric"));
  assert.equal((await arc.execute("query_metric", { metric: "sql", filters: { query: "arbitrary" } })).error.code, "VALIDATION_ERROR");
});
