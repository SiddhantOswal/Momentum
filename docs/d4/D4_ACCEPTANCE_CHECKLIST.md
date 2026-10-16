# D4: Acceptance checklist

Applies to all five models (`m_warp`, `m_delam`, `m_strength`, `m_print`, `m_crack`, Vertex v1).

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Exact model resource identified | **PASS** | bq show --model; JSON bigqueryModel |
| 2 | Exact current model version identified | **PASS** | Vertex prepagent_* v1; trainingRuns = 1 |
| 3 | Metrics genuinely associated with that version | **PASS** | ML.EVALUATE on that model; single training run; Vertex v1 created inside the training job |
| 4 | Observed R² meets approved threshold | **PASS** | Internal R² vs D4 bars (all 5) |
| 5 | Evaluation sample count genuine and documented | **PARTIAL** | Internal split: NOT RECOVERABLE (tables deleted). Holdout: exact, 219 |
| 6 | Evaluation membership defined and verifiable | **PARTIAL** | Internal: RANDOM 20%, not reproducible. Holdout: date-defined, query 6 |
| 7 | Source dataset identified | **PASS** | prepagent.lots; origin documented |
| 8 | Date ranges documented and verified | **PASS** | Query 3: 2024-10-01..2026-08-31 / 2026-09-01..30 |
| 9 | Stable or reproducible provenance | **PASS** | Job IDs, SQL hashes, data fingerprints, queries 1–6 |
| 10 | Training/evaluation separation defensible | **PASS** | SQL date filter + max training date 2026-08-31; RANDOM split inside the window |
| 11 | Feature importance linked to the version | **PASS** | ML.FEATURE_IMPORTANCE on v1 models |
| 12 | Feature importance reviewed by owner | **PASS** | D4_FEATURE_IMPORTANCE_REVIEW.md |
| 13 | No unresolved critical leakage/validity defect | **PASS** | Exclusions verified; customer_id noise accepted |
| 14 | Limitations disclosed | **PASS** | Report: holdout drop, crack low confidence, strength weak, data origin |
| 15 | Independently verifiable against backend contract | **PASS*** | D4_MODEL_EVIDENCE.json; *field mapping to the backend schema to be confirmed by Codex |

## Per-model outcome
| Model | Status | Note |
|---|---|---|
| warp | **ACCEPT** | Holdout R² 0.40 disclosed |
| delam | **ACCEPT** | Holdout R² 0.50 disclosed |
| strength | **ACCEPT (limited)** | Weak model; small share of scrap |
| print | **ACCEPT** | Holds up on holdout (0.61) |
| crack | **ACCEPT (low confidence, flagged)** | No skill within the monsoon month; UI flag required |

## Overall
**ACCEPT FOR PROTOTYPE, with one open item.** Items 5 and 6 are PARTIAL because the internal-split counts cannot be recovered without retraining, and retraining is not permitted. The independent holdout evaluation, with exact counts, is provided in their place.
If the validator requires internal counts specifically, the remaining action is a project-owner decision to accept the holdout evaluation as count evidence (owners: Om and Siddhant).

## Conditions of acceptance
1. All recommendations are approved by a supervisor.
2. Values are shown as predicted or estimated.
3. Crack is shown as low confidence in monsoon.
4. Models are unchanged (`trainingRuns = 1`, Vertex v1).
