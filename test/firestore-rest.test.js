import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  conditionalWriteUrl,
  createFirestoreRestClient,
  currentDocumentPrecondition,
  decodeTimestamp,
  encodeDocument,
  encodeTimestamp,
  FirestoreRestError,
  fromFirestoreFields,
  isPreconditionFailure,
  parseDocument,
  toFirestoreFields,
  toFirestoreValue,
} from "../src/google-cloud/firestore-rest.js";

const PROJECT_ID = "prepagent-hack";
const TOKEN = "test-token";
const ROOT = "https://firestore.googleapis.com/v1/projects/prepagent-hack/databases/(default)/documents";

function fakeFetch(responses) {
  const calls = [];
  let index = 0;
  async function fetchImpl(url, options) {
    calls.push({ url, method: options.method, headers: options.headers, body: options.body && JSON.parse(options.body) });
    const next = responses[index++];
    if (!next) throw new Error(`unexpected call to ${url}`);
    if (next.throws) throw next.throws;
    return {
      status: next.status,
      ok: next.status >= 200 && next.status < 300,
      json: async () => {
        if (next.invalidJson) throw new SyntaxError("Unexpected token < in JSON");
        return next.body;
      },
    };
  }
  return { fetchImpl, calls };
}

function client(responses) {
  const fake = fakeFetch(responses);
  return { firestore: createFirestoreRestClient({ projectId: PROJECT_ID, fetchImpl: fake.fetchImpl }), calls: fake.calls };
}

test("timestamp codec stores UTC Timestamps and reads them back as ISO strings", () => {
  assert.deepEqual(encodeTimestamp("2026-12-04T15:30:00+05:30"), { timestampValue: "2026-12-04T10:00:00.000Z" });
  assert.deepEqual(encodeTimestamp(new Date(Date.UTC(2026, 11, 4))), { timestampValue: "2026-12-04T00:00:00.000Z" });
  assert.equal(decodeTimestamp({ timestampValue: "2026-12-04T10:00:00.123456Z" }), "2026-12-04T10:00:00.123456Z");
  assert.deepEqual(toFirestoreValue(new Date("2026-12-04T10:00:00Z")), { timestampValue: "2026-12-04T10:00:00.000Z" });

  for (const bad of ["2026-12-04", "2026-12-04T10:00:00", "not a date", new Date(Number.NaN), 1_700_000_000_000]) {
    assert.throws(() => encodeTimestamp(bad), { name: "FirestoreRestError", code: "UNSUPPORTED_VALUE_TYPE" });
  }
  assert.throws(() => decodeTimestamp({ timestampValue: "yesterday" }), { code: "SERVICE_UNAVAILABLE" });
  assert.throws(() => decodeTimestamp({ stringValue: "2026-12-04T10:00:00Z" }), { code: "SERVICE_UNAVAILABLE" });
});

test("field codec round-trips scalars, arrays, maps and named timestamp fields", () => {
  const value = {
    schemaVersion: 1,
    ratio: 0.25,
    label: "2026-12-04T10:00:00.000Z",
    confirmed: false,
    supersededBy: null,
    approvedAt: null,
    expiresAt: "2026-12-04T10:00:00.000Z",
    jobIds: ["JOB-1", "JOB-2"],
    empty: [],
    resultRef: { kind: "job", id: "JOB-1" },
    skipped: undefined,
  };
  const fields = toFirestoreFields(value, { timestamps: ["expiresAt", "approvedAt"] });
  assert.deepEqual(fields.expiresAt, { timestampValue: "2026-12-04T10:00:00.000Z" });
  assert.deepEqual(fields.label, { stringValue: "2026-12-04T10:00:00.000Z" });
  assert.deepEqual(fields.approvedAt, { nullValue: null });
  assert.deepEqual(fields.schemaVersion, { integerValue: "1" });
  assert.deepEqual(fields.empty, { arrayValue: {} });
  assert.equal("skipped" in fields, false);

  const { skipped, ...expected } = value;
  assert.equal(skipped, undefined);
  assert.deepEqual(fromFirestoreFields(fields), expected);
  assert.throws(() => toFirestoreValue(Symbol("x")), { code: "UNSUPPORTED_VALUE_TYPE" });
  assert.throws(() => toFirestoreValue(Number.POSITIVE_INFINITY), { code: "UNSUPPORTED_VALUE_TYPE" });
  assert.throws(() => toFirestoreValue(new Map()), { code: "UNSUPPORTED_VALUE_TYPE" });
});

