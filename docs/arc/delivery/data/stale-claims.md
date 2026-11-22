# Stale claims after the switch to the m2_* models

Owner: data engineer. Written 2026-11-22. Read-only: nothing listed here was edited. Fixes belong to the owners of each file (designer, frontend, backend, release manager), and the compliance reviewer checks them.

## Current evidence

| Fact | Current value | Source |
|---|---|---|
| Models in use | `prepagent.m2_warp`, `m2_delam`, `m2_strength`, `m2_print`, `m2_crack` | Commit 312d120; `sql/optimize.sql`; `config/model-acceptance.json` (D4-2026-11-20-OM) |
| Holdout R², September 2026, 219 non-TEST lots | Warp 0.468, Delamination 0.519, Strength 0.388, Print 0.640, Crack 0.108 (two decimals: 0.47, 0.52, 0.39, 0.64, 0.11) | `config/model-acceptance.json`; re-measured today with ML.EVALUATE, jobs `arc_m0_audit_m2_eval_sep_p1_20261122T181054Z` and `arc_m0_audit_m2_eval_sep_p2_20261122T181058Z`, matching to four decimals |
| Replaced models, same lots | 0.402, 0.500, 0.297, 0.610, −0.014 | Same file, `models[].replaces` |
| Acceptance basis | All five m2 models score a higher R² than the model each replaces, and every R² is above 0. The October thresholds (0.60, 0.60, 0.45, 0.60, 0.30) are kept as reference values only and are not the acceptance test | `config/model-acceptance.json` `basis`, `requiredR2Note`; `src/model-acceptance.js` `isHoldoutSetAccepted` |
| Against the old October thresholds | Still 1 of 5 at or above (Print 0.640 ≥ 0.60). Warp, Delamination, Strength and Crack are below | Arithmetic on the values above. True, but it measures against a retired test, so the spec (C3) drops pass-level wording |
| Superseded 2026-11-23: the final reference is 7.3% moisture, 42.0% RH, 18.5 °C, 62.9 to 55.1 kg, 7.8 kg and ₹421 lower, awaiting Om (`PKBX0041-m2-rerun.md`, "Final reference"). Every "New value" below that quotes 61.9 / 53.7 kg or ₹437 must use the final figures | | |
| PKBX0041 proposed display reference (7.3% moisture, 42.0% RH, 24.5 °C), superseded | 61.9 kg / ₹3,299 → 53.7 kg / ₹2,862; 8.2 kg and ₹437 lower. Roll 162 → 170 °C, gum HIGH → MED, viscosity 32 → 45 s. All five risks fall, so there is no trade-off. Largest baseline risk is PRINT 1.754%, just ahead of DELAM 1.724% | Job `arc_pkbx0041_m2_moist73_rh420_t245_20261122T175518Z`, `PKBX0041-m2-rerun.md`. **Pending Om's sign-off on plant realism; not for the demo until signed** |
| PKBX0041 at 7.3% moisture and 86% RH | 88.9 → 72.4 kg; 16.5 kg and ₹879 lower | Job `arc_pkbx0041_m2_moist73_20261122T175049Z` |
| PKBX0041 at the October inputs (10.8%, 86%, 26 °C) | 103.4 → 80.2 kg; 23.2 kg and ₹1,035 lower (net of a ₹200 drying allowance) | Job `arc_pkbx0041_m2_moist108_20261122T175049Z` |
| "8,640 combinations" | Correct for PKBX0041's planned settings (48, 162, HIGH, 32, MED, 5, 60): 5 × 4 × 3 × 3 × 2 × 6 × 4. **The count depends on the planned settings**, from 2,160 to 12,960, because each planned value joins the grid only if it is not already on it. Every candidate is scored, and "3 changes max" applies only to the choice | `sql/optimize.sql` lines 40 to 46 and 102. The API does not return the count (C12) |
| September holdout impact | ₹7,934 net, 149 kg, 7.06% → 6.36%, 217 lots changed, 3 worse | `docs/evidence/impact-v2.json`; `prepagent.impact_lots_v2` (read today: 219 rows, ₹7,934, 148.9 kg, 3 worse) |
| Cloud Run limits | `momentum`: max 4 instances, session affinity on, Gemini cap 300. `prepagent`: max 2, cap 100 | `gcloud run services describe`, read today; `changes/2026-11-22-momentum-limits.md` |

