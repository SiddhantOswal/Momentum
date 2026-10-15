// UI metadata mirrors src/schemas.js. Empty fields stay empty; no production defaults.
export const ORDER_FIELDS = [
  ["orderId", "Purchase order ID", "text"], ["itemCode", "Item code", "text"],
  ["customerId", "Customer ID", "text"], ["boxStyle", "Box style", "select", ["RSC", "DIECUT", "TRAY"]],
  ["lengthMm", "Length (mm)", "number", 20, 1500, 1], ["widthMm", "Width (mm)", "number", 20, 1500, 1],
  ["heightMm", "Height (mm)", "number", 0, 1500, 1], ["ply", "Ply", "select", ["3", "5", "7"]],
  ["fluteProfile", "Flute profile", "select", ["B", "C", "E", "BC", "BCB"]],
  ["topLinerGsm", "Top liner (GSM)", "number", 80, 400, 1], ["fluteGsm", "Flute (GSM)", "number", 80, 400, 1],
  ["innerLinerGsm", "Inner liner (GSM)", "number", 80, 400, 1], ["linerBf", "Liner BF", "number", 12, 40, 1],
  ["paperType", "Paper type", "select", ["VIRGIN", "RECYCLED", "MIXED"]], ["paperSupplier", "Paper supplier", "text"],
  ["inkColors", "Ink colours", "number", 0, 4, 1], ["inkCoveragePct", "Ink coverage (%)", "number", 0, 100, "any"],
  ["quantity", "Quantity", "number", 1, undefined, 1],
];
export const CONDITION_FIELDS = [
  ["runDate", "Run date", "date"], ["shift", "Shift", "select", ["DAY", "NIGHT"]],
  ["ambientRhPct", "Relative humidity (%)", "number", 0, 100, "any"],
  ["ambientTempC", "Ambient temperature (°C)", "number", undefined, undefined, "any"],
  ["paperMoisturePct", "Paper moisture (%)", "number", 0, 20, "any"],
];
export const LEVER_FIELDS = [
  ["sfSpeedMpm", "Single facer (m/min)", "number", 20, 60, "any"],
  ["rollTempC", "Roll temperature (°C)", "number", 150, 185, "any"],
  ["gumApplication", "Gum application", "select", ["LOW", "MED", "HIGH"]],
  ["gumViscositySec", "Gum viscosity (s)", "number", 25, 60, "any"],
  ["pastingPressure", "Pasting pressure", "select", ["LOW", "MED", "HIGH"]],
  ["dryingHours", "Drying time (h)", "number", 2, 16, "any"],
  ["printSpeedSpm", "Print speed (sheets/min)", "number", 30, 80, "any"],
];
export const LEVER_DEFINITIONS = Object.fromEntries(LEVER_FIELDS.filter((f) => f[2] === "number")
  .map(([name, label,, min, max]) => [name, { label, min, max, step: "any" }]));
export const REQUEST_FIELDS = {
  order: ORDER_FIELDS.map(([name]) => name), riskOrder: ["itemCode", "quantity", "paperType", "paperSupplier"],
  conditions: CONDITION_FIELDS.map(([name]) => name), riskConditions: ["shift", "ambientRhPct", "ambientTempC", "paperMoisturePct"],
  levers: LEVER_FIELDS.map(([name]) => name),
};
export const LEVER_UNITS = { sfSpeedMpm: "m/min", rollTempC: "°C", gumViscositySec: "s", dryingHours: "h", printSpeedSpm: "sheets/min" };
export const DEFECT_NAMES = { WARP: "Bending · warp", DELAM: "Delamination", STRENGTH: "Box strength", PRINT: "Print", CRACK: "Crease cracking" };

// Presentation order matches the canonical manufacturing sequence in the PDF.
// A missing stage setting is unavailable; it is never a plant-standard default.
export const MANUFACTURING_STAGES = [
  ["Printing (flexo, top liner)", ["printSpeedSpm"]],
  ["Single facer", ["sfSpeedMpm", "rollTempC", "gumApplication", "gumViscositySec"]],
  ["Sheet cutting", []],
  ["Pasting", ["gumApplication", "pastingPressure"]],
  ["Drying / conditioning", ["dryingHours"]],
  ["Cutting and creasing", []],
  ["Slotting", []],
  ["Stitching / gluing", []],
  ["QC and bundling", []],
];
