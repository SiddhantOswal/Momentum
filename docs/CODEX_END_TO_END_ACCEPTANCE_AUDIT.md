# Ustaad AI — End-to-End Acceptance Audit and Handoff

**Evidence cut-off:** 2026-10-14 22:17 IST  
**Decision:** **NOT READY — acceptance and production gates remain open.**  
**Scope:** Source and reference review, current offline verification, and
reconciliation of previously recorded cloud evidence. No Cloud Run call,
deployment, traffic change, IAM change, paid model call, BigQuery query/write,
Pub/Sub publication, Dataflow operation, Firestore write, approval, or job-card
creation was performed for this audit.

## A. Executive summary

Ustaad AI is intended to take an operator-supplied corrugated-box purchase
order through extraction, catalog matching, production-risk prediction,
historical evidence, setting optimization, explanation, a persisted DRAFT
JobSheet, explicit supervisor approval, and job-card PDF retrieval. The
Blueprint emphasizes one demonstrated end-to-end flow over many partially
working features.

This audit reviewed the provided Blueprint and Playbook, Om's SQL/handoff,
synthetic PO fixtures, the Part 2 tracker, the cloud-integration tracker, the
local development guide, the current source/configuration, and existing
tests. The current application contains real route and adapter code, strict
contracts, fail-closed behavior, an offline coordinator workflow, an in-memory
execution trace, and bounded BigQuery/Vertex/Storage/Firestore adapters.

Reproduced local evidence:

- `cd prepagent && npm run test:acceptance`: **218/218 passed**.
- `cd prepagent && npm test`: **384/384 passed**.
- Syntax check over application `.js`/`.mjs` files, excluding every
  `node_modules` directory: passed.
- All 10 `config/*.json` files parsed.
- `git diff --check`: passed.

These are local/offline results. The PO1 coordinator test uses fake external
services and in-memory stores; it is not a live cloud workflow. The deployed
service evidence below is historical manifest/tracker evidence and was not
re-probed during this audit. No current-source equivalence is established.

The system does **not** meet the stated model-quality bar on the last recorded
metrics (Strength R² 0.4672613, Crack R² 0.3010716, required >= 0.6). The
optimizer baseline/penalty/cost contract has conflicting instructions. The
sensor provenance has no owner-approved freshness limit and no verified
genuine-data path through the required pipeline. There is no fully live
PO-to-approved-job-card run. Candidate source was built from a dirty tree,
production and zero-traffic candidate differ, and the service remains private.
The project must not be described as production-ready or fully integrated.

## B. Source-of-truth understanding

Reference files are in the workspace-level `../docs/` directory, outside the
application repository; the supplied files were not copied into the
application repository.

| Source | Requirements used in this audit | Conflict or qualification |
|---|---|---|
| `../docs/Corrugated Production-Prep Agent — Build Blueprint 3.pdf`, pp. 1–6, 8, 12–19, 21–22 | The application should demonstrate an order-to-job-card flow; Gemini should read POs and explain recommendations, five BQML models predict defect rates, settings are optimized with a maximum of three changes, a visible trace and historical evidence are valued, and the supervisor explicitly approves the actionable card. September held-out results use the generator's `trueScrap`. | The Blueprint p. 12 baseline is plant-standard/median settings and p. 13 lists fixed absolute slowdown penalties. Its p. 21 text says annual savings equal monthly × 12. |
| `../docs/Prep_Agent_3-Day_Sprint_Playbook.pdf` and `.docx` | Implementation sequence, GCP roles, BigQuery tables, model threshold, sensor ingestion, PO extraction, job sheets, trace, localization, and photo/feedback expectations. The playbook's model check requires R² >= 0.6 and top feature importance consistent with the rules. | Playbook/setup material is not evidence that a configured resource or planned step is operational. The Dataflow instructions do not override the later recorded capacity failure or the no-retry authorization requirement. |
| `../docs/sid_pack/SID_NOTES.md` and supplied SQL (`optimize.sql`, `predict.sql`, `explain.sql`, `similar_runs.sql`, `seen_before.sql`, dashboard SQL), plus `impact.ts` | App-facing BigQuery parameters and result fields; Om's test case; current optimizer and “true” impact calculation; synthetic dataset result descriptions. | Om's optimizer uses the supervisor's planned settings as baseline and plan-relative penalties, not Blueprint standard settings/penalties. SID notes say do not annualize the September monsoon result, contrary to Blueprint p. 21 and stale SQL comments. Do not choose silently. |
| `../docs/synthetic_POs/README.md` and `expected_results.json` | Five synthetic cases establish expected extraction behavior: one clean order, multi-line order, fitment, ambiguous item, and unknown/missing data. Specs and machine context must not be guessed from the PO. | Fixtures are explicitly synthetic; they are not production records or live extraction evidence. |
| `prepagent/docs/PART2_COMPLETION_TRACKER.md`, Sections 82–84 | Current status/evidence history, model results, source drift, offline acceptance and Batch G blockers. | Historical cloud evidence is time-bound and is not a fresh connectivity check in this audit. |
| `prepagent/docs/CLOUD_INTEGRATION_TODO.md` | Service and cloud operation history and bounded sensor procedure. | Conflicting historical entries are preserved; the most recent closure/handoff and configuration evidence qualify older sections. |
| `prepagent/docs/LOCAL_DEVELOPMENT.md`, `src/schemas.js`, `index.mjs`, `src/service-ports.js`, `sql/`, tests | Current request contracts, routes, gates, error behavior, and offline acceptance evidence. | A route, gate, manifest, local status response, or passing fake-adapter test does not establish live service operation. |