test("a stored document that fails its schema is SERVICE_UNAVAILABLE, not absent", () => {
  const schema = z.object({ id: z.string(), expiresAt: z.iso.datetime({ offset: true }) }).strict();
  const good = { fields: { id: { stringValue: "a" }, expiresAt: { timestampValue: "2026-12-04T10:00:00Z" } } };
  assert.deepEqual(parseDocument(schema, good), { id: "a", expiresAt: "2026-12-04T10:00:00Z" });

  const wrongType = { fields: { id: { integerValue: "7" }, expiresAt: { timestampValue: "2026-12-04T10:00:00Z" } } };
  const extraField = { fields: { ...good.fields, owner: { stringValue: "someone" } } };
  const badTimestamp = { fields: { id: { stringValue: "a" }, expiresAt: { timestampValue: "soon" } } };
  for (const document of [wrongType, extraField, badTimestamp, {}, null]) {
    assert.throws(() => parseDocument(schema, document), (error) =>
      error instanceof FirestoreRestError && error.code === "SERVICE_UNAVAILABLE");
  }

  assert.throws(() => encodeDocument(schema, { id: 7, expiresAt: "2026-12-04T10:00:00Z" }), { code: "SERVICE_UNAVAILABLE" });
  assert.deepEqual(
    encodeDocument(schema, { id: "a", expiresAt: "2026-12-04T10:00:00Z" }, { timestamps: ["expiresAt"] }).expiresAt,
    { timestampValue: "2026-12-04T10:00:00.000Z" },
  );
});

test("preconditions pin the read version or require absence", () => {
  assert.deepEqual(currentDocumentPrecondition(null), { exists: false });
  assert.deepEqual(currentDocumentPrecondition("2026-10-15T00:00:01.000000Z"), { updateTime: "2026-10-15T00:00:01.000000Z" });
  assert.throws(() => currentDocumentPrecondition(undefined), { code: "FIRESTORE_INVALID_RESPONSE" });
  assert.throws(() => currentDocumentPrecondition(""), { code: "FIRESTORE_INVALID_RESPONSE" });

  const url = new URL(conditionalWriteUrl(`${ROOT}/idempotency/abc`, "2026-10-15T00:00:01Z", ["recordStatus", "completedAt"]));
  assert.equal(url.searchParams.get("currentDocument.updateTime"), "2026-10-15T00:00:01Z");
  assert.deepEqual(url.searchParams.getAll("updateMask.fieldPaths"), ["recordStatus", "completedAt"]);
  assert.throws(() => conditionalWriteUrl(`${ROOT}/idempotency/abc`, undefined), { code: "FIRESTORE_INVALID_RESPONSE" });
});

test("commit sends the transaction and refuses writes without a precondition", async () => {
  const { firestore, calls } = client([
    { status: 200, body: { transaction: "tx-1" } },
    { status: 200, body: { writeResults: [{ updateTime: "t1" }], commitTime: "t1" } },
  ]);
  const transaction = await firestore.beginTransaction({ token: TOKEN });
  assert.equal(transaction, "tx-1");
  const write = { update: { name: `${firestore.databaseName}/documents/lot_heads/L1`, fields: {} }, currentDocument: { exists: false } };
  const committed = await firestore.commit({ transaction, writes: [write], token: TOKEN });
  assert.equal(committed.ok, true);
  assert.equal(committed.aborted, false);
  assert.equal(committed.preconditionFailed, false);

  assert.equal(calls[0].url, `${ROOT}:beginTransaction`);
  assert.deepEqual(calls[0].body, { options: { readWrite: {} } });
  assert.equal(calls[0].headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[1].url, `${ROOT}:commit`);
  assert.deepEqual(calls[1].body, { transaction: "tx-1", writes: [write] });

  await assert.rejects(firestore.commit({ transaction, writes: [{ update: write.update }], token: TOKEN }), TypeError);
  await assert.rejects(firestore.commit({ transaction, writes: [], token: TOKEN }), TypeError);
  await assert.rejects(firestore.commit({ writes: [write], token: TOKEN }), TypeError);
  assert.equal(calls.length, 2);
});

