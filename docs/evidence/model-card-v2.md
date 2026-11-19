# Momentum scrap models: model card v2 (20 Nov 2026)

Status: the current models were scored on a time holdout. The v2 candidates are designed and their SQL is ready, but they are **not trained yet**. Training costs far more than expected (see "Why the candidates are not trained"), so it needs Om's go-ahead on a budget first.

Machine-readable results: `docs/evidence/model-candidates-v2.json`. Training SQL: `sql/model_v2_training.sql`.

## What each model predicts

Each model takes one planned lot (the item spec, paper type and supplier, shift, factory humidity and temperature, paper moisture, and the corrugator and printer settings) and predicts the scrap rate, as a % of the lot, for one defect:

| Model | Predicts |
|---|---|
| `m_warp` | Warp: boards that bow or twist after the corrugator |
| `m_delam` | Delamination: liner separating from flute (a weak glue bond) |
| `m_strength` | Strength failure: boxes below the required crush strength |
| `m_print` | Print defects: smudge, misregister, poor ink cover |
| `m_crack` | Cracking: board cracking at creases and folds |

All models are BigQuery ML boosted trees, trained on 5,350 lots modelled on our plant (Oct 2024 to Sep 2026).

## Holdout accuracy: current models

Test set: every lot run from 1 Jul to 30 Sep 2026 (640 lots). All of them ran at 75 to 98 % humidity, so this is a monsoon test.

The current models were trained on lots before 1 Sep 2026, with a random 80/20 split. That means about 80 % of the July and August test lots were already in their training data, so the Jul–Sep score is flattering. September 2026 (219 lots) is the only clean out-of-time check.

| Defect | Recorded R² (random split) | Jul–Sep R² | Jul–Sep MAE (pp) | Sep only R² (clean) | Sep only MAE (pp) | RH-band average R² |
|---|---|---|---|---|---|---|
| WARP | 0.605 | 0.570 | 0.286 | 0.402 | 0.330 | -0.012 |
| DELAM | 0.666 | 0.690 | 0.407 | 0.500 | 0.539 | -0.006 |
| STRENGTH | 0.467 | 0.494 | 0.149 | 0.297 | 0.190 | 0.011 |
| PRINT | 0.751 | 0.717 | 0.258 | 0.610 | 0.292 | -0.010 |
| CRACK | 0.301 | 0.043 | 0.132 | -0.014 | 0.141 | -0.001 |

The "RH-band average" column is a simple reference: for each lot it predicts the average scrap rate seen in training at that humidity band. Any useful model has to beat it.

What this shows:
- On new months the models are less accurate than the recorded R² suggests. On the clean September lots, R² falls by roughly 0.1 to 0.3.
- WARP, DELAM, PRINT and STRENGTH still beat the humidity-band average by a wide margin.
- On monsoon lots, CRACK is no better than a constant guess. Treat crack predictions as low confidence.

## Candidate v2 design (not trained yet)

- **Time split.** Train on lots before 1 Jul 2026 and test on Jul–Sep 2026. No test lot is seen in training.
- **Customer ID removed.** A customer code does not cause scrap, and it cannot help with a new customer.
- **New features**, each computed from columns we already record:
  1. Humidity band: up to 50, 50–70, 70–85, or over 85 % RH.
  2. Humidity × paper moisture: how much moisture the paper picks up.
  3. Dew point, from humidity and temperature.
  4. Recycled-paper flag.
  5. Board weight per m² (gsm).
  6. Gum viscosity × roll temperature: how well the glue bond cures.
- **Same inputs as today.** The features are built inside the model's TRANSFORM step, so the app can send exactly what `predict.sql` sends now.
- **Month and season not used.** The app does not send a run date. In our data, the monthly scrap pattern follows humidity, which the model already sees.
- **Smoother settings.** Two configurations per defect: shallower trees (depth 4 or 3 instead of 6), a lower learning rate (0.1 instead of 0.3), row and column subsampling, stronger L2, and a minimum lot count per leaf. These are meant to reduce the humidity steps seen in the sweep (WARP jumps 1.12 pp between 75 and 80 % RH).
- **Checks after training:** score current and candidate models on the same 640 lots, run the humidity sweep (RH 40 to 95, PO1 inputs), and list the top 5 drivers per model.

## Why the candidates are not trained

A BigQuery dry run reports about 1.5 MB per training job. But BigQuery ML bills boosted-tree training by compute, and the real charge is far higher: the October 2026 training of the five current models billed **96.1 GB** (7.4 to 49.7 GB per model). That is well above the 200 MB per-query limit and the "keep it small" budget for this task, so no training job was run.

**Suggested next step:** if Om agrees, train only `m2_warp` (configuration A) first as a cost check, then decide on the rest.

## Limits

- The data is modelled on our plant and its suppliers, so the models describe this plant and are not general corrugator rules.
- The test months are monsoon only (RH 75 to 98 %). Accuracy in dry months was not re-tested out of time.
- Crack predictions are low confidence, especially in the monsoon.
- Boosted trees produce step-shaped responses. Even smoother candidates will move in steps when humidity changes, not along a curve.

## Recommendation per defect

No candidate has been trained, so **keep the current model for all five defects**. Any switch to a candidate needs Om's separate D4 approval.

| Defect | Now | After candidates are trained, switch if |
|---|---|---|
| WARP | Keep `m_warp` | The candidate beats 0.402 R² on the clean September lots and has a smaller humidity jump than 1.12 pp |
| DELAM | Keep `m_delam` | The candidate beats 0.500 R² on September |
| STRENGTH | Keep `m_strength` | The candidate beats 0.297 R² on September |
| PRINT | Keep `m_print` | The candidate beats 0.610 R² on September |
| CRACK | Keep `m_crack`, shown as low confidence | The candidate reaches a positive R² on the monsoon test; otherwise show the RH-band average instead |
