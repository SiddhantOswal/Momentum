// generator.ts: modelled lot history for Momentum, built on the plant's real item master.
// Run:  node tools/data/generator.ts [--items items.jsonl] [--out out] [--window history] [--cost-per-kg 53.3]
// See tools/data/README.md for the seed, assumptions, outputs and the recorded hashes.
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// ───────────────────────── CONFIG (edit after the plant inputs) ─────────────────────────
export const CONFIG = {
  seed: 20261010,
  startMonth: "2024-10",          // 24 months: Oct 2024 – Sep 2026 (Sep 2026 = held-out month)
  months: 24,
  boxesPerLot: 600,               // monthly_qty / this ≈ lots per item per month
  skipMonthChance: 0.1,           // some items aren't ordered every month
  nightShiftShare: 0.3,
  // ₹ per kg of scrap (paper + gum + conversion). The founders' file said 45, but prepagent.lots and
  // prepagent.impact_lots were built with 53.3, the cost_per_kg of PLANT-01 in prepagent.plants.
  costPerKg: 53.3,
  currency: "INR",
  suppliers: [                    // weight, paper-type mix [VIRGIN, MIXED, RECYCLED]
    { id: "SUP-A", w: 30, mix: [0.3, 0.4, 0.3] },
    { id: "SUP-B", w: 25, mix: [0.1, 0.3, 0.6] },
    { id: "SUP-C", w: 20, mix: [0.1, 0.3, 0.6] },
    { id: "SUP-D", w: 15, mix: [0.0, 0.2, 0.8] }, // occasional bad batches (hidden)
    { id: "SUP-E", w: 10, mix: [0.1, 0.4, 0.5] },
  ],
  badBatchSupplier: "SUP-D",
  badBatchChance: 0.25,
  freakChance: 0.025,         // a 'bad run': one defect x3.5, the rest x2
  noiseSigma: 0.15,
  // Base scrap rates (%) and warp sensitivity to liner GSM imbalance — tune against the plant's books
  baseRates: { warp: 0.7, delam: 0.65, strength: 0.5, print: 0.6, crack: 0.4 },
  linerImbalanceFactor: 2,
  // Operator habits (history is deliberately not optimal)
  habits: {
    sfSpeed: { mean: 42, sd: 8, min: 20, max: 60 },
    rollTemp: { mean: 168, sd: 8, min: 150, max: 185 },
    gumApplication: { LOW: 0.25, MED: 0.55, HIGH: 0.2 },
    gumViscosity: { mean: 40, sd: 8, min: 25, max: 60 },
    pastingPressure: { LOW: 0.2, MED: 0.6, HIGH: 0.2 },
    dryingHours: { mean: 6, sd: 2.5, min: 2, max: 16, monsoonBonus: 2, monsoonBonusChance: 0.5 },
    printSpeed: { mean: 55, sd: 12, min: 30, max: 80 },
  },
};

// Season table (Pune): month -> [rhMin, rhMax, tMin, tMax]
const SEASON: Record<number, [number, number, number, number]> = {
  1: [30, 50, 10, 30], 2: [30, 50, 10, 30], 3: [25, 45, 25, 40], 4: [25, 45, 25, 40], 5: [25, 45, 25, 40],
  6: [75, 95, 22, 30], 7: [75, 95, 22, 30], 8: [75, 95, 22, 30], 9: [75, 95, 22, 30],
  10: [50, 70, 18, 32], 11: [50, 70, 18, 32], 12: [30, 50, 10, 30],
};

// ───────────────────────── WINDOWS ─────────────────────────
// "history" is the run that built prepagent.lots and must stay byte-identical, so its rows carry no extra fields.
export const WINDOWS = {
  history: { seed: CONFIG.seed, startMonth: CONFIG.startMonth, months: CONFIG.months, lotPrefix: "LOT", rowLabels: null },
} as const;
export type WindowName = keyof typeof WINDOWS;
export type GenerateOptions = { window?: WindowName; seed?: number; costPerKg?: number };

