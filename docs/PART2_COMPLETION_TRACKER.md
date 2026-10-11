# Ustaad AI — Part 2 Completion Tracker

> **This is the single authoritative Part 2 tracker.** Future sessions must
> update this file rather than create another checklist. End-to-end Part 2
> completion has **not** been verified.

## 1. Project header and current state

| Field | Current value |
|---|---|
| Project | Ustaad AI — Corrugated Production-Prep Agent |
| Hackathon | Google AI Builder Cup 2026 |
| Primary playbook | `../untracked_reference_docs/Prep_Agent_3-Day_Sprint_Playbook.pdf`; companion DOCX is the command reference |
| Blueprint | `../untracked_reference_docs/Corrugated Production-Prep Agent — Build Blueprint 3 (1).pdf` |
| GCP project ID | `prepagent-hack` |
| Primary region | `asia-south1` (Mumbai) |
| Translation glossary region | `us-central1` |
| BigQuery dataset | `prepagent` |
| Intended data bucket | `gs://prepagent-hack-data` |
| Intended Cloud Run service | `prepagent` |
| Runtime service account | `prepagent-run@prepagent-hack.iam.gserviceaccount.com` |
| Billing | **Disabled by explicit user decision. Do not change this without explicit approval.** |
| Implementation strategy | Connect directly to genuine cloud services. Do not build temporary cloud mocks or fabricate production results. |
| Last tracker update | 2026-10-11 |
| Latest audit evidence | Full source-driven completeness sweep on 2026-10-11 reconciled all 21 official requirements and 67 audit-derived subtasks against the playbook PDF/DOCX, Blueprint 3, current implementation and tests. The seven locale JSON files/routes, display-only conversion contracts, and bounded trace/SSE infrastructure are present; three missing request-field labels are now localized as ordinary static UI copy. No additional independent source-required work was found. The five target tasks remain blocked pending the listed Om inputs and genuine upstream services; no cloud operations were performed. |

**Warning:** A local health response, schema, route, manifest, or passing
offline test does not establish live service readiness. The purchase-order to
job-sheet workflow and judging acceptance remain unverified.

### Non-negotiable decisions

1. **No billing without explicit approval.** Never link a billing account,
   activate a trial, enable billing, launch Dataflow, deploy Cloud Run, run
   blocked DML, or make a live model/translation call without an explicitly
   authorized later task.
2. **Direct live integration strategy.** Do not create temporary substitutes
   for Gemini, Vertex AI, BigQuery, Cloud Storage, Pub/Sub, Dataflow,
   Translation, production risk, optimization, evidence, or classification.
3. **No fabricated production inputs or outputs.** Om-owned data, models,
   queries, glossary entries, and plant decisions remain blocked until actually
   supplied.
4. Local PDF rendering is genuine application functionality and is separate
   from Cloud Storage persistence.
5. The project remains JavaScript ES modules. Do not add `types.ts` solely to
   match a blueprint example; `src/schemas.js` is the runtime schema source
   and `src/types.js` is its JavaScript/JSDoc compatibility surface.

## 2. Status legend and rules

Use exactly these status labels:

| Status | Meaning |
|---|---|
| `[ ] NOT STARTED` | Applicable task has not begun. |
| `[~] IN PROGRESS` | Work is actively underway. |
| `[!] PARTIALLY COMPLETE` | Some acceptance criteria are met, but the task is not complete. |
| `[✓] VERIFIED COMPLETE` | Appropriate evidence exists; evidence and date/source are recorded. |
| `[B] BLOCKED BY EXTERNAL DEPENDENCY` | A required input from Om or another external party is missing. |
| `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Billing, credits, cloud access, permission, API, or cloud provisioning prevents progress. |
| `[D] DEFERRED BY EXPLICIT DECISION` | The user/playbook deliberately defers the task. |
| `[N/A] NOT APPLICABLE TO THIS PROJECT OR PLAYBOOK` | The task is not required for this project/playbook; explain why. |

- Blocked work is not complete. A task with multiple blockers records all of
  them in its notes.
- Source-code completion requires the relevant implementation plus successful
  task-appropriate test/syntax evidence. A test that was only written does not
  count as passing.
- Cloud completion requires a read-only resource inspection or real integration
  check appropriate to the resource. A manifest or successful API enablement
  alone is not service readiness.
- Evidence dated in an earlier audit is historical; do not describe it as
  freshly verified.
- Preserve stable task IDs when status changes. Add IDs rather than renumbering
  if scope changes.
- Do not repeat verified work unless new evidence indicates regression.

## 3. Executive progress dashboard

The inventory has **21 official playbook requirement tasks** and **67
audit-derived subtasks**, for **88 tracked tasks**. “Audit-derived subtask”
means it decomposes an official requirement or a concrete gap found in the
repository audit; it is not represented as a separately numbered playbook
requirement.

| Workstream | Total tracked | Verified complete | In progress | Partially complete | Blocked by external dependency | Blocked by billing/cloud access | Deferred | Not started | Not applicable | Completion |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Official Part 2 requirements | 21 | 5 | 0 | 0 | 2 | 12 | 2 | 0 | 0 | 5/21 = 23.8% |
| GCP audit-derived subtasks | 10 | 3 | 0 | 0 | 1 | 5 | 1 | 0 | 0 | 3/10 = 30.0% |
| Backend/application audit subtasks | 10 | 6 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 6/10 = 60.0% |
| AI/production-workflow audit subtasks | 17 | 1 | 0 | 0 | 9 | 7 | 0 | 0 | 0 | 1/17 = 5.9% |
| UI/localization audit subtasks | 8 | 2 | 0 | 0 | 4 | 1 | 1 | 0 | 0 | 2/8 = 25.0% |
| Om/external handoffs | 10 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 0 | 0/10 = 0% |
| Testing/build/deployment acceptance subtasks | 10 | 6 | 0 | 0 | 0 | 2 | 1 | 0 | 1 | 6/9 = 66.7% |
| API guardrail audit subtasks | 2 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1/2 = 50.0% |
| **Total** | **88** | **24** | **0** | **0** | **26** | **32** | **5** | **0** | **1** | **24/87 = 27.6%** |

**Formula:** verified complete ÷ applicable tracked tasks; the one `[N/A]`
task is excluded from the denominator. Blocked, deferred, partial, and
not-started tasks count as incomplete.

Status columns count each task once by its primary status. Secondary blockers
(for example, both Om input and cloud authorization) can overlap and are
recorded in the task notes; they are not additional primary-status counts.

**Separate live end-to-end measure:** **0/1 verified (0%)**. The local
purchase-order-to-job-sheet flow is not implemented end to end; offline tests
do not substitute for live integration acceptance.

## 4. Official Part 2 requirement traceability

The subsection numbering below follows Part 2 of the supplied playbook. In
particular, the plant seed belongs to subsection **2.9**; subsection **2.10**
is Pub/Sub, not a separately invented seed subsection.

| ID | Exact playbook source | Official requirement summary | Evidence / current status | Blocker | Next action | Dependencies | Verification criteria |
|---|---|---|---|---|---|---|---|
| P2-GCP-001 | 2.0 Before you start | Install/use Google Cloud CLI, Node 20+, Git; initialize and check versions. | `[✓] VERIFIED COMPLETE` — rechecked 2026-10-11: Node v22.17.1, Git 2.54.0, Google Cloud SDK 531.0.0, bq 2.1.20; active project is `prepagent-hack` and an account is active (identity withheld). | None known. | Recheck only if local environment changes. | Google account / local tools. | CLI version, Node >=20, Git and intended account available without exposing credentials. |
| P2-GCP-002 | 2.1 Save your variables | Keep project ID, Mumbai/translation regions, bucket, runtime SA and Om email in `env.sh`. | `[✓] VERIFIED COMPLETE` — rechecked non-secret settings: `prepagent-hack`, `asia-south1`, `us-central1`, `prepagent-hack-data`, and `prepagent-run@prepagent-hack.iam.gserviceaccount.com`; Om setting matches the tracker identity without echoing it. `env.sh` is Git-ignored. | None known. | Keep both copies aligned; never store secrets there. | None. | Safe variable inspection shows exact intended non-secret values; `git check-ignore env.sh`. |
| P2-GCP-003 | 2.2 Create project and link billing | Use one project and link billing as the playbook directs. | `[D] DEFERRED BY EXPLICIT DECISION` — project `prepagent-hack` exists; the latest recorded billing check reports `billingEnabled=False`. Linking billing is explicitly prohibited by the user's no-billing decision. | Explicit user decision to keep billing disabled. | Keep billing disabled; revisit only after explicit user authorization to change that decision. | User authorization and a billing account/credits if later approved. | Project ID/state and billing status independently verified after the user authorizes any change. |
| P2-GCP-004 | 2.3 Set a budget alert | Create project-only ₹5,000/month budget with 50%, 90%, 100% email alerts. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — not created. | Billing decision remains no-billing. | After approval, create in Console and verify in Budgets list. | Billing activation and team emails. | Budget appears for this project with specified amount and thresholds. |
| P2-GCP-005 | 2.4 Enable APIs | Enable the playbook’s Run, Build, Artifact Registry, Vertex, BigQuery, Storage, Pub/Sub, Dataflow, Translation, Compute and Logging APIs. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — historical Phase 2 snapshot recorded BigQuery, Storage and Logging enabled and the remaining listed APIs not enabled. This sprint did not refresh cloud state or activate APIs. | API activation is expressly prohibited for this sprint; service-specific billing/prerequisites and permission are not newly verified. | Do not enable APIs. After the user changes the authorization decision, verify each API's service-specific prerequisites and state before any activation. | User authorization and per-API cloud prerequisites. | Authorized read-only API state check and subsequent independent resource/service verification. |
| P2-GCP-006 | 2.5 Give Om access | Grant Om project Editor as specified in the playbook. | `[✓] VERIFIED COMPLETE` — fresh project IAM policy check confirms Om has project-level `roles/editor`. No direct dataset ACL was found; dataset uses project special groups. | None known. | No action unless IAM evidence changes. | Om identity. | Read-only project IAM policy shows expected principal and role. |
| P2-GCP-007 | 2.6 Create Cloud Run service account | Create `prepagent-run`; grant six documented runtime roles; no key files. | `[✓] VERIFIED COMPLETE` — account exists and is enabled; all six documented roles are bound. Read-only key listing found zero user-managed keys; no key material was printed. | Cloud workloads still unavailable. | Preserve keyless workload identity; do not change IAM speculatively. | Project access. | Account exists and all six role bindings are visible; no user-managed keys. |
| P2-GCP-008 | 2.7 Local credentials | Configure Application Default Credentials and quota project for local scripts. | `[✓] VERIFIED COMPLETE` — prior audit verified ADC without printing a token. Active gcloud account is present now; ADC/quota project was not freshly rechecked. The attempted `gcloud auth application-default get-quota-project` command is unsupported by this installed CLI. | Current ADC/quota state not freshly established. | If needed, verify later using a supported token-safe method; never print a token or inspect credential files. | User Google authentication. | ADC can be checked without outputting credentials; project quota config is correct. |
| P2-GCP-009 | 2.8 Cloud Storage bucket | Create Mumbai bucket with uniform bucket-level access; use documented prefixes. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — fresh `gcloud storage buckets describe` returned 404 for `gs://prepagent-hack-data`; Storage API is enabled. | Intended bucket is absent; prior creation was billing-blocked. | Do not retry/create until prerequisite and explicit authorization. | Billing/cloud provisioning; Storage API. | Real bucket inspection confirms name, `asia-south1`, uniform access. |
| P2-GCP-010 | 2.9 BigQuery dataset and tables, including plant seed | Create dataset/tables from playbook; seed `PLANT-01` once. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — historical read-only checks verified the dataset, five table schemas and partitioning. Plant seed SQL is prepared but unexecuted; prior DML dry-run was rejected because billing was disabled. This sprint did not retry a query or dry-run. | Remaining seed/DML cannot proceed under the no-billing decision and without explicit authorization. | Preserve the verified tables and seed SQL; do not execute or dry-run. Revisit only after query eligibility and explicit authorization are established. | Billing/query eligibility and user authorization. | Authorized seed completion followed by permitted read-only row verification; no claim of seed completion before evidence. |
| P2-GCP-011 | 2.10 Pub/Sub topic and subscription | Create `sensor-readings` topic and `sensor-readings-df` subscription. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — fresh topic/subscription lists were empty; Pub/Sub API is not enabled. | Both resources absent; API activation/resource creation not authorized and service cost requirements are unverified. | Keep unchanged until per-service prerequisites and explicit authorization. | Pub/Sub API, project access. | Read-only topic and subscription inspection confirms exact names and topic link. |
| P2-GCP-012 | 2.11 Dataflow sensor stream | Grant documented worker roles; run Pub/Sub-to-BigQuery template with max worker 1; drain when idle. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — Dataflow API is not enabled, prerequisite bucket/topic are absent, and no default Compute worker identity was found in the service-account list. No job was launched. | Missing prerequisites and continuous worker charges. | Do not create identities/grant roles or launch a job until explicit authorization and cost acceptance. | Bucket, topic/subscription, BigQuery table, APIs, worker identity/roles. | Job reaches Running and rows arrive; verify draining after test. |
| P2-GCP-013 | 2.12 Sensor publisher | Prepare/run Node Pub/Sub publisher with exact schema keys and 30-second interval. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — local publisher and opt-in gate exist; offline tests confirm default refusal. The historical snapshot records Pub/Sub API/resources unavailable; no publication or fresh cloud check occurred. | Real topic/subscription, API, billing/permission prerequisites and authorized live test window are absent. | Keep publisher unrun; after authorization and resource verification, test the real message-to-BigQuery path and stop/drain workloads. | Pub/Sub resources/API, IAM/ADC, Dataflow for BigQuery visibility, user authorization. | Genuine test message appears in BigQuery and publisher/Dataflow are stopped or drained. |
| P2-GCP-014 | 2.13 Test Gemini on Vertex AI | Select supported Gemini model/location and execute live “ready” test. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — Vertex AI API is not enabled; utility requires an explicit flag, billing enabled, API enabled and model/location; no inference was attempted. | Billing/cloud authorization and API/model access. | Keep disabled; run only after explicit authorization. | Vertex API, ADC/IAM, model availability, billing/credits. | Authorized live response is “ready”; model/location recorded without credentials. |
| P2-GCP-015 | 2.14 Translation glossary | Wait for Om CSV; upload to glossary bucket and provision `corrugated` in `us-central1`; test glossary translation. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` — no glossary file exists in the repository; Translation API is not enabled. Glossary could not be inspected through the disabled API; manifest is intent only. | Missing Om CSV and cloud/Translation setup. | Obtain actual CSV; validate columns; provision/test only after API/service prerequisites are authorized. | Om glossary; Storage/Translation API; us-central1. | Glossary exists and test response uses its terms; no fabricated terms. |
| P2-GCP-016 | 2.15 Hello-world app on Cloud Run | Deploy `prepagent` in Mumbai with runtime SA, 1 GiB, env config, documented public judging access. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — Cloud Run, Cloud Build and Artifact Registry APIs are not enabled. Service listing/build/repository inspection is unavailable while APIs are disabled; no deployment was attempted. | Billing/cloud setup, app readiness and public exposure authorization. | Do not enable/deploy until prerequisites and explicit authorization; no API/resource was created. | APIs, bucket, model/config, Build/Artifact Registry, service account, working app. | Cloud Run URL and `/health` pass; revision and actual integrations verified. |
| P2-GCP-017 | 2.16 Troubleshooting | Follow documented fixes for billing, API enablement, Dataflow, BigQuery, Gemini, glossary and Cloud Run errors. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — `docs/CLOUD_INTEGRATION_TODO.md` maps the playbook's §2.16 symptoms to safe read-only diagnostics and stop conditions. Playbook PDF/DOCX and blueprint PDF were inspected from `../untracked_reference_docs`; cloud state was not refreshed in this sprint. | Local diagnostic guidance is complete; remaining acceptance requires diagnosing/independently verifying actual cloud resources and service symptoms. Disabled-API listing failures do not establish resource absence. | After explicit authorization, use the documented read-only checks, diagnose the observed symptom and independently verify its resolution; do not repeat blocked DML. | Cloud access and applicable service/API availability; explicit authorization for any state-changing fix. | Relevant troubleshooting case resolves and resource/service is independently verified. |
| P2-GCP-018 | 2.17 Build plan — Day 1 | Build app skeleton, PDF Gemini extraction, FX helper, test sample orders and redeploy. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — local JS app, schemas, FX, input-field validation, PDF MIME/filename plus `%PDF-` header validation, and focused tests exist. Actual PDF extraction, genuine agreed PO acceptance and redeployment are incomplete; Vertex/Storage prerequisites are not verified as ready. | Om's actual demo-order inputs are absent; extraction/deployment require cloud access and explicit authorization. | Obtain Om-approved anonymized Hindi/Japanese and other PO fixtures; after service/API/billing authorization, integrate genuine extraction and verify it on those inputs. Deployment remains separately unauthorized. | P2-GCP-009, P2-GCP-014, P2-OM-009, deployment authorization. | Real supplied POs extract correctly and deployed health passes, with evidence tied to actual inputs/services. |
| P2-GCP-019 | 2.17 Build plan — Day 2 | Translation helper, current conditions, risk/optimization/evidence SQL, Gemini tool loop/SSE, stored job sheet and localized PDF; `/jobs` end to end. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` — contracts/routes/mapper and local PDF renderer exist; actual model identities/SQL, optimizer/evidence queries and glossary are absent. Live cloud services are also unavailable; bundled script fonts satisfy the local renderer requirement only. | Om-owned models, queries and glossary are missing; cloud authorization/prerequisites are a secondary blocker. | Obtain P2-OM-001–005 artifacts. Then, only after explicit cloud authorization, implement and verify the genuine dependency-ordered workflow and persisted `/jobs` response. | P2-GCP-009–015; P2-OM-001–005; P2-AI-001–017. | Real `/jobs` flow returns a validated JobSheet/card under the documented runtime target on Cloud Run, with actual persisted data and trace evidence. |
| P2-GCP-020 | 2.17 Build plan — Day 3 | Operator UI, trace/risk/evidence/what-if/approve/print, localization, feedback/photos, guardrails; management view only if everything else works. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — the local responsive UI reports actual route responses and unavailable states; management view is conditional, not a prerequisite. Genuine trace, production workflow, localized service results, feedback/photos and deployed integration acceptance are not implemented because their live endpoints are unavailable. | The remaining end-to-end acceptance depends on authorized real services and Om-owned production inputs. | Preserve local honest UI; after service authorization and receipt of real inputs, connect and test actual workflow states. Do not add fake traces/results. | P2-GCP-019; P2-UI-001–008; P2-AI-001–017; Om handoffs P2-OM-001–010. | Demo flow uses real integrations/data, and every displayed state matches the actual service response. |
| P2-GCP-021 | 2.18 Keep running through judging | Warm Cloud Run for judging, drain Dataflow after recording, freeze deploys, monitor daily, rollback/scale down as specified. | `[D] DEFERRED BY EXPLICIT DECISION` — no deployment/stream; judging operations occur after authorized deployment. | User’s billing restriction and future deployment decision. | Revisit only after cloud readiness and explicit approval. | P2-GCP-016, P2-GCP-012. | Service uptime, drained stream, budget/log checks and rollback revision are verified during judging period. |