Direct requirements and interpretations are separated in this report. Where
two authoritative sources disagree (optimizer semantics and annualization),
the requirement remains blocked pending an owner decision.

## C. Initial state and environment

- Application repository: `/Users/siddhant/prepagent-work/prepagent`.
- Branch: `main`.
- HEAD at audit start: `844d872193793fe23aa3c1ec81243c81d760b314`.
- The worktree was already dirty at audit start: **40 tracked paths modified,
  47 untracked paths** (`git status --short`). These changes were present
  before this audit report was written and were preserved. No reset, cleanup,
  staging, or commit was performed.
- Runtime contract: Node.js >=20.10, `npm start`, default port 8080, Cloud Run
  port 8080; `PORT` can select a validated local port.
- Local feature defaults from the responding local `/api/status` on ports
  8080 and 8097: `mode=local-development`; model calls, risk prediction,
  optimization, current conditions, storage/persistence, and job creation
  were unavailable. Those status responses did not prove GCP connectivity.
- App repository test commands: `npm run test:acceptance`; `npm test`.
- Time-sensitive cloud facts in this report are from local recorded
  `config/gcp-cloud-run.json` and tracker sections, not a fresh cloud query.
  That record identifies service `prepagent`, project `prepagent-hack`, region
  `asia-south1`, port 8080, runtime identity
  `prepagent-run@prepagent-hack.iam.gserviceaccount.com`, private invocation,
  and service maximum two instances. It records production revision
  `prepagent-00005-s5x` at 100% and tagged candidate `prepagent-00011-yew` at
  0%. This status is not reconfirmed against live Cloud Run in this audit.
- Existing release evidence in the manifest identifies remediation build
  `e01b285a-d6d2-4729-a6e4-31dd150b3786`, image digest
  `sha256:7d75f6ea42f67832d0cfb2240592be4b966a68fd68e8cf98038b131cc2117e75`,
  and revision `prepagent-00011-yew`. The manifest explicitly says this
  artifact was built from a dirty worktree based on the HEAD above, has no
  source commit SHA, and predates subsequent local runtime, SQL, test, and
  documentation updates. It is not a clean commit-pinned release.

## D. Implementation and change log

### Existing local changes present at audit start

The following work was already in the dirty tree before this audit report:

- Runtime and HTTP behavior: `index.mjs`, `src/runtime-config.js`,
  `src/service-ports.js`, and `test/app.test.js` / `test/runtime-config.test.js`.
- PO intake and orchestration: `src/purchase-order-file.js`,
  `src/purchase-order-review.js`, `src/job-coordinator.js`,
  `src/job-sheet-builder.js`, `src/job-draft-persistence.js`,
  `src/job-idempotency.js`, `src/stored-job-sheet-lookup.js`, and their tests.
- Cloud adapters: `src/google-cloud/` for BigQuery read/write, Vertex Gemini,
  Storage, Firestore idempotency, catalog, conditions, prediction,
  optimization, evidence, Impact, persistence, cards, and feedback.
- UI/contracts/localization: `src/operator-ui.js`, `src/operator-ui.css`,
  `src/risk-ui.js`, `src/impact-ui.js`, `src/schemas.js`,
  `src/bigquery-mapper.js`, `src/money-contracts.js`, locale files, and tests.
- SQL/build/runtime records: `sql/`, `Dockerfile`, `.dockerignore`,
  `config/*.json`, package scripts, and related contract tests.
- Evidence/tracker changes: Sections 82–84 of
  `docs/PART2_COMPLETION_TRACKER.md`, plus `docs/LOCAL_DEVELOPMENT.md` and
  `docs/CLOUD_INTEGRATION_TODO.md`.

These are described as observed source state, not as work newly performed by
this audit. The latest closure additionally contains
`sql/sensor_ingestion_acceptance.sql` and
`test/sensor-ingestion-sql.test.js`, which bound the read-only acceptance
lookup by parameterized reading ID and plant and expose duplicates with
`LIMIT 2`. Its offline test is included in the 218-test acceptance selector.

### Changes made in this audit

- Added this report at `docs/CODEX_END_TO_END_ACCEPTANCE_AUDIT.md`.
- The existing tracker is updated with a short pointer and exact sequential
  test results in Section 85.
- No application behavior, runtime configuration, cloud configuration, IAM,
  or deployment artifact was changed in this audit.

## E. Requirement-by-requirement acceptance matrix

Statuses use the closure vocabulary required by the master acceptance prompt.

