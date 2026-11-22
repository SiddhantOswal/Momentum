# 01. Business requirements: Arc by Momentum

Status: draft for founder review. Author role: business analyst. Date: 2026-11-22. Branch: `arc/m0-discovery`.

Each statement names its source. "Assumption" marks anything not yet backed by evidence, and each one needs a founder decision (section 7). No targets in this document have been measured yet.

Amended 2026-11-23 for ticket ARC-M0-06 (product manager): O10 and constraint C8 follow founder decisions A3 and A6 and the raised cap on `momentum`. Q1 to Q6 in section 7 were answered on 2026-11-22; the answers are in `02-product-spec.md` section 9.

## 1. Business need

**What Momentum does today (manual route).** The manual route takes an approved purchase order (PO) to a stored job card through ten stages: PO upload, Gemini extraction, catalog validation, confirmed conditions, five defect-risk estimates, constrained optimization, a grounded explanation, a draft JobSheet, supervisor approval and a stored PDF (README.md, "How it works"; `src/job-coordinator.js`). In the approved New Lot design these become four steps across separate panels: Order, Conditions, Settings and risk, Review and approve (`docs/arc/design/light/NewLot-*.png`). The Conditions step alone asks for 12 fields, 7 of which are empty or unconfirmed at the start (`NewLot-Conditions.png`).

**The problem.** At a small corrugated plant the person preparing a lot is usually also running the floor. The manual route asks them to move through several panels, check values against the PO and type up to 12 values before planning can start. Questions about the data ("how far can I trust the models?", "what is the moisture today?") are answered on other screens: Insights, Plant Explorer and Photo Diagnosis.

**What Arc adds.** Arc is a side panel that runs the same work through a few messages. It reads the order, matches the catalog, fills and confirms conditions, runs the plan, explains it, prepares the draft, and issues and checks the PDF (CLAUDE.md section 4; `Arc-Start.png` to `Arc-Lot-Receipt.png`). It also answers in-scope questions about lots, data, models, defects and job cards, refuses off-topic questions, and says plainly when the data cannot answer a question (`Arc-Answer-*.png`, `Arc-Out-Of-Scope.png`, `Arc-No-Data.png`).

**What Arc does not change.** Arc calls the same backend commands as the dashboard. It does not drive the UI, recompute numbers or approve. The final job-card approval stays human (CLAUDE.md section 4).

## 2. Users and audiences

| Who | Real user or audience | What they need from Arc | Evidence |
|---|---|---|---|
| Plant operator | Real user | Enter or confirm today's conditions quickly; know which values are examples and which are measured | `Arc-Lot-Conditions.png`; paper moisture has no fallback and must be measured (`src/condition-guard.js`) |
| Production planner | Real user | Go from a PO to a draft job card with fewer page changes; see what changed and why | `Arc-Lot-Review.png`, `Arc-Lot-Compare.png` |
| Supervisor | Real user | Review the draft, tick the check, approve; know that a changed input voids the revision | `Arc-Lot-Approve.png`, `Arc-Lot-Replaced.png`; only managers and supervisors may approve once Google sign-in is on (`index.mjs` `/jobs/:id/approve`) |
| Competition judges | Pitch audience, not users | See the whole route in under the pitch time, with honest labels | Pitch on 4 December 2026 (CLAUDE.md) |

Today no named plant user signs in. The live service runs in `HACKATHON_DEMO` mode with Firebase auth off (live Cloud Run env read on 2026-11-22). Any participant can approve, and the audit records `authenticatedHuman: false` (`src/hackathon-demo-auth.js`, `src/approval-authorization.js`). Demo results must not be presented as plant-user results.

## 3. Today, Arc, roadmap

| Capability | Momentum today | Arc (this delivery) | Roadmap (not in scope) |
|---|---|---|---|
| Read a PO | Five approved fixtures only (`src/synthetic-po-allowlist.js`; live `USTAAD_SYNTHETIC_ONLY=true`) | Same five fixtures, through chat | Real customer POs after Google sign-in (`USTAAD_ACCEPT_REAL_ORDERS`) |
| Conditions | Operator entry; humidity and temperature fall back to weather, then the seasonal median (`src/condition-guard.js`) | Arc fills what it can and asks for the rest; sources labelled | Plant sensor feed |
| Plan, explain, draft, approve, PDF | Live (`/jobs`, `/jobs/:id/approve`, `/jobs/:id/card.pdf`) | Same commands, called by Arc | Named-supervisor approval |
| Data questions | Spread across screens | Grounded answers, refusals, "insufficient data" | Answers over measured plant lots |
| Defect photo | v2 backend accepts any uploaded photo (`/evidence/diagnose-photo`) | As designed: the ten approved photos (`Arc-Defect-Photo.png`) | Open question Q4 |
| Voice | None | Mic button shown, disabled in code | Voice backend |

