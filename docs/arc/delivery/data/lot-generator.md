# Lot generator and the October-November 2026 holdout

Owner: data engineer. Written 2026-11-25 for ARC-M0-05 and the generator part of ARC-ML-02. No BigQuery job was run and no table was changed.

The generator, its seed, inputs, outputs, assumptions, the ₹45 against ₹53.3 price record and the recorded hashes are in `tools/data/README.md`. This file records the method for the one new dataset, the holdout.

## Method

- Generator: `tools/data/generator.ts --window holdout-2026-10-11`, seed 20261125, on the founders' 117-item catalog (`items.jsonl`, sha256 `0137de0a…94ce6`). Same rules, season table and operator habits as the history. Only the seed and the months differ.
- Provenance: every lot, feedback and truth row carries `provenance: "synthetic"`, `label: "generated"`, `dataset: "holdout-2026-10-11"` and `generator_seed: 20261125`. Label in reports: "modelled on the plant's real item master, generated".
- Why: September 2026 informed the `m2_*` choice (D4-2026-11-20-OM), so it is no longer a clean test month. The holdout shares no random draws with the history.
- The history is unchanged: with default options the generator still writes the founders' `truth.jsonl` (sha256 `75a70582…1afb`), and `test/lot-generator.test.js` checks this.

## Shape against the modelled history

Same columns as `prepagent.lots` plus the four label fields. Monthly means (history computed from the regenerated history, which matches `data-audit.md` section 1):

| Month | Lots | RH % | °C | Moisture % | Total scrap % | Scrap kg |
|---|---|---|---|---|---|---|
| Oct 2024 (history) | 231 | 61.0 | 23.3 | 8.73 | 4.55 | 847.2 |
| Nov 2024 (history) | 215 | 61.4 | 24.3 | 8.66 | 4.51 | 946.2 |
| Oct 2025 (history) | 225 | 61.5 | 24.1 | 8.67 | 4.41 | 973.4 |
| Nov 2025 (history) | 234 | 61.7 | 23.5 | 8.78 | 4.55 | 1,012.2 |
| Oct 2026 (holdout) | 223 | 62.1 | 24.1 | 8.79 | 4.50 | 928.4 |
| Nov 2026 (holdout) | 228 | 61.4 | 23.9 | 8.73 | 4.38 | 958.9 |

Holdout ranges in the full file: RH 50.2 to 74.9%, temperature 14.0 to 31.9 °C, moisture 6.45 to 10.98%, all 117 items. These sit inside the season table's bounds for October and November (RH 50 to 75% including the night offset, 14 to 32 °C), which the test also checks on the fixture.

## Where the file is

The holdout contains catalog fields, so it is not committed. It was generated once on 2026-11-25 to `/private/tmp/m005-holdout-2026-10-11/`: `lots.jsonl` 451 rows (sha256 `9a34dc5e…215da`), `truth.jsonl` 451, `feedback.jsonl` 2. Anyone with the catalog can regenerate it byte for byte with the command in the README.

## Sign-off

The holdout uses only assumptions already in the founders' generator. Om approved the price (13 Oct 2026) and the standard settings (14 Oct 2026). The season table, the habit spreads and the defect rules have no recorded sign-off. The holdout is for model evaluation and stays out of the demo until Om signs off (ARC-M0-04).
