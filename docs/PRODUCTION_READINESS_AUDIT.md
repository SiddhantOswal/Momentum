
## Superseding live GCP checkpoint —16October2026

Private candidate `prepagent-v1f-9edd78db` is now deployed at https://v1f-9edd78db---prepagent-26mwt2n7ba-el.a.run.app; image `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent@sha256:13aea5e51ab935273925111e1cbfc5d996bbc2dbc71c90cf5796883ebe4d6f59`, Cloud Build `7b5a323f-73a0-4be0-9bd4-ab47a23f784d`. Default100%prepagent-00005-s5x and private IAM unchanged; max2. Actual remote browser verified extraction/catalog/conditions/history/photo/Impact and bounded security checks. Two Gemini attempts; counter2/100. D4 remains blocked; no model-enabled draft/approval/PDF flow or public release is claimed. No local suites, commit or push in this assignment. See GCP_END_TO_END_ACCEPTANCE_REPORT.md and docs/evidence/live-gcp-20261016/ for exact scope, retained failed assertions/follow-up results, cost and submission dependencies. Historical statements below saying no build/deploy are superseded only for this new candidate.

> **Final V1 freeze update —16October2026:** [V1_CODE_FREEZE.md](V1_CODE_FREEZE.md), [DEMO_READINESS.md](DEMO_READINESS.md) and `docs/evidence/v1-code-freeze-20261016/` supersede prior source/test/local-backup status. Source manifest `9edd78db…`, archive `dd0ac91d…`;104focused/310acceptance/521full/25browser pass. Actual local synthetic backend journey now works through approval/PDF/feedback/refresh/Impact; local responses say process-memory and durable=false. Stored canonical INR amount display and startup-ready reporting repaired. D4 remains blocked; no new cloud call/write/build/deploy/IAM/traffic change. No post-freeze feature cycle planned.

> **Superseding final consolidation —16 October2026 IST:** [FINAL_CONSOLIDATION_REPORT.md](FINAL_CONSOLIDATION_REPORT.md) and `docs/evidence/final-consolidation-20261015/` are the current status. Approach B retained; Firebase separate. Current tests99 focused/305 acceptance/516 full/24 browser, all pass. One isolated real TEST row now proves draft/approval-audit/PDF adapter transport, not model-enabled application acceptance. D4 stays BLOCKED. Ten photos already classified once7/10; no repeat. Current source reproducible but not newly built/deployed. Default/private traffic and max2 unchanged. Release approval and optional completed-lot outcome rules are separate from D4. Historical statements below (including zero rows, max12 or12-photo requirements) are superseded where contradictory.

> **Latest status, 15 October 2026:** [Final Stage B private cloud report](STAGE_B_FINAL_CLOUD_ACCEPTANCE_REPORT.md). Private V4candidate deployed and independent services verified; full PO-to-approved-card acceptance remains model-evidence blocked. Historical statuses below are superseded by the final update.

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

## 15. Evidence-backed remediation update — 15 Oct 2026 (Asia/Kolkata)

This update supersedes conflicting statements in the earlier audit snapshot.
The requested source documents were absent from HEAD `274a941` because that
commit removed `docs/`. Their prior committed copies were inspected at
`8c7e9a4`; only this audit and the dependency register were restored to meet
the explicit request to update those reports. The remaining source documents
were not reintroduced. Existing worktree edits were preserved.

### Fixes implemented

- `index.mjs`: every legacy mock-agent route now checks explicit local demo
  mode before reading or validating caller input. `K_SERVICE` continues to
  force live-service mode even if the demo flag is set. Direct live-service
  prediction, optimization, explanation, JobSheet, card and feedback routes
  remain unavailable without authenticated supervisor identity. PO extraction
  and job submission apply exact approved synthetic-file hashes whenever a
  cloud extraction adapter is configured; in Cloud Run the explicit
  `USTAAD_SYNTHETIC_ONLY=true` flag is also required. Client-supplied
  provenance headers are ignored.
- `src/google-cloud/risk-prediction-service.js` and `src/job-coordinator.js`:
  confirmation must be true at the service boundary as well as the API and
  coordinator. The optimization service enforces the same condition.
- `src/model-acceptance.js` and `config/model-acceptance.json`: accepted model
  evidence now requires each exact `prepagent.m_*` resource, a nonempty
  version, explicit link status, and a matching five-model current-version
  map. The config records observed current Vertex model version `1` for each
  model and keeps `status: blocked` with sample counts null.
- `config/model-feature-importance-observation.json`: records read-only top
  five feature-importance results for all five version-1 models and explicitly
  states that this observation does not complete acceptance.
- `src/purchase-order-file.js`, `index.mjs`, and
  `src/google-cloud/order-extraction-service.js`: retain the 10 MiB ceiling;
  JPEG structure and decoded dimensions are checked, with a 40-megapixel
  decoded-pixel ceiling. PDF page/object counts are not parsed: the external
  Cloud Run route is restricted to exact approved fixture bytes, avoiding an
  unreliable token-count scan without a PDF parser.
- `sql/dash_top_items.sql`, `src/google-cloud/impact-summary-service.js`,
  `src/impact-ui.js`, `src/operator-ui.js`, and `public/impact.html`: public
  item labels are generic (`Item N`); item codes and descriptions are omitted
  from the returned payload; extra identifying fields are rejected. Dashboard
  DOM updates use safe text/element creation. Existing successful responses
  are cached for one hour; after expiry a failed refresh returns unavailable
  instead of stale data. Held-out estimates and no-annualization wording are
  preserved.

