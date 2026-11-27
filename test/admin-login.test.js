import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createAdminLogin, createAdminSession, hashPassword, MAX_FAILURES, FAILURE_WINDOW_MS } from "../src/admin-login.js";
import { startIndexServer } from "./helpers/server.js";

const PASSWORD = "correct horse battery staple";

test("is off unless both settings are present and well formed", async () => {
  const hash = await hashPassword(PASSWORD);
  assert.equal(createAdminLogin({}).configured, false);
  assert.equal(createAdminLogin({ email: "admin@plant.in" }).configured, false);
  assert.equal(createAdminLogin({ passwordHash: hash }).configured, false);
  assert.equal(createAdminLogin({ email: "not-an-email", passwordHash: hash }).configured, false);
  assert.equal(createAdminLogin({ email: "admin@plant.in", passwordHash: "plain-text-password" }).configured, false);
  assert.equal(createAdminLogin({ email: "admin@plant.in", passwordHash: hash }).configured, true);
  const off = await createAdminLogin({}).verify({ email: "admin@plant.in", password: PASSWORD, clientKey: "k" });
  assert.equal(off.status, 404);
});

test("accepts the right credentials and refuses wrong ones with the same answer", async () => {
  const login = createAdminLogin({ email: "Admin@Plant.in", passwordHash: await hashPassword(PASSWORD) });
  const good = await login.verify({ email: "admin@plant.in", password: PASSWORD, clientKey: "k" });
  assert.deepEqual(good, { ok: true, email: "admin@plant.in" });
  const wrongPassword = await login.verify({ email: "admin@plant.in", password: "nope-nope-nope", clientKey: "k" });
  const wrongEmail = await login.verify({ email: "other@plant.in", password: PASSWORD, clientKey: "k" });
  assert.equal(wrongPassword.status, 401);
  assert.deepEqual(wrongEmail, wrongPassword);
  for (const bad of [{ email: 1, password: PASSWORD }, { email: "admin@plant.in", password: "" }, { email: "admin@plant.in", password: "x".repeat(257) }]) {
    assert.equal((await login.verify({ ...bad, clientKey: "k" })).status, 400);
  }
});

test("blocks a client after repeated failures, and only for the window", async () => {
  let time = 1_000_000;
  const login = createAdminLogin({ email: "admin@plant.in", passwordHash: await hashPassword(PASSWORD), now: () => time });
  for (let i = 0; i < MAX_FAILURES; i += 1) {
    assert.equal((await login.verify({ email: "admin@plant.in", password: "wrong-wrong", clientKey: "a" })).status, 401);
  }
  assert.equal((await login.verify({ email: "admin@plant.in", password: PASSWORD, clientKey: "a" })).status, 429);
  assert.equal((await login.verify({ email: "admin@plant.in", password: PASSWORD, clientKey: "b" })).ok, true);
  time += FAILURE_WINDOW_MS + 1;
  assert.equal((await login.verify({ email: "admin@plant.in", password: PASSWORD, clientKey: "a" })).ok, true);
});