## 1. Design screens

Light and dark HTML sources carry identical text on the same lines (`diff` of the extracted numeric text returned no differences), so each row covers `docs/arc/design/source/html/light/<Screen>.html`, `.../dark/<Screen>.html`, and the PNGs `docs/arc/design/light/<Screen>.png` and `docs/arc/design/dark/<Screen>.png`. Line numbers are in the HTML source. SVG text was extracted separately.

### Model trust panels

| Screen:line | Old text | Correct current value | Source |
|---|---|---|---|
| Arc-Answer-Chart:264 | "One of five models meets its pass level." | "All five models score higher than the ones they replaced." with "Delamination and Print gains are within noise. Crack stays low confidence." (proposed headline, needs founder sign-off) | `config/model-acceptance.json` `ownerDecision.basis`; spec C3 |
| Arc-Answer-Chart:266 | 0.40, 0.50, 0.30, 0.61, −0.01 | 0.47, 0.52, 0.39, 0.64, 0.11 | ML.EVALUATE jobs above |
| Arc-Answer-Chart:266 | "of 0.60", "of 0.60", "of 0.45", "of 0.60", "of 0.30" | Remove. These are retired reference thresholds | `requiredR2Note` |
| Arc-Answer-Chart:266, 267 | "Below pass level" ×3, "Meets pass level", legend "Tick" / "Pass level" | Remove | Spec AC2.3 |
| Main:303 | "Fit score on 219 test lots. Tick is the pass level." | "Fit score on 219 test lots." | Spec C3 |
| Main:306 to 327 | 0.40 / 0.50 / 0.30 / 0.61 / −0.01 with "needs 0.60 / 0.60 / 0.45 / 0.60 / 0.30" and "Below pass" ×3, "Meets pass" | 0.47 / 0.52 / 0.39 / 0.64 / 0.11, with no "needs" and no pass marks | As above |
| Main:330 | "Only Print passes. A supervisor approves every plan." | "A supervisor approves every plan." Drop "Only Print passes" | Retired test |
| NewLot-Settings:215 | "Tested on 219 lots. Tick is the pass level." | "Tested on 219 lots." | Spec C3 |
| NewLot-Settings:216 | 0.40 / 0.50 / 0.30 / 0.61 / −0.01, "of 0.60…", "Below pass level" ×3, "Meets pass level" | 0.47 / 0.52 / 0.39 / 0.64 / 0.11; no thresholds, no pass marks | As above |
| Insights:233 (SVG) | Bars labelled 0.40, 0.50, 0.30, 0.61, −0.01 and "needs 0.60 / 0.45 / 0.30"; aria-label "Test fit for the five models against their pass levels"; "Earlier check" markers | 0.47 / 0.52 / 0.39 / 0.64 / 0.11; remove "needs" labels and the pass-level wording. The "Earlier check" markers carry no text values; no current evidence for what they plot, so remove or relabel them as "Replaced model" using 0.40 / 0.50 / 0.30 / 0.61 / −0.01 | As above; `models[].replaces` |
| Insights:237 | "Only Print clears its pass level." | Remove | Retired test |
| Insights:237 | "Crack is below 0. Low confidence." | "Crack is 0.11. Low confidence." (m2_crack is above 0) | ML.EVALUATE job p2 |
| Arc-Lot-Approve:267 | "Four of five models miss their pass level. Crack is low confidence." | "Crack is low confidence. Delamination and Print gains are within noise." (spec C3 limits row) | Spec C3 |
| Arc-No-Data:270 | "Models at pass level" / "1 of 5" / "Held-out test" | "Model scores: 5 of 5 higher than the models they replaced", "Held-out test" | Spec J4; `config/model-acceptance.json` |
| Planning:274 | "Four of five models miss their holdout bar. Preflight cannot hide that." | Remove or reword without a pass count, for example "Crack is low confidence. Preflight cannot hide that." | Retired test |
| Planning:279 | "Today: Four of five models miss the holdout bar." | Same as above | Retired test |
| Plant-Explorer:210 | "Print: Meets its pass level" | Remove, or "Print: 0.64 on 219 test lots" | ML.EVALUATE job p2 |