### Focused tests

Focused command `node --test test/app.test.js
test/google-cloud-order-extraction.test.js test/impact-summary-service.test.js
test/impact-ui.test.js test/model-acceptance.test.js
test/purchase-order-file.test.js test/risk-prediction-service.test.js
test/risk-optimization-service.test.js test/job-coordinator.test.js` completed
with **148 passed, 0 failed, 0 skipped**. It covers hostile/extra dashboard
fields, unapproved PO bytes despite spoofed provenance headers, live-service
demo attempts, supervisor identity header spoofing, missing condition
confirmation, model acceptance before prediction/optimization query, JPEG
pixel limits, malformed image inputs, demo workflow and fail-closed branches.

Verification completed for this remediation pass:

- `npm run test:acceptance`: **246 passed, 0 failed, 0 skipped**.
- `npm test`: **416 passed, 0 failed, 0 skipped** (399 suites; 8.48 s).
- Focused command above: **148 passed, 0 failed, 0 skipped**.
- `node --check` on each changed runtime module and relevant changed test
  modules: passed.
- JSON parsing of `config/model-acceptance.json` and
  `config/model-feature-importance-observation.json`: passed.
- `git diff --check`: passed.

These are local tests and static checks; they do not establish connectivity,
cloud persistence, deployed behavior, or production readiness.

### Current read-only cloud evidence

Evidence collection was performed on 14 Oct 2026 UTC, approximately
19:37–19:42 UTC, in `prepagent-hack` / `asia-south1`:

- `bq query --dry_run ... < sql/model_evaluation.sql` and the corresponding
  `model_feature_importance.sql` dry run each reported **0 bytes estimated**.
- Executing those two existing read-only SQL files returned saved metrics and
  feature-importance output. Current metrics: WARP R² `0.6051768596`, DELAM
  `0.6664103997`, STRENGTH `0.4672612714`, PRINT `0.7511528616`, CRACK
  `0.3010715690`; all meet the approved prototype thresholds. This is not a
  new model evaluation run or prediction.
- Read-only `bq show --model` metadata for query resources
  `prepagent.m_warp`, `m_delam`, `m_strength`, `m_print`, and `m_crack` reports
  Vertex model version `1`, saved training-run metrics matching the evaluation
  query, random 20% split, and anonymous evaluation split-table references.
  The bounded count-only dry run against those five tables returned Access
  Denied. Sample counts, source data range and an immutable evaluation run ID
  remain unavailable. No model is accepted; the model config stays blocked.
- The feature query returned 29 importance rows per model. Top five by gain
  are recorded with values in `config/model-feature-importance-observation.json`.
  This is evidence data, not a new owner approval or a complete acceptance
  record.
- Read-only Cloud Run inspection found `prepagent-00005-s5x` receives 100%
  default traffic. Latest ready `prepagent-00011-yew` is tagged and receives
  0% default traffic. The service template and active revision show
  `autoscaling.knative.dev/maxScale=12`; D1 requires at most 2. The active
  revision image digest is
  `sha256:25395f6c46ff43833b8ecd077bc8950173299cc743425d46baae3c03adaaa9f2`.
  No `allUsers` Cloud Run Invoker binding was returned at service or project
  scope. The service-level policy was empty. Budget-alert state was not
  checked. Source SHA for the active digest is not established here.

No deployment, traffic change, IAM change, paid Gemini/Vertex call, model
inference, upload, business-data write, Pub/Sub publication, Dataflow
operation, resource creation, or retraining occurred. Read-only BigQuery
evaluation/feature queries and read-only Cloud Run/IAM inspection were
performed as listed above.

### Remaining blockers and owner inputs

- **D1 / project owner:** numeric daily Gemini cap, timezone/reset and whether
  attempts or successful calls count; current budget-alert configuration;
  deployment source/revision pairing and selected rollback target. The
  Playbook specifies a ₹5,000/month alert at 50%, 90%, and 100%, and provides
  the rollback command pattern. Current Cloud Run maxScale 12 exceeds D1's
  maximum 2, and public release remains blocked.
- **Supervisor authorization / project-platform owner:** approved identity
  provider and trusted role claim. No request header or UI checkbox is accepted
  as identity. Live predictions, optimization, explanations and lifecycle
  actions remain disabled.
- **D4 / model owner:** accessible evaluation sample counts, exact sampled-row
  provenance/min-max dates, and an immutable evaluation run identifier.
  Playbook supplies the declared modeling window and Om's D4 records the
  feature-importance review. Active model versions and saved metrics were
  inspected, but sample counts remain inaccessible, so acceptance remains
  blocked.
- **D7 / Om:** locate the two missing photo filenames and folder labels or
  confirm that the approved set contains 10. No photo classification was
  repeated. `sid_pack/SID_NOTES.md` defines the completed TEST-lot write
  contract; implementation still needs actual-used lever capture and a
  TEST-only `lots` writer with local contract tests. No write path is enabled.
- **PDF complexity:** no general PDF page/object parser exists in the current
  dependency set. The Cloud Run external-processing route is constrained to
  exact approved fixtures and request byte limits. Broader arbitrary-PDF
  acceptance requires a selected parser and its supported limits.
- **Release state:** no deployment or policy change was performed. Current
  service remains private by observed IAM evidence and is still running its
  prior revision/configuration; local source changes have not been deployed.

