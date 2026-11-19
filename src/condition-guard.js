import defaultRanges from "../config/condition-ranges.json" with { type: "json" };

// Plant-condition guard. Every model reads ambient humidity, ambient
// temperature and paper moisture, so one bad reading skews all five defect
// predictions. The guard checks each value against the range recorded in our
// own lot history (config/condition-ranges.json) and resolves a usable value:
//   humidity / temperature: plant reading -> weather provider -> seasonal typical
//   paper moisture: plant reading only; otherwise the operator must measure it.

export const CONDITION_FIELDS = Object.freeze(["ambientRhPct", "ambientTempC", "paperMoisturePct"]);
const WEATHER_FIELDS = new Set(["ambientRhPct", "ambientTempC"]);
const LABELS = Object.freeze({
  ambientRhPct: { name: "Humidity", unit: "% RH" },
  ambientTempC: { name: "Temperature", unit: " °C" },
  paperMoisturePct: { name: "Paper moisture", unit: "%" },
});
const MONTH_NAMES = Object.freeze([
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]);

function assertRanges(ranges) {
  for (const field of CONDITION_FIELDS) {
    const entry = ranges?.fields?.[field];
    if (!Number.isFinite(entry?.min) || !Number.isFinite(entry?.max) || entry.min >= entry.max) {
      throw new TypeError(`A valid ${field} range is required.`);
    }
    for (let month = 1; month <= 12; month += 1) {
      const median = entry.monthlyMedian?.[String(month)];
      if (!Number.isFinite(median) || median < entry.min || median > entry.max) {
        throw new TypeError(`A seasonal ${field} value for month ${month} is required.`);
      }
    }
  }
  return ranges;
}

export function conditionRange(field, ranges = defaultRanges) {
  const entry = ranges.fields[field];
  return { min: entry.min, max: entry.max };
}

export function isWithinRange(field, value, ranges = defaultRanges) {
  const { min, max } = conditionRange(field, ranges);
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function seasonalValue(field, month, ranges = defaultRanges) {
  return ranges.fields[field].monthlyMedian[String(month)];
}

function monthFor(runDate, now) {
  if (typeof runDate === "string" && /^\d{4}-(\d{2})-\d{2}$/.test(runDate)) {
    const month = Number(runDate.slice(5, 7));
    if (month >= 1 && month <= 12) return month;
  }
  const date = now();
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", month: "numeric" }).format(date));
}

function format(field, value) {
  return `${Number(value.toFixed(2))}${LABELS[field].unit}`;
}

function rangeText(field, ranges) {
  const { min, max } = conditionRange(field, ranges);
  return `${Number(min.toFixed(2))}–${format(field, max)}`;
}

function problem(field, value, ranges) {
  const present = typeof value === "number" && Number.isFinite(value);
  return present
    ? `${LABELS[field].name} reading ${format(field, value)} is outside the plant's recorded range (${rangeText(field, ranges)})`
    : `${LABELS[field].name} reading is missing`;
}

/**
 * Paper moisture has no fallback. Returns a validation issue when the value is
 * missing or outside the recorded range, otherwise undefined.
 */
export function paperMoistureIssue(value, ranges = defaultRanges) {
  if (isWithinRange("paperMoisturePct", value, ranges)) return undefined;
  const present = typeof value === "number" && Number.isFinite(value);
  const message = `${problem("paperMoisturePct", value, ranges)}. Measure the paper reel and enter its moisture (${rangeText("paperMoisturePct", ranges)}).`;
  return {
    field: "paperMoisturePct",
    path: ["conditions", "paperMoisturePct"],
    code: present ? "out_of_plant_range" : "required",
    message,
  };
}

/**
 * Creates a resolver for run conditions. `weatherProvider` is optional and is
 * only called when humidity or temperature needs a fallback.
 */
export function createConditionGuard({ ranges = defaultRanges, weatherProvider, now = () => new Date() } = {}) {
  assertRanges(ranges);
  if (weatherProvider !== undefined && typeof weatherProvider !== "function") {
    throw new TypeError("The weather provider must be a function.");
  }
  if (typeof now !== "function") {
    throw new TypeError("A current-time provider is required.");
  }

  return async function resolveConditions({ conditions = {}, runDate, signal } = {}) {
    const moisture = conditions?.paperMoisturePct;
    const moistureIssue = paperMoistureIssue(moisture, ranges);
    if (moistureIssue) {
      return {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: moistureIssue.message, issues: [moistureIssue] },
      };
    }

    const month = monthFor(runDate ?? conditions?.runDate, now);
    const resolved = { paperMoisturePct: moisture };
    const conditionSources = { paperMoisturePct: "plant" };
    const notes = [];
    const needsFallback = [...WEATHER_FIELDS].filter((field) => !isWithinRange(field, conditions?.[field], ranges));
    for (const field of WEATHER_FIELDS) {
      if (!needsFallback.includes(field)) {
        resolved[field] = conditions[field];
        conditionSources[field] = "plant";
      }
    }

    let weather;
    if (needsFallback.length > 0 && weatherProvider) {
      try {
        weather = await weatherProvider({ signal });
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) throw error;
        weather = undefined;
      }
    }
    for (const field of needsFallback) {
      const reason = problem(field, conditions?.[field], ranges);
      if (weather?.ok === true && isWithinRange(field, weather[field], ranges)) {
        resolved[field] = weather[field];
        conditionSources[field] = "weather";
        const observed = typeof weather.observedAt === "string" ? ` (observed ${weather.observedAt})` : "";
        notes.push(`${reason}; used the current weather reading of ${format(field, weather[field])}${observed}.`);
      } else {
        resolved[field] = seasonalValue(field, month, ranges);
        conditionSources[field] = "seasonal";
        notes.push(`${reason}; used the typical ${MONTH_NAMES[month - 1]} value of ${format(field, resolved[field])}.`);
      }
    }

    return {
      ok: true,
      conditions: {
        ambientRhPct: resolved.ambientRhPct,
        ambientTempC: resolved.ambientTempC,
        paperMoisturePct: resolved.paperMoisturePct,
      },
      conditionSources: {
        ambientRhPct: conditionSources.ambientRhPct,
        ambientTempC: conditionSources.ambientTempC,
        paperMoisturePct: conditionSources.paperMoisturePct,
      },
      confidence: Object.values(conditionSources).every((source) => source === "plant") ? "normal" : "reduced",
      notes,
    };
  };
}

export { defaultRanges as conditionRanges };