## 4. Measurable outcomes

No baselines have been measured. Every target below is a proposal (an assumption) until the founders approve it.

| ID | Outcome | Proposed target | Baseline | How it is measured | Awards |
|---|---|---|---|---|---|
| O1 | User actions from PO selection to an issued, checked PDF (clicks, field entries, page changes) | Arc needs at least 50% fewer actions than the manual route for PO1 | Baseline NOT MEASURED | Scripted Playwright run of both routes with PO1 and the same inputs; count actions and page changes from the test log. Label: "demo-session count, not plant measurement" | Overall, UI/UX, Impact |
| O2 | Elapsed time to an approved job card | Arc no slower than the manual route; target to be set after the first measured run | Baseline NOT MEASURED | Same scripted runs, timed 5 times per route on the live service; report the median and range | UI/UX, Impact |
| O3 | Same outcome on both routes | 100% match on item, quantity, conditions, proposed settings, scrap estimate and PDF content for PO1 to PO5 | NOT MEASURED | Parity test: run each fixture through both routes and compare the stored JobSheet field by field | Overall, Gen AI usage |
| O4 | Approval bypass | 0 approvals without the user's checkbox and Approve press | NOT MEASURED | Eval suite of bypass prompts, plus an API test that Arc's tool list contains no approve command | Gen AI usage, Sustainability and social impact |
| O5 | Off-topic refusal accuracy | Founders to set a threshold; analyst proposes 95% or higher | NOT MEASURED | Labelled eval set of in-scope and off-topic questions; report precision and recall | Gen AI usage |
| O6 | Insufficient-data answers name what is missing | 100% of no-data cases name the missing data | NOT MEASURED | Eval set built from questions about data that does not exist (for example, measured scrap) | Gen AI usage, Impact |
| O7 | Numeric fidelity | 100% of numbers Arc shows trace to a backend response or stored record | NOT MEASURED | Eval checks each number in Arc's output against the tool result of the same turn | Overall, Gen AI usage |
| O8 | Provenance labels | 100% of shown values carry the correct label (model estimate, example, modelled, simulated, weather, operator-entered) | NOT MEASURED | Eval plus a copy review against the label list in CLAUDE.md section 3 | Sustainability and social impact, UI/UX |
| O9 | Prompt injection in PO content | 0 capability changes or actions triggered by PO text | NOT MEASURED | Injected PO variants. These cannot use the five allowlisted fixtures, so they run offline or in a test mode (see Q5) | Gen AI usage |
| O10 | Gemini attempts per Arc lot and per Arc turn | A button-only J1 lot uses at most 3 attempts. Each typed message adds 1 attempt (router). A typed data question that returns data uses 2 (router plus answer writer, founder decision A3). A picked suggestion chip or button uses 0 and keeps its template answer (founder decision A6). An "insufficient data" answer or an off-topic refusal skips the writer, so it uses 1 when typed. A full rehearsal plus the pitch must fit inside the daily cap (C8) | NOT MEASURED. Today one lot uses at least one extraction call and one explanation call, plus one retry if the explanation fails (commit `91c9b09`). Estimates, not measurements, from `05-ai-design.md` section 3: 2 attempts (about $0.035) for a button-only lot, 3 with an explanation retry, 6 (about $0.049) with 2 typed condition entries and 1 typed data question. ARC-M2-08 measures them | Count Firestore counter deltas per scripted Arc run and per turn kind (button, typed message, typed data question) | Overall (demo reliability) |

**Figures already in the repo that Arc may show.**

- **PKBX0041: 100.4 kg / ₹5,351 baseline, 83.0 kg / ₹4,426 recommended, 17.4 kg and ₹925 lower.**
  - Source: README "Verified reference case" and the verified-test comment in `sql/optimize.sql`, dated 2026-10-15.
  - Label: model estimate for one evaluated case, not a measured saving.
  - Inputs used: RH 86%, temperature 26 °C, paper moisture 10.8%.
  - Caveat: the figure was produced with the old `m_*` models. The app now uses the `m2_*` models (D4-2026-11-20-OM), and the case has not been re-run on them. It must be re-run before Arc shows it (see section 8).