test("the HTTP route issues the session cookie only for the right password, same origin, with the feature on", async () => {
  const passwordHash = await hashPassword(PASSWORD);
  const base = { PATH: process.env.PATH, USTAAD_AUTHORIZATION_MODE: "HACKATHON_DEMO", USTAAD_DEMO_SESSION_SIGNING_KEY: "a".repeat(64), USTAAD_ENABLE_APPROVAL_AUDIT: "true", USTAAD_SYNTHETIC_ONLY: "true" };
  const post = (origin, body, headers = { Origin: origin }) => fetch(`${origin}/api/auth/admin-login`, {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
  });

  const off = await startIndexServer(base);
  try {
    const origin = `http://127.0.0.1:${off.port}`;
    const response = await post(origin, { email: "admin@plant.in", password: PASSWORD });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, "ADMIN_LOGIN_NOT_ENABLED");
  } finally {
    if (off.child.exitCode === null) { const exited = once(off.child, "exit"); off.child.kill("SIGTERM"); await exited; }
  }

  const on = await startIndexServer({ ...base, MOMENTUM_ADMIN_EMAIL: "admin@plant.in", MOMENTUM_ADMIN_PASSWORD_HASH: passwordHash });
  try {
    const origin = `http://127.0.0.1:${on.port}`;
    const wrong = await post(origin, { email: "admin@plant.in", password: "wrong-wrong-wrong" });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.headers.get("set-cookie"), null);
    const crossOrigin = await post(origin, { email: "admin@plant.in", password: PASSWORD }, { Origin: "https://evil.example" });
    assert.equal(crossOrigin.status, 403);
    const ok = await post(origin, { email: "admin@plant.in", password: PASSWORD });
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get("set-cookie"), /__Host-ustaad-demo=.*HttpOnly/);
    assert.equal((await ok.json()).user.email, "admin@plant.in");
    const login = await fetch(`${origin}/login`);
    assert.equal(login.status, 200);
    assert.match(await login.text(), /Sign in/);
  } finally {
    if (on.child.exitCode === null) { const exited = once(on.child, "exit"); on.child.kill("SIGTERM"); await exited; }
  }
});

test("the admin session cookie is signed, expires and cannot be forged or reused across keys", () => {
  let time = 5_000_000;
  const session = createAdminSession({ key: "b".repeat(64), now: () => time });
  const token = session.issue("admin@plant.in");
  assert.deepEqual(session.verify(token), { email: "admin@plant.in" });
  const [payload] = token.split(".");
  assert.equal(session.verify(`${payload}.${"A".repeat(43)}`), undefined);
  assert.equal(session.verify(token + ".x"), undefined);
  assert.equal(session.verify("garbage"), undefined);
  assert.equal(session.verify(undefined), undefined);
  assert.equal(createAdminSession({ key: "c".repeat(64), now: () => time }).verify(token), undefined);
  time += session.maxAge * 1000 + 1;
  assert.equal(session.verify(token), undefined);
});

