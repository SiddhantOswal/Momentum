import {
  containsCausalClaim, containsUnverifiedOutcomeClaim, sentenceCount, withoutNegatedCausation,
} from "../google-cloud/risk-evidence-service.js";
import { SPEC_CHIPS } from "./answer-labels.js";

/**
 * Checks that run on answer text before it is stored or shown (05 section 5,
 * step 7). Each returns null when the text passes, or one reason code, which is
 * what the turn record and the fallback log keep. The facts are the projected
 * tool results of the same turn, the only source a number or ID may come from.
 */

const MAX_SENTENCES = 3;
const MAX_TEXT = 1200;
// "R2" names the score, it is not an ID; NFKC folds "R²" into it.
const UNIT_WORDS = new Set(["R2", "m2"]);
const DATE = /\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/g;
const TIME = /\b\d{1,2}:\d{2}\b/g;
const WORD = /[\p{L}\p{N}](?:[\p{L}\p{N}_-]*[\p{L}\p{N}])?/gu;
// ".71" is a number too, so a leading dot cannot hide one from the check.
const NUMBER = /(?<![\p{L}\p{N}.,])-?(?:\d[\d,]*(?:\.\d+)?|\.\d+)/gu;
// Digits from other scripts (Devanagari, Arabic-Indic) are not compared, so text with any is rejected.
const OTHER_DIGITS = /(?![0-9])\p{Nd}/u;
// A number written as a word must appear as that word in the facts; the writer is told to use digits.
const NUMBER_WORDS = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakh|crore|million|billion|dozen)\b/giu;
// A number directly followed by one of these units must be a fact value declared with that unit.
const UNIT_AFTER = [["celsius", /^\s?°\s?C/], ["percent", /^\s?%/]];
const GROUPED = /^-?\d{1,3}(?:(?:,\d{3})+|(?:,\d{2})*,\d{3})(?:\.\d+)?$/;
const MARKUP = /[*_`#|<>[\]{}]|^\s*[-•]\s|\n/m;
const NEGATED_STATUS = /\b(?:not|no|never|neither|nor|rather than|instead of)\s+(?:an?\s+|the\s+)?(?:measured|actual|observed)\b/gi;
const STATUS_WORDS = /\b(?:measured|actual(?:ly)?|observed|sav(?:e|ed|es|ing|ings))\b/i;
const VERDICT = /\b(?:pass(?:es|ed|ing)?|fail(?:s|ed|ing)?|meets?|accura(?:te|cy)|(?:above|below)\s+(?:the\s+)?(?:threshold|target|required|pass))\b/i;

const normalize = (text) => String(text).normalize("NFKC").replaceAll("−", "-");

function numberTokens(text) {
  return [...text.matchAll(NUMBER)].flatMap(({ 0: raw, index }) => {
    const token = raw.replace(/,+$/, "");
    const after = text.slice(index + raw.length);
    const unit = UNIT_AFTER.find(([, pattern]) => pattern.test(after))?.[0] ?? null;
    const parts = token.includes(",") && !GROUPED.test(token) ? token.split(",").filter(Boolean) : [token];
    return parts.map((part, position) => {
      const plain = part.replaceAll(",", "");
      return {
        raw: plain, value: Number(plain), decimals: plain.split(".")[1]?.length ?? 0,
        unit: position === parts.length - 1 ? unit : null,
      };
    });
  });
}

function unitClass(unit) {
  if (/°\s?C/.test(unit)) return "celsius";
  return /%|percentage point/.test(unit) ? "percent" : null;
}

// Session job and lot IDs and UUIDs are hex and can, by chance, hold no digit.
const ID_SHAPE = /^(?:(?:JOB|LOT)-HACK-|[0-9a-f]{8}-[0-9a-f]{4}-)/i;

function isIdLike(word) {
  return ID_SHAPE.test(word) || (/\p{L}/u.test(word) && /\p{N}/u.test(word));
}

/** Every number and string anywhere in the facts, plus the numbers and words inside those strings. */
export function factIndex(facts) {
  const numbers = new Set();
  const strings = [];
  const walk = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) numbers.add(value);
    else if (typeof value === "string") strings.push(normalize(value));
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(facts);
  const words = new Set();
  for (const string of strings) {
    for (const { value } of numberTokens(string)) numbers.add(value);
    for (const [word] of string.matchAll(WORD)) words.add(word);
    words.add(string);
  }
  const labels = [];
  const collectLabels = (value) => {
    if (Array.isArray(value)) value.forEach(collectLabels);
    else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (key === "label" && typeof child === "string") labels.push(child.toLowerCase());
        else collectLabels(child);
      }
    }
  };
  collectLabels(facts);
  // Values declared with a unit, through a "units" map that applies to the keys of its object and
  // everything inside it, or through a { value, unit } pair such as a lot condition.
  const withUnit = { percent: new Set(), celsius: new Set() };
  const add = (unit, value) => {
    const kind = typeof unit === "string" ? unitClass(unit) : null;
    if (kind && typeof value === "number" && Number.isFinite(value)) withUnit[kind].add(value);
  };
  const walkUnits = (value, units) => {
    if (Array.isArray(value)) return value.forEach((child) => walkUnits(child, units));
    if (!value || typeof value !== "object") return;
    const own = value.units && typeof value.units === "object" ? { ...units, ...value.units } : units;
    if (typeof value.unit === "string") add(value.unit, value.value);
    for (const [key, child] of Object.entries(value)) {
      if (key === "units") continue;
      if (typeof child === "number") add(own[key], child);
      else walkUnits(child, own);
    }
  };
  walkUnits(facts, {});
  const lowerWords = new Set([...words].map((word) => word.toLowerCase()));
  return { numbers, strings, words, lowerWords, labels, withUnit };
}

// A shown number equals a fact value, or is that value rounded to two or more decimals (AC2.1).
function grounded({ value, decimals }, numbers) {
  if (!Number.isFinite(value) || decimals > 20) return false;
  for (const fact of numbers) {
    if (fact === value) return true;
    if (decimals >= 2 && Number(fact.toFixed(decimals)) === value) return true;
  }
  return false;
}

/** Numeric fidelity and tools-only IDs. The template answer must pass these too. */
export function checkGrounding(text, facts) {
  const index = factIndex(facts);
  const normalized = normalize(text);
  if (OTHER_DIGITS.test(normalized)) return "UNGROUNDED_NUMBER";
  if ([...normalized.matchAll(NUMBER_WORDS)].some(([word]) => !index.lowerWords.has(word.toLowerCase()))) {
    return "UNGROUNDED_NUMBER";
  }
  let unknownId = false;
  // IDs go first: a date inside an ID such as "D4-2026-11-20-OM" belongs to the ID.
  let rest = normalized.replace(WORD, (word) => {
    if (!isIdLike(word)) return word;
    if (!UNIT_WORDS.has(word) && !index.words.has(word)) unknownId = true;
    return " ";
  });
  for (const pattern of [DATE, TIME]) {
    rest = rest.replace(pattern, (token) => {
      if (!index.strings.some((string) => string.includes(token))) unknownId = true;
      return " ";
    });
  }
  if (unknownId) return "UNGROUNDED_ID";
  return numberTokens(rest).every((token) => grounded(token, token.unit ? index.withUnit[token.unit] : index.numbers))
    ? null : "UNGROUNDED_NUMBER";
}

/** The full check for text Gemini wrote: shape, grounding, wording and labels. */
export function checkWriterText(text, facts) {
  if (typeof text !== "string") return "ANSWER_SHAPE";
  const trimmed = normalize(text).trim();
  const sentences = sentenceCount(trimmed);
  if (!trimmed || trimmed.length > MAX_TEXT || sentences < 1 || sentences > MAX_SENTENCES || MARKUP.test(trimmed)) {
    return "ANSWER_SHAPE";
  }
  const groundingFailure = checkGrounding(trimmed, facts);
  if (groundingFailure) return groundingFailure;
  if (containsCausalClaim(withoutNegatedCausation(trimmed)) || containsUnverifiedOutcomeClaim(trimmed) ||
      STATUS_WORDS.test(trimmed.replace(NEGATED_STATUS, " ")) || VERDICT.test(trimmed)) {
    return "ANSWER_WORDING";
  }
  const { labels } = factIndex(facts);
  const lower = trimmed.toLowerCase();
  const claimed = SPEC_CHIPS.map((chip) => chip.toLowerCase())
    .filter((chip) => lower.includes(chip) && !labels.some((label) => label.includes(chip)));
  return claimed.length ? "ANSWER_LABEL" : null;
}