### PKBX0041 reference case

These are already listed in `PKBX0041-m2-rerun.md` ("Places that show the old case values"). They are repeated here with HTML line numbers so this file stands alone. "New" is the proposed display reference, which is pending Om's sign-off.

| Screen:line | Old text | New value | Source |
|---|---|---|---|
| Arc-Lot-Compare:265, 266 | "100.4 → 83.0", "17.4 kg", "₹925" | 61.9 → 53.7, 8.2 kg, ₹437 | Job `arc_pkbx0041_m2_moist73_rh420_t245_20261122T175518Z` |
| Arc-Lot-Compare:271 | "32 s" → "35 s" | 32 s → 45 s | Same job |
| Arc-Lot-Compare:274 | "Strength risk rises 0.078 points. Total cost still falls." | Remove. Strength goes 0.710 → 0.706, so there is no trade-off | Same job |
| Arc-Lot-Approve:265, 266 | "32 → 35 s"; "Strength risk rises 0.078 points. Total cost falls." | 32 → 45 s; no trade-off line | Same job |
| Arc-Phone:268 | "86 %" | 42 % | `PKBX0041-m2-rerun.md` Step 1 |
| Arc-Phone:276 | "Strength risk +0.078 points" (under "Trade-off") | Remove | Same job |
| Arc-Answer-Value:267 | "86 %" | 42 % | Step 1 |
| Arc-Lot-Conditions:265 | "86" | 42 | Step 1 |
| Arc-No-Data:269 | "Scrap for PKBX0041", "100.4 → 83.0 kg" | Not shown until the m2 result is stored and reviewed (spec J4); then 61.9 → 53.7 kg | Spec J4; same job |
| Insights:213, 214 | "83.0", "Down from 100.4 kg", "₹925" | 53.7, "Down from 61.9 kg", ₹437 | Same job |
| Insights:220, 221 | "100.4 kg" / "83.0 kg", "₹5,351" / "₹4,426" | 61.9 kg / 53.7 kg, ₹3,299 / ₹2,862 | Same job |
| Insights:226 | "Three settings, one trade-off" | "Three settings, no trade-off" | Same job |
| Insights:227, 228 | "32 → 35 s"; "Strength +0.078 points. Total cost falls." | 32 → 45 s; remove the strength line | Same job |
| Insights:241, 242 | "What moved the Warp estimate": Humidity +0.751, Drying time +0.162, Gum application −0.137 pts | No current evidence; remove or relabel. The values come from the 2026-10-16 m_* explanation at 86% RH and 10.8% moisture (`test/fixtures/explanation-pkbx0041-20261016.json`). `sql/explain.sql` was NOT RUN on m2_*. Warp is also no longer the largest baseline risk in the new reference | Fixture; same job |
| Main:226 | "Prepared reference run, PKBX0041", "100.4 → 83.0" | 61.9 → 53.7 | Same job |
| Main:249, 255, 296 | "32 → 35 s" | 32 → 45 s | Same job |
| Main:290 | "Humidity 86% confirmed. Paper moisture 7.3% is an example." | "Humidity 42% confirmed. Paper moisture 7.3% is an example." | Step 1 |
| Main:334 | "Humidity 86%" | 42% | Step 1 |
| NewLot-Approve:186 | "Humidity 86%, moisture 7.3% (example)." | "Humidity 42%, moisture 7.3% (example)." | Step 1 |
| NewLot-Approve:188 | "35 s", "was 32 s" | 45 s, was 32 s | Same job |
| NewLot-Approve:206 | "100.4 → 83.0" | 61.9 → 53.7 | Same job |
| NewLot-Conditions:186 | "86" | 42 | Step 1 |
| NewLot-Recovery:195, 196 | "32 s" → "35 s"; "100.4 → 83.0" | 32 s → 45 s; 61.9 → 53.7 | Same job |
| NewLot-Settings:186, 187 | "100.4 → 83.0", "17.4 kg", "₹925" | 61.9 → 53.7, 8.2 kg, ₹437 | Same job |
| NewLot-Settings:189, 190 | "100.4 kg" "₹5,351"; "83.0 kg" "₹4,426" | 61.9 kg ₹3,299; 53.7 kg ₹2,862 | Same job |
| NewLot-Settings:196 | "32 s" → "35 s" | 32 s → 45 s | Same job |
| NewLot-Settings:210, 221 | "Strength risk rises 0.078 points" (twice) | Remove | Same job |
| NewLot-Stale:192 | "35 s", "was 32 s" | 45 s, was 32 s | Same job |
| Operator-Phone:184 | "35", "was 32 s" | 45, was 32 s | Same job |
| Plant-Explorer:191 | "86% humidity" | 42% humidity | Step 1 |
| Plant-Explorer:200 | "was 32 s", "35 s" | was 32 s, 45 s | Same job |
| Plant-Explorer:204 | "Modeled lots, humid days" | "Modeled lots" (42% RH is not a humid day) | Step 1 |
| Plant-Explorer:210 | "Strength: Risk rises 0.078 points" | Remove | Same job |
| Prep-Flow:217 | "Acceptable trade-off? Strength risk +0.078 points." | Remove | Same job |