test("/app/ needs a sign-in once the admin login is on, and stays open when no sign-in is set up", async () => {
  const passwordHash = await hashPassword(PASSWORD);
  const base = { PATH: process.env.PATH, USTAAD_AUTHORIZATION_MODE: "HACKATHON_DEMO", USTAAD_DEMO_SESSION_SIGNING_KEY: "a".repeat(64), USTAAD_ENABLE_APPROVAL_AUDIT: "true", USTAAD_SYNTHETIC_ONLY: "true" };
  const stop = async ({ child }) => { if (child.exitCode === null) { const exited = once(child, "exit"); child.kill("SIGTERM"); await exited; } };

  const open = await startIndexServer(base);
  try {
    const response = await fetch(`http://127.0.0.1:${open.port}/app/`, { redirect: "manual" });
    assert.notEqual(response.status, 302);
    assert.notEqual(response.headers.get("location"), "/login");
  } finally { await stop(open); }

  const gated = await startIndexServer({ ...base, MOMENTUM_ADMIN_EMAIL: "admin@plant.in", MOMENTUM_ADMIN_PASSWORD_HASH: passwordHash });
  try {
    const origin = `http://127.0.0.1:${gated.port}`;
    for (const path of ["/app", "/app/", "/app/#/plant", "/app/some/deep/path"]) {
      const response = await fetch(origin + path, { redirect: "manual" });
      if (path === "/app") { assert.equal(response.status, 301); continue; }
      assert.equal(response.status, 302, path);
      assert.equal(response.headers.get("location"), "/login", path);
    }
    const direct = await fetch(`${origin}/app/index.html`, { redirect: "manual" });
    assert.equal(direct.status, 302, "the shell file is reachable only through the gate");
    assert.equal(direct.headers.get("location"), "/login");
    const forged = await fetch(`${origin}/app/`, { redirect: "manual", headers: { Cookie: "__Host-momentum-admin=e30.AAAA" } });
    assert.equal(forged.headers.get("location"), "/login");
    const demoOnly = await fetch(`${origin}/api/auth/demo-session`, { method: "POST", headers: { Origin: origin } });
    assert.equal(demoOnly.status, 401, "a demo session cannot be minted without signing in");
    assert.equal((await demoOnly.json()).error.code, "SIGN_IN_REQUIRED");
    assert.equal(demoOnly.headers.get("set-cookie"), null);
    const signedIn = await fetch(`${origin}/api/auth/admin-login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ email: "admin@plant.in", password: PASSWORD }) });
    const cookies = signedIn.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
    assert.match(signedIn.headers.getSetCookie().join("\n"), /__Host-momentum-admin=.*HttpOnly/);
    const allowed = await fetch(`${origin}/app/`, { redirect: "manual", headers: { Cookie: cookies } });
    assert.notEqual(allowed.status, 302);
    assert.notEqual(allowed.headers.get("location"), "/login");
    const sessionAllowed = await fetch(`${origin}/api/auth/demo-session`, { method: "POST", headers: { Origin: origin, Cookie: cookies } });
    assert.equal(sessionAllowed.status, 200);
    const out = await fetch(`${origin}/api/auth/logout`, { method: "POST", headers: { Origin: origin } });
    const cleared = out.headers.getSetCookie().join("\n");
    assert.match(cleared, /__Host-momentum-admin=;/);
    assert.match(cleared, /__Host-ustaad-demo=;/);
  } finally { await stop(gated); }
});

test("a password-hash setting with an unusable cost leaves the login off instead of failing on every attempt", async () => {
  const good = await hashPassword(PASSWORD);
  const [, , salt, key] = good.split("$");
  for (const cost of ["3", "16383", "32769", "1048576", "0"]) {
    assert.equal(createAdminLogin({ email: "admin@plant.in", passwordHash: `scrypt$${cost}$${salt}$${key}` }).configured, false, cost);
  }
});

test("with Google sessions on, the password route answers 409, no admin cookie opens /app/, and a Google-less visitor is sent to sign in", async () => {
  const env = { PATH: process.env.PATH, USTAAD_AUTH_MODE: "FIREBASE_SESSION", PROJECT_ID: "momentum-test", USTAAD_USER_ROLES: "owner@plant.in:manager",
    USTAAD_FIREBASE_WEB_API_KEY: "A".repeat(30), USTAAD_FIREBASE_AUTH_DOMAIN: "momentum-test.firebaseapp.com", USTAAD_FIREBASE_WEB_APP_ID: "1:514663464609:web:abcdef",
    USTAAD_SYNTHETIC_ONLY: "true", MOMENTUM_ADMIN_EMAIL: "admin@plant.in", MOMENTUM_ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD) };
  const server = await startIndexServer(env);
  try {
    const origin = `http://127.0.0.1:${server.port}`;
    const response = await fetch(`${origin}/api/auth/admin-login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ email: "admin@plant.in", password: PASSWORD }) });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "ADMIN_LOGIN_NOT_AVAILABLE");
    assert.equal(response.headers.getSetCookie().length, 0);
    const { createAdminSession } = await import("../src/admin-login.js");
    const stale = createAdminSession({ key: "a".repeat(64) }).issue("admin@plant.in");
    const withAdminCookie = await fetch(`${origin}/app/`, { redirect: "manual", headers: { Cookie: `__Host-momentum-admin=${stale}` } });
    assert.equal(withAdminCookie.status, 302);
    assert.equal(withAdminCookie.headers.get("location"), "/login");
    const noCookie = await fetch(`${origin}/app/`, { redirect: "manual" });
    assert.equal(noCookie.headers.get("location"), "/login");
    const config = await (await fetch(`${origin}/api/auth/config`)).json();
    assert.equal(config.enabled, true);
  } finally {
    if (server.child.exitCode === null) { const exited = once(server.child, "exit"); server.child.kill("SIGTERM"); await exited; }
  }
});
