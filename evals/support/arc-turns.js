// Drives whole Arc turns through the real routes, turn runner, scope rules and,
// when asked, the real router and Vertex client. Firestore, the budget store and
// Vertex AI are in-process fakes, so a case costs no attempt and needs no network.
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import modelAcceptanceConfig from "../../config/model-acceptance.json" with { type: "json" };
import { createArcRouter } from "../../src/arc/router.js";
import { createArcRoutes } from "../../src/arc/routes.js";
import { createScopeRules } from "../../src/arc/scope-rules.js";
import { createToolRegistry } from "../../src/arc/tools/index.js";
import { arcConfig, createArcTurnRunner } from "../../src/arc/turn-runner.js";
import { readDailyGeminiCallCapConfig } from "../../src/daily-gemini-call-cap.js";
import { readGeminiBudgetConfig } from "../../src/gemini-budget-config.js";
import { createArcEventStore } from "../../src/google-cloud/firestore-arc-event-store.js";
import { createFirestoreArcSessionStore } from "../../src/google-cloud/firestore-arc-session-store.js";
import { createFirestoreArcTaskRunStore } from "../../src/google-cloud/firestore-arc-task-run-store.js";
import { budgetCapStore, createFirestoreBudgetStore } from "../../src/google-cloud/firestore-budget-store.js";
import { createVertexGeminiClient } from "../../src/google-cloud/vertex-gemini-client.js";
import { createHackathonDemoAuthenticator } from "../../src/hackathon-demo-auth.js";
import { createRecordingVertexTransport } from "../../src/mock-agents.js";
import { fakeFirestore } from "../../test/fixtures/fake-firestore-transactions.js";
import { createFakeFirestore, FAKE_PROJECT_ID } from "../../test/fixtures/fake-firestore.js";

const IP_KEY = "e".repeat(16);
const BUDGET_LIMITS = { pool: "live", dayLimit: 300, sessionDayLimit: 40, ipDayLimit: 120, minuteLimit: 20, sessionMinuteLimit: 6 };

export const text = (value) => ({ kind: "text", text: value });
export const action = (actionId, params) => ({ kind: "action", actionId, ...(params && { params }) });

/** A Vertex client whose requests are captured instead of sent. */
export function recordingVertexClient(respond) {
  const transport = createRecordingVertexTransport(respond);
  const client = createVertexGeminiClient({
    projectId: FAKE_PROJECT_ID, tokenProvider: async () => "offline-eval", fetchImpl: transport.fetchImpl,
  });
  return { client, requests: transport.requests };
}

/**
 * `router` is either a function standing in for the router port, or a list of
 * recorded Vertex responses (or a function of the request) that the real router
 * reads through the real Vertex client. `services` are the command service
 * ports; approveJob is always counted, so a case can assert zero approvals.
 */
export function arcTurns({ router, writer, renderTemplate, services = {}, commandDeps = {}, budgetLimits = {} } = {}) {
  const firestore = createFakeFirestore();
  const options = { projectId: FAKE_PROJECT_ID, fetchImpl: firestore.fetchImpl, tokenProvider: async () => "offline-eval" };
  const sessionStore = createFirestoreArcSessionStore(options);
  const taskRunStore = createFirestoreArcTaskRunStore(options);
  const reservations = [];
  const budget = createFirestoreBudgetStore({
    ...options, fetchImpl: fakeFirestore().fetchImpl,
    limits: readGeminiBudgetConfig({
      USTAAD_GEMINI_BUDGET_POLICY: "budget-v2",
      GEMINI_BUDGET_LIMITS: JSON.stringify({ ...BUDGET_LIMITS, ...budgetLimits }),
    }).limits,
  });
  const attemptStore = budgetCapStore({
    ...budget,
    async reserve(request) {
      const result = await budget.reserve(request);
      if (result.ok && !result.replayed) reservations.push(request.purpose);
      return result;
    },
  });
  const approvals = [];
  const auth = createHackathonDemoAuthenticator({
    mode: "HACKATHON_DEMO", syntheticOnly: true, auditEnabled: true, signingKey: "e".repeat(64),
  });
  const cookie = auth.issue();
  const principal = auth.authenticate(cookie).principal;
  const servicePorts = {
    ...services,
    approveJob: async (request) => {
      approvals.push(request);
      return { ok: true, jobSheet: { jobId: request.jobId, status: "APPROVED", order: {} } };
    },
  };
  const deps = {
    hackathonAuth: auth, executionMode: "live-service", isSameOrigin: () => true, servicePorts, modelAcceptanceConfig, ...commandDeps,
  };
  const scope = createScopeRules();
  let vertex = { requests: [] };
  let routerPort = router;
  if (router !== undefined && typeof router !== "function") {
    vertex = recordingVertexClient(router);
    routerPort = createArcRouter({ client: vertex.client, scope });
  }
  const runner = createArcTurnRunner({
    sessionStore, taskRunStore, eventStore: createArcEventStore(options), deps,
    geminiCap: readDailyGeminiCallCapConfig({}), attemptStore,
    preRoute: scope.preRoute, renderReply: scope.renderReply, router: routerPort, writer,
    ...(renderTemplate && { renderTemplate }),
  });
  const app = new Hono();
  app.route("/api/arc", createArcRoutes({
    enabled: true, commandDeps: deps, sessionStore, taskRunStore, ...runner, getIpKey: () => IP_KEY,
  }));

  async function post(input, clientTurnId = randomUUID()) {
    const response = await app.request("http://localhost/api/arc/turns", {
      method: "POST", body: JSON.stringify({ clientTurnId, input }),
      headers: { Cookie: `__Host-ustaad-demo=${cookie}`, Origin: "http://localhost" },
    });
    const body = await response.text();
    const frames = response.headers.get("content-type")?.startsWith("text/event-stream")
      ? body.split("\n\n").flatMap((frame) => frame.split("\n").filter((line) => line.startsWith("data: ")))
        .map((line) => JSON.parse(line.slice(6)))
      : [];
    const turn = await sessionStore.getTurn(principal.sessionId, clientTurnId);
    return { status: response.status, body, frames, turn };
  }

  /** The registry's own allow-list for this session as stored now, with no lot. */
  async function registryAllowList() {
    const session = await sessionStore.get(principal.sessionId);
    const registry = createToolRegistry({ principal, ipKey: IP_KEY, session: session ?? { sessionId: principal.sessionId, jobIds: [], activeLotIds: [] }, deps });
    return registry.allowedFunctionNames({ signal: undefined, source: "model" });
  }

  return {
    post, approvals, reservations, vertexRequests: vertex.requests, scope, principal, sessionStore, registryAllowList,
  };
}

export { arcConfig };
