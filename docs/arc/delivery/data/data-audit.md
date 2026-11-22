# Data audit for Arc (M0 discovery)

Owner: data engineer. Written 2026-11-22. Read-only: no table, view, model, bucket object, Firestore document, code or git state was created or changed.

Identity: the logged-in gcloud account. Project `prepagent-hack`. BigQuery location `asia-south1`.

## How this was read

Metadata first (`bq ls`, `bq show`, `__TABLES__`, `gcloud storage ls -l`, `gcloud pubsub`, `gcloud run services describe` filtered to variable names, the Firestore REST API for counts and field names). Then small aggregate queries, each dry-run first, each with `--maximum_bytes_billed` at or below 50 MiB, no destination table. Firestore documents were counted and their field names listed; no values were printed.

| Job ID | What it read | Bytes billed |
|---|---|---|
| bqjob_r6369e8037f68fd55_000001a2046f64d6_1 | `__TABLES__` row counts and sizes | 0 |
| bqjob_r7fc976aed500db1e_000001a204701af5_1 | `lots`: ranges, quartiles, categories | 10,485,760 |
| bqjob_r16a5cdfe8dfbb215_000001a2047117ee_1 | `lots` by month, `plants`, `sensor_readings`, `feedback` | 41,943,040 |
| bqjob_r6b1750e06f21953a_000001a204712497_1 | `job_sheets`, `impact_lots_v2`, `impact_lots`, `items` | 41,943,040 |
| bqjob_r77e95e9c5c00f21_000001a204716e3e_1, bqjob_r771857b50718322f_000001a204718ead_1 | `job_sheets`: weekly counts, JSON key names, approval mode | 10,485,760 each |
| bqjob_r7a14703fdd6a544f_000001a20475419e_1 | `feedback` joined to `lots` | 20,971,520 |
| bqjob_r1a91846f97524e08_000001a204789e6c_1, bqjob_r34c959cffe3d3514_000001a20478ccf5_1, bqjob_r7c6972d6b0f16a05_000001a20478fa3f_1 | `job_sheets`: savings by day, JSON key names | 10,485,760 each |
| arc_m0_audit_m2_eval_sep_p1_20261122T181054Z | ML.EVALUATE m2_warp, m2_delam, m2_strength on September 2026 lots | 41,943,040 |
| arc_m0_audit_m2_eval_sep_p2_20261122T181058Z | ML.EVALUATE m2_print, m2_crack, and the lot count | 31,457,280 |

Three attempts stopped at the cap before running and billed 0 bytes: bqjob_r4de81985155fcf7c_000001a20470e681_1 (needed 80 MiB), arc_m0_audit_m2_eval_sep_20261122T181040Z (needed 60 MiB), bqjob_r185e424ac3a3890a_000001a20470b0a6_1. Total billed: 230 MiB across 15 jobs. Every table read is billed at the 10 MiB minimum, which is why the costs are higher than the bytes processed.

## 1. BigQuery

One dataset, `prepagent` (asia-south1). It has 11 tables, 10 models, no views and no routines.

### Tables

