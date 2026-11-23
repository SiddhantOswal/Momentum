/**
 * Limits and prices for the budget-v2 Gemini store (design 5.2, ADR-0004).
 *
 * `USTAAD_GEMINI_BUDGET_POLICY=budget-v2` selects the store; the limits come
 * from `GEMINI_BUDGET_LIMITS`. Any problem with either leaves the policy
 * unconfigured, and an unconfigured policy that was asked for blocks Gemini.
 */

import { z } from "zod";
import { arcModelSettings } from "./arc-model-settings.js";
import fxFallback from "./fx-fallback.json" with { type: "json" };
import geminiPrices from "../config/gemini-prices.json" with { type: "json" };
import { TimestampSchema } from "./schemas.js";

export const GEMINI_BUDGET_POLICY = "budget-v2";
export const GEMINI_BUDGET_ENVIRONMENT = Object.freeze({
  policy: "USTAAD_GEMINI_BUDGET_POLICY",
  limits: "GEMINI_BUDGET_LIMITS",
});

// Founder decision F2 (2026-11-23): rupee spend per IST day for each pool.
export const DEFAULT_DAY_COST_CAP_INR = Object.freeze({ live: 600, eval: 200 });
// F2 also keeps total Gemini spend under the 10,000 set aside, so no single day may be set above it.
const MAX_DAY_COST_CAP_INR = 10000;

const limit = z.number().int().positive().max(100000);
const WindowSchema = z.object({ start: TimestampSchema, end: TimestampSchema }).strict()
  .refine((window) => Date.parse(window.start) < Date.parse(window.end), { message: "A window must end after it starts." });

const LimitsSchema = z.object({
  pool: z.enum(["live", "eval"]),
  dayLimit: limit,
  sessionDayLimit: limit,
  ipDayLimit: limit,
  minuteLimit: limit,
  sessionMinuteLimit: limit,
  dayCostCapInr: z.number().positive().max(MAX_DAY_COST_CAP_INR).optional(),
  demoSessionMint: z.object({ perIpPerHour: limit }).strict().optional(),
  pitchClaim: z.object({ attemptsPerIpPerHour: limit }).strict().optional(),
  reserve: z.object({
    units: limit,
    windowStart: TimestampSchema,
    windowEnd: TimestampSchema,
    grant: z.literal("pitch_reserve"),
    sessionDayLimit: limit,
  }).strict().optional(),
  blockedWindows: z.array(WindowSchema).max(8).optional(),
}).strict().superRefine((limits, ctx) => {
  const { reserve } = limits;
  if (reserve === undefined) return;
  if (limits.pool !== "live") ctx.addIssue({ code: "custom", path: ["reserve"], message: "Only the live pool holds a pitch reserve." });
  if (reserve.units >= limits.dayLimit) ctx.addIssue({ code: "custom", path: ["reserve", "units"], message: "The reserve must be below the day limit." });
  if (Date.parse(reserve.windowStart) >= Date.parse(reserve.windowEnd)) {
    ctx.addIssue({ code: "custom", path: ["reserve", "windowEnd"], message: "The reserve window must end after it starts." });
  }
});

const PriceSchema = z.object({
  input: z.number().nonnegative(),
  cachedInput: z.number().nonnegative(),
  output: z.number().nonnegative(),
}).strict();
const PricesSchema = z.object({
  version: z.string().min(1),
  source: z.string().min(1),
  currency: z.literal("USD"),
  unit: z.literal("per 1M tokens"),
  models: z.record(z.string(), PriceSchema),
}).strict();

const parsedPrices = PricesSchema.safeParse(geminiPrices);
const USD_PER_INR = fxFallback.base === "INR" ? fxFallback.rates?.USD : undefined;

/** The highest price per token class across a role's model and its fallback, or undefined if one is unpriced. */
function rolePrice(role) {
  const settings = Object.hasOwn(arcModelSettings.roles, role) ? arcModelSettings.roles[role] : undefined;
  if (!settings || !parsedPrices.success) return undefined;
  const prices = [settings.model, settings.fallbackModel].filter(Boolean)
    .map((model) => parsedPrices.data.models[model]);
  if (prices.some((price) => price === undefined)) return undefined;
  return {
    input: Math.max(...prices.map((price) => price.input)),
    cachedInput: Math.max(...prices.map((price) => price.cachedInput)),
    output: Math.max(...prices.map((price) => price.output)),
  };
}