| ID | Requirement | Authoritative source | Implementation evidence | Test/live evidence | Status | Remaining blocker / next action |
|---|---|---|---|---|---|---|
| A1 | Full PO-to-approved-card journey | Blueprint pp. 3, 6, 13–16; Playbook; synthetic PO README | `index.mjs`; `src/google-cloud/order-extraction-service.js`; `src/purchase-order-review.js`; `src/job-coordinator.js`; persistence and card services | `npm run test:acceptance` includes fake-adapter lifecycle; historical production extraction failed and zero-traffic candidate extraction only had isolated synthetic evidence. No live full journey. | **PARTIALLY VERIFIED** | Fresh specific authorization for paid extraction and persistent workflow; real conditions and operator settings; supervisor acceptance; complete read-back and artifact evidence. |
| A2 | PO extraction, validation and matching | Blueprint p. 14; synthetic PO expected results | `POST /orders/extract`, extraction service, item catalog and review service; 10 MiB upload limit; extraction asks Gemini only for PO identifiers/line item/quantity, then catalog supplies specs | Fixture and adapter tests; historical tagged-candidate synthetic extraction succeeded, but live production extraction previously returned 503. | **PARTIALLY VERIFIED** | Do not repeat paid Vertex call without authorization. Verify current exact deployed candidate and the complete five-fixture acceptance plan under authorization. |
| A3 | Five defect models meet quality threshold and have defensible generalization | Blueprint p. 12; Playbook model acceptance | `sql/model_grouped_candidate_training.sql`, `model_grouped_candidate_evaluation.sql`, `model_grouped_candidate_feature_importance.sql`; no active-model overwrite | Last recorded named-model R²: Warp .6051769, Delam .6664104, Strength .4672613, Print .7511529, Crack .3010716. No grouped candidate training/evaluation was run. | **FAILED** on last recorded threshold results; grouped evaluation **BLOCKED — AUTHORIZATION** | Strength and Crack below >= .6. Model owner must provide exact artifacts/results and authorization for billable candidate training/evaluation; review held-out customers and feature rules. |
| A4 | Optimizer follows one approved baseline, penalty, constraints and cost basis | Blueprint pp. 12–13; Om's `SID_NOTES.md` and `optimize.sql` | `sql/optimize.sql`; `src/google-cloud/risk-optimization-service.js`; strict schemas/UI mapping and tests | Offline optimizer contract tests pass. Historical SQL prediction evidence exists but no current run. | **BLOCKED — EXTERNAL DECISION** | Om/plant owner must decide standard-vs-planned baseline, absolute-vs-plan-relative penalties, plant cost/kg and raw expected case. Do not change formula before this. |
| A5 | Impact calculation and dashboard are correctly qualified | Blueprint pp. 21–22; Om `impact.ts`, `dash_kpis.sql`, `SID_NOTES.md` | `src/google-cloud/impact-summary-service.js`, `src/impact-ui.js`, `sql/dash_*.sql`; UI labels September as counterfactual, not observed | Offline adapter/UI tests pass. Historical September impact figures are synthetic-generator evidence, not a fresh query or observed savings. | **PARTIALLY VERIFIED** | Resolve annualize ×12 vs “do not annualize” instruction; reconcile SQL comment and app behavior; only report September, method and assumptions until authoritative decision. |
| A6 | Current conditions traverse genuine sensor path and freshness is safe | Blueprint pp. 5–8; Playbook sensor section | Conditions adapter reads latest plant row, preserves source and emits provenance; coordinator requires `live` and `fresh`; new parameterized read-only verification SQL | Tests cover missing, malformed, simulated, stale/unassessed; historical Pub/Sub evidence was one simulated event, not genuine telemetry; no genuine sensor or Dataflow end-to-end result. | **BLOCKED — DATA/INFRASTRUCTURE** | Plant/device owner supplies one actual measurement; owner approves maximum freshness age; separately authorized Pub/Sub publication and BigQuery read-back; no Dataflow retry without fresh capacity evidence and authorization. |
| A7 | Execution trace accurately reflects actual stage events | Blueprint pp. 3, 13–15 | `src/trace-registry.js`, `src/trace-routes.js`, `src/job-coordinator.js`, `src/google-cloud/gemini-function-runner.js`, UI SSE panel | Offline coordinator/Gemini-runner tests verify success/failure event order and avoid sensitive payload tracing. No current live workflow trace. | **PARTIALLY VERIFIED** | Capture only during a separately authorized real workflow; trace is bounded/in-process and not durable. |
| A8 | Historical similar-run and “seen before” results have valid provenance | Blueprint pp. 3, 13–14; Om SQL handoff | `src/google-cloud/risk-evidence-service.js`; `sql/similar_runs.sql`, `sql/seen_before.sql`; schemas/UI | Offline result/error contract tests; tracker records historical read-only BigQuery query successes, but not freshly rechecked. No generated fixture should be presented as real. | **PARTIALLY VERIFIED** | Current authenticated connection/result provenance and business relevance require bounded authorized read-only verification; no need to rerun merely to reproduce historical evidence. |
| A9 | Photo defect diagnosis is valid and privacy-authorized | Blueprint pp. 2–3, 17–19; Playbook photo consent section | UI explicitly reports photo classification/upload unavailable; `src/google-cloud/feedback-service.js` rejects photo feedback without consent/provenance-safe path. | Unit tests verify rejection; no authorized plant photo evaluation or consent evidence. | **BLOCKED — DATA/INFRASTRUCTURE** | Obtain photo-use permission, attribution/provenance, retention and evaluation-set approval; then implement/verify supported model classification. Feedback writes remain disabled. |
| A10 | Durable DRAFT, approval, idempotency and artifact recovery | Blueprint pp. 6, 14–16 | BigQuery repository, Firestore idempotency adapter, Storage/PDF card service, guards in `src/service-ports.js` and `index.mjs`; PO review remains in-process 30m/100 entries | Offline in-memory lifecycle/recovery/idempotency tests pass; recorded candidate has gates configured, not end-to-end verified. | **PARTIALLY VERIFIED** | Live persistent write/read-back/approval/card retrieval needs operation-specific approval. Define durable PO review and cross-instance rate-limit approach; test concurrent and repeat actions against authorized test data. |
| A11 | Localization, currency, plant config and multilingual PDF | Blueprint pp. 16–18 | Seven locale JSON files; `src/fx-rates.js`; money contracts; PDF renderer and font handling; strict supported language/currency validation | Offline locale, currency, approval preference, PDF tests pass. Existing translation glossary CSV/config and live Translation path are not confirmed. | **PARTIALLY VERIFIED** | Verify reviewed glossary and live translation authorization; confirm required language fonts/rendering for target scripts; plant cost/config requires authoritative values. |
| A12 | Robustness, safe authorization boundaries and truthful failures | Master prompt §12; Blueprint API contracts | Request schemas, timeout-aware adapters, bounded read SQL, exact runtime gates, sanitized errors, response validation | Unit/contract tests pass; route returns honest unavailability when adapter absent. This audit is not a formal security review. | **PARTIALLY VERIFIED** | Review trusted proxy/client-IP and distributed limits, authN/authZ for approval, and all current deployed gates. Keep private IAM; no public access. |
| A13 | Reproducible candidate and deployment provenance | Master prompt §5; tracker Sections 81–84 | `Dockerfile`, `.dockerignore`, runtime manifests, explicit container copy allowlist and tests | Offline build-context contract test passes. Recorded candidate came from dirty worktree and predates latest local changes; traffic recorded unchanged. No fresh cloud check or deployment. | **BLOCKED — AUTHORIZATION** | Review/preserve dirty tree, authorize clean commit, build from exact SHA, then separately authorize private candidate deployment and acceptance. |
| A14 | Demo/submission evidence accurately represents capabilities | Blueprint pp. 2–3, 20–22 | UI qualifies modelled/historical/counterfactual figures; tracker records blockers | No verified full live demo or final deck/video/submission evidence in this audit. | **PARTIALLY VERIFIED** | Complete only a truthful constrained demo plan using evidenced functions; secure live workflow acceptance before representing the full journey. Confirm event submission checklist with official current rules. |