| Table | Rows | Size | Created / last modified (UTC) | Main date column and range | Provenance |
|---|---|---|---|---|---|
| `items` | 117 | 17.5 KB | 2026-10-11 / 2026-10-11 | none | **catalog**: the real 117-item plant catalog. 117 distinct item codes, 15 customer IDs, box styles RSC, DIECUT and TRAY, ply 3, 5 and 7, 67 printed items |
| `lots` | 5,350 | 1.77 MB | 2026-10-10 / 2026-10-13 | `run_date` (day-partitioned), 2024-10-01 to 2026-09-30 | **synthetic** (modeled history). Built on the real item master by `generator.ts`, seed 20261010 (named in `config/model-acceptance.json` and `docs/evidence/impact-v2.json`). 0 TEST rows. 117 items covered |
| `feedback` | 113 | 24.5 KB | 2026-10-10 / 2026-10-11 | `created_at`, 2024-10-21 to 2026-09-30 | **synthetic**. Every row joins a lot, and every row's defect rates equal that lot's rates. All 113 have an English operator note. `job_id` is null, there are no photos and no overrides. The table has no provenance column |
| `plants` | 1 | 38 B | 2026-10-10 / 2026-10-13 | none | Configuration: PLANT-01, INR, `cost_per_kg` 53.3, locale `mr` |
| `job_sheets` | 13 | 62 KB | 2026-10-10 / 2026-11-20 | `created_at`, 2026-10-15 to 2026-11-20 | Written by the app (`src/google-cloud/job-sheet-repository.js`). 9 APPROVED, all with a card URI and approval audit, and 4 DRAFT. Every condition source is `manual-entry` (**operator_entry**). Savings are **model_estimate** |
| `impact_recs` | 219 | 18.8 KB | 2026-10-13 | none (September 2026 lots) | **model_estimate**: m_* recommendations from `sql/impact_batch.sql` |
| `impact_lots` | 219 | 27.1 KB | 2026-10-13 | `run_date`, 2026-09-01 to 2026-09-30 | **model_estimate** scored with the generator's rules. Net ₹7,320, 137.8 kg, 10 lots worse. Superseded by v2 |
| `impact_recs_v2` | 219 | 18.8 KB | 2026-11-20 | none | **model_estimate**: m2_* recommendations (job `impact_v2_1795147447`) |
| `impact_lots_v2` | 219 | 27.1 KB | 2026-11-20 | `run_date`, 2026-09-01 to 2026-09-30 | **model_estimate**. Net ₹7,934, 148.9 kg, 3 lots worse. Read by `sql/dash_kpis.sql` |
| `sensor_readings` | 1 | 91 B | 2026-10-10 / 2026-10-14 | `ts` (day-partitioned), one row at 2026-10-14T11:57:13Z | **simulated_sensor**: `source` = `simulated`. RH 59.9%, 30.2 °C, paper moisture 8.88% |
| `sensor_readings_error_records` | 0 | 0 | 2026-10-11 | `timestamp` | Dead-letter shape for a Pub/Sub to BigQuery pipeline. Empty |

None of the existing tables has a provenance column. The label is implied by the table, so any view Arc reads must add one (section 5).

`job_sheets` detail (counts only):

- Approval audit keys: action, actorType, actorUid, authenticatedHuman, authorizationMode, cardUri, correlationId, decidedAt, decisionId, identityProvider, jobId, newStatus, previousStatus. All 9 approvals have `authorizationMode` HACKATHON_DEMO, `actorType` HACKATHON_DEMO_PARTICIPANT, `authenticatedHuman` false and `identityProvider` server-signed-demo-session. **No approval is by a named supervisor.**
- Condition keys: ambientRhPct, ambientTempC, conditionSource, paperMoisturePct, runDate, shift, supervisorConfirmed.
- `baseline_json` and `recommended_json` hold levers and risk only. **No row records which model set (m_* or m2_*) produced it.** By date, every row before the switch (commit 312d120, 2026-11-20 09:10 IST) used m_*. That is an inference, not a stored field.
- `evidence_json` is empty on every row.
- Since Monday 16 November (IST): 2 created and 1 approved.
- Approved savings sum: 132.1 kg and ₹7,020. Drafts: 75.4 kg and ₹3,810. Six rows repeat the old PKBX0041 17.4 kg / ₹925 figure. These are model estimates from repeated test runs, not savings.

### Units and ranges in `lots` (all 5,350 rows, job bqjob_r7fc976aed500db1e_000001a204701af5_1)

| Field | Unit | Min | Q1 | Median | Q3 | Max | Mean |
|---|---|---|---|---|---|---|---|
| `ambient_rh_pct` | % RH | 25.0 | 38.5 | 52.0 | 81.2 | 98.0 | 58.52 |
| `ambient_temp_c` | °C | 6.1 | 21.2 | 25.0 | 28.6 | 40.0 | 24.77 |
| `paper_moisture_pct` | % moisture | 5.0 | 6.78 | 8.07 | 10.31 | 12.0 | 8.47 |
| Total scrap (sum of the five `rate_*_pct`) | % of lot | 2.06 | 4.02 | 4.99 | 6.29 | 29.7 | |
| `sf_speed_mpm` | m/min | 20 | | | | 60 | |
| `roll_temp_c` | °C | 150 | | | | 185 | |
| `gum_viscosity_sec` | s | 25 | | | | 60 | |
| `drying_hours` | h | 2 | | | | 16 | |
| `print_speed_spm` | sheets/min | 30 | | | | 80 | |
| `quantity` | boxes | 150 | | | | 2,250 | |

