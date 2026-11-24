import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";
import modelAcceptanceConfig from "../config/model-acceptance.json" with { type: "json" };
import bindingConfig from "../config/model-version-binding.json" with { type: "json" };
import {
  createModelVersionBinding,
  MODEL_VERSION_MISMATCH,
  MODEL_VERSION_UNVERIFIED,
} from "../src/google-cloud/model-version-binding.js";

const ACCEPTED = modelAcceptanceConfig.currentModelVersions;
const MODELS_URL = "https://bigquery.googleapis.com/bigquery/v2/projects/prepagent-hack/datasets/prepagent/models/";
const TOKEN = "test-token-value";
const acceptedEtags = () => Object.fromEntries(Object.entries(ACCEPTED).map(([defect, etag]) => [`m2_${defect.toLowerCase()}`, etag]));

// A models.get stand-in. `answers` maps a model ID to an etag string, an HTTP status
// number, a function returning a Response, or "throw" for a network failure.
function fakeModelsApi(answers = acceptedEtags()) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method, authorization: init.headers?.Authorization, body: init.body });
    if (!url.startsWith(MODELS_URL)) throw new TypeError(`unexpected request ${init.method} ${url}`);
    const answer = answers[url.slice(MODELS_URL.length)];
    if (answer === "throw" || answer === undefined) throw new TypeError("fetch failed");
    if (typeof answer === "function") return answer(init);
    if (typeof answer === "number") return Response.json({ error: { code: answer } }, { status: answer });
    return Response.json({ kind: "bigquery#model", etag: answer, modelReference: { modelId: "x" } });
  };
  return { calls, fetchImpl };
}

function binding(fake, options = {}) {
  return createModelVersionBinding({
    projectId: "prepagent-hack",
    modelAcceptance: modelAcceptanceConfig,
    fetchImpl: fake.fetchImpl,
    tokenProvider: async () => TOKEN,
    now: () => new Date("2026-11-25T08:00:00.000Z"),
    log: () => {},
    ...options,
  });
}

function servingPort() {
  const calls = [];
  return { calls, port: async (input) => { calls.push(input); return { ok: true, served: true }; } };
}

test("before the first check every target is unchecked and the guarded port is not called", async () => {
  const versions = binding(fakeModelsApi());
  const inner = servingPort();
  const result = await versions.guard(inner.port, "Prediction")({ itemCode: "PKBX0041" });
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: MODEL_VERSION_UNVERIFIED,
      message: "Prediction is blocked until the accepted model versions are confirmed in BigQuery.",
      targets: ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"],
    },
  });
  assert.equal(inner.calls.length, 0);
  const snapshot = versions.snapshot();
  assert.equal(snapshot.state, "unchecked");
  assert.equal(snapshot.lastCheckedAt, null);
  assert.equal(snapshot.checkIntervalMs, bindingConfig.checkIntervalMs);
  assert.deepEqual(snapshot.targets[0], {
    defect: "WARP", resource: "prepagent.m2_warp", expected: ACCEPTED.WARP, observed: null, state: "unchecked", checkedAt: null,
  });
});

test("matching etags are read with models.get only and let prediction through", async () => {
  const fake = fakeModelsApi();
  const versions = binding(fake);
  await versions.check();
  assert.deepEqual(fake.calls.map((call) => [call.method, call.url]).sort(), [
    ["GET", MODELS_URL + "m2_crack"], ["GET", MODELS_URL + "m2_delam"], ["GET", MODELS_URL + "m2_print"],
    ["GET", MODELS_URL + "m2_strength"], ["GET", MODELS_URL + "m2_warp"],
  ]);
  assert.ok(fake.calls.every((call) => call.authorization === `Bearer ${TOKEN}` && call.body === undefined));
  const inner = servingPort();
  assert.deepEqual(await versions.guard(inner.port, "Prediction")({ itemCode: "PKBX0041" }), { ok: true, served: true });
  assert.deepEqual(inner.calls, [{ itemCode: "PKBX0041" }]);
  const snapshot = versions.snapshot();
  assert.equal(snapshot.state, "verified");
  assert.equal(snapshot.lastCheckedAt, "2026-11-25T08:00:00.000Z");
  for (const target of snapshot.targets) {
    assert.deepEqual(target, {
      defect: target.defect, resource: `prepagent.m2_${target.defect.toLowerCase()}`,
      expected: ACCEPTED[target.defect], observed: ACCEPTED[target.defect], state: "match", checkedAt: "2026-11-25T08:00:00.000Z",
    });
  }
  assert.equal(JSON.stringify(snapshot).includes(TOKEN), false);
});