### Source-document reconciliation — 15 Oct 2026

The authoritative source bundle is located at the sibling path
`/Users/siddhant/prepagent-work/docs/`, not in this repository's `docs/`
directory. I read `OM_DECISIONS.md`, the 22-page Build Blueprint, the 16-page
Sprint Playbook (DOCX/PDF), and `sid_pack/SID_NOTES.md`. Where the older
Blueprint conflicts with the later explicit Om decisions, the latter still
controls (notably optimizer, stage order, currency, sensor, and impact rules).

This review resolves some uncertainties in the previous blocker list:

- **Optimizer expected result and impact wording:** Om's D2 and `sid_pack/SID_NOTES.md`
  specify the canonical PKBX0041 result (baseline ₹5,351; best ₹4,426; predicted
  savings ₹925 / 17.4 kg) and explicitly reject the retired fixed-threshold
  contract. SID_NOTES also says to report the held-out September month without
  annualizing. These settle what local/live acceptance must compare against;
  this pass did not execute the optimizer query.
- **Model evidence scope:** the Playbook declares model rows from Oct 2024
  through Aug 2026 with Sep 2026 held out; the 20% evaluation split is random
  within the modeling rows. Om's D4 also records feature-importance review,
  including acceptance of the small `customer_id` contribution as synthetic
  noise. These decisions are now recorded in `config/model-acceptance.json`
  and the version-1 observation artifact. They do not supply exact evaluation
  sample counts or min/max dates for the sampled rows, so the model gate stays
  blocked.
- **Budget alert and rollback:** the Playbook specifies a ₹5,000 monthly
  project budget, alerts at 50%, 90%, and 100%, emailed to both owners. It
  provides a Cloud Run traffic rollback command targeting a known-good
  revision. Thus these are no longer missing policy decisions. Whether the
  alert is configured and which source-linked revision is the rollback target
  still require current release evidence. D1's numeric daily Gemini cap and
  counting/reset policy are not specified in either document.
- **Completed-lot contract:** `sid_pack/SID_NOTES.md` specifies inserting the
  completed lot into `prepagent.lots` using the item spec, conditions, levers
  actually used, and actual rates, with a `TEST-` order ID. The project
  `lots` schema is in the Blueprint. The current feedback request does not
  collect actual levers, and the write client does not permit `lots`; this is
  an implementation gap, not a missing schema decision. Keep the learning
  write disabled until the app can source actual used settings and a bounded
  local contract is tested.
- **Prototype state architecture:** D6 explicitly accepts process-local
  trace/idempotency/rate limiting for this prototype and requires BigQuery
  `job_sheets`; distributed state is future work. Cross-instance durability
  remains a production limitation, but it is not an unresolved prototype
  architecture choice. Live persistence/read-back still has not been tested.
- **Photos:** Om's D7 resolves consent and label mapping, but the documents do
  not name the two objects missing from the 12-photo expectation. The recorded
  inventory remains 10; no classification was repeated.

Therefore, **zero of the external acceptance gates are fully cleared by
documents alone**. Three owner-decision questions are settled (budget-alert
target, rollback method, and completed-lot contract); two evidence/acceptance
questions are narrowed (model window/review and optimizer expected result).
The remaining blockers concern missing evidence, missing implementation
inputs, or cloud verification; source documents cannot provide those by
themselves.

This pass does not establish production readiness. D0 remains the approved
synthetic-data hackathon prototype scope; real-factory readiness remains
outside that decision.

## Continuation update — read-only cloud checks and local cap work (15 Oct 2026)

This update supersedes contradictory earlier statements in this report. The
repository was rechecked at branch `main`, HEAD `274a941`; the pre-existing
modified and untracked paths remain unstaged and preserved. The authoritative
Om decisions, audit/register and synthetic fixtures are in the external source
bundle at `/Users/siddhant/prepagent-work/docs/` as recorded earlier; the
repository's current `docs/` contains the audit and dependency register.

### Owner-independent code change

Added `src/daily-gemini-call-cap.js` and integrated it in
`src/service-ports.js`. Runtime Gemini adapters are unavailable unless both
the existing model/runtime gates and all three explicit cap settings exist:
`USTAAD_GEMINI_DAILY_CALL_CAP`, `USTAAD_GEMINI_CAP_TIME_ZONE`, and
`USTAAD_GEMINI_CAP_COUNTING_POLICY` (`attempts` or `successful`). There is no
numeric default. Calls share an in-memory process-local counter across Gemini
methods, reserve concurrent calls, and roll over at midnight in the configured
timezone. `/api/status` reports whether this policy is configured/enforced and
its scope. Tests cover missing/invalid policy, call-limit boundaries, failed
calls, concurrency, and timezone rollover. The live policy remains disabled
until Om supplies the numeric cap and confirms count/reset rules. With up to
two instances, each instance has its own counter; this does not enforce a
global aggregate cap, and no new distributed limiter was introduced.

### Current Google Cloud evidence

Read-only checks were performed on 15 Oct 2026 in project `prepagent-hack`,
region `asia-south1`. No Cloud configuration was mutated.