// ───────────────────────── TYPES ─────────────────────────
type Level = "LOW" | "MED" | "HIGH";
export type Item = {
  item_code: string; customer_id: string; description: string; component: string; box_style: string;
  length_mm: number; width_mm: number; height_mm: number; ply: number; flute_profile: string;
  top_liner_gsm: number; flute_gsm: number; inner_liner_gsm: number; liner_bf: number;
  printed: boolean; ink_colors: number; ink_coverage_pct: number; monthly_qty: number;
};
export type Order = Item & { paper_type: "VIRGIN" | "MIXED" | "RECYCLED"; paper_supplier: string; quantity: number };
export type Conditions = { shift: "DAY" | "NIGHT"; ambient_rh_pct: number; ambient_temp_c: number; paper_moisture_pct: number };
export type Levers = {
  sf_speed_mpm: number; roll_temp_c: number; gum_application: Level; gum_viscosity_sec: number;
  pasting_pressure: Level; drying_hours: number; print_speed_spm: number;
};
export type Latent = { badBatch: boolean; noise: number[]; freak: number }; // noise per defect; freak = worst defect index of a bad run, or -1
export const DEFECTS = ["warp", "delam", "strength", "print", "crack"] as const;
export const NO_LATENT: Latent = { badBatch: false, noise: [1, 1, 1, 1, 1], freak: -1 };