test("a mismatched etag blocks prediction and optimization with MODEL_VERSION_MISMATCH", async () => {
  const versions = binding(fakeModelsApi({ ...acceptedEtags(), m2_crack: "Zm9yZWlnbi1ldGFnLTAwMQ==" }));
  await versions.check();
  const inner = servingPort();
  for (const [operation, message] of [
    ["Prediction", "Prediction is blocked: the CRACK model in BigQuery is not the accepted version."],
    ["Optimization", "Optimization is blocked: the CRACK model in BigQuery is not the accepted version."],
  ]) {
    assert.deepEqual(await versions.guard(inner.port, operation)({}), {
      ok: false, error: { code: MODEL_VERSION_MISMATCH, message, targets: ["CRACK"] },
    });
  }
  assert.equal(inner.calls.length, 0);
  const snapshot = versions.snapshot();
  assert.equal(snapshot.state, "mismatch");
  const crack = snapshot.targets.find((target) => target.defect === "CRACK");
  assert.deepEqual(crack, {
    defect: "CRACK", resource: "prepagent.m2_crack", expected: ACCEPTED.CRACK,
    observed: "Zm9yZWlnbi1ldGFnLTAwMQ==", state: "mismatch", checkedAt: "2026-11-25T08:00:00.000Z",
  });
  assert.ok(snapshot.targets.filter((target) => target.defect !== "CRACK").every((target) => target.state === "match"));
});

test("a mismatch is reported even when another target could not be read", async () => {
  const versions = binding(fakeModelsApi({ ...acceptedEtags(), m2_warp: "d3JvbmctZXRhZw==", m2_print: 500 }));
  await versions.check();
  const result = versions.gate("Prediction");
  assert.equal(result.error.code, MODEL_VERSION_MISMATCH);
  assert.deepEqual(result.error.targets, ["WARP"]);
});

test("each kind of read failure leaves its target unverified and blocks prediction", async () => {
  const cases = [
    [500, "MODEL_READ_FAILED"],
    [403, "MODEL_READ_FAILED"],
    [404, "MODEL_NOT_FOUND"],
    ["throw", "BIGQUERY_UNAVAILABLE"],
    [() => new Response("not json", { status: 200 }), "INVALID_RESPONSE"],
    [() => Response.json({ etag: "<script>" }), "INVALID_RESPONSE"],
    [() => Response.json({ kind: "bigquery#model" }), "INVALID_RESPONSE"],
  ];
  for (const [answer, reason] of cases) {
    const versions = binding(fakeModelsApi({ ...acceptedEtags(), m2_delam: answer }));
    await versions.check();
    const inner = servingPort();
    const result = await versions.guard(inner.port, "Prediction")({});
    assert.equal(result.error.code, MODEL_VERSION_UNVERIFIED, reason);
    assert.deepEqual(result.error.targets, ["DELAM"], reason);
    assert.equal(inner.calls.length, 0, reason);
    const snapshot = versions.snapshot();
    assert.equal(snapshot.state, "unverified", reason);
    assert.deepEqual(snapshot.targets.find((target) => target.defect === "DELAM"), {
      defect: "DELAM", resource: "prepagent.m2_delam", expected: ACCEPTED.DELAM, observed: null,
      state: "unverified", checkedAt: "2026-11-25T08:00:00.000Z", reason,
    }, reason);
  }
});

test("a token failure leaves every target unverified without calling the models API", async () => {
  for (const tokenProvider of [async () => { throw new Error("metadata down"); }, async () => ""]) {
    const fake = fakeModelsApi();
    const versions = binding(fake, { tokenProvider });
    await versions.check();
    assert.equal(fake.calls.length, 0);
    assert.equal(versions.gate("Optimization").error.code, MODEL_VERSION_UNVERIFIED);
    assert.ok(versions.snapshot().targets.every((target) => target.state === "unverified" && target.reason === "IDENTITY_UNAVAILABLE"));
  }
});

test("a later successful check recovers from a mismatch and from a read failure", async () => {
  const answers = { ...acceptedEtags(), m2_strength: "b2xkLWV0YWc=" };
  const versions = binding(fakeModelsApi(answers));
  const inner = servingPort();
  const predict = versions.guard(inner.port, "Prediction");
  await versions.check();
  assert.equal((await predict({})).error.code, MODEL_VERSION_MISMATCH);

  answers.m2_strength = 503;
  await versions.check();
  assert.equal((await predict({})).error.code, MODEL_VERSION_UNVERIFIED);

  answers.m2_strength = ACCEPTED.STRENGTH;
  await versions.check();
  assert.deepEqual(await predict({ n: 1 }), { ok: true, served: true });
  assert.equal(versions.snapshot().state, "verified");

  answers.m2_strength = "throw";
  await versions.check();
  assert.equal((await predict({})).error.code, MODEL_VERSION_UNVERIFIED);
  assert.equal(inner.calls.length, 1);
});

