# Lot generator and impact scorer

`generator.ts` builds the modelled lot history in `prepagent.lots` and `prepagent.feedback`. `impact.ts` scores model recommendations against the same rules for `prepagent.impact_lots` and `impact_lots_v2`. Ticket ARC-M0-05. The holdout window is the generator part of ARC-ML-02.

Provenance label for everything these files produce: **modelled on the plant's real item master, generated**. In data, the provenance value is `synthetic`. No row is a plant measurement, and an impact figure is a model estimate scored with these rules, not a measured saving.

## Where the files came from

| File | Source (founders' folder, outside the repository) | sha256 of the source |
|---|---|---|
| `generator.ts` | `generator.ts`, dated 11 Oct 2026 | `b56686d0719031a6ad79f6512ae7503c2c9af3d598336d665d812c022d522370` |
| `impact.ts` | `sid_pack.zip` → `sid_pack/impact.ts`, dated 13 Oct 2026 | `efe3dbc69ec05925ce8540c1e58c6d719e57d4968578dc21620814d5c2d5d6e1` |

Commit `87270be` holds both files byte for byte; `git diff 87270be -- tools/data/` shows every change since. The rest of `sid_pack.zip` (`run.sh`, SQL copies, `SID_NOTES.md`) was read and not copied: the SQL is already under `sql/`, and `run.sh` writes to BigQuery.

Changes from the founders' files:

1. **Price.** `CONFIG.costPerKg` is 53.3 (was 45). See the price record below.
2. **Lot `scrap_cost`** is `round(total_scrap_kg × costPerKg, 2)` on the rounded kg, as in `prepagent.lots`. The founders' file priced the unrounded kg. Every other field is unchanged.
3. **Random stream** is created per run inside `generate()`, so one process can produce the history and the holdout without either affecting the other. The draw order is unchanged.
4. **Window option** `--window holdout-2026-10-11` (below). The default window is the original history.
5. **CLI.** Input and output paths are arguments. The founders' main-module check compared a URL with a path and silently did nothing when the path had a space (as this repository's does).
6. `impact.ts` exports `scoreRecommendation()` and takes paths and `--cost-per-kg` as arguments. Its scoring is unchanged: at 53.3 its output was byte-identical to the founders' file on all 219 September 2026 lots (dummy recommendations, 25 Nov 2026).

## The price record (₹45 against ₹53.3 per kg)