## F. Workflow traceability

Current-source workflow (offline architecture; external stages not thereby live
verified):

```text
Operator PDF/JPEG and context
  -> POST /orders/extract
  -> MIME/schema checks
  -> Vertex Gemini extraction (gated) + BigQuery catalog match (gated)
  -> line selection / source-line confirmation in UI
  -> POST /jobs with confirmed PO line, shift, all seven actual levers,
     review reference and optional Idempotency-Key
  -> deterministic coordinator:
     current conditions -> provenance gate -> risk prediction
     -> similar runs -> optimization -> explanation -> JobSheet DRAFT
  -> BigQuery DRAFT persistence and Firestore idempotency (gated)
  -> GET /jobs/{id} read-back
  -> POST /jobs/{id}/approve (explicit route; live supervisor identity
     authorization has not been established)
  -> card PDF generation/storage
  -> GET /jobs/{id}/card.pdf
  -> optional feedback/Impact (writes gated; Impact is read-only)
```

| Stage | Source contract / implementation | Failure and persistence behavior | Evidence |
|---|---|---|---|
| Upload/extraction | Multipart PDF/JPEG via `/orders/extract`; storage temporary object and Vertex JSON extraction; only PO number/buyer/delivery date and source-line code/quantity are extracted. | Invalid MIME/size/operator fields return validation errors; model/catalog failures return unavailable; temporary upload cleanup is attempted. | Adapter/schema/fixture tests; one historical production extraction failure. |
| Catalog and review | BigQuery item master matches extracted item code; ambiguous/unmatched/missing fields remain visible for operator clarification; operator provides PO ID, loaded paper and supplier. | No inferred specs, settings or quantity; `/jobs` requires confirmed source line when review reference is used. Review state is local process memory with 30-minute TTL/max 100 entries. | Synthetic PO contract tests; local review behavior only. |
| Conditions | BigQuery latest row for configured plant, with sensor provenance and timestamp. | Missing/invalid/future row fails; source not exactly live becomes simulated/unverified; freshness remains `unassessed` without approved age limit. Coordinator rejects simulated, unverified, missing or unassessed data. | Offline tests and historical simulated row; no genuine current data acceptance. |
| Risk prediction | `POST /risk/predict` uses Om's parameterized `sql/predict.sql`, 5 ML.PREDICT outputs and result-schema checks. | Read-only query, bounded bytes; malformed/inconsistent response fails rather than presenting fabricated risk. | Unit/contract tests; historical authorized live query for demo input, not re-run here. Model quality is a separate failed gate. |
| Similar evidence | `POST /risk/similar-runs` and `/evidence/seen-before` call supplied SQL. | Adapter failure returns unavailable; evidence is distinct from current outcome. | Offline tests; historical BigQuery responses in tracker. |
| Optimization | `POST /risk/optimize`; existing grid and maximum-three-change contract. | Strict schema and baseline matching in coordinator. Business objective remains disputed. | Offline contract tests; no accepted authoritative formula. |
| Explanation | `/risk/explanation` consumes validated prediction, optimization and evidence and uses Gemini under gate. | Unavailable/failure stops coordinator; explanation cannot set machine settings or invent risk. | Offline adapter/trace tests; live explanation end-to-end not established. |
| JobSheet DRAFT | `/jobs` validates operator inputs and request idempotency then runs coordinator; BigQuery repository write is separately gated. | No successful job if persistence/idempotency unavailable; no in-memory fake-as-success. | Fixture-backed DRAFT lifecycle with fake repositories; no production record. |
| Approval/card | `/jobs/{id}/approve` and `/jobs/{id}/card.pdf`; stored status and PDF/object flow. | Preferences validated before side effects; explicit approval endpoint. Supervisor identity binding and full production authorization remain unproven. | Offline in-memory lifecycle tests; no live approval/card operation. |
| Impact | `GET /impact/summary` executes four supplied queries; UI qualifies history and September counterfactual. | Schema/data errors return unavailable with no preview substitute; one-hour cache. | Offline service/UI tests; historical results only, no fresh cloud call in this audit. |