- Cloud Run `prepagent`: default traffic is 100% to `prepagent-00005-s5x`;
  latest ready is `prepagent-00011-yew` with 0% default traffic. Active digest:
  `sha256:25395f6c46ff43833b8ecd077bc8950173299cc743425d46baae3c03adaaa9f2`.
  Active maxScale is 12 and concurrency 80, contrary to D1's maximum 2.
  Active revision configuration includes live model calls, BigQuery writes,
  job storage and Firestore idempotency flags; feedback writes are disabled.
  It predates this local source state. Service and project IAM reads returned
  no `allUsers` `roles/run.invoker` binding, consistent with private access.
- A filtered current budget listing returned one matching ₹5,000/month budget,
  with 50%, 90% and 100% thresholds and a notification-channel reference. The
  channel's recipients/delivery were not verified.
- The bounded PLANT-01 query returned `base_currency=INR`,
  `cost_per_kg=53.3`, `default_locale=mr`. The locale differs from Om's
  English-only UI decision; no row was changed. `INFORMATION_SCHEMA.COLUMNS`
  read confirmed the item/plant schemas used by the queries. There is no
  `plant_settings` table/lever schema; the approved lever defaults are supplied
  by the application contract.
- `bq show --model` rechecked all five current model resources in
  `prepagent`. Each points to Vertex model version `1`; saved R² are Warp
  0.6051768596, Delamination 0.6664103997, Strength 0.4672612714, Print
  0.7511528616, Crack 0.3010715690. They meet the approved *prototype*
  thresholds, but this does not clear the complete acceptance gate. Evaluation
  sample counts and full immutable run/data provenance remain missing; the
  previously attempted bounded count dry run was Access Denied and was not
  bypassed. No model prediction or explanation was run.
- The approved optimizer dry run validated with a lower-bound estimate of
  zero bytes; BigQuery's dry-run result does not represent the complete BQML
  cost estimate. Exactly one query was run with the PKBX0041 parameters and
  `maximumBytesBilled=83,886,080`, job ID
  `ustad_pkbx0041_acceptance_20261015a`. It failed before returning rows:
  `Query exceeded limit for bytes billed: 62914560. 73400320 or higher
  required. at [11:1]`. Job metadata reports 1,283 bytes processed,
  20,971,520 bytes billed, 216 slot-ms and 3 child jobs. A dollar cost was not
  available from job metadata. The expected 10.18%/100.4kg/₹5,351 baseline and
  8.42%/83.0kg/₹4,426 optimized result therefore remain unverified against
  BigQuery. No retry was attempted after this cost/byte boundary.

Representative read-only command forms used:

```text
gcloud run services describe prepagent --project=prepagent-hack --region=asia-south1 --format=json
gcloud run revisions describe prepagent-00005-s5x --project=prepagent-hack --region=asia-south1 --format=json
gcloud run services get-iam-policy prepagent --project=prepagent-hack --region=asia-south1 --format=json
gcloud projects get-iam-policy prepagent-hack --flatten=bindings[].members --filter=bindings.role:roles/run.invoker AND bindings.members:allUsers --format=json
gcloud billing budgets list --billing-account=<configured-account> --filter=budgetFilter.projects:projects/514663464609 --format=json
bq show --model --format=prettyjson prepagent-hack:prepagent.m_warp
bq show --model --format=prettyjson prepagent-hack:prepagent.m_delam
bq show --model --format=prettyjson prepagent-hack:prepagent.m_strength
bq show --model --format=prettyjson prepagent-hack:prepagent.m_print
bq show --model --format=prettyjson prepagent-hack:prepagent.m_crack
bq query --dry_run --project_id=prepagent-hack --location=asia-south1 --use_legacy_sql=false --maximum_bytes_billed=83886080 < sql/optimize.sql
bq query --format=prettyjson --job_id=ustad_pkbx0041_acceptance_20261015a --project_id=prepagent-hack --location=asia-south1 --use_legacy_sql=false --maximum_bytes_billed=83886080 < sql/optimize.sql
```

The optimizer query used these named values (also supplied to the dry run):

```text
item_code=PKBX0041, quantity=1300, paper_type=RECYCLED, paper_supplier=SUP-D,
shift=DAY, ambient_rh_pct=86, ambient_temp_c=26, paper_moisture_pct=10.8,
sf_speed_mpm=48, roll_temp_c=162, gum_application=HIGH,
gum_viscosity_sec=32, pasting_pressure=MED, drying_hours=5,
print_speed_spm=60
```

The actual invocations also included `--parameter=<name>:<type>:<value>` for
each of these 15 fields and `--maximum_bytes_billed=83886080`; the failed
execution used the fixed job ID above. The Cloud Run and budget observations
are read-only metadata, not proof of application connectivity or notification
delivery.

### Verification from this continuation

- `node --test test/daily-gemini-call-cap.test.js test/google-cloud-order-extraction.test.js test/risk-prediction-service.test.js`: **53 passed, 0 failed, 0 skipped**.
- `node --test test/app.test.js`: **33 passed, 0 failed, 0 skipped** with local server access. A preceding sandboxed attempt failed because the test runner could not connect to ephemeral localhost; no application assertion was implicated in that run.
- `npm run test:acceptance`: **246 passed, 0 failed, 0 skipped**.
- `npm test`: **423 passed, 0 failed, 0 skipped**.
- `node --check` for each changed runtime/test JavaScript file: passed.
- Parsing all `config/*.json`: passed.
- `git diff --check`: passed.

### Updated readiness

