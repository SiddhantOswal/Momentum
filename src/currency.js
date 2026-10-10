export const SUPPORTED_CURRENCIES = [
  "INR",
  "JPY",
  "KRW",
  "CNY",
  "IDR",
  "SGD",
  "AUD",
  "THB",
  "PHP",
  "MYR",
  "USD",
];

export function formatMoney(value, currency = "INR", locale = "en-IN") {
  if (!Number.isFinite(value)) {
    throw new Error("Money value must be a finite number.");
  }

  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new Error(`Unsupported currency: ${currency}`);
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(value);
}