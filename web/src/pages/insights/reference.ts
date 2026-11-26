// PKBX0041 reference lot on the m2_* models, 7.3% moisture, 42.0% RH, 18.5 C. Source:
// docs/arc/delivery/data/PKBX0041-m2-rerun.md ("Final reference"). A model estimate awaiting Om's
// sign-off, not a measured saving. The design's October figures (100.4 to 83.0 kg, Rs 925) are
// retired (docs/arc/delivery/data/stale-claims.md; DR-019, PD-12).
export const REFERENCE = {
  lot: "PKBX0041",
  boxes: 1300,
  scrapKg: { entered: 62.9, recommended: 55.1 },
  scrapCost: { entered: 3355, recommended: 2934 },
  changedSettings: 3,
  totalSettings: 7,
  settings: [
    { name: "Roll temperature", from: "162", to: "170", unit: " °C" },
    { name: "Gum application", from: "HIGH", to: "MEDIUM", unit: "" },
    { name: "Gum viscosity", from: "32", to: "45", unit: " s" },
  ],
} as const;

export const SAVING = REFERENCE.scrapCost.entered - REFERENCE.scrapCost.recommended;

// The models whose score the page flags as low confidence (the Crack holdout fit is 0.11).
export const LOW_CONFIDENCE = new Set(["CRACK"]);

// Throughput placeholder from the design: shape only, drawn dashed and labelled Sample.
export const THROUGHPUT = [
  { day: "M", height: 46 }, { day: "T", height: 70 }, { day: "W", height: 90 }, { day: "T", height: 120 },
  { day: "F", height: 76 }, { day: "S", height: 60 }, { day: "S", height: 98 },
] as const;