**Private cloud acceptance: Not Ready.** The current deployment uses an older
revision with maxScale 12, D4 complete evidence is unavailable, trusted
supervisor identity is absent, Gemini cap values are unspecified, and the
single authorized optimizer attempt failed its billed-byte limit. A limited
read-only cloud inspection was possible; the private PO-to-card acceptance
workflow is not.

**Public judging: Not Ready.** D1 maxScale is unmet; cap and supervisor
identity prerequisites are absent; source/revision provenance is not pinned to
this dirty worktree. Current service access remains private by read-only IAM
evidence. No traffic, IAM or service configuration was changed.

**No live-service calls or writes:** no Gemini call, model prediction,
explanation, upload, job/feedback/lot write, Pub/Sub publish, Dataflow job,
deployment, traffic/IAM/config change, resource creation or model retraining
occurred. The one optimizer query is the sole BigQuery data operation; it
failed and produced no optimizer rows.

### Remaining exact blockers and next action

1. Om/project owner: provide numeric daily Gemini cap, IANA timezone and
   attempts-versus-successful counting policy. The current implementation is
   ready to accept these explicit values but remains disabled without them.
2. Platform/security owner: select the authentication provider and trusted
   supervisor role claim. Without it, live predictions, optimization,
   explanations and all job lifecycle decisions remain disabled.
3. Model owner/data platform: grant the intended bounded read access or supply
   version-linked evaluation sample counts, sampled-row date range/run ID and
   evaluation provenance. No Access Denied boundary was bypassed.
4. Project/BigQuery owner: review job
   `ustad_pkbx0041_acceptance_20261015a` and authorize a specific higher
   per-child/query byte ceiling or a revised bounded validation method before
   another optimizer execution. The expected result remains the approved
   acceptance target; SQL was not edited to force it.
5. Release owner: resolve deployed maxScale 12 versus D1's maximum 2, select a
   source-linked known-good rollback revision and reconcile old active runtime
   flags before any separately authorized deployment.

Next smallest executable local task after those inputs: set the cap policy in
test-only configuration and add boundary tests for the owner-selected policy;
then, after a distinct release authorization, validate the intended Cloud Run
revision/configuration before any workflow writes. Current dirty source is not
the deployed image, and passing local tests are not cloud acceptance.

## Continuation: supervisor authentication and spend gate (15 Oct 2026)

This section supersedes earlier statements above that the supervisor provider
and daily call-cap value/counting policy were undecided. The current owner
prompt selects Firebase Authentication with Google sign-in, Firebase Admin
ID-token verification, trusted `role: supervisor`, and a default 100 attempted
Gemini requests per Asia/Kolkata calendar day. It does not authorize enabling
new cloud services, changing IAM, or making the counter global without an
approved shared-counter implementation. Existing local modifications remain
unstaged and were preserved.

### Local changes in this continuation

- Added `src/firebase-supervisor-auth.js`: verifies Firebase ID tokens with
  revocation checking; enforces project audience/issuer, expiry, Google sign-in
  provider, UID binding, supervisor claim, and optional approved-UID allowlist.
  Missing Firebase configuration returns a safe unavailable response. No
  caller-supplied identity header is trusted.
- Added `src/supervisor-auth-client.js` and UI sign-in/sign-out controls using
  the pinned Firebase Web SDK module version. Server-side checks remain
  authoritative. The feature is disabled unless reviewed public Firebase
  client configuration and backend verification are enabled.
- Added Firebase Admin SDK 14.5.0 (exact package version) for token validation.
  Local `npm install --save-exact` reported 0 vulnerabilities. This does not
  prove the dependency is appropriate for a deployed build or that a provider
  is configured.
- Set the cap default to 100 attempted requests, reset by Asia/Kolkata date,
  and charge failed/ambiguous outbound attempts before provider invocation.
  Tests verify concurrency within one process and timezone rollover. This is
  explicitly **not a shared counter**. Cloud Run Gemini adapters remain
  disabled; no Firestore counter or cloud writes were created/performed.
- Added negative HTTP regression tests for live decision routes and forged
  supervisor identity headers. With Firebase disabled, Cloud Run-style routes
  fail closed before validation or service invocation.
- Added `docs/FIREBASE_AUTH_SETUP.md` with bounded owner setup steps.

### Fresh cloud observations

Read-only command on 15 October 2026:

```text
gcloud run revisions describe prepagent-00005-s5x --project=prepagent-hack --region=asia-south1 --format='json(spec.containers[0].env)'
```

The active revision reports `GEMINI_MODEL=gemini-3.5-flash`,
`VERTEX_LOCATION=asia-south1`, live model calls enabled, BigQuery writes and
job storage enabled, feedback writes disabled, and Firestore idempotency
enabled. This is deployed configuration evidence only; it does not establish
that current code is deployed, a human supervisor can authenticate, model
acceptance passes, or any adapter has successful connectivity. The service
continues to run old revision `prepagent-00005-s5x` at 100% default traffic;
maxScale 12 and concurrency 80 remain unchanged. No deployment or traffic
change occurred.

The Google Cloud project checks found an existing Firestore database, but did
not observe the Firebase Auth / Identity Toolkit APIs enabled. The runtime IAM
inspection did not establish the required Firebase Auth token-verification
permission. A local `gcloud identity-platform` command group was unavailable.
No Firebase setup or IAM change occurred. See `docs/FIREBASE_AUTH_SETUP.md`.

The authorized photo-prefix inventory is the newly approved canonical set of
exactly 10 objects (crack 2, crushed 1, delam 3, good 1, print 2, warp 1).
The two `photos/video/` objects are outside the classification set. No images
were downloaded or classified in this continuation.