### "8,640"

| Screen:line | Old text | Correct current value | Source |
|---|---|---|---|
| Arc-Lot-Compare:262 | "Arc checked 8,640 combinations. Up to 3 changes allowed." | Correct for PKBX0041 only. Show the count the optimizer returns, or "Up to 3 changes allowed." until it does (C12) | `sql/optimize.sql` lines 40 to 46 |
| NewLot-Settings:194, 221 | "8,640 combinations checked…", "3 changes from 8,640 combinations." | Same | Same |
| NewLot-Recovery:191 | "Done, 8,640 combinations" | Same | Same |
| Main:334 | "8,640 combinations" | Same | Same |
| Prep-Flow-Partial:198, 204 | "8,640 tries, 3 changes max", "8,640 setting combinations checked" | Same | Same |
| Prep-Flow:204 | "8,640 tries, 3 changes max" | Same | Same |
| Planning:279 | "The solver tries 8,640 options, three changes at most." | Wrong as a general statement: the grid is 2,160 to 12,960 depending on the planned settings. Reword without a number | Same |

### Other figures on Insights

| Screen:line | Old text | Correct current value | Source |
|---|---|---|---|
| Insights:251 | "43 passed", "2 known issues", "Release checks 27 of 27. Software only." | No current evidence; remove or relabel. No record of these counts exists in the repo. The full suite was not run as evidence for this audit (NOT RUN) | Search of tracked files, 2026-11-22 |
| Insights:253 | "2 pages", "16,994 bytes", "Stored and matched in one test order." | 16,994 bytes matches one stored card, `jobcards/` object dated 2026-10-16T13:08:27Z, an m_*-era job. Page count: no current evidence (the API returns none, C11). Label it as the 16 October test order, or remove it | `gcloud storage ls -l` on `gs://prepagent-hack-data/jobcards/` |

Unchanged and still correct: "7 of 10" (photo check, README), "219 test lots, September 2026", 162 → 170 °C, HIGH → MEDIUM, "3 of 7 settings", "1,300 boxes".

## 2. README and docs

| Location | Old text | Correct current value | Source |
|---|---|---|---|
| `README.md:26` | "100.4 kg / ₹5,351 baseline … 83.0 kg / ₹4,426 … 17.4 kg and ₹925 estimated reduction" | Pending Om: 61.9 kg / ₹3,299 → 53.7 kg / ₹2,862, 8.2 kg and ₹437, on the m2_* models at 7.3% / 42% / 24.5 °C. Until Om signs off, label the current text as a 15 October m_* result at 10.8% moisture | `PKBX0041-m2-rerun.md` |
| `README.md:54` | "Cloud Run maximum: **2 instances**. Gemini limit: **100 attempted calls per Asia/Kolkata day**" | `momentum`: 4 instances, 300 calls a day. `prepagent`: 2 and 100 | `gcloud run services describe`, 2026-11-22 |
| `docs/README.md:42` | "Cloud Run maximum: two instances. Shared Gemini usage limit: 100 attempted calls…" | Same as above. "Shared" also needs care: both services count against the same Firestore day document but have different caps | Same; `src/google-cloud/firestore-gemini-attempt-store.js` |
| `docs/evidence/model-card-v2.md:3` | "The current models are unchanged and are still the ones the app uses. Switching to a candidate needs Om's separate D4 decision." | The m2_* models are in use since D4-2026-11-20-OM (commit 312d120) | `config/model-acceptance.json` |
| `docs/evidence/humidity-sweep.json:10 to 14` | Sweep run on `prepagent.m_*` (generated 2026-11-19) | Superseded. The m2 humidity response is in `model-card-v2.md` ("Humidity response"). No current m2 sweep file; mark this file as m_* or re-run | File contents |
| `config/model-feature-importance-observation.json` | Feature importance for `m_warp` … `m_crack`, version "1", observed 2026-10-14 | m2 feature importance is only in `docs/evidence/model-candidates-v2.json`. No config record covers the models in use | File contents |

