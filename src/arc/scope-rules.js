import { z } from "zod";
import scopeConfig from "../../config/arc-scope.json" with { type: "json" };

// Characters that render as nothing, so "app​rove" cannot slip past a word match.
const INVISIBLE = /[­​-‏⁠﻿]/gu;
const TEXT = z.string().trim().min(1).max(300);
const PATTERN = z.string().min(1).max(1500).refine((pattern) => {
  try {
    new RegExp(pattern, "u");
    return true;
  } catch {
    return false;
  }
}, "The pattern must be a valid regular expression.");
const ActionIdSchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);

const ScopeConfigSchema = z.object({
  version: z.string().regex(/^arc-scope-v[1-9]\d*$/),
  replies: z.object({
    explain_cannot_approve: TEXT,
    reply_out_of_scope: TEXT,
    ask_clarification: z.record(z.string().regex(/^[a-z_]{1,32}$/), TEXT).refine((fields) => Object.hasOwn(fields, "request")),
  }).strict(),
  suggestions: z.record(ActionIdSchema, TEXT.max(60)),
  defaultSuggestionIds: z.array(ActionIdSchema).length(3),
  questionOpener: PATTERN,
  inScopePattern: PATTERN,
  unclear: z.object({
    minimumLetters: z.number().int().min(1).max(5),
    exact: z.array(z.string().min(1).max(40)).max(50),
  }).strict(),
  rules: z.array(z.object({
    id: z.string().regex(/^[a-z_]+\.[a-z]{2}\.[a-z_]+$/),
    kind: z.enum(["approval", "injection", "off_topic"]),
    pattern: PATTERN,
    questionExempt: z.boolean().optional(),
  }).strict()).min(1).max(60),
}).strict().superRefine((config, ctx) => {
  config.defaultSuggestionIds.forEach((id, index) => {
    if (!Object.hasOwn(config.suggestions, id)) {
      ctx.addIssue({ code: "custom", path: ["defaultSuggestionIds", index], message: "unknown suggestion" });
    }
  });
});

const noReplyArgs = z.object({}).strict().optional();

// Look-alike Cyrillic and Greek letters, folded to the Latin letter they imitate.
const CONFUSABLES = Object.freeze({
  "\u0430": "a", "\u0435": "e", "\u043e": "o", "\u0440": "p", "\u0441": "c", "\u0445": "x", "\u0443": "y",
  "\u0456": "i", "\u0458": "j", "\u0455": "s", "\u03bf": "o", "\u03b1": "a", "\u03c1": "p", "\u03bd": "v", "\u03b5": "e",
});
const CONFUSABLE_CHARS = new RegExp(`[${Object.keys(CONFUSABLES).join("")}]`, "gu");
// "a p p r o v e": four or more single letters separated by single spaces read as one word.
const SPACED_LETTERS = /(?<![\p{L}\p{N}])\p{L}(?: \p{L}){3,}(?![\p{L}\p{N}])/gu;

export function normalizeScopeText(text) {
  return String(text ?? "").normalize("NFKC").replace(INVISIBLE, "").toLowerCase()
    .replace(CONFUSABLE_CHARS, (letter) => CONFUSABLES[letter]).replace(/\s+/gu, " ").trim()
    .replace(SPACED_LETTERS, (word) => word.replaceAll(" ", ""));
}

/**
 * Deterministic scope and approval rules (05 section 5, step 2). They run before
 * the budget check and the router, so a match spends no Gemini attempt. Rules
 * and replies live in config/arc-scope.json so a change is a reviewed diff.
 */
export function createScopeRules({ config = scopeConfig, log = () => {} } = {}) {
  const parsed = ScopeConfigSchema.parse(config);
  const compile = (pattern) => new RegExp(pattern, "u");
  const opener = compile(parsed.questionOpener);
  const inScope = compile(parsed.inScopePattern);
  const rules = parsed.rules.map((rule) => ({ ...rule, regex: compile(rule.pattern) }));
  const clarifyAfter = new Set(parsed.unclear.exact.map(normalizeScopeText));
  const letters = new RegExp(`[\\p{L}\\p{N}]`, "gu");

  const suggestionList = (ids) => ids.map((actionId) => ({ actionId, label: parsed.suggestions[actionId] }));
  const defaultSuggestions = suggestionList(parsed.defaultSuggestionIds);
  const fieldSchema = z.enum(Object.keys(parsed.replies.ask_clarification));
  const outOfScopeArgs = z.object({
    suggestionIds: z.array(z.enum(Object.keys(parsed.suggestions))).max(3).optional(),
  }).strict().optional();
  const clarificationArgs = z.object({ field: fieldSchema }).strict();

  const refusal = () => ({ intent: "reply_out_of_scope", text: parsed.replies.reply_out_of_scope, suggestions: defaultSuggestions });

  function firstMatch(kind, text, { question = false, skip = false } = {}) {
    if (skip) return undefined;
    return rules.find((rule) => rule.kind === kind && !(question && rule.questionExempt) && rule.regex.test(text));
  }

  const api = {
    config: parsed,
    /** Null means no rule applies and the text goes on to the budget check and the router. */
    check(input) {
      const text = normalizeScopeText(input);
      const question = opener.test(text);
      const approval = firstMatch("approval", text, { question });
      if (approval) {
        log({ event: "arc_scope_rule", kind: "approval", ruleId: approval.id });
        return { intent: "explain_cannot_approve", text: parsed.replies.explain_cannot_approve, ruleId: approval.id };
      }
      const injection = firstMatch("injection", text);
      if (injection) {
        log({ event: "arc_scope_rule", kind: "injection", ruleId: injection.id });
        return { ...refusal(), ruleId: injection.id };
      }
      // A message that also names something in scope is mixed; the router answers that part and declines the rest.
      const offTopic = firstMatch("off_topic", text, { skip: inScope.test(text) });
      if (offTopic) return { ...refusal(), ruleId: offTopic.id };
      if ((text.match(letters)?.length ?? 0) < parsed.unclear.minimumLetters || clarifyAfter.has(text)) {
        return { intent: "ask_clarification", text: parsed.replies.ask_clarification.request, ruleId: "unclear.en.short" };
      }
      return null;
    },
    preRoute: async ({ text }) => api.check(text),
    /** Fixed copy for the router's reply functions. Undefined means the arguments were not acceptable. */
    renderReply(reply) {
      switch (reply?.code) {
        case "explain_cannot_approve":
          return noReplyArgs.safeParse(reply.args).success ? parsed.replies.explain_cannot_approve : undefined;
        case "reply_out_of_scope":
          return outOfScopeArgs.safeParse(reply.args).success ? parsed.replies.reply_out_of_scope : undefined;
        case "ask_clarification": {
          const args = clarificationArgs.safeParse(reply.args);
          return args.success ? parsed.replies.ask_clarification[args.data.field] : undefined;
        }
        default:
          return undefined;
      }
    },
    suggestions: (ids = parsed.defaultSuggestionIds) => suggestionList(ids.filter((id) => Object.hasOwn(parsed.suggestions, id))),
    replyFunctions: Object.freeze(["reply_out_of_scope", "ask_clarification", "explain_cannot_approve"]),
    clarificationFields: Object.freeze(Object.keys(parsed.replies.ask_clarification)),
    suggestionIds: Object.freeze(Object.keys(parsed.suggestions)),
  };
  return Object.freeze(api);
}