- The founders' `generator.ts` says `costPerKg: 45`. `SID_NOTES.md` calls ₹45 a placeholder.
- Om approved ₹53.30 per kg, paper cost only, on 13 Oct 2026 (founders' decision record, D3), and set it in `prepagent.plants` (PLANT-01) and `prepagent.lots`.
- `prepagent.lots` therefore holds `scrap_cost` = ROUND(`total_scrap_kg` × 53.3, 2). This was checked on the five lots in `test/fixtures/explanation-pkbx0041-20261016.json` (read from the live service on 16 Oct 2026): every field matches, including `scrap_cost`. At ₹45 none of the five costs match.
- `impact_lots` and `impact_lots_v2` were scored with 53.3 on the unrounded kg (`docs/evidence/impact-v2.json`, `reproductionCheck`).
- The setting is `CONFIG.costPerKg` in `generator.ts`. `--cost-per-kg` overrides it for one run of either tool. It changes only `scrap_cost` and the impact cost fields; the truth file and all rates are independent of it.

## Seeds and windows

| Window | Seed | Months | Lot IDs | Extra fields on every row |
|---|---|---|---|---|
| `history` (default) | 20261010 | Oct 2024 to Sep 2026 (24) | `LOT-000001` … | none, so rows keep the `prepagent.lots` shape |
| `holdout-2026-10-11` | 20261125 | Oct and Nov 2026 (2) | `HLD-000001` … | `provenance: "synthetic"`, `label: "generated"`, `dataset: "holdout-2026-10-11"`, `generator_seed: 20261125` |

The holdout exists because September 2026 informed the choice of the `m2_*` models (D4-2026-11-20-OM), so it is no longer a clean test month. Both seeds index one mulberry32 cycle. The holdout stream starts 69,957,689 draws before the history stream, and the runs use 187,780 (history) and 15,638 (holdout) draws, so the two share none. Order IDs (`PO-2610-…`, `PO-2611-…`) cannot collide with the history, which ends at `PO-2609-…`.

## Inputs

`items.jsonl`: the plant's 117-item catalog (the source of `prepagent.items`), one JSON object per line with `item_code`, `customer_id`, `description`, `component`, `box_style`, dimensions in mm, `ply`, `flute_profile`, liner and flute gsm, `liner_bf`, `printed`, `ink_colors`, `ink_coverage_pct`, `monthly_qty`. sha256 `0137de0a95006e67cf7d2511d4a689e45ff252d4ad5b42d101114b5417194ce6`.

**The catalog is not committed.** On 25 Nov 2026, 12 of the 117 item codes appeared in tracked files (PKBX0041 in 93, the rest in 4 or fewer), and none of the dimensions, board specs, customer IDs or monthly quantities did. This repository is public, so `items.jsonl` stays with the founders. The tests use `test/fixtures/lot-generator/items-fixture.jsonl` instead: eight invented items (codes `FIX-…`, values inside the catalog's ranges) that cover RSC, die-cut with and without height, tray, ply 3, 5 and 7, and flutes B, C, BC and BCB.

`impact.ts` also needs `recs.json`, an export of `prepagent.impact_recs` or `impact_recs_v2`. Producing it is a BigQuery read that this folder does not run.

## Outputs

`generator.ts` writes three JSONL files to `--out` (default `out/`, or `out/<window>/` for the holdout):

- `lots.jsonl`: the `prepagent.lots` columns: order, item spec, paper type and supplier, conditions (`ambient_rh_pct`, `ambient_temp_c`, `paper_moisture_pct`, shift), the seven levers, `sheet_area_m2`, `box_weight_kg`, five `rate_*_pct`, `total_scrap_kg`, `scrap_cost`, `currency`, `primary_defect`.
- `feedback.jsonl`: operator notes for about 20% of lots with total scrap of 8% or more (`job_id` null, English only).
- `truth.jsonl`: the hidden factors per lot (`badBatch`, `noise` per defect to 3 decimals, `freak`). `impact.ts` needs it, and the models never see it.

`impact.ts` writes `impact_lots.jsonl` with base and best scrap %, kg and cost, the throughput penalty, `net_saving` and `model_saving`.

## How to run

Node 22.18 or later (type stripping). No dependencies, no network, no Google Cloud.

```sh
# History (reproduces prepagent.lots and prepagent.feedback)
node tools/data/generator.ts --items /path/to/items.jsonl --out /tmp/lots-history

# October and November 2026 holdout
node tools/data/generator.ts --items /path/to/items.jsonl --window holdout-2026-10-11 --out /tmp/lots-holdout

# Score recommendations exported from BigQuery
node tools/data/impact.ts --recs recs.json --lots /tmp/lots-history/lots.jsonl \
  --truth /tmp/lots-history/truth.jsonl --items /path/to/items.jsonl --out impact_lots.jsonl

# Tests. The full-catalog checks run only when the catalog path is given.
node --test test/lot-generator.test.js
MOMENTUM_ITEMS_JSONL=/path/to/items.jsonl node --test test/lot-generator.test.js
```

Write outputs outside the repository: they contain catalog fields.

## Recorded hashes (sha256)

Full catalog, default settings, Node 25.6, 25 Nov 2026:

| File | sha256 | Rows | Note |
|---|---|---|---|
| history `truth.jsonl` | `75a705828e7518c6b681cc0a4fd27a6e5487916cf4637433069cbf47ac411afb` | 5,350 | Identical to the founders' `truth.jsonl` |
| history `feedback.jsonl` | `8f2f892fa811c938166f36d2936ef136fe5e952dbbd138d9c481a367ce5279af` | 113 | Identical to the founders' generator output |
| history `lots.jsonl` | `c912c72aa1dc9e68193b2fd9f2b6c1c3e05eefdf6750ff46103a52c5c74e6a4a` | 5,350 | 219 in September 2026, 117 items, 27,380.06 kg |
| history `lots.jsonl` without `scrap_cost` | `1fc5bda95ed5c61a9604e7144eacaee37202f07db76837320fe9631826f2fa62` | | Same as the founders' output with `scrap_cost` removed |
| founders' generator `lots.jsonl` (₹45, unrounded kg) | `7676c7c031507237554ea1268c3913f1a49445c5dfd929e664cf7845073774dc` | 5,350 | Kept for the record. Reproduce with commit `87270be` |
| holdout `lots.jsonl` | `9a34dc5eb238597b24e27c8ba5201b869d60a9017f5e5f4556c22d4afb3215da` | 451 | 223 in October, 228 in November |
| holdout `truth.jsonl` | `09b820b2c51351a7d4bc314ed2b4935441c08574903438153bc94449fbb8d7b9` | 451 | |
| holdout `feedback.jsonl` | `fd2edf6b548e73b2fa90c45b9537301e4c64ab6b5ba0314fbfaf162ac9d7f102` | 2 | |

`test/lot-generator.test.js` checks the history hashes, the holdout `lots.jsonl` hash and the five stored lots. A change to `CONFIG.seed` fails both the fixture test and the full-catalog test.

## Assumptions

All are in `CONFIG` and `SEASON` in `generator.ts`. They are modelling choices, not plant measurements.

| Assumption | Value | Basis |
|---|---|---|
| Season table (RH %, °C by month) | Dec to Feb 30–50, 10–30; Mar to May 25–45, 25–40; Jun to Sep 75–95, 22–30; Oct and Nov 50–70, 18–32 | Founders' estimate of typical Pune ranges, not measured |
| Night shift | 30% of lots; RH +5 points, temperature −4 °C | Founders' generator |
| Paper moisture | 3.5 + 0.085 × RH + N(0, 0.6), clamped 5–12% | Founders' generator |
| Operator habits (centre of each lever) | SF 42 m/min, roll 168 °C, gum MED, viscosity 40 s, pasting MED, drying 6 h, print 55 sheets/min | Om approved these as the plant's standard settings on 14 Oct 2026. The spreads around them are the founders' choice |
| Lots per item per month | `monthly_qty` / 600 + N(0, 0.5), at least 1; 10% of item-months skipped | Founders' generator |
| Suppliers | SUP-A to SUP-E weighted 30/25/20/15/10, each with a paper-type mix; SUP-D has a 25% bad-batch chance (delamination ×2) | Founders' generator |
| Bad runs and noise | 2.5% of lots: one defect ×3.5, the rest ×2; log-normal noise σ 0.15 per defect; each rate capped at 25% | Founders' generator |
| Base scrap rates | warp 0.7, delam 0.65, strength 0.5, print 0.6, crack 0.4 (%) with the rules in `scrapRates()` | Founders' generator ("tune against the plant's books") |
| Price | ₹53.3 per kg, paper cost only | Approved by Om, 13 Oct 2026 |

**Sign-off.** Om approved the price and the standard settings. No sign-off is recorded for the other rows. The holdout reuses these assumptions unchanged for October and November. It is for model evaluation (ARC-ML-02) and must not appear in the demo until Om signs off (ARC-M0-04).

## Open items

- **Audit total.** `data-audit.md` records ₹1,459,356 of scrap cost in `prepagent.lots`. The regenerated rows sum to ₹1,459,358.27, a ₹2.27 difference across 5,350 rows. The five stored lots match exactly. A read-only per-row comparison against the table would settle it; it was NOT RUN here (no BigQuery in this ticket).
- **Impact tables.** Reproducing `impact_lots` and `impact_lots_v2` field by field needs a `recs.json` export. This was recorded as done on 20 Nov 2026 (`docs/evidence/impact-v2.json`) and was NOT RUN again here.
- The holdout is not loaded anywhere. Loading it would mean a new table next to `prepagent.lots`, never an insert into it.
