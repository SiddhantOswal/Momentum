import { readFile } from "node:fs/promises";
import {
  FxProviderSnapshotSchema,
  FxRatesResponseSchema,
  LaunchCurrencySchema,
  SUPPORTED_CURRENCIES,
} from "./schemas.js";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROVIDER_URL =
  "https://api.frankfurter.dev/v1/latest?base=INR&symbols=" +
  encodeURIComponent(SUPPORTED_CURRENCIES.filter((currency) => currency !== "INR").join(","));

async function readStaticFallback() {
  const text = await readFile(new URL("./fx-fallback.json", import.meta.url), "utf8");
  return FxProviderSnapshotSchema.parse(JSON.parse(text));
}

export function createFxRatesService({
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  loadFallback = readStaticFallback,
} = {}) {
  let cachedSnapshot;
  let refreshPromise;

  async function loadSnapshot() {
    if (cachedSnapshot && cachedSnapshot.expiresAt > now()) {
      return cachedSnapshot;
    }
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      let snapshot;
      let source;

      try {
        const response = await fetchImpl(PROVIDER_URL, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Frankfurter returned HTTP ${response.status}.`);
        }

        snapshot = FxProviderSnapshotSchema.parse(await response.json());
        source = "frankfurter";
      } catch (providerError) {
        try {
          snapshot = FxProviderSnapshotSchema.parse(await loadFallback());
          source = "static-fallback";
        } catch (fallbackError) {
          throw new AggregateError(
            [providerError, fallbackError],
            "Frankfurter rates and the static FX fallback are unavailable."
          );
        }
      }

      const requiredCurrencies = SUPPORTED_CURRENCIES.filter(
        (currency) => currency !== "INR"
      );
      const missingCurrencies = requiredCurrencies.filter(
        (currency) => snapshot.rates[currency] === undefined
      );
      if (missingCurrencies.length > 0) {
        throw new Error(
          `FX rates are missing supported currencies: ${missingCurrencies.join(", ")}.`
        );
      }

      cachedSnapshot = {
        snapshot,
        source,
        expiresAt: now() + CACHE_TTL_MS,
      };
      return cachedSnapshot;
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = undefined;
    }
  }

  return Object.freeze({
    async getRates(base = "INR") {
      const validBase = LaunchCurrencySchema.parse(base);
      const { snapshot, source } = await loadSnapshot();
      const baseRate = validBase === "INR" ? 1 : snapshot.rates[validBase];
      const rates = Object.fromEntries(
        SUPPORTED_CURRENCIES.map((currency) => {
          const rate = currency === "INR" ? 1 / baseRate : snapshot.rates[currency] / baseRate;
          return [currency, Number(rate.toPrecision(12))];
        })
      );
      rates[validBase] = 1;

      return FxRatesResponseSchema.parse({
        base: validBase,
        date: snapshot.date,
        rates,
        source,
      });
    },
  });
}

export const fxRatesService = createFxRatesService();
