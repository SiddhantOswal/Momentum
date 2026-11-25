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

test("the New Lot approval card sends the approve body from the revision read back from the server", async () => {
  const page = await source("../web/src/pages/NewLotApprove.tsx");
  const call = approveCall(page, "const result = await call<Stored>(`/jobs/${encodeURIComponent(jobId)}/approve", 300);
  assert.match(call, /method: "POST"/);
  assert.match(call, /"Content-Type": "application\/json"/);
  assert.match(call, /JSON\.stringify\(\{ reviewConfirmed: true, revisionFingerprint: revision!\.fingerprint \}\)/);
  // The fingerprint comes from GET /jobs/:id, never from the plan response.
  assert.match(page, /const revision = stored\?\.revision;/);
  assert.doesNotMatch(page, /plan\.revision\?\.fingerprint|plan\.revision\.fingerprint/);
});

test("the Arc approval card sends the same approve body", async () => {
  const arc = await source("../web/src/lib/arc.ts");
  const call = approveCall(arc, "export function approveJobCard(jobId: string, revisionFingerprint: string)", 300);
  assert.match(call, /`\/jobs\/\$\{encodeURIComponent\(jobId\)\}\/approve`/);
  assert.match(call, /reviewConfirmed: true, revisionFingerprint,/);
});
