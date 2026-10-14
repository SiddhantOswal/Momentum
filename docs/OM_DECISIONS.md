# Om's decisions: authoritative for the hackathon prototype

Owner: Om (plant, data and models). Date: 14 Oct 2026. Put this file at `docs/OM_DECISIONS.md`.
Where this file and older notes or the Blueprint disagree, **this file wins**.

## D0. Scope

The goal is a **working prototype for the Google AI Builder Cup 2026**, submitted by **18 Oct 2026**:
deck PDF, public Cloud Run URL and a 3-minute video. "Production acceptance" for a real factory is **out of scope**.
Do not block prototype work on production-only gates (genuine sensors, distributed state, grouped model
re-evaluation, release traceability). List them under "Future work" instead.

## D1. Public access for judging (agreed by Om and Siddhant, 14 Oct 2026)

The hackathon requires judges to open the prototype on Cloud Run. Decision: **deploy publicly**
(`--allow-unauthenticated`) for the judging period, with these guardrails:
- `--max-instances 2`; per-IP rate limit (existing in-memory limiter); a daily cap on Gemini calls
- budget alert stays on; only synthetic, anonymized data is in the app
- the UI says "Prototype with synthetic data"
- after judging (7 Nov), set it back to private, or delete the service.

## D2. Optimizer contract (`sql/optimize.sql` in sid_pack.zip is canonical)

**Baseline = the supervisor's planned settings** for this lot, entered or confirmed in the UI.
If the supervisor leaves a lever blank, use the **plant standard** value (D3), labelled "plant standard".
The Blueprint's fixed-threshold version is **retired**. Reason: when tested on the held-out month, it credited
"savings" for speeding up lots that already ran slowly (Rs 1.69 lakh, mostly invented throughput cost, against
Rs 6,300 of real scrap reduction). The plan-relative version gives honest, scrap-driven savings.

| Item | Decision |
|---|---|
| Objective (minimise) | predicted scrap cost + throughput penalty |
| Predicted scrap cost | quantity x box_weight_kg x (sum of 5 predicted defect rates, each floored at 0, print = 0 if no ink) / 100 x cost_per_kg |
| Drying penalty | Rs 200 per hour of drying **above the planned hours** |
| Single-facer penalty | Rs 60 per m/min **below the planned speed** |
| Print-speed penalty | Rs 30 per sheet/min **below the planned speed** |
| Penalty form | linear, additive, no caps. Speeding up earns nothing. Baseline penalty is always 0 |
| Penalty meaning | an **allowance for slower production** (a heuristic, not a measured cost). Show it as "slower-production allowance" |
| Max changes | at most 3 of the 7 levers may differ from the plan |
| Grid (each list also includes the planned value) | SF speed 30, 38, 45, 52 m/min; roll temp 160, 170, 180 °C; gum LOW, MED, HIGH; viscosity 35, 45 s; pasting LOW, MED; drying 4, 6, 8, 10, 12 h; print 40, 55, 70 sheets/min |
| Selection | lowest total cost, then fewer changes. **Fix:** append the 7 lever columns to the `ORDER BY` of the `best` CTE so ties are deterministic |
| Rounding | scrap_cost, penalty and total_cost rounded to whole rupees per row; savings = BASELINE total_cost - BEST total_cost (rounded values) |
| Savings shown | rupees and kg, plus % = savings / baseline total. Always labelled **"predicted"** |
| No candidate better than plan | BEST equals BASELINE, savings 0. Show "Your plan is already the best option we found" |
| Missing item or plant row | error "Item not found in item master" or "Plant settings missing"; no recommendation |

**Acceptance example (BigQuery, verified 13 Oct 2026):** PKBX0041, 1300, RECYCLED, SUP-D, DAY, 86 %RH, 26 °C, 10.8 % moisture,
planned 48 / 162 / HIGH / 32 / MED / 5 / 60, cost Rs 53.30/kg ->
BASELINE 10.18 %, 100.4 kg, Rs 5,351; BEST roll 170, gum MED, viscosity 35 -> 8.42 %, 83.0 kg, Rs 4,426;
savings 17.4 kg and **Rs 925**, penalty 0.

