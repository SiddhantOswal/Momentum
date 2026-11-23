import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:net";
import test from "node:test";
import { freePort, startIndexServer } from "./helpers/server.js";

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await exited;
}

test("concurrent servers get distinct ports and both answer", async () => {
  const env = { PATH: process.env.PATH };
  const servers = await Promise.all([startIndexServer(env), startIndexServer(env)]);
  try {
    assert.notEqual(servers[0].port, servers[1].port);
    for (const { port } of servers) {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      assert.equal(response.status, 200);
    }
  } finally {
    await Promise.all(servers.map(({ child }) => stop(child)));
  }
});

test("freePort does not return a port that is in use", async () => {
  const holder = createServer();
  holder.listen(0, "127.0.0.1");
  await once(holder, "listening");
  try {
    assert.notEqual(await freePort(), holder.address().port);
  } finally {
    holder.close();
  }
});

test("a server that exits before starting fails fast with a clear message", async () => {
  await assert.rejects(
    startIndexServer({ PATH: process.env.PATH }, { entry: "test/helpers/no-such-entry.mjs" }),
    /failed to start after 3 attempts.*exited before startup/,
  );
});

test("a server that never prints fails at the startup timeout", async () => {
  await assert.rejects(
    startIndexServer({ PATH: process.env.PATH }, { entry: "test/helpers/silent-entry.mjs", timeoutMs: 300 }),
    /no startup output within 300 ms/,
  );
});
