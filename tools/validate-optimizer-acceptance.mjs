const LEVERS = { sf_speed_mpm: 48, roll_temp_c: 162, gum_application: "HIGH", gum_viscosity_sec: 32,
  pasting_pressure: "MED", drying_hours: 5, print_speed_spm: 60 };
const EXPECTED = {
  BASELINE: { ...LEVERS, n_changes: 0, total_scrap_pct: 10.18, scrap_kg: 100.4, scrap_cost: 5351,
    penalty: 0, total_cost: 5351, currency: "INR", savings_kg: 0, savings_cost: 0 },
  BEST: { ...LEVERS, roll_temp_c: 170, gum_application: "MED", gum_viscosity_sec: 35,
    n_changes: 3, total_scrap_pct: 8.42, scrap_kg: 83, scrap_cost: 4426,
    penalty: 0, total_cost: 4426, currency: "INR", savings_kg: 17.4, savings_cost: 925 },
};
const RATES = ["rate_warp_pct", "rate_delam_pct", "rate_strength_pct", "rate_print_pct", "rate_crack_pct"];

function finiteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return NaN;
  return Number(value);
}

/** Acceptance tooling only. Expected values never enter application responses. */
export function validatePkbx0041Acceptance(payload) {
  // bq's canonical script JSON includes both successful ASSERT messages before
  // the final SELECT result. An ordinary final-query result is also supported.
  const rows = Array.isArray(payload) && payload.length === 3 &&
    payload[0] === "Assertion successful" && payload[1] === "Assertion successful"
    ? payload[2] : payload;
  if (!Array.isArray(rows) || rows.length !== 2 ||
      new Set(rows.map(r => r?.kind)).size !== 2 ||
      !rows.every(r => Object.hasOwn(EXPECTED, r?.kind))) {
    throw new Error("Expected exactly the canonical BASELINE and BEST result rows.");
  }
  const comparison = [];
  for (const row of rows) {
    for (const [field, expected] of Object.entries(EXPECTED[row.kind])) {
      const actual = row[field];
      const pass = typeof expected === "string" ? actual === expected :
        Number.isFinite(finiteNumber(actual)) && Math.abs(finiteNumber(actual) - expected) < 1e-8;
      comparison.push({ kind: row.kind, field, expected, actual, pass });
    }
    for (const field of RATES) {
      const number = finiteNumber(row[field]);
      comparison.push({ kind: row.kind, field, expected: "finite defect rate in [0,100]", actual: row[field], pass: Number.isFinite(number) && number >= 0 && number <= 100 });
    }
  }
  const differences = comparison.filter(c => !c.pass);
  return { ok: differences.length === 0, rows, comparison, differences };
}
