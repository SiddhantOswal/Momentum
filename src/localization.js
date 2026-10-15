import en from "./locales/en.json" with { type: "json" };
// English is the only enabled prototype locale. Do not import disabled locale
// URLs: the server correctly rejects them, which otherwise blocks module startup.
const messages = Object.freeze({ en });

export function translate(language, key) {
  return messages.en[key] ?? key;
}

export function hasTranslation(language, key) {
  return language === "en" && Object.hasOwn(messages.en, key);
}

export function getTranslationKeys() {
  return Object.keys(messages.en);
}