Quartiles are `APPROX_QUANTILES`. The exact percentiles and monthly medians used by the condition guard are in `config/condition-ranges.json` (queried 2026-11-20), and they agree with these figures. Categories: paper type VIRGIN, MIXED, RECYCLED; suppliers SUP-A to SUP-E; shift DAY, NIGHT; gum and pasting LOW, MED, HIGH; primary defect WARP, DELAM, STRENGTH, PRINT, CRACK; currency INR only. Totals: 27,380.1 kg scrap and ₹1,459,356 scrap cost (modeled).

The modeled history is strongly seasonal, and moisture follows humidity (correlation 0.954, job `arc_moisture73_band_20261122T175459Z` in `PKBX0041-m2-rerun.md`). Monthly means:

| Months | RH % | °C | Moisture % | Scrap kg per month |
|---|---|---|---|---|
| Dec to Feb | 40 to 43 | 18.4 to 19.3 | 6.9 to 7.1 | 895 to 1,020 |
| Mar to May | 35.8 to 36.4 | 31.2 to 31.7 | 6.5 to 6.7 | 925 to 1,034 |
| Jun to Sep | 85.7 to 87.0 | 24.4 to 25.0 | 10.7 to 10.9 | 1,368 to 1,576 |
| Oct to Nov | 61.0 to 61.7 | 23.3 to 24.3 | 8.7 to 8.8 | 847 to 1,012 |

Each month has 205 to 248 lots. The last modeled month is September 2026. **There are no lots for October or November 2026.** For November, the modeled median moisture is 8.72% (`config/condition-ranges.json`). The founders' pre-filled 7.3% matches December to February in the modeled history, not November. This is for Om to note; it is not a problem with the value as an editable example.

### Models

| Model | Type | Created (UTC) | Used by the app | Holdout R² (MAE pp), September 2026, 219 lots |
|---|---|---|---|---|
| `m2_warp` | BOOSTED_TREE_REGRESSOR | 2026-11-19 21:47 | yes | 0.4682 (0.3169) |
| `m2_delam` | same | 2026-11-19 21:50 | yes | 0.5194 (0.4989) |
| `m2_strength` | same | 2026-11-19 21:50 | yes | 0.388 (0.1708) |
| `m2_print` | same | 2026-11-19 21:50 | yes | 0.6404 (0.2616) |
| `m2_crack` | same | 2026-11-19 21:50 | yes | 0.1081 (0.1374) |
| `m_warp`, `m_delam`, `m_strength`, `m_print`, `m_crack` | same | 2026-10-11 | no (replaced under D4-2026-11-20-OM) | 0.402, 0.500, 0.297, 0.610, −0.014 (from `config/model-acceptance.json`, `replaces`) |

The m2_* R² and MAE above were re-measured today with ML.EVALUATE (jobs `arc_m0_audit_m2_eval_sep_p1_20261122T181054Z` and `..._p2_20261122T181058Z`). They match `config/model-acceptance.json` to four decimals, and the September non-TEST lot count is 219. The etags match the config (checked in `PKBX0041-m2-rerun.md`).

## 2. The 117-item catalog

`prepagent-hack.prepagent.items`: 117 rows, one per `item_code`. It is read by `src/google-cloud/item-catalog-service.js`, and `sql/optimize.sql` asserts the item exists. Label: "From catalog". This is the only BigQuery table holding real plant data.

## 3. Cloud Storage

