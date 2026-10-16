import { execFileSync } from "node:child_process";
import { open, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createFirestoreGeminiAttemptStore, GEMINI_COUNTER_POLICY_VERSION } from "../src/google-cloud/firestore-gemini-attempt-store.js";

const PROJECT = "prepagent-hack";
const TIME_ZONE = "Asia/Kolkata";
const LIMIT = 100;

function dayAt(now) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(now())).map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function snapshot(document, dayKey) {
  if (document === null) return { exists: false, count: 0 };
  const fields = document?.fields;
  const count = Number(fields?.attemptCount?.integerValue);
  if (document?.name !== `projects/${PROJECT}/databases/(default)/documents/gemini_daily_usage/${dayKey}` ||
      !/^\d+$/.test(fields?.attemptCount?.integerValue ?? "") || !Number.isSafeInteger(count) ||
      fields?.dayKey?.stringValue !== dayKey || fields?.timezone?.stringValue !== TIME_ZONE ||
      fields?.configuredCap?.integerValue !== String(LIMIT) ||
      fields?.policyVersion?.stringValue !== GEMINI_COUNTER_POLICY_VERSION ||
      !Number.isFinite(Date.parse(fields?.updatedAt?.timestampValue))) {
    throw new Error("Counter identity, policy, count or server timestamp is invalid.");
  }
  return { exists: true, count, updatedAt: fields.updatedAt.timestampValue, updateTime: document.updateTime };
}

/** Administrator acceptance only: exactly three reservations, never Gemini. */
export async function acceptGeminiCounter({ readCounter, createStore, now = () => Date.now(), record = async () => {} } = {}) {
  if (typeof readCounter !== "function" || typeof createStore !== "function") throw new TypeError("Independent counter read and store factory are required.");
  const dayKey = dayAt(now);
  const evidence = { projectId: PROJECT, database: "(default)", dayKey, timezone: TIME_ZONE,
    configuredCap: LIMIT, policyVersion: GEMINI_COUNTER_POLICY_VERSION, status: "BLOCKED",
    providerCalls: 0, issuedReservations: 0, identityScope: "administrator; not Cloud Run runtime acceptance", reservations: [] };
  try {
    evidence.before = snapshot(await readCounter(dayKey), dayKey);
    if (evidence.before.count > LIMIT - 3) throw new Error("Fewer than three reservations remain; no counter reset or cap change is permitted.");
    await record(evidence);
    const clients = [createStore(), createStore()];
    const reserve = async (client, index) => {
      if (dayAt(now) !== dayKey) throw new Error("IST day changed; stop without resetting or switching counters.");
      evidence.issuedReservations += 1;
      await record(evidence);
      const result = await client.reserveAttempt({ dayKey, timeZone: TIME_ZONE, limit: LIMIT });
      evidence.reservations.push({ index, attemptCount: result.attemptCount });
      await record(evidence);
      return result;
    };
    await reserve(clients[0], 1);
    const concurrent = await Promise.allSettled([reserve(clients[0], 2), reserve(clients[1], 3)]);
    evidence.after = snapshot(await readCounter(dayKey), dayKey);
    if (concurrent.some(result => result.status !== "fulfilled")) throw new Error("A concurrent reservation failed or was ambiguous; no retry or refund is permitted.");
    if (dayAt(now) !== dayKey || evidence.after.count !== evidence.before.count + 3 ||
        evidence.reservations.map(r => r.attemptCount).sort((a,b) => a-b)
          .some((count,index) => count !== evidence.before.count + index + 1)) {
      throw new Error("Independent read-back differs from exactly three reservations, or IST day changed.");
    }
    evidence.status = "PASS";
  } catch (error) {
    evidence.error = error?.code ?? error.message;
    if (evidence.issuedReservations > 0) {
      try { evidence.after = snapshot(await readCounter(dayKey), dayKey); } catch { evidence.readBackUnavailable = true; }
    }
  }
  await record(evidence);
  return evidence;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = Object.fromEntries(process.argv.slice(2).filter(v => v.includes("=")).map(v => {
    const i = v.indexOf("="); return [v.slice(0,i),v.slice(i+1)];
  }));
  if (!process.argv.includes("--apply") || args["--project"] !== PROJECT ||
      args["--database"] !== "(default)" || !args["--approval-ledger"] || !args["--evidence"]) {
    throw new Error("Requires explicit --apply --project=prepagent-hack --database=(default) --approval-ledger=<file> --evidence=<new-file>. No implicit writes.");
  }
  const ledger = JSON.parse(await readFile(args["--approval-ledger"], "utf8"));
  if (ledger.projectId !== PROJECT || ledger.scopes?.B?.approved !== true) throw new Error("Scope B approval is missing.");
  // Create-only journal prevents accidentally rerunning the three reservations.
  const journal = await open(args["--evidence"], "wx", 0o600);
  const token = execFileSync((process.env.GCLOUD_BIN || "gcloud"), ["auth", "print-access-token"], { encoding: "utf8", timeout: 20000 }).trim();
  const tokenProvider = async () => token;
  let writes = Promise.resolve();
  const record = evidence => {
    const text = JSON.stringify({ ...evidence, observedAt: new Date().toISOString() }, null, 2) + "\n";
    writes = writes.then(async () => { await journal.truncate(0); await journal.write(text, 0, "utf8"); await journal.sync(); });
    return writes;
  };
  try {
    await record({ status: "STARTED", projectId: PROJECT, intendedReservations: 3, providerCalls: 0 });
    const result = await acceptGeminiCounter({
      createStore: () => createFirestoreGeminiAttemptStore({ projectId: PROJECT, tokenProvider }), record,
      readCounter: async dayKey => {
        const response = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/gemini_daily_usage/${dayKey}`, {
          headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-store" }, signal: AbortSignal.timeout(10000),
        });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("Independent Firestore read failed; no permission expansion.");
        return response.json();
      },
    });
    console.info(JSON.stringify({ status: result.status, dayKey: result.dayKey, beforeCount: result.before?.count,
      afterCount: result.after?.count, confirmedReservations: result.reservations.length, providerCalls: 0 }));
    if (result.status !== "PASS") process.exitCode = 1;
  } finally { await writes; await journal.close(); }
}
