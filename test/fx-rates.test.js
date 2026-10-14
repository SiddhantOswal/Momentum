import assert from "node:assert/strict";
import test from "node:test";
import { createFxRatesService } from "../src/fx-rates.js";
import { formatMoney } from "../src/currency.js";
import { FxRatesResponseSchema } from "../src/schemas.js";

const rates = {
  AUD: 0.01481,
  CNY: 0.06918,
  IDR: 184.84,
  JPY: 1.636,
  KRW: 13.8678,
  MYR: 0.04223,
  PHP: 0.64942,
  SGD: 0.01324,
  THB: 0.34662,
  USD: 0.01034,
};

test("FX rates cache the provider snapshot for 24 hours and derive the requested base", async () => {
  let requests = 0;
  let now = Date.parse("2026-10-10T00:00:00.000Z");
  const service = createFxRatesService({
    now: () => now,
    loadFallback: async () => ({ base: "INR", date: "2026-10-09", rates }),
    fetchImpl: async () => {
      requests += 1;
      return new Response(JSON.stringify({ base: "INR", date: "2026-10-09", rates }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const inr = await service.getRates("INR");
  const usd = await service.getRates("USD");
  assert.equal(FxRatesResponseSchema.safeParse(inr).success, true);
  assert.equal(inr.source, "frankfurter");
  assert.equal(inr.rates.INR, 1);
  assert.equal(usd.base, "USD");
  assert.equal(usd.rates.USD, 1);
  assert.equal(requests, 1);

  now += 24 * 60 * 60 * 1000 + 1;
  await service.getRates("JPY");
  assert.equal(requests, 2);
});

test("FX rates use the dated static snapshot if the provider is unavailable", async () => {
  const service = createFxRatesService({
    now: () => Date.parse("2026-10-10T00:00:00.000Z"),
    fetchImpl: async () => {
      throw new Error("Network unavailable in test.");
    },
    loadFallback: async () => ({ base: "INR", date: "2026-10-09", rates }),
  });

  const result = await service.getRates("INR");
  assert.equal(result.source, "static-fallback");
  assert.equal(result.date, "2026-10-09");
  assert.equal(result.rates.USD, rates.USD);
});

test("FX refreshes coalesce concurrent requests into one provider fetch", async () => {
  let requests = 0;
  const service = createFxRatesService({
    now: () => Date.parse("2026-10-10T00:00:00.000Z"),
    fetchImpl: async () => {
      requests += 1;
      await new Promise((resolve) => setTimeout(resolve, 0));
      return new Response(JSON.stringify({ base: "INR", date: "2026-10-09", rates }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
    loadFallback: async () => ({ base: "INR", date: "2026-10-08", rates }),
  });

  const results = await Promise.all([
    service.getRates("INR"),
    service.getRates("USD"),
    service.getRates("JPY"),
  ]);

  assert.equal(requests, 1);
  assert.deepEqual(results.map(({ base }) => base), ["INR", "USD", "JPY"]);
  assert.ok(results.every(({ source }) => source === "frankfurter"));
});

test("FX falls back when the provider responds with a structurally invalid snapshot", async () => {
  const service = createFxRatesService({
    now: () => Date.parse("2026-10-10T00:00:00.000Z"),
    fetchImpl: async () => new Response(JSON.stringify({
      base: "USD",
      date: "2026-10-09",
      rates,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    loadFallback: async () => ({ base: "INR", date: "2026-10-08", rates }),
  });

  const result = await service.getRates("INR");
  assert.equal(result.source, "static-fallback");
  assert.equal(result.date, "2026-10-08");
  assert.equal(result.rates.USD, rates.USD);
});

test("money formatting follows the requested locale and supported currency", () => {
  assert.match(formatMoney(1234567.89, "INR", "en-IN"), /12,34,567/);
  assert.doesNotMatch(formatMoney(1200.5, "JPY", "ja-JP"), /\\.\\d/);
  assert.throws(() => formatMoney(1, "XXX"), /Unsupported currency/);
  assert.throws(() => formatMoney(Number.NaN), /finite number/);
});