The full fixture-based test reaches review, coordinator, fake service calls,
DRAFT, retrieval, approval and card. It is valuable offline integration
evidence, but does not close any live stage. No current full production run
has traversed all stages.

## G. Model-quality report

The last recorded live named-model evaluation is historical evidence dated
2026-10-14 in tracker/config notes; it was not refreshed during this audit.
Required threshold: R² >= 0.6 for each of the five defect regressors.

| Active model | Historical R² | Recorded threshold status |
|---|---:|---|
| Warp (`m_warp`) | 0.6051769 | Pass, narrow margin |
| Delamination (`m_delam`) | 0.6664104 | Pass |
| Strength (`m_strength`) | 0.4672613 | **Fail** |
| Print (`m_print`) | 0.7511529 | Pass |
| Crack (`m_crack`) | 0.3010716 | **Fail** |

The Blueprint expects feature-importance rankings to align with its synthetic
defect rules. A prior recorded `ML.FEATURE_IMPORTANCE` query reports
nonzero `customer_id` gain for all five active models and the historical
training query used a random row split. This creates a generalization/
memorization concern; it is not by itself proof of leakage.

The repository prepares separately named `*_grouped_v1` models using
customer-fingerprint holdout, excluding `customer_id`, identifiers, date and
non-target outcomes. Its training SQL uses `CREATE MODEL`, not
`CREATE OR REPLACE`, and is mutating/billable. Evaluation and feature-
importance SQL are read-only query operations that may also incur charges.
None of these candidate SQL files was run; the filenames are not model
identities that prove trained resources exist. The exact active Vertex
registry version linkage and an authorized current held-out evaluation are
still required. No training or retraining was done for this audit.

**Disposition:** model acceptance **FAILED** on the last recorded metrics;
customer-grouped remediation **BLOCKED — AUTHORIZATION** until explicit
training/evaluation authorization and valid candidate metadata/results exist.
Do not lower the threshold or claim improved scores.

## H. Optimizer and impact report

### Optimizer contract

| Contract item | Blueprint | Om handoff/current SQL | Status |
|---|---|---|---|
| Baseline | Plant-standard or median settings | Supervisor's planned settings | Conflicting |
| Throughput penalty | Fixed first-pass thresholds: ₹200/drying hour above 6; ₹60 per m/min SF below 45; ₹30 per sheet/min print below 55 | Penalty only for slowing versus operator plan: ₹200 per added drying hour, ₹60 per m/min slower SF, ₹30 per sheet/min slower printing | Conflicting baseline/reference point and formula |
| Practicality | At most 3 changes from standard baseline | At most 3 changes from plan baseline | Depends on baseline decision |
| Cost basis | ₹45/kg is a placeholder to be confirmed | SQL uses `prepagent.plants.cost_per_kg` and base currency | Current authoritative plant setting/decision required |

The current `sql/optimize.sql` implements Om's planned-settings contract and
tests validate that request/response. A historical raw-value comparison
showed how currency-cost assumptions change the example; it did not resolve
the business contract. Do not state monetary savings as accepted production
recommendations until Om/plant owner provides a written decision and expected
unrounded case.

### Impact method

The supplied `impact.ts` pairs each held-out September recommendation with the
same synthetic lot, conditions, and hidden latent values, then evaluates the
actual and recommended settings using `trueScrap`. It computes scrap cost,
applies only slowdown penalties to the recommended setting, and totals the
resulting net savings; the generator and cost configuration define units.
`dash_kpis.sql` aggregates rows in `prepagent.impact_lots`. The app's Impact
service derives a September 2026 counterfactual and the UI labels it
“counterfactual, not observed production”; historical lot charts are
separately identified as historical records rather than verified factory
outcomes.