## 3. Code: UI strings, comments and SQL

| Location | Old text | Correct current value | Source |
|---|---|---|---|
| `src/ui/workflow.js:1933` (`DEMO_LOT`) | RH "86", temperature "26", moisture "10.8" | Pending Om: RH "42", temperature "24.5", moisture "7.3". On m2_*, the current inputs give 23.2 kg / ₹1,035, not the README's 17.4 kg / ₹925 | `PKBX0041-m2-rerun.md` |
| `src/ui/workflow.js:1930` (comment) and `:1975` ("Demo values · monsoon day") | "a humid monsoon day's conditions" | Untrue once `DEMO_LOT` moves to 42% RH; reword then | Step 1 |
| `src/operator-ui.js:73` (evaluator guide) | "The demo lot uses a sample order and a humid monsoon day." | Same dependency on `DEMO_LOT` | Same |
| `src/ui/components.js:77` (comment) | "the crack model has the weakest fit (D4, R² 0.30)" | m2_crack R² 0.108 on the September holdout (0.30 was m_crack on the October internal split). The on-screen caveat "low confidence in monsoon" is still consistent | ML.EVALUATE job p2 |
| `src/job-sheet-pdf.js:207` (comment) | Same "R² 0.30" | Same | Same |
| `sql/optimize.sql:6` (comment) | "BASELINE 10.18% / 100.4 kg / 5351; BEST roll 170, gum MED, viscosity 35 -> saves 17.4 kg / 925" | m2_* at the same inputs: 10.48% / 103.4 kg / ₹5,509; BEST gum MED, viscosity 45, drying 6 h; saves 23.2 kg / ₹1,035 | Job `arc_pkbx0041_m2_moist108_20261122T175049Z` |
| `sql/model_evaluation.sql` (whole file) | Evaluates `m_warp` … `m_crack` on their saved split | The models in use are m2_*. The current evaluation is ML.EVALUATE over September 2026 non-TEST lots, as in the two audit jobs | Jobs p1, p2 |
| `ops/evaluation-proposed/m_*.sql` | Prepared evaluations of the m_* models | Same; no m2 equivalent exists | File contents |
| `src/model-evidence-bundle.js:50, 107 to 108` | Expects `prepagent.m_<defect>` and rejects R² below the October thresholds (`MODEL_THRESHOLD_NOT_MET`) | Can never validate the m2 set: four of five m2 R² values are below those thresholds, and the resource names differ. `tools/validate-model-evidence.mjs` inherits this | Code read; values above |
| `GET /api/status` → `modelAcceptance` (`src/model-acceptance.js` `getModelAcceptanceSummary`) | Returns `requiredR2` (0.6, 0.6, 0.45, 0.6, 0.3) and `prototypeThresholdsMet: false` beside `status: "accepted"` | The values are correct, but any client that draws "needs 0.60" or a pass tick from them reproduces the stale designs. Arc must read `r2` and `status` only (spec AC2.3) | Code read |

## 4. Tests, fixtures and tools

Six test files were run locally to see what they assert: `model-acceptance`, `model-acceptance-readme`, `model-acceptance-sql`, `optimizer-acceptance-tool`, `model-evidence-bundle` and `impact-summary-service` (`node --test`, 34 tests, 34 pass, 0 fail). They pass because they check stored historical records and mocked responses, not the live m2 behaviour.