| Bucket | Location | Contents (counts only) |
|---|---|---|
| `prepagent-hack-data` | ASIA-SOUTH1 | 73 objects, 2.88 MiB. `orders/`: 45 PDF and 4 JPEG (uploaded or sample POs, 2026-10-13 to 2026-11-20). `jobcards/`: 9 PDF, 11,378 to 17,126 bytes, 2026-10-15 to 2026-11-20, one per approved job sheet (`src/google-cloud/job-card-service.js`). `photos/photos/`: 10 JPEG, the approved reference photos (2026-10-11). `photos/video/`: 2 JPEG. `defects/2026-11-19/`: 3 JPEG uploaded through `POST /evidence/diagnose-photo` (`src/google-cloud/defect-diagnosis-service.js`). No retention policy and no lifecycle rule |
| `prepagent-hack_cloudbuild` | US | 50 objects under `source/`, about 1.17 GB of Cloud Build source archives |

The three photos under `defects/` are user uploads. Their retention and the "no photos of people" rule are open under AC6.10.

## 4. Firestore

Database `(default)`, FIRESTORE_NATIVE, asia-south1. Point-in-time recovery and delete protection are off. Three root collections, no subcollections.

| Collection | Documents | Created | Field names | Written by |
|---|---|---|---|---|
| `gemini_daily_usage` | 14 (one per IST day) | 2026-10-15 to 2026-11-20 | attemptCount, configuredCap, dayKey, policyVersion, timezone, updatedAt | `src/google-cloud/firestore-gemini-attempt-store.js` (both services). 103 attempts in total. All 14 days record a cap of 100; no day since the cap moved to 300 on `momentum` has a document yet |
| `lots` | 2 (1 planned, 1 approved) | 2026-11-20 | changes, currency, itemCode, jobId, lotId, orderId, predictedSaving, primaryDefect, quantity, ratesPct (CRACK, DELAM, PRINT, STRENGTH, WARP), status, totalScrapPct, updatedAt | `src/google-cloud/live-store.js`, called from `index.mjs` on `POST /jobs` and approve. Only on `momentum` (`USTAAD_ENABLE_LIVE_STORE=true`) |
| `events` | 10 (order.read 6, lot.planned 2, lot.approved 1, defect.logged 1) | 2026-11-19 to 2026-11-20 | at, lotId (3 of 10), text, type | Same live store. `feedback.saved` exists in code but has never been written |

`job_idempotency` (`src/google-cloud/firestore-idempotency-store.js`) does not exist, which is consistent with durable idempotency being off. The `lots` collection holds model estimates (`predictedSaving`, `ratesPct`) and no provenance field.

## 5. Sensor route

- Pub/Sub topic `projects/prepagent-hack/topics/sensor-readings` exists. **It has no subscription** (`gcloud pubsub subscriptions list` is empty), and no Dataflow job is listed in asia-south1. The route from Pub/Sub to BigQuery is not connected today.
- `sensor_readings` has one row, marked `simulated`, from 2026-10-14. `sensor_readings_error_records` has 0 rows.
- `GET /conditions/current` (`src/google-cloud/current-conditions-service.js`) returns the latest row as `simulated-sensor` with freshness `stale`. **Arc must not use this endpoint to answer "what is the moisture today":** it would show a five-week-old simulated 8.88%.
- `GET /conditions/weather` calls the Google Maps Platform Weather API for Pune (18.5204, 73.8567, `config/weather.json`) and caches the reading in memory for 10 minutes. `WEATHER_API_KEY` is a secret reference on `momentum` (revision momentum-00023-yaz) and is absent on `prepagent`. **No weather reading is stored anywhere.**

## 6. Arc questions against the data

"Answerable today" means from a stored record or an existing endpoint, without new code. Labels are the chips from `02-product-spec.md` section 5.

