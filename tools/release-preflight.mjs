// Read-only preflight of a Cloud Run revision before it gets traffic: health, status,
// D4 model acceptance, observed model etags, runtime availability, integrations and today's Gemini counter.
// Usage: BASE=https://<tag>---<service>-<hash>.a.run.app node tools/release-preflight.mjs <outDir>
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const base = process.env.BASE;
const out = process.argv[2];
if (!base || !out) throw new Error("Set BASE and pass an output directory.");
const anon = await fetch(base + "/health");
console.log("unauthenticated /health", anon.status);
const idToken = execFileSync("gcloud", ["auth", "print-identity-token"], { encoding: "utf8" }).trim();
const serverless = { "X-Serverless-Authorization": "Bearer " + idToken };
// /api/status gives configuration detail only to a session holder, so the preflight opens one first.
const minted = await fetch(base + "/api/auth/demo-session", { method: "POST", headers: { ...serverless, Origin: new URL(base).origin } });
console.log("/api/auth/demo-session", minted.status);
const cookie = minted.headers.get("set-cookie")?.split(";")[0];
const get = async (path) => {
  const r = await fetch(base + path, { headers: { ...serverless, ...(cookie ? { Cookie: cookie } : {}) } });
  return { status: r.status, data: await r.json() };
};
const health = await get("/health");
console.log("/health", health.status, JSON.stringify(health.data));
const status = await get("/api/status");
if (!status.data.runtimeAvailability) throw new Error("/api/status returned the public view; the session was not accepted.");
writeFileSync(out + "/status.json", JSON.stringify(status.data, null, 2), { mode: 0o600 });
const m = status.data.modelAcceptance, ra = status.data.runtimeAvailability;
console.log("/api/status", status.status, status.data.executionMode, status.data.authorizationMode);
console.log("modelAcceptance", m.status, m.evaluationId, "thresholds", m.prototypeThresholdsMet, "linked", m.linkedToCurrentResourceVersions);
console.log("models", m.models.map((x) => `${x.defect}:${x.r2.toFixed(4)}/v${x.modelVersion}`).join(" "));
const mv = status.data.modelVersions;
console.log("modelVersions", mv
  ? `${mv.state} checked ${mv.lastCheckedAt} ` + mv.targets.map((x) => `${x.defect}:${x.observed ?? "none"}/${x.state}`).join(" ")
  : "not enforced (USTAAD_ENFORCE_MODEL_VERSIONS is not true)");
console.log("jobCreationAvailable", ra.jobCreationAvailable, "persistence", ra.jobSheetPersistenceAvailable, "geminiCapEnforced", ra.dailyGeminiCallCap.enforced, "sessionCallsLeft", ra.geminiBudget?.callsLeftToday ?? "n/a");
console.log("integrations", Object.entries(status.data.integrations).filter(([, v]) => typeof v === "boolean").map(([k, v]) => k + (v ? "+" : "-")).join(" "));
const accessToken = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const counter = await (await fetch(`https://firestore.googleapis.com/v1/projects/prepagent-hack/databases/(default)/documents/gemini_daily_usage/${day}`, { headers: { Authorization: "Bearer " + accessToken } })).json();
console.log("Gemini counter", day, counter.fields?.attemptCount?.integerValue ?? 0);
