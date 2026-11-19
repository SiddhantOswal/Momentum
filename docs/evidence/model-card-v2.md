# Momentum scrap models: model card v2 (20 Nov 2026)

Status: five candidate models (`m2_*`, configuration A) were trained on 20 Nov 2026 with Om's approval and tested against the current models (`m_*`). The current models are unchanged and are still the ones the app uses. Switching to a candidate needs Om's separate D4 decision.

Machine-readable results: `docs/evidence/model-candidates-v2.json`. Training and evaluation SQL: `sql/model_v2_training.sql`.

## What each model predicts

Each model takes one planned lot and predicts the scrap rate, as a % of the lot, for one defect. A lot here means the item spec, the paper type and supplier, the shift, the factory humidity and temperature, the paper moisture, and the corrugator and printer settings.

| Model | Predicts |
|---|---|
| WARP | Warp: boards that bow or twist after the corrugator |
| DELAM | Delamination: liner separating from flute (a weak glue bond) |
| STRENGTH | Strength failure: boxes below the required crush strength |
| PRINT | Print defects: smudge, misregister, poor ink cover |
| CRACK | Cracking: board cracking at creases and folds |

All models are BigQuery ML boosted trees, trained on lots modelled on our plant.

## How the test works

- **Test set:** every lot run from 1 Jul to 30 Sep 2026 (640 lots). All ran at 75–98 % humidity, so this is a monsoon test.
- **Candidates:** trained only on lots before 1 Jul 2026. They have never seen any test lot.
- **Current models:** trained on lots before 1 Sep 2026 with a random 80/20 split, so about 80 % of the July and August test lots were in their training data. Their Jul–Sep score is flattering.
- **September 2026 (219 lots) is the fair comparison.** Neither model saw it. The current models even have two more months of recent data than the candidates.
- **RH-band average:** a simple reference that predicts the average scrap seen in training at the lot's humidity band. A useful model has to beat it.

## Holdout accuracy, before and after

R², with MAE in percentage points in brackets. Higher R² and lower MAE are better.

| Defect | Current, Jul–Sep (flattering) | Candidate, Jul–Sep | **Current, Sep (fair)** | **Candidate, Sep (fair)** | RH-band average, Sep |
|---|---|---|---|---|---|
| WARP | 0.570 (0.286) | 0.445 (0.327) | 0.402 (0.330) | **0.468 (0.317)** | 0.011 (0.530) |
| DELAM | 0.690 (0.407) | 0.568 (0.461) | 0.500 (0.539) | **0.519 (0.499)** | -0.013 (0.989) |
| STRENGTH | 0.494 (0.149) | 0.487 (0.152) | 0.297 (0.190) | **0.388 (0.171)** | 0.014 (0.289) |
| PRINT | 0.717 (0.258) | 0.601 (0.275) | 0.610 (0.292) | **0.640 (0.262)** | -0.006 (0.846) |
| CRACK | 0.043 (0.132) | 0.066 (0.135) | -0.014 (0.141) | **0.108 (0.137)** | 0.002 (0.164) |

**How sure are we?** On the same 219 September lots, compared lot by lot:
- STRENGTH: the candidate is clearly better, by about 3.5 standard errors.
- WARP: the candidate is better on squared error, by about 2 standard errors.
- DELAM and PRINT: the candidate has a lower MAE (about 2 and 1.8 standard errors), but the gain is within noise on squared error.
- CRACK: the candidate's gain is small and not statistically clear.

## Humidity response (PO1, RH 40 to 95 %)

The largest jump between two neighbouring 5 % humidity steps, with all other inputs fixed to PO1:

| Defect | Current: largest jump | Candidate: largest jump | Candidate range, 40→95 % RH |
|---|---|---|---|
| WARP | 1.12 pp (75→80) | 0.83 pp (75→80) | 1.48 → 3.63 % |
| DELAM | 0.56 pp (65→70) | 0.47 pp (70→75) | 1.89 → 2.72 % |
| STRENGTH | 0.27 pp (80→85) | 0.24 pp (80→85) | 0.71 → 1.12 % |
| PRINT | 0.41 pp (80→85) | 0.31 pp (90→95) | 1.92 → 2.50 % |
| CRACK | 0.10 pp (75→80) | 0.09 pp (60→65) | 0.63 → 0.85 % |

