import assert from "node:assert/strict";
import test from "node:test";
import { formatDisplayCurrency } from "../src/display-currency.js";

const rates = {
  base: "INR",
  date: "2026-10-09",
  rates: {
    INR: 1,
    JPY: 1.636,
    USD: 0.01034,
  },
  source: "frankfurter",
};

test("display conversion uses the requested dated rate and locale without changing the source amount", () => {
  const result = formatDisplayCurrency({
    amount: 1000,
    from: "INR",
    to: "JPY",
    language: "ja",
    rates,
  });

  assert.equal(result.original, new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "INR",
  }).format(1000));
  assert.equal(result.converted, new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(1636));
  assert.equal(result.rate, new Intl.NumberFormat("ja-JP", {
    maximumSignificantDigits: 6,
  }).format(1.636));
  assert.equal(result.date, "2026-10-09");
  assert.equal(result.source, "frankfurter");
  assert.equal(rates.rates.INR, 1);
});

test("display conversion preserves static-fallback provenance and supports zero amounts", () => {
  const result = formatDisplayCurrency({
    amount: 0,
    from: "INR",
    to: "USD",
    language: "en",
    rates: { ...rates, source: "static-fallback" },
  });

  assert.equal(result.converted, new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "USD",
  }).format(0));
  assert.equal(result.source, "static-fallback");
  assert.equal(result.date, "2026-10-09");
});

test("display conversion identifies stale dated rates and rejects future dates", () => {
  const now = Date.parse("2026-10-20T00:00:00Z");
  const stale = formatDisplayCurrency({
    amount: 100,
    from: "INR",
    to: "USD",
    language: "en",
    rates,
    now,
  });
  assert.equal(stale.stale, true);
  assert.throws(() => formatDisplayCurrency({
    amount: 100,
    from: "INR",
    to: "USD",
    language: "en",
    rates: { ...rates, date: "2026-10-21" },
    now,
  }), /future/);
});

test("display conversion rejects invalid amounts, preferences and FX responses", () => {
  const input = {
    amount: 1,
    from: "INR",
    to: "USD",
    language: "en",
    rates,
  };

  assert.throws(() => formatDisplayCurrency({ ...input, amount: Number.NaN }), /finite amount/);
  assert.throws(() => formatDisplayCurrency({ ...input, from: "IN1" }), /three-letter currency/);
  assert.throws(() => formatDisplayCurrency({ ...input, to: "EUR" }), /selected currencies/);
  assert.throws(() => formatDisplayCurrency({ ...input, language: "xx" }), /supported language/);
  assert.throws(() => formatDisplayCurrency({
    ...input,
    rates: { ...rates, base: "USD" },
  }), /does not match/);
  assert.throws(() => formatDisplayCurrency({
    ...input,
    rates: { ...rates, rates: { INR: 1 } },
  }), /does not contain the selected currencies/);
  assert.throws(() => formatDisplayCurrency({
    ...input,
    rates: { ...rates, date: "undated" },
  }), /missing its rate date/);
  assert.throws(() => formatDisplayCurrency({
    ...input,
    rates: { ...rates, date: "2026-02-30" },
  }), /missing its rate date/);
});