| # | Question | Today | Source | Label it must carry | What is missing |
|---|---|---|---|---|---|
| 1 | How far can I trust the five models? (J2) | Yes | `GET /api/status` → `modelAcceptance` from `config/model-acceptance.json`; re-measured today (jobs above) | "Modeled, tested on 219 lots" | Nothing for the values. The summary also returns `requiredR2` and `prototypeThresholdsMet: false` (the October thresholds). Arc must not turn these into a pass or fail verdict (C3) |
| 2 | Why is Crack low confidence? | Partly | R² 0.108 and MAE 0.137 pp from the config. The m2 drivers are in `docs/evidence/model-candidates-v2.json` (ML.FEATURE_IMPORTANCE) | "Modeled, tested on 219 lots" | `config/model-feature-importance-observation.json` covers the m_* models only. No endpoint serves m2 feature importance |
| 3 | What is the moisture today? (J3) | Partly | Only the lot in progress: the pre-filled example (7.3%) or the operator's entry. After planning, it is in `job_sheets.conditions_json` | "Example value" or "Entered by operator" / "Confirmed by operator" | No stored lot-conditions record before `POST /jobs` (C8), and no moisture measurement anywhere. The only stored reading is the simulated row from 2026-10-14 |
| 4 | What is the humidity and temperature now? | Yes, live, on `momentum` only | `GET /conditions/weather` (Pune) | "Weather record. Public weather record, not a plant sensor. Pune, read at HH:MM" | Not stored, so an answer cannot be traced back after 10 minutes (proposal P1). `prepagent` has no weather key |
| 5 | How did scrap change over the last 3 months? (J4) | No (measured). Partly (modeled) | Measured: none. Modeled: `dash_monthly.sql` through `GET /impact/summary`, which ends at 2026-09 | "Insufficient data". Any modeled row: "Modeled records" | No measured lots at all. No modeled lots for October or November 2026, so "the last 3 months" (late August to 22 November) is mostly empty even for modeled data |
| 6 | Show the defect history for this defect at this humidity (J7) | Yes | `POST /evidence/seen-before` (`sql/seen_before.sql`: `lots` + `feedback`, RH ±10 points) | "Modeled records" | Nothing for defect + humidity |
| 7 | Defect history for a board type, or a humidity range, or a date range | Partly | Same | "Modeled records" | No board, range or date filter in `seen-before` (C14). The data is in `lots` (ply, flute_profile, paper_type, run_date); proposal P4 |
| 8 | What does scrap cost for this lot? | Yes | `POST /jobs` response; then `job_sheets.baseline_json.risk.scrapCost` / `recommended_json` | "Model estimate" | No measured cost. ₹53.3/kg comes from `plants`, not measured |
| 9 | What did a past modeled lot cost in scrap? | Partly | `lots.scrap_cost` (no endpoint returns one lot) | "Modeled records" | No read endpoint for a single historical lot |
| 10 | How many job cards were issued this week? | Partly | `job_sheets` (2 created and 1 approved since Mon 16 Nov IST) | "Demo session, simulated" on every approval | No list endpoint; only `GET /jobs/:id`. Proposal P3 |
| 11 | Show the approval history | Partly | `job_sheets.approval_audit_json` (9 approvals) | "Demo session, simulated". Never a named supervisor | No list endpoint (P3). Every approval is HACKATHON_DEMO with `authenticatedHuman` false |
| 12 | What has Momentum saved to date? | No (measured). Partly (modeled) | `GET /impact/summary` KPIs from `impact_lots_v2`: ₹7,934 net, 148.9 kg, 7.06% → 6.36%, 3 lots worse | "Modeled, one held-out month"; do not annualise | No realised outcomes. The `job_sheets` savings sum (₹7,020 approved) mixes m_* and m2_* runs, repeats the same test case, and has no model-set field. It must not be shown as a saving |
| 13 | Which items scrap the most? | Yes | `dash_top_items.sql` through `GET /impact/summary` (items shown as "Item n") | "Modeled records" | Nothing |
| 14 | Is this item in the catalog, and what is its spec? | Yes | `items` through the catalog service | "From catalog" | Nothing |
| 15 | What did Arc recommend for this lot, and why? | Yes | `POST /jobs`, `POST /risk/explanation` (`sql/explain.sql`), `job_sheets` | "Model estimate" | The stored job sheet does not say which model version produced it (backend ticket) |
| 16 | What changed between Rev 1 and Rev 2? (J8) | No | None | "Replaced, read only" | No revision record (C8) |
| 17 | How accurate is the photo check? | Yes | README "7 of 10" | "7 of 10 labels matched in testing. A small check, not an inspection." | No stored evaluation run in the repo or BigQuery. The figure has only a README source |
| 18 | Show me the live sensor reading or line throughput | No | None | "Insufficient data" | No sensor feed: the Pub/Sub topic has no subscription, and the only row is simulated. No production log or throughput data |
| 19 | Show the Insights summary for a date range | No | `GET /insights/summary` → `getInsights` is not configured (`src/service-ports.js`) | n/a | The adapter is off in production. Owner and intended state not yet checked (see STATUS) |