Recorded historical September output is **simulated held-out evidence**, not
an observed production result. The display contract conflicts: Blueprint
p. 21 says annual savings = monthly × 12; Om's SID notes say show the
monsoon-month result and do not annualize; supplied SQL headers still mention
annualizing. Current application UI shows the month/counterfactual and does
not present an annualized amount. The owner must decide before any annual
figure is introduced.

**Disposition:** impact calculation and offline labeling **PARTIALLY
VERIFIED**; current live aggregate, exact holdout lineage, and approved
annualization rule are not verified. Do not present predicted/counterfactual
or synthetic values as actual savings or causal impact.

## I. Google Cloud and deployment report

The table distinguishes implementation/configuration from historical
connectivity evidence. No service was called during this audit.

| Service | Intended role and local implementation | Recorded evidence | Current acceptance |
|---|---|---|---|
| Cloud Run | Hosts Hono app; service `prepagent`, region `asia-south1`, port 8080, service cap 2, private IAM. | Manifest records production `prepagent-00005-s5x` at 100%, `prepagent-00011-yew` tagged at 0%, authenticated proxy health/status/UI checks, no public invoker. | Historically private and reachable via authenticated proxy; current routing not freshly checked. Release/source equivalence not established. |
| Vertex AI Gemini | PDF extraction and explanation through `src/google-cloud/vertex-gemini-client.js`; requires both manifest `modelCallsEnabled` and exact runtime `USTAAD_ENABLE_LIVE_MODEL_CALLS=true`; workload identity. | One previously authorized low-level readiness call succeeded (not repeated). Historical app extraction attempt failed; no complete extraction workflow. | Implemented/configured in candidate; current service call and workflow not accepted. |
| BigQuery / BQML | Read client, risk/optimizer/evidence/conditions/Impact SQL, write repository and feedback. | Historical prediction, optimization, evidence, Impact query evidence; manifests record gates. | Mixed historical connectivity; no fresh audit query. Writes/DRAFT not verified live here. |
| Cloud Storage | Temporary PO upload/cleanup and stored card objects. | Adapter and gate in source/config; no complete current PO/card path. | Implemented/configured, not workflow-verified. |
| Pub/Sub | Sensor event topic and sink route. | Historical single simulated publish and row read-back are in tracker. | Simulated only; no genuine telemetry. No publication in this audit. |
| Dataflow | Intended sensor-stream pipeline. | Prior job attempts failed with `ZONE_RESOURCE_POOL_EXHAUSTED`. | Not end-to-end verified. No retry/create/restart. |
| Firestore | Durable idempotency. | Manifest records database/API/gate from a previously authorized setup. | Adapter/gate configured historically; no current claim/write or full job lifecycle test against cloud. |
| Cloud Translation | Glossary-backed text translation and localized job/feedback output. | App locales exist; glossary artifact/config not confirmed. | Partial local support; live service and glossary not accepted. |

### Deployment/source provenance

The last recorded production/candidate distinction is in
`config/gcp-cloud-run.json` and tracker Sections 81–84. Production is recorded
on `prepagent-00005-s5x` at 100%. `prepagent-00011-yew` is a private,
zero-default-traffic candidate at 0%, image digest
`sha256:7d75f6ea42f67832d0cfb2240592be4b966a68fd68e8cf98038b131cc2117e75`,
Cloud Build `e01b285a-d6d2-4729-a6e4-31dd150b3786`. It was built from a dirty
worktree based on `844d872193793fe23aa3c1ec81243c81d760b314`, without a source
commit SHA, and predates subsequent local changes. No deployment, revision
promotion, traffic shift or IAM change occurred in this audit. Private access
must remain private.

### Reproducible release procedure (prepared, not executed)

1. Review all 40 modified tracked paths and 47 untracked paths from the
   starting status. Preserve the workspace reference documents outside the
   application repo and do not add fixture/reference material accidentally.
2. Resolve owner and authorization blockers; update only intentionally
   accepted changes. Run offline tests and static checks on the exact tree.
3. Obtain explicit permission to create a clean commit; record its SHA.
4. Separately authorize a build from that exact clean SHA using the
   repository's established Cloud Build/Artifact Registry configuration.
   Record build ID, source SHA/archive, digest and image.
5. Separately authorize a private zero-traffic Cloud Run candidate deployment;
   retain IAM privacy and verify with the approved authenticated proxy.
6. Run only separately approved bounded API operations. Do not shift traffic
   or promote until the complete acceptance gates pass and an explicit
   promotion decision is given.

## J. Test execution report

| Command | Result | Evidence class / cost boundary |
|---|---|---|
| `cd prepagent && npm run test:acceptance` | 218 tests, 218 pass, 0 fail | Offline tests; injected/fake service boundaries, no GCP account/calls. |
| `cd prepagent && npm test` | 384 tests, 384 pass, 0 fail | Full offline/unit/contract suite; no live GCP operation. |
| `cd prepagent && find . -type d -name node_modules -prune -o \( -name '*.js' -o -name '*.mjs' \) -type f -print0 \| xargs -0 -n1 node --check` | Passed | Static syntax; vendored dependency directories excluded. |
| Config JSON parser over `config/*.json` | 10 files parsed | Local syntax/config only; no secrets displayed. |
| `cd prepagent && git diff --check` | Passed | Local diff whitespace validation. |