- **September 2026 holdout, 219 lots.**
  - Net saving ₹7,934, board saved 149 kg, scrap rate 7.06% to 6.36%, 3 lots made worse.
  - Source: `docs/evidence/impact-v2.json`.
  - Label: predicted on one held-out month, scored with the plant rules on modelled history. Not annualised and not measured.
- **Model R² on the September holdout:** WARP 0.468, DELAM 0.519, STRENGTH 0.388, PRINT 0.640, CRACK 0.108.
  - Source: `config/model-acceptance.json`, README.
  - The October thresholds are kept for reference only and are not claimed.
  - CRACK is shown as low confidence.
- **Photo check:** 7 of 10 approved photos matched.
  - Source: README.
  - Not calibrated inspection accuracy.

## 5. Constraints

| ID | Constraint | Source |
|---|---|---|
| C1 | Generative work uses only Gemini on Vertex AI. The live model is `gemini-3.5-flash` in `asia-south1`. Constraints, costs, approvals and arithmetic stay in code and SQL. | CLAUDE.md section 4; `config/gcp-vertex-ai.json`; live env |
| C2 | Arc cannot approve. Approval requires the user to tick the checkbox and press Approve, and it stays a demo-session approval labelled "simulated". | CLAUDE.md section 4; `HACKATHON_APPROVAL_NOTE`; `Arc-Lot-Approve.png` |
| C3 | Arc answers only about Momentum, its lots, data, models, defects and job cards. Everything else gets a short refusal with in-scope suggestions. | CLAUDE.md section 4; `Arc-Out-Of-Scope.png` |
| C4 | No sensor feed exists. Conditions come from operator entry or the dataset; any weather fallback is labelled "public weather record, not a plant sensor". Paper moisture has no fallback. | CLAUDE.md sections 3 and 6; `src/condition-guard.js` |
| C5 | PO, photo and document content is untrusted. It cannot grant capabilities, change rules or trigger actions. | CLAUDE.md section 4 |
| C6 | Live PO intake accepts only the five allowlisted fixtures, each up to 10 MiB. | `src/synthetic-po-allowlist.js`; `index.mjs`; live env `USTAAD_SYNTHETIC_ONLY=true` |
| C7 | Voice is disabled in code until a voice backend exists. | CLAUDE.md section 4 |
| C8 | The Gemini cap is a number of attempted calls per Asia/Kolkata day, shared through Firestore: 300 on `momentum` since 2026-11-22, 100 on `prepagent`. Failed attempts count, and the cap covers extraction, explanation, photo diagnosis, every typed Arc turn and the answer writer. | `src/daily-gemini-call-cap.js`; `changes/2026-11-22-momentum-limits.md`; STATUS decision log |
| C9 | Cloud Run is limited to 2 instances at concurrency 20. PO review state lives in each instance's memory and expires after 30 minutes. | Live service read 2026-11-22; `src/purchase-order-review.js` |
| C10 | Per-IP rate limit of 60 requests per minute; 60-second request timeout. | `src/request-guardrails.js` |
| C11 | The ₹5,000 budget alert is an alert, not a spending cap. | README; `ops/billing/` |
| C12 | The repository is public. Nothing from `docs/arc/reference/` is read, quoted or committed; the folder is now in `.gitignore`. | CLAUDE.md section 7; founder decision 2026-11-22 |
| C13 | Arc work stays on `arc/m0-discovery`. Nothing merges into `main` or `v2` for now. | Founder decision 2026-11-22 |
| C14 | Deadline: finals 3 to 5 December 2026, pitch on 4 December. About 12 days remain. | CLAUDE.md |

## 6. Award mapping

| Award | What Arc contributes | What must not weaken |
|---|---|---|
| Overall winner | One honest route from PO to checked PDF, matching the manual route (O1, O3, O7) | The manual dashboard keeps working unchanged |
| UI/UX | Fewer actions and page changes (O1, O2); the approved Arc designs, including the phone layout | Labels stay visible; speed must not hide provenance |
| Impact | Shorter preparation for small plants; modelled scrap and board reduction shown with labels | No measured-savings claims; modelled stays modelled |
| Gen AI usage | Gemini reads orders, routes intent, explains and answers; evals cover grounding, refusals, injection and bypass (O4 to O9) | Gemini only; no model-made numbers |
| Sustainability and social impact | Less board scrapped (modelled); a human keeps the decision; honest "insufficient data" answers | The approval stays human; nothing touches a machine |

## 7. Assumptions, risks and open questions

**Assumptions (each needs a decision)**

