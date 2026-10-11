import en from "./locales/en.json" with { type: "json" };
import hi from "./locales/hi.json" with { type: "json" };
import mr from "./locales/mr.json" with { type: "json" };
import ja from "./locales/ja.json" with { type: "json" };
import ko from "./locales/ko.json" with { type: "json" };
import zhCN from "./locales/zh-CN.json" with { type: "json" };
import id from "./locales/id.json" with { type: "json" };

const messages = Object.freeze({
  en,
  hi,
  mr,
  ja,
  ko,
  "zh-CN": zhCN,
  id,
});

export function translate(language, key) {
  const locale = Object.hasOwn(messages, language) ? language : "en";
  return messages[locale]?.[key] ?? messages.en[key] ?? key;
}

export function hasTranslation(language, key) {
  return Object.hasOwn(messages, language) &&
    Object.hasOwn(messages[language], key);
}

export function getTranslationKeys() {
  return Object.keys(messages.en);
}
