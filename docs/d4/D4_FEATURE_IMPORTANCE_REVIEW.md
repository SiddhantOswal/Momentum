# D4: Feature-importance review

Source: `ML.FEATURE_IMPORTANCE(MODEL prepagent.m_<defect>)` on Vertex version 1 models; 29 features each; full output in `d4_evidence/fi_<defect>.json`. Importance shows association, not causation.

## Warp (bending): `m_warp` (v1) · verdict **ACCEPT**

| Rank | Feature | Gain |
|---|---|---|
| 1 | `ambient_rh_pct` | 21.599 |
| 2 | `gum_application` | 16.594 |
| 3 | `top_liner_gsm` | 12.483 |
| 4 | `drying_hours` | 6.835 |
| 5 | `ink_colors` | 3.574 |
| 6 | `width_mm` | 2.577 |
| 7 | `sf_speed_mpm` | 2.554 |
| 8 | `ink_coverage_pct` | 2.554 |

- **Plausible for corrugated manufacturing:** Yes. Humidity, gum amount, top-liner GSM (the printing-grade top liner is heavier than the inner liner, a known cause of bending), drying time and ink colours (a proxy for printed boxes with that heavier top liner) are the expected drivers of bending.
- **Anomalies:** None material. width_mm and ink_coverage_pct are low-gain size and print proxies.
- **Limits:** Holdout R² 0.40 vs 0.61 internally: weaker on an unseen monsoon month, where bending rates and their spread are higher.

## Delamination: `m_delam` (v1) · verdict **ACCEPT**

| Rank | Feature | Gain |
|---|---|---|
| 1 | `ambient_rh_pct` | 60.461 |
| 2 | `gum_application` | 40.937 |
| 3 | `paper_moisture_pct` | 18.367 |
| 4 | `gum_viscosity_sec` | 9.843 |
| 5 | `sf_speed_mpm` | 9.830 |
| 6 | `paper_type` | 9.662 |
| 7 | `ply` | 7.494 |
| 8 | `width_mm` | 7.422 |

- **Plausible for corrugated manufacturing:** Yes. Humidity, gum amount, paper moisture, gum viscosity, single-facer speed, paper type and ply are the expected drivers of liner bonding failure.
- **Anomalies:** None material.
- **Limits:** Holdout R² 0.50 vs 0.67 internally; error grows on the monsoon month (MSE 1.19 vs 0.27), driven by occasional bad paper batches.

## Strength (weak box): `m_strength` (v1) · verdict **ACCEPT (limited)**

| Rank | Feature | Gain |
|---|---|---|
| 1 | `ambient_rh_pct` | 6.811 |
| 2 | `paper_type` | 5.311 |
| 3 | `pasting_pressure` | 1.976 |
| 4 | `liner_bf` | 0.847 |
| 5 | `ambient_temp_c` | 0.551 |
| 6 | `shift` | 0.551 |
| 7 | `quantity` | 0.458 |
| 8 | `length_mm` | 0.440 |

- **Plausible for corrugated manufacturing:** Partly. Humidity, paper type (recycled is weaker), pasting pressure (crushed flutes) and BF are expected. Box height, which drives the BF requirement, is not in the top 8.
- **Anomalies:** quantity and shift carry small gain: likely noise fitting.
- **Limits:** Weak model (internal R² 0.47, holdout 0.30). Strength is a small share of scrap (about 1%).

## Print defects: `m_print` (v1) · verdict **ACCEPT**

| Rank | Feature | Gain |
|---|---|---|
| 1 | `ink_colors` | 260.767 |
| 2 | `ink_coverage_pct` | 64.138 |
| 3 | `flute_profile` | 44.490 |
| 4 | `ply` | 11.220 |
| 5 | `width_mm` | 11.184 |
| 6 | `paper_supplier` | 9.790 |
| 7 | `customer_id` | 8.299 |
| 8 | `gum_viscosity_sec` | 7.989 |

- **Plausible for corrugated manufacturing:** Yes. Ink colours, coverage and flute profile dominate, as expected for print defects; ply and width act as board-stiffness proxies.
- **Anomalies:** customer_id has gain 8.3 over only 3 splits: noise or an item proxy, with no causal meaning. gum_viscosity_sec is an indirect effect through bending.
- **Limits:** Holdout R² 0.61: holds up on the unseen month.

## Crease / slot crack: `m_crack` (v1) · verdict **ACCEPT (low confidence, flagged)**

| Rank | Feature | Gain |
|---|---|---|
| 1 | `ambient_rh_pct` | 13.998 |
| 2 | `ink_coverage_pct` | 2.209 |
| 3 | `roll_temp_c` | 1.981 |
| 4 | `paper_type` | 1.646 |
| 5 | `paper_supplier` | 1.642 |
| 6 | `pasting_pressure` | 1.579 |
| 7 | `shift` | 1.527 |
| 8 | `height_mm` | 1.496 |

- **Plausible for corrugated manufacturing:** Partly. Humidity dominates (cracks occur in dry conditions), as expected. Die-cut style and paper moisture effects are not separately visible.
- **Anomalies:** Low-gain features after humidity (ink coverage, roll temperature, supplier, shift) are noise.
- **Limits:** Holdout R² −0.01: no predictive skill within a monsoon month, where humidity is uniformly high and crack rates barely vary. Shown as low confidence in monsoon; crack is about 0.7 percentage points of scrap.

## customer_id
It appears with small gain in the models. In print it reaches gain 8.3 over just 3 splits. In the modelled history, customers have no causal effect on defects, so this is noise fitting or a proxy for the customer's item mix.
**Decision:** accepted for the prototype under D4. Future work is to retrain without `customer_id` and compare.

## Leakage check
No target proxies are among the features. The other defects' rates, totals, cost, primary defect, IDs, date and item code are excluded, as the hashed SQL shows.
`sheet_area_m2` and `box_weight_kg` are derived only from the item spec. `paper_moisture_pct` is a measured-style input, not an outcome.