// ───────────────────────── RNG ─────────────────────────
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The draw order inside generate() is what the recorded hashes depend on; reordering any call changes every lot after it.
function createRandom(seed: number) {
  const rand = mulberry32(seed);
  const uni = (a: number, b: number) => a + (b - a) * rand();
  const normal = (m: number, sd: number) => {
    const u = 1 - rand(), v = rand();
    return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const pick = <T extends string>(weights: Record<T, number>): T => {
    let u = rand();
    for (const [k, w] of Object.entries(weights) as [T, number][]) { if ((u -= w) <= 0) return k; }
    return Object.keys(weights)[0] as T;
  };
  return { rand, uni, normal, pick };
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

// ───────────────────────── PHYSICS-ISH HELPERS ─────────────────────────
const TAKE_UP: Record<string, number> = { B: 1.32, C: 1.43, E: 1.27 };

export function sheetAreaM2(o: Pick<Item, "box_style" | "length_mm" | "width_mm" | "height_mm">) {
  const { length_mm: L, width_mm: W, height_mm: H } = o;
  if (o.box_style === "TRAY") return ((L + 2 * H + 20) * (W + 2 * H + 20)) / 1e6;
  if (o.box_style === "DIECUT" && H === 0) return (L * W * 1.1) / 1e6;
  const rsc = ((2 * L + 2 * W + 35) * (W + H)) / 1e6;
  return o.box_style === "DIECUT" ? rsc * 1.15 : rsc;
}

export function boardGsm(o: Pick<Item, "ply" | "flute_profile" | "top_liner_gsm" | "flute_gsm" | "inner_liner_gsm">) {
  const flutes = o.flute_profile.split(""); // "BC" -> ["B","C"]
  const middleLiners = Math.max(0, flutes.length - 1);
  return o.top_liner_gsm + o.inner_liner_gsm + middleLiners * o.flute_gsm +
    flutes.reduce((s, f) => s + o.flute_gsm * (TAKE_UP[f] ?? 1.4), 0);
}

// ───────────────────────── THE RULES (single source of truth) ─────────────────────────
// Returns scrap rate % per defect. Used by the generator AND by impact scoring.
export function scrapRates(o: Order, c: Conditions, l: Levers, z: Latent = NO_LATENT) {
  const rh = c.ambient_rh_pct, m = c.paper_moisture_pct;
  const plyM = (p5: number, p7: number) => (o.ply === 7 ? p7 : o.ply === 5 ? p5 : 1);
  const recycled = o.paper_type === "RECYCLED";
  const area = sheetAreaM2(o);

  // Warp
  const B = CONFIG.baseRates;
  let warp = B.warp;
  warp *= 1 + (CONFIG.linerImbalanceFactor * Math.abs(o.top_liner_gsm - o.inner_liner_gsm)) / Math.max(o.top_liner_gsm, o.inner_liner_gsm);
  if (rh > 75) warp *= 1.6; else if (rh < 35) warp *= 1.3;
  warp *= plyM(1.4, 1.7);
  if (area > 1.0) warp *= 1.3;
  warp *= l.gum_application === "HIGH" ? 1.4 : l.gum_application === "LOW" ? 0.9 : 1;
  const hoursNeeded = 4 + 0.1 * Math.max(0, rh - 50);
  warp *= 1 + 0.15 * Math.max(0, hoursNeeded - l.drying_hours);

  // Delamination
  let delam = B.delam;
  if (m > 10) delam *= 1 + 0.25 * (m - 10);
  if (rh > 75) delam *= 1.5;
  if (l.sf_speed_mpm > 45) delam *= 1 + 0.04 * (l.sf_speed_mpm - 45);
  if (l.roll_temp_c < 160) delam *= 1 + 0.04 * (160 - l.roll_temp_c);
  if (c.ambient_temp_c < 15) delam *= 1.3;
  delam *= l.gum_application === "LOW" ? 1.8 : l.gum_application === "HIGH" ? 0.9 : 1;
  if (l.gum_viscosity_sec < 30) delam *= 1.4;
  if (recycled) delam *= 1.3;
  delam *= plyM(1.3, 1.5);
  if (z.badBatch) delam *= 2.0;

  // Strength
  let strength = B.strength;
  const bfNeeded = 14 + 0.025 * o.height_mm * (o.ply === 7 ? 0.65 : o.ply === 5 ? 0.8 : 1);
  if (bfNeeded > o.liner_bf) strength *= 1 + 4 * (bfNeeded / o.liner_bf - 1);
  if (recycled) strength *= 1.4;
  if (rh > 80) strength *= 1.5;
  if (l.pasting_pressure === "HIGH") strength *= 1.3;

  const night = c.shift === "NIGHT" ? 1.15 : 1;
  const finish = (x: number, i: number) => Math.min(25, x * night * z.noise[i] * (z.freak >= 0 ? (z.freak === i ? 3.5 : 2) : 1));

  const warpF = finish(warp, 0);

  // Print (cascade from warp)
  let print = 0;
  if (o.ink_colors > 0) {
    print = B.print;
    if (o.ink_coverage_pct > 60) print *= 1 + 0.03 * (o.ink_coverage_pct - 60);
    print *= 1 + 0.25 * (o.ink_colors - 1);
    if (["C", "BC", "BCB"].includes(o.flute_profile)) print *= 1.3; else if (o.flute_profile === "E") print *= 0.8;
    if (l.print_speed_spm > 60) print *= 1 + 0.02 * (l.print_speed_spm - 60);
    print *= 1 + 0.4 * warpF;
  }

  // Crease / slot crack (cascade from warp)
  let crack = B.crack;
  if (rh < 35) crack *= 1.8;
  if (m < 6) crack *= 1 + 0.3 * (6 - m);
  if (recycled && o.liner_bf >= 28) crack *= 1.4;
  if (o.box_style === "DIECUT") crack *= 1.3;
  if (l.drying_hours > 12 && rh < 40) crack *= 1.2;
  crack *= 1 + 0.3 * warpF;

  return { warp: warpF, delam: finish(delam, 1), strength: finish(strength, 2), print: finish(print, 3), crack: finish(crack, 4) };
}

// Full outcome for one lot — also the "true" scorer for the impact number.
export function trueScrap(o: Order, c: Conditions, l: Levers, z: Latent = NO_LATENT, costPerKg: number = CONFIG.costPerKg) {
  const rates = scrapRates(o, c, l, z);
  const boxKg = (sheetAreaM2(o) * boardGsm(o)) / 1000;
  const totalPct = DEFECTS.reduce((s, d) => s + rates[d], 0);
  const totalKg = o.quantity * boxKg * (totalPct / 100);
  const primary = DEFECTS.reduce((a, b) => (rates[b] > rates[a] ? b : a));
  return { rates, totalPct, boxKg, totalKg, cost: totalKg * costPerKg, primary };
}

// ───────────────────────── NOTES (replace with real operator remarks) ─────────────────────────
const NOTES: Record<(typeof DEFECTS)[number], string[]> = {
  warp: [
    "Boards warped after pasting. Gave extra drying hours before printing.",
    "Sheets curling in the stack. Reduced gum and kept boards under weight overnight.",
    "Warp on big sheets in humid weather. Increased drying time to fix.",
  ],
  delam: [
    "Liner lifting at flute tips. Slowed single facer and raised roll temperature.",
    "Weak bonding with this paper lot. Increased gum viscosity and reduced speed.",
    "Delamination after monsoon rain. Paper was damp; dried reels before running.",
  ],
  strength: [
    "BCT sample failed. Asked purchase for higher BF paper for this item.",
    "Box crushing in stacking test. Reduced pasting pressure to protect flutes.",
  ],
  print: [
    "Print shifting on warped sheets. Flattened stacks and reduced print speed.",
    "Ink smudging on heavy coverage. Slowed printer and allowed more drying.",
  ],
  crack: [
    "Cracks on crease lines, paper too dry. Kept boards covered overnight.",
    "Slot corners cracking in winter. Conditioned boards before converting.",
  ],
};

// ───────────────────────── GENERATE ─────────────────────────
export function generate(items: Item[], opts: GenerateOptions = {}) {
  const win = WINDOWS[opts.window ?? "history"];
  if (!win) throw new Error(`Unknown window "${opts.window}". Use one of: ${Object.keys(WINDOWS).join(", ")}`);
  const costPerKg = opts.costPerKg ?? CONFIG.costPerKg;
  if (!(Number.isFinite(costPerKg) && costPerKg > 0)) throw new Error(`costPerKg must be a positive number, got ${costPerKg}`);
  const { rand, uni, normal, pick } = createRandom(opts.seed ?? win.seed);
  const labels = win.rowLabels ?? {};
  const H = CONFIG.habits;
  const lots: any[] = [], feedback: any[] = [], truth: any[] = [];
  const [y0, m0] = win.startMonth.split("-").map(Number);
  let n = 0;

  for (let mi = 0; mi < win.months; mi++) {
    const year = y0 + Math.floor((m0 - 1 + mi) / 12), month = ((m0 - 1 + mi) % 12) + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const [rhMin, rhMax, tMin, tMax] = SEASON[month];
    const monsoon = month >= 6 && month <= 9;

    for (const it of items) {
      if (rand() < CONFIG.skipMonthChance) continue;
      const nLots = Math.max(1, Math.round(it.monthly_qty / CONFIG.boxesPerLot + normal(0, 0.5)));
      for (let k = 0; k < nLots; k++) {
        n++;
        const day = 1 + Math.floor(rand() * daysInMonth);
        const run_date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const shift = rand() < CONFIG.nightShiftShare ? "NIGHT" : "DAY";

        const sup = (() => { let u = rand() * 100; for (const s of CONFIG.suppliers) { if ((u -= s.w) <= 0) return s; } return CONFIG.suppliers[0]; })();
        const pt = rand(); const paper_type = pt < sup.mix[0] ? "VIRGIN" : pt < sup.mix[0] + sup.mix[1] ? "MIXED" : "RECYCLED";
        const quantity = Math.max(100, Math.round((it.monthly_qty / nLots) * clamp(normal(1, 0.15), 0.6, 1.4) / 50) * 50);

        const rh = clamp(uni(rhMin, rhMax) + (shift === "NIGHT" ? 5 : 0), 20, 98);
        const cond: Conditions = {
          shift,
          ambient_rh_pct: r1(rh),
          ambient_temp_c: r1(uni(tMin, tMax) - (shift === "NIGHT" ? 4 : 0)),
          paper_moisture_pct: r2(clamp(3.5 + 0.085 * rh + normal(0, 0.6), 5, 12)),
        };
        const lev: Levers = {
          sf_speed_mpm: r1(clamp(normal(H.sfSpeed.mean, H.sfSpeed.sd), H.sfSpeed.min, H.sfSpeed.max)),
          roll_temp_c: r1(clamp(normal(H.rollTemp.mean, H.rollTemp.sd), H.rollTemp.min, H.rollTemp.max)),
          gum_application: pick(H.gumApplication),
          gum_viscosity_sec: r1(clamp(normal(H.gumViscosity.mean, H.gumViscosity.sd), H.gumViscosity.min, H.gumViscosity.max)),
          pasting_pressure: pick(H.pastingPressure),
          drying_hours: r1(clamp(normal(H.dryingHours.mean, H.dryingHours.sd) +
            (monsoon && rand() < H.dryingHours.monsoonBonusChance ? H.dryingHours.monsoonBonus : 0), H.dryingHours.min, H.dryingHours.max)),
          print_speed_spm: r1(clamp(normal(H.printSpeed.mean, H.printSpeed.sd), H.printSpeed.min, H.printSpeed.max)),
        };
        const order: Order = { ...it, paper_type: paper_type as Order["paper_type"], paper_supplier: sup.id, quantity };
        const latent: Latent = {
          badBatch: sup.id === CONFIG.badBatchSupplier && rand() < CONFIG.badBatchChance,
          noise: DEFECTS.map(() => Math.exp(normal(0, CONFIG.noiseSigma))),
          freak: rand() < CONFIG.freakChance ? Math.floor(rand() * 5) : -1,
        };
        const out = trueScrap(order, cond, lev, latent, costPerKg);
        // prepagent.lots prices the rounded kg (checked on five stored lots); the founders' file priced the unrounded kg.
        const lot_id = `${win.lotPrefix}-${String(n).padStart(6, "0")}`;

        lots.push({
          lot_id, order_id: `PO-${String(year).slice(2)}${String(month).padStart(2, "0")}-${String(n).padStart(5, "0")}`,
          customer_id: it.customer_id, item_code: it.item_code, box_style: it.box_style,
          length_mm: it.length_mm, width_mm: it.width_mm, height_mm: it.height_mm, ply: it.ply, flute_profile: it.flute_profile,
          top_liner_gsm: it.top_liner_gsm, flute_gsm: it.flute_gsm, inner_liner_gsm: it.inner_liner_gsm, liner_bf: it.liner_bf,
          paper_type, paper_supplier: sup.id, ink_colors: it.ink_colors, ink_coverage_pct: it.ink_coverage_pct, quantity,
          run_date, shift, ...cond, ...lev,
          sheet_area_m2: r3(sheetAreaM2(it)), box_weight_kg: r3(out.boxKg),
          rate_warp_pct: r3(out.rates.warp), rate_delam_pct: r3(out.rates.delam), rate_strength_pct: r3(out.rates.strength),
          rate_print_pct: r3(out.rates.print), rate_crack_pct: r3(out.rates.crack),
          total_scrap_kg: r2(out.totalKg), scrap_cost: r2(r2(out.totalKg) * costPerKg), currency: CONFIG.currency, primary_defect: out.primary.toUpperCase(),
          ...labels,
        });
        truth.push({ lot_id, ...latent, noise: latent.noise.map(r3), ...labels });

        if (out.totalPct >= 8 && rand() < 0.2) {
          const options = NOTES[out.primary];
          const note = options[Math.floor(rand() * options.length)];
          feedback.push({
            job_id: null, lot_id, created_at: `${run_date}T18:00:00Z`,
            rate_warp_pct: r3(out.rates.warp), rate_delam_pct: r3(out.rates.delam), rate_strength_pct: r3(out.rates.strength),
            rate_print_pct: r3(out.rates.print), rate_crack_pct: r3(out.rates.crack),
            photo_uri: null, photo_defect: null, photo_confidence: null,
            override: false, operator_note: note, operator_note_en: note, note_lang: "en",
            ...labels,
          });
        }
      }
    }
  }
  return { lots, feedback, truth };
}

export const toJsonl = (rows: any[]) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
export const readItems = (path: string): Item[] => readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l));