The current billing budget is ₹5,000/month with 50/90/100% thresholds,
`INCLUDE_ALL_CREDITS`, and a configured notification channel reference. It
does not match the proposed ₹27,000 planning milestones. Neither alert
delivery nor whether credits reduce actual charges was verified. Billing was
not changed.

### Verification in this continuation

The new focused Firebase-auth suite covers absent/malformed/oversized tokens,
wrong project issuer/audience, expiry, future auth time, provider mismatch,
revocation, missing supervisor claim, UID allowlist, and valid supervisor
tokens. The cap suite checks default, invalid configuration, attempted-call
reservation including provider failures, concurrent calls, and IST midnight.
The app suite checks live API action refusal with absent Firebase setup and
forged identity headers.

Exact results will be recorded after the final test commands for this
continuation. Local test doubles establish code behavior only. No live
Firebase, Gemini, prediction, optimizer retry, dashboard query, storage write,
JobSheet write/read-back, approval, photo classification or feedback/lot write
was performed. The earlier optimizer job and byte-limit failure documented
above remain the only optimizer execution evidence; no retry was made.

### Remaining blockers

1. Project owner: confirm/register Firebase for this project, enable the
   Google provider, provide client configuration, approve cost/quota, and
   arrange trusted supervisor custom claims. Platform owner: review the
   minimal runtime IAM permission required for revocation checks. Until then,
   private authenticated acceptance is blocked.
2. Project owner: explicitly approve use of the existing Firestore database
   for shared, transactional Gemini reservations (and confirm security/cost
   scope), or select another owner-approved shared counter. Until then,
   Cloud Run Gemini calls and paid photo classification remain disabled.
3. Model owner: supply version-linked evaluation sample counts, exact dataset
   / time window and reproducible run/query provenance, plus reviewed feature
   importance. The observed metrics alone do not clear acceptance.
4. BigQuery owner: review optimizer job
   `ustad_pkbx0041_acceptance_20261015a` and approve a bounded ceiling/method
   before another execution; current expected output remains unverified.
5. Release owner: current Cloud Run maxScale 12 exceeds D1's max 2; decide
   budget milestones against the existing ₹5,000 budget and provide a known
   good rollback/revision-source pairing before any release change.

**Readiness:** local synthetic demo remains locally testable. Private live
acceptance is **Not Ready** because Firebase authentication, complete model
acceptance evidence, shared Gemini call accounting, and optimizer result
verification remain unavailable. Public judging is **Not Ready** because the
service remains on stale source, maxScale is 12, no live supervisor flow is
configured, and release safeguards/provenance are incomplete. General
production and real-factory use remain out of scope and unverified.

### Final verification for this continuation

- Focused: `node --test test/firebase-supervisor-auth.test.js test/daily-gemini-call-cap.test.js test/app.test.js test/google-cloud-order-extraction.test.js test/risk-prediction-service.test.js` — **99 passed, 0 failed, 0 skipped**.
- Acceptance: `npm run test:acceptance` — **247 passed, 0 failed, 0 skipped**.
- Full suite: `npm test` — **436 passed, 0 failed, 0 skipped**.
- Syntax: `for file in index.mjs $(rg --files src | rg '\\.m?js$'); do node --check "$file" || exit 1; done` — passed for `index.mjs` and all JavaScript modules under `src/`.
- Configuration parse: Node parsed every `config/*.json`, `package.json`, and `package-lock.json` — passed.
- `git diff --check` — passed.
- `npm audit --omit=dev` — **found 0 vulnerabilities** (completed with network access after sandbox DNS failed).

These are local results, not live service acceptance. The only cloud command in
this continuation was the read-only `gcloud run revisions describe` command
recorded above. Previously collected Oct 15 read-only project observations
are identified separately. No Gemini call, BQ query, model prediction,
explanation, cloud upload/write, Firebase setup, IAM/billing/configuration
change, deployment, traffic change, or resource creation occurred.



## Stage A closure and explicit cloud approval checkpoint — 15 Oct 2026

This update supersedes earlier status statements about service maximum scale,
Gemini policy, photo count, missing training jobs and budget alert percentages.
Source decisions remain Om D1–D11 plus the owner's final P0/P1 prompt. The exact
approval plan is [STAGE_A_APPROVAL_PLAN.md](STAGE_A_APPROVAL_PLAN.md); its scope
is not approved by the fact that it has been prepared.

