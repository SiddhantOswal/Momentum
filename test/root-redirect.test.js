import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { startIndexServer } from "./helpers/server.js";

async function serve(extra) {
  const { child, port } = await startIndexServer({ PATH: process.env.PATH, ...extra });
  return { origin: `http://127.0.0.1:${port}`, stop: async () => { child.kill(); await once(child, "exit"); } };
}

test("the root serves the old dashboard unless the app redirect is switched on", async () => {
  const { origin, stop } = await serve({});
  try {
    const response = await fetch(origin + "/", { redirect: "manual" });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
  } finally { await stop(); }
});

test("USTAAD_ROOT_REDIRECT_TO_APP sends the root to /app/ and keeps the query string", async () => {
  const { origin, stop } = await serve({ USTAAD_ROOT_REDIRECT_TO_APP: "true" });
  try {
    const response = await fetch(origin + "/?lot=LOT-1", { redirect: "manual" });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "/app/?lot=LOT-1");
    assert.equal((await fetch(origin + "/app/", { redirect: "manual" })).status, 200);
  } finally { await stop(); }
});
