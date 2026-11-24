// impact.ts: score the model's recommendations with the generator's plant rules (the same rules that made the lots).
// Inputs:  recs.json (export of prepagent.impact_recs or impact_recs_v2), lots.jsonl, truth.jsonl, items.jsonl
// Output:  impact_lots.jsonl, the rows of prepagent.impact_lots and impact_lots_v2
// Run:     node tools/data/impact.ts [--recs recs.json] [--lots out/lots.jsonl] [--truth out/truth.jsonl]
//            [--items items.jsonl] [--out impact_lots.jsonl] [--cost-per-kg 53.3]
// This file only reads and writes local files. Exporting recs.json and loading the output are separate BigQuery steps.
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { trueScrap, CONFIG, type Item, type Order, type Conditions, type Levers, type Latent } from "./generator.ts";

export const readJsonl = (f: string) => readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l));

const r2 = (x: number) => Math.round(x * 100) / 100;

// Same hidden conditions (bad batch, noise, bad run) for both runs: only the settings differ.
export function scoreRecommendation(rec: any, lot: any, item: Item, z: Latent, costPerKg: number = CONFIG.costPerKg) {
  const order: Order = { ...item, paper_type: lot.paper_type, paper_supplier: lot.paper_supplier, quantity: lot.quantity };
  const cond: Conditions = {
    shift: lot.shift, ambient_rh_pct: lot.ambient_rh_pct,
    ambient_temp_c: lot.ambient_temp_c, paper_moisture_pct: lot.paper_moisture_pct,
  };
  const actual: Levers = {
    sf_speed_mpm: lot.sf_speed_mpm, roll_temp_c: lot.roll_temp_c, gum_application: lot.gum_application,
    gum_viscosity_sec: lot.gum_viscosity_sec, pasting_pressure: lot.pasting_pressure,
    drying_hours: lot.drying_hours, print_speed_spm: lot.print_speed_spm,
  };
  const best: Levers = {
    sf_speed_mpm: Number(rec.best_sf_speed_mpm), roll_temp_c: Number(rec.best_roll_temp_c),
    gum_application: rec.best_gum_application, gum_viscosity_sec: Number(rec.best_gum_viscosity_sec),
    pasting_pressure: rec.best_pasting_pressure, drying_hours: Number(rec.best_drying_hours),
    print_speed_spm: Number(rec.best_print_speed_spm),
  };
  const b = trueScrap(order, cond, actual, z, costPerKg);
  const o = trueScrap(order, cond, best, z, costPerKg);
  // Throughput penalty as in sql/optimize.sql: only slowing down against the plan is charged.
  const bPen = 0, oPen = 200 * Math.max(best.drying_hours - actual.drying_hours, 0) + 60 * Math.max(actual.sf_speed_mpm - best.sf_speed_mpm, 0) + 30 * Math.max(actual.print_speed_spm - best.print_speed_spm, 0);
  return {
    lot_id: rec.lot_id, run_date: lot.run_date, item_code: lot.item_code, n_changes: Number(rec.n_changes),
    base_scrap_pct: r2(b.totalPct), best_scrap_pct: r2(o.totalPct),
    base_scrap_kg: r2(b.totalKg), best_scrap_kg: r2(o.totalKg),
    base_scrap_cost: r2(b.cost), best_scrap_cost: r2(o.cost),
    base_penalty: r2(bPen), best_penalty: r2(oPen),
    net_saving: r2(b.cost + bPen - (o.cost + oPen)),
    model_saving: r2(Number(rec.model_base_total) - Number(rec.model_best_total)),
    currency: CONFIG.currency,
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      recs: { type: "string", default: "recs.json" },
      lots: { type: "string", default: "out/lots.jsonl" },
      truth: { type: "string", default: "out/truth.jsonl" },
      items: { type: "string", default: "items.jsonl" },
      out: { type: "string", default: "impact_lots.jsonl" },
      "cost-per-kg": { type: "string" },
    },
  });
  const costPerKg = values["cost-per-kg"] === undefined ? CONFIG.costPerKg : Number(values["cost-per-kg"]);
  if (!(Number.isFinite(costPerKg) && costPerKg > 0)) throw new Error(`--cost-per-kg must be a positive number, got ${values["cost-per-kg"]}`);
  const items = new Map<string, Item>(readJsonl(values.items).map((i: Item) => [i.item_code, i]));
  const lots = new Map<string, any>(readJsonl(values.lots).map((l: any) => [l.lot_id, l]));
  const truth = new Map<string, Latent>(readJsonl(values.truth).map((t: any) => [t.lot_id, t]));
  // `bq query --format=json` can print a status line before the array.
  const rawRecs = readFileSync(values.recs, "utf8");
  const recs: any[] = JSON.parse(rawRecs.slice(rawRecs.indexOf("[")));

  const out: any[] = [];
  for (const rec of recs) {
    const lot = lots.get(rec.lot_id);
    const z = truth.get(rec.lot_id);
    if (!lot || !z) { console.warn("skip", rec.lot_id); continue; }
    out.push(scoreRecommendation(rec, lot, items.get(lot.item_code)!, z, costPerKg));
  }

  writeFileSync(values.out, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const sum = (k: string) => out.reduce((s, r) => s + r[k], 0);
  const avg = (k: string) => sum(k) / Math.max(1, out.length);
  console.log(`Lots scored:            ${out.length}`);
  console.log(`Scrap % before / after: ${avg("base_scrap_pct").toFixed(2)}% -> ${avg("best_scrap_pct").toFixed(2)}%`);
  console.log(`Scrap kg saved (month): ${(sum("base_scrap_kg") - sum("best_scrap_kg")).toFixed(0)} kg`);
  console.log(`Net saving (month):     Rs ${sum("net_saving").toFixed(0)}  (after throughput penalty, Rs ${costPerKg}/kg)`);
  console.log(`Model expected saving:  Rs ${sum("model_saving").toFixed(0)}`);
  console.log(`Lots made worse:        ${out.filter((r) => r.net_saving < 0).length}`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
