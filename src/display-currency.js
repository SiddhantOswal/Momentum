const localeByLanguage = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
  ja: "ja-JP",
  ko: "ko-KR",
  "zh-CN": "zh-CN",
  id: "id-ID",
};

const DEFAULT_MAX_RATE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function formatDisplayCurrency({
  amount,
  from,
  to,
  language,
  rates,
  now = Date.now(),
  maxRateAgeMs = DEFAULT_MAX_RATE_AGE_MS,
}) {
  if (!Number.isFinite(amount)) {
    throw new Error("Enter a finite amount to convert.");
  }
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    throw new Error("Select supported three-letter currency codes.");
  }

  const locale = localeByLanguage[language];
  if (!locale) {
    throw new Error("Select a supported language for number formatting.");
  }
  if (!rates?.rates ||
      !Object.hasOwn(rates.rates, from) ||
      !Object.hasOwn(rates.rates, to)) {
    throw new Error("The FX response does not contain the selected currencies.");
  }
  if (!rates || rates.base !== from) {
    throw new Error("The FX response does not match the selected source currency.");
  }
  const observedAt = Date.parse(`${rates.date ?? ""}T00:00:00Z`);
  if (!Number.isFinite(observedAt) ||
      new Date(observedAt).toISOString().slice(0, 10) !== rates.date) {
    throw new Error("The FX response is missing its rate date.");
  }
  if (!Number.isFinite(now) || !Number.isFinite(maxRateAgeMs) || maxRateAgeMs < 0) {
    throw new Error("FX staleness settings must be finite and non-negative.");
  }
  if (observedAt > now) {
    throw new Error("The FX response date is in the future.");
  }
  if (!["frankfurter", "static-fallback"].includes(rates.source)) {
    throw new Error("The FX response has an unsupported rate source.");
  }

  const rate = rates.rates?.[to];
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("The FX response does not contain a rate for the selected currency.");
  }

  const convertedAmount = amount * rate;
  if (!Number.isFinite(convertedAmount)) {
    throw new Error("The converted amount is outside the supported numeric range.");
  }

  return {
    original: new Intl.NumberFormat(locale, {
      style: "currency",
      currency: from,
    }).format(amount),
    converted: new Intl.NumberFormat(locale, {
      style: "currency",
      currency: to,
    }).format(convertedAmount),
    rate: new Intl.NumberFormat(locale, {
      maximumSignificantDigits: 6,
    }).format(rate),
    date: rates.date,
    source: rates.source,
    stale: now - observedAt > maxRateAgeMs,
  };
}
