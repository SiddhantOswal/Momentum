import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import modelAcceptanceConfig from "../config/model-acceptance.json" with { type: "json" };
import { jobSheetFixture } from "./fixtures/job-sheet.js";
import { startIndexServer } from "./helpers/server.js";

const ACCEPTED = modelAcceptanceConfig.currentModelVersions;
const acceptedEtags = () => Object.fromEntries(Object.entries(ACCEPTED).map(([defect, etag]) => [`m2_${defect.toLowerCase()}`, etag]));
const levers = { sfSpeedMpm: 48, rollTempC: 162, gumApplication: "HIGH", gumViscositySec: 32, pastingPressure: "MED", dryingHours: 5, printSpeedSpm: 60 };
const order = {
  orderId: "TEST-HTTP-MODEL-VERSION", itemCode: "PKBX0041", customerId: "SYNTHETIC",
  boxStyle: "RSC", lengthMm: 400, widthMm: 300, heightMm: 250, ply: 5,
  fluteProfile: "BC", topLinerGsm: 180, fluteGsm: 150, innerLinerGsm: 180,
  linerBf: 24, paperType: "RECYCLED", paperSupplier: "SUP-D", inkColors: 2,
  inkCoveragePct: 15, quantity: 1300,
};
const conditions = { shift: "DAY", ambientRhPct: 86, ambientTempC: 26, paperMoisturePct: 10.8 };
const requests = [
  ["/risk/predict", { order: { itemCode: "PKBX0041", quantity: 1300, paperType: "RECYCLED", paperSupplier: "SUP-D" },
    conditions, conditionsConfirmed: true, levers }],
  ["/risk/optimize", { order, conditions: { ...conditions, runDate: "2026-10-15" }, conditionsConfirmed: true, levers }],
  ["/risk/explanation", {
    order: jobSheetFixture.order,
    conditions: jobSheetFixture.conditions,
    prediction: jobSheetFixture.baseline.risk,
    optimization: { baseline: jobSheetFixture.baseline, best: jobSheetFixture.recommended, changes: jobSheetFixture.changes, savings: jobSheetFixture.savings },
    evidence: [],
  }],
];
// The explanation port exists only when live Gemini calls are permitted, which on Cloud Run needs the budget policy.
const BUDGET_LIMITS = {
  pool: "live",
  dayLimit: 300, sessionDayLimit: 40, ipDayLimit: 120, minuteLimit: 20, sessionMinuteLimit: 6,
  reserve: { units: 80, windowStart: "2026-12-04T00:00:00+08:00", windowEnd: "2026-12-04T23:59:59+08:00",
    grant: "pitch_reserve", sessionDayLimit: 120 },
};

async function withServer(etags, run) {
  const { child, port } = await startIndexServer({
    PATH: process.env.PATH, K_SERVICE: "prepagent", PROJECT_ID: "prepagent-hack", REGION: "asia-south1",
    USTAAD_AUTHORIZATION_MODE: "HACKATHON_DEMO", USTAAD_DEMO_SESSION_SIGNING_KEY: "a".repeat(64), USTAAD_SYNTHETIC_ONLY: "true",
    USTAAD_ENABLE_APPROVAL_AUDIT: "true", USTAAD_ENABLE_RISK_PREDICTION: "true", USTAAD_OPTIMIZER_CONTRACT_STATUS: "approved", USTAAD_OPTIMIZER_CONTRACT_VERSION: "om-d2-d3-v1",
    BUCKET: "prepagent-hack-data", USTAAD_ENABLE_LIVE_MODEL_CALLS: "true",
    USTAAD_GEMINI_BUDGET_POLICY: "budget-v2", GEMINI_BUDGET_LIMITS: JSON.stringify(BUDGET_LIMITS),
    USTAAD_ENFORCE_MODEL_VERSIONS: "true", FAKE_MODEL_ETAGS: JSON.stringify(etags),
    USTAAD_PUBLIC_ORIGIN: "https://momentum.example",
  }, { entry: "test/helpers/fake-models-api-entry.mjs" });
  const origin = `http://127.0.0.1:${port}`;
  try {
    const requestOrigin = "https://momentum.example";
    const session = await fetch(origin + "/api/auth/demo-session", { method: "POST", headers: { Origin: requestOrigin } });
    assert.equal(session.status, 200, await session.clone().text());
    const headers = { Cookie: session.headers.get("set-cookie").split(";")[0], Origin: requestOrigin, "Content-Type": "application/json" };
    let status;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      status = await (await fetch(origin + "/api/status", { headers: { Cookie: headers.Cookie } })).json();
      if (status.modelVersions?.state !== "unchecked") break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(status.integrations.explainRisk, true, "the explanation port must be configured for this test to mean anything");
    await run({ origin, headers, status });
  } finally {
    if (child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); child.kill("SIGTERM"); await exited; }
  }
}

test("HTTP prediction, optimization and explanation return 503 MODEL_VERSION_MISMATCH and status names the target", { timeout: 30000 }, async () => {
  await withServer({ ...acceptedEtags(), m2_crack: "cmV0cmFpbmVkLWNyYWNr" }, async ({ origin, headers, status }) => {
    assert.equal(status.modelVersions.enforced, true);
    assert.equal(status.modelVersions.state, "mismatch");
    assert.equal(typeof status.modelVersions.lastCheckedAt, "string");
    const crack = status.modelVersions.targets.find((target) => target.defect === "CRACK");
    assert.equal(crack.expected, ACCEPTED.CRACK);
    assert.equal(crack.observed, "cmV0cmFpbmVkLWNyYWNr");
    assert.equal(crack.state, "mismatch");
    assert.equal(crack.checkedAt, status.modelVersions.lastCheckedAt);
    assert.ok(status.modelVersions.targets.filter((target) => target !== crack).every((target) => target.state === "match"));
    assert.equal(JSON.stringify(status).includes("fake-entry-token"), false);
    for (const [path, body] of requests) {
      const response = await fetch(origin + path, { method: "POST", headers, body: JSON.stringify(body) });
      assert.equal(response.status, 503, path);
      const payload = await response.json();
      assert.equal(payload.ok, false, path);
      assert.equal(payload.error.code, "MODEL_VERSION_MISMATCH", path);
      assert.deepEqual(payload.error.targets, ["CRACK"], path);
      assert.match(payload.error.message, /CRACK model in BigQuery is not the accepted version/, path);
    }
  });
});

test("HTTP prediction, optimization and explanation return 503 MODEL_VERSION_UNVERIFIED when a model cannot be read", { timeout: 30000 }, async () => {
  const { m2_delam: _unreadable, ...etags } = acceptedEtags();
  await withServer(etags, async ({ origin, headers, status }) => {
    assert.equal(status.modelVersions.state, "unverified");
    const delam = status.modelVersions.targets.find((target) => target.defect === "DELAM");
    assert.deepEqual([delam.expected, delam.observed, delam.state, delam.reason], [ACCEPTED.DELAM, null, "unverified", "BIGQUERY_UNAVAILABLE"]);
    for (const [path, body] of requests) {
      const response = await fetch(origin + path, { method: "POST", headers, body: JSON.stringify(body) });
      assert.equal(response.status, 503, path);
      const payload = await response.json();
      assert.equal(payload.error.code, "MODEL_VERSION_UNVERIFIED", path);
      assert.deepEqual(payload.error.targets, ["DELAM"], path);
    }
  });
});
