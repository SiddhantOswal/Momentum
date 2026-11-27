import assert from "node:assert/strict";
import test from "node:test";
import weatherConfig from "../config/weather.json" with { type: "json" };
import { createWeatherProvider, createWeatherProviderFromEnv } from "../src/google-cloud/weather-service.js";

const TEST_KEY = "test-only-weather-key";

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

// Shape of a real current-conditions response for the Pune plant location.
const sampleBody = {
  currentTime: "2026-11-19T21:02:17.248Z",
  relativeHumidity: 65,
  temperature: { unit: "CELSIUS", degrees: 17.8 },
  weatherCondition: { type: "CLEAR", description: { text: "Clear" } },
};

test("weather provider is disabled unless WEATHER_API_KEY is set", () => {
  assert.equal(createWeatherProviderFromEnv({}), undefined);
  assert.equal(createWeatherProviderFromEnv({ WEATHER_API_KEY: "  " }), undefined);
  assert.equal(typeof createWeatherProviderFromEnv({ WEATHER_API_KEY: TEST_KEY }, { fetchImpl: async () => jsonResponse(sampleBody) }), "function");
  assert.throws(() => createWeatherProvider({}), /weather API key is required/);
});

test("weather provider calls the current-conditions endpoint for the configured plant location", async () => {
  const requests = [];
  const provider = createWeatherProvider({
    apiKey: TEST_KEY,
    fetchImpl: async (url, init) => { requests.push({ url, init }); return jsonResponse(sampleBody); },
  });
  const result = await provider();
  assert.deepEqual(result, {
    ok: true,
    source: "google-maps-weather",
    ambientRhPct: 65,
    ambientTempC: 17.8,
    observedAt: "2026-11-19T21:02:17.248Z",
  });
  assert.equal(requests.length, 1);
  const url = new URL(requests[0].url);
  assert.equal(`${url.origin}${url.pathname}`, "https://weather.googleapis.com/v1/currentConditions:lookup");
  assert.equal(url.searchParams.get("location.latitude"), String(weatherConfig.location.latitude));
  assert.equal(url.searchParams.get("location.longitude"), String(weatherConfig.location.longitude));
  assert.equal(url.searchParams.get("unitsSystem"), "METRIC");
  // The key goes in a header, never in the URL.
  assert.equal(url.searchParams.has("key"), false);
  assert.equal(requests[0].url.includes(TEST_KEY), false);
  assert.equal(requests[0].init.headers["X-Goog-Api-Key"], TEST_KEY);
  assert.equal(requests[0].init.method, "GET");
  assert.ok(requests[0].init.signal instanceof AbortSignal);
});

test("weather provider reports unavailable for HTTP errors, network errors and unexpected bodies", async () => {
  const cases = [
    async () => jsonResponse({ error: { code: 403 } }, { ok: false, status: 403 }),
    async () => { throw new TypeError("fetch failed"); },
    async () => jsonResponse({ ...sampleBody, relativeHumidity: 140 }),
    async () => jsonResponse({ temperature: { degrees: 20 } }),
    // Fahrenheit or a missing unit is rejected rather than misread as Celsius.
    async () => jsonResponse({ ...sampleBody, temperature: { unit: "FAHRENHEIT", degrees: 64 } }),
    async () => jsonResponse({ ...sampleBody, temperature: { degrees: 17.8 } }),
    async () => jsonResponse({ relativeHumidity: 65, temperature: { unit: "CELSIUS", degrees: 17.8 } }),
    async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad json"); } }),
  ];
  for (const fetchImpl of cases) {
    const result = await createWeatherProvider({ apiKey: TEST_KEY, fetchImpl })();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  }
});

test("weather provider rethrows when the caller cancels", async () => {
  const controller = new AbortController();
  const provider = createWeatherProvider({
    apiKey: TEST_KEY,
    fetchImpl: async (_url, init) => {
      controller.abort();
      throw init.signal.reason ?? new DOMException("Aborted", "AbortError");
    },
  });
  await assert.rejects(provider({ signal: controller.signal }), { name: "AbortError" });
});

test("weather provider times out to unavailable instead of hanging", async () => {
  const provider = createWeatherProvider({
    apiKey: TEST_KEY,
    timeoutMs: 5,
    fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    }),
  });
  // The mocked fetch has no socket to keep Node alive while the abort timer runs.
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Weather provider did not settle")), 1000);
  });
  try {
    const result = await Promise.race([provider(), deadline]);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
});