The two suites were first launched concurrently and both exhibited failures
on their shared hard-coded test port 4100. Those simultaneous runs are not
counted as acceptance passes. The acceptance suite was rerun alone and passed
218/218; the full suite was then run separately and passed 384/384. No test
was deleted or weakened to produce these results. The shared-port behavior
should be kept in mind if someone tries to run both commands concurrently.

Offline fixtures, adapter fakes, and the historical simulated sensor event are
not live cloud evidence. No live verification command was run in this audit.

## K. Security, privacy, and authorization

- Keep Cloud Run private (`allowUnauthenticated=false` in the recorded
  manifest). The supported developer browser route recorded by the tracker is
  `gcloud run services proxy prepagent --project=prepagent-hack
  --region=asia-south1 --port=8082`; it requires the caller's existing
  invocation permission. Do not put identity tokens or service credentials in
  browser code, grant public access, or broaden IAM.
- Local calls are same-origin; no arbitrary dashboard CORS integration is
  evidenced. A separate dashboard should use a server-side authenticated
  proxy/BFF with narrowly scoped invoker permissions.
- Default local model/cloud writes are disabled. The app has separate runtime
  gates for risk/evidence/Impact, model calls, BigQuery writes, job storage,
  Firestore idempotency and feedback writes. A true gate means configured, not
  proven.
- PO review state and per-process request rate limiting are not shared across
  instances. Forwarded client-IP handling is deliberately not trusted; a
  production proxy and distributed rate-limit design remain open.
- Photo writes/classification remain unavailable without approved consent,
  provenance, retention and real-image evaluation. Feedback write gate is
  recorded false.
- Approval route availability does not establish authenticated supervisor
  identity/authorization. Production approval controls need review.
- No cloud operation, persistent mutation, paid provider operation, deployment
  or access-control change occurred for this audit. Prior historical operations
  may have incurred costs; their total is not established here.

## L. Final closure decision

| Acceptance area | Status | Evidence still required | Next action and owner | Blocks |
|---|---|---|---|---|
| Core PO-to-card workflow | **PARTIALLY VERIFIED** | One authorized live trace from upload through stored approved card retrieval, with one consistent job/order and no duplicate. | User/release owner and supervisor approve bounded paid/persistent acceptance; execute once on a clean candidate. | Full demo, submission claims, production. |
| Model acceptance | **FAILED** historically; remediation **BLOCKED — AUTHORIZATION** | Current version-linked grouped holdout metrics and feature-importance rule review for all five models; Strength/Crack >= .6. | Model owner supplies/authorizes candidate training and evaluation; keep active models unchanged. | Recommendation acceptance and production. |
| Optimizer acceptance | **BLOCKED — EXTERNAL DECISION** | Written baseline, penalty, plant cost, and expected unrounded case. | Om/plant owner records decision; engineer updates SQL/tests only afterward. | Savings/recommendation claims. |
| Impact acceptance | **PARTIALLY VERIFIED** | Reproduced held-out evaluation and authoritative annualization decision. | Owner reconciles Blueprint vs SID notes and stale SQL comments; separately authorize billable read query if needed. | Impact claims/deck. |
| Sensor acceptance | **BLOCKED — DATA/INFRASTRUCTURE** | Genuine device reading, direct sink read-back, owner freshness bound; Dataflow capacity. | Plant/device owner supplies one measurement; user separately authorizes bounded publication/query. No Dataflow retry until fresh capacity evidence and authorization. | Safe production conditions, end-to-end workflow. |
| Google Cloud integrations | **PARTIALLY VERIFIED** | Current exact revision/API evidence for each adapter and end-to-end workflow; no inference from status alone. | Release owner authorizes narrowly scoped authenticated verification; preserve private boundary. | Full integration acceptance. |
| Photo/privacy | **BLOCKED — DATA/INFRASTRUCTURE** | Written consent/provenance/retention permission and evaluation data. | Product/privacy/plant owner provides the approved contract. | Photo feature and feedback. |
| Localization | **PARTIALLY VERIFIED** | Reviewed terminology glossary and live translation / multilingual PDF acceptance. | Om/localization owner supplies reviewed glossary and approves setup. | Multilingual feature claims. |
| Build/release | **BLOCKED — AUTHORIZATION** | Clean source commit, exact build provenance, private candidate and acceptance. | User authorizes commit/build/deployment as separate operations. | Cloud release. |
| Demo/submission | **PARTIALLY VERIFIED** | Verified live steps or a clearly qualified fixture-only narrative and current official submission checklist. | Team confirms submission rules; avoid unsupported live capability claims. | Strong technical judging. |
| Production readiness | **FAILED / NOT READY** | All above critical gates, durable review/limit design, authorization and current operational evidence. | Do not promote or call production-ready until gates close. | Production. |

## M. Handoff for independent review

Copy-paste handoff:

