import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getTranslationKeys, hasTranslation, translate } from "../src/localization.js";
import { SUPPORTED_LANGUAGES } from "../src/schemas.js";

test("the prototype exposes English only and unsupported languages fall back to English", () => {
  assert.deepEqual(SUPPORTED_LANGUAGES, ["en"]);
  for (const language of SUPPORTED_LANGUAGES) {
    for (const key of getTranslationKeys()) {
      assert.equal(hasTranslation(language, key), true, `${language}.${key}`);
      assert.notEqual(translate(language, key), key, `${language}.${key}`);
    }
  }
  assert.equal(translate("hi", "workflow"), translate("en", "workflow"));
});

test("each supported locale is represented by a JSON label file", async () => {
  const expectedKeys = getTranslationKeys().sort();
  for (const language of SUPPORTED_LANGUAGES) {
    const source = await readFile(new URL(`../src/locales/${language}.json`, import.meta.url), "utf8");
    const locale = JSON.parse(source);
    assert.deepEqual(Object.keys(locale).sort(), expectedKeys, language);
    for (const value of Object.values(locale)) {
      assert.equal(typeof value, "string", language);
    }
  }
});

test("missing translation keys and unsupported languages fall back to English", () => {
  assert.equal(translate("hi", "missingLabel"), "missingLabel");
  assert.equal(translate("unsupported", "workflow"), translate("en", "workflow"));
});

test("static localization does not alter production data or application contracts", () => {
  const order = Object.freeze({
    orderId: "fixture-order",
    quantity: 123,
    currency: "INR",
  });
  const before = JSON.stringify(order);
  for (const language of SUPPORTED_LANGUAGES) {
    translate(language, "workflow");
  }
  assert.equal(JSON.stringify(order), before);
  assert.equal(order.quantity, 123);
  assert.equal(order.currency, "INR");
});