| Dependency | Current evidence and implementation | Remaining action / owner |
|---|---|---|
| D1 release | Fresh GET shows service max2, revision max12, private IAM evidence. Latest local code is not deployed. | Release owner: freeze UI/backend source, establish digest/build mapping, reconcile revision settings, separately approve private candidate then public release. |
| D2–D3 | Canonical optimizer unchanged. Read-client bug rejecting the canonical ASSERT prefix fixed and locally tested. Failed80MiB job traced: two10MiB guards leave60MiB but SELECT needs70MiB. | Owner approves exactly one100MiB retry (~$0.00060 reference on-demand); compare complete result. Config support prepared, default remains80MiB. |
| D4 | All five version1 R² thresholds met. Actual training parent/children, saved SQL and global explanations recovered in version manifest. | Om: exact evaluation membership/count, source snapshot/window, exact version-linked feature review; alternatively approve a clearly new evaluation contract. Anonymous split metadata denied; no bypass. Models remain blocked. |
| D5 | Simulated/manual conditions and server confirmation remain; absence of physical sensors is not a V1 blocker. | Live authenticated confirmation acceptance after auth setup; no readings fabricated. |
| D6 | Local approval audit now carries branded verified UID, state/time/correlation/decision/card, conditional TEST-only update and independent read-back. | Approve additive nullable JSON column; then TEST lifecycle acceptance. No DDL/write applied. No distributed exactly-once claim. |
| D7 | Exactly10 canonical photos freshly listed: crack2/crushed1/delam3/good1/print2/warp1. No missing-photo owner question remains. | Classify once each after auth/counter gates. Actual completed-lot outcome capture/partial feedback and idempotency remain unresolved; no lots write enabled. |
| D8 | English/INR/display-only conversion contracts preserved. | UI owner owns current UI changes; reconcile auth presentation after handoff. No plant locale write. |
| D9 | Four real bounded SELECTs pass through actual impact adapter, generic labels and second-call cache verified. 810,906 bytes processed,40MiB billed. | Deployed same-origin endpoint/browser acceptance remains; estimates are held-out/simulated, never annualized or measured factory outcomes. |
| D10 | Only metadata/list/GET, dashboard SELECTs and bounded plant SELECT; exact commands/timestamps/jobs in evidence. | No infrastructure mutation, Gemini call, business write, upload, deployment, traffic or IAM change. Stage B requires explicit approval. |
| D11 | Printing-first process order unchanged; PDF stage-order regression included in acceptance. | Real stored PDF content/retrieval still awaits private cloud workflow. |
| Firebase | Mandatory exact UID allowlist and branded principals implemented; admin-only claim tool preserves unrelated claims and private backup. APIs are disabled; registration/provider/app existence not assessable yet. | Owner approves existing-project Firebase setup/automatic side effects and minimal runtime firebaseauth.users.get role; selects Google account, real sign-in yields UID. |
| Shared Gemini accounting | ExistingdefaultDB confirmed Native/Mumbai. Runtime already has roles/datastore.user; no additional Firestore grant proposed. Transaction store+central wrapper locally tested, opt-in off. | Approve dedicated counter usage, client deny rules review and three real no-Gemini reservations/read-back. No DB creation. |
| Budget | **New defect:** raw REST fractions50/90/100 mean5000%/9000%/10000%, not intended percentages. Monthly amount₹5,000 unchanged. Delivery/spend/credits not proved. | Billing owner approves correcting fractions only to.5/.9/1; verifies recipient delivery and actual spend. ₹27,000 remains total planning ceiling, not monthly replacement. |
| Source integrity | Approved docs/fixtures available; all five public samples match source hashes. HEAD remains274a941. No clean release source/digest mapping. | Preserve untracked restored docs; UI editor handoff, controlled source freeze/build later. |

Local verification: focused backend105/105 plus bootstrap HTTP1/1, final acceptance247/247, full467/467;
zero failures, skips or cancellations in those final runs. An earlier acceptance
run was245pass/2fail during the UI editor's module migration; the editor updated
the UI assertions, then the complete acceptance rerun passed. No assertions were
weakened here to hide those failures. No cloud evidence is inferred from mocks.
See the Stage A report for exact commands, syntax/config/diff/audit results and
all remaining gates. Private PO-to-approved-card cloud acceptance is **blocked**;
public judging is **blocked**. No Stage B cloud mutation is authorized yet.

Stage A completion report: [STAGE_A_COMPLETION_REPORT.md](STAGE_A_COMPLETION_REPORT.md). Final checks:59runtime modules passed node --check;19JSON and2IAM YAML files parsed; git diff --check exit0; npm audit --omit=dev reported0production vulnerabilities. Prototype stored reads now exclude non-TEST orders; lifecycle status separates configured live authorization from actual verification; first Firebase sign-in can bootstrap a real UID without enabling supervisor actions. UI auth integration awaits the separate editor handoff. No cloud mutations occurred.

## 15 October 2026 — Stage B / owner Approach B reconciliation

[Stage B completion report](STAGE_B_COMPLETION_REPORT.md) records actual A–E execution and the subsequent no-login hackathon decision. [Authorization contract](HACKATHON_DEMO_AUTHORIZATION.md) defines signed temporary demo capabilities, session record isolation, honest non-authenticated actor audit and unchanged production Firebase policy. Model/confirmation/optimizer gates remain. UI handoff was confirmed before integration. Local focused55, acceptance248, full485 and browser14 tests pass;67syntax/5JSON checks and production advisory/diff checks pass. Local doubles do not establish live cloud approval.

Earlier Firebase-only mandatory hackathon conclusions are superseded. Scope A registration403 is optional future production setup; missing complete model evidence and runtime/release acceptance remain live blockers. Previously approved B/C/D/E operations passed their narrow boundaries: three admin counter reservations, budget threshold correction, additive audit schema and exactly one PKBX0041 optimizer query. No Approach B cloud activation/deployment/paid call occurred. Do not infer current deployment readiness or factory outcomes from these results. Private workflow/public judging/general production remain Not Ready under the explicit criteria in the completion report.


## Stage B final private-cloud acceptance — 15 October 2026