| Location | Old value | Correct current value | Source |
|---|---|---|---|
| `tools/validate-optimizer-acceptance.mjs:4` and `test/optimizer-acceptance-tool.test.js` | Frozen October expectations (10.18% / 100.4 kg / ₹5,351, viscosity 35, saves 17.4 kg / ₹925) | The m2 outputs fail it: 14 fields differ at 10.8% and 11 at 7.3% (`PKBX0041-m2-rerun.md`). Keep it as a record of the October job, or add an m2 expectation set from job `arc_pkbx0041_m2_moist108_20261122T175049Z` | Rerun record |
| `test/fixtures/optimizer-pkbx0041-cli-result.json:54` | scrap_kg "100.4" (October job output) | Historical record of job `ustad_pkbx0041_acceptance_100m_20261015`; correct as a record, not current | Job record |
| `test/fixtures/explanation-pkbx0041-20261016.json:3, 28, 41, 90, 91, 312` | Gemini text "8.42% (83 kg, costing 4426 INR)", RH 86, warp attribution 0.751. The text also calls modeled lots "actual observed runs" | Historical m_* record. The m2 explanation was NOT RUN, so there is no current value. The "actual observed runs" wording breaks the provenance rule and must not be reused as an example of good output | Fixture |
| `test/browser/frontend.spec.js:11` | Impact mock: lotsChanged 207, netSavingMonth 7320, kgSavedMonth 138, scrapPctAfter 6.39 (m_* `impact_lots`) | 217, 7,934, 149, 6.36 (`impact_lots_v2`). The scrapCost fields in the mock were not re-checked | `docs/evidence/impact-v2.json` |
| `test/impact-summary-service.test.js:11, 68`; `test/impact-ui.test.js:15` | kg_saved 138, scrapPctAfter 6.39 | 149, 6.36 if the mocks are meant to mirror production. They are mocks, so this is optional | Same |
| `test/risk-prediction-service.test.js:25, 77, 123, 343`; `test/risk-prediction-isolation.test.js:50, 272`; `test/risk-evidence-service.test.js:28`; `test/risk-optimization-service.test.js:44` and the `m_warp` SQL strings from line 132 | 10.18 / 100.4 / 5351 and `prepagent.m_warp` in mocked SQL | Mock data shaped like the October run. Not a claim of current values. Relabelling is optional | Code read |
| `test/model-acceptance.test.js:80, 124, 125` | CRACK 0.3010715689792366, STRENGTH 0.4672613 | Correct values of `previousAcceptance` (m_* internal split). The tests check the historical record; not stale as long as the test names say so | `config/model-acceptance.json` |
| `test/model-acceptance-sql.test.js:5` | Asserts `sql/model_evaluation.sql` covers `m_warp` … `m_crack` | Tests an evaluation file for replaced models (see section 3) | Code read |

## 5. Delivery docs written before today's changes

| Location | Old text | Correct current value | Source |
|---|---|---|---|
| `docs/arc/delivery/01-business-requirements.md:58 to 62` | PKBX0041 100.4 / 83.0 kg, ₹925, "has not been re-run on them" | The re-run now exists (`PKBX0041-m2-rerun.md`); see "Current evidence" | Rerun record |
| `01-business-requirements.md:86` (C8) | "The Gemini cap is 100 attempted calls per Asia/Kolkata day" | 300 on `momentum`, 100 on `prepagent` | Cloud Run read, 2026-11-22 |
| `01-business-requirements.md:87` (C9), `:115` (R2) | "limited to 2 instances", "one of the two instances" | `momentum`: up to 4 instances, session affinity on (best-effort) | Same |
| `01-business-requirements.md:54` (O10) | "inside the 100-attempt daily cap" | 300 on `momentum` | Same |
| `docs/arc/delivery/02-product-spec.md:388`, `:454` | PKBX0041 row "re-run … in progress"; Q6 "is re-running" | Done: jobs listed in `PKBX0041-m2-rerun.md`. The row can point to the proposed reference, pending Om and the compliance review | Rerun record |
| `02-product-spec.md:389` (and C12, line 410) | "8,640 … No source found in `src/` or `sql/`" | Source found: `sql/optimize.sql` grid, 8,640 for PKBX0041's planned settings only. The proposed C12 fix (return the count) still stands | `sql/optimize.sql` lines 40 to 46 |
| `02-product-spec.md:415` (C17), `:495` | "Cloud Run runs up to 2 instances with no session affinity" | Up to 4 instances with session affinity on `momentum` | Cloud Run read, 2026-11-22 |
