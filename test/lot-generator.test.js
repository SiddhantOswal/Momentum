import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

// tools/data/*.ts load through Node's type stripping (on by default from Node 22.18 and 23.6).
const TS_SKIP = process.features?.typescript ? false : `Node ${process.version} cannot load .ts files; use Node 22.18 or later`;
const gen = TS_SKIP ? null : await import("../tools/data/generator.ts");
const impact = TS_SKIP ? null : await import("../tools/data/impact.ts");

const fixtureItems = readFileSync(new URL("./fixtures/lot-generator/items-fixture.jsonl", import.meta.url), "utf8")
  .trim().split("\n").map((l) => JSON.parse(l));

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
const withoutCost = (lots) => jsonl(lots.map(({ scrap_cost, ...rest }) => rest));
const r2 = (x) => Math.round(x * 100) / 100;
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} != ${expected}`);

// From the founders' unmodified generator.ts run on items-fixture.jsonl (seed 20261010). The lots hash drops
// scrap_cost because the founders priced the unrounded kg at 45 per kg; see tools/data/README.md.
const FIXTURE_FOUNDERS = {
  truth: "a5f77fc86e6d6ba39c3ddf6c2aa9ab4fca4745fd610b194093e32cbf9c7ce44f",
  feedback: "0c1c436ef346cad165147051615d330764a0b3e86aac04ec8fcbb89937916f4b",
  lotsWithoutCost: "ad1327920f4e388dc8b919d2345b742ecbe8e00ddd8e6a15a6c73f98122c0a26",
  lots: 392,
};

const box = {
  item_code: "T", customer_id: "C", description: "", component: "BOX", box_style: "RSC",
  length_mm: 400, width_mm: 300, height_mm: 100, ply: 3, flute_profile: "C",
  top_liner_gsm: 150, flute_gsm: 120, inner_liner_gsm: 150, liner_bf: 18,
  printed: false, ink_colors: 0, ink_coverage_pct: 0, monthly_qty: 1000,
  paper_type: "MIXED", paper_supplier: "SUP-A", quantity: 1000,
};
const mild = { shift: "DAY", ambient_rh_pct: 50, ambient_temp_c: 25, paper_moisture_pct: 8 };
const plain = {
  sf_speed_mpm: 40, roll_temp_c: 170, gum_application: "MED", gum_viscosity_sec: 40,
  pasting_pressure: "MED", drying_hours: 6, print_speed_spm: 50,
};

test("settings: seed 20261010, holdout seed 20261125, 53.3 rupees per kg", { skip: TS_SKIP }, () => {
  assert.equal(gen.CONFIG.seed, 20261010);
  assert.equal(gen.HOLDOUT_SEED, 20261125);
  assert.equal(gen.CONFIG.costPerKg, 53.3);
  assert.equal(gen.CONFIG.currency, "INR");
});

test("sheet area follows the RSC, die-cut, flat die-cut and tray formulas", { skip: TS_SKIP }, () => {
  close(gen.sheetAreaM2({ box_style: "RSC", length_mm: 400, width_mm: 300, height_mm: 200 }), 0.7175, "RSC");
  close(gen.sheetAreaM2({ box_style: "DIECUT", length_mm: 250, width_mm: 180, height_mm: 90 }), 0.2778975, "DIECUT");
  close(gen.sheetAreaM2({ box_style: "DIECUT", length_mm: 500, width_mm: 400, height_mm: 0 }), 0.22, "flat DIECUT");
  close(gen.sheetAreaM2({ box_style: "TRAY", length_mm: 400, width_mm: 300, height_mm: 50 }), 0.2184, "TRAY");
});

test("board gsm adds liners, middle liners and fluting with take-up", { skip: TS_SKIP }, () => {
  const ply = (p, f, top, fl, inner) => ({ ply: p, flute_profile: f, top_liner_gsm: top, flute_gsm: fl, inner_liner_gsm: inner });
  close(gen.boardGsm(ply(3, "C", 200, 120, 150)), 521.6, "3-ply C");
  close(gen.boardGsm(ply(3, "E", 180, 120, 180)), 512.4, "3-ply E");
  close(gen.boardGsm(ply(5, "BC", 230, 140, 200)), 955, "5-ply BC");
  close(gen.boardGsm(ply(7, "BCB", 230, 140, 230)), 1309.8, "7-ply BCB");
  close(gen.boardGsm(ply(3, "A", 200, 120, 150)), 518, "unknown flute uses 1.4");
});

test("scrap rates are the base rates when no rule fires, with crack cascading from warp", { skip: TS_SKIP }, () => {
  const r = gen.scrapRates(box, mild, plain);
  close(r.warp, 0.7, "warp");
  close(r.delam, 0.65, "delam");
  close(r.strength, 0.5, "strength");
  close(r.print, 0, "print without ink");
  close(r.crack, 0.4 * (1 + 0.3 * 0.7), "crack");
});

test("scrap rates for a humid night run on recycled paper match the rules worked by hand", { skip: TS_SKIP }, () => {
  const order = { ...box, paper_type: "RECYCLED", ink_colors: 1, ink_coverage_pct: 40 };
  const humid = { shift: "NIGHT", ambient_rh_pct: 86, ambient_temp_c: 26, paper_moisture_pct: 10.8 };
  const levers = { ...plain, sf_speed_mpm: 48, roll_temp_c: 162, gum_application: "HIGH", gum_viscosity_sec: 32, drying_hours: 5, print_speed_spm: 60 };
  const r = gen.scrapRates(order, humid, levers);
  const warp = 0.7 * 1.6 * 1.4 * (1 + 0.15 * 2.6) * 1.15;
  close(r.warp, warp, "warp");
  close(r.delam, 0.65 * 1.2 * 1.5 * 1.12 * 0.9 * 1.3 * 1.15, "delam");
  close(r.strength, 0.5 * 1.4 * 1.5 * 1.15, "strength");
  close(r.print, 0.6 * 1.3 * (1 + 0.4 * warp) * 1.15, "print");
  close(r.crack, 0.4 * (1 + 0.3 * warp) * 1.15, "crack");
});

test("trueScrap with a fixed latent applies bad batch, noise, the bad-run multipliers and the price", { skip: TS_SKIP }, () => {
  const latent = { badBatch: true, noise: [1.1, 0.9, 1, 1.2, 0.8], freak: 1 };
  const out = gen.trueScrap(box, mild, plain, latent);
  close(out.rates.warp, 1.54, "warp x noise x2");
  close(out.rates.delam, 4.095, "delam x bad batch x noise x3.5");
  close(out.rates.strength, 1, "strength x2");
  close(out.rates.print, 0, "print");
  close(out.rates.crack, 0.4 * (1 + 0.3 * 1.54) * 0.8 * 2, "crack");
  close(out.totalPct, 7.57068, "total %");
  close(out.boxKg, 0.2706984, "box kg");
  // 1000 boxes x 0.2706984 kg x 7.57068% = 20.49370962912 kg exactly.
  close(out.totalKg, 20.49370962912, "total kg");
  close(out.cost, 20.49370962912 * 53.3, "cost at default price");
  close(gen.trueScrap(box, mild, plain, latent, 45).cost, 20.49370962912 * 45, "cost at 45");
  assert.equal(out.primary, "delam");
});

test("each defect rate is capped at 25%", { skip: TS_SKIP }, () => {
  const out = gen.trueScrap(box, mild, plain, { badBatch: false, noise: [30, 1, 1, 1, 1], freak: 0 });
  assert.equal(out.rates.warp, 25);
});

test("fixture history matches the founders' generator draw for draw", { skip: TS_SKIP }, () => {
  const { lots, feedback, truth } = gen.generate(fixtureItems);
  assert.equal(lots.length, FIXTURE_FOUNDERS.lots);
  assert.equal(sha256(jsonl(truth)), FIXTURE_FOUNDERS.truth);
  assert.equal(sha256(jsonl(feedback)), FIXTURE_FOUNDERS.feedback);
  assert.equal(sha256(withoutCost(lots)), FIXTURE_FOUNDERS.lotsWithoutCost);
  for (const lot of lots) assert.equal(lot.scrap_cost, r2(lot.total_scrap_kg * 53.3), lot.lot_id);
  assert.equal(lots[0].run_date.slice(0, 7), "2024-10");
  assert.equal(lots.at(-1).run_date.slice(0, 7), "2026-09");
  assert.ok(lots.every((l) => !("provenance" in l)), "history rows keep the prepagent.lots shape");
});

test("the generator is deterministic and the price changes only scrap_cost", { skip: TS_SKIP }, () => {
  const a = gen.generate(fixtureItems);
  const b = gen.generate(fixtureItems);
  assert.equal(jsonl(a.lots), jsonl(b.lots));
  const at45 = gen.generate(fixtureItems, { costPerKg: 45 });
  assert.equal(withoutCost(at45.lots), withoutCost(a.lots));
  assert.equal(jsonl(at45.truth), jsonl(a.truth));
  assert.equal(at45.lots[0].scrap_cost, r2(at45.lots[0].total_scrap_kg * 45));
  assert.notEqual(sha256(jsonl(gen.generate(fixtureItems, { seed: 20261011 }).truth)), FIXTURE_FOUNDERS.truth);
  assert.throws(() => gen.generate(fixtureItems, { costPerKg: 0 }), /positive number/);
  assert.throws(() => gen.generate(fixtureItems, { window: "2027" }), /Unknown window/);
});

test("the holdout covers October and November 2026, is labelled generated and leaves the history unchanged", { skip: TS_SKIP }, () => {
  const holdout = gen.generate(fixtureItems, { window: "holdout-2026-10-11" });
  const labels = { provenance: "synthetic", label: "generated", dataset: "holdout-2026-10-11", generator_seed: 20261125 };
  assert.ok(holdout.lots.length > 0 && holdout.feedback.length > 0);
  for (const rows of [holdout.lots, holdout.feedback, holdout.truth]) {
    for (const row of rows) for (const [k, v] of Object.entries(labels)) assert.equal(row[k], v, `${row.lot_id} ${k}`);
  }
  const months = new Set(holdout.lots.map((l) => l.run_date.slice(0, 7)));
  assert.deepEqual([...months].sort(), ["2026-10", "2026-11"]);
  assert.ok(holdout.lots.every((l) => /^HLD-\d{6}$/.test(l.lot_id)));
  // Season table for October and November: RH 50 to 70 (+5 at night), 18 to 32 °C (-4 at night).
  assert.ok(holdout.lots.every((l) => l.ambient_rh_pct >= 50 && l.ambient_rh_pct <= 75), "RH range");
  assert.ok(holdout.lots.every((l) => l.ambient_temp_c >= 14 && l.ambient_temp_c <= 32), "temperature range");
  assert.ok(holdout.lots.every((l) => l.paper_moisture_pct >= 5 && l.paper_moisture_pct <= 12), "moisture range");

  const history = gen.generate(fixtureItems);
  assert.equal(sha256(jsonl(history.truth)), FIXTURE_FOUNDERS.truth);
  const historyIds = new Set(history.lots.map((l) => l.lot_id));
  assert.ok(holdout.lots.every((l) => !historyIds.has(l.lot_id)));
});

test("impact scoring: the same settings save nothing, slowing down is charged as in optimize.sql", { skip: TS_SKIP }, () => {
  const { lots, truth } = gen.generate(fixtureItems);
  const lot = lots.find((l) => l.run_date.startsWith("2026-09") && l.ink_colors > 0);
  const z = truth.find((t) => t.lot_id === lot.lot_id);
  const item = fixtureItems.find((i) => i.item_code === lot.item_code);
  const rec = (overrides) => ({
    lot_id: lot.lot_id, n_changes: "1", model_base_total: "6.0", model_best_total: "5.5",
    best_sf_speed_mpm: String(lot.sf_speed_mpm), best_roll_temp_c: String(lot.roll_temp_c),
    best_gum_application: lot.gum_application, best_gum_viscosity_sec: String(lot.gum_viscosity_sec),
    best_pasting_pressure: lot.pasting_pressure, best_drying_hours: String(lot.drying_hours),
    best_print_speed_spm: String(lot.print_speed_spm), ...overrides,
  });

  const same = impact.scoreRecommendation(rec({}), lot, item, z);
  assert.equal(same.base_scrap_pct, same.best_scrap_pct);
  assert.equal(same.net_saving, 0);
  assert.equal(same.best_penalty, 0);
  assert.equal(same.model_saving, 0.5);
  // truth.jsonl keeps noise to 3 decimals, so rescoring a lot lands within 0.2% of its stored kg, not exactly on it.
  assert.ok(Math.abs(same.base_scrap_kg - lot.total_scrap_kg) <= 0.002 * lot.total_scrap_kg + 0.01, `${same.base_scrap_kg} vs ${lot.total_scrap_kg}`);
  assert.equal(same.currency, "INR");

  const slower = impact.scoreRecommendation(rec({
    best_drying_hours: String(lot.drying_hours + 1), best_sf_speed_mpm: String(lot.sf_speed_mpm - 2), best_print_speed_spm: String(lot.print_speed_spm - 5),
  }), lot, item, z);
  assert.equal(slower.best_penalty, 470);
  assert.ok(Math.abs(slower.net_saving - (slower.base_scrap_cost - slower.best_scrap_cost - 470)) <= 0.02);

  const at45 = impact.scoreRecommendation(rec({}), lot, item, z, 45);
  assert.ok(Math.abs(at45.base_scrap_cost - same.base_scrap_cost * 45 / 53.3) <= 0.01);
});

// The 117-item catalog is private and not in this repository. Point MOMENTUM_ITEMS_JSONL at the founders' items.jsonl to run this.
const ITEMS = process.env.MOMENTUM_ITEMS_JSONL;
const CATALOG_SKIP = TS_SKIP || (ITEMS ? false : "MOMENTUM_ITEMS_JSONL is not set; the 117-item catalog is not in this public repository (tools/data/README.md)");
const RECORDED = {
  items: "0137de0a95006e67cf7d2511d4a689e45ff252d4ad5b42d101114b5417194ce6",
  founderTruth: "75a705828e7518c6b681cc0a4fd27a6e5487916cf4637433069cbf47ac411afb",
  founderFeedback: "8f2f892fa811c938166f36d2936ef136fe5e952dbbd138d9c481a367ce5279af",
  founderLotsWithoutCost: "1fc5bda95ed5c61a9604e7144eacaee37202f07db76837320fe9631826f2fa62",
  lots: "c912c72aa1dc9e68193b2fd9f2b6c1c3e05eefdf6750ff46103a52c5c74e6a4a",
  holdoutLots: "9a34dc5eb238597b24e27c8ba5201b869d60a9017f5e5f4556c22d4afb3215da",
};

test("full catalog: the history reproduces prepagent.lots and the founders' truth.jsonl", { skip: CATALOG_SKIP }, () => {
  const raw = readFileSync(ITEMS, "utf8");
  assert.equal(sha256(raw), RECORDED.items, `${ITEMS} is not the 117-item catalog that built prepagent.lots`);
  const items = gen.readItems(ITEMS);
  const { lots, feedback, truth } = gen.generate(items);

  assert.equal(sha256(jsonl(truth)), RECORDED.founderTruth);
  assert.equal(sha256(jsonl(feedback)), RECORDED.founderFeedback);
  assert.equal(sha256(withoutCost(lots)), RECORDED.founderLotsWithoutCost);
  assert.equal(sha256(jsonl(lots)), RECORDED.lots);
  assert.equal(lots.length, 5350);
  assert.equal(feedback.length, 113);
  assert.equal(new Set(lots.map((l) => l.item_code)).size, 117);
  assert.equal(lots.filter((l) => l.run_date.startsWith("2026-09")).length, 219);
  assert.equal(r2(lots.reduce((s, l) => s + l.total_scrap_kg, 0)), 27380.06);

  // Five lots as the live service returned them from prepagent.lots on 16 Oct 2026.
  const live = JSON.parse(readFileSync(new URL("./fixtures/explanation-pkbx0041-20261016.json", import.meta.url), "utf8"));
  const stored = JSON.stringify(live).match(/"lotId":"LOT-\d{6}"/g).map((m) => m.slice(9, -1));
  assert.equal(stored.length, 5);
  const evidence = (function find(o) {
    if (Array.isArray(o?.evidence)) return o.evidence;
    for (const v of Object.values(o ?? {})) if (v && typeof v === "object") { const r = find(v); if (r) return r; }
  })(live);
  const byId = new Map(lots.map((l) => [l.lot_id, l]));
  for (const e of evidence) {
    const lot = byId.get(e.lotId);
    const total = r2(lot.rate_warp_pct + lot.rate_delam_pct + lot.rate_strength_pct + lot.rate_print_pct + lot.rate_crack_pct);
    assert.deepEqual(
      [lot.order_id, lot.run_date, lot.item_code, lot.primary_defect, lot.shift, lot.ambient_rh_pct, lot.paper_type, lot.paper_supplier,
        lot.sf_speed_mpm, lot.roll_temp_c, lot.gum_application, lot.gum_viscosity_sec, lot.pasting_pressure, lot.drying_hours, lot.print_speed_spm,
        total, lot.total_scrap_kg, lot.scrap_cost, lot.currency],
      [e.orderId, e.runDate, e.itemCode, e.primaryDefect, e.shift, e.ambientRhPct, e.paperType, e.paperSupplier,
        e.levers.sfSpeedMpm, e.levers.rollTempC, e.levers.gumApplication, e.levers.gumViscositySec, e.levers.pastingPressure, e.levers.dryingHours, e.levers.printSpeedSpm,
        e.totalScrapPct, e.totalScrapKg, e.scrapCost, e.currency],
      e.lotId,
    );
  }
});

test("full catalog: the holdout matches its recorded hash and does not disturb the history", { skip: CATALOG_SKIP }, () => {
  const items = gen.readItems(ITEMS);
  const holdout = gen.generate(items, { window: "holdout-2026-10-11" });
  assert.equal(sha256(jsonl(holdout.lots)), RECORDED.holdoutLots);
  assert.equal(sha256(jsonl(gen.generate(items).truth)), RECORDED.founderTruth);
});