function pricesUsable() {
  return parsedPrices.success && typeof USD_PER_INR === "number" && USD_PER_INR > 0 &&
    Object.keys(arcModelSettings.roles).every((role) => rolePrice(role) !== undefined);
}

const tokens = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : 0);

/**
 * Rupee cost of one response in micro-rupees, rounded up. Thinking tokens are
 * billed as output (vertex-safety-reference.md section 4); tokens the total
 * reports beyond the named counts are charged at the output price.
 */
export function attemptCostMicroInr(role, usage = {}) {
  const price = rolePrice(role);
  if (!price || !pricesUsable()) throw new TypeError(`No usable Gemini price for role ${role}.`);
  const prompt = tokens(usage.promptTokenCount);
  const cached = Math.min(tokens(usage.cachedContentTokenCount), prompt);
  const output = tokens(usage.candidatesTokenCount) + tokens(usage.thoughtsTokenCount);
  const unexplained = Math.max(0, tokens(usage.totalTokenCount) - prompt - output);
  const usdTimesMillion = (prompt - cached) * price.input + cached * price.cachedInput +
    (output + unexplained) * price.output;
  return Math.ceil((usdTimesMillion / 1e6 / USD_PER_INR) * 1e6);
}

const istParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** Counter windows on the IST clock, as digits: YYYYMMDD, YYYYMMDDHH and YYYYMMDDHHmm. */
export function istWindows(instant) {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) throw new TypeError("A valid instant is required.");
  const part = Object.fromEntries(istParts.formatToParts(date).map(({ type, value }) => [type, value]));
  const day = `${part.year}${part.month}${part.day}`;
  return { day, hour: `${day}${part.hour}`, minute: `${day}${part.hour}${part.minute}` };
}

/** Both ends inclusive to the second, so an end of 23:59:59 covers the whole last second. */
export function windowActive({ start, end }, instant) {
  return instant >= Date.parse(start) && Math.floor(instant / 1000) * 1000 <= Date.parse(end);
}

export function readGeminiBudgetConfig(env = process.env) {
  const policy = env[GEMINI_BUDGET_ENVIRONMENT.policy];
  if (policy === undefined || policy === "") {
    return Object.freeze({ requested: false, configured: false, status: "off", missing: [], invalid: [] });
  }
  const result = (status, { missing = [], invalid = [], limits } = {}) => Object.freeze({
    requested: true,
    configured: status === "configured",
    status,
    ...(limits ? { policy: GEMINI_BUDGET_POLICY, limits } : {}),
    missing: Object.freeze(missing),
    invalid: Object.freeze(invalid),
  });
  if (policy !== GEMINI_BUDGET_POLICY) return result("invalid", { invalid: [GEMINI_BUDGET_ENVIRONMENT.policy] });
  const raw = env[GEMINI_BUDGET_ENVIRONMENT.limits];
  if (raw === undefined || raw === "") return result("missing", { missing: [GEMINI_BUDGET_ENVIRONMENT.limits] });
  if (!pricesUsable()) return result("invalid", { invalid: ["config/gemini-prices.json"] });
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return result("invalid", { invalid: [GEMINI_BUDGET_ENVIRONMENT.limits] });
  }
  const parsed = LimitsSchema.safeParse(json);
  // Live eval runs use the developer's own credentials; no Cloud Run revision may serve from the eval pool.
  if (!parsed.success || (parsed.data.pool === "eval" && env.K_SERVICE)) {
    return result("invalid", { invalid: [GEMINI_BUDGET_ENVIRONMENT.limits] });
  }
  const limits = {
    ...parsed.data,
    dayCostCapInr: parsed.data.dayCostCapInr ?? DEFAULT_DAY_COST_CAP_INR[parsed.data.pool],
  };
  return result("configured", { limits: deepFreeze(limits) });
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