test("a hung call is cut off by the per-call timeout", { timeout: 2000 }, async () => {
  // Never settles and ignores the abort signal, so only the race can end the check.
  const hung = () => new Promise(() => {});
  const versions = binding(fakeModelsApi({ ...acceptedEtags(), m2_print: hung }), { requestTimeoutMs: 25, checkIntervalMs: 1000 });
  const started = Date.now();
  await versions.check();
  assert.ok(Date.now() - started < 1000);
  const print = versions.snapshot().targets.find((target) => target.defect === "PRINT");
  assert.equal(print.state, "unverified");
  assert.equal(print.reason, "TIMEOUT");

  const slowToken = binding(fakeModelsApi(), { requestTimeoutMs: 25, checkIntervalMs: 1000, tokenProvider: () => new Promise(() => {}) });
  await slowToken.check();
  assert.ok(slowToken.snapshot().targets.every((target) => target.reason === "TIMEOUT"));
});

test("only one check runs at a time", { timeout: 2000 }, async () => {
  const pending = [];
  let hold = true;
  const answers = Object.fromEntries(Object.entries(acceptedEtags()).map(([model, etag]) => [model,
    () => hold ? new Promise((resolve) => pending.push(() => resolve(Response.json({ etag })))) : Response.json({ etag })]));
  const fake = fakeModelsApi(answers);
  const versions = binding(fake);
  const first = versions.check();
  const second = versions.check();
  assert.equal(first, second);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fake.calls.length, 5);
  hold = false;
  pending.forEach((release) => release());
  await first;
  assert.equal(versions.snapshot().state, "verified");
  await versions.check();
  assert.equal(fake.calls.length, 10);
  assert.equal(versions.snapshot().state, "verified");
});

// Lets a check started by a mock-timer tick finish its token read and models.get calls.
async function flushChecks() {
  for (let i = 0; i < 10; i += 1) await new Promise(setImmediate);
}

test("start checks at once and again on every interval, and stop ends the interval", { timeout: 2000 }, async (t) => {
  assert.equal(bindingConfig.checkIntervalMs, 10 * 60 * 1000);
  t.mock.timers.enable({ apis: ["setInterval"] });
  const fake = fakeModelsApi();
  const versions = binding(fake);
  await versions.start();
  assert.equal(fake.calls.length, 5);
  t.mock.timers.tick(bindingConfig.checkIntervalMs - 1);
  await flushChecks();
  assert.equal(fake.calls.length, 5, "no check before the interval has passed");
  t.mock.timers.tick(1);
  await flushChecks();
  assert.equal(fake.calls.length, 10, "one check when the interval passes");
  t.mock.timers.tick(bindingConfig.checkIntervalMs);
  await flushChecks();
  assert.equal(fake.calls.length, 15, "one check per interval");
  versions.stop();
  t.mock.timers.tick(bindingConfig.checkIntervalMs * 3);
  await flushChecks();
  assert.equal(fake.calls.length, 15, "no check after stop");
});

test("the interval timer does not keep the process alive", { timeout: 10000 }, async () => {
  const moduleUrl = new URL("../src/google-cloud/model-version-binding.js", import.meta.url).href;
  const acceptanceUrl = new URL("../config/model-acceptance.json", import.meta.url).href;
  const script = `
    const { createModelVersionBinding } = await import(${JSON.stringify(moduleUrl)});
    const { default: acceptance } = await import(${JSON.stringify(acceptanceUrl)}, { with: { type: "json" } });
    const etags = Object.fromEntries(Object.entries(acceptance.currentModelVersions).map(([d, e]) => ["m2_" + d.toLowerCase(), e]));
    const versions = createModelVersionBinding({ projectId: "prepagent-hack", modelAcceptance: acceptance,
      tokenProvider: async () => "t", log: () => {},
      fetchImpl: async (url) => Response.json({ etag: etags[String(url).split("/").pop()] }) });
    await versions.start();
    console.log(versions.snapshot().state);
  `;
  const { stdout } = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script], { timeout: 8000 });
  assert.equal(stdout.trim(), "verified");
});

test("the binding refuses an acceptance record it cannot bind", () => {
  const record = structuredClone(modelAcceptanceConfig);
  const options = (modelAcceptance) => ({ projectId: "prepagent-hack", modelAcceptance, fetchImpl: async () => {}, tokenProvider: async () => TOKEN });
  assert.throws(() => createModelVersionBinding(options({ ...record, models: [] })), TypeError);
  const oldResource = structuredClone(record);
  oldResource.models[0].resource = "prepagent.m_warp";
  assert.throws(() => createModelVersionBinding(options(oldResource)), TypeError);
  const noExpected = structuredClone(record);
  delete noExpected.currentModelVersions.PRINT;
  assert.throws(() => createModelVersionBinding(options(noExpected)), TypeError);
  assert.throws(() => createModelVersionBinding({ ...options(record), requestTimeoutMs: 0 }), TypeError);
  assert.throws(() => createModelVersionBinding({ ...options(record), projectId: "bad project" }), TypeError);
});