## 7. Proposed tables, views and generators

**Nothing below has been created.** Each item needs an ADR or ticket from the architect and tech lead. Every item marked "needs Om sign-off" must not be used in the demo until Om signs it. Storage choices (BigQuery or Firestore) for P1 and P2 belong to the C8 ADR. They are written here as BigQuery so the schema is concrete.

### P1. `prepagent.arc_weather_observations` (table, append-only)

Answers question 4 with a stored, traceable record, and feeds condition pre-fill.

| Column | Type | Notes |
|---|---|---|
| observation_id | STRING | UUID |
| observed_at | TIMESTAMP | `currentTime` from the API |
| fetched_at | TIMESTAMP | When the backend called the API |
| location_name | STRING | "Pune" |
| latitude, longitude | FLOAT64 | From `config/weather.json` |
| ambient_rh_pct | FLOAT64 | % RH, 0 to 100 |
| ambient_temp_c | FLOAT64 | °C |
| within_model_range | BOOL | RH 25 to 98 and temperature 6.1 to 40.0 (`config/condition-ranges.json`) |
| provider | STRING | "google-maps-platform-weather" |
| provenance | STRING | Always `public_weather_record` |
| label | STRING | "Public weather record, not a plant sensor." |

- Source: a real public record, no generator, so no seed. Written only by the backend weather tool, at most once per 10-minute cache refresh.
- Assumptions: (a) outdoor Pune weather is an acceptable stand-in for plant ambient conditions; (b) the plant is near the configured point (Pune city centre). The founders confirmed Pune on 2026-11-22. **Needs Om sign-off on (a).** A plant floor next to a corrugator is usually warmer and drier than outdoors, and the models learned RH as plant ambient.
- Volume: at most 144 rows a day, under 50 KB a month.

### P2. `prepagent.arc_lot_conditions` (table, one row per field per entry)

Answers question 3 and holds conditions before planning (C8, C20).

| Column | Type | Notes |
|---|---|---|
| lot_id | STRING | Lot in progress |
| revision | INT64 | Rev number |
| field | STRING | `paper_moisture_pct`, `ambient_rh_pct`, `ambient_temp_c`, `shift`, `run_date` |
| value_numeric / value_string | FLOAT64 / STRING | Value as entered |
| unit | STRING | `%`, `% RH`, `°C` |
| provenance | STRING | `operator_entry`, `public_weather_record` (with `weather_observation_id`), or `synthetic` for the example value |
| source_detail | STRING | `example`, `typed`, `confirmed`, `weather`, `seasonal_typical` |
| weather_observation_id | STRING | FK to P1 when the value is from weather |
| entered_at | TIMESTAMP | |
| entered_by_role | STRING | "Operator session". A role, not a person |
| confirmed | BOOL | |

- Source: operator entry. No generator. The 7.3% paper moisture is a pre-filled, always-editable example (founder decision, 2026-11-22). It is stored with `source_detail` = `example` until the operator edits or confirms it.
- Assumptions: 7.3% is a realistic example paper moisture for Om's plant. **Needs Om sign-off.** In the modeled history, 7.3% is typical of December to February (median 7.0 to 7.1%), while the November median is 8.72%.

### P3. `prepagent.v_arc_job_cards` (view over `job_sheets`)

Answers questions 10 and 11 without exposing order or customer fields.

Columns: job_id, status, created_at, approved_at, card_stored (`card_uri IS NOT NULL`), savings_kg, savings_cost, currency, authorization_mode, authenticated_human, model_set_inferred (`m_*` if created before 2026-11-20T03:40:04Z, else `m2_*`), approval_provenance (constant "Demo session, simulated" while `authorizationMode` = HACKATHON_DEMO), savings_provenance (constant `model_estimate`). It excludes `order_json`, `approval_audit_json.actorUid` and `correlationId`.

