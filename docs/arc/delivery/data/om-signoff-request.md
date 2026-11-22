# Questions for Om: plant realism sign-off (ARC-M0-04)

From: delivery lead, 2026-11-23. Needed by 26 November, because Arc's new-lot screens and the reference case depend on them. Each question gives the current figure, where it came from and what we propose. A short answer to each is enough: "yes", "no, use X" or "not sure".

All figures are model estimates from the m2_* models on modeled lots. None is a plant measurement, and the screens will say so.

## 1. PKBX0041 reference case

The proposed on-screen reference is PKBX0041 at 7.3% paper moisture, 42.0% RH and 18.5 °C (`PKBX0041-m2-rerun.md`, "Final reference").

| | Baseline | Recommended |
|---|---|---|
| Roll temperature | 162 °C | 170 °C |
| Gum application | HIGH | MED |
| Gum viscosity | 32 s | 45 s |
| Other levers (single facer 48 m/min, pasting MED, drying 5 h, print 60 sheets/min) | unchanged | unchanged |
| Estimated scrap | 6.38%, 62.9 kg, ₹3,355 | 5.58%, 55.1 kg, ₹2,934 |

The estimate is 7.8 kg and ₹421 lower, and all five defect risks fall.

- **1a.** Is 18.5 °C with 42% RH a realistic winter day on your floor for paper at 7.3% moisture? In the modeled history, the median for 364 December to February lots at 7.0 to 7.6% moisture is 18.35 °C and 43.15% RH.
- **1b.** Are the recommended settings (roll 170 °C, gum MED, viscosity 45 s) ones your crew would actually run on this box?
- **1c.** DELAM leads PRINT as the main risk by only 0.025 points, so we plan not to call either the "main" defect on screen. Do you agree?

## 2. Paper moisture default

Arc pre-fills paper moisture at 7.3%, labelled "Example". The operator can always change it, and the entered value is the one used.

- **2.** Is 7.3% a sensible example for your mill paper? The modeled November median is 8.72%, and 7.3% is typical of December to February.

## 3. Weather as a stand-in for floor conditions

Arc fills humidity and temperature from the public weather record for Pune, labelled "Public weather record, not a plant sensor", with the time it was read. The operator can edit both values.

- **3a.** Is the plant in or near Pune? If not, which city should we use?
- **3b.** How far is your floor from outdoor conditions? Typical gaps would help, for example "floor RH is about 10 points higher in monsoon". We will show the outdoor value only as a starting point.

## 4. Model score headline

Arc and the dashboard would say: "All five models score higher than the ones they replaced." Below it: "Delamination and Print gains are within noise. Crack stays low confidence." The holdout R² values are warp 0.468, delam 0.519, strength 0.388, print 0.640 and crack 0.108. The replaced models scored 0.402, 0.500, 0.297, 0.610 and −0.014.

- **4.** Does this match your basis for decision D4-2026-11-20-OM? Should anything be worded differently?

## 5. The lot generator

The modeled lots (`prepagent.lots`, seed 20261010) came from `generator.ts` in `sid_pack.zip`, which is not in the repository.

- **5.** Do you have that file? We need it so the data can be reproduced.

## What happens with the answers

Each answer goes into the STATUS decision log with your name and the date. Until you sign off, the reference case stays hidden from the demo screens, and only live plan results are shown.
