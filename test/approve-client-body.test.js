import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { approveRequestOptions } from "../src/ui/api.js";

const FINGERPRINT = "c".repeat(64);
const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

// Statements are cut at the call that sends the approve request, so a match elsewhere in the file cannot pass.
function approveCall(text, marker, length = 700) {
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `${marker} not found`);
  return text.slice(start, start + length);
}

test("src/ui/api.js builds an approve request whose body carries the confirmation and the fingerprint", () => {
  const options = approveRequestOptions(FINGERPRINT);
  assert.equal(options.method, "POST");
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(options.body), { reviewConfirmed: true, revisionFingerprint: FINGERPRINT });
});

test("without a fingerprint the body still carries the confirmation and omits the fingerprint", () => {
  for (const missing of [undefined, null, ""]) {
    assert.deepEqual(JSON.parse(approveRequestOptions(missing).body), { reviewConfirmed: true });
  }
});

test("the dashboard (src/ui/workflow.js) sends the approve body from the loaded revision", async () => {
  const workflow = await source("../src/ui/workflow.js");
  const call = approveCall(workflow, 'url: "/jobs/" + encodeURIComponent(jobId) + "/approve?lang="');
  assert.match(call, /options: approveRequestOptions\(currentRevisionFingerprint\)/);
  assert.doesNotMatch(call, /options: \{ method: "POST"/);
  assert.match(workflow, /import \{[^}]*\bapproveRequestOptions\b[^}]*\} from "\.\/api\.js"/);
  const apply = approveCall(workflow, "function applyStoredJobContext(jobSheet, revision)", 900);
  assert.match(apply, /currentRevisionFingerprint = revision\?\.fingerprint \?\? null/);
  for (const marker of ["applyStoredJobContext(payload.jobSheet, payload.revision)", "applyStoredJobContext(payload?.jobSheet, payload?.revision)"]) {
    assert.ok(workflow.includes(marker), marker);
  }
});

test("the React client (web/src/screens/Lots.tsx) sends the approve body from the loaded revision", async () => {
  const lots = await source("../web/src/screens/Lots.tsx");
  const call = approveCall(lots, "const r = await send<{ jobSheet: JobSheet }>(`/jobs/${encodeURIComponent(sheet.jobId)}/approve", 500);
  assert.match(call, /method: "POST"/);
  assert.match(call, /"Content-Type": "application\/json"/);
  assert.match(call, /JSON\.stringify\(\{ reviewConfirmed: true, revisionFingerprint: result\.revision\?\.fingerprint \}\)/);
  assert.match(lots, /setResult\(\{ jobSheet: r\.data\.jobSheet, revision: r\.data\.revision \}\)/);
  const session = await source("../web/src/lib/session.ts");
  assert.match(session, /export type JobResult = \{[^\n]*revision\?: \{[^}]*fingerprint: string \| null/);
});
