import assert from "node:assert/strict";
import test from "node:test";
import { createWeatherCache, readWeather, WEATHER_CACHE_TTL_MS } from "../src/commands/read-weather.js";

const reading = (ambientRhPct) => ({
  ok: true, source: "google-maps-weather", ambientRhPct, ambientTempC: 24, observedAt: "2026-11-20T06:00:00Z",
});

function fakeProvider(results) {
  const calls = [];
  const provider = async (input) => {
    calls.push(input);
    const next = results.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { provider, calls };
}

test("weather is unavailable without a configured provider", async () => {
  assert.deepEqual(await readWeather({}, { weatherProvider: undefined, weatherCache: createWeatherCache(), now: () => 0 }), {
    ok: false, status: 503, error: { code: "SERVICE_UNAVAILABLE", message: "Live weather is not configured." },
  });
});

test("a reading is served from the cache for ten minutes, then refreshed", async () => {
  let clock = 1_000;
  const { provider, calls } = fakeProvider([reading(61), reading(70)]);
  const deps = { weatherProvider: provider, weatherCache: createWeatherCache(), now: () => clock, signal: "request-signal" };

  assert.deepEqual(await readWeather({}, deps), { ...reading(61), location: "Pune" });
  clock += WEATHER_CACHE_TTL_MS;
  assert.equal((await readWeather({}, deps)).ambientRhPct, 61);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].signal, "request-signal");

  clock += 1;
  assert.equal((await readWeather({}, deps)).ambientRhPct, 70);
  assert.equal(calls.length, 2);
});

test("a failed refresh keeps serving the last good reading", async () => {
  let clock = 0;
  const { provider } = fakeProvider([reading(55), new Error("network"), { ok: false }]);
  const deps = { weatherProvider: provider, weatherCache: createWeatherCache(), now: () => clock };
  await readWeather({}, deps);
  clock += WEATHER_CACHE_TTL_MS + 1;
  assert.equal((await readWeather({}, deps)).ambientRhPct, 55);
  assert.equal((await readWeather({}, deps)).ambientRhPct, 55);
});

test("a first reading that fails reports unavailable and caches nothing", async () => {
  const { provider } = fakeProvider([new Error("network"), reading(48)]);
  const deps = { weatherProvider: provider, weatherCache: createWeatherCache(), now: () => 0 };
  assert.deepEqual(await readWeather({}, deps), {
    ok: false, status: 503, error: { code: "SERVICE_UNAVAILABLE", message: "Live weather is unavailable right now." },
  });
  assert.equal((await readWeather({}, deps)).ambientRhPct, 48);
});
