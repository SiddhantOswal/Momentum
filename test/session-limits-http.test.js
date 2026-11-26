import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { fakeFirestore } from "./fixtures/fake-firestore-transactions.js";

const preload = fileURLToPath(new URL("./fixtures/redirect-google-apis.mjs", import.meta.url));
const appDirectory = fileURLToPath(new URL("..", import.meta.url));
const PITCH_CODE = "5e3a9c1d7b4f2086e1d3a5c7b9f0e2d4a6c8e0f1b3d5a7c9e1f3b5d7a9c1e3f5";
const LIMITS = {
  pool: "live", dayLimit: 300, sessionDayLimit: 40, ipDayLimit: 120, minuteLimit: 20, sessionMinuteLimit: 6,
  demoSessionMint: { perIpPerHour: 3 }, pitchClaim: { attemptsPerIpPerHour: 2 },
  reserve: { units: 80, windowStart: "2026-12-04T00:00:00+08:00", windowEnd: "2026-12-04T23:59:59+08:00", grant: "pitch_reserve", sessionDayLimit: 120 },
};

async function startFakeGoogleApis({ failFirestore = () => false } = {}) {
  const firestore = fakeFirestore();
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks).toString("utf8") : undefined;
    const original = new URL(request.headers["x-original-url"]);
    const reply = (status, payload) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(payload));
    };
    if (original.hostname === "metadata.google.internal") {
      return reply(200, { access_token: "test-token", expires_in: 3600, token_type: "Bearer" });
    }
    if (original.hostname === "firestore.googleapis.com") {
      if (failFirestore()) return reply(503, { error: { status: "UNAVAILABLE" } });
      const answer = await firestore.fetchImpl(original.href, { method: request.method, body });
      return reply(answer.status, await answer.json());
    }
    return reply(503, { error: { status: "UNAVAILABLE" } });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { firestore, server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function freePort() {
  const listener = createNetServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function startApp(googleApisOrigin, extraEnv = {}) {
  const port = await freePort();
  const logs = [];
  const child = spawn(process.execPath, ["--import", preload, "index.mjs"], {
    cwd: appDirectory,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      K_SERVICE: "prepagent",
      PROJECT_ID: "prepagent-hack",
      USTAAD_AUTHORIZATION_MODE: "HACKATHON_DEMO",
      USTAAD_DEMO_SESSION_SIGNING_KEY: "a".repeat(64),
      USTAAD_ENABLE_APPROVAL_AUDIT: "true",
      USTAAD_SYNTHETIC_ONLY: "true",
      USTAAD_GEMINI_BUDGET_POLICY: "budget-v2",
      GEMINI_BUDGET_LIMITS: JSON.stringify(LIMITS),
      ARC_PITCH_RESERVE_CODE: PITCH_CODE,
      TEST_GOOGLE_APIS_ORIGIN: googleApisOrigin,
      USTAAD_PUBLIC_ORIGIN: `https://127.0.0.1:${port}`,
      ...extraEnv,
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
  const origin = `https://127.0.0.1:${port}`;
  return {
    child, logs, origin, url: `http://127.0.0.1:${port}`,
    post: (path, { ip = "203.0.113.7", cookie, body } = {}) => fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: {
        Origin: origin, "X-Forwarded-For": ip, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
    }),
  };
}

async function stopApp(app) {
  if (!app || app.child.exitCode !== null || app.child.signalCode !== null) return;
  const exited = once(app.child, "exit");
  app.child.kill("SIGTERM");
  await exited;
}

const cookieOf = (response) => response.headers.get("set-cookie")?.split(";")[0];
const payloadOf = (cookie) => JSON.parse(Buffer.from(cookie.split("=")[1].split(".")[0], "base64url").toString());

async function withApp(options, run) {
  const google = await startFakeGoogleApis(options.google);
  let app;
  try {
    app = await startApp(google.origin, options.env);
    await run(app, google);
  } finally {
    await stopApp(app);
    google.server.close();
  }
}

test("twenty sessions requested from one address mint only the hourly limit, and a held cookie is reused for free", async () => {
  await withApp({}, async (app) => {
    const statuses = [];
    const cookies = [];
    for (let i = 0; i < 20; i += 1) {
      const response = await app.post("/api/auth/demo-session");
      statuses.push(response.status);
      if (response.status === 200) cookies.push(cookieOf(response));
      else {
        assert.equal(response.headers.get("set-cookie"), null);
        assert.equal((await response.json()).error.code, "DEMO_SESSION_RATE_LIMITED");
        assert.ok(Number(response.headers.get("retry-after")) >= 1);
      }
    }
    assert.equal(statuses.filter((status) => status === 200).length, 3);
    assert.equal(statuses.filter((status) => status === 429).length, 17);
    assert.equal(new Set(cookies.map((cookie) => payloadOf(cookie).sid)).size, 3);
    const reused = await app.post("/api/auth/demo-session", { cookie: cookies[0] });
    assert.equal(reused.status, 200);
    assert.equal(cookieOf(reused), cookies[0]);
    assert.equal((await app.post("/api/auth/demo-session", { ip: "203.0.113.8" })).status, 200);
  });
});

test("issuing a session is refused with 503 and no cookie while the budget store is down", async () => {
  let down = true;
  await withApp({ google: { failFirestore: () => down } }, async (app) => {
    const response = await app.post("/api/auth/demo-session");
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("set-cookie"), null);
    down = false;
    assert.equal((await app.post("/api/auth/demo-session")).status, 200);
  });
});

test("with the budget flag off, session issuance behaves as before", async () => {
  await withApp({ env: { USTAAD_GEMINI_BUDGET_POLICY: "" } }, async (app) => {
    for (let i = 0; i < 6; i += 1) assert.equal((await app.post("/api/auth/demo-session")).status, 200);
    const claim = await app.post("/api/auth/pitch-claim", { body: { code: PITCH_CODE } });
    assert.ok([401, 503].includes(claim.status));
  });
});

test("the right code turns a session cookie into a pitch claim for the same session", async () => {
  await withApp({}, async (app) => {
    const session = cookieOf(await app.post("/api/auth/demo-session", { ip: "203.0.113.50" }));
    const claim = await app.post("/api/auth/pitch-claim", { cookie: session, body: { code: PITCH_CODE } });
    assert.equal(claim.status, 200);
    const claimed = cookieOf(claim);
    assert.match(claim.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(claim.headers.get("set-cookie"), /SameSite=Strict/i);
    assert.equal(payloadOf(claimed).sid, payloadOf(session).sid);
    assert.equal(payloadOf(claimed).exp, payloadOf(session).exp);
    assert.deepEqual(payloadOf(claimed).grants, ["pitch_reserve"]);
    assert.equal(payloadOf(claimed).aud, app.origin);
    assert.equal(payloadOf(session).aud, app.origin);
    const body = await claim.json();
    assert.equal(body.ok, true);
    assert.equal(JSON.stringify(body).includes(PITCH_CODE), false);
    // Presenting the claimed cookie again keeps it and mints nothing new.
    const again = await app.post("/api/auth/demo-session", { cookie: claimed });
    assert.equal(cookieOf(again), claimed);
  });
});

test("a session signed with the shared key for another origin cannot claim the pitch reserve here", async () => {
  await withApp({}, async (app) => {
    const own = payloadOf(cookieOf(await app.post("/api/auth/demo-session", { ip: "203.0.113.55" })));
    const sign = (data) => {
      const body = Buffer.from(JSON.stringify(data)).toString("base64url");
      return `__Host-ustaad-demo=${body}.${createHmac("sha256", Buffer.from("a".repeat(64), "hex")).update(body).digest("base64url")}`;
    };
    for (const forged of [sign({ ...own, aud: "https://arc-test---momentum.example" }), sign({ ...own, aud: undefined })]) {
      const claim = await app.post("/api/auth/pitch-claim", { ip: "203.0.113.56", cookie: forged, body: { code: PITCH_CODE } });
      assert.equal(claim.status, 401);
      assert.equal((await claim.json()).error.code, "DEMO_SESSION_REQUIRED");
      assert.equal(claim.headers.get("set-cookie"), null);
    }
    assert.equal((await app.post("/api/auth/pitch-claim", { ip: "203.0.113.56", cookie: sign(own), body: { code: PITCH_CODE } })).status, 200);
  });
});

test("a wrong code, a missing session and a bad body get no claim, and attempts are limited per address", async () => {
  await withApp({}, async (app) => {
    const session = cookieOf(await app.post("/api/auth/demo-session", { ip: "203.0.113.60" }));
    const asker = { ip: "203.0.113.61", cookie: session };
    assert.equal((await app.post("/api/auth/pitch-claim", { ...asker, body: "not json" })).status, 400);
    assert.equal((await app.post("/api/auth/pitch-claim", { ...asker, body: { code: PITCH_CODE, extra: 1 } })).status, 400);
    assert.equal((await app.post("/api/auth/pitch-claim", { ...asker, body: { code: "x".repeat(129) } })).status, 400);
    assert.equal((await app.post("/api/auth/pitch-claim", { ip: "203.0.113.62", body: { code: PITCH_CODE } })).status, 401);
    const wrong = await app.post("/api/auth/pitch-claim", { ...asker, body: { code: "not the code" } });
    assert.equal(wrong.status, 403);
    assert.equal(wrong.headers.get("set-cookie"), null);
    assert.equal((await wrong.json()).error.code, "PITCH_CODE_INVALID");
    assert.equal((await app.post("/api/auth/pitch-claim", { ...asker, body: { code: "still wrong" } })).status, 403);
    // Two attempts used the address's allowance, so even the right code is refused now.
    const limited = await app.post("/api/auth/pitch-claim", { ...asker, body: { code: PITCH_CODE } });
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.code, "PITCH_CLAIM_RATE_LIMITED");
    assert.equal(limited.headers.get("set-cookie"), null);
    const crossOrigin = await fetch(`${app.url}/api/auth/pitch-claim`, {
      method: "POST", headers: { Origin: "https://evil.example", "X-Forwarded-For": "203.0.113.63", Cookie: session, "Content-Type": "application/json" },
      body: JSON.stringify({ code: PITCH_CODE }),
    });
    assert.equal(crossOrigin.status, 403);
  });
});

test("the pitch route reports 503 when the secret is not provisioned", async () => {
  await withApp({ env: { ARC_PITCH_RESERVE_CODE: "" } }, async (app) => {
    const session = cookieOf(await app.post("/api/auth/demo-session"));
    const response = await app.post("/api/auth/pitch-claim", { cookie: session, body: { code: "anything" } });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("set-cookie"), null);
  });
});

test("the pitch code never appears in responses or logs, whatever the outcome", async () => {
  await withApp({}, async (app) => {
    const seen = [];
    const session = cookieOf(await app.post("/api/auth/demo-session", { ip: "203.0.113.70" }));
    for (const body of [{ code: PITCH_CODE }, { code: `${PITCH_CODE}0` }, { code: PITCH_CODE, extra: true }]) {
      const response = await app.post("/api/auth/pitch-claim", { ip: "203.0.113.71", cookie: session, body });
      seen.push(await response.text());
    }
    const status = await fetch(`${app.url}/api/status`, { headers: { Cookie: session } });
    seen.push(await status.text());
    assert.equal(seen.join("").includes(PITCH_CODE), false);
    assert.equal(app.logs.join("").includes(PITCH_CODE), false);
    assert.ok(app.logs.join("").includes("arc_pitch_claim"));
  });
});

test("HTTP status gives the public no budget detail and no budget read, and a session only its own calls left", async () => {
  await withApp({}, async (app, google) => {
    const firestoreReads = () => google.firestore.calls.filter((call) => call.method === "GET").length;
    const status = (headers = {}) => fetch(`${app.url}/api/status`, { headers: { "X-Forwarded-For": "203.0.113.90", ...headers } });

    const before = firestoreReads();
    for (const headers of [{}, { Cookie: "__Host-ustaad-demo=forged.token" }]) {
      const response = await status(headers);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = await response.json();
      assert.deepEqual(Object.keys(body).sort(),
        ["app", "authorizationMode", "backendReachable", "executionMode", "mode", "modelAcceptance", "ok", "status"]);
      assert.equal(body.modelAcceptance.models.length, 5);
      const { modelAcceptance: _scores, ...rest } = body;
      assert.doesNotMatch(JSON.stringify(rest), /limit|cap|reserve|spend|cost|remaining|counter/i);
    }
    assert.equal(firestoreReads(), before);

    const session = cookieOf(await app.post("/api/auth/demo-session", { ip: "203.0.113.91" }));
    const afterMint = firestoreReads();
    const first = await (await status({ Cookie: session })).json();
    assert.deepEqual(first.runtimeAvailability.geminiBudget,
      { policy: "budget-v2", configured: true, status: "configured", available: true, callsLeftToday: 40 });
    assert.doesNotMatch(JSON.stringify(first), /dayLimit|ipDayLimit|CostCap|costInr|reserveUnits|"remaining"|"limits"/);
    assert.equal("limit" in first.runtimeAvailability.dailyGeminiCallCap, false);
    assert.equal(first.modelAcceptance.models.length, 5);
    const oneRead = firestoreReads() - afterMint;
    assert.ok(oneRead > 0);
    await status({ Cookie: session });
    assert.equal(firestoreReads() - afterMint, oneRead, "a second call inside the cache window reads nothing");
  });
});
