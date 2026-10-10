import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import test from "node:test";

const PORT = 4100;

async function startServer() {
  const child = spawn(process.execPath, ["index.mjs"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const [startupMessage] = await once(child.stdout, "data");
  const message = startupMessage.toString();

  return { child, startupMessage: message.trim() };
}

test("health endpoint returns ok", async () => {
  const { child, startupMessage } = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/health`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.mode, "local-development");
    assert.match(startupMessage, /http:\/\/localhost:/i);
  } finally {
    child.kill("SIGTERM");
  }
});

test("status endpoint documents local mock mode", async () => {
  const { child } = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/status`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.app, "Ustaad AI");
    assert.equal(payload.mode, "local-development");
    assert.equal(payload.isRealModelPrediction, false);
  } finally {
    child.kill("SIGTERM");
  }
});

test("extract order endpoint validates and returns mock payload", async () => {
  const { child } = await startServer();

  try {
    const payload = {
      orderId: "PO-2048",
      customerId: "CUST-418",
      boxStyle: "RSC",
      lengthMm: 520,
      widthMm: 360,
      heightMm: 260,
      ply: 3,
      fluteProfile: "B",
      topLinerGsm: 125,
      fluteGsm: 115,
      innerLinerGsm: 125,
      linerBf: 18,
      paperType: "Kraft",
      paperSupplier: "Navy Papers",
      inkColors: 4,
      inkCoveragePct: 52,
      quantity: 1200,
    };

    const response = await fetch(`http://127.0.0.1:${PORT}/api/agents/extractOrder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.ok, true);
    assert.equal(result.agent, "extractOrder");
    assert.equal(result.source, "mock-demo");
    assert.equal(result.isRealModelPrediction, false);
  } finally {
    child.kill("SIGTERM");
  }
});