- Every candidate jumps less than the current model, and none jumps more than 1 pp.
- The WARP candidate now climbs over 65–85 % RH instead of all at once at 80 %.
- The response still comes in steps, with flat stretches below 65 % RH. Boosted trees work that way.

## Top 5 drivers per candidate

| Defect | Drivers, strongest first |
|---|---|
| WARP | ambient RH, RH × paper moisture, gum application, top liner gsm, drying hours |
| DELAM | RH × paper moisture, gum application, recycled paper, corrugator speed, ambient RH |
| STRENGTH | ambient RH, paper type, recycled paper, RH × paper moisture, pasting pressure |
| PRINT | ink colours, ink coverage, flute profile, ply, box weight |
| CRACK | ambient RH, RH × paper moisture, paper type, shift, inner liner gsm |

These match what a plant engineer would expect:
- Humidity and moisture pickup drive warp, delamination and strength.
- The glue settings matter for warp and delamination.
- Print defects come from ink load and board build.

The new "RH × paper moisture" and "recycled paper" features appear among the top drivers for four of the five models.

## What changed from the current models

- Trained on a time split (before 1 Jul 2026) instead of a random split.
- Customer ID removed: a customer code does not cause scrap.
- New features, all computed from columns we already record:
  - humidity band
  - humidity × paper moisture
  - dew point
  - recycled-paper flag
  - board gsm per m²
  - gum viscosity × roll temperature
- The features are built inside the model, so the app sends the same inputs as today.
- Smoother settings:
  - tree depth 4 (was 6)
  - learning rate 0.1 (was 0.3)
  - 60 trees
  - 80 % row and column sampling
  - stronger L2
  - at least 20 lots per leaf
- Only this one configuration was trained.

## Training cost

BigQuery ML billed **85.3 GB** for the five training jobs:

| Model | Billed |
|---|---|
| WARP | 31.7 GB |
| DELAM | 13.5 GB |
| STRENGTH | 13.4 GB |
| PRINT | 13.4 GB |
| CRACK | 13.3 GB |

The read-only evaluation queries billed 0.40 GB in total.

## Limits

- The data is modelled on our plant and its suppliers, so the models describe this plant and are not general corrugator rules.
- The out-of-time test covers monsoon months only (RH 75–98 %). Dry-season accuracy was not re-tested out of time.
- September has only 219 lots, so differences of 0.02–0.03 in R² (DELAM, PRINT) are within noise.
- Crack predictions stay low confidence. Even the better candidate explains only about 11 % of the variation in monsoon crack scrap.
- On the Jul–Sep window the current models score higher, but only because they had already seen most of those lots.

## Recommendation per defect (for Om's D4 decision)

| Defect | Recommendation | Why |
|---|---|---|
| WARP | **Switch to `m2_warp`** | Fair R² 0.468 vs 0.402, and the humidity jump is 0.83 pp vs 1.12 pp. Meets both parts of the rule. |
| DELAM | **Switch to `m2_delam`** (marginal) | Fair R² 0.519 vs 0.500 and a lower MAE. Meets the rule, but the gain is small. |
| STRENGTH | **Switch to `m2_strength`** | Fair R² 0.388 vs 0.297. This is the clearest gain. |
| PRINT | **Switch to `m2_print`** (marginal) | Fair R² 0.640 vs 0.610 and a lower MAE. Meets the rule, but the gain is small. |
| CRACK | **Switch to `m2_crack`**, keep the low-confidence label | Fair R² 0.108 vs -0.014. It is the first crack model to do better than a constant on monsoon lots. |

These are recommendations only. Before switching, `sql/explain.sql` and its labels should be checked, because its explanations would now name the new features (for example "RH × paper moisture").
