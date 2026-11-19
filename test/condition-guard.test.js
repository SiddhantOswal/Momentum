import assert from "node:assert/strict";
import test from "node:test";
import conditionRanges from "../config/condition-ranges.json" with { type: "json" };
import {
  conditionRange,
  createConditionGuard,
  isWithinRange,
  paperMoistureIssue,
  seasonalValue,
} from "../src/condition-guard.js";

const plantReading = { ambientRhPct: 86, ambientTempC: 26, paperMoisturePct: 10.8 };
const fixedNow = () => new Date("2026-11-20T06:00:00.000Z");

test("condition ranges come from the recorded lots history, not invented values", () => {
  assert.equal(conditionRanges.source.table, "prepagent-hack.prepagent.lots");
  assert.ok(conditionRanges.source.rowCount > 0);
  assert.match(conditionRanges.source.queriedOn, /^\d{4}-\d{2}-\d{2}$/);
  for (const field of ["ambientRhPct", "ambientTempC", "paperMoisturePct"]) {
    const entry = conditionRanges.fields[field];
    assert.ok(entry.min <= entry.p01 && entry.p01 <= entry.p99 && entry.p99 <= entry.max, field);
    assert.deepEqual(Object.keys(entry.monthlyMedian), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
    for (const median of Object.values(entry.monthlyMedian)) {
      assert.ok(median >= entry.min && median <= entry.max, `${field} median ${median}`);
    }
  }
  assert.deepEqual(conditionRange("ambientRhPct"), {
    min: conditionRanges.fields.ambientRhPct.min,
    max: conditionRanges.fields.ambientRhPct.max,
  });
  assert.equal(isWithinRange("ambientRhPct", conditionRanges.fields.ambientRhPct.max), true);
  assert.equal(isWithinRange("ambientRhPct", conditionRanges.fields.ambientRhPct.max + 0.1), false);
  assert.equal(isWithinRange("ambientRhPct", undefined), false);
  assert.equal(isWithinRange("ambientRhPct", Number.NaN), false);
});

test("in-range plant readings are used as-is with normal confidence and no weather call", async () => {
  let weatherCalls = 0;
  const guard = createConditionGuard({ weatherProvider: async () => { weatherCalls += 1; return { ok: false }; }, now: fixedNow });
  const result = await guard({ conditions: plantReading });
  assert.equal(result.ok, true);
  assert.deepEqual(result.conditions, plantReading);
  assert.deepEqual(result.conditionSources, { ambientRhPct: "plant", ambientTempC: "plant", paperMoisturePct: "plant" });
  assert.equal(result.confidence, "normal");
  assert.deepEqual(result.notes, []);
  assert.equal(weatherCalls, 0);
});

test("missing humidity falls back to the weather reading before the seasonal value", async () => {
  let weatherCalls = 0;
  const guard = createConditionGuard({
    weatherProvider: async () => { weatherCalls += 1; return { ok: true, ambientRhPct: 72, ambientTempC: 31, observedAt: "2026-11-19T21:02:17.248Z" }; },
    now: fixedNow,
  });
  const result = await guard({ conditions: { ...plantReading, ambientRhPct: undefined } });
  assert.equal(result.ok, true);
  assert.equal(weatherCalls, 1);
  assert.equal(result.conditions.ambientRhPct, 72);
  // Temperature was valid, so the plant value is kept even though weather had one.
  assert.equal(result.conditions.ambientTempC, 26);
  assert.deepEqual(result.conditionSources, { ambientRhPct: "weather", ambientTempC: "plant", paperMoisturePct: "plant" });
  assert.equal(result.confidence, "reduced");
  assert.match(result.notes[0], /Humidity reading is missing; used the current weather reading of 72% RH \(observed 2026-11-19T21:02:17\.248Z\)\./);
});

test("out-of-range humidity and temperature use the seasonal value for the run month when weather is unavailable", async () => {
  const guard = createConditionGuard({ now: fixedNow });
  const result = await guard({
    conditions: { ambientRhPct: 0, ambientTempC: 85, paperMoisturePct: 10.8 },
    runDate: "2026-07-14",
  });
  assert.equal(result.ok, true);
  assert.equal(result.conditions.ambientRhPct, seasonalValue("ambientRhPct", 7));
  assert.equal(result.conditions.ambientTempC, seasonalValue("ambientTempC", 7));
  assert.equal(result.conditions.ambientRhPct, conditionRanges.fields.ambientRhPct.monthlyMedian["7"]);
  assert.deepEqual(result.conditionSources, { ambientRhPct: "seasonal", ambientTempC: "seasonal", paperMoisturePct: "plant" });
  assert.equal(result.confidence, "reduced");
  assert.match(result.notes[0], /Humidity reading 0% RH is outside the plant's recorded range .*; used the typical July value/);
  assert.match(result.notes[1], /Temperature reading 85 °C is outside/);
});

test("without a run date the seasonal month follows the plant's local date", async () => {
  // 2026-11-30T20:00Z is already 1 December in Pune.
  const guard = createConditionGuard({ now: () => new Date("2026-11-30T20:00:00.000Z") });
  const result = await guard({ conditions: { ...plantReading, ambientRhPct: null } });
  assert.equal(result.conditions.ambientRhPct, seasonalValue("ambientRhPct", 12));
  assert.match(result.notes[0], /typical December value/);
});

test("weather values outside the recorded range, failures and throws fall back to seasonal", async () => {
  for (const weatherProvider of [
    async () => ({ ok: true, ambientRhPct: 100, ambientTempC: 26 }),
    async () => ({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "down" } }),
    async () => { throw new Error("network"); },
  ]) {
    const guard = createConditionGuard({ weatherProvider, now: fixedNow });
    const result = await guard({ conditions: { ...plantReading, ambientRhPct: 120 }, runDate: "2026-11-20" });
    assert.equal(result.ok, true);
    assert.equal(result.conditionSources.ambientRhPct, "seasonal");
    assert.equal(result.conditions.ambientRhPct, seasonalValue("ambientRhPct", 11));
    assert.equal(result.confidence, "reduced");
  }
});

test("a cancelled request is not swallowed by the weather fallback", async () => {
  const controller = new AbortController();
  controller.abort();
  const guard = createConditionGuard({
    weatherProvider: async () => { throw new DOMException("Aborted", "AbortError"); },
    now: fixedNow,
  });
  await assert.rejects(
    guard({ conditions: { ...plantReading, ambientRhPct: undefined }, signal: controller.signal }),
    { name: "AbortError" },
  );
});

test("paper moisture has no fallback: missing or out-of-range values ask the operator", async () => {
  let weatherCalls = 0;
  const guard = createConditionGuard({ weatherProvider: async () => { weatherCalls += 1; return { ok: false }; }, now: fixedNow });
  const missing = await guard({ conditions: { ambientRhPct: 86, ambientTempC: 26 } });
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, "VALIDATION_ERROR");
  assert.match(missing.error.message, /^Paper moisture reading is missing\. Measure the paper reel and enter its moisture/);
  assert.deepEqual(missing.error.issues[0].path, ["conditions", "paperMoisturePct"]);
  assert.equal(missing.error.issues[0].code, "required");

  const high = await guard({ conditions: { ...plantReading, paperMoisturePct: 19 } });
  assert.equal(high.ok, false);
  assert.match(high.error.message, /Paper moisture reading 19% is outside the plant's recorded range \(5–12%\)/);
  assert.equal(high.error.issues[0].code, "out_of_plant_range");
  assert.equal(weatherCalls, 0);

  assert.equal(paperMoistureIssue(10.8), undefined);
  assert.equal(paperMoistureIssue(4.9).code, "out_of_plant_range");
});

test("the guard rejects incomplete range configuration", () => {
  const broken = structuredClone(conditionRanges);
  delete broken.fields.ambientRhPct.monthlyMedian["3"];
  assert.throws(() => createConditionGuard({ ranges: broken }), /seasonal ambientRhPct value for month 3/);
  assert.throws(() => createConditionGuard({ weatherProvider: "not a function" }), /weather provider/);
});
