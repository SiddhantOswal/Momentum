# Corrugated Production-Prep Agent — Independent Readiness Audit

**Audit date:** 15 October 2026 (Asia/Kolkata)  
**Scope:** Analysis only. Local repository inspection and local Node test suites. No cloud operation, build, upload, inference, deployment, IAM, traffic or data write was performed.  
**Authority:** [Om's decisions](OM_DECISIONS.md) supersede older blueprint/playbook statements where they conflict.

Evidence labels used: verified in code; verified by local test; verified by read-only cloud evidence; verified by bounded live acceptance; inferred but unverified; unknown/requires owner input.

## Executive assessment

The repository contains a substantial local prototype, but is **not ready for public judging or a meaningful private cloud acceptance workflow**. This audit independently ran the local suites: **npm run test:acceptance: 232 passed, 0 failed, 0 skipped**; **npm test: 400 passed, 0 failed, 0 skipped**. Tests verify local contracts and mostly injected test doubles. They do not verify cloud connectivity, deployed source, current model versions, real Gemini extraction, BigQuery SQL execution, Storage writes, or a persisted deployed PO-to-card workflow.

Five highest-priority blockers:

1. No numeric daily Gemini cap; the process-local request limiter does not implement D1's daily call limit. Actual per-IP behavior behind Cloud Run is unverified.
2. No authenticated supervisor identity or role check for approval; a UI action/client boolean is not authorization.
3. Direct risk prediction returns BigQuery model output while model acceptance is blocked; only the job coordinator applies the gate.
4. Legacy /api/agents/* routes call mock agents outside explicit demo mode, bypassing live-service and model acceptance gates.
5. The source tree is dirty and the documented image/revision is from a different, older dirty source archive. Current cloud state was not refreshed.

Other prototype gaps: D7 expects 12 photos while the prior recorded listing showed 10; no complete classifier acceptance flow is wired; feedback does not insert the completed TEST lot required for the “factory learned” beat. D6's process-local idempotency is consistent with the approved prototype decision but cannot guarantee cross-instance exactly-once behavior. Historical aggregate R² values meet the approved prototype thresholds but do not establish version-linked model acceptance.

The D2/D3 optimizer appears consistent with Om's approved contract at source and local-test level. No live optimizer query was run, so PKBX0041 remains unverified here.

### Readiness matrix

| Level | Verdict | Evidence |
|---|---|---|
| Local development | **Conditionally Ready** | Both suites pass on this dirty worktree. Demo data is synthetic; cloud behavior is not represented. |
| Private cloud acceptance | **Not Ready** | No fresh cloud evidence; model evidence incomplete; approval lacks identity; deployed source/revision mismatch unresolved. |
| Public hackathon judging | **Not Ready** | Daily cap absent, per-IP topology unverified, mock routes callable, synthetic-only ingestion not enforced, provenance/budget/rollback not fresh. |
| General software production | **Not Ready** | No authentication/authorization, cross-instance idempotency, complete observability/recovery, verified integrations or reproducible release. |
| Real-factory production | **Not Ready** | Explicitly out of D0 scope; no physical sensors, real-lot validation, measured outcome evidence or factory signoff. |

## 1. Repository state and provenance

- Branch main; HEAD af986bc9be31efbe695fb0259fddffc61abd1636 (feat(ui): redesign Prep Agent operator interface). Local branch decoration aligned with origin/main at inspection; this does not imply a clean tree.
- Before this report, git status showed 42 modified tracked paths and numerous untracked paths across app, tests, docs, config, SQL, Docker artifacts and fixtures. They were inspected and preserved; this report is the only audit addition. Diff stat before report: 9,214 insertions and 676 deletions across the 42 tracked modifications.
- Runtime package prepagent 1.0.0, ESM, Node >=20.10; Docker selects node:22-slim. npm start runs node index.mjs; root tests use Node's test runner. Hono, @hono/node-server, Zod, PDFKit are runtime dependencies. Root and tools lockfiles exist; some root dependencies use semver ranges. No dependency advisory scan was run.
- Dockerfile installs production dependencies, copies index.mjs, src, sql, assets and config; runs as node on 8080. .dockerignore excludes tests, tools, docs, env and secret-like files and allowlists three config JSON files. Build-context tests exist; no container build was run, so image construction/runtime parity is unverified.
- Entry point index.mjs selects demo only when not on Cloud Run and USTAAD_ENABLE_DEMO_MODE=true; K_SERVICE selects live-service even if integrations are unavailable; otherwise offline. Gates separately control live models, predictions, history, impact, writes, feedback and job storage. Missing gates suppress adapters. Configured adapter does not equal verified connectivity.
- Relevant env names: K_SERVICE, PORT, PROJECT_ID/GOOGLE_CLOUD_PROJECT, REGION/VERTEX_LOCATION, BUCKET/USTAAD_GCS_BUCKET, GEMINI_MODEL, USTAAD_ENABLE_DEMO_MODE, USTAAD_PLANT_ID, USTAAD_ENABLE_LIVE_MODEL_CALLS, USTAAD_ENABLE_RISK_PREDICTION, USTAAD_ENABLE_HISTORICAL_EVIDENCE, USTAAD_ENABLE_IMPACT_SUMMARY, USTAAD_ENABLE_BIGQUERY_WRITES, USTAAD_ENABLE_JOB_STORAGE, USTAAD_ENABLE_FEEDBACK_WRITES, USTAAD_OPTIMIZER_CONTRACT_STATUS and USTAAD_OPTIMIZER_CONTRACT_VERSION. Missing project/bucket/model/gates prevent related adapters. Secret values are not reproduced.
- RELEASE_PROVENANCE.md, config/gcp-cloud-build.json and config/gcp-cloud-run.json are repository records, not current cloud evidence. They describe historical private production traffic on prepagent-00005-s5x and zero-traffic candidates. Candidate prepagent-00011-yew is documented as built from a dirty worktree based on 844d872 and predating current local changes. No source commit/tree digest proves an image corresponds to this worktree.
- Historical config records service max 2, revision max 12 (said to be bounded by service max), and Firestore idempotency enablement, conflicting with D6/current ports. No current service query was made. Resolve from fresh authorized read-only metadata before release.

### Materials and authority

Inspected OM_DECISIONS, dependency/input registers, cloud todo, completion tracker, release provenance, schema contracts, all five synthetic PO fixtures plus expected results, source/SQL/config/tests, and sid_pack files at /Users/siddhant/prepagent-work/docs/sid_pack/. Blueprint PDF, Playbook DOCX/PDF and editable pitch PDF were read with pypdf. D2/D11 supersede older optimizer and manufacturing stage statements. Older pitch text claims actual factory performance in some places; D9 and current dashboard label estimates as simulation, not measured outcomes.

Approved PO fixtures cover clean single line, multiline, fitment, ambiguity, unknown item, missing quantity and scanned JPEG. Review tests use extraction/catalog doubles; this does not verify Gemini or live catalog. Photos were not read/classified. Dependency register reports a previous read-only list of 10 objects versus D7's 12; that listing is historical and was not refreshed.

## 2. Architecture

Source-level architecture (external services are configured adapters, not verified live):

    Browser UI -> Hono HTTP/API -> body limit / timeout / process-local IP limiter
    Hono -> PO review -> Storage orders -> Gemini extraction -> BigQuery catalog
    Hono -> Job coordinator / local trace -> conditions BigQuery
                                      -> five BigQuery ML predictions
                                      -> optimizer / evidence / explanation queries
                                      -> BigQuery job_sheets + local idempotency
                                      -> approval -> PDF -> Storage jobcards
    Hono -> TEST-only feedback -> BigQuery feedback
    Hono -> same-origin impact dashboard -> four BigQuery dash queries
    Separate optional publisher tool -> Pub/Sub (not app request-path integration)

| Component | Purpose, files and boundary | Failure/evidence |
|---|---|---|
| UI | src/operator-ui.js, risk-ui.js, impact-ui.js, public/impact.html, CSS/locales. Sends PO/operator inputs; renders risk, state and dashboard. | Local tests only. Data-bound innerHTML sinks remain in impact dashboard; Chart.js uses CDN. |
| HTTP server | index.mjs; Hono routes and schemas. Multipart/JSON → JSON/PDF/SSE. | 10 MiB body limit, 60s timeout, sanitized errors. Legacy mock route family is a bypass. |
| Ports/runtime | src/service-ports.js and config. | Availability means function exists. Status includes integrationsVerified=false, appropriately; productionAdaptersConfigured is an OR and not readiness. |
| PO review | src/google-cloud/order-extraction-service.js, purchase-order-review.js, file validator. | MIME/signature, size, strict output, catalog matching and clarification. Upload cleanup best effort. Tests use mocks. |
| Conditions/prediction | current-conditions-service.js, sql/predict.sql, prediction and acceptance modules. | Parameterized query and strict schema/totals. Prediction endpoint itself does not gate acceptance. |
| Optimization/evidence | sql/optimize.sql, explain/similar/seen SQL and services. | Named params, response checks and bounded bytes. No live execution in this audit. |
| Job lifecycle | coordinator, persistence/idempotency modules, BigQuery repository, card service, PDF renderer. | TEST guards, persisted draft read-back, conditional DRAFT approval and card retrieval. Process-local idempotency; no authenticated approver. |
| Feedback/photos | feedback service, linked feedback, photo-label mapper. | Stored TEST job check; photo fields refused; no completed-lot insert. No full classifier workflow. |
| Impact | public/impact.html, impact service and four dash SQLs. | Same origin, no preview fallback, simulated labels. Repeats four queries per request; no cache proven. |
| Publisher | tools/publisher.mjs and runtime. | Separate process; not invoked; no Dataflow execution. |

## 3. Critical workflow traces

### PO ingestion/review

POST /orders/extract parses multipart, checks PDF/JPEG signature, validates operator fields, calls gated Storage/Gemini/catalog path, normalizes structured output, resolves catalog item and returns review token/fingerprint. UI selects and confirms line; POST /jobs checks review identity/fingerprint and operator-confirmed code/quantity. Specs are catalog sourced; model must not infer settings. Missing/ambiguous/unknown inputs are held. File is capped at 10 MiB and output/line count bounded.

Risks: no explicit PDF page/object or decoded-image pixel cap; model reads untrusted content with no specific prompt-injection test suite; confidence is not calibrated; retries/reuploads can repeat calls and temporary objects; extraction has no idempotency key; upload/extraction/cleanup can partially succeed. Fixture tests are local doubles. No PO was uploaded.

### Conditions and prediction

Conditions adapter selects latest reading for configured plant/shift; parser checks identity, timestamp and schema. D5 simulated labels, manual entry, stale age >24h note and confirmation appear in source. Server requires a caller boolean; this is not authenticated supervisor proof. No fabricated reading path is intended. No BQ read occurred.

Prediction SQL takes named params and returns five risks with schema/finite/totals/primary-defect checks. Config records D4 thresholds WARP .6, DELAM .6, STRENGTH .45, PRINT .6, CRACK .30 and historical R² values. Strength .4672613 and Crack .3010716 exceed prototype thresholds. Evaluation is not linked to current versions; sample counts/version IDs and version-linked feature-importance artifact are absent. Therefore complete evidence is missing. risk-prediction-service attaches status but returns success; coordinator later blocks it. Direct /risk/predict is a bypass.

### Optimization

sql/optimize.sql agrees with D2/D3 and newer sid_pack canonical source: planned settings baseline; blank settings use approved PLANT-01 standards; seven grids include plan; max three changes; drying +₹200/hour, slower SF +₹60/m/min, slower print +₹30/sheet/min; no speed-up reward; ₹53.30/kg; whole-rupee row costs; deterministic tie order by cost, number of changes, then seven levers. Exact missing item/plant ASSERT messages exist. Adapter validates schema, baseline, grids, penalty, change count and savings.

Expected PKBX0041: baseline 10.18%, 100.4kg, ₹5,351; best roll 170/gum MED/viscosity 35, 8.42%, 83.0kg, ₹4,426; predicted savings 17.4kg/₹925 and penalty 0. This was not verified against BigQuery. Cartesian grid upper bound 17,280 rows before <=3 filter and five ML.PREDICT calls; query cap is 80MiB. Cost/latency unmeasured. UI should say predicted and “slower-production allowance,” not measured.

### JobSheet, approval and card

POST /jobs validates reviewed PO, conditions, shift and planned settings; coordinator extracts, gets conditions, predicts, optimizes and creates JobSheet draft. BigQuery writer MERGEs job_sheets; app requires persisted schema-equivalent read-back. TEST- guards exist. Card service renders stored DRAFT, uploads PDF, conditionally approves only DRAFT, then reads back; retrieval requires APPROVED and downloads/validates PDF. Local render endpoint accepts caller sheet but does not persist/approve.

Process-local idempotency cannot coordinate two Cloud Run instances or survive restart; BigQuery MERGE is not a unique constraint. D6 accepts prototype architecture but exactly-once claims are false. Storage upload before approval can orphan card after crash; cleanup is best effort. Approval lacks authenticated supervisor identity/role/actor audit. No live write/readback/card retrieval occurred.

### Feedback/photos

Feedback route fetches stored job, enforces TEST- prefix and optional lot/order association, then BigQuery feedback insert. Writer allowlist is job_sheets and feedback, not lots. D7's completed-lot insert/learning path is absent. Folder mapper includes crushed→STRENGTH and good→NONE; full bucket list/download/classify/compare/route is not wired, and feedback rejects photo fields. Twelve-versus-ten count requires Om's exact list or confirmation. No photos classified.

### Impact

GET /impact/summary maps four queries to {kpis,monthly,seasonal,topItems}; /impact is same-origin. Page has no static preview; unavailable state has no fake values; simulated labels exist and no annualization appears. Monthly/seasonal SQL reads all pre-Oct-2026 lots; top items reads trailing year and description; KPI reads held-out impact_lots. No params/partition byte evidence; four queries per request and no cache established. Public item codes/descriptions need anonymization confirmation. Older SID SQL comment says annual = month×12 but body says do not; D9/current page support one held-out month. Keep unannualized.

### Status/health

/health is process liveness, not dependency readiness. /api/status distinguishes configured ports and integrationsVerified=false, sensor dataChecked=false, local idempotency and model summary. productionAdaptersConfigured is an OR and should not be readiness. Legacy /api/agents/* calls mocks in live mode. Trace/SSE is bounded and process local; no payload logging observed. Generic error logs omit request correlation; no metrics/alerts verified.

## 4. Security review

| ID / severity | Location; scenario | Action and regression test | Evidence/readiness |
|---|---|---|---|
| SEC-01 High | index.mjs /api/agents/* lets live/public callers reach mock conditions, risk, optimization, explanation, similar runs and job sheet. | Disable outside local demo; Cloud Run-mode tests ensure no mock success. | Verified code; blocks public. |
| SEC-02 Critical | Approval route and job-card-service have no authenticated principal/role. Anyone with TEST job ID can approve. | Add identity/role/actor audit or disable persistent public approval; test unauthenticated, wrong role, replay/cross-job. | Verified; blocks real approval. |
| SEC-03 High | request-guardrails uses socket IP, ignores forwarding headers, process local. Cloud Run proxy may collapse/change visible address. | Verify real topology; trusted address strategy; test varied clients/spoofed headers. | Code verified, platform inferred; blocks public. |
| SEC-04 High | No daily Gemini cap. Per-minute limiter is not D1 and per process. | Om sets numeric value/reset/count rules; test cap boundaries and two-instance behavior within D6. | Verified absent; blocks public. |
| SEC-05 High | risk-prediction-service returns usable result when acceptance blocked; coordinator only gates job path. | Gate prediction and downstream decision routes; test missing, threshold-only, accepted evidence. | Verified; blocks private acceptance. |
| SEC-06 High | PO upload accepts arbitrary valid PDF/JPEG despite D1 synthetic-only judging. | Server-side fixture/provenance restriction; test arbitrary source rejected. | Verified; blocks public. |
| SEC-07 Medium | public/impact.html uses data-bound innerHTML; hostile DB item description could become stored XSS. | DOM text nodes; malicious description test. | Verified; public risk if data untrusted. |
| SEC-08 Medium | Top items exposes codes/descriptions potentially derived from customer data. | Confirm anonymization/redact before public display. | Unknown; blocks public pending proof. |
| SEC-09 Medium | Chart.js CDN script executes in app origin; CSP/SRI not evidenced. | Pin/self-host or integrity/CSP; test headers/network failure. | Verified; public hardening. |
| SEC-10 Medium | No auth/session/CSRF boundary; if cookie auth is introduced, POSTs need CSRF controls. | Choose auth then test CORS/CSRF. | Verified; production prerequisite. |
| SEC-11 Medium | 10MiB/type checks exist but no page/object or decoded image pixel limits; 60s timeout. | Bound complexity, test malformed/adversarial docs and prompt injection. | Verified; public/production. |
| SEC-12 Medium | Runtime IAM least privilege not read; code bounds SQL and writer table allowlist. | Fresh read-only role inspection; remediation requires separate authority. | Cloud unknown. |
| SEC-13 Medium | Current cloud secret refs/config not refreshed; no secret value exposed by inspected error path. | Read-only env/secret reference review. | Cloud unknown. |
| SEC-14 Informational | No shell execution observed in request path; publisher separate; object names generated and URI checked. | Keep tools isolated; exhaustive SAST not performed. | Source inspection only. |

## 5. Reliability, data and cost

- Two instances mean local idempotency, trace and rate-limit maps diverge. D6 accepts this for prototype, not production. Same key may be claimed twice; restart loses completion.
- BigQuery draft MERGE/readback handles some retries and detects mismatch but does not guarantee uniqueness. Test concurrent same/different payload, response loss and cross-instance replay.
- Approval saga uploads Storage before BQ state update. Crash may orphan card; cleanup is best effort. D10 TEST cleanup pattern should be checked against random-suffixed object names.
- No durable reconciliation/retention policy shown for orders, orphan cards or TEST rows. Avoid blind retries of paid Gemini and writes.
- 60s timeout signals are passed to adapters; actual provider cancellation/retry semantics require tests. No end-to-end retry budget, SLO, graceful shutdown handler, or external correlation/metrics verified.
- Feedback insert ID is deterministic over payload but insertAll is not strict uniqueness. Feedback can duplicate; learning lot is absent.
- Query clients bound SQL and bytes; response schemas are strict. No complete DDL/migration snapshot or live schema fingerprint verified.
- Estimated call profile: extraction one Gemini call/job; optional explanation one; photo acceptance one per each of 12 approved objects; repeats/retries add calls. Optimizer up to 17,280 candidates × five model predictions under 80MiB cap; prediction uses five models. Impact invokes four queries per load. Actual bytes/latency/cost unknown; no benchmark/dry run/live query.
- Historical playbook mentions ₹5,000 monthly budget alert; D1 requires alert enabled. Current alert/recipients unknown; alert is not a hard spend cap.
- Docker uses floating node:22-slim. No npm audit, SBOM, image scan, build, benchmark or external SAST.

## 6. Test quality and results

| Command | Actual result | Scope |
|---|---|---|
| npm run test:acceptance | 232 passed; 0 failed; 0 skipped; 217 top-level subtests; 6.19s | App/workflows, PO review, lifecycle, adapters with doubles, PDF, impact, runtime/model gate. |
| npm test | 400 passed; 0 failed; 0 skipped; 383 top-level subtests; 6.54s | Full current local suite. |

Unit tests cover schemas/mappers, optimizer decoding, model acceptance, PDF stage order, guardrails, idempotency and trace. Adapter tests use fake fetch/storage/token/Gemini. Workflow tests compose local code with injected ports. This is not Google Cloud integration. No tests skipped. Suites ran on dirty worktree, not HEAD/image. No syntax/config checks, browser automation, container build, vulnerability scan or live integration ran in this audit.

Missing high-value tests: direct prediction gate, Cloud Run mock-route rejection, supervisor authorization, cross-instance/restart idempotency, visitor-IP topology, daily cap, synthetic-only source gate, TEST lot learning write, 12-photo exact inventory, actual BigQuery SQL/PKBX0041, current schema/version checks, hostile dashboard strings/cache/cost, and orphan recovery.

### Bounded acceptance matrix (future)

| ID | Preconditions/action | Expected evidence/pass criterion | Cost / authorization |
|---|---|---|---|
| ACC-01 | Read current Cloud Run/service/IAM/budget/revision state | Access/traffic, max instances, SA, env gates, alert, digest; secrets redacted. | Read-only; schedule separately; no cloud calls in this audit. |
| ACC-02 | One parameterized PKBX0041 optimizer | Baseline ₹5351, best ₹4426, savings ₹925/17.4kg, penalty 0; capture job ID/bytes/schema. | One BQ query; D10, separately scheduled. |
| ACC-03 | Current model versions/evaluation and direct prediction | Version-linked five-model evidence and fail-closed API. | BQ read/prediction; D10; no retrain. |
| ACC-04 | Conditions read/no-row/stale/manual | Simulated source, plant/shift/time/units/age and confirmation. | BQ read; D10. |
| ACC-05 | PO1 then PO4/PO5 synthetic extract/review | Exact expected fields, ambiguity/unknown/missing held, no guesses. | Gemini + GCS writes; D10 but prohibited in this audit. |
| ACC-06 | Same/different idempotency TEST job and failure | One stored draft/replay; changed payload conflict; persistence failure not success. | TEST BQ writes/read; D10, auth design first. |
| ACC-07 | Authenticated approval, retry, independent read/PDF | Persisted approved row, actor, stable repeated card, PDF matches state/stages. | BQ/GCS; D10, identity fix first. |
| ACC-08 | TEST feedback/completed lot | Idempotent linked feedback and TEST lot; similar-run update; no evaluation contamination. | BQ TEST writes/read; implementation first. |
| ACC-09 | Approved photo inventory/classify once | Exact approved names/labels, crushed→STRENGTH, good→NONE, unsupported output fails. | 12 Gemini calls/GCS reads; D7/D10, count first. |
| ACC-10 | Impact load/error/empty/hostile data | Same-origin schema, no preview, simulated labels, bytes and anonymization. | Four BQ reads; caching first, D10. |
| ACC-11 | Public guardrail rehearsal | Cap, IP, synthetic gate, disclaimer, max2, alert, provenance, rollback evidenced. | Local/private; deployment separately authorized. |
| ACC-12 | Rollback plan | Known-good digest/revision, exact private/delete procedure/operator. | Read-only until action; mutation separately approved. |

## 7. Deployment and release

Current state was not queried. Repo manifests record historical private access and max 2; another revision record says max 12; historical production config enables Firestore despite D6/current source. No live revision, image, IAM, budget, URL, health or traffic was verified.

| D1 safeguard | Status |
|---|---|
| Per-IP limiter | Code exists, 60/minute per process; visitor IP unverified. |
| Numeric daily Gemini cap | Missing; owner value required. |
| Synthetic/anonymized-only | Fixtures synthetic; upload accepts arbitrary valid documents. Not end-to-end enforced. |
| Prototype disclaimer | Local UI/test source exists; deployed page not checked. |
| Maximum two instances | Historical manifest only; current service not checked. |
| Budget alert | Unknown. |
| Source/revision provenance | Not reproducible: dirty tree and documented build predates current source. |
| Rollback | Known-good revision/command/operator not verified. Return private or delete by Nov 7 remains required. |
| Video logo blur | D7 requirement; video not inspected. |

Future sequence: close P0 and owner inputs; freeze synthetic inputs; create clean identified source revision in later authorized implementation; run tests/build with pinned base and capture digest; read current Cloud Run/IAM/budget config; perform bounded private acceptance; only with D1 evidence request separate deployment authorization; deploy privately/zero traffic first if approved; smoke-test; public access/traffic only after explicit approval; monitor cost; return private/delete by Nov 7. Keep current access/traffic unchanged now.

Rollback concept: preserve known-good digest/revision and private state before any traffic change; return traffic to known good and separately restore private invocation or delete. Verify current revision/traffic first. No mutation occurred.

## 8. Findings register

| ID | Finding / severity / readiness | Evidence and required action | Test/dependency/release impact |
|---|---|---|---|
| F-01 | Gemini daily cap absent / High / public | D1 requires numeric cap; code only minute limiter. | Owner chooses value/reset/count; cap tests. Blocks public. |
| F-02 | Approval lacks supervisor authorization / Critical / approval | Route/service checks state and TEST prefix, no principal/role. | Owner supplies identity source; auth/actor/replay tests. Blocks real approval. |
| F-03 | Direct prediction bypasses acceptance / High / private | Returns success even if acceptance blocked; coordinator only gates job workflow. | Fail-closed tests; version-linked evidence. |
| F-04 | Legacy mock endpoints callable / High / public | /api/agents/* calls mock agents in live mode. | Cloud Run mode tests; disable outside local demo. |
| F-05 | Proxy IP behavior unknown / High / public | Socket address, local state; Cloud Run client semantics unknown. | Platform topology test and trusted source. |
| F-06 | Cross-instance idempotency gap / High production, accepted D6 prototype limit | Local map + BigQuery MERGE no exactly-once guarantee. | Concurrency/replay tests; no new service without decision. |
| F-07 | Dirty/unmatched release provenance / High / all release | Candidate source predates current code. | Clean pinned provenance/build later. |
| F-08 | Photo count mismatch / Medium / prototype | D7 12; historical list 10. | Om supplies two names or confirms ten. |
| F-09 | No learning lot write / High / promised beat | Writer allows job_sheets/feedback only, not lots. | TEST row contract/lineage/idempotency tests. |
| F-10 | Synthetic-only ingestion absent / High / public | Upload accepts arbitrary valid PDF/JPEG. | Fixture provenance restriction and rejection tests. |
| F-11 | Dashboard query amplification/privacy / Medium / public | Four query requests/load and item metadata; no cache proof. | Cache/limits/anonymization and bytes acceptance. |
| F-12 | Dashboard XSS sink / Medium / public | Data-bound innerHTML. | Safe DOM and hostile input test. |
| F-13 | Partial failures can orphan objects / Medium / acceptance | Best-effort cleanup and approval saga; cleanup patterns uncertain. | Failure injection and reconciliation. |
| F-14 | Annualization comments conflict / Low / claims | Old comment month×12, body/current D9 say no. | Keep one month; no owner decision unless annual number desired. |
| F-15 | Current service/IAM/budget/traffic unknown / High / public | Config is stale documentary evidence. | Fresh read-only cloud acceptance. |
| F-16 | CDN/security headers unverified / Medium / public | External Chart.js, CSP/SRI not evidenced. | Pin/self-host, CSP/header tests. |
| F-17 | Extraction retry may repeat paid call / Medium / public | No extraction idempotency. | Dedupe and call accounting tests. |
| F-18 | Thresholds met but acceptance evidence absent / High / private | R² not version linked; sample counts and feature artifact missing. | Capture current version evidence; no threshold changes. |
| F-19 | Live schemas/migrations unverified / Medium / acceptance | DTO/decoders exist; current DDL not read. | Schema fingerprint and contract comparison. |
| F-20 | Photo flow incomplete / Medium / prototype | Mapper exists; full classify/compare route absent. | Implement after inventory resolution. |
| F-21 | Status aggregate can overstate capability / Low/Medium / ops | productionAdaptersConfigured is true if any adapter. | Consumers use per-capability/integrationsVerified; tests. |
| F-22 | Supply chain/reproducibility absent / Medium / release | Floating base; no build/SBOM/scan. | Pin digest, reproducible build and scan later. |

## 9. Remediation roadmap

### P0 — safety and correctness

1. Disable mock /api/agents/* outside local demo; test every route under K_SERVICE.
2. Enforce D4 model acceptance on direct prediction and all decision-consuming routes. Do not weaken thresholds; require version-linked evidence.
3. Resolve supervisor identity; implement authorization and actor audit, or disable persistent approval during public demo.
4. Obtain numeric Gemini daily cap/reset/count rules; implement/test within D6-approved prototype constraints.
5. Verify per-IP behavior through Cloud Run proxy; never trust arbitrary forwarding headers.
6. Enforce synthetic-only judging inputs at server boundary.
7. Before public release, clean source/revision provenance and verify budget alert, max two, IAM/access/rollback using read-only evidence. Deployment requires separate authorization.

### P1 — promised prototype

1. Resolve photo inventory; implement once-per-object classification and label comparison.
2. Implement TEST-only completed-lot insert with lineage/idempotency; prevent evaluation contamination.
3. Run bounded PKBX0041 and current model acceptance only in scheduled D10 window.
4. Bound/cache dashboard queries, remove HTML sinks, confirm anonymization; preserve held-out simulation/no annualization.
5. Exercise PO1–PO5 locally then live extraction separately under D10.
6. Rehearse D1 cap, IP, synthetic-only, disclaimer, max2, budget, provenance, rollback and logo blur.

### P2 — production-grade engineering

- Authenticated role workflow/actor audit; correlation IDs and metrics for Gemini, query bytes, storage and transitions without sensitive data.
- Provider deadlines/retry budgets/cancellation tests; prevent duplicate paid calls.
- Orphan/TEST reconciliation and retention; align cleanup to object names.
- Schema migrations/fingerprints, dependency/SBOM scans, pinned base, reproducible builds.
- Cross-instance/restart/failure tests, SLO and incident/rollback exercises.
- CSP, safe DOM, controlled external browser assets.
- No new service/distributed store without demonstrated requirement and authorization.

### P3 — real factory (outside D0)

- Genuine sensor provenance, calibration, plant/shift/time/unit/freshness; never fabricate readings.
- Representative real lots/outcomes and temporal/item/shift validation; version-linked evaluation. No retraining without approval.
- Validate cost/penalties/ranges against measured operations; prototype D2/D3 approval is not industrial suitability.
- Operator/supervisor pilot, override/fallback, safety/change control and shadow-mode monitoring.
- Customer-data governance, consent, retention and separation of feedback from evaluation truth.

## 10. D1–D11 reconciliation

| Decision | Audit status |
|---|---|
| D1 | Public deployment authorized only with safeguards; no deployment here. Numeric cap absent; client-IP topology, synthetic-only enforcement, deployed disclaimer, max2, budget, provenance and rollback not all verified. Not ready public. |
| D2 | SQL/adapter encode plan baseline, grids, penalties, <=3 changes, deterministic tie and rounded predicted savings. Source/local tests support contract; PKBX0041 not live-verified. |
| D3 | ₹53.30/kg and standards appear in approved source; plant row not freshly read. |
| D4 | Per-model thresholds correct; aggregate historical values meet them. Version-linked evaluation/sample/feature artifact absent; direct route bypass. Not accepted model set. |
| D5 | Simulated label/manual entry/stale note/confirmation in source. Boolean is not identity; no cloud sensor read. |
| D6 | BigQuery job_sheets plus local idempotency/trace/limiter and TEST guards. Firestore not constructed by current source, but historical manifest conflicts. Cross-instance guarantee absent as approved prototype limit. |
| D7 | Consent/folder map documented; count mismatch; classifier and learning-lot path absent; video not inspected for logos. |
| D8 | English UI, display-only approximate dated FX and INR storage contract; live workflow not tested. |
| D9 | Same-origin page/four queries and simulated/no preview/no annualization. Cost/cache and data anonymization unverified; old annual comment conflicts. |
| D10 | Valid through Oct 18, but this audit forbids cloud operations. Future acceptance scoped to prepagent/TEST; no retraining, Dataflow, new resources or IAM expansion. |
| D11 | PDF source/test uses approved order; old Blueprint superseded. No live card generated/read back. |

## 11. Inputs required before the final remediation prompt

1. **Om/project owners — D1:** numeric daily Gemini cap, timezone/reset, whether attempts or successful calls count, and whether process-local best effort across two instances is acceptable.
2. **Om — D7:** exact two missing approved photo names/labels, or explicit approval that 10 is canonical.
3. **Project/platform owner — supervisor identity:** available authentication provider and supervisor role claim; if unavailable for judging, confirm persisted approval will be disabled and demo described accordingly.
4. **Om — D7 learning lot:** required outcome fields for a completed TEST lot; behavior when feedback is partial or photo-only.
5. **Release owner:** fresh service/traffic/max-instance/budget/runtime identity state, known-good revision/digest, rollback operator/command and private-vs-delete choice by Nov 7. Must come from later read-only cloud evidence.

No decision is needed to keep dashboard unannualized: D9 and SID notes support one held-out month only.

## 12. Next ten concrete actions

1. Disable legacy mock routes in live-service mode and test Cloud Run state.
2. Gate direct predictions and consuming routes on D4 acceptance.
3. Resolve supervisor auth or remove real approval from public judging.
4. Obtain numeric Gemini cap and semantics; implement tests within D6.
5. Verify visitor IP behavior behind Cloud Run; keep max two.
6. Enforce synthetic-only PO ingestion for judging.
7. Resolve photo count and wire once-per-photo classification.
8. Add TEST-only completed-lot write and lineage/idempotency tests.
9. Bound/sanitize dashboard and confirm item anonymization; keep no annualization.
10. Schedule D10 bounded acceptance, then create pinned clean build provenance and separately seek deployment authorization.

## 13. Evidence needed to declare readiness

- **Local development:** identified clean source state; full/acceptance tests and syntax/config/diff checks; deterministic workflow/error branches. Two suites pass, but tree is dirty and syntax/config checks were not run in this audit.
- **Private cloud acceptance:** fresh revision/config/IAM evidence; version-linked five-model acceptance; exact PKBX0041 result/bytes; sensor provenance/manual confirmation; approved synthetic PO extraction; TEST persisted job/approval/readback/card; dashboard schema/cost/anonymization; independent reads.
- **Public judging:** relevant private checks plus numeric cap, real visitor-IP throttling, synthetic-only server gate, deployed disclaimer, max2, budget alert, clean source/image/revision, no mock routes, supervisor-safe approval or disabled writes, blurred logos, verified rollback/private-by-Nov-7 procedure.
- **General software production:** auth/audit, cross-instance idempotency or explicitly accepted risk, SLO/metrics, retry/reconciliation/retention, schema compatibility, signed reproducible build/SBOM/scan, failure/load/incident tests and security review.
- **Real factory:** production checks plus calibrated real sensors, representative outcomes, accepted/versioned models and optimizer, measured results, operator/safety acceptance and fallback.

## 14. Limitations

Cloud state was intentionally not refreshed; repo config may be stale. Previous photo listing is historical. No gcloud, bq, Gemini, Vertex, Storage, Pub/Sub, Dataflow or IAM command; no build, benchmark, dry run, browser automation, SAST or dependency scan was run. Local tests use isolated adapters. Synthetic performance is not measured factory performance.

