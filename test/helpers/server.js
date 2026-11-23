import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const STARTUP_TIMEOUT_MS = 10000;
const MAX_ATTEMPTS = 3;

const started = new Set();
let generation = 0;

// Lets a test's cleanup hook stop every child the helper spawned, including
// ones whose startup never completed and so were never handed to the test.
// Starts still in their retry loop are abandoned so they cannot respawn.
export async function stopAllStarted() {
  generation += 1;
  await Promise.all([...started].map(async (child) => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
    started.delete(child);
  }));
}

export async function freePort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

// The OS can hand the port to another process between freePort() and the
// child binding it, so a child that exits before printing is retried on a new port.
async function attempt(env, timeoutMs, entry) {
  const port = await freePort();
  const child = spawn(process.execPath, [entry], {
    cwd: ROOT,
    env: { ...env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  started.add(child);
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  let timer;
  const outcome = await Promise.race([
    once(child.stdout, "data").then(([data]) => ({ ok: true, data })),
    once(child, "exit").then(([code, signal]) => ({ ok: false, reason: `exited before startup (code ${code}, signal ${signal})` })),
    new Promise((resolve) => { timer = setTimeout(() => resolve({ ok: false, reason: `no startup output within ${timeoutMs} ms` }), timeoutMs); }),
  ]);
  clearTimeout(timer);
  if (outcome.ok) return { child, port, startupMessage: outcome.data.toString().trim() };
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
  }
  return { failure: `port ${port}: ${outcome.reason}${stderr ? `: ${stderr.trim().slice(0, 500)}` : ""}` };
}

export async function startIndexServer(env, { timeoutMs = STARTUP_TIMEOUT_MS, entry = "index.mjs" } = {}) {
  const failures = [];
  const startGeneration = generation;
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    if (generation !== startGeneration) throw new Error("Backend start abandoned: helper was stopped");
    const result = await attempt(env, timeoutMs, entry);
    if (result.child) return result;
    failures.push(result.failure);
  }
  throw new Error(`Backend failed to start after ${MAX_ATTEMPTS} attempts: ${failures.join("; ")}`);
}