## 5. Local application and backend

Each row separates local implementation, real cloud integration, and end-to-end
evidence. Statuses here are **audit-derived subtasks**, not extra playbook
section numbers.

| ID | Capability | Local application implementation | Real cloud integration | End-to-end verification | Status / next action / dependencies |
|---|---|---|---|---|---|
| P2-APP-001 | Application structure/startup, `PORT`, `/health`, `/api/status`, root | Hono JS app, `npm start`, configurable port and routes; local HTTP smoke reported passing in latest audit. | None required for local start. | Startup, health/status, root HTML checked locally in latest audit. | `[✓] VERIFIED COMPLETE` — preserve current JS architecture. |
| P2-APP-002 | Purchase order, conditions, settings, risk, optimization, job, feedback, photo and BQ Zod schemas | Central Zod validators in `src/schemas.js`; compatibility export/JSDoc in `src/types.js`; contract tests. | Schemas do not produce cloud results. | Latest test run covered contract groups and invalid dimension/quantity. | `[✓] VERIFIED COMPLETE` for documented validation contracts only. |
| P2-APP-003 | Request validation, body limits, malformed/non-object JSON, structured errors | Structured 400 and 413 handling; 10 MiB limit; JSON-object guard. | Not a cloud integration. | Tests cover malformed JSON, null/array/scalar and oversized request. | `[✓] VERIFIED COMPLETE` for these local checks. |
| P2-APP-004 | PDF upload validation | Multipart route requires PDF-shaped file; does not claim extraction. | No Storage/Gemini call is wired. | Tests cover missing, wrong-type and valid-shaped PDF; last returns 503. | `[✓] VERIFIED COMPLETE` for validation only; actual extraction is P2-AI-001. |
| P2-APP-005 | Actual order extraction | No local substitute; JSON partial-field validation exists. | Vertex/Gemini + Cloud Storage adapter not wired. | No real order was extracted. | `[$] BLOCKED BY BILLING/CLOUD ACCESS`; also depends on Om test orders (P2-OM-009). |
| P2-APP-006 | FX rates, 24-hour cache, dated fallback, provenance, formatting | `src/fx-rates.js`, `src/fx-fallback.json`, `/fx`, `Intl.NumberFormat`; supports 11 project currencies. | Frankfurter feed is public ECB-based FX source, not a GCP integration. | Tests inject provider and fallback; no current-rate claim from fixture. | `[✓] VERIFIED COMPLETE` for helper/route tests recorded in latest audit; rate data is dated and not production evidence. |
| P2-APP-007 | Current conditions retrieval and last-stored fallback | Route validates shift and display preferences. | BigQuery sensor query/fallback is not wired. | No live or stored sensor result tested; endpoint returns 503. `env.sh` has no plant ID and route accepts no plant ID; Pub/Sub/Dataflow source resources are absent. A row query was not run because billing is disabled and query charges were not established as safe. | `[$] BLOCKED BY BILLING/CLOUD ACCESS`; depends on sensor data pipeline P2-GCP-011–013 and a confirmed plant selection. |
| P2-APP-008 | Risk prediction and five defect outputs | Request and result schemas exist. | BigQuery ML prediction SQL/model adapter absent. | Invalid input and explicit unavailable response tested; no risk prediction. | `[$] BLOCKED BY BILLING/CLOUD ACCESS`; also Om model/SQL P2-OM-001–002. |
| P2-APP-009 | Optimization, similar-run evidence and parameterized queries | Contracts and local helper surfaces exist. | Optimizer/evidence SQL and BigQuery query adapter absent. | Cloud-dependent result returns unavailable; no fabricated optimization/evidence. | `[$] BLOCKED BY BILLING/CLOUD ACCESS`; also P2-OM-003–004. |
| P2-APP-010 | BigQuery mapping and explicit unavailable/error boundaries | `src/bigquery-mapper.js` maps/validates row shapes; `src/service-ports.js` returns structured unavailable results. | No query/client persistence adapter. | Mapper unit tests and service-unavailable route tests passed in latest audit. | `[✓] VERIFIED COMPLETE` for mapping/declared boundaries only, not live BigQuery. |

### UI/localization subtasks