// ───────────────────────── SANITY CHECKS ─────────────────────────
// Thresholds describe the full 24-month history; a two-month window is summarised instead.
function sanity(lots: any[], feedback: any[]) {
  const tot = (l: any) => l.rate_warp_pct + l.rate_delam_pct + l.rate_strength_pct + l.rate_print_pct + l.rate_crack_pct;
  const totals = lots.map(tot);
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  const month = (l: any) => Number(l.run_date.slice(5, 7));
  const monsoon = lots.filter((l) => month(l) >= 6 && month(l) <= 9), dry = lots.filter((l) => [12, 1, 2].includes(month(l)));
  const supD = lots.filter((l) => l.paper_supplier === "SUP-D"), others = lots.filter((l) => l.paper_supplier !== "SUP-D");
  const delamRatio = mean(monsoon.map((l) => l.rate_delam_pct)) / mean(dry.map((l) => l.rate_delam_pct));
  const supRatio = mean(supD.map((l) => l.rate_delam_pct)) / mean(others.map((l) => l.rate_delam_pct));
  const in2to8 = totals.filter((t) => t >= 2 && t <= 8).length / totals.length;
  const over15 = totals.filter((t) => t >= 15).length / totals.length;
  const bad = lots.filter((l) => Object.values(l).some((v) => typeof v === "number" && !Number.isFinite(v))).length;
  const checks: [string, string, boolean][] = [
    ["Lots", String(lots.length), lots.length > 4000],
    ["Mean total scrap %", mean(totals).toFixed(2), mean(totals) > 3.5 && mean(totals) < 7],
    ["Share of lots 2–8%", (in2to8 * 100).toFixed(1) + "%", in2to8 >= 0.7],
    ["Share of lots ≥15%", (over15 * 100).toFixed(1) + "%", over15 >= 0.005 && over15 <= 0.05],
    ["Monsoon / dry delam", delamRatio.toFixed(2) + "×", delamRatio >= 1.5],
    ["SUP-D / others delam", supRatio.toFixed(2) + "×", supRatio >= 1.2],
    ["NaN / Infinity rows", String(bad), bad === 0],
    ["Feedback notes", String(feedback.length), feedback.length > 50],
  ];
  for (const [k, v, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${k.padEnd(22)} ${v}`);
  const prim: Record<string, number> = {};
  for (const l of lots) prim[l.primary_defect] = (prim[l.primary_defect] ?? 0) + 1;
  console.log("Primary defect mix:", prim);
}

export function windowSummary(lots: any[], feedback: any[]) {
  const mean = (k: string, rows: any[]) => rows.reduce((s, l) => s + l[k], 0) / Math.max(1, rows.length);
  const byMonth = new Map<string, any[]>();
  for (const l of lots) byMonth.set(l.run_date.slice(0, 7), [...(byMonth.get(l.run_date.slice(0, 7)) ?? []), l]);
  const rows = [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([m, ls]) => {
    const scrapPct = ls.reduce((s, l) => s + l.rate_warp_pct + l.rate_delam_pct + l.rate_strength_pct + l.rate_print_pct + l.rate_crack_pct, 0) / ls.length;
    return { month: m, lots: ls.length, rhPct: r1(mean("ambient_rh_pct", ls)), tempC: r1(mean("ambient_temp_c", ls)),
      moisturePct: r2(mean("paper_moisture_pct", ls)), scrapPct: r2(scrapPct), scrapKg: r1(ls.reduce((s, l) => s + l.total_scrap_kg, 0)) };
  });
  return { lots: lots.length, feedback: feedback.length, months: rows };
}

// ───────────────────────── CLI ─────────────────────────
function main() {
  const { values } = parseArgs({
    options: {
      items: { type: "string", default: "items.jsonl" },
      out: { type: "string" },
      window: { type: "string", default: "history" },
      "cost-per-kg": { type: "string" },
    },
  });
  const window = values.window as WindowName;
  if (!(window in WINDOWS)) throw new Error(`Unknown --window "${values.window}". Use one of: ${Object.keys(WINDOWS).join(", ")}`);
  const costPerKg = values["cost-per-kg"] === undefined ? CONFIG.costPerKg : Number(values["cost-per-kg"]);
  const outDir = values.out ?? (window === "history" ? "out" : join("out", window));

  const { lots, feedback, truth } = generate(readItems(values.items), { window, costPerKg });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "lots.jsonl"), toJsonl(lots));
  writeFileSync(join(outDir, "feedback.jsonl"), toJsonl(feedback));
  writeFileSync(join(outDir, "truth.jsonl"), toJsonl(truth));
  console.log(`Window ${window}, seed ${WINDOWS[window].seed}, ₹${costPerKg} per kg, written to ${outDir}`);
  if (window === "history") sanity(lots, feedback);
  else console.log(JSON.stringify(windowSummary(lots, feedback), null, 2));
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