- A1. The O1 to O10 targets above are the analyst's proposals.
- A2. PO1 (PKBX0041 × 1,300) is the measurement fixture for O1 and O2.
- A3. Arc's added Gemini calls fit inside the daily cap. The cap on `momentum` was raised from 100 to 300 on 2026-11-22 because Arc needs more calls (C8). This assumption is separate from founder decision A3 on written answers.

**Risks**

- R1. **Gemini cap exhaustion on pitch day.** Rehearsals and the live pitch share one daily cap. The counter resets at midnight IST, which is 02:30 in Singapore.
- R2. **Instance-local review state.** A PO review on one of the two instances can be lost if Arc's next call lands on the other instance (README, "Product boundaries").
- R3. **Stale figures in the designs** (section 8). Showing them would breach CLAUDE.md section 3.
- R4. **No revision model in the backend.** The designs rely on "Rev 1" and "replaced revision", but the backend has no revision record (no revision field in `src/`).

**Open questions for the founders**

- Q1. Weather fallback: the code already uses the Maps Platform Weather API for "Pune plant" (`config/weather.json`), but CLAUDE.md section 6 requires Om to confirm the plant location first. Does Om confirm Pune? If not, should Arc turn the weather fallback off and use only the seasonal median? Recommendation: ask Om to confirm Pune and label weather values as above.
- Q2. Who signs off the O1 to O10 thresholds, especially refusal accuracy (O5)? Recommendation: the founders, at the product-spec gate.
- Q3. Should the paper-moisture "example value" (7.3%) be pre-filled in Arc? The code treats moisture as a required, measured input. Recommendation: show it as a labelled example that the operator must confirm or replace, as the design does, and never confirm it automatically.
- Q4. Defect photos: should Arc follow the design (ten approved photos only) or the v2 backend (any uploaded photo)? Recommendation: the ten approved photos for the pitch.
- Q5. Where do prompt-injection evals for POs run, given that live intake rejects every non-allowlisted file? Recommendation: offline or local mode with mock extraction, labelled as such.
- Q6. Should the PKBX0041 case be re-run on the `m2_*` models (one read-only BigQuery job) before any screen shows it? Recommendation: yes.

## 8. Where code, README and designs disagree

1. **PKBX0041 figures predate the current models.** The 100.4 → 83.0 kg case comes from a 2026-10-15 run on the `m_*` models (`sql/optimize.sql` comment). The app has used `m2_*` since 2026-11-20. The README, `Arc-Lot-Compare.png`, `Arc-No-Data.png` and `NewLot-Approve.png` all show it as current.
2. **Designs show the wrong moisture value next to that figure.** The figure was computed with paper moisture 10.8%, but the designs pair it with "moisture 7.3% (example)".
3. **The Arc-Answer-Chart design shows the old models' R².** It shows 0.40, 0.50, 0.30, 0.61 and −0.01 under the headline "One of five models meets its pass level". The current `m2_*` values are 0.468, 0.519, 0.388, 0.640 and 0.108, and the README says the October thresholds are no longer claimed. `Arc-Lot-Approve.png` ("Four of five models miss their pass level") and `Arc-No-Data.png` ("1 of 5") have the same problem.
4. **Arc-Lot-Review shows lines that PO1 does not have.** It reads "Lines 2 and 3 are not in this lot" for PO `.../1047`, but PO1 has one line (`test/fixtures/synthetic_POs/expected_results.json`).
5. **Designs and code disagree on readings.** The designs say "Sensor readings are not connected yet" and never mention weather, while the code silently fills humidity and temperature from live weather or the seasonal median when they are missing or out of range.
6. **Designs and the v2 backend disagree on photos.** The designs limit photos to the ten approved images; the v2 backend accepts any upload.
7. **Who confirms conditions is unclear.** The README and designs say the operator confirms conditions. The coordinator's error message says "A supervisor must confirm or edit the condition values" (`src/job-coordinator.js`).
8. **The live revision differs from the v2 report.** The v2 report names `momentum-v2be-7` as live; the live service serves `momentum-v2be-8` at 100% (read 2026-11-22). The report also says v2 is 16 commits ahead of main; git shows 18.
9. **The approval checkbox appears on only one route.** The Arc approve design has a confirmation checkbox, but the manual `NewLot-Approve.png` does not. CLAUDE.md requires checkbox plus Approve.
10. **The designed navigation is not built yet.** The designs use Home, New Lot, Plant Explorer, Preparation Flow, Insights and Photo Diagnosis. The live React app at `/app` has Floor, Lots and Defects, and the old screens are still at `/`.