| ID | Capability | Local implementation | Cloud integration / E2E | Status, dependency and next action |
|---|---|---|---|---|
| P2-UI-001 | Operator UI: order, conditions, baseline, risk, evidence, what-if, create/approve/print, feedback | `src/operator-ui.js` provides PDF upload and supplied-JSON validation forms, status, conditions, risk, optimization/evidence requests and local supplied-JobSheet PDF rendering. Upload validation now checks the PDF header as well as media type/name. It surfaces errors/unavailability and contains no preset production/sample data. Browser acceptance displayed local `/api/status`, conditions `503`, and successful local rendering from an explicitly test-only fixture with no-save/no-upload messaging. | Cloud responses remain unavailable; agent trace, what-if slider, approval, feedback and complete job workflow are not implemented. | `[$] BLOCKED BY BILLING/CLOUD ACCESS`; remaining workflow UI must represent genuine trace, real results, persistence and approval. No cloud-backed controls can be claimed without actual endpoints. Om-approved demonstration orders are also required for genuine operator acceptance. Next: retain the honest local interface and connect remaining controls only after real endpoints and inputs exist. Files: `src/operator-ui.js`, `index.mjs`, `test/app.test.js`. |
| P2-UI-002 | Full order-to-job operator workflow | `src/operator-ui.js` contains a five-stage guide, upload/analysis forms and local supplied-JobSheet renderer; the mock-demo UI path was removed. `/orders/extract` and `/jobs` delegate to default unavailable service ports; approval and card routes likewise return `503`. | No accepted real PO, live trace, risk card with evidence/what-if re-scoring, approval, stored job or workflow printing. The what-if control and end-to-end-connected approval/print controls are absent. `service-ports.js` documents missing Cloud Storage/Gemini/BigQuery/model adapters; the expected Om PO is absent. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` (cloud authorization is also required). Local UI and `503` behavior are verified by `test/app.test.js`; they do not meet the actual Day 3 flow. No useful workflow completion can be made until a genuine PO and upstream services exist. Sources: blueprint pp. 3, 6, 13–14; playbook pp. 2, 9–10, 15. |
| P2-UI-003 | Language selector and translated UI labels | `src/locales/{en,hi,mr,ja,ko,zh-CN,id}.json` now hold the existing static ordinary-interface labels. `src/localization.js` imports the locale JSON, `/locales/:locale.json` serves the selected allow-listed file, and the selector updates marked labels/messages. These static strings are not Translation/glossary output. | No Om glossary CSV or approved locale terminology is present. Glossary-backed risk/job-card text, per-job/language translation cache, Translation API adapter and language QA against intended output are absent. Some explanatory page text is not localized. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` (Translation access/authorization is additionally required). Locale JSON serving and coverage are locally tested; real terminology, glossary translations, cache behavior and native-language QA cannot be verified without Om's artifact and authorized service. Sources: blueprint p. 17; playbook pp. 2, 7, 10, 15. |
| P2-UI-004 | Currency selector and display-only conversion | Eleven supported currencies are used by the selector. The existing `/fx` service implements a 24-hour cache, Frankfurter-based provider path and dated static fallback; the UI formats original and approximate (`≈`) display values with rate date/source. `getDisplayableProductionAmounts` recognizes the local RiskResult, OptimizationResult and JobSheet shapes and never mutates responses. | No genuine successful risk/optimization/job-sheet response exists to exercise the result integration. No FX provider call was made in this audit; fallback fixture date/provenance is not live data. The source defines the desired conversion display, not a freshness threshold; seven-day stale warning is an implementation choice. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` (genuine service results and authorized provider verification are additionally required). Local contract/fixture checks passed, but no production amount or current provider response was verified. Sources: blueprint pp. 8, 17; playbook pp. 5, 9–10, 15. |
| P2-UI-005 | Sample orders for home screen | No verified real anonymized samples in repository. | Om owns provided demo POs. | `[B] BLOCKED BY EXTERNAL DEPENDENCY`; wait for P2-OM-009. |
| P2-UI-006 | Responsive/usable laptop layout | Operator page uses a two-column desktop grid, single-column layout below 760px and print styles. | Browser acceptance found no horizontal overflow at 320, 390, 768, 1024 or 1440px; mobile layout is single-column at 390px and the first keyboard-focused control has a visible solid outline. Desktop initial viewport was visually inspected. | `[✓] VERIFIED COMPLETE` for local responsive layout and keyboard-focus presentation; this does not verify cloud workflow or production deployment. Files: `src/operator-ui.js`, `test/app.test.js`. |
| P2-UI-007 | Loading, error and unavailable states | Each action has live-region output, in-progress state, retry behavior, HTTP/error details, and unavailable state; network errors are sanitized. | Browser acceptance confirmed actual local status `200` and conditions `503`; malformed user JSON displayed validation feedback without a request; an intercepted network abort displayed a safe message and Retry; a held local request showed `Loading…`, disabled control and `aria-busy=true`; a test-only JobSheet rendered locally, then an intercepted render failure hid/cleared the stale PDF link and hid internal diagnostics. Automated route tests cover validation, unavailable services and 429 handling. The held-request interception did not resolve cleanly; no delayed completion claim is made. | `[✓] VERIFIED COMPLETE` for local loading/error/unavailable/recovery behavior. This does not establish deployed/live integration reliability. Files: `src/operator-ui.js`, `index.mjs`, `test/app.test.js`. |
| P2-UI-008 | Management view | Not implemented. | Playbook says “only if everything else works.” | `[D] DEFERRED BY EXPLICIT DECISION` until core workflow is accepted. |

### API guardrails (audit-derived subtasks)

| ID | Capability | Implementation | Status / evidence / remaining limitation |
|---|---|---|---|
| P2-GUARD-001 | Per-IP request rate limiting | `src/request-guardrails.js` applies a bounded in-memory 60-request/60-second fixed window to operational API routes using the direct Node socket IP. It ignores `X-Forwarded-For`; no shared-IP spoofing assumption is made. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — offline tests cover separate clients, spoofed forwarding headers, exact fixed-window expiry boundary, default 60/60 limit, bounded-map cleanup, downstream failures, 429 response and `/health` exemption. This is only per-process; the direct socket does not safely establish individual client IPs behind the intended Cloud Run/reverse-proxy deployment, and replicas do not share counters. | Local implementation is bounded and tested, but production acceptance requires an explicitly configured trusted-proxy client-IP source and shared limiter store, neither authorized nor present. Do not trust arbitrary forwarding headers or claim proxy/replica safety. Revisit after deployment architecture and authorization are provided. Files: `src/request-guardrails.js`, `index.mjs`, `test/request-guardrails.test.js`, `test/app.test.js`, `docs/LOCAL_DEVELOPMENT.md`. |
| P2-GUARD-002 | 60-second request timeout | `src/request-guardrails.js` bounds request handling, returns structured `REQUEST_TIMEOUT`/504 and aborts a cooperative handler. Cloud-facing service ports receive the request abort signal. | `[✓] VERIFIED COMPLETE` — `test/request-guardrails.test.js` verifies deadline, response and signal abort with a short test-only deadline; server default is 60 seconds. Adapters must honor the signal to stop their underlying work. Files: `src/request-guardrails.js`, `index.mjs`, `test/request-guardrails.test.js`. |

## 6. Google Cloud readiness and provisioning

Classification column uses only the requested cloud readiness categories.
Readiness statuses here are cross-references to Section 4/Section 5 IDs, not
additional counted tasks.

This readiness matrix preserves earlier audit evidence. Where its status or
classification is superseded by fresh inspection, Section 14 is authoritative.

| Resource/capability | Tracker ID | Cloud classification | Last evidence and state | Safe next action |
|---|---|---|---|---|
| Project ID/state and active account | P2-GCP-001, P2-GCP-003 | VERIFIED AND COMPLETE (project identity only) | Prior audit: project ID `prepagent-hack`, active account inspected. | Do not switch projects; recheck only when required. |
| ADC | P2-GCP-008 | VERIFIED AND COMPLETE | Prior audit confirmed ADC availability without printing token. | Never expose tokens/ADC files. |
| Billing | P2-GCP-003 | DEFERRED BY USER | Prior `billingEnabled=false`; not freshly rechecked in tracker task. | Keep disabled until explicit approval. |
| Budget alerts | P2-GCP-004 | DEFERRED BY USER | ₹5,000/month and 50/90/100 thresholds are documented but absent. | Create only after billing decision. |
| Required APIs | P2-GCP-005 | UNCERTAIN — needs service-specific review | Prior API check had BigQuery, Storage, Logging enabled; several required APIs disabled. | Do not enable without API-specific billing/prerequisite verification and explicit authorization. |
| Runtime service account | P2-GCP-007 | VERIFIED AND COMPLETE | Prior IAM check found `prepagent-run`. | No key files. |
| Runtime roles | P2-GCP-007 | VERIFIED AND COMPLETE | Prior IAM check showed all six playbook roles. | Recheck before workloads only. |
| Om Editor access | P2-GCP-006 | VERIFIED AND COMPLETE | Prior policy showed `omrajeshjain23@gmail.com: roles/editor`. | No change. |
| Dataset | P2-GCP-010 | VERIFIED AND COMPLETE | `prepagent` in `asia-south1`, prior read-only check. | No recreation. |
| Five table schemas | P2-GCP-010 | VERIFIED AND COMPLETE | `lots`, `sensor_readings`, `job_sheets`, `feedback`, `plants` matched playbook schema in prior audit. | No recreation. |
| Partition definitions | P2-GCP-010 | VERIFIED AND COMPLETE | `lots.run_date`; `sensor_readings.ts` partitioned by date. | No change. |
| `PLANT-01` seed | P2-GCP-010, P2-GCP-023 | REQUIRES BILLING/CREDITS | Prior count was zero; prepared MERGE; dry-run was rejected by billing DML restriction. | Do not retry until prerequisite resolved. |
| Data bucket | P2-GCP-009, P2-GCP-024 | REQUIRES BILLING/CREDITS | Prior listing did not contain intended bucket; manifest is not provisioning evidence. | No alternate bucket; create later if authorized. |
| Pub/Sub topic/subscription | P2-GCP-011, P2-GCP-025 | REQUIRES BILLING/CREDITS | Prior lists empty; API disabled. | Create only after authorized API/resource setup. |
| Vertex AI | P2-GCP-014, P2-GCP-028 | REQUIRES BILLING/CREDITS | API disabled; manifest explicitly keeps calls disabled. | No live call. |
| Translation API | P2-GCP-015, P2-GCP-028 | REQUIRES BILLING/CREDITS | API disabled. | No live translation. |
| Translation glossary | P2-GCP-015, P2-OM-005 | REQUIRES OM'S INPUT | No CSV; glossary is not provisioned. | Wait for actual CSV. |
| Dataflow API/job | P2-GCP-012, P2-GCP-026 | REQUIRES BILLING/CREDITS | No API/job; streaming incurs ongoing worker cost. | Do not start. |
| Default Compute worker identity | P2-GCP-012, P2-GCP-026 | REQUIRES EXTERNAL ACCESS/PERMISSION | Prior expected default Compute identity returned NOT_FOUND; current project-ID-filtered service-account list has no default Compute identity; no roles granted. | Recheck only after authorized Compute setup; do not grant to runtime SA by mistake. |
| Cloud Build | P2-GCP-016, P2-GCP-027 | REQUIRES BILLING/CREDITS | API not enabled; no build run. | Defer. |
| Artifact Registry | P2-GCP-016, P2-GCP-027 | REQUIRES BILLING/CREDITS | API/repository not provisioned. | Defer. |
| Cloud Run | P2-GCP-016, P2-GCP-029 | REQUIRES BILLING/CREDITS | API disabled; no service/revision. | No deploy/public exposure. |
| Logging | P2-GCP-005, P2-GCP-031 | VERIFIED AND COMPLETE | API enabled per prior audit; no sinks/retention mutation. | None. |
| Sensor publisher | P2-GCP-013, P2-GCP-030 | REQUIRES BILLING/CREDITS | Local gated script only; Pub/Sub topic absent. | Do not publish. |
| Environment configuration | P2-GCP-002, P2-GCP-024 | VERIFIED AND COMPLETE | Correct non-secret variables; `env.sh` ignored by Git. | Keep synchronized, no secrets. |
| Deployment configuration | P2-GCP-016, P2-GCP-029 | SAFE TO COMPLETE WITHOUT BILLING (configuration only) | Existing Cloud Run manifest describes intended service/settings; no live service. | Review against app before future deployment; manifest is not deployment proof. |

### Audit-derived GCP subtasks

| ID | Status | Evidence | Next action / dependencies |
|---|---|---|---|
| P2-GCP-022 | `[✓] VERIFIED COMPLETE` | Fresh `bq show` confirmed all five tables and schemas; daily partition fields are `lots.run_date` and `sensor_readings.ts`; other three are unpartitioned. No query/DML run. | Preserve existing tables. |
| P2-GCP-023 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Idempotent seed SQL exists; seed remains unexecuted; prior dry-run was rejected under billing restriction. No retry, query or dry-run this sprint. | Do not execute until BigQuery query/DML eligibility and explicit user authorization are established; then verify the actual seed row. |
| P2-GCP-024 | `[✓] VERIFIED COMPLETE` | Fresh non-secret `env.sh` inspection matched project, both regions, bucket, runtime SA and Om tracker identity; repository file remains Git-ignored. | Do not commit env file. |
| P2-GCP-025 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Historical Phase 2 checks recorded the intended bucket as 404 and Pub/Sub topic/subscription as empty; Pub/Sub API was disabled. No fresh cloud calls or resource creation occurred this sprint; a disabled-API result is not proof of resource absence. | After explicit authorization, verify API state first, then independently inspect/provision only documented resources; do not create alternatives. |
| P2-GCP-026 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Fresh service-account listing found no default `compute@developer.gserviceaccount.com` identity; Compute API is not enabled. No worker IAM changes. | Do not create identity/enable Compute or grant roles speculatively. Recheck only when authorized prerequisites exist. |
| P2-GCP-027 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Historical snapshot records Cloud Build and Artifact Registry APIs disabled. Build/repository inspection was blocked by disabled APIs; repository absence was not established. No cloud calls or builds this sprint. | Do not enable APIs or create/build a repository; after explicit authorization, inspect actual service state and verify prerequisites. |
| P2-GCP-028 | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | Historical snapshot records Vertex AI and Translation APIs disabled; no calls occurred this sprint. Om’s glossary CSV and model inputs remain missing; live API/resource checks are also unavailable. | Obtain Om’s actual glossary/models and required SQL; then, only after explicit cloud/API authorization, inspect and implement genuine services. |
| P2-GCP-029 | `[D] DEFERRED BY EXPLICIT DECISION` | Cloud Run service/API state was not refreshed; earlier listing was unavailable while the API was disabled. The user explicitly prohibits deployment/public exposure in this sprint. | Keep undeployed and do not activate APIs. Revisit only after explicit deployment authorization, billing/cost decision, and readiness/security review; inspect actual service state before deploying. |
| P2-GCP-030 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Offline gate test confirms Gemini utility refuses default execution and requires explicit live-call authorization; it does not establish inference functionality. No live call or cloud preflight occurred. | Keep live inference disabled; after prerequisites and explicit authorization, run a live smoke test and record the actual model/location/result. |
| P2-GCP-031 | `[✓] VERIFIED COMPLETE` | Fresh API list confirms Logging enabled; sink list contains only `_Required` and `_Default`. No custom sink, retention, or logging configuration was changed. | No action. |

## 7. AI, production preparation and business workflow

These are audit-derived implementation tasks linked to the official Day 1–3
requirements. The current code has Zod contracts, routes and named helper
functions, but that does not establish live capability. The statuses below
describe required **actual** integrations; temporary cloud mocks are
prohibited.

| ID | Capability | Local code state | Real integration / evidence needed | Status, blocker and next action |
|---|---|---|---|---|
| P2-AI-001 | `extractOrder` — actual PDF extraction | Upload checks and JSON field-validation helper exist; no PDF parsing/model adapter. | Cloud Storage PDF + Gemini structured response + Zod validation against Om’s real POs. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` and `[$] BLOCKED BY BILLING/CLOUD ACCESS` — Om’s anonymized orders are absent; Vertex API is disabled and intended Storage bucket is absent. Phase 4 confirmed no agreed demo PDF in the workspace; local route tests still receive explicit `503 SERVICE_UNAVAILABLE`. No SDK adapter or live call added. |
| P2-AI-002 | `getConditions` — latest sensor data/fallback | Route/schema exist; no stored/latest-row query. | Read latest BigQuery sensor row and documented last-stored fallback. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — BigQuery API, dataset/table and runtime roles exist, but the configured environment has no plant ID, sensor data was not queried, and Pub/Sub/Dataflow ingestion resources are absent. No query was issued because billing is disabled and query cost safety is unverified. |
| P2-AI-003 | `predictRisk` — five defect results | Validation/schema/route exist; no trained model output. | Five real model inference queries with validated results. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` — Om’s model names/SQL; also requires cloud access. |
| P2-AI-004 | `optimizeLevers` — baseline, best, changes, savings | Request/result contracts exist; no optimizer implementation. | Grid search using trained models, documented objective and max-three-change result. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` — Om’s objective/query and baseline; no mock recommendations. |
| P2-AI-005 | `findSimilarRuns` — evidence and “Have we seen this?” | Named helper/route validates input then reports unconfigured. | Parameterized historical query and real lot/feedback records. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` — Om’s evidence SQL/data plus cloud access. |
| P2-AI-006 | `explainRisk` — model explanations | Named helper validates inputs, then unavailable. | Actual `ML.EXPLAIN_PREDICT` attributions and Gemini explanation grounded in them. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` — Om’s explain/model SQL; Vertex/Gemini access. |
| P2-AI-007 | `generateJobSheet` — complete validated result | JobSheet schema/helper exists; no real analysis or generated sheet. | Full upstream results and Gemini explanation produce a real `DRAFT` JobSheet. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` — model/optimizer/evidence handoffs; cloud access. |
| P2-AI-008 | Gemini function-calling loop and tool registry | Seven helper names/routes exist; no Gemini function-calling orchestration. | Real Vertex Gemini calls the seven tools with bounded deterministic pipeline. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — implement real adapter when authorized; do not simulate tool calls. |
| P2-AI-009 | Shared agent execution trace | `src/trace-registry.js` provides bounded in-memory run/tool lifecycle functions, validation, ordered event IDs, sanitized errors, retention and subscriber limits. Search of production imports/call sites shows only `index.mjs` mounts the registry-backed SSE route; no application runner calls `startRun`, `startTool`, `finishTool` or `finishRun`. | No genuine Gemini/function-calling runner (P2-AI-008), actual tool result/error instrumentation or real run lifecycle is present. Event names/payload and lifecycle/cancellation details are implementation-defined in the local module and are not defined by the source documents; no fixture event is production evidence. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` — genuine P2-AI-008 orchestration and its actual calls are prerequisites; Om PO/model/SQL handoffs and cloud access also block the runner. Local registry tests verify only its inferred interface, not the playbook requirement for actual tool calls. Sources: blueprint pp. 2–3, 13–14; playbook pp. 2, 9. |
| P2-AI-010 | SSE trace streaming to UI | `src/trace-routes.js` exposes SSE with bounded replay/subscriber queues, replay/live deduplication, validation, overflow notice and disconnect cleanup. `src/operator-ui.js` subscribes via EventSource only after an operator provides a run ID. `test/trace-routes.test.js` verifies transport behavior, including replay race. | No genuine runner generates a run ID or events for the page. The source requires each actual Gemini tool call to stream over SSE but does not specify wire event names, payload, execution IDs or cancellation/disconnect lifecycle; current choices are implementation details only. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` — real P2-AI-008 runner and P2-AI-009 event production are absent; source protocol gaps must be resolved against that implementation. Tests prove local transport only; no actual agent stream/lifecycle acceptance occurred. Sources: blueprint pp. 2–3, 13; playbook p. 9. |
| P2-AI-011 | JobSheet BigQuery persistence | Schema and row mapper exist; no BigQuery writer/reader. | Persist/read actual validated job sheets, timestamps, approval and card URI. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — BigQuery service integration; no local persistence substitute. |
| P2-AI-012 | Print-ready PDF renderer and Unicode fonts | `src/job-sheet-pdf.js` validates with `JobSheetSchema`, produces A4 PDFs, includes supplied order, conditions, baseline/recommended settings and risk, changes, savings, evidence, explanation and exact status; `POST /job-sheets/render.pdf` is separate from upload/persistence. Bundled licensed Noto Sans assets cover Devanagari, Japanese, Korean and Simplified Chinese. | Focused tests verify PDF structure/content, optional fields, status, font embedding for all four scripts, common WinAnsi punctuation, missing-font overrides and pagination. Quick Look visually rendered a synthetic test fixture containing all four scripts. The live local route returned `200 application/pdf` with `%PDF-1.3`. No Storage upload or production JobSheet was involved. | `[✓] VERIFIED COMPLETE` for the local PDF-renderer contract only. Cloud Storage upload remains separate under P2-AI-013. Files: `src/job-sheet-pdf.js`, `index.mjs`, `test/job-sheet-pdf.test.js`, `test/app.test.js`, `assets/fonts/**`. |
| P2-AI-013 | Cloud Storage job-card upload | Route/manifest only; no upload code. | Store rendered card under `jobcards/` and return actual URI. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — bucket and Storage client/permissions. |
| P2-AI-014 | Approval and print workflow | `POST /jobs/:id/approve` validates then returns 503; no state transitions. | Persist `APPROVED`, create card, return actual card URL. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — BigQuery + PDF + Storage, after real job. |
| P2-AI-015 | Photo diagnosis | Photo result schema only; no classifier. | Gemini classifies actual Om-provided defect photos and logs result. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — Vertex plus Om photos/labels; no fabricated classifications. |
| P2-AI-016 | Feedback and operator notes | Feedback schema/route validation exists; port returns 503. | BigQuery feedback write, photo handling, note translation while retaining original. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — BigQuery, Storage, Translation; Om’s photos/ground truth. |
| P2-AI-017 | Glossary-backed translations/cache | Supported language codes exist; no `translate()` adapter or per-job/language cache. | Glossary-backed Translation Advanced in `us-central1`; verify terms/cache. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` — Om CSV; also Translation cloud access. |

## 8. Om and external dependencies

No request date is recorded in available repository/audit evidence; none is
invented here. Owner is recorded as Om where assigned by the playbook’s Part 3
and team plan.

| ID | Required artifact/input | Owner | Request date | Status | Downstream tasks blocked | Exact unblock action |
|---|---|---|---|---|---|---|
| P2-OM-001 | Five trained model identities/artifacts and training SQL | Om | Not recorded | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | P2-GCP-019; P2-AI-003–008 | Supply model names, training SQL, registry details and evaluation evidence. |
| P2-OM-002 | Risk prediction SQL for all five defects | Om | Not recorded | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | P2-AI-003, P2-GCP-019 | Supply parameterized `ML.PREDICT` query/contract for each model. |
| P2-OM-003 | Optimizer objective/grid/query and plant baseline settings | Om | Not recorded | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | P2-AI-004, P2-GCP-019 | Supply objective, penalty assumptions, permitted grid and validated baseline. |
| P2-OM-004 | Explain/evidence/similar-run SQL and query inputs | Om | Not recorded | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | P2-AI-005–006 | Supply `ML.EXPLAIN_PREDICT` and evidence query with expected row shape. |
| P2-OM-005 | Actual glossary CSV with `en,hi,mr,ja,ko,zh-CN,id` columns | Om | Not recorded | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | P2-GCP-015; P2-AI-017; P2-UI-003 | Deliver CSV with validated header and reviewed trade-term entries. |
| P2-OM-006 | Plant monthly humidity/temperature season profile | Om | Not recorded | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | P2-GCP-013; P2-GCP-018 | Supply the plant season profile for the publisher/demo. |
| P2-OM-007 | Plant standard machine baselines, cost and throughput assumptions | Om | Not recorded | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | P2-AI-004; P2-GCP-018 | Confirm settings/cost against plant inputs; identify placeholders explicitly. |
| P2-OM-008 | Production stage order, especially printing location | Om | Not recorded | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | Process explanation and operator job-card correctness | Confirm actual manufacturing stage sequence. |
| P2-OM-009 | Five anonymized POs, including Hindi/Japanese examples | Om | Not recorded | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | P2-AI-001; P2-UI-005; P2-GCP-018 | Supply safe anonymized PDFs/photos and identify language fixtures. |
| P2-OM-010 | Anonymized real defect photos and labels/associated data | Om | Not recorded | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | P2-AI-015–016; Day 3 demo | Supply consent-cleared categorized defect photos and actual classification labels. |

## 9. Testing and code quality

The latest supplied audit’s results are recorded as historical evidence, not
as tests rerun during this tracker-only task.

| ID | Check / acceptance | Status | Evidence and scope | Remaining action |
|---|---|---|---|---|
| P2-TEST-001 | Offline automated tests | `[✓] VERIFIED COMPLETE` | Phase 5 `npm test`: 31 passed, 0 failed; focused `node --test test/app.test.js`: 12 passed, 0 failed. Covers schemas/routes/FX/unavailable services, local PDF and guardrails; tests establish local contracts only, not cloud workflow or script-font rendering. | Rerun when code changes; do not equate with E2E acceptance. |
| P2-TEST-002 | JavaScript syntax checks | `[✓] VERIFIED COMPLETE` | Phase 5 `node --check` passed on `index.mjs`, all `src/*.js`, `test/*.js`, `test/fixtures/*.js`, and `tools/*.mjs`. | Rerun on changed JS. |
| P2-TEST-003 | JSON/config validation | `[✓] VERIFIED COMPLETE` | Phase 5 parsed `package.json`, `package-lock.json`, and every `config/*.json`; deployment manifest project/region checks matched `prepagent-hack`, `asia-south1`, and `us-central1`. | Rerun when manifests change. |
| P2-TEST-004 | `npm audit` | `[✓] VERIFIED COMPLETE` | Phase 5 `npm audit`: 0 vulnerabilities. | Audit when dependencies change. |
| P2-TEST-005 | Git whitespace check | `[✓] VERIFIED COMPLETE` | Phase 5 `git diff --check` passed. | Check every code change. |
| P2-TEST-006 | Local HTTP smoke/route tests | `[✓] VERIFIED COMPLETE` | Phase 5 full/focused app tests passed; they verify `/health`, operator UI shape, validation and explicit unavailable behavior. Prior browser evidence covers status/unavailable display and 390px overflow only. No live service/UI success verified. | Extend only with future genuine integration/local changes. |
| P2-TEST-007 | Live cloud integration checks | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Explicitly not run; billing/API/services unavailable. | Test each real adapter only after authorized provisioning. |
| P2-TEST-008 | Full purchase-order to printed job-card acceptance | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Phase 4 route suite: 12 passed, 0 failed; tests confirm unavailable extraction/conditions/jobs/approval/card/feedback responses, not workflow success. No agreed demo input; no real stages executed. | Run real end-to-end acceptance after P2-AI-001–017 integrations and receipt of agreed demo inputs. |
| P2-TEST-009 | Compile/build check | `[N/A] NOT APPLICABLE TO THIS PROJECT OR PLAYBOOK` | Project intentionally remains JavaScript ES modules with Node start script; no TypeScript compiler/build step is configured or required for current JS choice. | Revisit only if TypeScript migration is explicitly chosen. |
| P2-DEPLOY-001 | Judging demo/rehearsal and deployment acceptance | `[D] DEFERRED BY EXPLICIT DECISION` | No deployment; judging flow depends on end-to-end completion and cloud authorization. | Revisit after real integrations and explicit deployment approval. |

**Current Phase 1 validation summary:** `npm test`: 31 passed, 0 failed;
changed-file `node --check`, package/config JSON parsing, `git diff --check`,
`npm audit` (0 vulnerabilities), local health/root UI smoke, browser
responsive/unavailable-state checks, and an independent `pypdf` parse plus
whitespace-normalized extraction of supplied PDF content passed. No live
integration, Unicode-font rendering, or end-to-end acceptance was verified.

## 10. Live integration plan

This order is a dependency plan, **not** permission to bypass the billing
decision or run a live workload.

1. Read this tracker, inspect the selected task’s current files/resource state,
   and perform only safe read-only verification needed for that task.
2. Complete the genuine local application work that does not duplicate cloud
   services (e.g., PDF renderer, operator UI, trace presentation interfaces,
   rate/timeout guardrails). Do not create cloud mocks.
3. Receive Om’s SQL, glossary, plant inputs and demo fixtures; update their
   dependency rows with actual artifact evidence.
4. Obtain explicit authorization before resolving billing/credits or doing
   any cloud mutation; establish the playbook budget alert before workloads.
5. Provision the exact documented cloud resources, verifying every resource
   independently. API enablement is not resource readiness.
6. Connect actual SDK/query/model/Translation/Storage/Pub/Sub adapters and
   Om’s real production logic; keep credentials out of source/logs.
7. Test each integration against genuine resources and supplied inputs; record
   output shape, resource, region, date and failure evidence without secrets.
8. Verify the entire purchase-order → conditions → risk → optimize/evidence →
   job sheet → approval → PDF → feedback workflow and the under-30-second
   playbook target.
9. Deploy/prepare for judging only after application, security, cost and public
   access decisions are explicitly authorized.

## 11. Immediate next actions

### Can proceed now without cloud provisioning

| Priority | Task IDs | Prerequisites | Exact action | Expected evidence / what it unblocks |
|---|---|---|---|---|
| P1 | P2-AI-012 | Existing JS repo; no cloud needed | Keep bundled licensed Noto Sans TTF assets and script-rendering tests in sync if the renderer changes. | Local renderer and Devanagari/Japanese/Korean/Simplified Chinese coverage are implemented and tested; Storage upload remains separate. |
| P1 | P2-UI-001, P2-UI-006–007 | Current route contracts and honest unavailable responses | Complete the real job/approval/feedback/trace UI only as genuine endpoints become available; review keyboard/screen-reader behavior. | Current status/upload/validation/conditions/risk/optimization/evidence/PDF surface is wired and tested; live workflow remains blocked. |
| P1 | P2-AI-009–010 | Actual orchestration not yet available | Align the local trace/SSE contract with the genuine runner when P2-AI-008 is implemented; emit only events from actual tool calls. | Real run-to-stream integration and disconnect/cancellation acceptance; current local transport tests do not satisfy this. |
| P2 | P2-APP-001–010, P2-TEST-001–006, P2-GUARD-001–002 | Existing implementation evidence | Update relevant tracker rows after genuine implementation changes; rerun focused tests. | New test output and changed-file evidence; maintains tracker accuracy. |

### Blocked pending external input or explicit cloud authorization

| Priority | Task IDs | Prerequisites | Exact next action | Expected evidence / what it unblocks |
|---|---|---|---|---|
| P1 | P2-OM-001–004 | Om’s Part 3 deliverables | Obtain five models/training SQL, risk SQL, optimizer objective and explain/evidence queries. | Versioned SQL/model names/expected output schema; unblocks real risk and agent. |
| P1 | P2-OM-005, P2-OM-009–010 | Om’s actual assets | Obtain glossary CSV, anonymized Hindi/Japanese plus other PO samples, and consent-cleared defect photos/labels. | Files and validation results; unblocks extraction, translation and photo tests. |
| P1 | P2-GCP-003–016, P2-GCP-023–030 | Explicit user decision on billing/credits and resource costs | Keep all cloud operations paused until explicitly authorized; then follow official playbook order. | Read-only cloud verification for each item; unblocks live SDK integration. |
| P2 | P2-GCP-021, P2-DEPLOY-001 | Full app acceptance and deployment authorization | Revisit judging operations only after live workflow and cost/security review. | Verified deployed revision, demo rehearsal, budget/log checks. |

## 12. Copilot session changelog

Append new entries; do not remove or rewrite prior entries.

| Date/time | Session summary | Task IDs changed | Files changed | Tests/commands and results | Remaining blockers |
|---|---|---|---|---|---|
| 2026-10-11 (time from user message: 01:20 +05:30) | Created authoritative tracker from supplied Part 2 instructions, existing audit and repository evidence. Tracker-only task; no implementation/cloud changes. | Inventory established; no statuses changed from a new cloud check. | `docs/PART2_COMPLETION_TRACKER.md` | Markdown whitespace check and content/ID/count reconciliation only; no app tests or cloud calls run. | Billing remains disabled; Om inputs and live integrations remain outstanding. |
| 2026-10-11 (Phase 1 implementation session) | Added local supplied-JobSheet PDF rendering, operator UI, and request timeout/rate-limit guardrails. No cloud operations or deployment performed. | P2-AI-012, P2-UI-001, P2-UI-006, P2-UI-007, P2-GUARD-001, P2-GUARD-002, P2-TEST-001, P2-TEST-002, P2-TEST-005, P2-TEST-006 updated. | `package.json`, `package-lock.json`, `index.mjs`, `src/job-sheet-pdf.js`, `src/operator-ui.js`, `src/request-guardrails.js`, `test/app.test.js`, `test/fixtures/job-sheet.js`, `test/job-sheet-pdf.test.js`, `test/request-guardrails.test.js`, `docs/LOCAL_DEVELOPMENT.md`, `docs/PART2_COMPLETION_TRACKER.md` | `npm test`: 31 passed, 0 failed. `node --check` passed for all changed JavaScript. JSON validation and `git diff --check` passed. `npm audit`: 0 vulnerabilities. Local HTTP/UI smoke and browser responsive/unavailable-state check passed. PDF uses valid PDFKit document output; script-font error verified. | Noto Sans Devanagari/Japanese/Korean/Chinese font files unavailable. Per-IP limiter is in-memory/direct-socket only and not production proxy/replica-safe. Billing, cloud integrations, Om inputs and complete workflow remain blocked. |
| 2026-10-11 (Phase 1 follow-up verification) | Re-ran automated and static checks; independently parsed the generated PDF and extracted supplied identifiers/status with whitespace normalization. No source or cloud changes. | P2-TEST-001–005 evidence refreshed. | `docs/PART2_COMPLETION_TRACKER.md` | `npm test`: 31 passed, 0 failed; changed-file `node --check`, package JSON parsing, `git diff --check`, `npm audit`: 0 vulnerabilities; `pypdf` parsed the PDF and recovered job ID, order ID and draft status after whitespace normalization. | Unicode script-font assets and rendering remain blocked; per-IP proxy/replica-safe limiter remains incomplete. No cloud integration or end-to-end workflow verified. |
| 2026-10-11 01:43 +05:30 (Phase 2 read-only GCP readiness) | Rechecked project, billing, APIs, IAM, BigQuery, bucket, Pub/Sub, build/registry/Run access, Logging, manifests and safety gates. No cloud mutations or workloads. | P2-GCP-001–031 evidence refreshed; no cloud task marked complete based on a manifest. | `docs/PART2_COMPLETION_TRACKER.md` only. | Read-only `gcloud`/`bq` commands and local manifest/gate checks are enumerated in Section 14. Disabled-API listing errors and two unsupported read-only CLI subcommands recorded there. Tracker `git diff --check` passed. No application tests (documentation-only). | Billing false. Bucket and Pub/Sub resources absent. Multiple APIs disabled; Build/Artifact Registry/Run services cannot be inspected. Default Compute worker identity absent. Plant seed not run. Om CSV missing. API-specific activation/billing and resource creation require further authorization. |
| 2026-10-11 01:53 +05:30 (Phase 4 workflow verification) | Re-read tracker and inspected workflow routes, service ports, local helpers and test coverage. No agreed demo input or newly provisioned service found; stopped at preflight without submitting customer input or making cloud calls. | P2-TEST-008 and P2-AI-001 workflow evidence refreshed; no integration completed. | `docs/PART2_COMPLETION_TRACKER.md` only. | `node --test test/app.test.js`: 12 passed, 0 failed. These tests assert explicit unavailable responses and local-only PDF behavior; they do not demonstrate live workflow completion. `git diff --check` passed. | Workflow failed preflight before stage 1: actual agreed PO input absent; extraction and conditions ports return 503; all downstream AI/BigQuery/Storage/approval/feedback services remain blocked or not implemented. |
| 2026-10-11 01:58 +05:30 (Phase 5 final acceptance/deployment gate) | Re-read tracker; checked for genuine demo inputs, real adapter/SSE/idempotency wiring, refreshed billing/API state, ran offline quality/security/config checks and produced a deployment-readiness assessment. No cloud mutations or deployment. | P2-TEST-001–008 and P2-DEPLOY-001 evidence refreshed; no cloud integration completed. | `docs/PART2_COMPLETION_TRACKER.md` only. | `npm test`: 31 passed, 0 failed; `node --test test/app.test.js`: 12 passed, 0 failed; syntax/config checks passed; `npm audit`: 0 vulnerabilities; credential-pattern and tracked-env-file scans clean; manifest project/region check passed; `git diff --check` passed. End-to-end test not run because genuine agreed inputs/services are unavailable. | Workflow fails before stage 1. Billing false; required APIs disabled; no demo PO, live adapters, SSE, idempotent job creation, BigQuery/Storage workflow. No deployment authorization or live workflow evidence. |
| 2026-10-10 20:55 (focused 19-task sprint) | Reconciled the selected partial tasks; added licensed Noto font assets, completed local PDF rendering, verified responsive UI behavior, expanded guardrail/readiness tests and documented safe cloud troubleshooting. No cloud commands, live integrations, resource changes or deployment. | P2-AI-012 and P2-UI-006 promoted to verified for their local contracts; remaining 17 selected IDs stay partial. The 21 frozen verified-complete task statuses/evidence were not changed. | `src/job-sheet-pdf.js`, `src/operator-ui.js`, `src/request-guardrails.js`, `assets/fonts/**`, `test/job-sheet-pdf.test.js`, `test/app.test.js`, `test/request-guardrails.test.js`, `test/cloud-readiness.test.js`, `test/cloud-tool-gates.test.js`, `docs/LOCAL_DEVELOPMENT.md`, `docs/CLOUD_INTEGRATION_TODO.md`, `config/gcp-vertex-ai.json`, `docs/PART2_COMPLETION_TRACKER.md`. | `npm test`: 45 passed, 0 failed; focused PDF/app tests: 24 passed, 0 failed; changed-JS syntax checks and `git diff --check` passed. Browser: no horizontal overflow at 320/390/768/1024/1440px; `/api/status` 200; conditions 503 honestly shown; local test-fixture PDF route 200 and Quick Look visually displayed all four scripts. | Billing/API/resource/Om prerequisites remain unchanged. PDF task completion is local rendering only; no Storage upload. Rate limiter remains per-process/direct-socket, and cloud workflow/live task acceptance is incomplete. |
| 2026-10-11 (focused 17-task source-backed sprint) | Consulted the actual playbook/blueprint, audited the requested task implementations and evidence, fixed stale PDF-link cleanup after render errors, tightened PDF upload signature validation, added the fixed-window boundary regression test, reconciled stale font/source-location notes, and documented exact dispositions. No cloud operations. | P2-GCP-003, 005, 010, 013, 017–020, 023, 025, 027–030, P2-UI-001, P2-UI-007 and P2-GUARD-001 reviewed; P2-AI-012/P2-UI-006 remain complete only for local scope. | `index.mjs`, `src/operator-ui.js`, `test/app.test.js`, `test/request-guardrails.test.js`, `docs/PART2_COMPLETION_TRACKER.md` | `cd prepagent && npm test`: 46 passed, 0 failed; `node --test test/app.test.js test/request-guardrails.test.js`: 21 passed, 0 failed; guardrail-only tests: 8 passed, 0 failed; project JS syntax, package/config JSON parsing, tracker whitespace/final-newline check, `git diff --check`, and changed-scope credential-pattern scan passed. Browser checks used local/test-intercepted states only. An initial parallel test invocation collided on fixed port 4100 and failed 3 fetch tests; sequential reruns passed. | Billing remains disabled; cloud facts are historical; Om inputs/services remain unavailable; P2-GUARD-001 is not proxy/replica safe; end-to-end acceptance remains 0/1. |
| 2026-10-11 (five not-started task implementation) | Read the authoritative blueprint, playbook PDF and companion DOCX, then inspected the five selected tracker tasks and current routes/contracts. Added source-supported language and currency controls only; left the end-to-end workflow and execution trace/SSE unimplemented because genuine upstream execution is unavailable and no event wire lifecycle is specified. No cloud operations. | P2-UI-002, P2-UI-003, P2-UI-004, P2-AI-009, P2-AI-010 reviewed; UI-003/UI-004 are partial, UI-002/AI-009/AI-010 remain not started. | `index.mjs`, `src/operator-ui.js`, `src/display-currency.js`, `test/app.test.js`, `test/display-currency.test.js`, `docs/PART2_COMPLETION_TRACKER.md` | `npm test`: 49 passed, 0 failed. Focused `node --test test/display-currency.test.js test/app.test.js`: 16 passed, 0 failed. JavaScript syntax, package/config JSON parsing, tracker ID/status reconciliation, whitespace/final newline and `git diff --check` passed. Browser verified selector status and display conversion using an intercepted test-only dated FX fixture; no external FX call. An initial focused assertion expected a different validation message; corrected and reran successfully. | Translation API/glossary and Om glossary data remain absent; risk/job-card services are unavailable; seven-tool orchestration and event contract are absent. Billing remained disabled; no APIs/resources, production uploads, live service calls or deployment. |
| 2026-10-11 (five-task local capability follow-up) | Expanded the partial UI tasks with static interface translations, recognized-result display-only currency conversion, and local bounded trace/SSE infrastructure with EventSource UI. Fixed duplicate replay/live delivery and bounded the subscriber queue with explicit overflow signaling. This supersedes the earlier same-day statement that AI-009/010 had no infrastructure; it does not claim genuine trace production or full acceptance. No cloud operations or production data. | P2-UI-002/003/004 and P2-AI-009/010 remain partial; dashboard now reflects 5 partial and 0 not-started tasks. | `index.mjs`, `src/operator-ui.js`, `src/display-currency.js`, `src/localization.js`, `src/money-contracts.js`, `src/trace-registry.js`, `src/trace-routes.js`, `test/app.test.js`, `test/display-currency.test.js`, `test/localization.test.js`, `test/money-contracts.test.js`, `test/trace-registry.test.js`, `test/trace-routes.test.js`, `docs/PART2_COMPLETION_TRACKER.md` | `npm test`: 65 passed, 0 failed. `node --test test/app.test.js`: 13 passed, 0 failed; `node --test test/trace-routes.test.js`: 5 passed, 0 failed. JavaScript syntax and package/config JSON checks passed; translation coverage confirmed for 7 locales × 91 strings; `git diff --check` passed. No live FX call, cloud operation, actual agent tool trace, or end-to-end workflow was verified. | Om glossary/approved terminology and PO inputs are absent; translation API, production services and real orchestration remain unavailable. The local trace event contract is implementation-defined pending alignment with the genuine runner. Billing remained disabled. |
| 2026-10-11 12:22 +05:30 (source-grounded five-task audit) | Re-read the supplied playbook PDF/DOCX, blueprint PDF and authoritative tracker; traced current routes, default service ports, mock helpers, localization, FX, trace/SSE and tests. Moved the pre-existing static UI dictionary into the seven source-required locale JSON files, added three ordinary request-field labels as clearly static/unreviewed UI copy, and added an allow-listed JSON route/tests. Reclassified all five target tasks as externally blocked because no safe acceptance work remains before Om inputs and genuine upstream services are available; retained secondary cloud/authorization blockers. No cloud operations or production data. | P2-UI-002/003/004 and P2-AI-009/010 moved from partial to blocked by external dependency; dashboard reconciled to 0 partial and 26 external-blocked overall. No other task status changed. | `index.mjs`, `package.json`, `package-lock.json`, `src/localization.js`, `src/locales/*.json`, `src/operator-ui.js`, `test/app.test.js`, `test/localization.test.js`, `docs/PART2_COMPLETION_TRACKER.md` | `npm test`: 66 passed, 0 failed. Focused five-task suites: 33 passed, 0 failed. `node --check` passed for project JS; package/config/locale JSON parsed; `git diff --check` passed; task inventory reconciled to 88 unique IDs. No live FX, Google Cloud, Translation, Gemini, production workflow or trace operation was run. | All five genuine POs, Om glossary CSV/approved locale terms, production lot/feedback data, sensor season profile, trained-model/predict/optimizer/explain/similar-runs SQL, demo lot and defect photos are absent. Cloud integrations and P2-AI-008 orchestration remain unavailable; trace/SSE protocol details are not specified by the source documents. |
| 2026-10-11 12:49 +05:30 (full inventory completeness sweep) | Reconciled the 21 official requirements and 67 audit-derived subtasks against the actual playbook PDF and companion DOCX, Blueprint 3, current source, tests and prior artifact evidence. Confirmed the three request-field labels are localized as ordinary static UI copy, not glossary translations. No further independently completable source-required work was found; no status was changed and no production behavior was simulated. | None; dashboard status counts remain unchanged. | `docs/PART2_COMPLETION_TRACKER.md` | `npm test`: 66 passed, 0 failed. Direct PDF text extraction checked playbook pp. 9–10, 15 and Blueprint pp. 2–3, 6, 13–14, 17; companion DOCX text was read. `git diff --check` passed before this documentation update; 88 unique task IDs and the dashboard arithmetic reconcile. No cloud, billing, deployment, FX-provider, Gemini, Translation or production-data operation was performed. | Om-owned POs, models/SQL, glossary, plant inputs, production lots/feedback, demo lot and defect photos remain unavailable. Real service adapters and authorization remain prerequisites; source documents do not define a final trace/SSE event protocol. |

## 13. Decisions and blockers

- **Billing stays disabled until explicit approval.**
- No temporary mock implementations of integrations intended to be live.
- No fabricated production data, predictions, optimization, history,
  classifications, or successful tool traces.
- Om-dependent tasks stay blocked until actual inputs arrive.
- Live end-to-end testing occurs only after genuine integrations are wired.
- API enablement is not proof of service readiness.
- A route/schema is not proof of a working production capability.
- Cloud resources/API state in older tracker sections reflects earlier audit
  snapshots; Section 14 records the latest read-only verification and its
  inspection limitations.
- The Part 2 source documents are in the workspace sibling directory
  `../untracked_reference_docs/` (not tracked inside this repository). Resolve
  the actual paths before use; if unavailable in a future environment, record
  that fact and do not invent exact citations.
- No playbook requirement separately numbered “2.10 BigQuery seed” was found;
  the plant seed is covered under 2.9 and 2.10 is Pub/Sub.
- The only `[N/A]` item is a compiled build check: the project intentionally
  remains JavaScript and the playbook’s TypeScript compiler instructions are
  conditional on a future TypeScript migration.
- PDFKit is used for local rendering only. Licensed bundled Noto Sans fonts
  cover Devanagari, Japanese, Korean and Simplified Chinese for supplied
  JobSheets. Rendering is tested locally; it does not establish that a
  generated job card was uploaded to Cloud Storage.
- The playbook requires a per-IP limit but states no numerical threshold;
  implementation currently defaults to 60 requests per 60 seconds. It uses
  direct Node socket address and ignores forwarding headers. Behind Cloud Run,
  direct socket IP may identify the proxy, and in-memory counters do not span
  replicas; production-grade client IP and distributed limiting remain open.
- The 60-second server deadline returns a structured 504 and abort signal.
  Future integration adapters must observe the signal to stop underlying work.
- Cloud resources/API state referenced before the Phase 2 read-only snapshot
  were historical. Current verified facts and unverified/blocked resources are
  captured in Section 14; no cloud mutation was made during that inspection.

### Future Copilot session contract

"At the beginning of every future implementation session, read
docs/PART2_COMPLETION_TRACKER.md and inspect the relevant repository state.
Implement only the selected tasks. At the end of the session, update the same
tracker with the new status, evidence, changed files, test results and
remaining blockers. Do not create a competing tracker. Do not mark a task
VERIFIED COMPLETE without task-appropriate evidence. Preserve billing
restrictions and the direct-live-integration strategy. Do not repeat work
already verified unless new evidence indicates a regression."

## 14. Phase 2 — Google Cloud readiness snapshot (2026-10-11)

### Scope and safety

This was a read-only inspection of project `prepagent-hack`. Billing reports
`False`. No API was enabled; no IAM was changed; no resource, job, build,
translation, model inference or deployment was created or run. No seed/DML,
publisher or live API call was attempted. API activation is not assumed free
or permitted merely because API enablement and service usage can have different
billing behavior.

Classification key for this snapshot: **A** safe to complete without billing;
**B** requires billing/credits or cloud provisioning; **C** requires Om input;
**D** requires external access/permission; **E** explicitly deferred; **F**
already verified complete; **G** uncertain pending further service-specific
verification. Multiple labels describe separate parts of one tracker task.

### Live state and task classification

| Tracker ID | Class | Current evidence and exact blocker | Next action / authorization |
|---|---|---|---|
| P2-GCP-001 | F | Node v22.17.1, Git 2.54.0, gcloud 531.0.0 and bq 2.1.20 available. Active project is `prepagent-hack`; active account exists (identity not recorded). | None. |
| P2-GCP-002 | F | `env.sh` non-secret project, region, translation region, bucket and runtime identity match the tracker; Om setting matches the tracker identity. File is ignored by Git. | None; keep credentials out of the file. |
| P2-GCP-003 | E | Intended project exists and is active; billing state is `False`. | Keep billing disabled. Linking requires explicit user authorization. |
| P2-GCP-004 | B, E | ₹5,000 budget alert has not been created; billing is intentionally disabled. | Requires explicit user approval to change billing state and the required billing-account setup. |
| P2-GCP-005 | G, E | Enabled required APIs: BigQuery, Cloud Storage and Cloud Logging. Not enabled: Cloud Run, Cloud Build, Artifact Registry, Vertex AI, Pub/Sub, Dataflow, Translation and Compute. | Leave unchanged. Verify API-specific billing/prerequisites and obtain explicit authorization before enabling any API. |
| P2-GCP-006 | F | Project IAM policy confirms Om has project-level `roles/editor`; no direct Om dataset ACL was found. | None; no IAM change. |
| P2-GCP-007 | F | Runtime service account exists/enabled with `roles/aiplatform.user`, `roles/bigquery.dataEditor`, `roles/bigquery.jobUser`, `roles/cloudtranslate.user`, `roles/pubsub.publisher`, `roles/storage.objectAdmin`. Zero user-managed keys were listed. | None; do not create keys or alter roles. |
| P2-GCP-008 | G | Prior audit verified ADC; this session did not inspect token/credential material or confirm quota-project state. Installed CLI rejected the attempted `gcloud auth application-default get-quota-project` command as unsupported. | If necessary, use a documented supported method that does not print/expose credentials. |
| P2-GCP-009 | B | `gs://prepagent-hack-data` returned 404; Storage API is enabled. | Bucket creation was previously billing-blocked; do not retry without explicit authorization and service-specific cost review. |
| P2-GCP-010 | F, B | Dataset `prepagent` exists in `asia-south1`; five tables present. `lots` daily partitioned on `run_date`; `sensor_readings` daily partitioned on `ts`; `plants`, `job_sheets`, `feedback` unpartitioned. Plant seed remains unexecuted. | Preserve schemas. Seed/DML requires explicit authorization and confirmed query eligibility; do not retry. |
| P2-GCP-011 | B, G | Topic and subscription listings were empty; Pub/Sub API is not enabled. | API activation and resource creation require explicit authorization and service-specific billing/prerequisite review. |
| P2-GCP-012 | B, G | Dataflow API is not enabled; prerequisite bucket/topic absent; no default `compute@developer.gserviceaccount.com` identity appeared in the project service-account list. No Dataflow job launched. | Do not create identity, grant roles or launch the continuous job without explicit authorization and cost acceptance. |
| P2-GCP-013 | F, B | Local publisher statically requires the opt-in flag, intended project, billing enabled and Pub/Sub API enabled. No topic or publication. | Keep unrun until actual resources and authorized test window exist. |
| P2-GCP-014 | B | Vertex API is not enabled. Gemini test utility requires an explicit live-call flag, billing enabled, API enabled and model/location. No inference. | No API activation/model call without explicit authorization. |
| P2-GCP-015 | C, B, G | No glossary-named file exists in the repository; Translation API is not enabled. A live glossary listing could not be performed; manifest is not resource evidence. | Om must provide the actual CSV. API/glossary provisioning and translation tests require explicit authorization. |
| P2-GCP-016 | B, E | Cloud Run, Cloud Build and Artifact Registry APIs are not enabled. Build and service listings returned disabled-API errors/prompts; no deployment. Artifact Registry listing was denied because its API is disabled, so repository absence is not freshly verified. | Keep undeployed. API activation, build, repository and deployment require explicit authorization and a separate cost/security review. |
| P2-GCP-017 | G | Read-only checks refreshed known status; service-specific troubleshooting cannot verify resources behind disabled APIs. No blocked operation was retried. | Use the evidence above when an authorized setup proceeds; do not retry billing-blocked DML. |
| P2-GCP-018 | B, C | Local app exists; real PDF extraction, Om orders, Vertex/Storage setup and deployment remain incomplete. | Om sample orders and authorized cloud prerequisites; no live work now. |
| P2-GCP-019 | B, C | Local contracts/PDF exist; models, SQL, glossary, storage, sensor data, persistence and live workflow remain absent. | Om artifacts plus authorized cloud setup; no live work now. |
| P2-GCP-020 | B, C, E | Partial local UI exists; cloud integrations, Om data, localization and deployment are outstanding. Management view remains deferred until core workflow works. | Complete genuine workflow after required inputs and explicit cloud/deployment authorization. |
| P2-GCP-021 | E | Judging warm-up, streaming and operations are deferred; no services deployed/launched. | Revisit only after explicit deployment and cost authorization. |
| P2-GCP-022 | F | Fresh metadata confirms all five BigQuery table schemas and the partition fields above. | Preserve existing tables. |
| P2-GCP-023 | B, E | Plant seed SQL exists; no seed performed. Previous dry-run was blocked by billing restrictions. | Do not execute until explicitly authorized; do not retry in the no-billing state. |
| P2-GCP-024 | F | Non-secret environment values match intended project/regions/resources; `env.sh` ignored. | None. |
| P2-GCP-025 | B, G | Bucket returned 404; Pub/Sub list empty; API/resource status prevents treating manifests as provisioned resources. | Create only after explicit authorization and individual service cost/prerequisite verification. |
| P2-GCP-026 | G, D | Default Compute service-account identity not found; Compute API is not enabled. | Requires authorized API/prerequisite decision; do not create identity or grant roles speculatively. |
| P2-GCP-027 | G, D | Cloud Build and Artifact Registry APIs disabled. Build listing required disabled API; repository listing returned API-disabled permission error. | No build/API activation. Reinspect only after separately authorized setup. |
| P2-GCP-028 | B, C | Vertex and Translation APIs disabled; Om glossary absent. | Keep live calls off; obtain Om CSV and explicit service/API authorization. |
| P2-GCP-029 | B, G | Cloud Run API disabled; service listing could not verify whether a service exists. No deployment. | Do not deploy; inspect after explicit authorization to enable the API. |
| P2-GCP-030 | F, B | Static check confirms the Gemini tool is gated by explicit flag, billing and Vertex API; no live call. | Keep gated; live test only after explicit authorization. |
| P2-GCP-031 | F | Logging API enabled; only `_Required` and `_Default` sinks listed. | No changes needed. |

**Cross-workstream cloud blockers:** P2-APP-005, P2-APP-007–009,
P2-AI-001–008, P2-AI-011, P2-AI-013–017, P2-TEST-007–008 and
P2-DEPLOY-001 remain blocked/partial as described in Sections 5, 7 and 9.
They require combinations of missing services, explicit cloud authorization,
and Om-owned models/SQL/orders/glossary/photos; API or manifest presence alone
does not resolve them.

### Exact read-only CLI commands and results

No command below changed cloud state. Account identities, IAM principal
addresses, key identifiers and credential material are omitted from recorded
output.

| Exact command(s) | Result |
|---|---|
| `gcloud version`; `bq --version`; `node --version`; `git --version` | gcloud 531.0.0; bq 2.1.20; Node v22.17.1; Git 2.54.0. |
| `gcloud config get-value project`; `gcloud config get-value account`; `gcloud auth list --filter=status:ACTIVE --format='value(status)'` | Active project `prepagent-hack`; configured account and active account present. Identity intentionally redacted. |
| `gcloud billing projects describe prepagent-hack --format='value(billingEnabled)'` | `False`. |
| `gcloud services list --enabled --project=prepagent-hack --format='value(config.name)'` | Required APIs confirmed enabled: BigQuery, Storage, Logging. Cloud Run, Build, Artifact Registry, Vertex, Pub/Sub, Dataflow, Translation and Compute were not in the enabled list. |
| `gcloud projects get-iam-policy prepagent-hack --format=json` | Filtered locally without printing principal addresses: Om `roles/editor`; runtime account has the six roles listed above. |
| `gcloud iam service-accounts describe prepagent-run@prepagent-hack.iam.gserviceaccount.com --project=prepagent-hack --format='json(email,disabled)'` | Account exists; disabled field omitted by JSON output (false). |
| `gcloud iam service-accounts keys list --iam-account=prepagent-run@prepagent-hack.iam.gserviceaccount.com --project=prepagent-hack --managed-by=user --format='value(name)'`; same with `--managed-by=system` | Zero user-managed keys; one system-managed key. No identifiers printed. |
| `gcloud iam service-accounts list --project=prepagent-hack --format='value(email,disabled)'`; `gcloud iam service-accounts list --project=prepagent-hack --filter='email~compute@developer.gserviceaccount.com' --format='value(email)'` | Project service accounts inspected with addresses redacted; zero default Compute account matches. |
| `bq show --format=prettyjson prepagent-hack:prepagent`; `bq ls --format=prettyjson prepagent-hack:prepagent` | Dataset exists in `asia-south1`; five named tables present. |
| `bq show --format=json prepagent-hack:prepagent.plants`; same for `lots`, `sensor_readings`, `job_sheets`, `feedback` | Fields and types inspected; `lots` daily `run_date` and `sensor_readings` daily `ts` partitioning; others unpartitioned. No data query or DML. |
| `gcloud storage buckets describe gs://prepagent-hack-data --format='yaml(name,location,uniformBucketLevelAccess,iamConfiguration.uniformBucketLevelAccess)'` | 404, bucket absent. |
| `gcloud pubsub topics list --project=prepagent-hack --format='value(name)'`; `gcloud pubsub subscriptions list --project=prepagent-hack --format='value(name,topic)'` | No topic or subscription returned. Pub/Sub API is not enabled. |
| `gcloud builds list --project=prepagent-hack --limit=5 --format='value(id,status)'` | Cloud Build API disabled; CLI showed enable prompt/error. No enable accepted and no build run. |
| `gcloud artifacts repositories list --project=prepagent-hack --location=asia-south1 --format='value(name,format)'` | Artifact Registry API disabled; listing returned 403/API-disabled. Repository existence not established. |
| `gcloud run services list --project=prepagent-hack --region=asia-south1 --format='value(metadata.name,status.url)'` | Cloud Run API disabled; CLI showed enable prompt/error. No enable accepted and no service-list result. |
| `gcloud logging sinks list --project=prepagent-hack --format='value(name,destination)'` | `_Required` and `_Default` only. |
| `gcloud services describe run.googleapis.com --project=prepagent-hack --format='yaml(config.name,state)'`; `gcloud auth application-default get-quota-project` | Both returned “Invalid choice” with this installed CLI; no state change. ADC/quota status therefore not freshly verified. |

### Local configuration and gate checks

Read-only/local checks confirmed all nine `config/gcp-*.json` files parse and
use `prepagent-hack`; intended primary/Translation regions match the tracker.
The publisher requires explicit simulated-data opt-in, billing and Pub/Sub API;
the Gemini utility requires an explicit live-call flag, billing and Vertex API.
No glossary-named file was found in the repository, and `env.sh` is ignored by
Git. No local configuration changes were justified.

**Changes made:** `docs/PART2_COMPLETION_TRACKER.md` only. No app test suite was
run because this was a documentation-only update. `git diff --check` was run
after the update. No live integration is claimed.

## 15. Phase 3 — integration prerequisite gate (2026-10-11)

### Outcome

No live service integration was started. The first dependency-order item,
actual PDF order extraction (P2-AI-001), lacks Om's real PO test inputs, an
enabled Vertex AI API, and the intended Cloud Storage bucket. The next
candidate, BigQuery sensor conditions (P2-AI-002 / P2-APP-007), has an enabled
BigQuery API, existing dataset/table and documented runtime BigQuery roles,
but there is no configured plant ID, Pub/Sub/Dataflow resources are absent,
and this session did not establish that a BigQuery query is safe from charges
while billing is disabled. It would be unsafe to fabricate a `PLANT-01`
selection, assume readings exist, or issue a live query.

### Integration readiness by dependency order

| Step | Tracker IDs | Result | Missing prerequisite / safe next action |
|---|---|---|---|
| A. PDF order extraction | P2-AI-001, P2-APP-005 | **STOPPED — blocked** | Vertex API disabled; intended Storage bucket absent; Om anonymized POs absent. Obtain real samples and explicit service/billing authorization before adding SDK wiring or calling services. |
| B. BigQuery sensor conditions | P2-AI-002, P2-APP-007 | **STOPPED — blocked** | BigQuery API, dataset/table and service-account roles exist. However app/environment exposes no plant ID; sensor reading availability was not established; source Pub/Sub topic/subscription and Dataflow are absent; query cost under current billing state was not verified. Obtain approved plant-selection behavior, ingestion/data evidence and billing-safe authorization before implementing/running a query. |
| C–D. Risk models, optimization and evidence | P2-AI-003–006, P2-OM-001–004 | **STOPPED — blocked by Om** | Model identities, training/evaluation evidence, prediction SQL, optimizer objective/grid, explain/evidence SQL are absent. Do not invent models or queries. |
| E–I. Agent loop, trace/SSE, JobSheet, persistence, card upload, approval | P2-AI-007–014 | **STOPPED — upstream services not ready** | No live Gemini, Storage, BigQuery writer, model/optimizer/evidence chain or generated real JobSheet; Storage bucket absent. Work only after upstream real integrations and explicit service/deployment authorization. |
| J. Translation glossary | P2-AI-017, P2-GCP-015, P2-OM-005 | **STOPPED — Om and cloud blockers** | Om CSV absent; Translation API disabled and glossary/bucket not provisioned. Obtain CSV and explicit authorization before API/resource operations. |
| K. Photo diagnosis and feedback | P2-AI-015–016, P2-OM-010 | **STOPPED — Om and cloud blockers** | Actual consent-cleared labeled photos absent; Vertex disabled; Storage bucket absent; no BigQuery persistence integration. Wait for assets and authorization. |

### Exact prerequisite checks performed

| Read-only check | Result |
|---|---|
| `gcloud services list --enabled --project=prepagent-hack --filter="config.name=bigquery.googleapis.com"` (equivalent per-API filters for Storage, Vertex, Pub/Sub, Dataflow, Translation, Compute, Run, Cloud Build, Artifact Registry and Logging) | BigQuery, Storage and Logging enabled; Vertex, Pub/Sub, Dataflow, Translation, Compute, Run, Cloud Build and Artifact Registry not enabled. |
| `gcloud billing projects describe prepagent-hack --format='value(billingEnabled)'` | `False`; unchanged. |
| `bq show --format=json prepagent-hack:prepagent.sensor_readings` | Table exists in the previously verified `asia-south1` dataset; partition field `ts`. Metadata only; no row query. |
| `gcloud projects get-iam-policy prepagent-hack --format=json` (filtered locally to runtime identity) | Runtime service account has `roles/bigquery.dataEditor` and `roles/bigquery.jobUser` among its existing documented roles. No IAM changes. |
| `gcloud storage buckets describe gs://prepagent-hack-data --format='value(name)'` | 404, intended bucket absent. |
| Local `env.sh` variable-name inspection and repository search for plant selection | Variables are `PROJECT_ID`, `REGION`, `TR_REGION`, `BUCKET`, `SA`, `OM_EMAIL`; no plant ID variable or conditions-route plant parameter found. Values/secrets not printed. |
| Root `npm ls --depth=0` and tools dependency inventory | Root app has no Google Cloud SDK dependency. `tools/` has Pub/Sub and GenAI packages only; no BigQuery or Cloud Storage SDK. |
| Repository search for SQL/model/glossary artifacts | Only plant seed and proposed remediation SQL exist; no model/prediction/optimizer/evidence SQL or glossary file. The playbook/blueprint PDFs named in the tracker were absent from that audit's current reference directory. |

No SDK dependency was added because no integration passed the prerequisite
gate. A live query/test was not attempted; no cloud operation was run. Existing
unavailable ports remain in effect. API statuses are not interpreted as
service readiness or billing permission.

Correction recorded in Section 19: the source PDFs were subsequently located in
the workspace sibling `../untracked_reference_docs/` and inspected. The earlier
repository/reference-directory search did not establish their absence from the
workspace.

## 16. Phase 4 — production-preparation workflow verification (2026-10-11)

### Precise result

**The workflow did not start; it failed preflight before stage 1.** No agreed
demonstration purchase-order file is present in the workspace, and the
`POST /orders/extract` port has no live adapter and returns
`503 SERVICE_UNAVAILABLE`. Billing remains disabled. The actual demo input was
not fabricated or substituted with a test fixture. No production data was
uploaded, no job was created, and no claim of partial/end-to-end production
completion is made.

### Required sequence status

| Stage | Required operation | Phase 4 result | Evidence / blocker |
|---:|---|---|---|
| 1 | Upload genuine anonymized PO | **NOT RUN — preflight blocked** | No agreed demo PDF found in the workspace. The only PDF body used in automated tests is an explicitly synthetic route-test fixture. |
| 2 | Extract and validate order | **BLOCKED** | `POST /orders/extract` defaults to unavailable; tests assert `503 SERVICE_UNAVAILABLE`. No Storage bucket, Vertex API, or Om sample PO. |
| 3 | Retrieve actual production conditions | **BLOCKED** | `GET /conditions/current` defaults to unavailable; test asserts 503. No configured plant selection or verified sensor readings. |
| 4 | Run real risk predictions | **BLOCKED** | `POST /risk/predict` returns unavailable; no trained model identities or Om prediction SQL. |
| 5 | Run actual optimization | **BLOCKED** | `POST /risk/optimize` returns unavailable; no Om objective/grid/query. |
| 6 | Retrieve historical evidence | **BLOCKED** | No evidence query implementation or Om SQL/data; no real history result retrieved. |
| 7 | Execute seven Gemini tools through orchestration | **BLOCKED** | `/api/agents/*` helpers are local validation/unavailable surfaces; no live Gemini function-calling loop or tool registry. |
| 8 | Stream genuine tool events to UI | **BLOCKED** | Local SSE endpoint/client exists, but no genuine orchestrator produces events and no actual tool events have been streamed. |
| 9 | Generate validated JobSheet | **BLOCKED** | JobSheet schema/local PDF renderer exist, but no real upstream analysis or generated JobSheet. |
| 10 | Persist JobSheet to BigQuery | **BLOCKED** | Mapper exists; no BigQuery writer/reader or real JobSheet. |
| 11 | Generate print-ready PDF | **NOT RUN IN WORKFLOW** | Local renderer has a separate tested route for a caller-supplied JobSheet. No real JobSheet was available; rendering alone would not establish Storage upload. |
| 12 | Upload PDF to Cloud Storage | **BLOCKED** | No upload adapter; intended bucket is absent. |
| 13 | Execute approval workflow | **BLOCKED** | Approval route returns 503; no persisted job/state transition exists. |
| 14 | Display actual job-card/print result | **BLOCKED** | Card route returns 503; no uploaded object or genuine card URI exists. |
| 15 | Persist feedback and relevant notes | **BLOCKED** | Feedback route returns 503; no BigQuery persistence, Storage photo path or Translation integration. |

### Verification and scope

`node --test test/app.test.js`: **12 passed, 0 failed**. The test suite
confirms input validation, local PDF rendering for supplied test data, and
explicit unavailable responses for extraction, conditions, job creation,
approval, card retrieval and feedback. These tests are not a real workflow
run and do not verify any cloud write or production result. No cloud command,
upload, API call, billing change, deployment or application-code change was
made during this Phase 4 verification.

Only `docs/PART2_COMPLETION_TRACKER.md` changed. `git diff --check` passed.
End-to-end acceptance remains **0/1 verified**. Resume only after the agreed
anonymized demo PO and Om-owned production artifacts arrive, the required
services/resources are authorized and available, and the user explicitly
resolves the no-billing restriction for any operation requiring it.

## 17. Phase 5 — final acceptance and deployment readiness (2026-10-11)

### Full workflow acceptance

**FAIL / BLOCKED before stage 1; 0/15 workflow stages executed with a genuine
agreed demonstration input.** Workspace search found no PDF or agreed
sample-order artifact. No actual order was uploaded. This is consistent with
Phase 4 evidence; the test-suite PDF fixtures are synthetic test inputs and
were not used as customer/demo data. No live integration exists to continue
the sequence. There are no actual cloud response values against which to
compare the UI.

Stages 1–15 remain: PO upload and extraction **blocked** (no input, Storage
bucket or Vertex AI); conditions **blocked** (no configured plant/verified
readings); predictions, optimization and evidence **blocked** (no Om models or
queries); seven-tool execution and event streaming **not implemented**; real
JobSheet generation and BigQuery persistence **blocked**; local supplied-input
PDF rendering **implemented/tested only**, but not exercised in this workflow;
Storage upload, approval, card retrieval and feedback persistence **blocked**.
No operation was silently presented as successful, and no duplicate job could
be produced during this acceptance because no job-create adapter exists.
This is not end-to-end acceptance.

### Quality/security/deployment checks

| Check | Phase 5 result | Scope/limitations |
|---|---|---|
| `npm test` | **31 passed, 0 failed** | Offline schemas, routes, FX, PDF renderer, guardrails and explicit unavailable behavior; not live integration acceptance. |
| `node --test test/app.test.js` | **12 passed, 0 failed** | Local route behavior, including explicit 503 responses for unavailable extraction, conditions and job lifecycle endpoints. |
| `node --check index.mjs`; `node --check` across `src/*.js`, `test/*.js`, `test/fixtures/*.js`, `tools/*.mjs` | **Passed** | JavaScript syntax only. |
| JSON parse: `package.json`, `package-lock.json`, all `config/*.json` | **Passed** | Deployment manifests use intended project and regions (`prepagent-hack`, `asia-south1`, Translation `us-central1`). |
| Build check | **Not applicable/configured** | Existing JavaScript project has no build script; do not migrate to TypeScript to manufacture a build step. |
| `npm audit` | **0 vulnerabilities** | Local dependency advisory check; does not establish deployed security. |
| Credential/environment scan | **Passed** | No common private-key/API-key/OAuth-token patterns detected in scanned repository files; no environment/credential filename tracked. This does not replace a dedicated secret-history scan. |
| `git diff --check` | **Passed** | Tracker update whitespace only. |
| IAM/region review | **Read-only evidence from Phase 2 retained** | Runtime SA has documented roles; no speculative IAM changes. Manifests’ project/region values passed local consistency check. |
| Live integration / real-data E2E | **Not run / blocked** | Billing `False`; APIs/resources and Om inputs absent. No query, upload, model/Translation call, build, job, or deployment was made. |

No user-facing success state was introduced in this phase. Current routes use
explicit unavailable results when cloud ports are unconfigured. The real
workflow still has no idempotency/deduplication guarantee; duplicate-job
prevention must be implemented and tested with a real persistence design before
enabling job creation.

### Deployment gate and judging readiness

**Deployment: NOT AUTHORIZED and NOT PERFORMED.** Billing remains disabled.
Cloud Run, Cloud Build and Artifact Registry APIs are disabled; the intended
Storage bucket and Pub/Sub resources are absent; app cloud ports remain
unconfigured; public access/security review and real end-to-end acceptance are
outstanding. No public service was exposed.

**Judging readiness: NOT READY for the promised production-preparation demo.**
The application can demonstrate its local UI, validation, unavailable states,
and local PDF rendering only when supplied a valid JobSheet input. It cannot
demonstrate the required PO-to-feedback workflow or show genuine production
conditions, predictions, recommendations, evidence, job persistence, uploaded
card, approval, or feedback.

Next prerequisites: agreed anonymized PO/demo fixtures and Om artifacts
(P2-OM-001–010); explicit billing/API/resource decisions
(P2-GCP-003–016, P2-GCP-023–030); actual integrations and duplicate protection
(P2-AI-001–017); then end-to-end evidence (P2-TEST-007–008). Deployment and
judging operations remain deferred pending explicit authorization
(P2-GCP-021, P2-DEPLOY-001).

## 18. Focused partial-task sprint (2026-10-10)

### Scope and frozen work

At sprint start, all 19 requested IDs were confirmed as partially complete.
Their evidence was reconciled without repeating cloud inspection. The 21
previously verified-complete tasks remain frozen and unchanged:
P2-GCP-001, 002, 006, 007, 008, 022, 024, 031; P2-APP-001, 002, 003, 004,
006, 010; P2-GUARD-002; and P2-TEST-001–006. No implementation, criteria,
status, or historical evidence for those tasks was changed.

### Exactly 19 requested task outcomes

| ID | Starting status | Sprint result | Evidence, blocker and next action |
|---|---|---|---|
| P2-GCP-003 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Billing remains disabled per the historical read-only snapshot; no GCP calls or billing changes this sprint. Require explicit user authorization before changing billing. |
| P2-GCP-005 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Required-API state remains the historical snapshot in Sections 6 and 14. No API activation was attempted. Verify API-specific prerequisites and obtain explicit authorization before any activation. |
| P2-GCP-010 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Historical schema/partition verification remains; plant seed/DML was not retried. Seed remains blocked until query billing eligibility and explicit authorization. |
| P2-GCP-013 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Offline cloud-tool gate tests passed with default opt-in disabled; no publisher or cloud command was run. Do not publish without the actual resources and authorized test window. |
| P2-GCP-017 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Added an API-to-capability map and safe diagnostic/stop guidance to `docs/CLOUD_INTEGRATION_TODO.md`. No fresh cloud state was obtained; disabled-API resource uncertainty remains. |
| P2-GCP-018 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Local app and PDF renderer exist, but actual PDF extraction, agreed real PO, Vertex/Storage integration and deployment remain unavailable. Requires real input, cloud prerequisites and authorization. |
| P2-GCP-019 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | The local PDF renderer is now verified under P2-AI-012. Model/optimizer/evidence SQL, Gemini orchestration/SSE, persistence and the genuine `/jobs` workflow remain incomplete. |
| P2-GCP-020 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Responsive local operator UI was browser-checked. Trace, full workflow, real integrations, approval, feedback, translation and deployment remain unavailable. |
| P2-GCP-023 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Seed SQL remains unexecuted; the prior billing/DML rejection stands. No retry, query, dry-run or mutation occurred. Wait for confirmed eligibility and explicit authorization. |
| P2-GCP-025 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Bucket and Pub/Sub absence are based only on prior read-only evidence; no resource creation or new cloud call. Provision only after explicit authorization and service-specific cost review. |
| P2-GCP-027 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Cloud Build and Artifact Registry APIs remain disabled in the historical snapshot. No build/repository creation; disabled-API listing failures do not prove repository absence. |
| P2-GCP-028 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | No Vertex or Translation call/API activation. Om’s glossary CSV remains absent; model and glossary prerequisites plus authorization are outstanding. |
| P2-GCP-029 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | No Cloud Run API activation or deployment. Disabled-API listing failure does not prove service absence; deployment remains unauthorized. |
| P2-GCP-030 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Offline test confirms Gemini utility refuses default execution without explicit opt-in. No live inference or cloud preflight occurred. Keep gated pending authorization and prerequisites. |
| P2-AI-012 | PARTIALLY COMPLETE | VERIFIED COMPLETE (local renderer only) | Bundled OFL-licensed Noto Sans fonts render Devanagari, Japanese, Korean and Simplified Chinese. Tests cover PDF structure/content, optional fields, units, true supplied approval state, invalid input, missing-font overrides and pagination. Quick Look visually rendered a synthetic test fixture in all four scripts; live route returned a valid PDF. No Storage upload or production JobSheet was used. Storage remains separate under P2-AI-013. |
| P2-UI-001 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Real status/conditions API responses and a local test-fixture PDF result were browser-checked; the UI states no save/upload and does not prefill production values. Cloud-backed trace and complete operator workflow are still unavailable. |
| P2-UI-006 | PARTIALLY COMPLETE | VERIFIED COMPLETE (local responsive layout) | Browser confirmed no horizontal overflow at 320, 390, 768, 1024 and 1440px, mobile single-column layout, desktop presentation and visible keyboard focus. This does not establish cloud/deployed usability. |
| P2-UI-007 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Actual conditions 503 and successful local PDF result were shown honestly; route/error tests passed. Full browser coverage of retry, network failure and all error states plus live services remains. |
| P2-GUARD-001 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Tests cover the default 60/60 limit, spoofed forwarding header handling, bounded client tracking, downstream failure and health exemption. Direct-socket in-memory limiting is not proxy/replica-safe; deployment requires a trusted-proxy and shared-limiter design. |

### Verification record

| Check | Actual result |
|---|---|
| `cd /Users/siddhant/prepagent-work/prepagent && npm test` | **45 passed, 0 failed**. An initial invocation from the parent workspace failed because it has no `package.json`; rerun from the project root succeeded. |
| `node --test test/job-sheet-pdf.test.js test/app.test.js` | **24 passed, 0 failed** (20 top-level tests plus 4 script subtests). |
| `node --check` for changed renderer, UI, guardrail and relevant test files | Passed. |
| `git diff --check` | Passed. |
| Browser acceptance at 320/390/768/1024/1440px | No horizontal overflow. At 390px the main grid is single-column; Tab reaches “Load status” with visible focus outline. |
| Local browser/API | `/api/status` returned 200; `/conditions/current` returned 503 with an explicit unavailable message. Local test-fixture PDF route returned `200 application/pdf` with `%PDF-1.3`; it displayed all bundled scripts. |
| Cloud operations/live integration | None. No gcloud/bq commands, API activation, seed/query, publisher, model/Translation call, resource creation, deployment or Storage upload. Historical cloud state was not refreshed. |

The full production workflow remains unverified and judging readiness remains
blocked. Genuine PO/Om artifacts and explicit cloud/billing decisions are
still required; the successful local PDF/UI checks are not cloud integration
evidence.

## 19. Focused 17-task source-backed sprint (2026-10-11)

### Scope and source review

Reviewed this tracker first, then the playbook PDF/DOCX and blueprint PDF at
`../untracked_reference_docs/`. Cross-checked API/resource setup, BigQuery
tables/partitions, sensor publishing, troubleshooting, the seven Gemini
tools/SSE, operator UI, Noto script fonts, and workflow done criteria.
Inspected the implementation and tests for the 17 requested IDs. Fixed PDF
object-URL cleanup when a rerender fails and asserted hidden-link CSS. The 21
frozen verified task records were not changed. No cloud command, query, API
activation, publisher, live model/translation call, upload, resource mutation,
or deployment was performed. The source documents remain outside the Git
repository.

### Exact 17-task disposition

| ID | Current disposition | Evidence, blocker and next action |
|---|---|---|
| P2-GCP-003 | `[D] DEFERRED BY EXPLICIT DECISION` | The existing project and billing are separate facts; historical CLI evidence records project `prepagent-hack` exists while `billingEnabled=False`. Billing remains disabled by explicit decision. To revisit, user must authorize billing state change; no billing command was run now. |
| P2-GCP-005 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Local API/capability map and manifest checks are not proof of enabled APIs. Historical Phase 2 snapshot had some required APIs disabled; no fresh CLI check or activation occurred. Next: after explicit authorization, perform read-only per-API checks then separately authorize any activation. |
| P2-GCP-010 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Historical metadata records five schemas/partitioning; playbook seed SQL was not executed. Prior DML dry-run was billing-blocked; no query or dry-run was retried. Next: obtain confirmed query eligibility and explicit authorization, then execute and verify seed separately. |
| P2-GCP-013 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Publisher's explicit opt-in/default refusal is covered by offline gate test; that does not prove publishing. No topic creation or publication. Next: after authorization, verify resources/API and run a bounded genuine message-to-BigQuery test. |
| P2-GCP-017 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Consulted playbook §2.16/blueprint and documented safe diagnostics; no cloud-side diagnosis or resource refresh. Next: after cloud access/authorization, apply relevant diagnostic and independently verify the actual service/resource. |
| P2-GCP-018 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` (also external-input blocker) | Added local PDF signature validation in `index.mjs`; `test/app.test.js` verifies MIME spoof rejection and existing valid-PDF-to-503 unavailable behavior. PDF extraction/Vertex/Storage remain unavailable and Om's agreed PO set is absent. Next: obtain approved POs and service/API/billing authorization before wiring/testing real extraction. |
| P2-GCP-019 | `[B] BLOCKED BY EXTERNAL DEPENDENCY` (cloud authorization is also required) | Local contracts/helpers exist but no Om model identities, risk/optimizer/evidence SQL or glossary was supplied; live services are unavailable. Next: obtain P2-OM-001–005 artifacts, then request cloud authorization and implement the genuine integration sequence. |
| P2-GCP-020 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` (genuine demo inputs also needed) | Local UI is responsive and states limitations honestly; the required live trace, risk/evidence, workflow, feedback and deployed demonstration cannot proceed without genuine endpoints. Next: authorize/provision services and obtain Om demo inputs, then connect and accept against actual responses. |
| P2-GCP-023 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Static seed SQL/gate inspected; no DML, query or blocked dry-run performed. Next: only after query billing eligibility and explicit authorization, execute then read-only verify the seeded row. |
| P2-GCP-025 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Local intended-resource config was checked; earlier 404/disabled-API results are historical and not current absence proof. No resource or API mutation. Next: after explicit authorization, inspect API state then independently inspect/create only specified resources. |
| P2-GCP-027 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Local package has no build script; offline tests/syntax/config checks pass but do not verify Cloud Build or Artifact Registry. No API activation/build/repository creation. Next: after explicit authorization, inspect actual service/repository state and run an authorized cloud build only if prerequisites permit. |
| P2-GCP-028 | `[B] BLOCKED BY EXTERNAL DEPENDENCY` (cloud access is also required) | Local Vertex/Gemini execution gate was tested; no live inference/translation. Om's model artifacts and glossary CSV are missing, and API/resource state is only historical. Next: obtain actual artifacts, then explicit API/cloud authorization and live integration evidence. |
| P2-GCP-029 | `[D] DEFERRED BY EXPLICIT DECISION` | Deployment/public exposure is expressly prohibited; no deployment or API activation. Prior disabled-API listing failure does not establish whether a service exists. Next: revisit only after explicit deployment/billing authorization and readiness/security approval, then inspect service state. |
| P2-GCP-030 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Offline test verifies the Gemini utility refuses execution without explicit live-call authorization; it does not prove model availability. No live call. Next: after prerequisites and separate authorization, conduct a controlled genuine model test. |
| P2-UI-001 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` (genuine Om demo inputs are also needed) | Updated PDF copy and signature validation; browser-checked the local operator surface. No fabricated values/traces/jobs. Live trace, what-if outputs, approval, feedback and workflow controls require genuine endpoints and inputs. Files: `src/operator-ui.js`, `index.mjs`, `test/app.test.js`. Next: retain the honest local UI; wire controls only after services and Om inputs are available. |
| P2-UI-007 | `[✓] VERIFIED COMPLETE` for local error/loading/unavailable behavior | Browser-verified malformed form input, actual local conditions `503`, intercepted network abort with Retry, local test-only PDF success, and intercepted PDF error clearing/hiding the prior link. Route tests cover error/unavailable/429 behavior. Files: `src/operator-ui.js`, `test/app.test.js`. Live service reliability remains unverified and is not claimed by this UI-state task. |
| P2-GUARD-001 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Added exact-window-boundary test in `test/request-guardrails.test.js`; tests cover bounded map, capacity, socket IP, spoofed forwarding headers and health exemption. Current limiter is per-process and direct-socket only; proxy client-IP trust and shared state needed for deployment are not configured/authorized. Next: define trusted-proxy and shared-store deployment design before production. |

**Primary outcomes across these 17 tasks:** 1 verified complete, 0 partially
complete, 2 blocked by external dependency, 12 blocked by billing/cloud access,
2 deferred by explicit decision, and 0 not started. External-input and
cloud-access blockers overlap for P2-GCP-018/019/028 and P2-GCP-020/P2-UI-001;
the listed counts use one primary status per task.

### Validation performed

| Command/check | Result |
|---|---|
| `cd prepagent && npm test` | **46 passed, 0 failed** (Node test runner, including subtests). |
| `cd prepagent && node --test test/request-guardrails.test.js` | **8 passed, 0 failed**, including the exact fixed-window reset-boundary regression. |
| `cd prepagent && for file in index.mjs src/*.js test/*.js test/fixtures/*.js tools/*.mjs; do node --check "$file" || exit 1; done` | Passed. |
| JSON parse for `package.json`, `package-lock.json`, and all `config/*.json` | Passed. |
| `git -C /Users/siddhant/prepagent-work/prepagent diff --check` and direct trailing-whitespace/final-newline check on the primary tracker | Passed. |
| `cd prepagent && node --test test/app.test.js test/request-guardrails.test.js` | **21 passed, 0 failed**; initial parallel invocation collided on the test harness's fixed port 4100, then passed when rerun sequentially. |
| Changed-scope credential-pattern scan | Passed; no common private-key, Google, OAuth, AWS, or API-key patterns found in the reviewed source/test/tracker files. |
| Local browser acceptance evidence | At 320/390/768/1024/1440px there was no horizontal overflow. `/api/status` returned 200; conditions displayed its actual 503 and a manual Retry repeated the request without success-shaped output. Malformed JSON showed validation feedback; intercepted network abort exposed a safe message and Retry; a held request displayed Loading, disabled control and `aria-busy=true` (the harness did not resolve that delay cleanly, so delayed recovery is not claimed); a local render from a synthetic test fixture explicitly stated no record/upload, and the following intercepted PDF error hid/cleared the stale link without exposing a test diagnostic. Intercepted responses were test-only, not production inputs. |
| Cloud/live workflow | Not run. No cloud calls, billing changes, resource changes, live integrations or deployment. |

Initial test/syntax/JSON invocations were mistakenly run from the workspace
parent and failed because the project files are under `prepagent/`; the checks
above were rerun successfully from the project root. This was a command
location error, not a source/test failure.

**Conclusion:** this sprint completes the local UI error-state task and
records the remaining tasks as blocked or explicitly deferred where no safe
local work remains. It does not establish end-to-end acceptance. Billing
remains disabled, live workflow acceptance remains 0/1, and judging readiness
remains **NOT READY**.

## 20. Five initially not-started task review (2026-10-11)

### Authoritative source requirements reviewed

- Blueprint PDF and playbook PDF were fully text-extracted for review; the
  companion playbook DOCX was also read and cross-checked for the relevant
  requirements. All three source files were accessible in
  `../untracked_reference_docs/`.
- Blueprint pp. 5–6 describe the agent/operator flow and supervisor approval;
  pp. 13–14 specify the seven tool contracts and `/jobs`, approval, and card
  endpoints; p. 2 requires the tool trace to be visible as actual calls happen;
  p. 17 specifies locale/currency preferences and a dated, ECB-based FX source
  with a static fallback.
- Playbook p. 9 requires SSE delivery of each actual Gemini tool call to the
  trace panel and specifies the seven tool names. Its Day 3 UI requirement
  orders upload → trace → risk/evidence/what-if → approve/print, lists exactly
  seven languages and eleven currencies, and requires glossary-backed risk/job
  card text plus locale JSON labels. Playbook p. 15 QA calls for `≈` and the
  FX rate date.
- Neither source defines a trace event payload, SSE event names, execution ID,
  or cancellation/disconnect lifecycle. Those details are not inferred here.

### Selected task outcomes and acceptance evidence

| ID | Status after review | Implemented / verified locally | Remaining acceptance and dependency |
|---|---|---|---|
| P2-UI-002 | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | Five stage guide and local forms are present; upload and analysis routes return honest unavailable responses; no `what-if` slider, actual job run, approval or workflow-print path is connected. The supplied-JobSheet renderer is separate. | Requires Om-approved PO(s), genuine extraction/conditions/risk/optimization/evidence/orchestration services, job persistence, approval and stored card paths; Cloud Storage/Gemini/BigQuery authorization also remains unavailable. No end-to-end acceptance. |
| P2-UI-003 | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | Seven locale JSON files and allow-listed route now serve the existing static interface translations. Tests verify key/locale coverage, fallback and route content. Static labels are not represented as glossary translations. | Requires Om glossary CSV/approved terminology, Translation integration, per-job/language production-result cache and QA of actual risk/job-card strings. Some explanatory UI text is still English. |
| P2-UI-004 | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | Eleven currencies, 24-hour provider cache/static fallback, display-only formatting with `≈` and rate date, and path selection for locally defined risk/optimization/JobSheet shapes are implemented and unit-tested. No result is mutated. | Genuine successful production service responses and an authorized real provider-rate check are unavailable. The dated fallback is not current-rate evidence; no FX provider call was made in this audit. |
| P2-AI-009 | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | Bounded local registry lifecycle and validation tests pass; it is not called by a Gemini runner or application run. Production search found no P2-AI-008 function-calling orchestrator. | Requires real runner/tool execution plus Om order/model/SQL inputs and cloud service access. Event names/payload/lifecycle are not defined in source; local inferred schema is not asserted as source contract or genuine execution. |
| P2-AI-010 | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | Bounded SSE route and EventSource subscription UI exist; local tests cover replay, replay/live deduplication, queue overflow signaling, validation and disconnect cleanup. No run ID or production event comes from orchestration. | Requires a genuine P2-AI-008 runner and P2-AI-009 event producer. Wire event names/payload/IDs/cancellation lifecycle are undocumented in sources and must be aligned against the actual runner; no production streaming acceptance. |

### Validation and safety

- `npm test`: 66 passed, 0 failed. Focused
  `node --test test/localization.test.js test/app.test.js test/money-contracts.test.js test/display-currency.test.js test/trace-registry.test.js test/trace-routes.test.js`:
  33 passed, 0 failed.
- `node --check` passed for `index.mjs`, all `src/*.js`, `test/*.js`,
  `test/fixtures/*.js`, and `tools/*.mjs`; package/config/seven-locale JSON
  parsing and `git diff --check` passed. Tracker inventory/status reconciliation
  found 88 unique IDs and matched the revised totals.
- The shared browser tab at `localhost:4392` rendered an older local UI with
  test-only fixture content and stale copy; it did not match the current
  `src/operator-ui.js` or current route-test output and was not treated as
  current-worktree acceptance evidence. The existing server was not changed.
- Display-currency fixture tests are protocol/unit tests only; no external FX
  endpoint was contacted. Locale JSON preserves the pre-existing static
  dictionary and adds three ordinary request-field labels as static UI text;
  none is represented as glossary output, and none has native-speaker QA.
  UI Translation service, Gemini, Vertex, BigQuery, Storage, production SSE
  traces and workflow acceptance were not tested or represented as working.
- Billing remained disabled. No API was enabled, no cloud resource was
  created/modified, no production data was uploaded, no live production call
  was made, and no deployment occurred.
