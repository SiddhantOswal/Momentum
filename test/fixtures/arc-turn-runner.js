import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import modelAcceptanceConfig from "../../config/model-acceptance.json" with { type: "json" };
import { createArcRoutes } from "../../src/arc/routes.js";
import { createArcTurnRunner } from "../../src/arc/turn-runner.js";
import { readDailyGeminiCallCapConfig } from "../../src/daily-gemini-call-cap.js";
import { readGeminiBudgetConfig } from "../../src/gemini-budget-config.js";
import { createArcEventStore } from "../../src/google-cloud/firestore-arc-event-store.js";
import { createFirestoreArcSessionStore } from "../../src/google-cloud/firestore-arc-session-store.js";
import { createFirestoreArcTaskRunStore } from "../../src/google-cloud/firestore-arc-task-run-store.js";
import { budgetCapStore, createFirestoreBudgetStore } from "../../src/google-cloud/firestore-budget-store.js";
import { createFirestoreTraceStore } from "../../src/google-cloud/firestore-trace-store.js";
import { createHackathonDemoAuthenticator } from "../../src/hackathon-demo-auth.js";
import { fakeFirestore } from "./fake-firestore-transactions.js";
import { createFakeFirestore, FAKE_PROJECT_ID } from "./fake-firestore.js";
const AUDIENCE = "https://momentum.example";

/**
 * A turn runner behind the Arc routes over fake Firestore and the real budget
 * store, shared by the runner tests and the offline eval suites.
 */
export { arcConfig } from "../../src/arc/turn-runner.js";

const auth = createHackathonDemoAuthenticator({
  mode: "HACKATHON_DEMO", syntheticOnly: true, auditEnabled: true, signingKey: "a".repeat(64),
});
export const ipKey = "a".repeat(16);
export const modelCall = (name, args = {}) => ({ name, args });
export const privateText = "Private customer text from the document.";
export const privatePrompt = "Internal system instruction used by the adapter.";

export function fixture({ router, writer, preRoute, readToolEffect, services = {}, commandDeps = {}, budgetLimits = {}, ip = ipKey, ...ports } = {}) {
  const fake = createFakeFirestore();
  let time = Date.now();
  const now = () => time;
  const clock = (ms) => { time += ms; };
  const options = { projectId: FAKE_PROJECT_ID, fetchImpl: fake.fetchImpl, tokenProvider: async () => "test", now };
  const sessionStore = createFirestoreArcSessionStore(options);
  const taskRunStore = createFirestoreArcTaskRunStore(options);
  const eventStore = createArcEventStore(options);
  const attempts = new Map();
  const reservations = [];
  const budgetFirestore = fakeFirestore();
  const { limits } = readGeminiBudgetConfig({
    USTAAD_GEMINI_BUDGET_POLICY: "budget-v2",
    GEMINI_BUDGET_LIMITS: JSON.stringify({
      pool: "live", dayLimit: 300, sessionDayLimit: 40, ipDayLimit: 120, minuteLimit: 20, sessionMinuteLimit: 6,
      ...budgetLimits,
    }),
  });
  const budget = createFirestoreBudgetStore({ ...options, fetchImpl: budgetFirestore.fetchImpl, limits });
  const store = budgetCapStore({
    ...budget,
    async reserve(request) {
      const result = await budget.reserve(request);
      reservations.push({ key: request.reservationKey, replayed: result.replayed ?? false });
      if (result.ok && !result.replayed) attempts.set(request.reservationKey, request);
      return result;
    },
  });
  const geminiCap = readDailyGeminiCallCapConfig({});
  const cookie = auth.issue(AUDIENCE);
  const principal = auth.authenticate(cookie, AUDIENCE).principal;
  const deps = { hackathonAuth: auth, executionMode: "live-service", isSameOrigin: () => true, sessionAudience: () => AUDIENCE, servicePorts: services, modelAcceptanceConfig, ...commandDeps };
  const create = (overrides = {}) => createArcTurnRunner({
    sessionStore, taskRunStore, eventStore, deps, now, geminiCap, attemptStore: store,
    router, writer, preRoute, readToolEffect, ...ports, ...overrides,
  });
  function request(path, requestOptions, runner = create()) {
    const app = new Hono();
    app.route("/api/arc", createArcRoutes({ enabled: true, commandDeps: deps, sessionStore, taskRunStore,
      lotStore: ports.lotStore, ...runner, getIpKey: () => ip }));
    return app.request(`http://localhost${path}`, {
      ...requestOptions, headers: { Cookie: `__Host-ustaad-demo=${cookie}`, Origin: "http://localhost" },
    });
  }
  function post(input, { runner, clientTurnId = randomUUID(), signal } = {}) {
    return request("/api/arc/turns", {
      method: "POST", body: JSON.stringify({ clientTurnId, input }), signal,
    }, runner);
  }
  return {
    create, post, request, attempts, reservations, budget, principal, sessionStore, taskRunStore, fake, clock, geminiCap,
    store, legacyTraceStore: createFirestoreTraceStore(options), deps,
  };
}

export function text(text) { return { kind: "text", text }; }
export function action(actionId, params) { return { kind: "action", actionId, params }; }

export async function events(response, accepted = "accepted") {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("arc-turn"), accepted);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-type"), /^text\/event-stream/);
  return (await response.text()).split("\n\n").filter((frame) => frame.includes("data: "))
    .map((frame) => {
      const lines = frame.split("\n");
      const data = JSON.parse(lines.find((line) => line.startsWith("data: ")).slice(6));
      assert.ok(lines.includes(`event: ${data.type}`));
      assert.equal(lines.find((line) => line.startsWith("id: ")), data.sequence ? `id: ${data.sequence}` : undefined);
      return data;
    });
}