test("commit reports ABORTED and FAILED_PRECONDITION separately", async () => {
  const { firestore } = client([
    { status: 409, body: { error: { status: "ABORTED" } } },
    { status: 400, body: { error: { status: "FAILED_PRECONDITION" } } },
    { status: 503, body: { error: { status: "UNAVAILABLE" } } },
  ]);
  const writes = [{ delete: "x", currentDocument: { updateTime: "t0" } }];
  const aborted = await firestore.commit({ transaction: "tx", writes, token: TOKEN });
  assert.deepEqual([aborted.ok, aborted.aborted, aborted.preconditionFailed], [false, true, false]);
  const stale = await firestore.commit({ transaction: "tx", writes, token: TOKEN });
  assert.deepEqual([stale.ok, stale.aborted, stale.preconditionFailed], [false, false, true]);
  const unavailable = await firestore.commit({ transaction: "tx", writes, token: TOKEN });
  assert.deepEqual([unavailable.ok, unavailable.aborted, unavailable.preconditionFailed], [false, false, false]);
});

test("rollback posts the transaction and reports whether Firestore accepted it", async () => {
  const { firestore, calls } = client([
    { status: 200, body: {} },
    { status: 400, body: { error: { status: "INVALID_ARGUMENT" } } },
  ]);
  assert.equal(await firestore.rollback({ transaction: "tx-9", token: TOKEN }), true);
  assert.equal(await firestore.rollback({ transaction: "tx-9", token: TOKEN }), false);
  assert.equal(calls[0].url, `${ROOT}:rollback`);
  assert.deepEqual(calls[0].body, { transaction: "tx-9" });
});

test("unparseable responses, network failures and failed begins are SERVICE_UNAVAILABLE", async () => {
  const { firestore } = client([
    { status: 200, invalidJson: true },
    { throws: new TypeError("fetch failed") },
    { status: 200, body: {} },
    { status: 500, body: { transaction: "tx" } },
    { status: 200, invalidJson: true },
  ]);
  await assert.rejects(firestore.request(`${ROOT}/lot_heads/L1`, { token: TOKEN }), { code: "SERVICE_UNAVAILABLE" });
  await assert.rejects(firestore.request(`${ROOT}/lot_heads/L1`, { token: TOKEN }), { code: "SERVICE_UNAVAILABLE" });
  await assert.rejects(firestore.beginTransaction({ token: TOKEN }), { code: "SERVICE_UNAVAILABLE" });
  await assert.rejects(firestore.beginTransaction({ token: TOKEN }), { code: "SERVICE_UNAVAILABLE" });
  await assert.rejects(
    firestore.commit({ transaction: "tx", writes: [{ delete: "x", currentDocument: { exists: true } }], token: TOKEN }),
    { code: "SERVICE_UNAVAILABLE" },
  );
});

test("requests without a token never reach Firestore and aborts propagate", async () => {
  const abort = new DOMException("aborted", "AbortError");
  const { firestore, calls } = client([{ throws: abort }]);
  await assert.rejects(firestore.request(`${ROOT}/x/y`, { token: "" }), { code: "CLOUD_IDENTITY_UNAVAILABLE" });
  assert.equal(calls.length, 0);
  await assert.rejects(firestore.request(`${ROOT}/x/y`, { token: TOKEN }), { name: "AbortError" });
});

test("precondition failure detection covers 409, 400 FAILED_PRECONDITION and bad JSON", async () => {
  assert.equal(await isPreconditionFailure({ status: 409 }), true);
  assert.equal(await isPreconditionFailure({ status: 400, json: async () => ({ error: { status: "FAILED_PRECONDITION" } }) }), true);
  assert.equal(await isPreconditionFailure({ status: 400, json: async () => ({ error: { status: "INVALID_ARGUMENT" } }) }), false);
  assert.equal(await isPreconditionFailure({ status: 200 }), false);
  await assert.rejects(isPreconditionFailure({ status: 400, json: async () => { throw new SyntaxError("bad"); } }), { code: "SERVICE_UNAVAILABLE" });
});

test("client construction validates its configuration", () => {
  assert.throws(() => createFirestoreRestClient({ projectId: "Bad Project" }), TypeError);
  assert.throws(() => createFirestoreRestClient({ projectId: PROJECT_ID, database: "" }), TypeError);
  assert.throws(() => createFirestoreRestClient({ projectId: PROJECT_ID, fetchImpl: "fetch" }), TypeError);
  const firestore = createFirestoreRestClient({ projectId: PROJECT_ID, fetchImpl: async () => {} });
  assert.equal(firestore.databaseName, "projects/prepagent-hack/databases/(default)");
  assert.equal(firestore.documentsUrl, ROOT);
});