**Why Rs 781 vs Rs 925:** same settings and the same 17.4 kg; only the price changed. Rs 781 was at the old Rs 45/kg
placeholder, Rs 925 is at the approved Rs 53.30/kg (781 x 53.3 / 45 = 925). The earlier Rs 936 came from the retired
fixed-threshold penalty and is obsolete.

## D3. Plant configuration (PLANT-01)

| Field | Value | Status |
|---|---|---|
| plant_id | PLANT-01 | Approved |
| base_currency | INR | Approved |
| cost_per_kg | **53.30 Rs/kg**, paper cost only (Rs 55/kg for 180 GSM, Rs 52/kg for 160 GSM, weighted by the item mix) | **Approved by Om, 13 Oct 2026**. Already set in `prepagent.plants` and `prepagent.lots` |
| default_locale | en (English only for the prototype) | Approved |
| Standard settings (used only when a planned value is blank) | SF 42 m/min, roll 168 °C, gum MED, viscosity 40 s, pasting MED, drying 6 h, print 55 sheets/min | **Approved by Om, 14 Oct 2026** (confirmed as the plant's standard settings). Show "plant standard" in the UI |
| Lever ranges | SF 20-60, roll 150-185, viscosity 25-60, drying 2-16, print 30-80 | Approved for the prototype |

No new seed writes are needed; PLANT-01 already exists.

## D4. Models (P2-OM-001)

- **Models:** `prepagent.m_warp`, `m_delam`, `m_strength`, `m_print`, `m_crack` (BQML boosted-tree regressors, Vertex registry
  `prepagent_*`), trained 11 Oct 2026 by `train.sql`.
- **Split:** random 80/20 on Oct 2024 to Aug 2026; Sep 2026 fully held out.
- **R²:** warp 0.61, delam 0.67, strength 0.47, print 0.75, crack 0.30.
- **Acceptance for the prototype:** 0.6 for warp, delam and print; 0.45 for strength; 0.30 for crack. Strength and crack are
  small defects with little variation in the data, so R² is naturally low. This is disclosed on the deck as a known limitation.
- **Feature importance** matches the defect rules (humidity, gum, GSM, drying, moisture, speed, ink). customer_id's small importance is
  noise fitting (customers have no causal effect in the data); we accept it and note it. A retrain without customer_id is future work.
- **Not doing before 18 Oct:** grouped (by item) re-evaluation and retraining.

## D5. Conditions and sensors

- There are **no physical sensors**. All readings are **simulated** and must be labelled "simulated sensor" in the UI and API.
- The sensor pre-fills humidity, temperature and paper moisture; the **supervisor confirms or edits** them before predicting.
  Supervisor confirmation is the gate, not data freshness.
- If no reading exists, the supervisor enters the values; nothing is invented.
- If a reading is older than 24 h, show its age and a "stale" note.
- **Shift** is picked by the supervisor.
- **Dataflow:** dropped. If a stream is shown, use the Pub/Sub BigQuery subscription. A simulated stream is optional for the demo.

## D6. State, idempotency, rate limit

Single region, max 2 instances (1 during the video recording). In-memory trace and rate limiting are **accepted for the
prototype**. Persist JobSheets in `prepagent.job_sheets`. Approval is allowed only from DRAFT; a repeat approval returns
the existing approved card. Firestore and distributed rate limiting are future work.

## D7. Feedback and photos (P2-OM-010)

- **Consent:** the photos in `gs://prepagent-hack-data/photos/` were taken by Om at his family's plant, with the family's
  consent, for demo and testing use. Approved 11 Oct 2026.
- **Labels:** the folder name is the label, set by Om. crushed maps to STRENGTH; good maps to NONE.
- **Branding:** client logos must be blurred in any public video.
- **Classification:** Gemini zero-shot, with no training. Acceptance = classify each of the 12 photos once and compare with the labels.
- **Feedback writes** to `prepagent.feedback` are approved for `TEST-` jobs. "Factory learned": also insert the
  completed lot into `prepagent.lots` with order_id `TEST-...` (see SID_NOTES.md).

## D8. Language and currency

- **Language:** English only for the submission; Hindi and Japanese job cards are future work. **P2-OM-005 (glossary) is not needed.**
- **Currency:** keep the switcher (display conversion only; stored values stay INR; show "≈" and the rate date).

## D9. Impact dashboard

`impact_dashboard.html` is served **by the app itself** (same origin, e.g. `public/impact.html`) and calls
`GET /impact/summary`, which returns `{ kpis, monthly, seasonal, topItems }` from the four `dash_*.sql` files.
No separate dashboard site, no proxy, no CORS. The page says these are **estimates on a held-out month, scored with
the simulation's true rules**. They are not measured plant results.

## D10. Authorization (from the project owners, valid until 18 Oct 2026)

Approved without asking again, within the $300 credit:
- BigQuery reads, queries and ML.PREDICT / ML.EXPLAIN_PREDICT in `prepagent`
- writes to `job_sheets`, `feedback` and `lots` for `TEST-` records
- Gemini Flash calls for extraction, explanation and photo classification
- Cloud Storage writes under `orders/`, `photos/` and `jobcards/`
- Cloud Run deploys of `prepagent` per D1.

Ask first for: model retraining, Dataflow, new services or resources, and IAM changes beyond D1.
On 17 Oct, delete `TEST-` rows and `jobcards/TEST-*`.

## D11. Manufacturing stage order (P2-OM-008), approved by Om, 14 Oct 2026

**Printing happens before pasting**: the top liner is printed first, then pasted onto the corrugated board.
This replaces the Blueprint's stage table, which placed printing after cutting and creasing.

| # | Stage | Settings on the job card |
|---|---|---|
| 1 | Printing (flexo, on the top liner) | print speed |
| 2 | Single facer (fluting + liner into 2-ply; can run alongside printing) | SF speed, roll temperature, gum application, gum viscosity |
| 3 | Sheet cutting | none |
| 4 | Pasting (printed liner onto the 2-ply board; 5 and 7-ply built here) | gum application, pasting pressure |
| 5 | Drying / conditioning | drying hours |
| 6 | Cutting and creasing | none |
| 7 | Slotting | none |
| 8 | Stitching / gluing | none |
| 9 | QC and bundling | none |

**Known simplification:** the synthetic history lets bent board raise print defects (a warp-to-print knock-on effect).
With printing before pasting, that effect is weaker in reality. The print model's top drivers are ink colours, coverage and
flute, so the impact is small. Note it as a limitation; no rebuild is needed for the prototype.

## Status of Om's tasks

| Task | Status | Where |
|---|---|---|
| P2-OM-001 Models and evidence | Done, with documented limits (D4) | train.sql, ML.EVALUATE, ML.FEATURE_IMPORTANCE (11-12 Oct) |
| P2-OM-002 predict.sql | Done, verified | sid_pack.zip |
| P2-OM-003 optimize.sql and contract | Done, verified; contract = D2 | sid_pack.zip |
| P2-OM-004 explain / similar_runs / seen_before | Done, verified on BigQuery | sid_pack.zip + SID_NOTES.md |
| P2-OM-005 Glossary | Not needed (D8) | — |
| P2-OM-006 Season profile | Done: estimated typical Pune ranges, not measured (`SEASON` in generator.ts) | generator.ts |
| P2-OM-007 Baselines and costs | Done: cost and standard settings approved by Om (D3) | this file |
| P2-OM-008 Stage order | Done: printing before pasting, approved by Om (D11) | this file |
| P2-OM-009 PO fixtures | Done: 5 synthetic POs with expected results, approved for tests and demo | synthetic_POs.zip |
| P2-OM-010 Photos and labels | Done, consent recorded (D7) | gs://prepagent-hack-data/photos/ |
| Proposal deck | Done (PPTX and PDF) | The_Factory_That_Learns.pptx / .pdf |