function clock(start = Date.parse("2026-11-25T08:00:00.000Z")) {
  let current = start;
  return { now: () => new Date(current), advance: (ms) => { current += ms; } };
}

test("a verified result older than the maximum age is unverified until a request checks again", { timeout: 2000 }, async () => {
  assert.equal(bindingConfig.maxVerifiedAgeMs, 30 * 60 * 1000);
  const time = clock();
  const answers = acceptedEtags();
  const fake = fakeModelsApi(answers);
  const versions = binding(fake, { now: time.now });
  const inner = servingPort();
  const predict = versions.guard(inner.port, "Prediction");
  await versions.check();
  assert.equal(fake.calls.length, 5);

  time.advance(bindingConfig.maxVerifiedAgeMs);
  assert.equal(versions.gate("Prediction"), undefined, "exactly the maximum age is still fresh");
  assert.deepEqual(await predict({ n: 1 }), { ok: true, served: true });
  assert.equal(fake.calls.length, 5, "a fresh result needs no new read");

  time.advance(1);
  assert.deepEqual(versions.gate("Prediction"), {
    ok: false,
    error: {
      code: MODEL_VERSION_UNVERIFIED,
      message: "Prediction is blocked until the accepted model versions are confirmed in BigQuery.",
      targets: ["WARP", "DELAM", "STRENGTH", "PRINT", "CRACK"],
    },
  });
  const stale = versions.snapshot();
  assert.equal(stale.state, "unverified");
  assert.equal(stale.stale, true);
  assert.equal(stale.maxVerifiedAgeMs, bindingConfig.maxVerifiedAgeMs);
  assert.equal(stale.lastCheckedAt, "2026-11-25T08:00:00.000Z");

  assert.deepEqual(await predict({ n: 2 }), { ok: true, served: true }, "the request re-checks and then serves");
  assert.equal(fake.calls.length, 10);
  assert.equal(versions.snapshot().state, "verified");
  assert.equal(versions.snapshot().stale, undefined);
  assert.equal(versions.snapshot().lastCheckedAt, new Date(Date.parse("2026-11-25T08:00:00.000Z") + bindingConfig.maxVerifiedAgeMs + 1).toISOString());

  time.advance(bindingConfig.maxVerifiedAgeMs + 1);
  answers.m2_print = "cHJpbnQtcmV0cmFpbmVk";
  const result = await predict({ n: 3 });
  assert.equal(result.error.code, MODEL_VERSION_MISMATCH);
  assert.deepEqual(result.error.targets, ["PRINT"]);
  assert.deepEqual(inner.calls, [{ n: 1 }, { n: 2 }]);
});

test("stale requests share one check, and a failed or hung re-check stays unverified", { timeout: 2000 }, async () => {
  const time = clock();
  const answers = acceptedEtags();
  const fake = fakeModelsApi(answers);
  const versions = binding(fake, { now: time.now, requestTimeoutMs: 25, checkIntervalMs: 1000, maxVerifiedAgeMs: 5000 });
  const inner = servingPort();
  const predict = versions.guard(inner.port, "Prediction");
  await versions.check();

  time.advance(5001);
  const [first, second] = await Promise.all([predict({}), predict({})]);
  assert.deepEqual([first, second], [{ ok: true, served: true }, { ok: true, served: true }]);
  assert.equal(fake.calls.length, 10, "two stale requests started one check");

  time.advance(5001);
  answers.m2_warp = 500;
  assert.equal((await predict({})).error.code, MODEL_VERSION_UNVERIFIED);

  time.advance(5001);
  answers.m2_warp = () => new Promise(() => {});
  const started = Date.now();
  const hung = await predict({});
  assert.ok(Date.now() - started < 1000, "the request-path check is bounded by the per-call timeout");
  assert.equal(hung.error.code, MODEL_VERSION_UNVERIFIED);
  assert.deepEqual(hung.error.targets, ["WARP"]);
  assert.equal(inner.calls.length, 2);
});

test("the maximum age must be longer than the check interval", () => {
  for (const maxVerifiedAgeMs of [bindingConfig.checkIntervalMs, 0, 1.5, undefined]) {
    assert.throws(() => binding(fakeModelsApi(), { maxVerifiedAgeMs: maxVerifiedAgeMs ?? null }), TypeError, String(maxVerifiedAgeMs));
  }
});