**Latest evidence:** [STAGE_B_FINAL_CLOUD_ACCEPTANCE_REPORT.md](STAGE_B_FINAL_CLOUD_ACCEPTANCE_REPORT.md), with machine-readable `docs/evidence/stage-b-final/FINAL_ACCEPTANCE_MATRIX.json` and `COST_AND_USAGE.json`. This update supersedes older “not deployed” and “runtime counter unverified” statuses; historical evidence is retained.

- **Verified live:** existing B–E resources reconciled without duplicating completed operations; Firestore runtime accounting3→18 (15new actual Gemini attempts); client read/write403; budget fractions0.5/0.9/1.0 and INR5000/month unchanged; nullable audit column present; original single100MiB optimizer retry accepted42comparisons/90MiB billed.
- **Private deployment verified:** final `prepagent-b-1015-43c1a259`, image `sha256:f9125d32da1233ff560241099af1e900788869212cfae6b7b011e80fce0f6fd2`, source manifest `43c1a2595ac4e68831475d5e133b4f2a94ec9f4e4f986ed1c0609a01f558ce29`. Shared Secret Manager signingversion1 with secret-only runtime accessor. Service max2/min0, candidate max2/concurrency1. Default100%00005unchanged; privateIAMunchanged.
- **Actual service outcomes:**5approved PO extractions/catalog/clarification results matched expected fixtures; all5source objects independently hash-verified. Ten canonical photos classified exactly once:7matched; photo02CRACK→NONE,03STRENGTH→NONE,08PRINT→DELAM. No relabeling/retry. Actual Impact/evidence/simulatedconditions and dated staticfallbackFX verified. Final21HTTP+12browser checks against real candidate passed.
- **Current local evidence:**111focused,249acceptance,495full,15browser tests passed;0failures/skips;69syntaxchecks,6configJSONparses, npmproductionaudit0advisories, diffcheck passed. Local fault tests use clearly identified doubles. Historical failedresponsive/origin checks retained and corrected.
- **Still BLOCKED:** exact modelversion1 evaluationmembership/counts/source snapshot or reproduciblewindow and Om's feature-review artifact. All5numerical R² thresholds are met but fullacceptance is not. No bypass/new evaluation/retraining. Operator confirmation remains an actual nextworkflowaction, not an inventedrecord. No valid liveDRAFT, approval/audit/PDF or feedbackwrite was created. Complete PO-to-card acceptance is NOT established.
- **Owner dependencies:** Om evidence; separate new bounded provider allowance after gate passes (this run used all15); budget notification receipt/currentspend visibility; completed-lot outcome/partialfeedback/idempotency contract before claiming learning. Firebase production setup is optional under current ApproachB, not a hackathonlogin blocker.
- **StageD:** publicrelease not authorized/performed. Before servicepublicIAM, remove obsolete diagnostic/legacy tags and promote only a fully acceptedrevision; service-wideIAM otherwise exposesoldtaggedcode/default00005. Fullprivateworkflow, recovery/security/usage checks, explicitpublicreleaseapproval and publicsmoke required. Returnprivate/delete byNov7underownerplan.

No staging,commit,push,reset,clean,publicIAM/defaulttrafficchange, productionbusinessdatawrite, serviceaccountkey, newevaluation orretraining occurred in this pass. Source remains intentionallydirty;116runtimeinputhashes match the immutable V4snapshot. See fullreport for exact commands, timestamps, costs, limits and remaining verification boundaries.


## Current P0 reconciliation after final UI handoff —15 October 2026

Owner reconfirmed **Approach B; Firebase remains separate**, then confirmed the UI editor finished. [P0_CLOSURE_RECONCILIATION.md](P0_CLOSURE_RECONCILIATION.md) and `docs/evidence/p0-reconciliation-20261015/` supersede earlier current-source/test/setup statements.

- Fixed model-status handling for malformed historical evidence and conflicting historical display metadata. The acceptance predicate and thresholds remain unchanged. Only `src/model-acceptance.js` and its regression file were edited as implementation work in this pass; the UI editor's changes were preserved.
- Current local results: **80 focused,251 acceptance,501 full-suite and24 browser tests passed**,0 failures/skips.70 syntax checks,6 JSON/3 YAML parses, npm production dependency audit0 advisories and diff check passed. An earlier browser run during overlapping edits had16 passes/8 failures; evidence is retained. The settled-source full rerun passed without weakening assertions.
- Read-only cloud refresh confirms private IAM/default100%00005 unchanged, service max2, Firestore18/100 with original deny rules, INR5,000 monthly alert with0.5/0.9/1.0 thresholds, audit JSON column with0 JobSheet rows, and the existing successful optimizer retry. No mutation, provider call, new query job, reservation, build or deployment occurred in this pass.
- Complete cloud workflow remains blocked on exact version-linked evaluation membership/counts/source identity and reviewed feature evidence. No fabricated DRAFT/approval/PDF or operator confirmation. Optional Firebase configuration remains absent but is not a hackathon prerequisite under Approach B.
- Current guided UI and backend differ from deployed V4. No new-deployment or clean-source claim. Optional [new evaluation proposal](MODEL_EVALUATION_APPROVAL_PROPOSAL.md) is prepared but not authorized/executed; it does not relabel new metrics as historical evidence. Existing fifteen-call allowance is exhausted; later live continuation needs a fresh bounded allowance after model acceptance.
- Next action: validate Om's real artifacts, or obtain approval for the narrow new evaluation population/queries if historical evidence cannot be recovered. Keep completed cloud scopes unchanged. No staging/commit/push/reset/clean/public release.