- No new data and no generator. `model_set_inferred` is a date rule, not a stored fact; the view must label it "inferred from date". The proper fix is a backend ticket to store the model resource and etag on each job sheet.
- No Om sign-off needed (no plant assumption). The compliance reviewer checks the excluded columns.

### P4. `prepagent.v_arc_lot_history` (view over `lots`)

Answers questions 5 (modeled part), 7 and 9.

Columns: lot_id, item_code, run_date, month, season (same CASE as `sql/dash_seasonal.sql`), ply, flute_profile, paper_type, paper_supplier, shift, ambient_rh_pct, ambient_temp_c, paper_moisture_pct, the seven levers, the five rate_*_pct, total_scrap_pct, total_scrap_kg, scrap_cost, currency, primary_defect, provenance (constant `synthetic`), label (constant "Modeled records"). No `customer_id` and no `order_id`.

- No new data. Any Arc query over it must be parameterised and capped at 50 MiB, as in the Insights spec section 9.
- No Om sign-off needed; it re-exposes approved modeled history with its label.

### P5. `prepagent.v_arc_feedback` (view over `feedback`)

Columns: all `feedback` columns, plus provenance = `synthetic` when `job_id IS NULL` (all 113 current rows), else `operator_entry`.

- Why: `POST /jobs/:id/feedback` writes into the same table as the 113 synthetic rows, with no provenance column. Without this view, a real entry and a modeled one cannot be told apart, except by the null `job_id`.
- The rule depends on the app always setting `job_id`. `FeedbackInputSchema` requires it, but that should be confirmed by a test before the view is relied on. No Om sign-off needed.

### P6. Simulated sensor stream (generator, optional; not recommended for the pitch)

Only if the founders want a moving "live" tile. It reuses the existing topic `sensor-readings` with a new BigQuery subscription into `sensor_readings`, every row `source` = `simulated`.

- Generator: `tools/` script, seed fixed and recorded (proposed 20261122). One reading every 5 minutes for PLANT-01. RH, temperature and paper moisture are drawn from the modeled history's monthly distribution (`config/condition-ranges.json` medians, with p01 to p99 bounds), and moisture is tied to RH (correlation 0.954 in `lots`). Each row carries `provenance` = `simulated_sensor` and the label "Simulated reading, not a plant sensor."
- Cost: Pub/Sub and BigQuery streaming at this volume is under ₹1 a month. A subscription is a cloud change and needs the section 7 change record.
- Assumptions: the plant's ambient and reel moisture behave like the modeled monthly distribution. **Needs Om sign-off.**
- Recommendation: do not build. P1 (real weather) and P2 (operator entry) already answer "today" honestly, and a simulated stream adds a third label for the same field.

### Not proposed: measured outcomes

Questions 5, 12 and 18 need measured scrap, realised savings or throughput. No generator can supply these honestly. Arc answers "Insufficient data" and names what is missing (AC4.1). A future `arc_production_outcomes` table would hold operator-recorded outcomes only, provenance `operator_entry`, and starts empty.

## 8. Findings that need an owner

1. **The lot generator is not in the repository.** `generator.ts` and `impact.ts` (seed 20261010) are referenced from `sid_pack.zip`, which is not in the repo or next to it. CLAUDE.md section 6 needs the generator documented and reproducible. `docs/evidence/impact-v2.json` also records that `generator.ts` says ₹45/kg, while the live tables use 53.3.
2. **No provenance column exists on any table.** Views (P3 to P5) must add it before Arc reads them.
3. **`job_sheets` does not record the model set.** Rows before and after the m2 switch cannot be told apart except by date.
4. **`GET /conditions/current` returns a five-week-old simulated row.** Arc must not route "moisture today" to it.
5. **The sensor topic has no subscription**, so the "Pub/Sub to BigQuery route" exists only as a topic and an empty error table.
6. **User-uploaded defect photos** (3 in `defects/`) have no retention rule on the bucket (AC6.10).
7. **The October and November 2026 gap** in modeled history means every "recent" trend question is answered from data ending 30 September.
