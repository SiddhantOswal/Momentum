import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";

// Runs index.mjs with the budget policy on and every Google API replaced by a local fake, then
// sends photos to /evidence/diagnose-photo, a route that reaches Gemini through withDailyGeminiCallCap.
const preload = fileURLToPath(new URL("./fixtures/redirect-all-google-apis.mjs", import.meta.url));
const appDirectory = fileURLToPath(new URL("..", import.meta.url));
const PITCH_CODE = "7f1c3e5a9b2d4f6081a3c5e7d9b1f3a5c7e9d1b3f5a7c9e1d3b5f7a9c1e3d5b7";
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);
const DIAGNOSIS = { isCorrugatedBoard: true, label: "WARP", severity: "LOW", confidence: 0.8, visibleSigns: ["edge lift"] };

const hourAround = () => ({
  windowStart: new Date(Date.now() - 3600_000).toISOString(), windowEnd: new Date(Date.now() + 3600_000).toISOString(),
});

async function startFakeGoogleApis() {
  const firestore = fakeFirestore();
  const counts = { vertex: 0 };
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks).toString("utf8") : undefined;
    const original = new URL(request.headers["x-original-url"]);
    const reply = (status, payload) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(payload));
    };
    if (original.hostname === "metadata.google.internal") return reply(200, { access_token: "test-token", expires_in: 3600, token_type: "Bearer" });
    if (original.hostname === "firestore.googleapis.com") {
      const answer = await firestore.fetchImpl(original.href, { method: request.method, body });
      return reply(answer.status, await answer.json());
    }
    if (original.hostname === "storage.googleapis.com") return reply(200, { name: original.searchParams.get("name"), generation: "1" });
    if (original.pathname.endsWith(":generateContent")) {
      counts.vertex += 1;
      return reply(200, {
        candidates: [{ content: { parts: [{ text: JSON.stringify(DIAGNOSIS) }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 120 },
      });
    }
    return reply(503, { error: { status: "UNAVAILABLE" } });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { firestore, counts, server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function freePort() {
  const listener = createNetServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function startApp(googleApisOrigin, limits) {
  const port = await freePort();
  const logs = [];
  const child = spawn(process.execPath, ["--import", preload, "index.mjs"], {
    cwd: appDirectory,
    env: {
      PATH: process.env.PATH, PORT: String(port), K_SERVICE: "prepagent", PROJECT_ID: "prepagent-hack",
      REGION: "asia-south1", BUCKET: "prepagent-hack-data",
      USTAAD_AUTHORIZATION_MODE: "HACKATHON_DEMO", USTAAD_DEMO_SESSION_SIGNING_KEY: "a".repeat(64),
      USTAAD_ENABLE_APPROVAL_AUDIT: "true", USTAAD_SYNTHETIC_ONLY: "true",
      USTAAD_ENABLE_LIVE_MODEL_CALLS: "true", USTAAD_ENABLE_DEFECT_DIAGNOSIS: "true",
      USTAAD_GEMINI_BUDGET_POLICY: "budget-v2", GEMINI_BUDGET_LIMITS: JSON.stringify(limits),
      ARC_PITCH_RESERVE_CODE: PITCH_CODE, TEST_GOOGLE_APIS_ORIGIN: googleApisOrigin,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => logs.push(String(chunk)));
  child.stderr.on("data", (chunk) => logs.push(String(chunk)));
  await Promise.race([
    once(child.stdout, "data"),
    once(child, "exit").then(() => { throw new Error(`The app exited during startup: ${logs.join("")}`); }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("App startup timed out.")), 6000).unref()),
  ]);
  const url = `http://127.0.0.1:${port}`;
  const origin = `https://127.0.0.1:${port}`;
  const post = (path, { ip, cookie, body }) => fetch(url + path, {
    method: "POST",
    headers: { Origin: origin, "X-Forwarded-For": ip, ...(cookie ? { Cookie: cookie } : {}), ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}) },
    body,
  });
  return {
    child, logs, post,
    session: async (ip) => (await post("/api/auth/demo-session", { ip })).headers.get("set-cookie").split(";")[0],
    diagnose(cookie, ip) {
      const form = new FormData();
      form.append("file", new File([JPEG], "sheet.jpg", { type: "image/jpeg" }));
      return post("/evidence/diagnose-photo", { ip, cookie, body: form });
    },
  };
}

async function withApp(limits, run) {
  const google = await startFakeGoogleApis();
  let app;
  try {
    app = await startApp(google.origin, limits);
    await run(app, google);
  } finally {
    if (app && app.child.exitCode === null) {
      const exited = once(app.child, "exit");
      app.child.kill("SIGTERM");
      await exited;
    }
    google.server.close();
  }
}

const BASE = { pool: "live", dayLimit: 100, sessionDayLimit: 100, ipDayLimit: 100, minuteLimit: 100, sessionMinuteLimit: 100,
  demoSessionMint: { perIpPerHour: 100 } };
const budgetCode = async (response) => (await response.json()).error?.budgetCode;

test("the per-session day limit applies to a real request path", async () => {
  await withApp({ ...BASE, sessionDayLimit: 2 }, async (app, google) => {
    const judge = await app.session("203.0.113.10");
    assert.equal((await app.diagnose(judge, "203.0.113.10")).status, 200);
    assert.equal((await app.diagnose(judge, "203.0.113.10")).status, 200);
    const refused = await app.diagnose(judge, "203.0.113.10");
    assert.equal(refused.status, 429);
    assert.equal(await budgetCode(refused), "BUDGET_SESSION_EXHAUSTED");
    assert.equal(google.counts.vertex, 2);
    assert.equal((await app.diagnose(await app.session("203.0.113.10"), "203.0.113.10")).status, 200);
  });
});

test("twenty sessions from one address spend no more than the day limit minus the reserve", async () => {
  const limits = { ...BASE, dayLimit: 12, ipDayLimit: 12, sessionDayLimit: 3,
    reserve: { units: 4, ...hourAround(), grant: "pitch_reserve", sessionDayLimit: 6 } };
  await withApp(limits, async (app, google) => {
    const statuses = [];
    for (let i = 0; i < 20; i += 1) {
      const cookie = await app.session("203.0.113.20");
      for (let call = 0; call < 3; call += 1) statuses.push((await app.diagnose(cookie, "203.0.113.20")).status);
    }
    assert.equal(statuses.filter((status) => status === 200).length, 8);
    assert.equal(google.counts.vertex, 8);
  });
});

test("the per-address day limit holds across sessions, and another address is unaffected", async () => {
  await withApp({ ...BASE, ipDayLimit: 3 }, async (app, google) => {
    for (let i = 0; i < 3; i += 1) assert.equal((await app.diagnose(await app.session("203.0.113.30"), "203.0.113.30")).status, 200);
    const refused = await app.diagnose(await app.session("203.0.113.30"), "203.0.113.30");
    assert.equal(await budgetCode(refused), "BUDGET_IP_EXHAUSTED");
    assert.equal((await app.diagnose(await app.session("203.0.113.31"), "203.0.113.31")).status, 200);
    assert.equal(google.counts.vertex, 4);
  });
});

test("reserve units are spent only with a pitch claim obtained from the code", async () => {
  const limits = { ...BASE, dayLimit: 5, ipDayLimit: 50, sessionDayLimit: 50,
    reserve: { units: 2, ...hourAround(), grant: "pitch_reserve", sessionDayLimit: 50 } };
  await withApp(limits, async (app, google) => {
    const plain = await app.session("203.0.113.40");
    for (let i = 0; i < 3; i += 1) assert.equal((await app.diagnose(plain, "203.0.113.40")).status, 200);
    const held = await app.diagnose(plain, "203.0.113.40");
    assert.equal(held.status, 429);
    assert.equal(await budgetCode(held), "BUDGET_RESERVED_FOR_PITCH");
    // The same session with a forged cookie claim gets nothing.
    const tampered = plain.replace(/^(\S+?=)([^.]+)/, (_, name, payload) => {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString());
      return `${name}${Buffer.from(JSON.stringify({ ...data, grants: ["pitch_reserve"], policy: "HACKATHON_DEMO:v2" })).toString("base64url")}`;
    });
    assert.equal(await budgetCode(await app.diagnose(tampered, "203.0.113.40")), undefined);
    const claim = await app.post("/api/auth/pitch-claim", { ip: "203.0.113.41", cookie: plain, body: JSON.stringify({ code: PITCH_CODE }) });
    assert.equal(claim.status, 200);
    const claimed = claim.headers.get("set-cookie").split(";")[0];
    assert.equal((await app.diagnose(claimed, "203.0.113.41")).status, 200);
    assert.equal((await app.diagnose(claimed, "203.0.113.41")).status, 200);
    assert.equal(await budgetCode(await app.diagnose(claimed, "203.0.113.41")), "BUDGET_DAY_EXHAUSTED");
    assert.equal(google.counts.vertex, 5);
  });
});