> Project: Ustaad AI, Corrugated Production-Prep Agent, application repo
> `/Users/siddhant/prepagent-work/prepagent`. Objective: bring the existing
> PO-to-approved-job-card application to its strongest defensible technical
> state for AI Builder Cup 2026, with evidence rather than claims.
>
> Authoritative materials reviewed: workspace `docs/Corrugated Production-Prep
> Agent — Build Blueprint 3.pdf`; `Prep_Agent_3-Day_Sprint_Playbook.pdf` and
> `.docx`; Om's `docs/sid_pack/SID_NOTES.md`, SQL and `impact.ts`;
> `docs/synthetic_POs/README.md` and `expected_results.json`; app
> `docs/PART2_COMPLETION_TRACKER.md`, `docs/CLOUD_INTEGRATION_TODO.md`,
> `docs/LOCAL_DEVELOPMENT.md`, source, config, SQL and tests. References are
> outside the application Git repo.
>
> At audit start, branch `main`, HEAD
> `844d872193793fe23aa3c1ec81243c81d760b314`, worktree already contained
> 40 tracked modifications and 47 untracked paths; they were preserved. No
> reset, staging or commit.
>
> The current source implements multipart PO extraction, catalog matching,
> an operator-review flow, a deterministic coordinator, BigQuery prediction/
> optimization/evidence/conditions/Impact adapters, Vertex Gemini, Cloud
> Storage, BigQuery persistence, Firestore idempotency, approval/card
> services, and SSE traces. Missing adapters fail closed. Offline
> `test/po1-coordinator-workflow.test.js` exercises a fixture with fake
> services and in-memory lifecycle; it is not live-cloud proof.
>
> Reproduced offline tests: `npm run test:acceptance` = 218/218;
> `npm test` = 384/384; application JS syntax checks passed; 10 config JSON
> files parsed; `git diff --check` passed. Running both suites concurrently
> caused shared test-port-4100 collisions; separate sequential runs passed.
>
> Historical model R²: Warp .6051769; Delam .6664104; Strength .4672613;
> Print .7511529; Crack .3010716. Strength/Crack fail the >=.6 threshold.
> `customer_id` had nonzero feature gain across models and prior split was
> row-random; grouped-customer candidate SQL is prepared but not executed.
> Training/evaluation authorization is needed; do not overwrite active
> models.
>
> Optimizer contract is blocked: Blueprint says plant-standard/median
> baseline and absolute penalties; Om SQL uses operator-planned baseline and
> plan-relative slowdown penalties. Plant cost/kg also needs authoritative
> confirmation. Impact uses `trueScrap` on held-out synthetic September lots
> but Blueprint says annualize ×12 while Om says do not annualize the
> monsoon month. Current UI labels the result counterfactual/not observed;
> no new impact query ran.
>
> Historical Cloud Run records: private service `prepagent` in
> `prepagent-hack/asia-south1`; production `prepagent-00005-s5x` at 100%,
> candidate `prepagent-00011-yew` at 0%, digest
> `sha256:7d75f6ea42f67832d0cfb2240592be4b966a68fd68e8cf98038b131cc2117e75`,
> build `e01b285a-d6d2-4729-a6e4-31dd150b3786`. Candidate was built from a
> dirty worktree with no commit SHA and predates later local changes. These
> facts come from recorded manifests/tracker, not a fresh cloud query in this
> audit. Keep Cloud Run private.
>
> Evidence classes: fixture-based and mocked tests are offline; one historical
> simulated Pub/Sub sensor event is not genuine telemetry; previous bounded
> BQ/Gemini checks are historical and not repeated. No Cloud Run call,
> deployment, traffic or IAM change, paid provider call, BigQuery query/write,
> Pub/Sub event, Dataflow operation, Firestore write, approval, or job-card
> creation occurred for this audit. Earlier project operations may have cost
> money; total cost is unknown.
>
> Priority next actions: (1) Om/plant owner decides optimizer baseline,
> penalties and cost/kg in writing; (2) plant/device owner provides confirmed
> machine inputs, genuine sensor evidence and a freshness limit; (3) model
> owner/user authorizes grouped candidate training and evaluation; (4) user/
> supervisor separately authorizes one bounded paid/persistent live
> PO-to-approved-card test; (5) product/privacy owner resolves photo consent,
> PO-review durability and trusted proxy rate limiting; (6) user authorizes a
> clean commit and separate exact-SHA private build; (7) reverify candidate
> privately before any separately authorized traffic decision. No task here
> authorizes public access, data writes, paid calls, training or deployment.
>
> Final status: NOT READY; core workflow, model, optimizer, impact, cloud,
> demo/submission, and production gates remain open or partially verified.

## N. User-facing summary

The application has broad local API and workflow implementation, and the
reproduced offline acceptance/full suites pass. The fixture-backed lifecycle
is not a live cloud workflow. Two recorded model metrics fail the published
threshold; optimizer and annualized impact instructions conflict; genuine
sensor freshness, live storage/job lifecycle, and source-pinned deployment
remain unverified. The service is intended to remain private.

No cloud resources or persistent cloud data were changed for this audit, and
no potentially billable operation was run. Historical project operations may
have incurred costs; the total is unknown. The complete audit is this file:
`docs/CODEX_END_TO_END_ACCEPTANCE_AUDIT.md`. Highest-priority next step is
Om's written optimizer contract decision, followed by authorized model and
genuine sensor evidence and a separately approved live workflow.
