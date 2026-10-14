# Ustaad AI — Part 2 Completion Tracker

> **This is the single authoritative Part 2 tracker.** Future sessions must
> update this file rather than create another checklist. End-to-end Part 2
> completion has **not** been verified.

## 1. Project header and current state

| Field | Current value |
|---|---|
| Project | Ustaad AI — Corrugated Production-Prep Agent |
| Hackathon | Google AI Builder Cup 2026 |
| Primary playbook | `../../docs/Prep_Agent_3-Day_Sprint_Playbook.pdf`; companion DOCX: `../../docs/Prep_Agent_3-Day_Sprint_Playbook.docx` |
| Blueprint | `../../docs/Corrugated Production-Prep Agent — Build Blueprint 3.pdf` |
| GCP project ID | `prepagent-hack` |
| Primary region | `asia-south1` (Mumbai) |
| Translation glossary region | `us-central1` |
| BigQuery dataset | `prepagent` |
| Intended data bucket | `gs://prepagent-hack-data` |
| Intended Cloud Run service | `prepagent` |
| Runtime service account | `prepagent-run@prepagent-hack.iam.gserviceaccount.com` |
| Billing | **Enabled for `prepagent-hack` per latest verified evidence (2026-10-11). This is a state record, not authorization for additional cloud operations or paid services.** |
| Implementation strategy | Connect directly to genuine cloud services. Do not build temporary cloud mocks or fabricate production results. |
| Last tracker update | 2026-10-14 |
| Latest audit evidence | Section 60 records historical private Cloud Run and route verification. Section 71 records the locally implemented/offline-tested Impact screen and the current full-suite result; the deployed revision has not been updated or rechecked for this screen. |

**Warning:** A local health response, schema, route, manifest, or passing
offline test does not establish live service readiness. The purchase-order to
job-sheet workflow and judging acceptance remain unverified.

### Non-negotiable decisions

1. **Current execution authorization (2026-10-12).** The user authorized
   implementation and necessary GCP setup/integration for the remaining Part 2
   work, with the existing $300 credit kept in mind and avoidable paid calls
   skipped. Billing is already enabled; do not link another account or
   activate another trial. Use live operations only when required to verify a
   criterion, and avoid duplicate calls/writes. Cloud Run deployment remains
   reserved for the final stage; no public exposure is authorized by that
   timing decision alone. Do not retry Dataflow until read-only preflight
   evidence shows the prior capacity issue has changed.

2. **Direct live integration strategy.** Do not create temporary substitutes
   for Gemini, Vertex AI, BigQuery, Cloud Storage, Pub/Sub, Dataflow,
   Translation, production risk, optimization, evidence, or classification.

3. **No fabricated production inputs or outputs.** The 2026-10-14 handoff
   supplied optimizer/explanation/evidence/dashboard SQL and synthetic PO test
   fixtures. The SQL is copied to the app's canonical `sql/` path; original
   reference assets remain outside the app repository and are ignored by the
   workspace repository. The five-PO extraction/UI contract, glossary,
   approved photo provenance, and full workflow acceptance remain incomplete.

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
| `IMPLEMENTED` | The specified local behavior is present; this alone does not establish test or acceptance evidence. |
| `OFFLINE TESTED` | Relevant local/injected-adapter tests pass; this does not establish live service behavior. |
| `ACCEPTANCE VERIFIED` | The defined acceptance criteria have been demonstrated with the required inputs and evidence. |
| `LIVE VERIFIED` | Current behavior has been verified against the real service under separate authorization. |
| `BLOCKED BY EXTERNAL INPUT` | A required authoritative input, decision, or artifact is missing. |
| `BLOCKED BY AUTHORIZATION` | A required live/cloud operation is not authorized or available. |

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

The inventory has **21 official playbook requirement tasks** and **68
audit-derived subtasks**, for **89 tracked tasks**. “Audit-derived subtask”
means it decomposes an official requirement or a concrete gap found in the
repository audit; it is not represented as a separately numbered playbook
requirement.

| Workstream | Total tracked | Verified complete | In progress | Partially complete | Blocked by external dependency | Blocked by billing/cloud access | Deferred | Not started | Not applicable | Completion |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Official Part 2 requirements | 21 | 12 | 0 | 5 | 2 | 1 | 1 | 0 | 0 | 12/21 = 57.1% |
| GCP audit-derived subtasks | 10 | 8 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 8/10 = 80.0% |
| Backend/application audit subtasks | 10 | 7 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 7/10 = 70.0% |
| AI/production-workflow audit subtasks | 17 | 2 | 0 | 9 | 6 | 0 | 0 | 0 | 0 | 2/17 = 11.8% |
| UI/localization audit subtasks | 8 | 2 | 0 | 3 | 3 | 0 | 0 | 0 | 0 | 2/8 = 25.0% |
| Om/external handoffs | 10 | 1 | 0 | 1 | 8 | 0 | 0 | 0 | 0 | 1/10 = 10.0% |
| Testing/build/deployment acceptance subtasks | 10 | 6 | 0 | 0 | 0 | 2 | 1 | 0 | 1 | 6/9 = 66.7% |
| API guardrail audit subtasks | 3 | 1 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 1/3 = 33.3% |
| **Total** | **89** | **39** | **0** | **24** | **20** | **3** | **2** | **0** | **1** | **39/88 = 44.3%** |

**Formula:** verified complete ÷ applicable tracked tasks; the one `[N/A]`
task is excluded from the denominator. Blocked, deferred, partial, and
not-started tasks count as incomplete.
Status columns count each task once by its primary status. Secondary blockers
(for example, both Om input and cloud authorization) can overlap and are
recorded in the task notes; they are not additional primary-status counts.

**Separate live end-to-end measure:** **0/1 verified (0%)**. The workflow
components are partially implemented and the SQL has live query evidence, but
the purchase-order-to-approved-job-card path is not live-verified; offline
tests do not substitute for live integration acceptance.

## 4. Official Part 2 requirement traceability and active sequence

The subsection numbering below follows Part 2 of the supplied playbook. In
particular, the plant seed belongs to subsection **2.9**; subsection **2.10**
is Pub/Sub, not a separately invented seed subsection. P2-GCP-010 is now
verified complete from the Playbook's exact seed specification and a current
read-only row inspection; the earlier external-blocker history is preserved
in the reconciliation log.

| ID | Exact playbook source | Official requirement summary | Evidence / current status | Blocker | Next action | Dependencies | Verification criteria |
|---|---|---|---|---|---|---|---|
| P2-GCP-001 | 2.0 Before you start | Install/use Google Cloud CLI, Node 20+, Git; initialize and check versions. | `[✓] VERIFIED COMPLETE` — rechecked 2026-10-11: Node v22.17.1, Git 2.54.0, Google Cloud SDK 531.0.0, bq 2.1.20; active project is `prepagent-hack` and an account is active (identity withheld). | None known. | Recheck only if local environment changes. | Google account / local tools. | CLI version, Node >=20, Git and intended account available without exposing credentials. |
| P2-GCP-002 | 2.1 Save your variables | Keep project ID, Mumbai/translation regions, bucket, runtime SA and Om email in `env.sh`. | `[✓] VERIFIED COMPLETE` — rechecked non-secret settings: `prepagent-hack`, `asia-south1`, `us-central1`, `prepagent-hack-data`, and `prepagent-run@prepagent-hack.iam.gserviceaccount.com`; Om setting matches the tracker identity without echoing it. `env.sh` is Git-ignored. | None known. | Keep both copies aligned; never store secrets there. | None. | Safe variable inspection shows exact intended non-secret values; `git check-ignore env.sh`. |
| P2-GCP-003 | 2.2 Create project and link billing | Use one project and link billing as the playbook directs. | `[✓] VERIFIED COMPLETE` — latest verified evidence confirms billing is enabled for project `prepagent-hack`. Earlier audit snapshots reported it disabled; those are historical and superseded. | None for the billing-link requirement. | No billing change requested. Treat this as state verification only; obtain separate explicit authorization before any additional cloud operation. | Project access; no additional account or paid service is implied. | Project billing state independently verified as enabled. |
| P2-GCP-004 | 2.3 Set a budget alert | Create project-only ₹5,000/month budget with 50%, 90%, 100% email alerts. | `[✓] VERIFIED COMPLETE` — persisted GCP resource `billingAccounts/014B62-B6BC57-970DC2/budgets/13af65ec-769e-4f30-b11f-a6b0f3bceba6` verified as INR 5000 per `MONTH`, filtered to `projects/514663464609` (project `prepagent-hack`), with `INCLUDE_ALL_CREDITS`, display name `Ustaad AI ₹5,000 Monthly Budget Alert`, and `CURRENT_SPEND` threshold rules at 50%, 90%, and 100%. Enabled email notification channel `projects/prepagent-hack/notificationChannels/10383981165555622714` has recipient label [`aibuildercup2026@gmail.com`](mailto:aibuildercup2026@gmail.com). Actual email delivery/inbox receipt has not been tested. A budget alert is a notification mechanism, not a spending cap. | No configuration blocker remains; delivery has not been tested. | No further change requested. Do not treat alert thresholds as a spending cap. | Persisted budget resource confirms amount, monthly period, project filter, credit treatment, thresholds and enabled email channel/recipient label; inbox delivery is unverified. |
| P2-GCP-005 | 2.4 Enable APIs | Enable the playbook’s Run, Build, Artifact Registry, Vertex, BigQuery, Storage, Pub/Sub, Dataflow, Translation, Compute and Logging APIs. | `[✓] VERIFIED COMPLETE` — API enablement operation succeeded. Subsequent verification with `gcloud services list --enabled --project=prepagent-hack` returned all eleven APIs required by the Playbook in state `ENABLED`: `run.googleapis.com`, `cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`, `aiplatform.googleapis.com`, `bigquery.googleapis.com`, `storage.googleapis.com`, `pubsub.googleapis.com`, `dataflow.googleapis.com`, `translate.googleapis.com`, `compute.googleapis.com`, and `logging.googleapis.com`. | API enablement is complete; no deployments, builds, Dataflow jobs, model calls, or other service executions were performed. | No further API enablement action for this item. Service-specific resources and execution remain separate acceptance tasks. | Successful enablement operation and subsequent enabled-services listing for project `prepagent-hack`; no service execution is claimed. |
| P2-GCP-006 | 2.5 Give Om access | Provide Om project-level `roles/owner` access, per the user's confirmed change to the requirement. | `[✓] VERIFIED COMPLETE` — the user explicitly confirmed that Om's intended and current project role is `roles/owner` and personally verified the current state. No fresh IAM audit or CLI verification was performed in this update. The Build Blueprint and 3-Day Sprint Playbook still specify `roles/editor`; those documents have not been updated to reflect this decision. | No tracker-item blocker under the user-confirmed requirement. Source documents remain inconsistent with the changed requirement. | No IAM change requested. Update the Blueprint and Playbook separately if their requirements are to reflect this decision. | User-confirmed current Owner-role state and explicit changed requirement; no new independent verification performed. |
| P2-GCP-007 | 2.6 Create Cloud Run service account | Create `prepagent-run`; grant six documented runtime roles; no key files. | `[✓] VERIFIED COMPLETE` — account exists and is enabled; all six documented roles are bound. Read-only key listing found zero user-managed keys; no key material was printed. | Cloud workloads still unavailable. | Preserve keyless workload identity; do not change IAM speculatively. | Project access. | Account exists and all six role bindings are visible; no user-managed keys. |
| P2-GCP-008 | 2.7 Local credentials | Configure Application Default Credentials and quota project for local scripts. | `[✓] VERIFIED COMPLETE` — prior audit verified ADC without printing a token. Active gcloud account is present now; ADC/quota project was not freshly rechecked. The attempted `gcloud auth application-default get-quota-project` command is unsupported by this installed CLI. | Current ADC/quota state not freshly established. | If needed, verify later using a supported token-safe method; never print a token or inspect credential files. | User Google authentication. | ADC can be checked without outputting credentials; project quota config is correct. |
| P2-GCP-009 | 2.8 Cloud Storage bucket | Create Mumbai bucket with uniform bucket-level access; use documented prefixes. | `[✓] VERIFIED COMPLETE` — read-only `gcloud storage buckets describe` and authenticated Storage API response confirmed `gs://prepagent-hack-data` belongs to project `prepagent-hack` (project number `514663464609`), is regional in `ASIA-SOUTH1`, uses `STANDARD` storage, has uniform bucket-level access enabled, and public access prevention inherited. Cloud Storage API is enabled. No bucket creation or configuration change was needed during this step. Per Playbook §2.8, `orders/`, `photos/`, `jobcards/`, and `tmp/` are prefixes created on first upload; no prefixes or object uploads were verified. | Bucket existence and required configuration are verified; object access and upload behavior were not tested. | No bucket creation or configuration action remains for this acceptance criterion. | Authenticated read-only bucket metadata confirms intended project, name, regional location, storage class, uniform access and public access prevention; enabled API confirmed. No upload performed. |
| P2-GCP-011 | 2.10 Pub/Sub topic and subscription | Create `sensor-readings` topic and `sensor-readings-df` subscription. The approved Blueprint late-project alternative is a separate BigQuery subscription. | `[✓] VERIFIED COMPLETE` — fresh full JSON describes on 2026-10-14 confirmed topic `sensor-readings`, ACTIVE ordinary `sensor-readings-df`, and ACTIVE BigQuery `sensor-readings-bq` attached to the same topic. The BigQuery configuration targets `prepagent-hack.prepagent.sensor_readings` and sets `useTableSchema=true`. The destination schema has all six required fields plus nullable `source STRING`; a read-only grouped query returned no rows. No message or live endpoint flow is claimed. | Resource and schema configuration are verified; ingestion remains untested. | Use an explicitly authorized bounded test to verify delivery and the conditions endpoint. | Full Pub/Sub describe JSON, BigQuery table metadata, and read-only grouped query on 2026-10-14. | Read-only inspection confirms the topic, active subscription, and topic link; no publish/consume acceptance. |
| P2-GCP-012 | 2.11 Dataflow sensor stream | Grant documented worker roles; run Pub/Sub-to-BigQuery template with max worker 1; drain when idle. | `[$] BLOCKED BY BILLING/CLOUD ACCESS` — The pinned template/configuration, topic/subscription, destinations, staging bucket, worker identity/roles, APIs, quotas, machine-type availability and subnet were previously read-only checked. Three earlier attempts failed in zones A/B/C. A new budget-bounded attempt on 2026-10-12 (job `2026-10-12_07_37_28-6099673639127736697`) entered RUNNING but repeated `ZONE_RESOURCE_POOL_EXHAUSTED` in `asia-south1-b`; no worker provisioned. One uniquely identified simulated Pub/Sub message was published; two 10 MB-capped reads found no BigQuery row. The job was cancelled after drain remained stuck retrying worker allocation; final state CANCELLED and active-job listing empty. `jobStartAuthorized` remains false. | End-to-end acceptance remains unmet because the latest log provides current evidence of provider-side zonal stockout in `asia-south1-b`; no worker or sensor-to-BigQuery delivery was achieved. | The user authorized a bounded attempt under the ₹1,000 ceiling; that attempt confirmed the stockout and is now terminal. Do not start another job or publish a duplicate until new capacity evidence is available and the queued test message is accounted for. | Existing Dataflow/Compute/Pub/Sub/BigQuery configuration and documented worker identity; read-only capacity recovery evidence is the gate for the single authorized retry. | One authorized sensor message appears exactly once in the intended BigQuery destination with expected fields, and the stream is stopped/drained. Not demonstrated. |
| P2-GCP-013 | 2.12 Sensor publisher | Prepare/run Node Pub/Sub publisher with exact schema keys and 30-second interval. | `[!] PARTIALLY COMPLETE` — `tools/publisher.mjs` uses shared `runPublisher` preflight orchestration. The Pub/Sub API check is now the valid, narrowly filtered `gcloud services list --enabled --project=prepagent-hack --filter=config.name=pubsub.googleapis.com --format=value(config.name)` command; a missing API, project/billing mismatch, missing topic, or invalid gate stops before publication. Offline tests assert command arguments, preflight order/fail-closed behavior, exact `PUBLISH_SIMULATED_SENSOR_DATA=true`, and the one-message limit. The seven-field payload, Blueprint seasonal profile/formula, and `source: "simulated"` remain tested. `sensor-readings-bq` is ACTIVE with the expected schema, but the table had no stored rows in the last read-only query. | Publisher-to-BigQuery delivery and endpoint acceptance remain untested; no message was published in this implementation task. | After separate authorization, execute the bounded publisher once, verify the resulting stored row and source, and only then proceed to endpoint acceptance. | Existing topic and ACTIVE BigQuery subscription; explicit authorization for publication and any subsequent deployment. | One emitted message is stored with source `simulated`, and the deployed endpoint returns that same row; not demonstrated. |
| P2-GCP-014 | 2.13 Test Gemini on Vertex AI | Select a currently supported Gemini Flash or Pro model/location and execute the live “ready” test. | `[✓] VERIFIED COMPLETE` — Official Google model page identifies `gemini-3.5-flash` as GA, released 2026-05-19, retirement 2027-05-19 or later; the official location table lists it as supported in Mumbai (`asia-south1`). Sources checked 2026-10-11: [model page](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-5-flash), [model guide](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini-3-5-flash), and [location table](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations). Manifest and utility pin project `prepagent-hack`, model `gemini-3.5-flash`, location `asia-south1`, stable API `v1`; `@google/genai` 1.52.0 `models.generateContent` uses `POST /v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent`. Safeguards: offline `--check-config`, no side effects on import, explicit `--allow-live-model-call`, preflight checks for active project/billing/enabled Vertex API/ADC, verified ADC permission `aiplatform.endpoints.predict`, 30-second request timeout, and sanitized strict `ready` response handling. Exactly one live command was run: `PROJECT_ID=prepagent-hack GEMINI_MODEL=gemini-3.5-flash VERTEX_LOCATION=asia-south1 node tools/test-gemini.mjs --allow-live-model-call`; start `2026-10-11T17:46:55Z`, end `2026-10-11T17:47:04Z`, exit 0, sanitized response `Gemini test successful: ready`. Offline validation: `node --test test/cloud-tool-gates.test.js` 20 passed/0 failed; `node --check tools/test-gemini.mjs && node --check tools/vertex-test-config.mjs` passed; pinned `--check-config` passed; scoped `git diff --check` passed. No credential/token was printed or recorded. | No acceptance gap identified for this test utility item. This verifies the one documented live readiness request only; it does not establish production Gemini extraction, application integration, or any other model workflow. | Keep the explicit opt-in and pinned model evidence; do not treat this test as authorization for future inference or integration calls. | Current official model/lifecycle and regional support evidence; local utility/config/tests; read-only project, billing, API, ADC, and prediction-permission preflights; one authorized live response. | Officially supported model/location verified; exact live request returned “ready” once with exit 0; credentials remained undisclosed. |
| P2-GCP-015 | 2.14 Translation glossary | Wait for Om CSV; upload to glossary bucket and provision `corrugated` in `us-central1`; test glossary translation. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` — no glossary file exists in the repository; Translation API is recorded enabled, but no glossary or translation result is evidenced. | Missing Om CSV; live glossary/translation work also needs task-specific authorization. | Obtain actual CSV; validate columns; provision/test only after explicit authorization. | Om glossary; Storage/Translation API; us-central1. | Glossary exists and test response uses its terms; no fabricated terms. |
| P2-GCP-016 | 2.15 Hello-world app on Cloud Run | Deploy `prepagent` in Mumbai with runtime SA, 1 GiB, env config, documented public judging access. | `[!] PARTIALLY COMPLETE` — Private Cloud Run service `prepagent` is deployed on revision `prepagent-00002-nsm` with the configured service account, 1 GiB memory, port 8080, max two instances, and the bounded-read runtime gates. Authenticated `/health` returns 200 and API smoke tests reached the live BigQuery adapters. | Public unauthenticated access remains disabled; PO-to-approved-JobSheet acceptance is incomplete because there is no current sensor reading and model/write gates remain off. | Keep private until an explicit public-access decision. Continue the full workflow only when genuine conditions and approved test-record/model-call authorization are available. | Final image/revision is deployed with documented runtime settings and `/health` succeeds; public access only if separately confirmed. |
| P2-GCP-017 | 2.16 Troubleshooting | Follow documented fixes for billing, API enablement, Dataflow, BigQuery, Gemini, glossary and Cloud Run errors. | `[!] PARTIALLY COMPLETE` — `docs/CLOUD_INTEGRATION_TODO.md` now maps the Playbook symptoms to read-only diagnostics and stop conditions; current-state conflicts for budget, plant seed, Artifact Registry/build and Dataflow retry authorization were reconciled. The Dataflow allocation failure has recorded job/error evidence and an explicit capacity gate. | Dataflow capacity remains unresolved; no service-level worker recovery or full Cloud Run diagnosis is established. Historical errors are not evidence of current state. | Use existing evidence without repeating checks. Reopen a diagnostic only for a new concrete error; perform a state-changing fix only within the task-specific authorization. | Current task evidence in the tracker and a concrete remaining service symptom. | Relevant failure is resolved and the affected service/resource is independently verified. Dataflow is still blocked. |
| P2-GCP-018 | 2.17 Build plan — Day 1 | Build app skeleton, PDF Gemini extraction, FX helper, test sample orders and redeploy. | `[!] PARTIALLY COMPLETE` — Storage/Gemini adapters, bounded item-catalog lookup, document-metadata and multi-line extraction contracts, offline PO review/selection, updated dimensions and offline tests exist; `/jobs` coordinates extraction → stored conditions → verified prediction → optimizer in fixed order, with operator-confirmed order fields, shift and actual levers. Runtime model calls remain disabled by default. No supplied PO has been sent to a live model and no deployment occurred. | Approved PO and separately authorized live extraction/catalog acceptance remain required; optimizer/evidence SQL blocks completion of the production-prep workflow. Deployment stays at the final stage by user decision. | Continue with source-backed offline orchestration and unblock Om-owned tools when their contracts arrive; use an approved PO for later bounded live extraction. Deploy at the agreed final stage. | P2-GCP-009, P2-GCP-014, P2-OM-003–004, P2-OM-009, deployment authorization. | Real supplied POs extract correctly and the complete deployed workflow passes with evidence tied to actual inputs/services. |
| P2-GCP-019 | 2.17 Build plan — Day 2 | Translation helper, current conditions, risk/optimization/evidence SQL, Gemini tool loop/SSE, stored job sheet and localized PDF; `/jobs` end to end. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` — contracts/routes/mapper and local PDF renderer exist; actual model identities/SQL, optimizer/evidence queries and glossary are absent. Live cloud services are also unavailable; bundled script fonts satisfy the local renderer requirement only. | Om-owned models, queries and glossary are missing; cloud authorization/prerequisites are a secondary blocker. | Obtain P2-OM-001–005 artifacts. Then, only after explicit cloud authorization, implement and verify the genuine dependency-ordered workflow and persisted `/jobs` response. | P2-GCP-009–015; P2-OM-001–005; P2-AI-001–017. | Real `/jobs` flow returns a validated JobSheet/card under the documented runtime target on Cloud Run, with actual persisted data and trace evidence. |
| P2-GCP-020 | 2.17 Build plan — Day 3 | Operator UI, trace/risk/evidence/what-if/approve/print, localization, feedback/photos, guardrails; management view only if everything else works. | `[!] PARTIALLY COMPLETE` — The required operator surface, validation/error states, localized labels, bounded trace/SSE transport, risk route/adapter, job-sheet persistence/approval/card adapters, feedback adapter, guardrail implementation, and the Blueprint what-if slider are present with focused tests. The risk UI now projects only Om's accepted prediction fields and re-scores on slider release. Management view remains conditional and deferred. | No genuine `/jobs` tool run, optimizer/evidence output, persisted approved card, photo diagnosis, or complete live workflow has been demonstrated. Several required Om inputs and live sensor/model results remain unavailable. | Continue only source-backed service integrations. Keep impact/management dashboard last. Perform one end-to-end acceptance only after upstream dependencies exist and final cloud runtime is ready. | P2-GCP-019; P2-UI-001–008; P2-AI-001–017; P2-OM-001–010; final cloud integration. | Demo flow completes with genuine data/services and every displayed state matches actual service responses; management view remains out of scope until core workflow works. |
| P2-GCP-021 | 2.18 Keep running through judging | Warm Cloud Run for judging, drain Dataflow after recording, freeze deploys, monitor daily, rollback/scale down as specified. | `[D] DEFERRED BY EXPLICIT DECISION` — private Cloud Run service is deployed; no active Dataflow stream or complete accepted workflow is established. Judging operations remain post-acceptance. | Final workflow acceptance and judging-operation authorization. | Revisit after current-source deployment and end-to-end acceptance. | P2-GCP-016, P2-GCP-012. | Service uptime, drained stream, budget/log checks and rollback revision are verified during judging period. |

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
| P2-APP-005 | Actual order extraction | Storage/Gemini adapters and bounded BigQuery catalog lookup are composed behind an explicit runtime opt-in. Extraction represents document metadata and every item-code/quantity line; the review UI retains the result, displays line-level validation/catalog outcomes, and binds explicit corrections and selection to a review fingerprint. | Offline adapter and mapping tests pass; the synthetic PO fixture bundle is present, but no PO has been sent to a model and runtime calls remain disabled by default. The extraction form requires operator-confirmed order ID, loaded paper type, and supplier and marks these fields as operator-supplied. No live catalog lookup has been verified. | `[!] PARTIALLY COMPLETE` — implementation and offline fixtures are ready; live extraction/catalog acceptance requires a suitable approved PO and separate live-model authorization. |
| P2-APP-006 | FX rates, 24-hour cache, dated fallback, provenance, formatting | `src/fx-rates.js`, `src/fx-fallback.json`, `/fx`, `Intl.NumberFormat`; supports 11 project currencies. | Frankfurter feed is public ECB-based FX source, not a GCP integration. | Tests inject provider and fallback; no current-rate claim from fixture. | `[✓] VERIFIED COMPLETE` for helper/route tests recorded in latest audit; rate data is dated and not production evidence. |
| P2-APP-007 | Current conditions retrieval and last-stored fallback | `src/google-cloud/current-conditions-service.js` issues a bounded, parameterized latest-row query for one configured plant, converts the actual stored sensor row to `RunConditions`, preserves an optional stored source, and requires the operator-selected shift. The UI shows units, plant, reading ID, source, timestamp, age and the adapter's `unassessed` freshness state. | Offline tests cover timestamp normalization, exact row mapping, source-present/source-absent behavior, plant parameter, descending latest-row selection, absent-data handling and invalid shift. Fresh BigQuery metadata reports zero rows and nullable `source STRING`; the current conditions query dry-runs against that table. The accepted BigQuery subscription is ACTIVE, but no delivery has been demonstrated. No source-defined staleness cutoff exists; freshness stays `unassessed`. | `[!] PARTIALLY COMPLETE` — requires a stored simulated reading and live endpoint acceptance. |
| P2-APP-008 | Risk prediction and five defect outputs | Request/result schemas and bounded BigQuery ML adapter are connected through configured service ports. The risk API accepts the item identity, quantity, loaded paper type/supplier, four conditions and seven lever settings required by Om's supplied SQL. | A previous live adapter run against the earlier query snapshot returned INR 4,518; it is superseded by the 2026-10-14 run of supplied `sql/predict.sql`, which returned 10.18%, 100.4 kg, INR 5,351, and WARP. This current SQL result was executed with the supplied input and an 80 MiB cap, but not through the HTTP/Node service. Offline adapter/contract tests pass. | `[!] PARTIALLY COMPLETE` — supplied query output is live-verified; re-run through the current application service and verify the route/Cloud Run runtime. |
| P2-APP-009 | Optimization, explanation, similar-run evidence and parameterized queries | Supplied SQL is installed in the app's canonical `sql/` directory. Bounded adapters now validate optimization rows, derive the changes list, map similar-run evidence, query explain rows and validate Gemini numeric claims; seen-before and Impact-summary services are separately gated. | Offline service tests pass. Supplied optimizer, explain, similar-runs and seen-before SQL all ran against BigQuery; optimizer returned 3 changes and INR 925 model savings, similar-runs returned 5 rows, and seen-before returned 775 DELAM cases. Impact's four SQL queries also ran live. These were direct CLI queries, not application/Cloud Run requests. | `[!] PARTIALLY COMPLETE` — current SQL contracts and query outputs are verified, but current service adapters/routes and the full workflow have not been live-verified. |
| P2-APP-010 | BigQuery mapping and explicit unavailable/error boundaries | `src/bigquery-mapper.js` maps/validates row shapes; `src/service-ports.js` returns structured unavailable results. `/api/status` now reports the actual runtime mode and derives unconfigured integrations from configured service ports; Cloud Run status no longer claims it is a local build or that it never contacts GCP. | Regression tests verify local and Cloud Run status separately without making cloud calls. | `[✓] VERIFIED COMPLETE` for mapping/status/unavailable boundaries only, not live BigQuery. |

### UI/localization subtasks

| ID | Capability | Local implementation | Cloud integration / E2E | Status, dependency and next action |
|---|---|---|---|---|
| P2-UI-001 | Operator UI: order, conditions, baseline, risk, evidence, what-if, create/approve/print, feedback, Impact | `src/operator-ui.js` provides PDF upload, a review screen for extracted document metadata and every PO line, actual catalog candidates for ambiguous lines, explicit line selection/correction/confirmation, status, conditions, risk, optimization/evidence, trace, currency, job-card and Impact surfaces; it exposes actual service states and avoids preset production values. The new Screen 4 uses only the existing same-origin `/impact/summary` endpoint, separates historical lot-table values from the held-out synthetic counterfactual, identifies the query period/cache, and does not convert model estimates into measured outcomes. UI passes operator-selected shift to `/conditions/current`; locale dictionaries cover supported languages. `src/risk-ui.js` projects the analysis form to the strict live prediction schema; the Blueprint numeric-lever slider is enabled only after a genuine prediction and re-scores once on release through `/risk/predict`. Job preparation is callable and sends a stable `Idempotency-Key` for the current PDF/operator/shift/lever fingerprint. Operators can load a persisted job via `GET /jobs/:id`; DRAFT/APPROVED updates the lifecycle steps. Error copy uses server `CONFLICT`/`NOT_FOUND`/`IDEMPOTENCY_IN_PROGRESS` messages and localized `blockedAt` stage text. | Offline/browser-route tests verify the review markup and API contract, slider markup, load-job form, idempotency header, `blockedAt` keys, client mapper, supported localized strings, Impact route/client module, source labeling, and that a valid risk request reaches the configured-service boundary. Impact contract tests cover valid, cached, empty, unavailable, malformed, expired-cache and refresh-failure cases; no cloud call was made. | `[!] PARTIALLY COMPLETE` — the Impact screen is **IMPLEMENTED AND OFFLINE TESTED**, but it is not deployed or newly live-verified. The full order workflow remains incomplete: live PO extraction/catalog connectivity, conditions, complete trace/results, optimizer/evidence, genuine job creation, approval, stored-card printing and feedback are not connected end to end. | Keep live workflow controls fail-closed. Expose the Impact screen against the existing read-only API, but do not claim live data until the current deployed revision and endpoint are separately verified. | P2-UI-002; P2-UI-008; P2-AI-001–017; P2-OM-001–010; live cloud acceptance. | Operator sees only validated source results and clear limits, then completes the genuine Blueprint workflow through approval and card retrieval. |
| P2-UI-002 | Full order-to-job operator workflow | `src/operator-ui.js` contains a five-stage guide, upload/analysis forms, an extraction review and line-selection flow, and local supplied-JobSheet renderer; the mock-demo UI path was removed. `/orders/extract` performs one configured extraction/catalog pass and returns a review reference; `/jobs` revalidates the selected source line and catalog selection before coordinator use. Approval and card routes retain their existing configured-service boundaries. | Fixture-backed offline tests verify the review flow and backend validation. No accepted live PO, complete successful trace, genuine DRAFT JobSheet, approval, stored job or workflow printing has been demonstrated. The review snapshot is process-local (30-minute TTL, at most 100 entries), so cross-instance Cloud Run routing/restarts can invalidate it; no shared/persistent review storage was added. | `[!] PARTIALLY COMPLETE` — the operator review/selection gap is closed offline, while the full Day 3 workflow remains blocked on actual model/catalog and other upstream results, persistence/lifecycle integrations, deployment, and live acceptance. Do not retry extraction automatically when a review is stale or unavailable. Sources: blueprint pp. 3, 6, 13–14; playbook pp. 2, 9–10, 15. |
| P2-UI-003 | Language selector and translated UI labels | `src/locales/{en,hi,mr,ja,ko,zh-CN,id}.json` now hold the existing static ordinary-interface labels. `src/localization.js` imports the locale JSON, `/locales/:locale.json` serves the selected allow-listed file, and the selector updates marked labels/messages. These static strings are not Translation/glossary output. | No Om glossary CSV or approved locale terminology is present. Glossary-backed risk/job-card text, per-job/language translation cache, Translation API adapter and language QA against intended output are absent. Some explanatory page text is not localized. | `BLOCKED BY EXTERNAL INPUT` (Om's reviewed glossary CSV and terminology) and `BLOCKED BY AUTHORIZATION` (Translation setup/access and any live call). Locale JSON serving and coverage are locally tested; real terminology, glossary translations, cache behavior and native-language QA cannot be verified without both. Sources: blueprint p. 17; playbook pp. 2, 7, 10, 15. |
| P2-UI-004 | Currency selector and display-only conversion | Eleven supported currencies are used by the selector. The existing `/fx` service implements a 24-hour cache, Frankfurter-based provider path and dated static fallback; the UI formats original and approximate (`≈`) display values with rate date/source. `getDisplayableProductionAmounts` recognizes the local RiskResult, OptimizationResult and JobSheet shapes and never mutates responses. | No genuine successful risk/optimization/job-sheet response exists to exercise the result integration. No FX provider call was made in this audit; fallback fixture date/provenance is not live data. The source defines the desired conversion display, not a freshness threshold; seven-day stale warning is an implementation choice. | `[B] BLOCKED BY EXTERNAL DEPENDENCY` (genuine service results and authorized provider verification are additionally required). Local contract/fixture checks passed, but no production amount or current provider response was verified. Sources: blueprint pp. 8, 17; playbook pp. 5, 9–10, 15. |
| P2-UI-005 | Sample orders for home screen | No verified real anonymized samples in repository. | Om owns provided demo POs. | `[B] BLOCKED BY EXTERNAL DEPENDENCY`; wait for P2-OM-009. |
| P2-UI-006 | Responsive/usable laptop layout | Operator page uses a two-column desktop grid, single-column layout below 760px and print styles. | Browser acceptance found no horizontal overflow at 320, 390, 768, 1024 or 1440px; mobile layout is single-column at 390px and the first keyboard-focused control has a visible solid outline. Desktop initial viewport was visually inspected. | `[✓] VERIFIED COMPLETE` for local responsive layout and keyboard-focus presentation; this does not verify cloud workflow or production deployment. Files: `src/operator-ui.js`, `test/app.test.js`. |
| P2-UI-007 | Loading, error and unavailable states | Each action has live-region output, in-progress state, retry behavior, HTTP/error details, and unavailable state; network errors are sanitized. The Impact screen clears prior results before a retry, rejects malformed responses, and shows query/cache period and explicit unavailable/empty states. | Browser acceptance confirmed actual local status `200` and conditions `503`; malformed user JSON displayed validation feedback without a request; an intercepted network abort displayed a safe message and Retry; a held local request showed `Loading…`, disabled control and `aria-busy=true`; a test-only JobSheet rendered locally, then an intercepted render failure hid/cleared the stale PDF link and hid internal diagnostics. Automated tests cover Impact valid/empty/malformed payloads, disabled integration and endpoint unavailable responses, cache expiry and no stale fallback. | `[✓] VERIFIED COMPLETE` for local loading/error/unavailable/recovery behavior. This does not establish deployed/live integration reliability. Files: `src/operator-ui.js`, `src/impact-ui.js`, `index.mjs`, `test/app.test.js`, `test/impact-ui.test.js`, `test/impact-summary-service.test.js`. |
| P2-UI-008 | Management view / Impact evidence | The local operator UI now includes an Impact evidence screen backed only by the existing gated `/impact/summary` adapter and supplied SQL. It separates the held-out synthetic counterfactual from historical lot-table values, identifies fixed query coverage and cache state, and has no preview fallback. | The four SQL-backed service outputs have historical live query evidence recorded in Section 60; this batch performed no cloud reads. Local API/UI contract and empty, unavailable, malformed, expired-cache and refresh-failure paths are offline-tested. The deployed revision has not been updated or rechecked for this screen. | `[!] PARTIALLY COMPLETE` — **IMPLEMENTED AND OFFLINE TESTED** locally; **NOT LIVE VERIFIED** in the current deployed revision. Live exposure remains dependent on authorized build/deployment and separately verified service/data availability. |

### API guardrails (audit-derived subtasks)

| ID | Capability | Implementation | Status / evidence / remaining limitation |
|---|---|---|---|
| P2-GUARD-001 | Per-IP request rate limiting | `src/request-guardrails.js` applies a bounded in-memory 60-request/60-second fixed window to operational API routes using the direct Node socket IP. It ignores `X-Forwarded-For` and does not assume headers are trustworthy. | `[!] PARTIALLY COMPLETE` — Offline tests cover separate clients, spoofed forwarding headers, exact fixed-window expiry, map bounds, downstream failures, 429 and `/health` exemption. This is process-local and does not establish individual client IPs behind Cloud Run or coordinate counters across replicas. | Production per-IP acceptance needs a source-defined trusted-proxy IP contract and shared limiter store; neither is configured. Do not trust arbitrary forwarding headers or claim cross-replica enforcement. | Keep current guardrails. Only add a production proxy/shared-store mechanism if the Blueprint/Playbook names the trusted source and supported store; otherwise request that architecture decision rather than inventing one. | Cloud Run ingress contract and shared limiter architecture (not present in governing docs). | Correct client IP is derived only from a trusted proxy and rate limits apply consistently across runtime replicas; not yet demonstrated. |
| P2-GUARD-002 | 60-second request timeout | `src/request-guardrails.js` bounds request handling, returns structured `REQUEST_TIMEOUT`/504 and aborts a cooperative handler. Cloud-facing service ports receive the request abort signal. | `[✓] VERIFIED COMPLETE` — `test/request-guardrails.test.js` verifies deadline, response and signal abort with a short test-only deadline; server default is 60 seconds. Adapters must honor the signal to stop their underlying work. Files: `src/request-guardrails.js`, `index.mjs`, `test/request-guardrails.test.js`. |
| P2-GUARD-003 | `/jobs` idempotency guardrail — duplicate-job prevention | `src/job-idempotency.js` derives request identities without storing PO bytes and rejects conflicting keys. The Firestore store uses atomic `createDocument` plus document-version preconditions for expired-lease deletion, completion, and release; failed preconditions cannot overwrite a newer owner's claim. Completion errors are surfaced, and job creation is not reported successful if the durable claim cannot be completed. `InMemoryIdempotencyStore` is test/development-only. `index.mjs` requires Cloud Run, the explicit Firestore gate, project ID, and configured JobSheet read/write adapters; if absent `/jobs` persistence is unavailable, with no process-local or non-idempotent fallback. `config/gcp-firestore.json` records earlier provisioning, but current live configuration was not reverified in this offline batch. | `[!] PARTIALLY COMPLETE` — offline tests cover same-key replay, changed-payload conflict, concurrent claims, failed-work retry, service reconstruction against shared fake Firestore state, and conditional-write races. No Firestore, BigQuery, Storage, deployment, or runtime-gate operation occurred in this batch. Persistent cross-instance behavior remains dependent on the deployed gate, workload identity, and live service verification. |

## 6. Google Cloud readiness and provisioning

Classification column uses only the requested cloud readiness categories.
Readiness statuses here are cross-references to Section 4/Section 5 IDs, not
additional counted tasks.
This readiness matrix preserves earlier audit evidence. Where its status or
classification is superseded by newer evidence, the newest dated tracker
addendum is authoritative; Section 14 and earlier snapshots remain historical.

| Resource/capability | Tracker ID | Cloud classification | Last evidence and state | Safe next action |
|---|---|---|---|---|
| Project ID/state and active account | P2-GCP-001, P2-GCP-003 | VERIFIED AND COMPLETE (project identity only) | Prior audit: project ID `prepagent-hack`, active account inspected. | Do not switch projects; recheck only when required. |
| ADC | P2-GCP-008 | VERIFIED AND COMPLETE | Prior audit confirmed ADC availability without printing token. | Never expose tokens/ADC files. |
| Billing | P2-GCP-003 | VERIFIED ENABLED | Latest verified evidence confirms billing is enabled for `prepagent-hack`; earlier `billingEnabled=false` evidence is historical. | No billing change. Do not infer authorization for additional operations or paid services. |
| Budget alerts | P2-GCP-004 | DEFERRED BY USER | ₹5,000/month and 50/90/100 thresholds are documented but absent; current billing is enabled. | No budget operation was performed; handle setup only with separate explicit authorization. |
| Required APIs | P2-GCP-005 | VERIFIED ENABLED | The recorded enabled-services listing confirms the requested APIs are enabled in `prepagent-hack`. | API enablement is not resource or workflow acceptance; do not infer authorization for service operations. |
| Runtime service account | P2-GCP-007 | VERIFIED AND COMPLETE | Prior IAM check found `prepagent-run`. | No key files. |
| Runtime roles | P2-GCP-007 | VERIFIED AND COMPLETE | Prior IAM check showed all six playbook roles. | Recheck before workloads only. |
| Om Editor access | P2-GCP-006 | VERIFIED AND COMPLETE | Prior policy showed `omrajeshjain23@gmail.com: roles/editor`. | No change. |
| Dataset | P2-GCP-010 | VERIFIED | `prepagent` exists in `prepagent-hack`, location `asia-south1`; latest evidence. | Preserve; no recreation. |
| Five table schemas | P2-GCP-010 | VERIFIED | `plants`, `lots`, `sensor_readings`, `job_sheets`, `feedback` match the expected playbook schemas. | Preserve; no recreation. |
| Partition definitions | P2-GCP-010 | VERIFIED | `lots.run_date` and `sensor_readings.ts` partitioned; other three tables unpartitioned. | Preserve as verified. |
| Read-only query and temporary-table DML | P2-GCP-010 | VERIFIED | `SELECT 1 AS query_test` succeeded; temporary table create/insert/update/read-back succeeded. | Do not treat temporary-table DML as permanent-table DML evidence. |
| Permissions | P2-GCP-010 | VERIFIED | Active account `aibuildercup2026@gmail.com` verified as project Owner and dataset Owner. | No permission change indicated. |
| `PLANT-01` seed | P2-GCP-010, P2-GCP-023 | BLOCKED — OM CONFIRMATION AND EXPLICIT AUTHORIZATION | `plants` was observed with zero rows. Prepared `MERGE` exists but is unexecuted. Seed values `cost_per_kg = 45.0` and `default_locale = 'mr'` are not confirmed by Om and are not authoritative. Permanent-table DML has not been tested. | Obtain Om's confirmed plant data and explicit user authorization. Do not execute the seed or test permanent-table DML before authorization. |
| Data bucket | P2-GCP-009, P2-GCP-024 | RESOURCE CONFIGURATION VERIFIED | Current read-only metadata confirms `gs://prepagent-hack-data` in project `prepagent-hack`, regional `ASIA-SOUTH1`, with uniform bucket-level access enabled. The old 404 is retained as superseded history; its exact timing relative to bucket creation is unknown. | No object upload, prefix creation, or application access test is claimed. |
| Pub/Sub topic/subscription | P2-GCP-011, P2-GCP-025 | RESOURCE CONFIGURATION VERIFIED | Recorded 2026-10-11 read-only audit found topic `sensor-readings` and an ACTIVE linked `sensor-readings-df` subscription; Pub/Sub API was enabled. Ack deadline: 10 seconds; message retention: seven days; expiration TTL: 31 days. | No publication or consumption was performed. Keep message-flow tests separate and authorized. |
| Vertex AI | P2-GCP-014, P2-GCP-028 | API ENABLED; SMOKE TEST VERIFIED | P2-GCP-005 records the API enabled; P2-GCP-014 records one successful, authorized Gemini readiness call. | Keep general model calls gated; no production extraction/orchestration acceptance is claimed. |
| Translation API | P2-GCP-015, P2-GCP-028 | API ENABLED; GLOSSARY BLOCKED | P2-GCP-005 records the API enabled; no glossary CSV or live translation result is evidenced. | Obtain Om's CSV; glossary provisioning and live translation require separate authorization. |
| Translation glossary | P2-GCP-015, P2-OM-005 | REQUIRES OM'S INPUT | No CSV; glossary is not provisioned. | Wait for actual CSV. |
| Dataflow API/job | P2-GCP-012, P2-GCP-026 | API ENABLED; STREAM BLOCKED | P2-GCP-012 records three worker-allocation failures (`ZONE_RESOURCE_POOL_EXHAUSTED`), final cancellation, and no active job. | Do not retry; seek provider-side capacity resolution and fresh authorization before any further attempt. |
| Default Compute worker identity | P2-GCP-012, P2-GCP-026 | IDENTITY/IAM VERIFIED | Existing authorized evidence confirms the expected worker identity and documented roles; this does not prove worker allocation or stream success. | Keep Dataflow execution blocked and `jobStartAuthorized` false. |
| Cloud Build | P2-GCP-016, P2-GCP-027 | EXISTING BUILD VERIFIED; LOCAL SOURCE AHEAD | Build `8e9522b4-c92b-4e73-9707-81e779162840` succeeded and produced the image currently deployed to Cloud Run. No build of subsequent local source changes is recorded. | Build latest validated source only after explicit authorization. |
| Artifact Registry | P2-GCP-016, P2-GCP-027 | CURRENT DEPLOYED IMAGE VERIFIED | `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent:po1-e2e-20261014-2`, digest `sha256:25395f6c46ff43833b8ecd077bc8950173299cc743425d46baae3c03adaaa9f2`. | Preserve the image; latest local source has not been built. |
| Cloud Run | P2-GCP-016, P2-GCP-029 | DEPLOYED PRIVATE; CURRENT LOCAL CODE NOT DEPLOYED | Service `prepagent`, revision `prepagent-00005-s5x`, URL `https://prepagent-26mwt2n7ba-el.a.run.app`; recorded authenticated `/health` and `/api/status` returned 200. Max instances two; no public invoker. | Public access remains disabled. Deploy latest local source only with explicit authorization; live conditions and complete workflow remain unverified. |
| Logging | P2-GCP-005, P2-GCP-031 | VERIFIED AND COMPLETE | API enabled per prior audit; no sinks/retention mutation. | None. |
| Sensor publisher | P2-GCP-013, P2-GCP-030 | IMPLEMENTATION COMPLETE; INTEGRATION PENDING | Local gated script and tests are complete; the Pub/Sub topic exists. No message publication or BigQuery visibility is evidenced. | Do not publish without separate explicit authorization and an accepted cost-bounded window. |
| Environment configuration | P2-GCP-002, P2-GCP-024 | VERIFIED AND COMPLETE | Correct non-secret variables; `env.sh` ignored by Git. | Keep synchronized, no secrets. |
| Deployment configuration | P2-GCP-016, P2-GCP-029 | EXISTING SERVICE CONFIGURATION VERIFIED; LOCAL REVISION PENDING | `config/gcp-cloud-run.json` records the deployed private service's non-secret environment, startup `npm start`, port 8080, 1 GiB, max two instances, runtime identity, and current image/revision. The latest local code is not in the recorded image. | Keep manifest accurate; build/deploy the local revision only with explicit authorization. |

### Audit-derived GCP subtasks

| ID | Status | Evidence | Next action / dependencies |
|---|---|---|---|
| P2-GCP-022 | `[✓] VERIFIED COMPLETE` | Latest evidence confirms all five tables and schemas; partition fields are `lots.run_date` and `sensor_readings.ts`; other three are unpartitioned. `SELECT 1 AS query_test` and temporary-table DML were separately verified; no permanent-table DML was tested. | Preserve existing tables. |
| P2-GCP-023 | `[✓] VERIFIED COMPLETE` | Fresh read-only BigQuery row inspection shows `PLANT-01 | Pune unit | INR | 45.0 | mr`, exactly matching the seed row specified in Playbook §2.9. Om reports he re-added the missing row. No permanent write or DML test was run by this implementation pass. | No seed action remains. The current-conditions route is configured for verified `PLANT-01` and an operator-selected shift; actual sensor readings remain unavailable. |
| P2-GCP-024 | `[✓] VERIFIED COMPLETE` | Fresh non-secret `env.sh` inspection matched project, both regions, bucket, runtime SA and Om tracker identity; repository file remains Git-ignored. | Do not commit env file. |
| P2-GCP-025 | `[✓] VERIFIED COMPLETE` | The intended Storage bucket is now confirmed by a successful read-only metadata describe in project `prepagent-hack`: regional `ASIA-SOUTH1`, `STANDARD`, uniform bucket-level access enabled, public access prevention inherited. Existing read-only audit evidence confirms topic `sensor-readings` and ACTIVE subscription `sensor-readings-df` linked to that topic; Pub/Sub API is enabled. This verifies resource prerequisites only. | No resource prerequisite remains. Publish/consume, object access, and Dataflow delivery remain separate and unverified; no messages or objects were written. |
| P2-GCP-026 | `[✓] VERIFIED COMPLETE` | Existing authorized Dataflow preflight evidence and `config/gcp-dataflow.json` confirm worker identity `514663464609-compute@developer.gserviceaccount.com`, the four documented project roles (`dataflow.worker`, `bigquery.dataEditor`, `pubsub.subscriber`, `storage.objectAdmin`), and the Dataflow service-agent role binding. | Identity and IAM readiness only. Dataflow execution and sensor-to-BigQuery delivery remain blocked/unverified; `jobStartAuthorized` remains false. |
| P2-GCP-027 | `[✓] VERIFIED COMPLETE` | Created the previously absent STANDARD Docker repository `prepagent` in `asia-south1`. Cloud Build `4ba1d50b-da43-4e91-bd3d-cc6e4d0e6d3f` completed `SUCCESS` in 44 seconds on 2026-10-11T19:11:27Z and pushed `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent:part2-20261012-1`. Read-only Artifact Registry describe confirmed digest `sha256:5df24b4aac1c46eddecbb48d7204dc6de710f5d69dc022d5d81b53f5386c37e5`; repository size was 118.942 MB. Build log records `npm ci --omit=dev` and zero dependency vulnerabilities. | Repository/build acceptance is met. This is not a runtime health or deployment check; Cloud Run remains undeployed by current instruction. Cloud Build/registry usage may consume credit; exact billing attribution was not checked. |
| P2-GCP-028 | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | P2-GCP-005 records Vertex AI and Translation APIs as ENABLED. P2-GCP-014 records one successful, authorized Gemini `ready` smoke test; this does not satisfy translation/glossary or production-workflow criteria. Om’s glossary CSV and required model/SQL inputs remain absent. | Obtain Om’s actual glossary/models and required SQL. Keep translation disabled at the application level and do not provision a glossary or make live calls without separate authorization. |
| P2-GCP-029 | `[!] PARTIALLY COMPLETE` | Private service `prepagent` revision `prepagent-00005-s5x` is deployed and ready; unauthenticated access remains disabled. The latest local source is not deployed. | Current-source deployment needs explicit authorization; public exposure remains a separate access decision. |
| P2-GCP-030 | `[✓] VERIFIED COMPLETE` | The single authorized P2-GCP-014 live smoke test reached `gemini-3.5-flash` in `asia-south1`, exited 0, and returned the expected sanitized `ready` response (2026-10-11 17:46:55Z–17:47:04Z). This satisfies the smoke-test criterion only; it is not production inference acceptance. | No further smoke test is warranted. Keep general model calls gated; production extraction, orchestration, and photo classification remain unimplemented/unverified. |
| P2-GCP-031 | `[✓] VERIFIED COMPLETE` | Fresh API list confirms Logging enabled; sink list contains only `_Required` and `_Default`. No custom sink, retention, or logging configuration was changed. | No action. |

## 7. AI, production preparation and business workflow

These are audit-derived implementation tasks linked to the official Day 1–3
requirements. The current code has Zod contracts, routes and named helper
functions, but that does not establish live capability. The statuses below
describe required **actual** integrations; temporary cloud mocks are
prohibited.

| ID | Capability | Local code state | Real integration / evidence needed | Status, blocker and next action |
|---|---|---|---|---|
| P2-AI-001 | `extractOrder` — actual PDF extraction | Bounded PDF upload and Vertex Gemini structured extraction of document metadata and all item-code/quantity lines, parameterized BigQuery catalog matching, Zod validation, and explicit missing/malformed-field reporting are implemented behind manifest/runtime opt-ins. `/orders/extract` retains one result in a bounded process-local review cache; `/jobs` validates the review fingerprint, exact line and operator confirmation, and rechecks the chosen catalog item without repeating extraction. | Offline adapter and fixture-backed review tests cover multi-line results, ambiguous candidates, unknown/missing/malformed values, missing metadata, corrections and stale confirmation. The historical PO1 request to private revision `prepagent-00005-s5x` returned HTTP 503 without usage metadata; no successful live extraction or catalog response is established. The manifest and deployed revision record model calls enabled under earlier explicit authorization; this task made no model call. Item specifications come from the catalog; order ID, paper type and supplier remain explicit operator-confirmed fields. | `[!] PARTIALLY COMPLETE` — live extraction/catalog acceptance remains pending. The process-local review reference is not shared across Cloud Run instances/restarts; current local source is not deployed. |
| P2-AI-002 | `getConditions` — latest sensor data/fallback | `src/google-cloud/current-conditions-service.js` implements a bounded, parameterized latest stored sensor lookup by configured plant, normalizes the timestamp, preserves source/identity and applies the request-provided shift. The active BigQuery sink is configured with the existing table schema. | Historical Dataflow attempt published one uniquely identified simulated Pub/Sub message, but the job was cancelled after `ZONE_RESOURCE_POOL_EXHAUSTED` and no matching BigQuery row was found. Later 2026-10-14 read-only inspection found zero rows and verified the ACTIVE direct BigQuery subscription; no message was published to prove delivery through that sink, and the current-conditions route previously returned unavailable for no row. | `[!] PARTIALLY COMPLETE` — needs one separately authorized simulated reading through the direct sink, row verification, deployment of current code, and matching live endpoint response. |
| P2-AI-003 | `predictRisk` — five defect results | Validation/schema/route and bounded live query adapter are implemented. | On deployed revision `prepagent-00002-nsm`, `POST /risk/predict` returned HTTP 200 from `bigquery-ml`: 10.18%, 100.4 kg, INR 5,351, primary WARP. The live BigQuery schema uses `FLOAT`; decoder compatibility is covered by tests. | `[!] PARTIALLY COMPLETE` — direct route is verified; upstream extraction, current conditions, and end-to-end job use remain incomplete. |
| P2-AI-004 | `optimizeLevers` — baseline, best, changes, savings | Supplied `optimize.sql` is integrated in the bounded BigQuery service; adapter validates BASELINE/BEST, exact planned baseline, documented grid, maximum three changes, reconciled rate/cost/savings arithmetic, and the plan-relative throughput penalty; derives the seven-lever change list with noncausal explanation labels. | Existing recorded deployed-route result: revision `prepagent-00002-nsm`, BASELINE INR 5,351; BEST INR 4,426; 17.4 kg / INR 925 estimated savings, three changes. These are historical route results, not rerun in this offline-only task. New offline regression rejects penalty output inconsistent with the handoff formula; optimizer service tests still use the recorded SQL example and verify change wording is not causal. | `[!] PARTIALLY COMPLETE` — adapter is implemented/offline-tested, but savings remain model estimates and the standard-baseline / penalty-contract conflict and INR 781-vs-925 discrepancy require Om's authoritative reconciliation; no complete live PO workflow. |
| P2-AI-005 | `findSimilarRuns` and seen-before evidence | Supplied SQL is integrated into bounded query services; the current Screen 2 submits a complete order/conditions contract to the existing similar-run route and displays only validated returned observations. Offline-test-adapter results are visibly labeled and cannot enable explanation. | Existing service/route tests cover unavailable and validation boundaries. A browser request was intercepted locally and confirmed as same-origin `POST /risk/similar-runs`, with an explicit offline-test response; this is not a BigQuery application call. Historical deployed `/evidence/seen-before` and direct SQL results remain historical evidence. | `[!] PARTIALLY COMPLETE` — current UI wiring is implemented/offline-tested; live similar-run service output and the complete PO workflow remain unverified. |
| P2-AI-006 | `explainRisk` — model explanations | Supplied `explain.sql` is integrated; the explanation service validates actual attribution rows and their linkage to BEST settings, prompts Gemini for 3–5 sentences, and rejects unsupported numbers/drivers and explicit causal claims. The current Screen 2 posts to the existing route only after source-checked prediction, optimizer and BigQuery-evidence prerequisites are present; input changes invalidate the analysis. | Offline tests verify attribution row shape/linkage, historical evidence refs, numeric/driver grounding, and rejection of causal phrasing. Browser checks verify that an `offline-test-adapter` evidence response cannot enable explanation. No successful live explanation output is recorded; the historical PO1 extraction request returned HTTP 503 without usage metadata. | `[!] PARTIALLY COMPLETE` — UI wiring is implemented/offline-tested; actual Gemini grounding, live service output and full workflow remain unverified. |
| P2-AI-007 | `generateJobSheet` — complete validated result | Coordinator composes validated upstream results into a schema-checked `DRAFT` JobSheet. | Fixture-backed offline composition reaches DRAFT persistence/read-back using injected extraction/catalog/conditions/model/evidence/explanation adapters; it is not a real production analysis. | `[!] PARTIALLY COMPLETE` — current model evaluation, live extraction/catalog/conditions, resolved optimizer semantics and authorized persistent acceptance remain outstanding. |
| P2-AI-008 | Gemini function-calling loop and tool registry | `src/google-cloud/gemini-function-runner.js` retains the bounded seven-tool Gemini loop. The deterministic `/jobs` coordinator invokes configured extraction, conditions, risk, optimization, similar-run, explanation and JobSheet ports in fixed order, validates each result, and stops at the first unavailable/invalid stage. It is separate from the Gemini function-calling loop and is not represented as a completed Gemini-driven run. | Offline tests verify stage order, operator-input gates, conditions/prediction/optimizer handoffs, evidence/explanation/JobSheet assembly, and fail-closed stops. No live model call or accepted complete tool set. | `[!] PARTIALLY COMPLETE` — deterministic code path and service contracts are offline-tested; full Gemini runner-to-production wiring and successful live workflow remain unverified. |
| P2-AI-009 | Shared agent execution trace | The registry now records `/jobs` coordinator lifecycle events for actual service-port calls and omits order/tool-result contents. | HTTP test verifies a run ID and replayed sanitized extraction-unavailable trace from `/jobs`; coordinator unit tests verify ordered tool success/unavailable events and stop behavior. No successful complete production run or deployed trace. | `[!] PARTIALLY COMPLETE` — full-run trace acceptance needs configured services, inputs, and Om query contracts. Sources: blueprint pp. 2–3, 13–14; playbook pp. 2, 9. |
| P2-AI-010 | SSE trace streaming to UI | `/jobs` returns its trace run ID; the operator UI now automatically subscribes to the existing registry-backed SSE route, while retaining manual trace lookup. | App test verifies `/jobs` trace creation and replayed trace through terminal failure; trace transport tests verify replay/live ordering and cleanup. No complete successful run has been streamed. | `[!] PARTIALLY COMPLETE` — successful end-to-end SSE acceptance awaits genuine upstream tools and a complete `/jobs` run. Sources: blueprint pp. 2–3, 13; playbook p. 9. |
| P2-AI-011 | JobSheet BigQuery persistence | `src/google-cloud/bigquery-write-client.js` and `job-sheet-repository.js` implement a bounded parameterized DRAFT merge followed by mandatory read-back; a new insert also verifies its creation timestamp. Read-back validates identity, plant, status, JSON snapshots, explanation, savings/currency and null approval/card fields. Existing-row retries must match the requested DRAFT, and invalid writer acknowledgements fail closed. Approval remains conditional on DRAFT and is read back before success is returned. Runtime flags gate writes. | `test/job-sheet-repository.test.js` covers create/read, duplicate merge, absent/mismatched read-back, timestamp and acknowledgement mismatches, and conditional approval; `test/job-lifecycle-recovery.test.js` covers retry after a persisted write whose first read-back fails. Earlier synthetic BigQuery live write/read/approval evidence from 2026-10-12 was cleaned up and remains historical. No cloud operation occurred in this batch. | `[!] PARTIALLY COMPLETE` — storage contract and recovery are implemented and offline-tested; genuine `/jobs` output, current cloud write/read behavior and Cloud Run workload-identity acceptance remain outstanding. |
| P2-AI-012 | Print-ready PDF renderer and Unicode fonts | `src/job-sheet-pdf.js` validates with `JobSheetSchema`, produces A4 PDFs, includes supplied order, conditions, baseline/recommended settings and risk, changes, savings, evidence, explanation and exact status; `POST /job-sheets/render.pdf` is separate from upload/persistence. Bundled licensed Noto Sans assets cover Devanagari, Japanese, Korean and Simplified Chinese. | Focused tests verify PDF structure/content, optional fields, status, font embedding for all four scripts, common WinAnsi punctuation, missing-font overrides and pagination. Quick Look visually rendered a synthetic test fixture containing all four scripts. The live local route returned `200 application/pdf` with `%PDF-1.3`. No Storage upload or production JobSheet was involved. | `[✓] VERIFIED COMPLETE` for the local PDF-renderer contract only. Cloud Storage upload remains separate under P2-AI-013. Files: `src/job-sheet-pdf.js`, `index.mjs`, `test/job-sheet-pdf.test.js`, `test/app.test.js`, `assets/fonts/**`. |
| P2-AI-013 | Cloud Storage job-card upload | `src/google-cloud/job-card-service.js` renders an approved JobSheet, validates the uploaded object name/generation/bucket URI, and reconciles ambiguous approval writes before deleting any object; retrieval is approved-only and validates PDF type/signature. | Offline adapter and lifecycle tests cover exact object identity, generation-scoped cleanup, ambiguous write recovery and approved retrieval. On 2026-10-12, a synthetic approved PDF was uploaded to the real bucket and retrieved successfully, then the unique object was deleted; that historical operation used the authenticated development identity, not Cloud Run workload identity. No Storage call occurred in this batch. | `[!] PARTIALLY COMPLETE` — synthetic upload/retrieval was historically verified, and recovery behavior is offline-tested. Verify a genuine persisted JobSheet under Cloud Run workload identity during final integration. |
| P2-AI-014 | Approval and print workflow | Approval is restricted to a validated stored DRAFT, uploads the PDF before a conditional state update, and verifies persisted APPROVED status, timestamp and exact card URI. If the approval response is ambiguous, the service reads stored state before cleanup; a referenced card is retained, and cleanup targets only the uploaded generation when non-commit is confirmed. Card retrieval requires an approved record and valid private PDF. No rejection state or route is defined by the authoritative status enum or source workflow. | Offline tests cover transition guards, conflict cleanup, lost-write-response recovery, retaining the object when read-back is unavailable, approved-only retrieval and PDF checks; `test/job-lifecycle-recovery.test.js` composes repository persistence and card retrieval. Historical synthetic live row/object evidence was cleaned up; no cloud operation occurred in this batch. | `[!] PARTIALLY COMPLETE` — approval/recovery is implemented and offline-tested. Rejection is blocked pending an authoritative state/transition/reason contract and product decision; live workflow and Cloud Run identity remain unverified. |
| P2-AI-015 | Photo diagnosis | Photo result schema only; no classifier. | Contract exists. Read-only GCS inventory found 12 valid JPEG objects under defect-named folders; object presence does not establish safe, labeled model input. | `BLOCKED BY EXTERNAL INPUT` — `crushed` and `good` do not map directly to the five-defect schema, inspected assets include visible branding, and consent/provenance, authoritative class mapping and split metadata remain unconfirmed by Om. No classifier or diagnosis has been claimed. Classification/inference also remains `BLOCKED BY AUTHORIZATION` until separately approved. | Obtain Om's explicit provenance/consent rules, label mapping (including `crushed` and `good`), evaluation/split metadata, and approved inference contract. Then request separate authorization before implementing live classification. | P2-OM-010; photo provenance/consent, taxonomy mapping and expected result schema. | Approved photo returns a validated, genuine defect result and trace evidence without treating folder names as labels. |
| P2-AI-016 | Feedback and operator notes | `src/google-cloud/feedback-service.js` maps validated feedback to the existing schema and derives a payload-based BigQuery `insertId` that remains stable when retries receive a new server timestamp. `src/linked-feedback-service.js` validates the stored job and optional existing lot/order association before save. | Offline tests cover row mapping, stable retry identity, changed-payload identity, write failure, valid job linkage and invalid references. BigQuery streaming `insertId` is best-effort deduplication, not a durable uniqueness guarantee. Feedback does not create or update `lots`; no live feedback write was made. | `[!] PARTIALLY COMPLETE` — feedback row contract and retry behavior are offline-tested. The handoff's feedback-to-lot operation is blocked until an authoritative input contract supplies run date, actual conditions and actual machine settings used; current feedback schema carries measured rates but not those run facts. Photo and translation work also remains dependent on Om's provenance/label and glossary inputs. |
| P2-AI-017 | Glossary-backed translations/cache | Supported language codes exist; no `translate()` adapter or per-job/language cache. | Glossary-backed Translation Advanced in `us-central1`; verify terms/cache. | `BLOCKED BY EXTERNAL INPUT` — Om's reviewed CSV with `en,hi,mr,ja,ko,zh-CN,id` columns and trade-term entries. Translation setup/access and live calls are separately `BLOCKED BY AUTHORIZATION`. |

## 8. Om and external dependencies

No request date is recorded in available repository/audit evidence; none is
invented here. Owner is recorded as Om where assigned by the playbook’s Part 3
and team plan.

| ID | Required artifact/input | Owner | Request date | Status | Downstream tasks blocked | Exact unblock action |
|---|---|---|---|---|---|---|
| P2-OM-001 | Five trained model identities/artifacts and training SQL | Om | Prior BigQuery job-history/model-metadata evidence (not re-queried in this offline task) | `[!] PARTIALLY COMPLETE` | P2-GCP-019; P2-AI-003–008 | Blueprint p. 12 says held-out R² should be 0.6–0.75; Playbook p. 14 explicitly sets pass at `r2_score >= 0.6` and requires top features to match defect rules. The historically recorded values (warp 0.6052, delam 0.6664, strength 0.4673, print 0.7512, crack 0.3011) are not freshly reproduced or reverified here; if accurate, strength and crack fail. No model artifacts, held-out lot dataset/split, fresh evaluation output, or feature-importance output exists in the local handoff/workspace, so evaluation and feature-importance acceptance cannot be reproduced offline. Om must supply current identities/versions, approved held-out data/split and evaluation outputs, and per-defect feature-importance evidence; failing models need authorized retraining. |
| P2-OM-002 | Risk prediction SQL for all five defects | Om | BigQuery job history | `[✓] VERIFIED COMPLETE` | P2-AI-003, P2-GCP-019 | Exact 15-parameter SQL was recovered read-only from Om-owned successful BigQuery job configurations (three matching executions); saved as `sql/predict.sql`, SHA-256 `e93ca95fb8f70fda972d7efc3c2f20018ef79267a134c3e1b9faff33458ff112`. Job metadata establishes query execution success; no query was rerun. |
| P2-OM-003 | Optimizer objective/grid/query and plant baseline settings | Om | 2026-10-14 handoff | `[!] PARTIALLY COMPLETE` | P2-AI-004, P2-GCP-019 | `docs/sid_pack/optimize.sql` and `SID_NOTES.md` are present, copied into `sql/`, and offline-tested. The handoff SQL/notes use each supervisor's planned settings for baseline and charge only plan-relative slowing; the Blueprint pp. 12–13 describes plant-standard (median-habit) baseline and first-pass fixed thresholds (>6 drying hours, below 45 SF speed, below 55 print speed). Current adapter validates the SQL/handoff plan-relative penalty but does not choose between conflicting source definitions. Prior results disagree: handoff example INR 781 vs recorded SQL result INR 925/17.4 kg. Do not use either as a plant-approved expected result until Om reconciles baseline, penalties, cost_per_kg provenance, and the expected example. |
| P2-OM-004 | Explain/evidence/similar-run SQL and query inputs | Om | 2026-10-14 handoff | `[!] PARTIALLY COMPLETE` | P2-AI-005–006 | `explain.sql`, `similar_runs.sql`, and `seen_before.sql` are present, integrated, and offline-tested. The services validate evidence row schemas, identifiers, filters and attribution linkage; explanation output now fails closed on causal claims. Prior direct query results remain historical evidence only. Gemini output and photo-classification integration are not live-verified. |
| P2-OM-005 | Actual glossary CSV with `en,hi,mr,ja,ko,zh-CN,id` columns | Om | Not recorded | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | P2-GCP-015; P2-AI-017; P2-UI-003 | Deliver CSV with validated header and reviewed trade-term entries. |
| P2-OM-006 | Plant monthly humidity/temperature season profile | Om | Not recorded | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | P2-GCP-013; P2-GCP-018 | Supply the plant season profile for the publisher/demo. |
| P2-OM-007 | Plant standard machine baselines, cost and throughput assumptions | Om | Not recorded | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | P2-AI-004; P2-GCP-018 | Confirm settings/cost against plant inputs; identify placeholders explicitly. |
| P2-OM-008 | Production stage order, especially printing location | Om | Not recorded | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | Process explanation and operator job-card correctness | Confirm actual manufacturing stage sequence. |
| P2-OM-009 | Five synthetic demo POs and expected extraction answers | Om | 2026-10-14 handoff | `[✓] VERIFIED COMPLETE` | P2-AI-001; P2-UI-005; P2-GCP-018 | Five files and `expected_results.json` are present under the ignored workspace `docs/synthetic_POs/`. The multi-line review UI/API exposes fixture-backed lines, catalog candidates and explicit corrections; offline tests use the supplied expected results for review outcomes. This closes the synthetic fixture deliverable and offline contract coverage only; it does not prove live Gemini extraction, live catalog connectivity or supply a verified anonymized order for the sample-order screen. |
| P2-OM-010 | Anonymized real defect photos and labels/associated data | Om | Not recorded | `BLOCKED BY EXTERNAL INPUT` | P2-AI-015–016; Day 3 demo | Read-only GCS inventory has 12 JPEGs under `gs://prepagent-hack-data/photos/`, including folders `crack`, `crushed`, `delam`, `good`, `print`, `warp` and two video/scrap images. Folder labels and object presence do not establish consent, anonymization, class mapping, label quality or train/eval splits. Om must confirm provenance/consent, authoritative class mapping for all photo classes and the evaluation split. |

## 9. Testing and code quality

The latest supplied audit’s results are recorded as historical evidence, not
as tests rerun during this tracker-only task.

| ID | Check / acceptance | Status | Evidence and scope | Remaining action |
|---|---|---|---|---|
| P2-TEST-001 | Offline automated tests | `[✓] VERIFIED COMPLETE` | Latest full `npm test`: **350 passed, 0 failed, 0 skipped**. The focused lifecycle/persistence/idempotency/feedback run passed **104/104**. New offline cases cover conditional Firestore races, process reconstruction, retries, storage read-back mismatch, ambiguous approval recovery and feedback retry identity. No cloud/model calls. | Rerun when code changes; do not equate with E2E acceptance. |
| P2-TEST-002 | JavaScript syntax checks | `[✓] VERIFIED COMPLETE` | `node --check` passed for every JavaScript source and test file changed in this lifecycle batch. | Rerun on changed JS. |
| P2-TEST-003 | JSON/config validation | `[✓] VERIFIED COMPLETE` | Phase 5 parsed `package.json`, `package-lock.json`, and every `config/*.json`; deployment manifest project/region checks matched `prepagent-hack`, `asia-south1`, and `us-central1`. | Rerun when manifests change. |
| P2-TEST-004 | `npm audit` | `[✓] VERIFIED COMPLETE` | Phase 5 `npm audit`: 0 vulnerabilities. | Audit when dependencies change. |
| P2-TEST-005 | Git whitespace check | `[✓] VERIFIED COMPLETE` | `git diff --check` passed; added/untracked project files were separately checked because the workspace Git status lists the project directory as untracked and ordinary `git diff --check` does not inspect untracked files. | Check every code change. |
| P2-TEST-006 | Local HTTP smoke/route tests | `[✓] VERIFIED COMPLETE` | Current `test/app.test.js`: 15 passed, 0 failed. The synthetic `/jobs` request returns the explicit unavailable extraction stage and a run ID; its SSE endpoint replays `run.started`, `extractOrder` unavailable and `run.failed`. `GET /jobs/:id` returns `503` while retrieval is unconfigured and `400` for a blank ID; `GET /jobs` and `POST /jobs/:id/reject` remain 404. Existing validation, health and UI tests pass. No cloud call. | Extend only with future genuine integration changes. |
| P2-TEST-007 | Live cloud integration checks | `PARTIALLY VERIFIED; CURRENT-SOURCE ACCEPTANCE PENDING` | Historical private Cloud Run checks verified health/status and several read routes; direct BigQuery SQL results are recorded in Sections 59–60. The deployed PO1 extraction attempt on revision `prepagent-00005-s5x` returned HTTP 503; no end-to-end job/card was created. Latest local adapters and routes are offline-tested, and current source is not deployed. No cloud check was run for this acceptance task. | Model evaluation, successful live extraction/catalog response, a persisted sensor row, and current-source route/workload-identity verification remain outstanding. Cloud operations remain unauthorized in this task. | After resolving external data/contracts, obtain operation-specific authorization to deploy the current source privately and run one cost-bounded verification per required route; do not repeat historical successful queries without a concrete need. | P2-GCP-016; P2-AI-001–014; P2-OM-001, P2-OM-003. | Each required current-source adapter returns expected output and sanitized failure behavior against its real target; record exact revision, resource, region and output. |
| P2-TEST-008 | Full purchase-order to printed job-card acceptance | `BLOCKED BY EXTERNAL INPUT AND AUTHORIZATION` | Current offline evidence includes the supplied-PO1 fixture through review confirmation, coordinator, injected conditions/prediction/optimization, DRAFT mapping/read-back, approval and approved-card retrieval. The composed fixture test and lifecycle recovery tests pass; no genuine model/catalog output or persistent cloud job/card was used. Historical deployed PO1 extraction returned 503. | Requires current approved model evaluation, authoritative optimizer semantics, a valid sensor reading, successful live extraction/catalog lookup, and authorization for current-source deployment plus the one persistent job/approval/card lifecycle. | Only after those prerequisites, execute one privately authenticated acceptance run and verify the exact PO line, service provenance, stored DRAFT, conditional approval, card URI/PDF retrieval and trace. | P2-OM-001, P2-OM-003; P2-AI-001–014; P2-GCP-016. | One approved production-prep scenario completes through approved job-card retrieval with every stage and trace tied to actual service responses. |
| P2-TEST-009 | Compile/build check | `[N/A] NOT APPLICABLE TO THIS PROJECT OR PLAYBOOK` | Project intentionally remains JavaScript ES modules with Node start script; no TypeScript compiler/build step is configured or required for current JS choice. | Revisit only if TypeScript migration is explicitly chosen. |
| P2-DEPLOY-001 | Judging demo/rehearsal and deployment acceptance | `[D] DEFERRED BY EXPLICIT DECISION` | A private Cloud Run service is deployed (revision and URL in Section 60/config manifest), but it predates the latest local source and has not passed the complete workflow; no judging rehearsal was performed. | Keep private and do not deploy the latest source or alter access without separate explicit authorization. Revisit judging rehearsal after live workflow acceptance. |

**Current Phase 1 validation summary:** `npm test`: 31 passed, 0 failed;
changed-file `node --check`, package/config JSON parsing, `git diff --check`,
`npm audit` (0 vulnerabilities), local health/root UI smoke, browser
responsive/unavailable-state checks, and an independent `pypdf` parse plus
whitespace-normalized extraction of supplied PDF content passed. No live
integration, Unicode-font rendering, or end-to-end acceptance was verified.

## 10. Live integration plan

This order is a dependency plan, **not** permission to perform cloud operations
or run a live workload without explicit task-specific authorization. Billing
is enabled for `prepagent-hack`; that does not authorize additional paid
services or permanent-table DML.

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
| P1 | P2-GCP-004–016, P2-GCP-025–030 | Task-specific user authorization and service/resource prerequisites | Billing is enabled for `prepagent-hack`; do not infer permission for additional paid services or live operations. Keep each cloud operation paused until explicitly authorized, then follow official playbook order. | Authorized, service-specific read-only verification and integration evidence. |
| P2 | P2-GCP-021, P2-DEPLOY-001 | Full app acceptance and deployment authorization | Revisit judging operations only after live workflow and cost/security review. | Verified deployed revision, demo rehearsal, budget/log checks. |

### External-blocked official task register (removed from active sequence)

| ID | Preserved playbook acceptance criteria | Evidence retained | Exact blocker and release gate |
|---|---|---|---|
| P2-GCP-010 | Playbook §2.9: create/verify the `prepagent` dataset and five tables in `asia-south1`, including documented partitioning; seed the `PLANT-01` plant row once using authoritative values. | `[✓] VERIFIED COMPLETE` — Dataset, required tables/schemas, partitioning, and a read-only plant row all match the Playbook. `PLANT-01 | Pune unit | INR | 45.0 | mr` is the exact Playbook §2.9 seed row; Om reports he re-added it, and current BigQuery read-only inspection confirms it exists. No write was repeated by us. | No setup action remains for this acceptance criterion. Keep conditions gated separately because the sensor table has no readings and the shift source is unresolved. |

## 12. Copilot session changelog

Append new entries; do not remove or rewrite prior entries.

| Date/time | Session summary | Task IDs changed | Files changed | Tests/commands and results | Remaining blockers |
|---|---|---|---|---|---|
| 2026-10-11 (time from user message: 01:20 +05:30) | Created authoritative tracker from supplied Part 2 instructions, existing audit and repository evidence. Tracker-only task; no implementation/cloud changes. | Inventory established; no statuses changed from a new cloud check. | `docs/PART2_COMPLETION_TRACKER.md` | Markdown whitespace check and content/ID/count reconciliation only; no app tests or cloud calls run. | At this historical entry, billing was reported disabled; the latest enabled state and remaining Om/live-integration blockers are recorded in Section 21. |
| 2026-10-11 (Phase 1 implementation session) | Added local supplied-JobSheet PDF rendering, operator UI, and request timeout/rate-limit guardrails. No cloud operations or deployment performed. | P2-AI-012, P2-UI-001, P2-UI-006, P2-UI-007, P2-GUARD-001, P2-GUARD-002, P2-TEST-001, P2-TEST-002, P2-TEST-005, P2-TEST-006 updated. | `package.json`, `package-lock.json`, `index.mjs`, `src/job-sheet-pdf.js`, `src/operator-ui.js`, `src/request-guardrails.js`, `test/app.test.js`, `test/fixtures/job-sheet.js`, `test/job-sheet-pdf.test.js`, `test/request-guardrails.test.js`, `docs/LOCAL_DEVELOPMENT.md`, `docs/PART2_COMPLETION_TRACKER.md` | `npm test`: 31 passed, 0 failed. `node --check` passed for all changed JavaScript. JSON validation and `git diff --check` passed. `npm audit`: 0 vulnerabilities. Local HTTP/UI smoke and browser responsive/unavailable-state check passed. PDF uses valid PDFKit document output; script-font error verified. | Noto Sans Devanagari/Japanese/Korean/Chinese font files unavailable. Per-IP limiter is in-memory/direct-socket only and not production proxy/replica-safe. Billing, cloud integrations, Om inputs and complete workflow remain blocked. |
| 2026-10-11 (Phase 1 follow-up verification) | Re-ran automated and static checks; independently parsed the generated PDF and extracted supplied identifiers/status with whitespace normalization. No source or cloud changes. | P2-TEST-001–005 evidence refreshed. | `docs/PART2_COMPLETION_TRACKER.md` | `npm test`: 31 passed, 0 failed; changed-file `node --check`, package JSON parsing, `git diff --check`, `npm audit`: 0 vulnerabilities; `pypdf` parsed the PDF and recovered job ID, order ID and draft status after whitespace normalization. | Unicode script-font assets and rendering remain blocked; per-IP proxy/replica-safe limiter remains incomplete. No cloud integration or end-to-end workflow verified. |
| 2026-10-11 01:43 +05:30 (Phase 2 read-only GCP readiness) | Rechecked project, billing, APIs, IAM, BigQuery, bucket, Pub/Sub, build/registry/Run access, Logging, manifests and safety gates. No cloud mutations or workloads. | P2-GCP-001–031 evidence refreshed; no cloud task marked complete based on a manifest. | `docs/PART2_COMPLETION_TRACKER.md` only. | Read-only `gcloud`/`bq` commands and local manifest/gate checks are enumerated in Section 14. Disabled-API listing errors and two unsupported read-only CLI subcommands recorded there. Tracker `git diff --check` passed. No application tests (documentation-only). | At this historical entry billing was reported false. Bucket and Pub/Sub resources were absent. Multiple APIs were disabled; Build/Artifact Registry/Run services could not be inspected. Default Compute worker identity absent. Plant seed not run. Om CSV missing. API-specific activation/resource creation required further authorization. |
| 2026-10-11 01:53 +05:30 (Phase 4 workflow verification) | Re-read tracker and inspected workflow routes, service ports, local helpers and test coverage. No agreed demo input or newly provisioned service found; stopped at preflight without submitting customer input or making cloud calls. | P2-TEST-008 and P2-AI-001 workflow evidence refreshed; no integration completed. | `docs/PART2_COMPLETION_TRACKER.md` only. | `node --test test/app.test.js`: 12 passed, 0 failed. These tests assert explicit unavailable responses and local-only PDF behavior; they do not demonstrate live workflow completion. `git diff --check` passed. | Workflow failed preflight before stage 1: actual agreed PO input absent; extraction and conditions ports return 503; all downstream AI/BigQuery/Storage/approval/feedback services remain blocked or not implemented. |
| 2026-10-11 01:58 +05:30 (Phase 5 final acceptance/deployment gate) | Re-read tracker; checked for genuine demo inputs, real adapter/SSE/idempotency wiring, refreshed billing/API state, ran offline quality/security/config checks and produced a deployment-readiness assessment. No cloud mutations or deployment. | P2-TEST-001–008 and P2-DEPLOY-001 evidence refreshed; no cloud integration completed. | `docs/PART2_COMPLETION_TRACKER.md` only. | `npm test`: 31 passed, 0 failed; `node --test test/app.test.js`: 12 passed, 0 failed; syntax/config checks passed; `npm audit`: 0 vulnerabilities; credential-pattern and tracked-env-file scans clean; manifest project/region check passed; `git diff --check` passed. End-to-end test not run because genuine agreed inputs/services are unavailable. | At this historical entry billing was reported false; latest status is enabled. Required APIs and live workflow remained incomplete; no demo PO, live adapters, SSE, idempotent job creation, BigQuery/Storage workflow, deployment authorization, or live workflow evidence. |
| 2026-10-10 20:55 (focused 19-task sprint) | Reconciled the selected partial tasks; added licensed Noto font assets, completed local PDF rendering, verified responsive UI behavior, expanded guardrail/readiness tests and documented safe cloud troubleshooting. No cloud commands, live integrations, resource changes or deployment. | P2-AI-012 and P2-UI-006 promoted to verified for their local contracts; remaining 17 selected IDs stay partial. The 21 frozen verified-complete task statuses/evidence were not changed. | `src/job-sheet-pdf.js`, `src/operator-ui.js`, `src/request-guardrails.js`, `assets/fonts/**`, `test/job-sheet-pdf.test.js`, `test/app.test.js`, `test/request-guardrails.test.js`, `test/cloud-readiness.test.js`, `test/cloud-tool-gates.test.js`, `docs/LOCAL_DEVELOPMENT.md`, `docs/CLOUD_INTEGRATION_TODO.md`, `config/gcp-vertex-ai.json`, `docs/PART2_COMPLETION_TRACKER.md`. | `npm test`: 45 passed, 0 failed; focused PDF/app tests: 24 passed, 0 failed; changed-JS syntax checks and `git diff --check` passed. Browser: no horizontal overflow at 320/390/768/1024/1440px; `/api/status` 200; conditions 503 honestly shown; local test-fixture PDF route 200 and Quick Look visually displayed all four scripts. | Billing/API/resource/Om prerequisites remain unchanged. PDF task completion is local rendering only; no Storage upload. Rate limiter remains per-process/direct-socket, and cloud workflow/live task acceptance is incomplete. |
| 2026-10-11 (focused 17-task source-backed sprint) | Consulted the actual playbook/blueprint, audited the requested task implementations and evidence, fixed stale PDF-link cleanup after render errors, tightened PDF upload signature validation, added the fixed-window boundary regression test, reconciled stale font/source-location notes, and documented exact dispositions. No cloud operations. | P2-GCP-003, 005, 010, 013, 017–020, 023, 025, 027–030, P2-UI-001, P2-UI-007 and P2-GUARD-001 reviewed; P2-AI-012/P2-UI-006 remain complete only for local scope. | `index.mjs`, `src/operator-ui.js`, `test/app.test.js`, `test/request-guardrails.test.js`, `docs/PART2_COMPLETION_TRACKER.md` | `cd prepagent && npm test`: 46 passed, 0 failed; `node --test test/app.test.js test/request-guardrails.test.js`: 21 passed, 0 failed; guardrail-only tests: 8 passed, 0 failed; project JS syntax, package/config JSON parsing, tracker whitespace/final-newline check, `git diff --check`, and changed-scope credential-pattern scan passed. Browser checks used local/test-intercepted states only. An initial parallel test invocation collided on fixed port 4100 and failed 3 fetch tests; sequential reruns passed. | At the time of this historical entry, billing was recorded disabled; latest state is enabled. Cloud facts remain historical; Om inputs/services remain unavailable; P2-GUARD-001 is not proxy/replica safe; end-to-end acceptance remains 0/1. |
| 2026-10-11 (five not-started task implementation) | Read the authoritative blueprint, playbook PDF and companion DOCX, then inspected the five selected tracker tasks and current routes/contracts. Added source-supported language and currency controls only; left the end-to-end workflow and execution trace/SSE unimplemented because genuine upstream execution is unavailable and no event wire lifecycle is specified. No cloud operations. | P2-UI-002, P2-UI-003, P2-UI-004, P2-AI-009, P2-AI-010 reviewed; UI-003/UI-004 are partial, UI-002/AI-009/AI-010 remain not started. | `index.mjs`, `src/operator-ui.js`, `src/display-currency.js`, `test/app.test.js`, `test/display-currency.test.js`, `docs/PART2_COMPLETION_TRACKER.md` | `npm test`: 49 passed, 0 failed. Focused `node --test test/display-currency.test.js test/app.test.js`: 16 passed, 0 failed. JavaScript syntax, package/config JSON parsing, tracker ID/status reconciliation, whitespace/final newline and `git diff --check` passed. Browser verified selector status and display conversion using an intercepted test-only dated FX fixture; no external FX call. An initial focused assertion expected a different validation message; corrected and reran successfully. | Translation API/glossary and Om glossary data remain absent; risk/job-card services are unavailable; seven-tool orchestration and event contract are absent. At this historical entry billing was reported disabled; no APIs/resources, production uploads, live service calls or deployment occurred. |
| 2026-10-11 (five-task local capability follow-up) | Expanded the partial UI tasks with static interface translations, recognized-result display-only currency conversion, and local bounded trace/SSE infrastructure with EventSource UI. Fixed duplicate replay/live delivery and bounded the subscriber queue with explicit overflow signaling. This supersedes the earlier same-day statement that AI-009/010 had no infrastructure; it does not claim genuine trace production or full acceptance. No cloud operations or production data. | P2-UI-002/003/004 and P2-AI-009/010 remain partial; dashboard now reflects 5 partial and 0 not-started tasks. | `index.mjs`, `src/operator-ui.js`, `src/display-currency.js`, `src/localization.js`, `src/money-contracts.js`, `src/trace-registry.js`, `src/trace-routes.js`, `test/app.test.js`, `test/display-currency.test.js`, `test/localization.test.js`, `test/money-contracts.test.js`, `test/trace-registry.test.js`, `test/trace-routes.test.js`, `docs/PART2_COMPLETION_TRACKER.md` | `npm test`: 65 passed, 0 failed. `node --test test/app.test.js`: 13 passed, 0 failed; `node --test test/trace-routes.test.js`: 5 passed, 0 failed. JavaScript syntax and package/config JSON checks passed; translation coverage confirmed for 7 locales × 91 strings; `git diff --check` passed. No live FX call, cloud operation, actual agent tool trace, or end-to-end workflow was verified. | Om glossary/approved terminology and PO inputs are absent; translation API, production services and real orchestration remain unavailable. The local trace event contract is implementation-defined pending alignment with the genuine runner. At this historical entry, billing was reported disabled; latest state is enabled. |
| 2026-10-11 12:22 +05:30 (source-grounded five-task audit) | Re-read the supplied playbook PDF/DOCX, blueprint PDF and authoritative tracker; traced current routes, default service ports, mock helpers, localization, FX, trace/SSE and tests. Moved the pre-existing static UI dictionary into the seven source-required locale JSON files, added three ordinary request-field labels as clearly static/unreviewed UI copy, and added an allow-listed JSON route/tests. Reclassified all five target tasks as externally blocked because no safe acceptance work remains before Om inputs and genuine upstream services are available; retained secondary cloud/authorization blockers. No cloud operations or production data. | P2-UI-002/003/004 and P2-AI-009/010 moved from partial to blocked by external dependency; dashboard reconciled to 0 partial and 26 external-blocked overall. No other task status changed. | `index.mjs`, `package.json`, `package-lock.json`, `src/localization.js`, `src/locales/*.json`, `src/operator-ui.js`, `test/app.test.js`, `test/localization.test.js`, `docs/PART2_COMPLETION_TRACKER.md` | `npm test`: 66 passed, 0 failed. Focused five-task suites: 33 passed, 0 failed. `node --check` passed for project JS; package/config/locale JSON parsed; `git diff --check` passed; task inventory reconciled to 88 unique IDs. No live FX, Google Cloud, Translation, Gemini, production workflow or trace operation was run. | All five genuine POs, Om glossary CSV/approved locale terms, production lot/feedback data, sensor season profile, trained-model/predict/optimizer/explain/similar-runs SQL, demo lot and defect photos are absent. Cloud integrations and P2-AI-008 orchestration remain unavailable; trace/SSE protocol details are not specified by the source documents. |
| 2026-10-11 12:49 +05:30 (full inventory completeness sweep) | Reconciled the 21 official requirements and 67 audit-derived subtasks against the actual playbook PDF and companion DOCX, Blueprint 3, current source, tests and prior artifact evidence. Confirmed the three request-field labels are localized as ordinary static UI copy, not glossary translations. No further independently completable source-required work was found; no status was changed and no production behavior was simulated. | None; dashboard status counts remain unchanged. | `docs/PART2_COMPLETION_TRACKER.md` | `npm test`: 66 passed, 0 failed. Direct PDF text extraction checked playbook pp. 9–10, 15 and Blueprint pp. 2–3, 6, 13–14, 17; companion DOCX text was read. `git diff --check` passed before this documentation update; 88 unique task IDs and the dashboard arithmetic reconcile. No cloud, billing, deployment, FX-provider, Gemini, Translation or production-data operation was performed. | Om-owned POs, models/SQL, glossary, plant inputs, production lots/feedback, demo lot and defect photos remain unavailable. Real service adapters and authorization remain prerequisites; source documents do not define a final trace/SSE event protocol. |
| 2026-10-11 17:03 +05:30 (GCP-010 evidence reconciliation) | Updated the authoritative tracker from the latest verified BigQuery and billing evidence; preserved earlier disabled-billing and dry-run results as historical. No commands, SQL, application changes, or cloud resource changes. | P2-GCP-003 marked verified for enabled billing; P2-GCP-010 marked partially complete; P2-GCP-023 remains blocked pending Om-confirmed plant values and explicit authorization. Progress counts and current next actions reconciled. | `docs/PART2_COMPLETION_TRACKER.md` only. | Documentation-only review of supplied evidence; no tests, commands, SQL, or cloud operations run. | No permanent-table DML or seed execution; Om confirmation and explicit authorization remain outstanding; production workflow remains unverified. |
| 2026-10-11 17:19 +05:30 (P2-GCP-009 read-only preflight evidence) | Recorded the user-supplied read-only project, active-account, project-owner, Cloud Storage API, and bucket-not-found results. No cloud operation, API change, resource creation, permission change, command, or SQL was performed. | P2-GCP-009 evidence refreshed; status remains incomplete. No GCP-010 or unrelated status changed. | `docs/PART2_COMPLETION_TRACKER.md` only. | Documentation-only update from supplied evidence; no tests or commands run. | Bucket remains not found/not created; do not create under the no-out-of-pocket constraint. Owner permission is not authorization. Location and UBLA remain unverified. |
| 2026-10-11 (GCP-010 blocker move; next item GCP-011) | Moved P2-GCP-010 out of the active sequence into the external-blocker register, preserving its acceptance criteria/evidence and recording Om's written-confirmation plus explicit-DML-authorization gates. Advanced to P2-GCP-011 and recorded the already documented 2026-10-11 read-only Pub/Sub audit evidence; no cloud calls, resource changes, or message operations were performed. | P2-GCP-010 changed from partial to external-blocked; P2-GCP-011 changed from cloud-blocked to verified for topic/subscription resource configuration only. Dashboard counts adjusted for these two transitions. | `docs/PART2_COMPLETION_TRACKER.md` only. | Documentation-only update using existing recorded audit evidence; `git diff --check` passed. | P2-GCP-010 still needs Om's written authoritative plant values and separate authorization before permanent-table DML/seed. P2-GCP-011 has no message publish/consume evidence. |
| 2026-10-13 (stored JobSheet GET and operator job-lifecycle errors) | Implemented `GET /jobs/:id` stored-JobSheet lookup, operator load-job UI, `/jobs` Idempotency-Key, `blockedAt`/conflict error copy, and HTTP 409 for `IDEMPOTENCY_IN_PROGRESS`. No cloud writes or live retrieval. | P2-AI-011, P2-UI-001, P2-GUARD-003 evidence refreshed; statuses remain partial. P2-TEST-001/006 evidence refreshed. | `src/stored-job-sheet-lookup.js`, `index.mjs`, `src/operator-ui.js`, `src/locales/*.json`, `test/stored-job-sheet-lookup.test.js`, `test/app.test.js`, `docs/PART2_COMPLETION_TRACKER.md`, `docs/CLOUD_INTEGRATION_TODO.md`. | `npm test`: 214 passed, 0 failed; focused lookup+locale: 9 passed; `node --check` on changed runtime files and `git diff --check` passed. | Genuine stored JobSheet, Firestore enablement, Om optimizer/evidence SQL, approved PO, sensor data, and Cloud Run deployment remain outstanding. |
| 2026-10-13 (`/jobs` draft-persistence contract) | Implemented `/jobs` draft persistence through the coordinator and idempotency wrapper with offline doubles. Fixed a fallback that retried preparation on any “not configured” tool error. Persist write args now include plant, savings, and currency; the UI treats only `durable: true` as a stored job. | P2-AI-011 evidence refreshed; remains partial. P2-TEST-001/002 refreshed. | `src/job-draft-persistence.js`, `src/job-coordinator.js`, `src/service-ports.js`, `src/operator-ui.js`, `index.mjs`, `test/job-draft-persistence.test.js`, `test/job-coordinator.test.js`, `test/app.test.js`, `docs/PART2_COMPLETION_TRACKER.md`. | `npm test`: 228 passed, 0 failed; `node --check` on changed runtime files and `git diff --check` passed. No cloud writes. | Live BigQuery draft write via `/jobs`, Firestore enablement, Om optimizer/evidence SQL, approved PO, sensor data, Cloud Run. |

## 13. Decisions and blockers

- **Billing is enabled for `prepagent-hack`;** this does not authorize
  additional cloud operations or paid services without explicit approval.

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

- The authoritative Part 2 source documents are in the workspace-level
  `../../docs/` directory. Keep those reference PDFs/DOCX outside commits; use
  their exact paths and section/page references when resolving requirements.

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

This section is a historical snapshot: billing was reported disabled at that
time. The latest verified evidence, recorded in Section 21, confirms billing
is now enabled for `prepagent-hack` and updates GCP-010. Historical outcomes
below are retained and are not current-state claims.

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

### Historical live-state snapshot (superseded by Section 21 where noted)

The following rows preserve an earlier audit snapshot and its original
observations. They are not the current status for tasks reconciled in Section
20; use Sections 3, 6, and 20 for current status and evidence.

| Tracker ID | Class | Current evidence and exact blocker | Next action / authorization |
|---|---|---|---|
| P2-GCP-001 | F | Node v22.17.1, Git 2.54.0, gcloud 531.0.0 and bq 2.1.20 available. Active project is `prepagent-hack`; active account exists (identity not recorded). | None. |
| P2-GCP-002 | F | `env.sh` non-secret project, region, translation region, bucket and runtime identity match the tracker; Om setting matches the tracker identity. File is ignored by Git. | None; keep credentials out of the file. |
| P2-GCP-003 | E | At this snapshot, intended project existed and was active; billing state was `False`. | Historical next action was to keep billing disabled; latest enabled state is recorded in Section 21. |
| P2-GCP-004 | B, E | ₹5,000 budget alert has not been created; billing is intentionally disabled. | Requires explicit user approval to change billing state and the required billing-account setup. |
| P2-GCP-005 | G, E | Enabled required APIs: BigQuery, Cloud Storage and Cloud Logging. Not enabled: Cloud Run, Cloud Build, Artifact Registry, Vertex AI, Pub/Sub, Dataflow, Translation and Compute. | Leave unchanged. Verify API-specific billing/prerequisites and obtain explicit authorization before enabling any API. |
| P2-GCP-006 | F | Project IAM policy confirms Om has project-level `roles/editor`; no direct Om dataset ACL was found. | None; no IAM change. |
| P2-GCP-007 | F | Runtime service account exists/enabled with `roles/aiplatform.user`, `roles/bigquery.dataEditor`, `roles/bigquery.jobUser`, `roles/cloudtranslate.user`, `roles/pubsub.publisher`, `roles/storage.objectAdmin`. Zero user-managed keys were listed. | None; do not create keys or alter roles. |
| P2-GCP-008 | G | Prior audit verified ADC; this session did not inspect token/credential material or confirm quota-project state. Installed CLI rejected the attempted `gcloud auth application-default get-quota-project` command as unsupported. | If necessary, use a documented supported method that does not print/expose credentials. |
| P2-GCP-009 | B | Historical Phase 2 read-only snapshot reported `gs://prepagent-hack-data` not found (404), with Storage API enabled. Latest read-only preflight reconfirmed active project `prepagent-hack`, active account `aibuildercup2026@gmail.com`, project IAM `roles/owner`, enabled `storage.googleapis.com`, and bucket describe 404 / not found. Bucket has not been created. | Keep absent under the no-out-of-pocket constraint. Owner permission does not constitute authorization to create a resource or incur costs. Do not create without separate explicit authorization. |
| P2-GCP-010 | F, B | At this snapshot, dataset `prepagent` existed in `asia-south1`; five tables were present. `lots` daily partitioned on `run_date`; `sensor_readings` daily partitioned on `ts`; `plants`, `job_sheets`, `feedback` unpartitioned. Plant seed remained unexecuted. | Historical next action was to preserve schemas and not retry seed/DML. Latest query, temporary-table DML, permissions and seed blockers are recorded in Section 21; no permanent-table DML is claimed. |
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
| P2-GCP-023 | B, E | At this snapshot, plant seed SQL existed, no seed was performed, and the earlier dry-run was blocked by the then-current billing restriction. | Historical next action was to wait for explicit authorization and billing/query eligibility; later evidence and current next action are recorded in Section 21. |
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
| `gcloud storage buckets describe gs://prepagent-hack-data --format='yaml(name,location,uniformBucketLevelAccess,iamConfiguration.uniformBucketLevelAccess)'` | Historical Phase 2 result: 404, bucket absent. The latest read-only preflight again returned 404 / not found; the bucket has not been created. |
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
at that time. Later evidence supersedes the billing/query uncertainty: billing
is enabled for `prepagent-hack`, `SELECT 1 AS query_test` succeeded, and
temporary-table DML succeeded. It would still be unsafe to fabricate a
`PLANT-01` selection or treat unconfirmed seed values as authoritative.

### Integration readiness by dependency order

| Step | Tracker IDs | Result | Missing prerequisite / safe next action |
|---|---|---|---|
| A. PDF order extraction | P2-AI-001, P2-APP-005 | **STOPPED — blocked** | Vertex API disabled; intended Storage bucket absent; Om anonymized POs absent. Obtain real samples and explicit service/billing authorization before adding SDK wiring or calling services. |
| B. BigQuery sensor conditions | P2-AI-002, P2-APP-007 | **STOPPED — blocked** | BigQuery dataset/schema, read-only query capability, temporary-table DML capability and permissions are verified. The app/environment exposes no plant ID; actual sensor readings were not established; source Pub/Sub topic/subscription and Dataflow are absent. Obtain approved plant-selection behavior, ingestion/data evidence and explicit authorization before a production query. |
| C–D. Risk models, optimization and evidence | P2-AI-003–006, P2-OM-001–004 | **STOPPED — blocked by Om** | Model identities, training/evaluation evidence, prediction SQL, optimizer objective/grid, explain/evidence SQL are absent. Do not invent models or queries. |
| E–I. Agent loop, trace/SSE, JobSheet, persistence, card upload, approval | P2-AI-007–014 | **STOPPED — upstream services not ready** | No live Gemini, Storage, BigQuery writer, model/optimizer/evidence chain or generated real JobSheet; Storage bucket absent. Work only after upstream real integrations and explicit service/deployment authorization. |
| J. Translation glossary | P2-AI-017, P2-GCP-015, P2-OM-005 | **STOPPED — Om and cloud blockers** | Om CSV absent; Translation API disabled and glossary/bucket not provisioned. Obtain CSV and explicit authorization before API/resource operations. |
| K. Photo diagnosis and feedback | P2-AI-015–016, P2-OM-010 | **STOPPED — Om and cloud blockers** | Actual consent-cleared labeled photos absent; Vertex disabled; Storage bucket absent; no BigQuery persistence integration. Wait for assets and authorization. |

### Exact prerequisite checks performed

| Read-only check | Result |
|---|---|
| `gcloud services list --enabled --project=prepagent-hack --filter="config.name=bigquery.googleapis.com"` (equivalent per-API filters for Storage, Vertex, Pub/Sub, Dataflow, Translation, Compute, Run, Cloud Build, Artifact Registry and Logging) | BigQuery, Storage and Logging enabled; Vertex, Pub/Sub, Dataflow, Translation, Compute, Run, Cloud Build and Artifact Registry not enabled. |
| `gcloud billing projects describe prepagent-hack --format='value(billingEnabled)'` | `False` in this historical Phase 3 check; superseded by the latest verified state (billing enabled), recorded in the newest tracker addendum. |
| `bq show --format=json prepagent-hack:prepagent.sensor_readings` | Table exists in the previously verified `asia-south1` dataset; partition field `ts`. Metadata only; no row query in that historical Phase 3 check. |
| `gcloud projects get-iam-policy prepagent-hack --format=json` (filtered locally to runtime identity) | Runtime service account has `roles/bigquery.dataEditor` and `roles/bigquery.jobUser` among its existing documented roles. No IAM changes. |
| `gcloud storage buckets describe gs://prepagent-hack-data --format='value(name)'` | 404, intended bucket absent. |
| Local `env.sh` variable-name inspection and repository search for plant selection | Variables are `PROJECT_ID`, `REGION`, `TR_REGION`, `BUCKET`, `SA`, `OM_EMAIL`; no plant ID variable or conditions-route plant parameter found. Values/secrets not printed. |
| Root `npm ls --depth=0` and tools dependency inventory | Root app has no Google Cloud SDK dependency. `tools/` has Pub/Sub and GenAI packages only; no BigQuery or Cloud Storage SDK. |
| Repository search for SQL/model/glossary artifacts | Only plant seed and proposed remediation SQL exist; no model/prediction/optimizer/evidence SQL or glossary file. The playbook/blueprint PDFs named in the tracker were absent from that audit's current reference directory. |

No SDK dependency was added because no integration passed the prerequisite
gate. A live production query/test was not attempted in this historical phase;
no cloud operation was run. Existing unavailable ports remain in effect. API
statuses are not interpreted as service readiness or billing permission.
Correction recorded in Section 19: the source PDFs were subsequently located in
the workspace sibling `../untracked_reference_docs/` and inspected. The earlier
repository/reference-directory search did not establish their absence from the
workspace.

## 16. Phase 4 — production-preparation workflow verification (2026-10-11)

### Precise result

**The workflow did not start; it failed preflight before stage 1.** No agreed
demonstration purchase-order file is present in the workspace, and the
`POST /orders/extract` port has no live adapter and returns
`503 SERVICE_UNAVAILABLE`. At the time of this historical Phase 4 review,
billing was reported disabled; the latest verified state is enabled as
recorded in the newest tracker addendum. The actual demo input was not
fabricated or substituted with a test fixture. No production data was
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
services/resources are available, and each cloud operation has explicit
task-specific authorization. Billing is currently enabled; no additional
paid-service authorization is implied.

## 17. Phase 5 — final acceptance and deployment readiness (2026-10-11)

This section records the state at the time of the Phase 5 review. Its billing
and cloud-readiness statements are historical; Section 21 records the latest
verified billing and BigQuery evidence.

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
| Live integration / real-data E2E | **Not run / blocked** | Billing was `False` at the time of Phase 5; it is now verified enabled. APIs/resources and Om inputs remain unverified or absent in this workflow. No production query, upload, model/Translation call, build, job, or deployment was made. |

No user-facing success state was introduced in this phase. Current routes use
explicit unavailable results when cloud ports are unconfigured. The real
workflow still has no idempotency/deduplication guarantee; duplicate-job
prevention must be implemented and tested with a real persistence design before
enabling job creation.

### Deployment gate and judging readiness

**Deployment: NOT AUTHORIZED and NOT PERFORMED.** At the time of this
historical Phase 5 review, billing was reported disabled; the latest verified
state is enabled as recorded in Section 21. Cloud Run, Cloud Build and
Artifact Registry APIs were recorded disabled in the historical snapshot and
were not refreshed by the latest evidence. The intended Storage bucket and
Pub/Sub resources were not established by the latest checks; app cloud ports
remain unconfigured; public access/security review and real end-to-end
acceptance are outstanding. No public service was exposed.
**Judging readiness: NOT READY for the promised production-preparation demo.**
The application can demonstrate its local UI, validation, unavailable states,
and local PDF rendering only when supplied a valid JobSheet input. It cannot
demonstrate the required PO-to-feedback workflow or show genuine production
conditions, predictions, recommendations, evidence, job persistence, uploaded
card, approval, or feedback.
Next prerequisites: agreed anonymized PO/demo fixtures and Om artifacts
(P2-OM-001–010); task-specific API/resource authorization and verification
(P2-GCP-004–016, P2-GCP-023–030; billing is currently enabled for the
project); actual integrations and duplicate protection
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
| P2-GCP-003 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | At the time of this historical sprint, the prior read-only snapshot reported billing disabled; no GCP calls or billing changes occurred then. Latest evidence now confirms billing enabled for `prepagent-hack`; do not infer authorization for further changes. |
| P2-GCP-005 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Required-API state remains the historical snapshot in Sections 6 and 14. No API activation was attempted. Verify API-specific prerequisites and obtain explicit authorization before any activation. |
| P2-GCP-010 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | At the time of this historical sprint, schema/partition verification was retained and seed/DML was not retried. Latest evidence verifies dataset, schemas, partitioning, a read-only query, temporary-table DML and permissions; permanent-table DML remains untested and the seed remains blocked pending Om-confirmed values and explicit authorization. |
| P2-GCP-013 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Offline cloud-tool gate tests passed with default opt-in disabled; no publisher or cloud command was run. Do not publish without the actual resources and authorized test window. |
| P2-GCP-017 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Added an API-to-capability map and safe diagnostic/stop guidance to `docs/CLOUD_INTEGRATION_TODO.md`. No fresh cloud state was obtained; disabled-API resource uncertainty remains. |
| P2-GCP-018 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Local app and PDF renderer exist, but actual PDF extraction, agreed real PO, Vertex/Storage integration and deployment remain unavailable. Requires real input, cloud prerequisites and authorization. |
| P2-GCP-019 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | The local PDF renderer is now verified under P2-AI-012. Model/optimizer/evidence SQL, Gemini orchestration/SSE, persistence and the genuine `/jobs` workflow remain incomplete. |
| P2-GCP-020 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Responsive local operator UI was browser-checked. Trace, full workflow, real integrations, approval, feedback, translation and deployment remain unavailable. |
| P2-GCP-023 | PARTIALLY COMPLETE | PARTIALLY COMPLETE | Seed SQL remains unexecuted. The prior billing-disabled dry-run rejection is historical; later read-only query and temporary-table DML checks succeeded. No permanent-table DML or seed result is claimed. Wait for Om-confirmed plant values and explicit authorization. |
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
blocked. Genuine PO/Om artifacts and task-specific API/resource
authorizations are still required; billing is enabled for `prepagent-hack`.
The successful local PDF/UI checks are not cloud integration evidence.

## 19. Focused 17-task source-backed sprint (2026-10-11)

The task dispositions below are the historical close-of-sprint record. The
latest GCP-003, GCP-010 and GCP-023 status/evidence superseding them is in
Section 21; earlier billing and dry-run outcomes are retained as history.

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
| P2-GCP-003 | `[D] DEFERRED BY EXPLICIT DECISION` | At this historical sprint close, CLI evidence recorded project `prepagent-hack` existed while `billingEnabled=False`; that state was then deferred. Latest evidence supersedes it and confirms billing enabled for the project. |
| P2-GCP-005 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Local API/capability map and manifest checks are not proof of enabled APIs. Historical Phase 2 snapshot had some required APIs disabled; no fresh CLI check or activation occurred. Next: after explicit authorization, perform read-only per-API checks then separately authorize any activation. |
| P2-GCP-010 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | At this historical sprint close, metadata showed five schemas/partitioning, the seed was unexecuted, and a prior dry-run had been billing-blocked. Later evidence verifies a read-only query and temporary-table DML; permanent-table DML remains untested. Current partial status and seed blocker are recorded in Section 21. |
| P2-GCP-013 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Publisher's explicit opt-in/default refusal is covered by offline gate test; that does not prove publishing. No topic creation or publication. Next: after authorization, verify resources/API and run a bounded genuine message-to-BigQuery test. |
| P2-GCP-017 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | Consulted playbook §2.16/blueprint and documented safe diagnostics; no cloud-side diagnosis or resource refresh. Next: after cloud access/authorization, apply relevant diagnostic and independently verify the actual service/resource. |
| P2-GCP-018 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` (also external-input blocker) | Added local PDF signature validation in `index.mjs`; `test/app.test.js` verifies MIME spoof rejection and existing valid-PDF-to-503 unavailable behavior. PDF extraction/Vertex/Storage remain unavailable and Om's agreed PO set is absent. Next: obtain approved POs and service/API/billing authorization before wiring/testing real extraction. |
| P2-GCP-019 | `[B] BLOCKED BY EXTERNAL DEPENDENCY` (cloud authorization is also required) | Local contracts/helpers exist but no Om model identities, risk/optimizer/evidence SQL or glossary was supplied; live services are unavailable. Next: obtain P2-OM-001–005 artifacts, then request cloud authorization and implement the genuine integration sequence. |
| P2-GCP-020 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` (genuine demo inputs also needed) | Local UI is responsive and states limitations honestly; the required live trace, risk/evidence, workflow, feedback and deployed demonstration cannot proceed without genuine endpoints. Next: authorize/provision services and obtain Om demo inputs, then connect and accept against actual responses. |
| P2-GCP-023 | `[$] BLOCKED BY BILLING/CLOUD ACCESS` | At this historical sprint close, static seed SQL/gate was inspected; no DML, query or blocked dry-run was performed in that sprint. Later evidence confirms a read-only query and temporary-table DML, but no permanent-table DML or seed. Current blocked status and next action are recorded in Section 21. |
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

- At the time of this historical Phase 5 review, billing was reported
  disabled; latest evidence confirms it is enabled for `prepagent-hack`.
  No API was enabled, no cloud resource was
  created/modified, no production data was uploaded, no live production call
  was made, and no deployment occurred.

## 21. Cloud evidence reconciliation (2026-10-11)

### Current verified state

This evidence reconciliation combines existing recorded evidence with the
single targeted read-only Storage metadata check documented below. No SQL,
message operation, Dataflow job, model call, resource mutation, or application
code change was performed.

| ID | Current status | Verified evidence | Remaining blocker / next action |
|---|---|---|---|
| P2-GCP-003 | `[✓] VERIFIED COMPLETE` | Billing is enabled for project `prepagent-hack`. Earlier records showing billing disabled are retained above as historical snapshots. | No billing change is requested or authorized by this status reconciliation. Do not infer authorization for additional paid services or cloud operations. |
| P2-GCP-010 | `[!] PARTIALLY COMPLETE` | Dataset `prepagent` exists in project `prepagent-hack`, location `asia-south1`. The expected five tables (`plants`, `lots`, `sensor_readings`, `job_sheets`, `feedback`) and schemas were verified. `lots` is partitioned by `run_date`; `sensor_readings` is partitioned by `ts`; the other three are unpartitioned. `SELECT 1 AS query_test` succeeded. Temporary-table DML succeeded: create, insert one row, update it, and read the resulting value. Active account `aibuildercup2026@gmail.com` was verified as project Owner and dataset Owner. `plants` was observed with zero rows. `docs/bigquery-seed-plant.sql` contains a prepared `PLANT-01` MERGE and has not been executed. | Permanent-table DML has not been tested. The seed is blocked pending Om's confirmation of authoritative plant values and explicit user authorization. Obtain Om's confirmed configuration; do not execute the seed or test against permanent `plants` before authorization. |
| P2-GCP-023 | `[B] BLOCKED BY EXTERNAL DEPENDENCY` | Prepared seed remains unexecuted. Its `cost_per_kg = 45.0` and `default_locale = 'mr'` have not been confirmed by Om and must not be treated as authoritative. The earlier billing-disabled DML dry-run rejection is historical; subsequent read-only query and temporary-table DML checks succeeded. | Obtain Om's confirmed plant-specific values and explicit user authorization. Do not execute the prepared seed or test permanent-table DML before authorization. |

### Historical evidence and interpretation

- The earlier billing-disabled DML dry-run rejection is preserved in the
  dated audit entries above. It is not the current query state.

- Successful temporary-table DML is not evidence that DML against the
  permanent `plants` table was tested.

- No seed result, permanent-table DML result, or Om confirmation is claimed.

- GCP-010 remains partially complete; no frozen verified task was changed.

- Current progress totals above include the GCP-003, GCP-010, and GCP-023
  updates plus the GCP-025, GCP-026, and GCP-030 evidence reconciliations
  below. The plant seed remains blocked and is not included as completed work.

### P2-GCP-009 historical read-only preflight (2026-10-11)

| Check | Historical read-only result |
|---|---|
| Active project | `gcloud config get-value project` returned `prepagent-hack`. |
| Active account | `gcloud auth list --filter="status:ACTIVE" --format="value(account)"` returned `aibuildercup2026@gmail.com`. |
| Project IAM | Project IAM policy confirmed `roles/owner` for that account. This permission is not authorization to create resources or incur costs under the no-out-of-pocket constraint. |
| Cloud Storage API | `gcloud services list --enabled` included `storage.googleapis.com`; no API enablement was performed as part of this preflight. |
| Intended bucket | The historical `gcloud storage buckets describe gs://prepagent-hack-data` returned 404 / not found. This is superseded by the successful later read-only metadata check below; the exact time of the historical 404 is not recorded. |
| Acceptance configuration | The 404 did not verify bucket configuration. A later check now confirms the bucket's required regional location and uniform bucket-level access. |
| Status / interpretation | The old result is retained as history, not current state. The bucket's recorded creation time is `2026-10-11T11:58:24+0000`; the available evidence does not establish the exact time of the old 404 relative to creation. |

### Current targeted reconciliation (2026-10-11)

The checks below were read-only. They did not create or modify resources,
publish or consume messages, start Dataflow, execute BigQuery DML, or call a
model.

| ID / check | Evidence and decision |
|---|---|
| P2-GCP-009 / P2-GCP-025 — Storage | Active project check exited 0 and returned `prepagent-hack`. `gcloud storage buckets describe gs://prepagent-hack-data --project=prepagent-hack --format='yaml(name,projectNumber,location,storageClass,iamConfiguration.uniformBucketLevelAccess,iamConfiguration.publicAccessPrevention)'` exited 0. Full metadata confirms name `prepagent-hack-data`, project `prepagent-hack`, location `ASIA-SOUTH1` (regional), `STANDARD`, uniform bucket-level access `true`, and public access prevention `inherited`; creation time is `2026-10-11T11:58:24+0000`. This resolves current bucket existence/configuration. No object or prefix was created or tested. The cause/timing of the historical 404 remains unproven. |
| P2-GCP-025 — Pub/Sub | Previously recorded read-only evidence confirms `sensor-readings` and ACTIVE `sensor-readings-df`, linked to the expected topic, with Pub/Sub API enabled. Together with the current bucket evidence, the documented resource-prerequisite scope is verified. No publish/consume or Dataflow delivery is claimed. |
| P2-GCP-026 — worker identity/IAM | Existing authorized preflight and `config/gcp-dataflow.json` record the expected Compute worker identity, four documented worker roles, and Dataflow service-agent binding as verified. This proves identity/IAM readiness only, not worker allocation or data delivery. `jobStartAuthorized` remains `false`. |
| P2-GCP-027 — Build/Artifact Registry | P2-GCP-005 records both APIs ENABLED. No repository existence or build result is evidenced, so this remains blocked/incomplete. Historical disabled-API notes below are superseded as API-state claims only. |
| P2-GCP-028 — Vertex/Translation | P2-GCP-005 records both APIs ENABLED and P2-GCP-014 records its one successful Gemini smoke test. Om's glossary CSV and production/model inputs remain missing; API enablement and the smoke test do not establish Translation or production workflow acceptance. |
| P2-GCP-030 — Gemini smoke test | P2-GCP-014's recorded one-time authorized `gemini-3.5-flash` / `asia-south1` invocation exited 0 and returned sanitized `ready` output at `2026-10-11T17:46:55Z`–`17:47:04Z`. The smoke-test criterion is satisfied; no repeat call is warranted. General model calls remain gated. |

## 22. GCP data handoff and implementation checkpoint (2026-10-12)

### User-confirmed scope updates

- The user approved **5,350 lots** as the target dataset size for this project.
  This supersedes the Blueprint's original 6,000-lot prototype target for
  current acceptance. Preserve the Blueprint's original figure as source
  history; do not silently restore it as the active target.

- `prepagent.items` is auxiliary. It is not an authoritative product master
  and is not part of the core PO-to-job-card contract unless its purpose is
  later specified.

- Om has **not started model training yet** and plans to run it in parallel
  with the local implementation. No trained model or evaluation result is
  claimed at this checkpoint.

- The project is using Google's $300 credit. Avoid unnecessary calls and
  keep any future BigQuery query bounded; do not infer permission for paid
  model calls, training, Dataflow, deployment, or permanent DML.

### Read-only GCP metadata inspection

Authenticated metadata listings were performed in project `prepagent-hack`.
No table query, object download, message publish/consume, model call, DML,
resource mutation, Dataflow start, or deployment was performed.

| Resource | Current observation | Acceptance limit |
|---|---|---|
| `prepagent.lots` | Metadata reports 5,350 rows. | Matches the user-approved target; this is a metadata count, not row-level data-quality validation. |
| `prepagent.items` | Metadata reports 117 rows; schema is an auxiliary item/SKU-style record with identifiers, dimensions, board attributes, and monthly quantity. | Not part of the canonical production-prep contract and not treated as authoritative. No row content was read. |
| `prepagent.plants` | Metadata reports zero rows. | Plant seed is still absent; P2-GCP-010 remains partial and P2-GCP-023 remains blocked pending authoritative plant data and separate write authorization. |
| `prepagent.sensor_readings` | Metadata reports zero rows. | No sensor-to-BigQuery delivery is established. P2-GCP-012 remains blocked, with the existing explicit decision not to retry; do not start a job. |
| `prepagent.sensor_readings_error_records` | Table exists; metadata reports zero rows. | No error-record or successful stream behavior is claimed. |
| BigQuery ML models in `prepagent` | No models were listed. | Training has not started per the user; no model acceptance or prediction integration is available yet. |
| Vertex AI model registry | No models were listed in `asia-south1` or `us-central1`. | No registered model is evidenced. The expected registry location should follow the actual training configuration. |
| BigQuery job history | The latest 20 listed jobs were `SUCCESS`; no active training run appeared in that sample. | Metadata does not prove whether another training workflow exists outside those listed services or beyond the sampled history. |
| Cloud Storage | The project has only `gs://prepagent-hack-data` in `ASIA-SOUTH1`; its object listing was empty. | No PO, photo, glossary, or other uploaded object is evidenced in the project bucket. |
| Pub/Sub | `sensor-readings` and linked `sensor-readings-df` are present; subscription ack deadline is 10 seconds. | Resource prerequisite only; no messages were published or consumed. |
| Dataflow | No active jobs were listed in `asia-south1`. | No successful sensor stream is established. |

P2-GCP-009's bucket existence/configuration and P2-GCP-025's bucket/topic/
subscription prerequisite scope remain verified. P2-GCP-026 remains based on
the prior recorded worker identity/IAM evidence; it was not rechecked in this
read. P2-GCP-030 remains based on its prior one-time Gemini smoke test; it was
not repeated.

### Local implementation checkpoint

Added `src/google-cloud/bigquery-read-client.js`, a bounded read-query
transport for future service adapters. It supports named scalar parameters,
uses Cloud Run workload identity, defaults each query to a 50 MiB
`maximumBytesBilled`, rejects mutation/multi-statement SQL, limits result rows,
and sanitizes API errors. The byte cap limits a query's bytes billed only; it
is not a project-wide spend cap. The client is not yet wired to application
routes and does not support local ADC; no query was issued by this
implementation.
`test/bigquery-read-client.test.js` covers request construction, parameter
validation, write rejection, result limits, and the metadata token provider.
The focused tests passed (6/6); `npm test` passed (96/96) after allowing local
loopback for the existing HTTP tests. These tests made no GCP calls. Task
statuses and aggregate counts are unchanged; this is a foundation, not a
completed live integration.
Added a minimal `Dockerfile` and `.dockerignore` for a future Cloud Run image.
The image packages the existing Hono application, fonts, and locale files,
uses the Node 22 slim base image, runs as the image's non-root `node` user, and
listens on the configured `PORT`. No Docker executable was available in this
workspace, so the image was not built. No Cloud Build, Artifact Registry, or
Cloud Run operation was performed; P2-GCP-016/P2-GCP-027 remain incomplete.

### Historical progress note

The previous totals recorded in earlier snapshots predate the above status
reconciliation. The executive dashboard now derives from the current detailed
task rows: 33 verified complete, 2 partially complete, 48 blocked (27
external / 21 cloud), 4 deferred, and 1 not applicable, totaling 88.
Verified completion is 33/87 applicable tasks (37.9%).

## 23. Read-only GCP handoff refresh (2026-10-12)

The user asked for a read-only inspection of Om's GCP changes. The following
metadata listings were run against `prepagent-hack`; seven bounded sample
photos were downloaded for local inspection, no BigQuery rows were read, and
no GCP resource or service was changed.

| Area | Observed evidence | Interpretation / remaining gap |
|---|---|---|
| Cloud Storage bucket | `gs://prepagent-hack-data` exists in `ASIA-SOUTH1`. | Confirms the expected bucket. |
| Photo objects | Recursive listing returned 12 JPEGs under `photos/`, total 1,776,130 bytes (1.69 MiB). Ten are under `photos/photos/{crack,crushed,delam,good,print,warp}/`; two are under `photos/video/` as `scrap_pile_1.jpg` and `scrap_pile_2.jpg`. Object metadata reports `image/jpeg`, creation times around `2026-10-11T18:51:24Z`–`18:51:27Z`, checksums, and no custom metadata. Seven representative JPEGs were downloaded to `/tmp/ustaad-photo-inspection/` for local-only inspection; each opened as a valid 1600x1200 (or 1200x1600) JPEG except the 500x450 scrap-pile image. | This supersedes the earlier empty-object-list snapshot. Folder names suggest labels but do not establish annotation provenance, consent, or train/evaluation split. Visual spot-check: `crack_001` shows a visible crack; `delam_001` shows exposed corrugation but label interpretation is uncertain; `crushed_001` and `warp_001` do not show an unambiguous defect in the inspected view; `print_001` and `good_001` show branded print, not evidence of print-defect class/negative class. `crushed` is not one of the five `DefectSchema` values; `good` is also not a defect. Branding is visible, so anonymization is not established. Treat as candidate demo assets only pending Om confirmation; do not use for training or claim acceptance. Do not mark P2-OM-010/P2-AI-015/P2-AI-016 complete. |
| Om-mentioned filenames | `items.jsonl`, `private_customer_map.csv`, `items_review.csv`, and `true.jsonl` were not found in the listed bucket objects or searched workspace/attachments by exact filename. | The BigQuery `items` table exists, but its rows were not read. `private_customer_map.csv` was not inspected; it may contain sensitive data. These files are not needed for the core contract unless Om specifies their purpose. |
| BigQuery datasets/tables | Dataset `prepagent` exists in `asia-south1`; tables listed: `feedback`, `items`, `job_sheets`, `lots`, `plants`, `sensor_readings`, `sensor_readings_error_records`. | No model identities are present in table listing. Table row counts and contents were not queried in this refresh. |
| BigQuery ML models | `bq ls --models prepagent` returned no models. | Consistent with the user's report that training has not started. No model or evaluation acceptance is claimed. |
| Vertex model registry | `gcloud ai models list` returned no models in `asia-south1` or `us-central1`. | No registered Vertex model is evidenced in those regions. The actual future training/registry location remains unconfirmed. |
| Cloud Run | `gcloud run services list` returned no services in `asia-south1`. | No deployed service is present in the checked region; no deployment was attempted. |
| Artifact Registry / Cloud Build | Artifact Registry repository listing and Cloud Build listing returned no entries in the checked region (Cloud Build list limited to 10). | No image repository or build is evidenced; no repository or build was created/run. |
| Translation glossary | The installed gcloud CLI has no `gcloud translate` command; the metadata listing could not be performed. No glossary CSV appeared in the listed bucket objects. | Glossary presence remains unverified. Do not infer absence from this unsupported CLI command or create a glossary; obtain the CSV and use an authorized supported read-only listing later. |

One BigQuery table-list attempt used an invalid flag order and returned a CLI
usage error; the corrected metadata listing then succeeded. The Translation
glossary listing also could not be run because the installed gcloud CLI does
not expose that command. No billed SQL query was issued. The limited object,
service, repository, build, and model listings were read-only. Seven sample
images were retrieved locally for visual inspection; the bucket was not
changed and no image was sent to an external service. Existing task statuses
and aggregate counts remain unchanged; the photos reduce missing-asset
uncertainty but do not satisfy consent, anonymization, taxonomy, model, or
workflow acceptance.

## 24. Offline PDF extraction integration foundation (2026-10-12)

Implemented local adapters for the Part 2 purchase-order extraction boundary:
`src/google-cloud/storage-client.js` performs a bounded, create-only media
upload request; `src/google-cloud/vertex-gemini-client.js` sends a GCS PDF for
structured JSON extraction; and `src/google-cloud/order-extraction-service.js`
validates model output against the Blueprint order schema and reports missing
fields for operator clarification. `src/service-ports.js` now composes this
port only if both `config/gcp-vertex-ai.json` enables model calls and the
runtime explicitly sets `USTAAD_ENABLE_LIVE_MODEL_CALLS=true`. The repository
manifest remains `false`, so the application continues to return its explicit
unavailable response by default. No Cloud Storage upload or model call was
made. The upload adapter enforces a 10 MiB limit and uses
`ifGenerationMatch=0`; query/model runtime authorization remains separate.
`test/google-cloud-order-extraction.test.js` covers request construction,
create-only upload, input/URI rejection, partial extraction validation, and
the disabled-by-default gate using injected fakes. `node --test
test/google-cloud-order-extraction.test.js test/bigquery-read-client.test.js
test/schemas.test.js` passed 22/22. The full `npm test` passed 103/103 when
local loopback access was allowed; the sandboxed attempt failed only where
existing HTTP tests could not bind their loopback server. `git diff --check`
and `node --check` on changed adapter files passed. No tracker task status or
aggregate count changed: extraction still lacks an approved PO input and
separately authorized live upload/inference evidence; the full production
workflow remains unaccepted.

## 25. Artifact Registry and Cloud Build (2026-10-12)

Following the user's explicit authorization to progress the cloud-blocked
workstream, the previously absent STANDARD Docker repository `prepagent` was
created in `asia-south1`. One Cloud Build (`4ba1d50b-da43-4e91-bd3d-cc6e4d0e6d3f`)
completed `SUCCESS` in 44 seconds and pushed
`asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent:part2-20261012-1`.
Read-only Artifact Registry describe verified digest
`sha256:5df24b4aac1c46eddecbb48d7204dc6de710f5d69dc022d5d81b53f5386c37e5`;
reported repository size was 118.942 MB. The build ran `npm ci --omit=dev`
and reported zero dependency vulnerabilities. The Docker context now includes
only the two runtime config files needed by `src/service-ports.js`; secrets,
tests, tools, docs, and local credentials remain excluded.
P2-GCP-027 is now verified complete based on actual repository and successful
image-build evidence. The roll-up is 34 verified complete, 2 partial, 47
blocked (27 external / 20 cloud), 4 deferred, and 1 not applicable, total 88;
applicable completion is 34/87 (39.1%). Cloud Run was not deployed, and no
Dataflow job, live model, Translation, Pub/Sub, or BigQuery write operation
was performed. The subsequent read-only Dataflow preflight is recorded in
Section 26. The exact project credit consumption from this build was not
queried. The user clarified that deployment is to occur at the end and
authorized one Dataflow retry only if a read-only preflight and cost review
show addressed constraints; the retry has not been started and
`jobStartAuthorized` remains false.

## 26. Conditional Dataflow retry preflight (2026-10-12)

The user authorized one Dataflow retry only if a read-only preflight and cost
review show that the prior worker-capacity constraint is addressed. The
preflight confirmed all three `asia-south1` zones report `UP`, `n1-standard-2`
is listed in each zone, regional CPU quota is 0/100, disk quota 0/3277 GiB,
and in-use addresses 0/8. The three historical jobs remain terminal
(`FAILED`, `CANCELLED`, `CANCELLED`), and no matching Compute allocation error
was returned for the time after the last failure. These facts do not provide
positive evidence of recovered provider-side zonal capacity; the same quota
headroom and machine-type availability existed during the failed attempts.
Accordingly, the conditional retry criterion is not met and no retry was
launched. The existing estimate remains conditional, has no enforced spend
cap, and actual Free Trial credit use is not visible in the budget resource.
`config/gcp-dataflow.json` preserves `jobStartAuthorized: false`. Reconsider
only after provider-side capacity confirmation or another concrete read-only
signal establishes that the former constraint has changed.

## 27. Om data handoff and local integration progress (2026-10-12)

### Om's latest report and read-only GCP confirmation

Om reports that BigQuery contains 117 anonymized real items, 5,350 lots
(October 2024–September 2026), and 113 operator feedback notes. Earlier
read-only BigQuery metadata independently showed the item/lots/feedback tables
and row counts of 117/5,350/113; no item/customer row contents were read. This
supersedes the previous checkpoint's statement that `items` had no defined
workflow role: Om now directs PO extraction to read only `itemCode` and
`quantity`, then resolve available product fields from `prepagent.items`.
Read-only `bq ls --models prepagent-hack:prepagent` returned `m_warp` and
`m_delam`. Read-only model metadata shows `m_warp` evaluation R² 0.6051769 and
Vertex AI reference `projects/514663464609/locations/asia-south1/models/prepagent_warp`
version 1; `m_delam` evaluation R² 0.6664104 and registry reference
`.../models/prepagent_delam` version 1. Both BQML evaluations were configured
with a random 20% evaluation split. The other three (`m_strength`, `m_print`,
`m_crack`) were not present in the listing at inspection time. Two models'
metadata do not establish completion of the five-model handoff, prediction SQL,
application inference, optimizer/evidence queries or end-to-end acceptance.
Om reported training underway. No model prediction or additional training was
run.
Om reports photos under `gs://prepagent-hack-data/photos/`. The earlier
read-only recursive object inventory independently found 12 JPEGs across
`photos/photos/{crack,crushed,delam,good,print,warp}/` and
`photos/video/{scrap_pile_1,scrap_pile_2}.jpg`. Presence and directory names do
not prove consent, anonymization, label correctness, class mapping or split
integrity. The sensor table was previously observed empty; no reading was
queried or fabricated.

### Implemented local integration foundation

- Purchase-order extraction now asks Gemini for only `itemCode` and
  `quantity`, then makes a parameterized, bounded BigQuery lookup for fields
  explicitly available by matching column name in `prepagent.items`. Missing
  values are returned for clarification. The item table has no `orderId`,
  `paperType` or `paperSupplier`; these are not inferred. Extraction remains
  disabled unless both the manifest and runtime opt-in allow model calls.

- Zod and the relevant BigQuery lot schema now require `itemCode`; dimensions
  follow Om's current values (`heightMm` 0–1500 and length/width 20–1500),
  accepting height 0 and length 1392. `src/operator-ui.js` input bounds now
  match. The item-code label uses the existing locale `t()` path and is present
  in each supported locale JSON.

- `/conditions/current` has a bounded latest-stored-row query adapter, a
  configured `USTAAD_PLANT_ID` gate, request-supplied DAY/NIGHT shift, timestamp
  normalization, and explicit empty-table behavior. No plant ID is configured,
  no row was queried, and the observed table was empty; only offline adapter
  behavior is verified.

- The existing `/fx` 24-hour cache and `formatMoney` helper were already
  present. The existing locale JSON/t() foundation and SSE route/panel were
  also retained.

- Vertex supports bounded function-calling requests. The new generic Gemini
  runner exposes the seven Blueprint tool names, executes allow-listed calls
  sequentially with bounded rounds/calls/output, and connects real call
  lifecycle to the existing sanitized trace registry. It is not wired to a
  complete `/jobs` runtime because risk/optimizer/evidence/model handlers and
  authoritative plant/order inputs remain incomplete. No model call was made.

- The Impact dashboard remains deferred until `/jobs` works end to end and Om
  supplies its three chart queries. No dashboard or general visual redesign was
  performed.
Offline checks: focused cloud adapters, conditions, schemas, localization and
agent-runner suites passed 27/27. Full `npm test` passed 110/110 after the
conditions adapter and route validation were added. Current tracker totals
are 34 verified complete, 10 partially complete, 24 blocked by external
dependency, 15 blocked by billing/cloud access, 4 deferred, 1 not applicable,
and 0 not started/in progress (88 total; 34/87 applicable complete). These
counts are calculated from the first current task row for each canonical ID;
historical reconciliation rows are not counted again. Cloud Run remains
undeployed, the conditional Dataflow retry was not launched because preflight
did not establish recovered capacity, no live model/Translation call or
permanent BigQuery write was performed, and no billing/credit consumption
report was queried.
The current read-only enabled-service listing returned all eleven Playbook APIs:
Cloud Run, Cloud Build, Artifact Registry, Vertex AI, BigQuery, Storage,
Pub/Sub, Dataflow, Translation, Compute and Logging. A read-only Cloud Run
service list for `asia-south1` returned no services. These checks do not alter
the explicit final-stage deployment decision or prove runtime integrations.

## 29. Cloud adapter implementation checkpoint (2026-10-12)

Implemented bounded BigQuery JobSheet draft persistence/read-back, conditional
approval updates, create-only Cloud Storage job-card upload, approved-only
private PDF retrieval, rollback cleanup, and BigQuery feedback-row persistence.
All write-backed service ports require explicit runtime opt-in flags; none were
enabled during this checkpoint. The operator page now enables only controls
reported as configured by `/api/status`, and the status text explicitly says
that configured adapters do not prove connectivity. Stored cards reject
non-English/non-INR preferences until translation/conversion is implemented.
Offline adapter coverage passed for the new BigQuery writer/repository, Storage
card lifecycle, feedback persistence and existing cloud extraction/conditions
adapters. Full `npm test` passed 125/125 with loopback permission; `git diff
--check` passed. An initial sandboxed full-suite run could not connect to its
local HTTP test server; rerunning locally with loopback access resolved that
environment restriction. No GCP write, upload, model/Translation call, build,
Dataflow job or deployment was performed.
Status reconciliation from these artifacts changes P2-AI-011, P2-AI-013,
P2-AI-014 and P2-AI-016 from cloud-blocked to partially complete: their code
and offline adapters are now implemented, but live workload identity and
end-to-end acceptance remain unverified. P2-OM-001 is partially complete:
read-only metadata confirms all five trained BigQuery ML models and Om
confirms training completed, but training SQL/configuration and model-quality
acceptance inputs remain outstanding. This yields 34 verified, 15 partial,
23 external-blocked, 11 cloud-blocked, 4 deferred, 1 not applicable, and 0
not-started/in-progress (88 total; 34/87 applicable verified). Counts are
derived from the first status-bearing row for each canonical task ID; later
historical mentions are not recounted.
The optimizer objective/query, evidence/explanation SQL, approved shift source,
and sensor data remain hard dependencies for connecting `/jobs`. The model
training recipe/acceptance threshold, glossary CSV, and photo provenance/label
mapping remain external dependencies. Cloud Run deployment remains
intentionally last.

## 28. Live BQML model metadata follow-up (2026-10-12)

Read-only `bq ls --models` now lists all five expected models in
`prepagent-hack:prepagent`: `m_warp`, `m_delam`, `m_strength`, `m_print`, and
`m_crack`. `bq show --model` metadata confirms each is a
`BOOSTED_TREE_REGRESSOR` in `asia-south1`, has a Vertex AI registry model ID,
and records regression evaluation metrics. Observed R² values are warp
0.6052, delam 0.6664, strength 0.4673, print 0.7512, and crack 0.3011.
Training metadata shows a random 20% evaluation split for the five inspected
models. This verifies model objects and recorded evaluations exist; it does
not establish an agreed acceptance threshold, independent dataset/split
quality, or production inference acceptance. `m_print` and `m_crack` metadata
were read separately after the first multi-model output was truncated.
No `ML.PREDICT`, `ML.EXPLAIN_PREDICT`, model invocation, training operation,
or billable prediction query was run. Om's promised prediction SQL, optimizer
objective/query, and evidence/explanation SQL remain outstanding. P2-OM-001
and the dependent risk/agent workflow tasks therefore remain incomplete until
the required SQL/contract is received and integrated. This metadata update
does not change the task counts or statuses above. The attempted sandbox
listing initially failed to read the existing gcloud credential database;
the subsequent explicitly approved read-only CLI metadata calls succeeded.

## 30. Risk prediction SQL recovered and integrated (2026-10-12)

The exact parameterized five-model prediction SQL was recovered from three
matching Om-owned successful BigQuery query-job configurations after the
workspace and complete bucket listing did not contain the attachment. This
read-only job-history evidence revealed the 15 named parameters and 11 result
aliases. The query is saved at `sql/predict.sql` (SHA-256
`e93ca95fb8f70fda972d7efc3c2f20018ef79267a134c3e1b9faff33458ff112`); one
source job was `bqjob_r424dcd59df7c2c6_000001a12c862766_1`. No BigQuery query
was resubmitted.
`src/google-cloud/risk-prediction-service.js` now loads that SQL, maps the
validated request to its exact named parameters, decodes all five model rates,
total scrap percentage/kilograms, cost, currency and primary defect, and
returns explicit unavailable/not-found results. The adapter is connected to
`/risk/predict` only when `USTAAD_ENABLE_RISK_PREDICTION=true`; the flag was not
set. `Dockerfile` includes the SQL asset. Offline tests exercise request/result
mapping and disabled-by-default behavior. Full `npm test`: 129 passed, 0
failed; `git diff --check`: passed.
P2-OM-002 is now verified complete on the existing successful query-job
evidence. P2-APP-008 and P2-AI-003 are partially complete: their adapter and
contract are present, but the app-to-BigQuery live prediction remains
unverified. No model invocation, prediction query, cloud write, build, or
deployment was performed. The next risk acceptance step is one carefully
bounded application-path query after all required request values are supplied
and runtime authorization is explicitly enabled. Query billing cap is 50 MiB
processed; this is not a total cost cap.

## 31. GCP setup reconciliation (2026-10-12)

Fresh read-only CLI checks confirm the project baseline is configured:

- All eleven Playbook APIs are enabled.

- `gs://prepagent-hack-data` exists in `ASIA-SOUTH1`.

- BigQuery dataset `prepagent` contains `items`, `lots`, `feedback`,
  `plants`, `job_sheets`, `sensor_readings`, and
  `sensor_readings_error_records`; the five expected BQML models are present.

- `plants` contains `PLANT-01 | Pune unit | INR | 45.0 | mr`. This establishes
  the exact seed row printed in Playbook §2.9; P2-GCP-010 and P2-GCP-023 are
  now verified complete. It does not establish a source for shift values.

- `sensor_readings` currently returns no rows, so the conditions integration
  remains gated per the user decision.

- Pub/Sub topic `sensor-readings` and subscription `sensor-readings-df` exist;
  the subscription points to that topic with a 10-second ack deadline.

- Artifact Registry has the Docker repository `prepagent` in `asia-south1`.

- The project has no Cloud Run service in `asia-south1` and no active Dataflow
  job in that region.

- The billing-account budget is ₹5,000/month, scoped to project
  `514663464609`, includes credits, and has current-spend alerts at 50%, 90%,
  and 100% routed to the recorded Monitoring notification channel. This is an
  alert, not a hard spending cap.

- `prepagent-run` currently has the six recorded Playbook roles: Vertex AI
  user, BigQuery data editor/job user, Translation user, Pub/Sub publisher,
  and Storage object admin.
No cloud resources, billing settings, IAM bindings, messages, tables, or models
were changed. No query or model call was run. The basic GCP setup is therefore
not the remaining broad blocker. Keep P2-GCP-012 blocked on the known worker
capacity failures until fresh evidence supports the already-authorized single
retry. Keep Cloud Run undeployed until final integration. Build and runtime
acceptance must be repeated against the final code image; the existing
`part2-20261012-1` image predates the newly recovered prediction adapter.
The non-secret Cloud Run environment contract is staged in
`config/gcp-cloud-run.json` as `PROJECT_ID`, `REGION`, `BUCKET`,
`VERTEX_LOCATION`, and `GEMINI_MODEL`; `src/service-ports.js` now accepts these
names as runtime inputs. This manifest is not a live service configuration.
All cost-bearing runtime opt-ins remain false, and plant conditions remain
unconfigured. No deploy-stage flags were activated.
Canonical status arithmetic after Section 32 is 37 verified complete, 22 partially complete, 21 blocked by external dependency, 3 blocked by billing/cloud access, 4 deferred, 1 not applicable, and 0 not started/in progress: 88 tasks total. Section 3 contains the workstream subtotals.

## 32. Cloud integration code follow-up (2026-10-12)

Implemented three focused cloud-integration corrections without changing GCP
resources or making live service calls:

- `src/google-cloud/bigquery-read-client.js` now polls a BigQuery query job
  returned as incomplete, using `jobs.getQueryResults` with the job ID and
  configured location. Polling is abortable, defaults to a 50-second deadline
  within the 60-second request limit, and preserves the 50 MiB query-byte cap
  and existing row/result bounds. A query that still has no job reference or
  misses the deadline remains an explicit unavailable result.

- `index.mjs` `/api/status` now derives `unconfiguredIntegrations` from the
  configured service-port map and reports Cloud Run workload-identity mode
  accurately. Status explicitly says configuration does not prove
  connectivity; no cloud request is made by the status route.

- `src/operator-ui.js` now sends only the operator-selected DAY/NIGHT shift
  with `/conditions/current`, and gives a localized prompt when none is
  selected. It does not infer a shift or invent a fallback sensor reading.
Evidence: focused BigQuery transport tests passed 7/7; focused app and
localization tests passed 19/19; the latest full `npm test` passed 131/131
with loopback access; `node --check` passed on changed JavaScript and
`git diff --check` passed. The initial sandboxed route-test attempt was blocked
by loopback networking; the permitted reruns used only local test servers and
injected fakes, with no GCP calls.
Status arithmetic remains 37 verified, 22 partial, 21 external-blocked, 3
cloud-blocked, 4 deferred, and 1 not applicable (88 canonical tasks). This
code follow-up does not establish live sensor or model results. Cloud Run
deployment remains the final stage.


## 33. Cloud-task progress reconciliation (2026-10-12)
The user requested progress on the remaining cloud setup/billing work without
repeating completed checks or consuming credit unnecessarily. Current primary
status rows show that the broad setup prerequisites are already evidenced: the
project billing state and budget alert, required APIs, bucket, BigQuery seed,
Pub/Sub resources, service identities, Artifact Registry repository, and one
successful build. The historical “10 cloud blockers” snapshot is superseded by
the current canonical rows and Section 3 totals.

The following cloud-related tasks now have implementation or acceptance
progress recorded in their canonical rows: P2-GCP-012 has an explicit
capacity-recovery gate for the previously authorized single retry; P2-GCP-016
has a successful image build but remains partial until final deployment and
health acceptance; P2-GCP-017 has source-backed troubleshooting guidance;
P2-GCP-018–020 have application/day-plan integration foundations, with the
missing production workflow and Om inputs still identified; P2-GCP-027 is
verified for repository/build acceptance; P2-GCP-029 remains deferred until
the final deployment stage; and P2-TEST-007/008 remain blocked on the final
runtime and end-to-end acceptance. No resource check was repeated, no GCP
resource was modified, no live query/model/publish operation was run, and no
deployment occurred in this reconciliation.

Canonical totals remain 37 verified complete, 22 partially complete, 21
blocked by external dependency, 3 blocked by billing/cloud access, 4 deferred,
1 not applicable, and 0 not started/in progress: 88 tasks total. The three
cloud blockers remain P2-GCP-012 (Dataflow worker capacity), P2-TEST-007
(live integration after final deployment), and P2-TEST-008 (full PO-to-card
acceptance). The other cloud setup tasks are verified, partial, externally
blocked, or deferred as described in their current rows.


## 34. Operator-confirmed PO context integration (2026-10-12)
Implemented the PO/item-master boundary supplied by Om without using a
placeholder or making cloud calls. The purchase-order upload form now requires
operator-confirmed order ID, loaded paper type, and loaded paper supplier. It
submits those values with the PDF; Gemini remains restricted to extracting
item code and quantity, and the item catalog remains the sole source of
product specifications.

`OrderOperatorFieldsSchema` validates the three optional API fields, the
`/orders/extract` route validates them before invoking service ports, and the
extraction service independently enforces the same contract before storage,
Vertex, or BigQuery access. The response lists `operatorProvidedFields` so
clients can distinguish operator values from extracted/catalog values. The
operator inputs are localized in all seven existing locale dictionaries and
are required by the UI; API callers may omit them and receive explicit
`missingFields` for compatibility.

Focused extraction tests pass for operator-field merge, provenance, full
profile validation, and invalid-value rejection before cloud calls. The
combined app/adapter test run had 12 passing adapter tests; the 15 app HTTP
checks could not connect to their loopback test server in the current sandbox.
JavaScript syntax checks passed. No GCP calls, live model calls, writes,
publishing, build, or deployment occurred.

P2-APP-005, P2-AI-001, P2-GCP-018 and related workflow tasks remain partial
until an approved PO fixture is processed through the configured cloud runtime
and the remaining authoritative inputs are resolved. Aggregate status remains
37 verified, 22 partial, 21 external-blocked, 3 cloud-blocked, 4 deferred, and
1 not applicable (88 canonical tasks).


## 35. Verified plant/shift runtime configuration (2026-10-12)
The previously unresolved plant selector and shift source now have
source-backed values: read-only BigQuery evidence recorded the Playbook seed
row for `PLANT-01`, and the operator UI requires an explicit DAY/NIGHT shift.
The Cloud Run runtime manifest now includes `USTAAD_PLANT_ID=PLANT-01` as a
non-secret environment setting rather than a feature/write opt-in. The manifest
remains planned and has not been applied to Cloud Run.

This prepares the conditions adapter for the final cloud runtime without
enabling model calls or writes. It does not satisfy live conditions acceptance:
the previously inspected `sensor_readings` table was empty, Dataflow has not
delivered a reading, and no live query was run. P2-APP-007/P2-AI-002 remain
partial until an accepted sensor reading is stored and the latest/last-stored
behavior is verified. No GCP resource was changed.


## 36. Cloud Run plant configuration contract test (2026-10-12)
Aligned the Cloud Run manifest contract test with Section 35: it now requires
`USTAAD_PLANT_ID=PLANT-01` in the planned runtime environment and asserts that
the plant selector is not represented as a disabled feature opt-in. This is a
local manifest consistency check; the environment was not applied to Cloud Run.
`node --test test/cloud-readiness.test.js` passed 3/3. Task statuses and
aggregate arithmetic are unchanged; no GCP operation or deployment occurred.


## 37. Sequential completion readiness (2026-10-12)
The user requested that partially complete tasks be handled in a sequence, with
the next task started only after the current task satisfies its full acceptance
criteria and is marked verified. The next partial sensor-publisher work
(P2-GCP-013) cannot reach its stated message-to-BigQuery acceptance while
P2-GCP-012 remains blocked on Dataflow worker capacity. The other partial
workflow tasks require inputs or acceptance evidence already recorded in their
canonical rows: approved PO/live extraction (P2-GCP-018/P2-APP-005/P2-AI-001),
a stored sensor reading (P2-APP-007/P2-AI-002), live BigQuery prediction
(P2-APP-008/P2-AI-003), Om's optimizer/evidence SQL (P2-APP-009/P2-AI-004–006),
or a complete production run and final Cloud Run deployment (P2-GCP-016/020,
P2-AI-008–014, P2-TEST-007–008). Deployment remains held until the final
stage. Therefore no partial task can be promoted to verified from the available
evidence in this pass, and the user's sequencing rule prevents advancing to a
later task in the group. No statuses or aggregate counts were changed; no
cloud calls, writes, builds, model calls, or deployments occurred.


## 38. Five-model risk prediction acceptance (2026-10-12)
Following the user's clarification to skip hard-blocked tasks, completed the
unblocked risk-prediction acceptance for P2-APP-008 and P2-AI-003. The live
test exposed two adapter guard defects: the read-only SQL guard rejected a
leading SQL comment and a single trailing semicolon, and the strict risk input
schema rejected the transport `AbortSignal`. The guard now validates the
comment-stripped statement and allows one trailing terminator while continuing
to reject mutations and multiple statements. The mapper removes only the
transport signal before validating the business request. The risk request
schema now matches Om's contract: item code, quantity, loaded paper type and
supplier; shift, humidity, temperature and paper moisture; and the seven
machine levers. PO metadata and an invented run date are not required.

BigQuery rejected one initial SQL test before executing it because the
50 MiB billed-bytes ceiling was below the reported minimum of 73,400,320 bytes.
The general read-client cap remains 50 MiB. The risk adapter alone now uses an
80 MiB ceiling, and a single live service-adapter call completed BigQuery job
`job_VSWQUDlGXiwPGmg_-EWdSSSUcIst` in `asia-south1`. Read-only job metadata
reports state `DONE`, no error, 173,240 bytes processed, and the 83,886,080-byte
ceiling. Om's PKBX0041 demo input returned WARP 3.423%, DELAM 2.980%, STRENGTH
1.167%, PRINT 1.828%, CRACK 0.778%, total 10.18%, 100.4 kg, INR 4,518 and
primary defect WARP. This matches the stated acceptance values (about 100 kg,
₹4,518, WARP). No write, Vertex Gemini call, build, or deployment occurred.

`node --test test/bigquery-read-client.test.js test/risk-prediction-service.test.js test/schemas.test.js`
passed 21/21 after the fixes; syntax checks and `git diff --check` passed.
P2-APP-008 and P2-AI-003 are now verified complete at the service-adapter/model
acceptance scope. Cloud Run HTTP/workload-identity acceptance remains under
P2-TEST-007 and final deployment; the complete `/jobs` workflow remains
blocked by its separately recorded dependencies.

The dashboard is recalculated: backend/application tasks are 7 verified and
3 partial; AI/production-workflow tasks are 2 verified and 9 partial. Overall
totals are now 39 verified, 20 partial, 21 external-blocked, 3 cloud-blocked,
4 deferred, 1 not applicable, and 0 not started/in progress (88 total). The
remaining partial workflow tasks still require Dataflow capacity, approved PO
and live extraction, sensor readings, Om's optimizer/evidence SQL, production
job inputs, or final deployment as listed in their task rows. No other partial
task was promoted without its own acceptance evidence.


## 39. Next-item blocker skip and model-training acceptance check (2026-10-12)
Skipped P2-APP-009/P2-AI-004–006 because Om's optimizer objective, allowed
search grid/baseline, and explain/evidence SQL are still absent. To find the
next independently actionable handoff, ran one read-only query against
`region-asia-south1.INFORMATION_SCHEMA.JOBS_BY_PROJECT`; it returned Om's
five `CREATE MODEL` statements and exposed their training filters,
random 20% evaluation split, and Vertex registration settings. No table data
was queried and no model was trained or invoked.

The governing Blueprint p. 12 specifies the training pattern and a model check
of R² 0.6–0.75 on held-out lots; the Playbook p. 14 says the pass threshold is
R² at least 0.6 and top feature-importance entries must match the defect rules.
Previously recorded model metadata reports R² warp 0.6052, delam 0.6664,
strength 0.4673, print 0.7512, and crack 0.3011. Strength and crack therefore
fail the published minimum. Their acceptance cannot be repaired by local code
or configuration; Om must correct/retrain the failing models and supply the
feature-importance evidence. P2-OM-001 remains partially complete and model-
dependent downstream workflow acceptance stays blocked. The recoverable
training statements do not constitute model acceptance.

The remaining independent partial items were checked against their own
acceptance rows: publisher delivery needs the still-blocked Dataflow stream;
order extraction needs an approved PO and live extraction; current conditions
needs a stored sensor row; persistence/card/feedback need a genuine job
pipeline and approved production lifecycle; the shared trace/SSE needs a
complete application run; and Cloud Run deployment is intentionally held for
the final stage. Thus no other partial row can truthfully be promoted to
verified complete in this pass. No status or aggregate count changed. Overall
totals remain 39 verified, 20 partial, 21 external-blocked, 3 cloud-blocked,
4 deferred, 1 not applicable (88 canonical tasks). No cloud resource was
modified, no data/model write or inference was performed, and no build or
deployment occurred.


## 40. Partial-task blocker review and source-backed UI integration (2026-10-12)
Reviewed all 20 current `[!] PARTIALLY COMPLETE` canonical rows against the
Blueprint and Playbook acceptance statements. Only the risk/what-if portion of
P2-UI-001 had an implementation gap that could be closed without Om inputs,
missing production data, a permanent write, or deployment. The analysis form
previously sent a full order profile and run date to the strict prediction
endpoint although Om's SQL accepts only item code, quantity, loaded paper type
and supplier; conditions are shift, humidity, temperature, and paper moisture.
The screen now maps only those fields and the seven levers through
`src/risk-ui.js`. Its what-if numeric-lever slider uses the validated ranges,
becomes available only after a genuine model response, and re-scores once on
release to avoid one BigQuery query per pointer movement. New strings and lever
labels are in all seven locale JSON files and use the existing `t()` flow.

Verification: two `risk-ui` contract tests pass, including strict
`RiskPredictionRequestSchema` acceptance and rejection of missing inputs;
localization coverage tests pass for every supported locale; the generated
browser module script passes `node --check`; the `/risk-ui.js` app route and
valid risk-request boundary are covered by `test/app.test.js`; the full
serialized test suite passes 135/135; and `git diff --check` passes. The valid
HTTP contract test reaches the configured-service boundary (503 in the
offline test process), not a live model call. The earlier P2-APP-008 evidence
remains the sole live prediction acceptance; no extra query was run.

Disposition of the 20 partial rows after this review:

| Task | Remaining blocker / implementation disposition |
|---|---|
| P2-GCP-013 | End-to-end publisher acceptance requires P2-GCP-012 Dataflow capacity and the bounded authorized message-to-BigQuery test. |
| P2-GCP-016 | Final Cloud Run build/deploy and runtime acceptance are intentionally held for the end; public access is not authorized by implication. |
| P2-GCP-017 | Troubleshooting guidance is implemented; Dataflow capacity failure is unresolved and no new service error is available to resolve. |
| P2-GCP-018 | The Day 1 integrated workflow still needs an approved PO and final deployment; its source-backed FX/helper work is already complete. |
| P2-GCP-020 | Full operator acceptance depends on the genuine workflow, remaining Om inputs, sensor data, persisted lifecycle, and final deployment. The what-if gap is now implemented. |
| P2-APP-005 | Approved PO fixture and authoritative order fields/live extraction are still required. |
| P2-APP-007 | An accepted stored sensor reading is absent; the publisher path depends on blocked Dataflow. |
| P2-APP-009 | Om's objective, grid/baseline, optimizer SQL and explain/evidence SQL/aliases are absent. |
| P2-UI-001 | Risk request projection and what-if slider are implemented/tested; the end-to-end UI remains dependent on the blocked workflow services listed in this table. |
| P2-GUARD-001 | Blueprint/Playbook do not specify trusted proxy IP parsing or a cross-replica limiter store; adding either would invent production architecture. |
| P2-AI-001 | Approved PO samples and confirmed operator/context fields remain necessary for live extraction acceptance. |
| P2-AI-002 | Stored sensor input and valid shift/plant context from the accepted pipeline are missing. |
| P2-AI-008 | The runner shell exists, but genuine handlers for all seven tools depend on PO/conditions, Om's query contracts, and the validated JobSheet lifecycle. |
| P2-AI-009 | Full production trace acceptance depends on the complete real agent run, which cannot start before its tool handlers and inputs are ready. |
| P2-AI-010 | Full SSE/UI acceptance depends on that real runner producing an accepted job trace. |
| P2-AI-011 | Persistent acceptance requires a genuine JobSheet and authorized permanent BigQuery draft/approval lifecycle; no synthetic production write was made. |
| P2-AI-013 | Storage upload/retrieval acceptance requires a genuine approved JobSheet and runtime identity check in the integrated lifecycle. |
| P2-AI-014 | Approval/print acceptance requires genuine persisted job and card; permanent writes/storage calls remain separate operations. |
| P2-AI-016 | Real operator feedback lifecycle/write needs a genuine completed lot and authorized persistence; photo/translation portions have separate Om dependencies. |
| P2-OM-001 | Strength and crack R² are below the Blueprint/Playbook 0.6 minimum, and feature-importance acceptance evidence is missing; Om must correct/retrain and supply evidence. |

No other partial row has a source-supported implementation-only gap whose
completion would satisfy that row's own acceptance criteria. All other rows
remain partial pending their listed prerequisites; no status changed. Dashboard
totals remain 39 verified, 20 partial, 21 external-blocked, 3 cloud-blocked,
4 deferred and 1 N/A (88 total). No cloud operation, permanent data write,
live model call, build, or deployment occurred in this pass.


## 41. Read-only Dataflow capacity recheck (2026-10-12)
The user asked whether the remaining 20 partial tasks are all blocked and to
implement any that are not. Reused Section 40's task-by-task acceptance review
and made one fresh read-only `gcloud dataflow jobs list` check in
`asia-south1`. It returned only the previously recorded sensor stream jobs:
two `Cancelled` and one `Failed`; no active or successful replacement job was
listed. This check does not establish that worker capacity has recovered. The
condition attached to the user's earlier authorization for one retry (read-only
preflight evidence that the constraints are addressed) is therefore unmet; no
retry was started.

Section 40 already closed the only remaining implementation-only gap found in
the 20-row review: the P2-UI-001 risk request projection and Blueprint
what-if slider. The other partial rows remain gated on their row-specific
acceptance prerequisites (including the Dataflow capacity/publisher chain,
approved PO and real sensor input, Om's optimizer/evidence SQL and model
acceptance, a genuine JobSheet persistence/card/feedback lifecycle, or the
intentionally final Cloud Run deployment). They are not all code blockers;
most have substantial implementation in place, while full acceptance remains
unproven until the corresponding input, cloud integration, or lifecycle exists.
No newly actionable implementation gap was found in this pass. Canonical task
statuses and aggregate totals remain unchanged: 39 verified, 20 partial, 21
external-blocked, 3 cloud-blocked, 4 deferred, and 1 not applicable (88).
No jobs, resources, data, or deployments were modified.


## 42. Partial-status and deferred-deployment reconciliation (2026-10-12)
The user asked to remove items from the partial count only when the governing
status rules support another primary status, while implementing the remaining
source-backed work that is not fully blocked. Reviewed the 20 current partial
canonical rows against Section 2 status definitions and the disposition in
Section 40. Each remaining partial row has at least one concrete implementation
or acceptance element already evidenced and a specific remaining gap; none can
be reclassified as externally/cloud blocked without discarding accepted work
or misrepresenting the task's primary status. For example, prediction,
conditions, order extraction, JobSheet/card/feedback adapters, and trace/SSE
scaffolding have implementation evidence, while their respective live data,
Om input, or complete workflow acceptance remains outstanding. No other
source-supported implementation-only gap was identified beyond the UI change
already recorded in Section 40.

P2-GCP-016 is the exception: the repository/repository build acceptance has
evidence, but Cloud Run deployment is explicitly reserved for the final stage.
Its primary status is now `[D] DEFERRED BY EXPLICIT DECISION`, matching the
status legend and the user's deployment hold. Public access still requires a
separate decision. Cloud Build and Artifact Registry rows in the readiness
matrix are reconciled to the successful recorded build and verified repository
instead of stale “unverified” text.

Recalculated primary status counts across 88 canonical tasks: 39 verified, 19
partially complete, 21 blocked by external dependency, 3 blocked by billing/
cloud access, 5 deferred, 1 not applicable, 0 in progress, and 0 not started.
Official Part 2 requirement rows now count 12 verified, 4 partial, 2 external
blocked, 1 cloud blocked and 2 deferred (21 total). The applicable denominator
and completion percentage remain 87 and 39/87 = 44.8%. No remaining partial
status was changed; no new code was safe to add without Om's missing contracts,
approved production inputs, sensor delivery or the final deployment stage.
No cloud resource, data, or running job was changed. No new paid call, build,
or deployment was made in this reconciliation.


## 43. Deterministic `/jobs` coordination and trace integration (2026-10-12)
Implemented the first independently executable workflow batch from the latest
Part 2 directive. `src/job-coordinator.js` runs the available production
service ports in the fixed Blueprint sequence: `extractOrder`,
`getConditions`, `predictRisk`, then `optimizeLevers`. The coordinator requires
operator-confirmed order ID, paper type, supplier, shift, and actual machine
levers; validates the extracted `OrderProfile`, stored `RunConditions`, and
five-defect `RiskResult`; and stops at the first missing/unavailable stage.
No default shift, sensor values, machine settings, recommendations, or
persistent records are created. Om-owned optimizer SQL is explicitly reported
as the next blocked stage when extraction, stored conditions, and prediction
are available.

Wired `POST /jobs` to this coordinator. The operator action submits the
operator-confirmed order context, selected shift, and actual machine settings.
The response carries the trace `runId`; the UI automatically subscribes to the
existing SSE route, which replays the coordinator's sanitized lifecycle events.
This improves P2-GCP-018 and the evidence for P2-AI-008–010, but does not claim
that the generic Gemini function loop is wired into the production path or that
a complete JobSheet has been generated.

Verification: `npm test` passed 141/141. The 15 app HTTP tests passed and
verified that a synthetic `/jobs` request reaches the explicit unavailable
extraction port, returns a run ID, and replays `run.started`,
`extractOrder/tool.unavailable`, and `run.failed` through SSE. Six coordinator
tests verified fixed ordering and stop behavior for missing operator input,
clarification, unavailable stored conditions, unavailable optimizer SQL,
unexpected service exceptions, and cancellation cleanup. Existing conditions,
PO extraction, risk adapter, schemas, and
trace transport tests passed in the same full suite. `node --check` passed for
`index.mjs`, `src/job-coordinator.js`, and `src/operator-ui.js`; `git diff
--check` passed. The first sandboxed HTTP test attempt could not bind loopback;
the offline suite was rerun successfully with local loopback permission. No
cloud, external-model, write, publish, build, or deployment operation occurred.

Statuses remain unchanged: P2-AI-008–010 and P2-GCP-018 remain partially
complete because this batch proves coordinator/trace plumbing but not a real
configured extraction, stored sensor result, successful live prediction in
the `/jobs` path, Om optimizer/evidence/explanation contracts, JobSheet
generation, persistence, or approved card lifecycle. The previously reported
canonical totals remain 39 verified, 19 partial, 21 external-blocked, 3
cloud-blocked, 5 deferred, and 1 not applicable (88 tasks); P2-TEST-001,
P2-TEST-002, P2-TEST-005, and P2-TEST-006 retain their verified statuses with
current-batch evidence.

The next production workflow stage is the optimizer adapter, which must wait
for Om's exact SQL, objective/baseline and result aliases. Similar-run,
explanation, and JobSheet generation then depend on their corresponding
authoritative contracts. Until those arrive, do not add fabricated service
outputs or model-tool parameters; offline integration tests and input
validation can continue without changing those acceptance facts. Additional
blockers are an approved anonymized PO plus live model authorization for
extraction, stored sensor data/Dataflow capacity, fresh model evaluation and
feature-importance evidence, and explicit authorization for permanent
JobSheet writes. Final Cloud Run deployment remains deferred.


## 44. Om dependency boundary and remaining executable work (2026-10-12)
The user directed the implementation to proceed on all items that do not need
Om's work, while keeping Om-dependent items aside. Reconciled that request to
the current canonical task rows rather than treating every open row as Om-
blocked.

### Direct Om deliverables to hold for his response

| Om task | Required authoritative deliverable | Directly dependent canonical tasks |
|---|---|---|
| P2-OM-001 | Fresh identities/versions and held-out R² for all five models, plus feature-importance evidence aligned with the Blueprint/Playbook defect rules. The recorded historical strength/crack R² values are below 0.6; Om's later report that training finished is not fresh acceptance evidence. | P2-AI-003–008, P2-GCP-019/028 where model identity/evaluation is required. |
| P2-OM-003 | Optimizer SQL, objective/penalties, permitted grid, authoritative plant baseline, parameter/result aliases and a known expected example. | P2-APP-009, P2-AI-004, P2-AI-007/008, P2-GCP-019/020, P2-UI-001/002/004. |
| P2-OM-004 | Exact explanation/ML attribution and similar-run/evidence SQL, parameters, filtering, output schemas and known expected examples. | P2-APP-009, P2-AI-005–008, P2-GCP-019/020, P2-UI-001/002/004. |
| P2-OM-005 | Reviewed glossary CSV with exact required language columns and approved corrugated terminology. | P2-GCP-015/019/028, P2-AI-017, P2-AI-016 translation portion, P2-UI-003. |
| P2-OM-006 | Authoritative PLANT-01 monthly humidity/temperature season profile, units, provenance and intended use. | P2-GCP-013/018 where demo/publisher profile is required. |
| P2-OM-007 | Plant-approved machine baseline, costs and throughput assumptions with units, effective date and provenance. | P2-AI-004/007 and P2-GCP-018/019/020 where baseline/savings are required. |
| P2-OM-008 | Authoritative manufacturing-stage order, especially printing position, for process explanation/job-card correctness. | P2-AI-006/007 and P2-GCP-019/020 where explanation/card sequence is required. |
| P2-OM-009 | Approved anonymized PO fixtures, expected itemCode/quantity outputs, languages, ambiguity/missing cases and usage approval. | P2-APP-005, P2-AI-001, P2-GCP-018/019/020, P2-UI-002/005. |
| P2-OM-010 | Photo provenance/consent, exact object manifest, authoritative labels including `crushed`/`good`, annotation format, train/eval split and inference contract. | P2-AI-015, P2-AI-016 photo portion, P2-GCP-020 and demo acceptance. |

P2-OM-002 is already verified: the exact prediction SQL is present at
`sql/predict.sql` and has prior successful service-adapter evidence. Do not
request a duplicate or rerun it without a specific need.

### Downstream tasks with an Om-dependent acceptance segment

These rows have code or offline evidence, so their primary status remains
partially complete/blocked as currently recorded. Continue only independent
contract, validation and offline-test work; do not fabricate upstream results:
P2-GCP-015, P2-GCP-018/019/020/028; P2-APP-005/009; P2-UI-001/002/003/004/005;
P2-AI-001/004/005/006/007/008/009/010/015/016/017; and P2-OM-001.

### Open tasks not blocked solely by Om

| Task group | Remaining requirement | Why it is not executable to full acceptance now |
|---|---|---|
| P2-GCP-012 and dependent P2-GCP-013/P2-APP-007/P2-AI-002 | Genuine Pub/Sub-to-BigQuery sensor delivery and a stored latest reading. | Three prior Dataflow worker allocations failed with `ZONE_RESOURCE_POOL_EXHAUSTED`; no new capacity-recovery evidence exists. A retry/publish remains separately gated; no live message was sent. |
| P2-AI-011/013/014/016 persistence portions | Genuine JobSheet draft/read-back/approval/card/feedback lifecycle. | Existing adapters/offline tests are present, but no genuine workflow-produced JobSheet exists and permanent writes/uploads require operation-specific authorization and approved IDs/retention. |
| P2-GUARD-001 | Cloud Run correct-client-IP and cross-replica per-IP enforcement. | Source documents do not identify trusted proxy/header semantics or shared limiter store. A production implementation would require an architecture decision and may create cost/resources. |
| P2-TEST-007/008 | Live integration and complete PO-to-card acceptance. | Requires all upstream inputs plus final runtime; deployment is deliberately deferred and live calls/writes require specific authorization. |
| P2-GCP-016/021/029 and P2-DEPLOY-001 | Final deployment, judging operation and rehearsal. | Explicitly deferred until final integration and separate deployment/access authorization. |

No task status changed in this reconciliation. The latest primary-status counts
remain 39 verified, 19 partially complete, 21 blocked by external dependency,
3 blocked by billing/cloud access, 5 deferred, and 1 not applicable (88 total).
No cloud operation, persistent write/upload, live model/Translation call,
Dataflow retry, build, or deployment was performed. At this checkpoint no
additional implementation-only change was identified whose completion would
satisfy a remaining canonical task without one of the above authoritative
inputs, genuine live acceptance prerequisites, or explicit operation
authorization. Continue from this dependency split when Om's artifacts or
operation-specific approvals arrive; do not repeat the completed audit.


## 45. Budget-bounded Dataflow attempt and publisher dependency fix (2026-10-12)
The user authorized completion work across the open inventory, subject to a
₹1,000 cost ceiling. Used the existing one-worker configuration and the
existing conditional Dataflow cost plan; no model call, build, Cloud Run
deployment, Translation call, plant seed or JobSheet/feedback write was made.

### Dataflow/Pub/Sub attempt

Started exactly one regional Dataflow job from the pinned
`2026-09-29-00_RC02` Pub/Sub Subscription to BigQuery template:

- Job: `sensor-to-bq-bounded-20261012-01`
- Job ID: `2026-10-12_07_37_28-6099673639127736697`
- Region: `asia-south1`; provider selected zone `asia-south1-b`
- Worker cap: one `n1-standard-2`, 30 GiB disk; documented worker identity
- Source/destination: `sensor-readings-df` to `prepagent.sensor_readings`
- A single simulated, uniquely identified message was published to
  `sensor-readings` (Pub/Sub message ID `22271648474472855`; reading ID
  `P2-DATAFLOW-TEST-20261012-144017Z`). This is test data, not a physical
  sensor observation.

The job entered `RUNNING` at the service level but did not provision its
worker. Cloud Logging repeatedly reported `ZONE_RESOURCE_POOL_EXHAUSTED` in
`asia-south1-b` and advised trying another zone/later. Two partition-filtered
BigQuery reads, each capped at 10 MB, found no matching row. A drain request
remained in `DRAINING` while Dataflow retried worker allocation; the job was
cancelled to end those retries. The final job state is `CANCELLED`, and a
read-only active-job list was empty. No delivery acceptance is claimed. The
unique simulated Pub/Sub test message was not acknowledged by this failed
attempt; do not publish a duplicate. The next decision needs new provider
capacity evidence before another retry.

The existing project cost plan models roughly ₹10.65 for a 15-minute test
under its stated conservative assumptions, substantially below the user's
₹1,000 ceiling; it is an estimate, not a hard cap or invoice. Actual billed
spend for this attempt could not be independently read. The Dataflow pricing
page explains that workers and other services are billed for usage and that
streaming workers are billed per second; the template documentation confirms
that it reads JSON messages from the named subscription and writes to the
schema-matched BigQuery table. No additional Dataflow retry is scheduled.

### Publisher implementation and verification

`tools/publisher.mjs` imported `@google-cloud/pubsub`, but that package was
missing from `package.json`/`package-lock.json`; the script therefore could
not run from a clean dependency install. Added Google’s official Pub/Sub
Node.js client as exact dev dependency `@google-cloud/pubsub@6.2.0`, keeping
it out of the Cloud Run production dependency set. Package installation
reported zero vulnerabilities. A no-opt-in invocation was confirmed to
refuse before gcloud or Pub/Sub access, and Node syntax checks plus
`git diff --check` passed. The live publisher script itself was not run,
because the one test message was already published and the Dataflow worker
could not provision; another publish would create an unnecessary duplicate.

The full offline suite passed `141/141`. Statuses remain conservative:
P2-GCP-012 stays blocked by the repeated provider stockout; P2-GCP-013 stays
partially complete because its executable dependency is fixed but the actual
publisher-to-BigQuery acceptance did not pass. Canonical totals remain 39
verified, 19 partially complete, 21 blocked by external dependency, 3 blocked
by billing/cloud access, 5 deferred and 1 not applicable (88 total). No other
open-task status changed. No cost total is claimed without billing evidence.

## 46. Live synthetic JobSheet and card lifecycle (2026-10-12)

The user asked to progress independent partially complete work rather than
repeat the Dataflow retry. A live, bounded verification was performed against
the existing `prepagent-hack.prepagent.job_sheets` table and
`gs://prepagent-hack-data` bucket using the existing BigQuery read/write,
Storage, repository, job-card, and PDF-rendering adapters. The table schema
was read-only verified before the write and had zero rows. One generated ID,
`CODEX-TEST-793c6e4a-d2a1-4171-8ee9-71c9e4a9f8a4`, identified the synthetic
fixture throughout the test.

The live sequence passed: parameterized draft MERGE, BigQuery draft read-back,
conditional DRAFT-to-APPROVED update, PDF generation/upload, approved-card
retrieval, PDF signature/content-type check, and final approval/card-URI
read-back. The test exposed that BigQuery REST returns TIMESTAMP values as
Unix seconds (the live query returned `1.791818084748755E9`), while the
JobSheet decoder expected ISO-8601. `decodeRow` now normalizes both ISO strings
and finite Unix-second strings to ISO-8601 before schema validation. The new
unit test exercises the actual BigQuery epoch-seconds representation.

Cleanup completed successfully: the one synthetic PDF object was deleted and
one matching synthetic JobSheet row was deleted; a final repository read
confirmed the row was absent. No production order, customer record, or
manufacturing result was used. The BigQuery calls use the adapter's 50 MiB
maximum-bytes-billed setting. Actual billed amount was not independently
available, so no precise spend is claimed. Authentication was through the
currently authenticated development account; Cloud Run workload identity was
not tested. This is live adapter/lifecycle evidence, not acceptance of the
model-generated `/jobs` workflow.

Files changed for this batch: `src/google-cloud/job-sheet-repository.js`,
`test/job-sheet-repository.test.js`, and this tracker. Focused persistence,
repository and card tests passed 13/13; full `npm test` passed 142/142;
`git diff --check` passed. P2-AI-011, P2-AI-013, and P2-AI-014 remain
partially complete because genuine `/jobs` generation and Cloud Run identity
acceptance are still outstanding. No task status was promoted. Other
independent open tasks still require their own acceptance evidence; the
remaining external blockers are not a reason to retry Dataflow.

## 47. Five outstanding workflow/UI acceptance items recheck (2026-10-12)

Rechecked the five previously listed items (approved PO extraction acceptance,
stored current conditions, Gemini orchestration in `/jobs`, UI localization,
and final image/deployment). No files other than this evidence entry were
changed in this pass, and no task status was promoted.

- A bounded read-only BigQuery query in `asia-south1`, capped at 1,000,000
  bytes processed, counted `prepagent.sensor_readings` for `plant_id =
  'PLANT-01'`. Result: `row_count = 0`, `latest_ts = NULL`. Therefore the
  stored-reading acceptance for P2-AI-002 cannot pass yet. The existing
  service correctly returns unavailable rather than fabricating weather or
  moisture values; the operator must still supply DAY/NIGHT shift.
- Existing approved-PO acceptance input is still absent. The extraction
  adapter and offline tests are present, but no approved anonymized PO plus
  expected `itemCode`/`quantity` result was supplied or processed. No live
  Gemini extraction, document upload, or customer data operation was run.
- `createGeminiFunctionRunner` and its bounded function-call tests exist, and
  `/jobs` has a deterministic traced coordinator. The complete production
  tool set is still unavailable: optimizer/evidence/explanation contracts and
  relevant SQL remain unverified or Om-owned. The standalone JobSheet
  lifecycle is verified, but it is not wired into a complete `/jobs` run, and
  there is no complete accepted agent trace. No live model call was run.
- Seven locale JSON files, the `translate()` helper, UI translation binding,
  fallback behavior, and localization tests are present. The combined static
  key scan found 118 English locale keys and 105 direct references (one
  template-dynamic key is intentionally computed); localization tests passed.
  Glossary-backed approved manufacturing terms and live result translation
  remain separate external acceptance requirements.
- Final Cloud Run image/build/deployment remains held until integration is
  accepted and the deployment stage is authorized. No build, image push, or
  deployment occurred.

Verification: the complete existing offline suite passed `142/142` using
loopback-enabled local HTTP tests. A first sandbox-restricted run had 15 local
HTTP failures; the isolated `test/app.test.js` rerun passed `15/15`, and the
complete rerun passed `142/142`. Relevant extraction, conditions, runner,
coordinator, prediction and localization tests passed `30/30`. This evidence
supports implementation readiness only where stated; it does not satisfy
missing live-input or production acceptance gates. No live Gemini, Translation,
Dataflow, or deployment operation was performed.

## 48. Critical-path artifact and catalog preflight (2026-10-12)

Inspected only the actual artifact locations needed to decide whether a
critical-path implementation could proceed without Om. The repository has
`sql/predict.sql` but no optimizer, explanation, similar-run/"have we seen
this", glossary, training-evaluation, or PO fixture artifact. A read-only
recursive listing of `gs://prepagent-hack-data/` found only image objects under
`photos/photos/{crack,crushed,delam,good,print,warp}/` and
`photos/video/`; no order PDFs, SQL, CSV glossary, or model-evaluation files
were present. Object names alone do not establish photo consent, labels, or
inference acceptance.

The Blueprint identifies `prepagent.sensor_readings` as the sensor-written
time series and `prepagent.lots` as the wide training/outcome table. Although
lots contains historical `run_date` and condition columns, it is not an
approved current-sensor substitute; no provider was implemented that would
present generated/historical lot conditions as live conditions. Keep
P2-AI-002 dependent on an accepted stored sensor source.

One parameterized read-only BigQuery lookup for known item code `PKBX0041`
returned exactly one `prepagent.items` row (`RSC`, 410 × 305 × 255 mm, 5-ply,
BC flute). The query was capped at 10 MiB maximum billed bytes; the initial
1 MiB cap was rejected by BigQuery's 10 MiB minimum and did not run. This
verifies that the source item exists and its selected fields are readable; it
does not substitute for an approved PO extraction fixture or Gemini result.

No code or task status changed. Next critical-path action: obtain the minimum
Om handoff listed in Section 44 (approved PO fixtures; optimizer and
explanation/similar-run SQL contracts; glossary; fresh five-model evaluation
and feature importance). In parallel, require new Dataflow capacity evidence
or an explicitly approved alternative sensor source before condition
acceptance. Do not retry Dataflow or publish another message. No live model,
write, upload, Translation, build, or deployment operation occurred.

## 49. PO-to-job-sheet offline acceptance review (2026-10-12)

Continued the requested critical-path review against existing implementation,
without repeating cloud preflight or changing application code. Confirmed the
implemented offline path covers: PDF/upload contract and item-code/quantity
validation; parameterized item-catalog mapping with explicit unknown/duplicate
handling; operator-supplied order ID, loaded paper type/supplier, shift and
machine levers; missing sensor result as unavailable with no default values;
fixed coordinator order with sanitized errors, cancellation and run/tool trace
events; existing validated JobSheet draft/read/approval and approved-only PDF
retrieval services; feedback `jobId`/URL-ID match validation and payload
schema; and local request timeout/per-process rate-limit behavior. Existing
tests use synthetic fixtures and do not label them as approved production
orders, sensor readings, or job outcomes.

Focused offline verification passed `74/74` across `test/app.test.js`,
`test/google-cloud-order-extraction.test.js`,
`test/google-cloud-current-conditions.test.js`,
`test/job-coordinator.test.js`, `test/gemini-function-runner.test.js`,
`test/job-sheet-repository.test.js`, `test/job-card-service.test.js`,
`test/feedback-service.test.js`, `test/request-guardrails.test.js`,
`test/schemas.test.js`, `test/risk-prediction-service.test.js`, and
`test/localization.test.js`. The app tests used local loopback only; remaining
tests used offline fixtures. No status was promoted because the complete
production acceptance scenario has not run.

No independent implementation gap remains in these in-scope offline
contracts. The next acceptance-capable changes require actual upstream inputs:
P2-OM-009 approved PO fixtures for real extraction; P2-OM-003/004 exact SQL
and query contracts for optimization/explanation/evidence; and qualifying
sensor-source evidence for P2-AI-002. Before treating feedback as a production
loop, photo provenance/label mapping and glossary-based note translation also
remain P2-OM-010/P2-OM-005 dependencies. Model acceptance remains gated on
P2-OM-001. No cloud mutation, model call, message publication, deployment, or
persistent production write was performed in this batch.

## 50. JobSheet assembly and coordinator success path (2026-10-12)

Implemented `src/job-sheet-builder.js` as a deterministic boundary that maps
validated order, conditions, optimization output, supplied similar-run evidence,
and a non-empty supplied explanation into the Blueprint `JobSheetSchema` with
status `DRAFT`. Each input is validated with field-qualified errors. The
builder does not synthesize a plant, evidence, explanation, prediction,
conditions, or business values; optional evidence remains omitted when no
evidence was provided.

Extended `src/job-coordinator.js` to validate optimizer results against
`OptimizationResultSchema`, invoke the optional similar-run and explanation
service ports in traced order, assemble the DRAFT, and terminate successful
trace runs with `run.completed`. Missing ports remain explicit
`SERVICE_UNAVAILABLE` stops at their own stage. Malformed evidence or
explanation fails JobSheet generation with a field-level validation error.
The coordinator returns an in-memory DRAFT only; no BigQuery write, PDF upload,
or approval is performed by this change.

Added synthetic-only coverage in `test/job-sheet-builder.test.js` and
`test/job-coordinator.test.js` for valid assembly, absent versus malformed
evidence, evidence-count limits, missing explanation, full injected-service
trace completion, and generation failure propagation. Verification command:
`node --test test/job-sheet-builder.test.js test/job-coordinator.test.js
test/trace-registry.test.js` — passed 17/17 tests. This is offline contract
coverage and is not production workflow acceptance. P2-AI-007 remains blocked
for acceptance pending real upstream optimizer/evidence/explanation artifacts;
P2-OM-003/004 and P2-OM-009 remain unchanged. No live service operation or
persistent write was performed.

## 51. Feedback-to-job association guard (2026-10-13)

Added `src/linked-feedback-service.js` and wired `POST /jobs/:id/feedback` in
`index.mjs` through it. Before invoking the feedback writer, the service now
loads the referenced stored JobSheet, validates it against
`StoredJobSheetSchema`, verifies its ID matches the submitted feedback ID, and
returns `NOT_FOUND` for missing or mismatched jobs. Read errors remain
unavailable and cancellation propagates; the writer is never invoked when the
association check fails. This prevents feedback rows from being written for an
unknown job.

Added synthetic tests in `test/linked-feedback-service.test.js` for valid
association, missing/malformed/mismatched jobs, unavailable reads, and
cancellation. `node --test test/linked-feedback-service.test.js
test/feedback-service.test.js test/schemas.test.js` passed 16/16;
`node --check index.mjs` and `git diff --check` passed. The first sandboxed
`test/app.test.js` attempt could not bind its loopback server; its rerun with
loopback permission passed 15/15, including feedback route validation and the
unconfigured-service response. No cloud query or feedback write was performed.

P2-AI-016 remains partially complete: job and optional lot-to-order association
are now validated by the application. Photo provenance, classification,
translation and live persistence acceptance remain external/authorization
dependencies.

## 52. Feedback lot-to-order association (2026-10-13)

Extended the P2-AI-016 feedback gate to validate optional lot linkage as well as
the existing job association. `src/google-cloud/lot-association-service.js`
performs a single parameterized read of `prepagent.lots` for the submitted
`lot_id`, selecting only `lot_id` and `order_id` with `LIMIT 2`; it rejects
missing, malformed, or ambiguous results. `src/linked-feedback-service.js`
compares the returned lot `order_id` with the stored JobSheet's
`order.orderId`. A missing lot returns `NOT_FOUND`, an order mismatch returns
`CONFLICT`, and neither path calls the feedback writer. When no lot ID is
supplied, no lot lookup is made. The relation follows the existing
`LotRowSchema` (`lot_id`, `order_id`) and stored JobSheet order contract; it
does not claim a photo or defect-label association.

`src/service-ports.js` exposes the bounded lot reader using its existing
BigQuery read-only client; `index.mjs` wires it into feedback submission. This
is code-path implementation only: no BigQuery query or persistent feedback
write was executed during this batch. Focused verification:
`node --test test/linked-feedback-service.test.js
test/lot-association-service.test.js test/feedback-service.test.js
test/schemas.test.js test/cloud-readiness.test.js` passed 23/23;
`node --check index.mjs`, `node --check src/service-ports.js`, and
`git diff --check` passed. P2-AI-016 remains partially complete pending
authorized real feedback persistence and its remaining photo/translation
acceptance dependencies.

## 53. Feedback cancellation metadata contract (2026-10-13)

Fixed a strict-schema integration defect in `src/google-cloud/feedback-service.js`:
the route's `AbortSignal` had been included in the feedback object passed to
`FeedbackInputSchema`, which rejects unknown fields. The adapter now separates
transport metadata from the schema payload, maps only validated feedback
fields, and forwards the signal to the bounded BigQuery writer. The feedback
adapter test now supplies an AbortSignal and confirms it reaches the writer
without entering the stored row.

Verification on the final tree: the focused offline set
`node --test test/linked-feedback-service.test.js
test/lot-association-service.test.js test/feedback-service.test.js
test/schemas.test.js test/cloud-readiness.test.js` passed 23/23; the
loopback-enabled `node --test test/app.test.js` passed 15/15. JavaScript syntax
checks for changed runtime modules and `git diff --check` passed. No BigQuery
query or write ran. This repairs adapter readiness but does not change P2-AI-016
from partially complete because authorized live feedback and Om-owned photo
and glossary acceptance remain outstanding.

## 54. /jobs idempotency guardrail — durable duplicate-job prevention (2026-10-13)

Implemented the full `/jobs` idempotency stack. No cloud mutations, live model
calls, or persistent cloud writes were performed.

### What was implemented

**`src/job-idempotency.js`** — three additions:

- `InMemoryIdempotencyStore`: offline-safe fake shared store implementing the
  atomic `claim`/`complete`/`release` adapter contract. `claim` returns one of
  `claimed` (this caller owns the slot), `in_progress` (another caller holds
  the lease), `complete` (replay path), or `conflict` (same key, different
  fingerprint). Expired leases are transparent to a re-claimant (fault-recovery
  path). Non-owner `release` is a no-op. `clear`/`inspect` are test-only
  utilities.
  **Note:** this store is process-local and does NOT coordinate across
  replicas. The adapter interface (`claim`/`complete`/`release`) is the
  production contract; only the backing persistence needs to change for a real
  shared-store adapter (e.g., BigQuery conditional-insert or Cloud Firestore
  conditional write).

- `createJobRequestIdentity` (already present): derives an opaque, deterministic
  identity from an optional client-supplied `Idempotency-Key` header (1–128
  visible ASCII) or from a SHA-256 fingerprint of the file bytes + operator
  fields + shift + levers. Stores hashes only — no raw PO bytes, no sensitive
  fields. Different inputs produce different fingerprints; the same client key
  with a different request has the same `keyHash` but a different `fingerprint`,
  triggering a `CONFLICT` response.

- `createIdempotentJobService` (already present): atomic claim-before-create
  guardrail. Releases the claim on any failure or abort so the caller can
  retry. Marks complete only when `createJob` returns `durable: true`. Returns
  `IDEMPOTENCY_IN_PROGRESS` (not a hard failure) when another instance holds
  the lease; callers retry after a short delay.

**`index.mjs`** — `/jobs` route updated:

- Reads the optional `Idempotency-Key` header. Validates it through
  `createJobRequestIdentity`; malformed keys return 400 immediately.
- Buffers file bytes once (for both identity derivation and the coordinator).
- Calls `createJobIdempotently` (the wired guardrail service). When the store
  is not configured (`SERVICE_UNAVAILABLE / not configured`), falls back to the
  direct `prepareJob` call — exact backward-compatible behaviour for unconfigured
  deployments.
- Returns `409 CONFLICT` when the same key is reused with a materially
  different request.
- `createDraftJobSheet` must be a configured live adapter before `durable: true`
  is returned, completing the full durability chain.

### Tests — `test/job-idempotency.test.js` (30 tests, offline fixtures only)

| Section | Coverage |
|---|---|
| A — identity derivation | Deterministic key/fingerprint, client vs. fingerprint key, different PO → different fingerprint, invalid key (space, >128 chars), missing fileBytes, invalid shift, jobId format, no raw bytes in output |
| B — InMemoryIdempotencyStore | Claim/in-progress/conflict/complete/release/non-owner-release/expired-lease/clear |
| C — same key/same request replay | Second call returns same job; `createJob` called exactly once |
| D — conflict | Same client key + different fingerprint → `CONFLICT` |
| E — concurrent | Parallel calls with same key → one creates, one gets `IDEMPOTENCY_IN_PROGRESS` |
| F — retry after failure | Failed `createJob` releases claim; second call succeeds; non-durable result releases for retry |
| G — multi-instance shared store | Two service instances share one store; second instance replays, does not re-create |
| H — missing key | Fingerprint-derived idempotency with no client header |
| I — backward compat / invalid identity | No-store → `SERVICE_UNAVAILABLE`; bad identity → `VALIDATION_ERROR` |
| J — AbortError | Propagates through guardrail; claim released |
| K — loadJob error / key isolation | loadJob throws → `SERVICE_UNAVAILABLE`; different keys create independent slots |

### Verification

```
node --check src/job-idempotency.js   → PASSED
node --check index.mjs                → PASSED
node --test test/job-idempotency.test.js  → 30 passed, 0 failed
node --test test/*.test.js            → 186 passed, 0 failed (30 new tests)
git diff --check                      → PASSED
```

### Tracker changes

- P2-GUARD-003 added as `[!] PARTIALLY COMPLETE`.
- Dashboard: API guardrail subtasks 2→3 (total), partial 1→2; overall total
  88→89 tasks, 20→20 partial (replacing one slot), overall 39/88 applicable.

### Remaining integration blocker

`InMemoryIdempotencyStore` is process-local. A real production adapter
backed by BigQuery (conditional-insert) or Cloud Firestore (conditional write)
is required for cross-replica idempotency. The interface is defined; the
adapter slot is isolated. `createDraftJobSheet` must also be a configured
real adapter before `durable: true` is returned, completing the chain.
No cloud operation, model call, write, or deployment occurred in this batch.

## 55. Shared-store idempotency adapter — Firestore backend (2026-10-13)

Implemented the production shared-store adapter for the `/jobs` idempotency
guardrail. No cloud mutations, live writes, API enablement, or deployments
were performed.

### BigQuery atomicity verdict

BigQuery DML (`MERGE ... WHEN NOT MATCHED THEN INSERT`) cannot safely implement
the `claim` contract. BigQuery uses optimistic concurrency with no row-level
locking and no PRIMARY KEY enforcement; two concurrent MERGE statements against
the same table can both succeed and insert duplicate rows. This is the exact
race condition the guardrail must prevent. **BigQuery is therefore disqualified
as the idempotency store backend.**

### Chosen backend: Cloud Firestore `createDocument`

`POST .../documents/{collection}?documentId={id}` atomically fails with HTTP
409 `ALREADY_EXISTS` if a document with that name already exists. This is a
true set-if-absent primitive — the only correct mechanism for the mutual-
exclusion requirement. `PATCH` with `updateMask` provides field-level updates
(`complete`), and `DELETE` provides release. No new npm package is required;
the same ADC access-token mechanism as the BigQuery adapters is used.

### Files changed

| File | Change |
|---|---|
| `src/google-cloud/firestore-idempotency-store.js` | New: `createFirestoreIdempotencyStore` + `FirestoreIdempotencyError`. Implements `claim` (GET→404/create or GET→200/evaluate→expired-delete+create or conflict/in_progress/complete), `complete` (GET+PATCH owner-guarded), `release` (GET+DELETE owner-guarded, no-op on complete). Includes `toFirestoreValue`/`fromFirestoreFields` serialization. |
| `config/gcp-firestore.json` | New: project/database/collection config, API enablement requirements, IAM grant command, database creation command, explicit BigQuery-disqualification rationale. |
| `index.mjs` | Runtime gate: `USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY=true && PROJECT_ID` selects `FirestoreIdempotencyStore`; otherwise `InMemoryIdempotencyStore` (dev/test only). Comment documents why `InMemoryIdempotencyStore` is not durable. |
| `config/gcp-cloud-run.json` | Added `USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY: false` to `runtimeOptIns`. |
| `test/firestore-idempotency-store.test.js` | New: 23 offline tests (fake fetch + fake token). Covers construction validation, claim for absent doc (GET 404 → POST), claim for complete doc, in_progress with active lease, expired-lease re-claim (DELETE+POST), fingerprint conflict, 409 race (re-read), complete PATCH fields, complete non-owner no-op, release DELETE, release non-owner no-op, release complete no-op, token unavailable, network error, AbortError, unexpected GET status, URL structure. |
| `docs/PART2_COMPLETION_TRACKER.md` | P2-GUARD-003 updated with Firestore evidence; P2-TEST-001 count updated; Section 55 appended; header updated. |

### Production blocker (exact)

`firestore.googleapis.com` is not yet enabled in `prepagent-hack`. A Firestore
native-mode database named `(default)` must be created. The Cloud Run runtime
service account `prepagent-run@prepagent-hack.iam.gserviceaccount.com` requires
`roles/datastore.user`. Until these three prerequisites are met and
`USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY=true` is set in the Cloud Run environment,
the production guardrail falls back to `InMemoryIdempotencyStore` (single-
instance, not durable, not cross-replica). The `/jobs` route then falls back to
direct `prepareJob` (backward-compatible) because `createDraftJobSheet` is also
not yet a live configured adapter.

Enablement commands are documented in `config/gcp-firestore.json`.

### Verification

```
node --check src/google-cloud/firestore-idempotency-store.js  → PASSED
node --check index.mjs                                         → PASSED
node --test test/firestore-idempotency-store.test.js           → 23/23 passed
node --test test/*.test.js                                     → 209/209 passed
git diff --check                                               → PASSED
```

No task status was promoted because live Firestore access has not been verified.
P2-GUARD-003 remains `[!] PARTIALLY COMPLETE`; its adapter, tests, and
config are complete — only the three cloud prerequisites remain. No other
canonical task status changed. No GCP operation, write, API change, billing
change, or deployment occurred.

## 56. Firestore config contract test and next-item assessment (2026-10-13)

Extended `test/cloud-readiness.test.js` with assertions for the new
`config/gcp-firestore.json`: verifies `projectId`, `database`, `collection`,
`apiStatus === "NOT_ENABLED"`, `leaseMs >= 30_000`, and that the config
documents the API enablement requirement, the `roles/datastore.user` IAM
requirement, and the BigQuery-disqualification rationale. Also asserts that
`run.runtimeOptIns.USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY === false`, confirming
the gate is off by default. `node --test test/cloud-readiness.test.js`: 3/3
passed; full `npm test`: 209/209 passed; `git diff --check`: passed.

### Next-item assessment

All remaining partial task rows were re-examined against their acceptance
criteria after the idempotency and Firestore adapter work. No new
implementation-only gap exists:

- **P2-GCP-012/013/P2-APP-007/P2-AI-002**: Dataflow worker capacity has
  not recovered (`ZONE_RESOURCE_POOL_EXHAUSTED`); no new evidence; no retry.
- **P2-AI-011/013/014/016 persistence portions**: adapters/offline tests
  are complete; a genuine workflow-produced JobSheet and authorized live
  writes/uploads remain prerequisites.
- **P2-GUARD-001**: source documents do not specify trusted-proxy semantics
  or a cross-replica limiter architecture; no safe implementation is possible.
- **P2-TEST-007/008**: require final Cloud Run deployment and authorized
  end-to-end acceptance; deliberately deferred.
- **All Om-dependent rows**: optimizer/evidence SQL, approved POs, glossary,
  season profile, model acceptance, and photo provenance remain absent.

No task status was promoted. Aggregate counts remain: 39 verified, 20
partial, 21 external-blocked, 3 cloud-blocked, 5 deferred, 1 N/A (89 total).
No cloud operation, write, API change, or deployment occurred.

## 57. Stored JobSheet retrieval and operator job-lifecycle contract (2026-10-13)

Implemented the next source-backed job-sheet lifecycle slice without live
BigQuery reads or writes.

`src/stored-job-sheet-lookup.js` validates the job ID, calls the existing
`getStoredJobSheet` port with the request abort signal, and maps null/missing
rows to `NOT_FOUND`, schema failures to `SERVICE_UNAVAILABLE`, and a matching
`StoredJobSheet` to `{ ok: true, jobSheet }`. `GET /jobs/:id` uses that lookup.
`IDEMPOTENCY_IN_PROGRESS` now returns HTTP 409 instead of 400.

The operator UI: enables job preparation locally; sends a per-fingerprint
`Idempotency-Key`; loads a persisted job into the shared job ID field; updates
lifecycle steps from DRAFT/APPROVED; and shows localized `blockedAt` stage text
plus the server message for conflict, not-found, and in-progress codes. New
static strings are in all seven locale files.

Verification: `node --test test/stored-job-sheet-lookup.test.js
test/localization.test.js` 9/9; `npm test` 214/214; `node --check` on
`src/stored-job-sheet-lookup.js`, `src/operator-ui.js`, and `index.mjs`;
`git diff --check` passed. HTTP tests confirm unconfigured `GET /jobs/JC-TEST`
is `503` and a blank ID is `400`. No BigQuery read, write, Firestore enablement,
model call, or deployment occurred.

P2-AI-011, P2-UI-001, and P2-GUARD-003 remain partially complete. Next
independent workflow slice still waiting on Om's optimizer/evidence SQL is
blocked; the next unblocked offline slice is operator-facing `/jobs` success
path persistence once a genuine JobSheet can be assembled, or Firestore
enablement if separately authorized.

## 58. `/jobs` draft-persistence contract (2026-10-13)

Implemented the complete `/jobs` request path when `createDraftJobSheet` is
configured, using injected doubles only. `src/job-draft-persistence.js` runs
the coordinator first, persists only a schema-valid DRAFT whose `jobId`
matches the request identity, and marks `durable: true` only after a
repository-shaped or `{ ok: true, jobSheet }` write that still identifies that
DRAFT. Write arguments include `plantId`, `savingsCost` (from `savings.inr`),
and `currency` (from baseline risk). `USTAAD_PLANT_ID` is forwarded from the
process into the coordinator and persist layer; a missing plant ID fails
closed without calling the writer. Unconfigured persistence returns
`durable: false`. Duplicate keys replay through `getStoredJobSheet` and do not
insert a second draft. Failures and thrown writer errors release the
idempotency claim. AbortError is rethrown after release.

Defect fixed: the handler previously fell back to a second `prepareJob` when
any `SERVICE_UNAVAILABLE` message contained “not configured”, which re-ran
extraction/optimizer unavailability and could return a non-durable success
while persistence was enabled. That fallback is removed; a missing
idempotency store now stays unavailable.

The operator UI copies the shared job ID only when `durable === true`.
`mergeDraftWriteArgs` is used by the configured `createDraftJobSheet` port so
the repository still receives plant/savings/currency if a caller omitted them.

Verification: `node --test test/job-draft-persistence.test.js` (focused
contract, including merge helper); `npm test` 228/228; `node --check` on
`src/job-draft-persistence.js`, `src/job-coordinator.js`,
`src/service-ports.js`, `src/operator-ui.js`, `index.mjs`; `git diff --check`
passed. Firestore remained opt-in and unconfigured. No cloud calls, writes,
API, IAM, billing, or deployment operations.

P2-AI-011 remains partially complete pending a genuine `/jobs`-produced
JobSheet under Cloud Run workload identity.

## 59. Supplied SQL and demo-asset handoff (2026-10-14)

The user's handoff supplied the SQL pack and synthetic PO fixtures under
workspace `docs/`. Original reference assets are ignored by the workspace
`.gitignore`; only the runtime SQL copies under this app's `sql/` directory
belong in an app change. The supplied prediction, optimizer, explanation,
similar-run, seen-before, impact-batch, and four dashboard SQL files were
copied without rewriting query logic. New bounded service adapters connect
similar runs, explanations, seen-before, and `/impact/summary`; Impact reads
are opt-in, cached for one hour, and return explicit unavailability rather
than preview fallback. The seen-before route validates defects before query.

Offline verification on 2026-10-14 initially passed 267/267. After adding
BigQuery result-type validation, rejecting duplicate/unexpected rows, and
making optimizer decoding independent of result row order, `npm test` passed
271/271; the focused prediction/optimization/evidence/Impact tests passed
39/39. This did not call Gemini through the app, write production data, or
deploy Cloud Run.

Bounded direct BigQuery checks of the supplied SQL (read-only, capped at 80
MiB for ML queries and 50 MiB for dashboard/evidence queries) returned:

- PKBX0041 prediction: 10.18%, 100.4 kg, INR 5,351, WARP.
- PKBX0041 optimizer: BASELINE INR 5,351; BEST 8.42%, INR 4,426, 17.4 kg
  model-predicted savings, no throughput penalty, and exactly three changes
  (roll 170°C, gum MED, viscosity 35). This matches the deck demo, not the
  SID_NOTES prediction-cost INR 4,518 / optimizer INR 781 figures. The
  independent true-rule figure was not recomputed.
- Live explanation rows, five similar lots, and DELAM seen-before evidence
  were returned. The historical query reported 775 DELAM cases and three
  notes; no photo-classification or Gemini explanation was live-tested.
- Live `dash_kpis.sql`: 219 lots, 207 changed, 138 kg, 7.06% to 6.39%,
  INR 7,320 savings, INR currency. Live `PLANT-01` cost is INR 53.30/kg.
  This supersedes the older SID_NOTES INR 6,194 and model INR 6,775 snapshot.
  The KPI row's `scrap_cost_before` 78,774 minus `net_saving_month` 7,320
  yields the required September counterfactual INR 71,454, while its
  `scrap_cost_after` is INR 71,434; the September monthly SQL row is INR
  78,776 (rounding difference from KPI baseline). Preserve this discrepancy;
  use the explicitly specified counterfactual formula for the chart.

Remaining submission-critical work: five-PO extraction/status/line-selection
and ambiguity-resolution UI; current sensor feed/data; feedback-to-lot write
path and photo classification/provenance; Gemini/JobSheet acceptance; and
Impact tab integration. The Cloud Run deployment status below supersedes the
older pre-deployment statements in Sections 1 and 59.

## 60. First private Cloud Run deployment and route acceptance (2026-10-14)

The user authorized the first deployment. The existing Cloud Build and
Artifact Registry resources were reused; no API, project-level IAM grant,
billing, service account, bucket, dataset, model, Dataflow, or Firestore
resource was created or changed. Deployment used
`--no-allow-unauthenticated`; the final service IAM policy has no public
`allUsers` invoker binding.

### Deployment evidence

- Project/region/service: `prepagent-hack` / `asia-south1` / `prepagent`.
- Cloud Build `3a1c27ad-db4d-42a9-9010-e6625e6fce39`: `SUCCESS`.
- Image:
  `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent:part2-20261014-0245`
  with digest
  `sha256:5676d82c371544a7404af4c395231c6ad8adf7c72e87fa8820e14bd6e954f038`.
- Serving revision: `prepagent-00002-nsm`, ready and serving 100% traffic.
- Canonical service URL:
  <https://prepagent-26mwt2n7ba-el.a.run.app>
- Runtime service account:
  `prepagent-run@prepagent-hack.iam.gserviceaccount.com`; read-only IAM
  inspection confirmed the existing Vertex AI, BigQuery, Storage, Pub/Sub,
  and Translation grants.
- Runtime: `npm start`, port 8080, 1 GiB memory, zero minimum instances,
  maximum two instances. Cloud Run reports `run.googleapis.com/maxScale=2`.
- Non-secret environment applied: `PROJECT_ID`, `REGION`, `BUCKET`,
  `VERTEX_LOCATION`, `GEMINI_MODEL`, and `USTAAD_PLANT_ID`.
- Bounded read gates enabled: prediction/optimization,
  historical seen-before, and Impact. Gemini calls, BigQuery/Storage writes,
  job persistence, feedback writes, and Firestore idempotency remain disabled.
  No secret values or secret references are in the Cloud Run environment.

### Live verification

- Authenticated private-proxy `GET /health`: HTTP 200,
  `{"ok":true,"mode":"cloud-run"}`. `GET /` returned HTTP 200.
- `GET /api/status` reflected the actual gate state. Order extraction,
  similar runs, explanation, JobSheet persistence/retrieval, approval, and
  job-card integrations are explicitly unconfigured.
- `POST /risk/predict` with the supplied PKBX0041 synthetic acceptance input:
  HTTP 200, 10.18%, 100.4 kg, INR 5,351, WARP.
- `POST /risk/optimize` with the same supplied input: HTTP 200, baseline
  INR 5,351, BEST INR 4,426, model-predicted savings 17.4 kg / INR 925,
  three changes.
- `POST /evidence/seen-before` for DELAM at 86% RH: HTTP 200, 775 cases,
  three notes.
- `GET /impact/summary`: HTTP 200; 219 lots, 207 changed, 138 kg, INR 7,320
  net savings, 24 monthly rows, 4 seasonal rows, 10 top items. September's
  counterfactual remains separately labelled and is not observed production.
- `GET /conditions/current?shift=DAY`: honest HTTP 503 because the
  `PLANT-01` sensor table currently has no row. A bounded read-only query
  confirmed the empty result.
- Initial live route tests exposed BigQuery result type names `FLOAT` and
  `INTEGER`, which the decoders had rejected, and a strict seen-before input
  schema rejected the route's AbortSignal. These were corrected and covered
  by offline regression tests before the serving revision was updated.
- Stored-job retrieval and job-card retrieval return unavailable; approval
  cannot proceed without the persistence adapter. No job, card, object,
  feedback row, sensor reading, or other production record was written.

### Verification and remaining blockers

After the live decoder fixes, focused app/prediction/optimization/evidence
tests passed 51/51. The final complete `npm test` passed 271/271; all runtime
JavaScript `node --check` checks and `git diff --check` passed after the final
tracker/config updates.

This deployment is **not** full release acceptance. PO1 has not traversed
extraction, authoritative item/quantity matching, conditions, prediction,
optimization, DRAFT JobSheet persistence, retrieval, approval, and card
retrieval. The sensor table is empty; Gemini is intentionally gated off;
BigQuery/Storage writes are disabled; and JobSheet, approval, and job-card
adapters are therefore unavailable. Public judging access remains disabled
pending an explicit access decision. The live similar-run/explanation flow,
operator Impact tab, and complete PO fixture contract remain unverified.

## 61. PO1 acceptance integration follow-up (2026-10-14)

### Offline implementation

- The PDF extraction adapter now requests PO number, buyer, delivery date,
  item code and quantity using its structured Gemini response schema. It still
  obtains item specifications only from the existing parameterized item
  catalog lookup, rejects an operator order ID that conflicts with the
  extracted PO number, and returns a safe unavailable response for invalid
  extraction output.
- The operator UI displays returned PO metadata and requires explicit
  item-code/quantity confirmation before `/jobs`. The coordinator compares
  that confirmation with its own extraction, and the confirmation is included
  in the idempotency fingerprint.
- Current conditions now queries the verified six-column
  `sensor_readings` schema directly, makes one query attempt, and preserves
  reading ID, timestamp, plant ID, retrieval time and age through the
  coordinator and JobSheet persistence mapping. Measurement decoding accepts
  the table's actual BigQuery `FLOAT` type. Feed origin is `unverified` when
  the table does not record it; freshness is reported as `unassessed` because
  the project source does not define a freshness threshold.
- The parameterized similar-run BigQuery adapter is enabled independently by
  the existing historical-evidence read gate; it no longer requires the paid
  Gemini gate. Optimizer rows now require consistent INR, rates, cost/savings
  deltas and at most three changes.
- Added an injected PO1 coordinator/persistence/approval/card test. It uses
  test adapters and the real JobSheet serializer; it is offline contract
  evidence only and is not a live PO1 acceptance.

### Live status and remaining blockers

No Cloud Run deployment, Gemini inference, sensor publication, BigQuery or
Storage write, Firestore operation, or persistent test record was performed
for this follow-up. The deployed revision and runtime gates remain as recorded
in Section 60. The supplied source explicitly requires separate authorization
and cost review before any additional paid Gemini call; the sensor table has
no qualifying `PLANT-01` reading and has no feed-origin column. Consequently,
conditions, explanation, durable JobSheet persistence, approval and job-card
retrieval remain unverified live, and full PO1 acceptance is not established.

Validation after these offline changes: `npm test` passed 280/280; runtime
JavaScript syntax checks and `git diff --check` passed, including a regression
test using the table's actual six-column schema types.

## 62. Private Vertex AI enablement and PO1 extraction attempt (2026-10-14)

### Configuration and deployment

- Enabled only `gcp-vertex-ai.json:modelCallsEnabled` and the Cloud Run
  `USTAAD_ENABLE_LIVE_MODEL_CALLS` runtime gate. The configured provider,
  project, region and model remain Vertex AI / `prepagent-hack` /
  `asia-south1` / `gemini-3.5-flash`.
- Existing `createCloudRunAccessTokenProvider` obtains credentials from the
  Cloud Run metadata server. The service runs as
  `prepagent-run@prepagent-hack.iam.gserviceaccount.com`; read-only IAM
  inspection confirmed `roles/aiplatform.user` and existing
  `roles/storage.objectAdmin`. No API key, IAM grant, API, billing setting,
  public-access binding, Firestore, or other service was changed.
- Added safe extraction-response propagation of Vertex token usage fields
  when the API supplies them; the adapter allowlists integer token counts and
  does not log credentials or model content.
- Cloud Build `b21b2cb0-1478-4cbd-8dcf-f9f2e821249c` succeeded and deployed
  image `prepagent:vertex-po1-20261014-0314`, digest
  `sha256:45cfb8033aafd522d962b70582999f2f6dd6df6f00b5e053b761c8302deda023`,
  to private revision `prepagent-00003-nhv`. Authenticated health checks
  returned 200. Unauthenticated access remains disabled. The service-wide
  maximum is two instances.
- SQL prediction/optimization and read-only evidence gates remain enabled.
  BigQuery write, JobSheet storage, feedback write, and Firestore idempotency
  gates remain false. The test did not write a JobSheet or production record.

### Controlled live test

The single authenticated `POST /orders/extract` request using the supplied
`PO1_ClientA_single_B1047.pdf` returned HTTP 503. No extracted fields or token
usage metadata were returned, so PO1 extraction did not succeed and the
request does not establish a successful Vertex readiness result. The
adapter/service currently returns a generic safe unavailable response, so
the precise failing upstream stage cannot be recovered from this request's
HTTP response or request logs. No second extraction or repeated inference was
made. The temporary Storage object created by this request was deleted and
the `orders/` prefix was verified empty afterward.

A separate local readiness attempt stopped before Vertex invocation because
the operator identity lacks `iam.serviceAccounts.getAccessToken` for runtime
service-account impersonation. No IAM change was made. Exact token usage and
cost are therefore unavailable; billing is enabled and any successful
Vertex call is billable.

### Remaining PO1 blockers

- The sensor table still has no qualifying `PLANT-01` reading; current
  conditions, including source and timestamp, remain unavailable.
- Durable DRAFT JobSheet persistence/retrieval, approval, and job-card
  retrieval remain disabled and unverified. Firestore idempotency remains
  disabled.
- Explanation is available only behind the Vertex gate and validated
  BigQuery evidence; no successful live explanation was demonstrated.
- No photo-classification service/call site is implemented in this
  integration path.
- Full PO1 acceptance remains unverified; do not mark it complete.

## 63. Durable JobSheet readiness and single-call operator flow (2026-10-14)

### Code and configuration

- The operator UI no longer calls `POST /orders/extract` as a preview and then
  calls `POST /jobs` for a second extraction. It accepts the operator-confirmed
  PO line on Screen 1 and submits the PDF only once through `/jobs`; the
  deterministic coordinator compares the confirmed item code and quantity
  with its validated extraction. Changing the selected PDF clears that
  confirmation. The standalone `/orders/extract` API remains available.
- Cloud Run configuration enables only the authorized durable-write gates:
  `USTAAD_ENABLE_BIGQUERY_WRITES=true`,
  `USTAAD_ENABLE_JOB_STORAGE=true`, and
  `USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY=true`. Vertex model calls and the
  existing read gates remain enabled; feedback writes remain false. Firestore
  API, database, and service-account role setup were verified before enabling
  its gate.
- The UI now labels the active process `Cloud Run` only after the backend
  reports `mode=cloud-run`; it continues to distinguish reachability,
  configured integrations, and data/persistence checks.
- Updated the Cloud Run, Cloud Build, Artifact Registry, Firestore, offline
  test, and local-development records. Reference PO files under the
  workspace-level `docs/` directory remain outside the app container/source
  tree and were not committed.

### Build and deployment evidence

- Final Cloud Build `8e9522b4-c92b-4e73-9707-81e779162840` succeeded and
  produced
  `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent:po1-e2e-20261014-2`,
  digest
  `sha256:25395f6c46ff43833b8ecd077bc8950173299cc743425d46baae3c03adaaa9f2`.
- Private Cloud Run revision `prepagent-00005-s5x` serves 100 percent of
  traffic in project `prepagent-hack`, region `asia-south1`. The canonical
  service URL is
  `https://prepagent-26mwt2n7ba-el.a.run.app`; the deployment output also
  emitted `https://prepagent-514663464609.asia-south1.run.app`.
- Post-deployment configuration inspection verified runtime identity
  `prepagent-run@prepagent-hack.iam.gserviceaccount.com`, port 8080, memory
  1 GiB, and the three authorized gates enabled. Service metadata verifies
  `run.googleapis.com/maxScale=2`; the revision's `maxScale=12` annotation is
  bounded by that service-wide limit. Cloud Run IAM inspection found no
  `allUsers` invoker.
- Authenticated-proxy smoke checks returned HTTP 200 for `/health` and
  `/api/status`. The browser rendered the updated one-call form and reported
  `Cloud Run`. Status reports extraction, prediction, optimization, evidence,
  JobSheet persistence, durable idempotency, approval, and card adapters as
  configured; it does not prove their live data or write behavior.

### Live acceptance status

- One read-only `GET /conditions/current?shift=DAY` returned HTTP 503:
  `No stored sensor reading is available for this plant.` The accepted
  `PLANT-01` conditions row is still absent.
- No PO1 upload, Gemini inference, BigQuery/Storage job write, Firestore
  idempotency claim, JobSheet creation, approval, or card retrieval was
  performed after deployment. The earlier standalone extraction attempt
  remains a 503 and did not provide usage metadata.
- Because conditions fail before prediction and later stages, PO1 extraction,
  prediction/optimization for this run, genuine DRAFT persistence, approval,
  and card retrieval remain unverified live. Full end-to-end acceptance is
  still blocked; do not initiate the paid `/jobs` call until a real accepted
  sensor reading is available.

Validation on the final local source and manifests: `npm test` passed 283/283;
JavaScript syntax checks, Cloud Run/Build/Registry/Firestore JSON parsing, and
`git diff --check` passed.

## 64. Simulated conditions profile and direct Pub/Sub sink check (2026-10-14)

> Initial cloud findings in this section were accurate when recorded but have
> since been superseded by the user-reported subscription creation and the
> read-only verification in Section 65. Do not use the earlier "sink absent"
> statements as current status.

### Source-of-truth decision

- The Blueprint's "Run conditions (Pune seasons)" section (pp. 9–10) specifies
  the monthly RH/temperature bands, paper-moisture formula, and a latest
  `sensor_readings` row as the `getConditions` input (p. 13). The Playbook
  §§2.10–2.11 describe the Pub/Sub topic, ordinary Dataflow subscription, and
  the stream into BigQuery. The Blueprint's "Cut order if we run late" section
  names a direct Pub/Sub BigQuery subscription as the Dataflow alternative.
- Therefore, the application needs a stored conditions row for this path, but
  the references do **not** require a physical sensor: the approved publisher
  path is explicitly simulated. The source documents describe returning the
  latest/last-stored row; they do not define a maximum age. The API continues
  to report freshness as `unassessed` rather than inventing a cutoff.

### Local implementation

- `tools/publisher-runtime.mjs` now samples the documented month ranges using
  the Pune calendar month and samples paper moisture from the documented
  Normal(0, 0.6) formula, clamped to 5–12%. Each emitted JSON row is explicitly
  tagged `source: "simulated"`.
- The sensor schema/mapper and `tables.sql` include an optional nullable
  `source` field. The conditions adapter extracts that field when present but
  remains compatible with the existing six-column table; rows without source
  are truthfully labeled `unverified`. The operator UI displays source,
  timestamp, identity, age, freshness and measurement units.
- Offline tests cover all monthly ranges, the Pune/UTC month boundary,
  moisture clamping, source preservation, legacy rows without source, and the
  no-row response. This does not represent a live reading.

### Cloud state and remaining gate

- On 2026-10-14, `bq show` reported
  `prepagent-hack.prepagent.sensor_readings` had zero rows and six fields. The
  explicitly authorized nullable `source STRING` column was then added by
  BigQuery job `bqjob_r17fab270e436dad_000001a138fe2fe4_1`; no row was inserted.
- `gcloud pubsub subscriptions describe sensor-readings-df` reported an ACTIVE
  ordinary subscription attached to `sensor-readings`, with no
  `bigqueryConfig`. It is not a Pub/Sub BigQuery subscription.
- At the time of this initial check, before the user reported creating the
  sink, `sensor-readings-bq` did not exist and the describe returned
  `NOT_FOUND`. Section 65 supersedes this result.
- Project `prepagent-hack` is `514663464609`. The Pub/Sub service agent already
  has `roles/pubsub.serviceAgent`, but read-only project/dataset IAM inspection
  did not find `roles/bigquery.dataEditor` for it. The authorized
  dataset-scoped grant attempt failed with `This feature requires allowlisting`;
  no role was granted. Creating a BigQuery subscription requires Pub/Sub Editor
  (or the documented create/attach permissions) for the operator and BigQuery
  Data Editor on the target dataset for the Pub/Sub service agent.
- The active account is `aibuildercup2026@gmail.com` and has a direct project
  `roles/owner` binding. IAM Policy Troubleshooter reports both
  `pubsub.subscriptions.create` on the project and
  `pubsub.topics.attachSubscription` on the topic as `GRANTED`. Therefore, the
  generic subscription-create denial is not corroborated as a missing
  operator permission. The service agent's
  `bigquery.tables.updateData` on the destination dataset is `NOT_GRANTED`;
  this is a separate required permission, though the generic create error
  does not prove it caused that failure. Direct service-account description
  was denied (`iam.serviceAccounts.get`), but the existing IAM binding
  establishes that the service-agent identity has `roles/pubsub.serviceAgent`.
- Project-scoped Org Policy listing returned no constraints. The ancestry
  check exposed only the project, and folder/org policy inspection was not
  available to this principal. No organization-policy cause is established
  for the BigQuery allowlisting error. The dataset's existing ACL contains
  only project reader/writer/owner groups and the active user, not the Pub/Sub
  service agent.
- Minimum administrator sequence: investigate/resolve the BigQuery
  dataset-IAM allowlisting restriction using the organization's approved
  process, then grant `roles/bigquery.dataEditor` only on dataset `prepagent`
  to the existing Pub/Sub service agent. No project-wide BigQuery role or
  operator role grant is indicated by current effective-permission evidence.
  Do not enable organization policy/allowlisting from this client session.
- At that earlier point, after the administrator confirmed the dataset grant,
  the next commands were:

  ```sh
  gcloud policy-troubleshoot iam \
    //bigquery.googleapis.com/projects/prepagent-hack/datasets/prepagent \
    --principal-email=service-514663464609@gcp-sa-pubsub.iam.gserviceaccount.com \
    --permission=bigquery.tables.updateData

  gcloud pubsub subscriptions create sensor-readings-bq \
    --project=prepagent-hack \
    --topic=sensor-readings \
    --bigquery-table=prepagent-hack:prepagent.sensor_readings \
    --use-table-schema
  ```

  The operator's project-create and topic-attach permissions already tested
  `GRANTED`; if an administrator needs to recheck:

  ```sh
  gcloud policy-troubleshoot iam \
    //cloudresourcemanager.googleapis.com/projects/prepagent-hack \
    --principal-email=aibuildercup2026@gmail.com \
    --permission=pubsub.subscriptions.create

  gcloud policy-troubleshoot iam \
    //pubsub.googleapis.com/projects/prepagent-hack/topics/sensor-readings \
    --principal-email=aibuildercup2026@gmail.com \
    --permission=pubsub.topics.attachSubscription
  ```

  These are checks and the authorized subscription creation command only;
  they do not publish a message or prove ingestion. Use the existing publisher
  only after sink creation is verified and a bounded test is separately
  authorized.
- At the time this section was written, the direct subscription had not yet
  been created. Section 65 records the subsequent current state.

## 65. BigQuery sink verification and readiness update (2026-10-14)

### Read-only sink verification

- Full JSON describe of `projects/prepagent-hack/subscriptions/sensor-readings-bq`
  returned `state: ACTIVE`, topic
  `projects/prepagent-hack/topics/sensor-readings`, and `bigqueryConfig.state:
  ACTIVE`.
- `bigqueryConfig.table` is
  `projects/prepagent-hack/datasets/prepagent/tables/sensor_readings`;
  `useTableSchema` is true. The table metadata reports the publisher's six
  expected fields and nullable `source STRING`, so the configured payload is
  schema-compatible.
- `sensor-readings-df` remains a distinct ACTIVE ordinary Pub/Sub subscription
  with no `bigqueryConfig`; it is not the sink.
- A bounded read-only query found zero rows (and no source groups) in
  `prepagent-hack.prepagent.sensor_readings`. No simulated reading has been
  persisted. No Pub/Sub message was published and no direct BigQuery write was
  performed. Sink configuration is not delivery acceptance.

### Local implementation and verification scope

- `config/gcp-pubsub.json` now records the two subscriptions separately and
  captures the verified destination, schema mode, state, source provenance
  expectation, and unverified delivery status. `test/cloud-readiness.test.js`
  asserts that manifest contract. `docs/schema-contracts.md` reflects the
  verified nullable live column without claiming stored data.
- The simulated publisher, source-aware conditions adapter/UI, and
  coordinator propagation test are already present. Offline coverage verifies
  the documented seasonal profile, moisture formula/clamp, payload shape,
  legacy source-less rows, explicit no-data behavior, and unchanged stored
  conditions through deterministic coordination. This evidence is not live
  endpoint acceptance.
- Cloud Run remains private at service `prepagent`, revision
  `prepagent-00005-s5x`, image digest
  `sha256:25395f6c46ff43833b8ecd077bc8950173299cc743425d46baae3c03adaaa9f2`,
  port 8080, service maximum two instances, and runtime identity
  `prepagent-run@prepagent-hack.iam.gserviceaccount.com`. The current local
  source is newer than that deployed image. Do not claim deployment readiness
  of the latest source until it is built and preflighted; do not deploy without
  explicit authorization.

### Remaining acceptance and external dependencies

- Sensor ingestion and `/conditions/current` against a stored simulated row
  are **BLOCKED BY AUTHORIZATION** for a persistent Pub/Sub publication;
  endpoint verification additionally requires deploying the current source.
- Live PO1 extraction and the complete PO-to-approved-JobSheet-to-card flow
  remain unverified. Model generation has not succeeded for PO1; current
  conditions had no stored row. Full model acceptance also remains blocked by
  the recorded sub-threshold evaluation results for strength and crack and
  missing feature-importance evidence. Optimizer/evidence artifacts and
  business-stage confirmation remain external dependencies as recorded under
  P2-OM and P2-AI.
- Photo classification remains **BLOCKED BY EXTERNAL INPUT**: approved
  provenance/consent, class mapping, and evaluation examples are required.
  The translation glossary is also absent. No labels or business outcomes were
  invented.
- End-to-end acceptance is not the only remaining step: implementation
  dependencies, model evaluation remediation, current-source deployment, and
  live ingestion/route acceptance remain.

### Current acceptance classification

- **IMPLEMENTED AND TESTED:** bounded simulated publisher generation and
  provenance; current-conditions adapter mapping/unavailable behavior;
  deterministic conditions propagation tests; BigQuery sink manifest/test
  contract; existing validated route and JobSheet lifecycle components at
  their documented offline or synthetic-test scope.
- **DEPLOYED AND VERIFIED:** private Cloud Run revision `prepagent-00005-s5x`
  and existing service health/status checks only; the latest local repository
  changes are not in this revision.
- **ACCEPTANCE VERIFIED:** no sensor ingestion or complete genuine PO1
  workflow.
- **BLOCKED BY EXTERNAL INPUT:** model evaluation remediation and
  feature-importance evidence; photo consent/taxonomy/evaluation fixtures;
  translation glossary; remaining Om-owned production artifacts/decisions.
- **BLOCKED BY AUTHORIZATION:** one bounded simulated Pub/Sub publication and
  deployment of the current local source.
- **NOT IMPLEMENTED:** production photo classifier and glossary-backed
  translation/cache.

- Validation after these Section 65 changes: `npm test` passed 288/288 with
  zero failures; focused cloud-readiness, current-conditions, and
  coordinator tests passed 22/22; `node --check
  test/cloud-readiness.test.js` and Pub/Sub JSON parsing passed. `git diff
  --check` passed for tracked changes; per-file no-index whitespace checks for
  the edited untracked files produced no whitespace diagnostics. This
  repository checkout currently reports its source tree as untracked, so the
  ordinary Git diff does not enumerate those files.

## 66. Publisher API preflight correction (2026-10-14)

- The publisher's Pub/Sub API gate previously called unsupported
  `gcloud services describe`, which failed before any publication. It now uses
  the valid `gcloud services list --enabled` command filtered to the single
  required API (`pubsub.googleapis.com`) in the configured project and checks
  for that exact service name. An empty/unexpected result fails closed.
- Shared `runPublisher` orchestration now contains project, billing, API and
  topic checks before the bounded publish loop. The `PUBLISH_SIMULATED_SENSOR_DATA=true`
  opt-in and required `PUBLISH_MAX_MESSAGES` bound are validated before any
  preflight or publication. Regression tests use injected offline adapters;
  no gcloud call, message publication, or other cloud mutation was performed.
- `node --test test/cloud-tool-gates.test.js` passed 26/26, including the
  three new preflight/gate regressions. `npm test` passed 291/291, with zero
  failures or skips. `node --check` passed for `tools/publisher.mjs`,
  `tools/publisher-runtime.mjs`, and `test/cloud-tool-gates.test.js`;
  `git diff --check` and no-index whitespace checks for changed untracked
  files passed.
- Ingestion remains unverified until a separately authorized publication
  results in a BigQuery row labeled `source="simulated"`.

## 67. Multi-line purchase-order intake (offline implementation)

- `PurchaseOrderExtractionSchema` represents a document's metadata and ordered
  `lines`. Extraction and catalog matching run once at `/orders/extract`; the
  service retains the result and operator context in a bounded, temporary
  process-local review cache. The UI renders document metadata and every line,
  including extracted code/quantity, validation and catalog status, plus only
  the candidates actually returned by the catalog adapter.
- Ambiguous candidates require explicit operator selection. Unknown or
  malformed codes and missing quantities remain visible and can be corrected
  through the review form; corrections are represented separately from the
  extracted values and independently checked against the catalog. Missing
  document metadata is shown as unresolved rather than inferred.
- `/jobs` requires a review ID/fingerprint, exact source-line index, and
  explicit confirmation. The backend verifies the original file digest,
  extraction-content fingerprint, operator context and selected line; it
  revalidates the selected catalog item and quantity before the coordinator
  consumes it. Invalid, stale, mismatched, unconfirmed or unavailable reviews
  fail closed without rerunning paid extraction. The original multi-line PO
  result, including unresolved siblings, is preserved; the coordinator receives
  only the validated confirmed selection.
- Tests use the supplied synthetic `expected_results.json` and fixtures for
  multi-line PO review, PO4's actual ambiguous catalog candidates, PO5's
  unknown/missing-quantity cases, malformed lines, missing metadata, operator
  corrections, stale review content, mismatched/unconfirmed submissions, and
  coordinator reuse without a second extraction. Catalog/Gemini adapters are
  injected in offline tests; these results are not live extraction or
  connectivity evidence.
- Validation: focused review/API/extraction/catalog/coordinator/idempotency
  tests passed **121/121**; full `npm test` passed **332/332** with zero
  failures or skips. `node --check` passed for changed JavaScript modules and
  tests; `git diff --check` passed. No model call, cloud operation, upload,
  production write, or deployment was performed.
- Limitation: the review cache is process-local, capped at 100 entries, and
  expires after 30 minutes. A restart or request routed to another Cloud Run
  instance can invalidate a review; the API fails explicitly rather than
  repeating extraction. Shared review storage or an approved request-affinity
  design would be needed for reliable multi-instance operation; neither was
  added.
- Status: the operator review/selection and backend confirmation gap is
  implemented and offline-tested. Live Gemini extraction, live catalog
  connectivity, shared/multi-instance review continuity, and full PO-to-job
  acceptance remain unverified. No deployment or live operation was performed.

## 68. Production-intelligence contract hardening (offline)

- The prediction adapter now rejects missing, blank, non-numeric and
  non-finite BigQuery measurements instead of allowing values such as `null`
  to coerce to zero. It checks that the five returned rates reconcile with
  total scrap and that `primary_defect` follows the tie order in the supplied
  `predict.sql`. The coordinator repeats the summary-consistency check at its
  service boundary and does not mark a malformed prediction stage complete.
- The conditions adapter rejects multiple rows from its latest-row query,
  verifies the returned plant, requires a parseable timestamp, and rejects a
  future-dated reading. Existing no-row unavailability, source provenance,
  last-stored-row fallback, and `freshness: "unassessed"` behavior remain;
  no staleness cutoff or substitute reading was added.
- The coordinator now requires optimizer baseline settings to equal the
  operator's validated plan, checks the optimizer baseline against the
  prediction, and verifies that the reported unique lever changes exactly
  describe the difference between baseline and recommendation. Optional
  `modelPredicted` and `note` metadata are preserved through the optimizer
  result contract. Similar-run rows are parsed against `SimilarRunSchema`
  before being returned.
- Draft JobSheet explanations explicitly distinguish model-predicted or
  optimizer-reported savings from observed production outcomes. The PDF
  savings heading likewise identifies the amounts as estimates rather than
  observed results. No BigQuery schema fields were added for this display
  wording.
- Added offline regression tests for missing prediction values, wrong primary
  defect, inconsistent totals, duplicate/future sensor readings, optimizer
  plan/change-list mismatches, and coordinator refusal before downstream
  services. Corrected the shared test fixture's rates to sum to its declared
  5% and removed its unsupported change entry from coordinator workflow
  doubles.
- Verification: focused conditions/prediction/optimization/evidence/
  coordinator/persistence/PO1/PDF tests passed **103/103**; `npm test` passed **317/317** with
  zero failures or skips. `node --check` passed for all changed JavaScript
  modules and tests; `git diff --check` passed.
- Scope/evidence: all service tests are offline and use injected adapters.
  No Pub/Sub message was published; no BigQuery sensor row was read or
  written; no model/translation call, persistence write, deployment, or IAM
  change was performed. This hardens implementation contracts but does not
  establish live sensor ingestion, model evaluation/feature-importance
  acceptance, or genuine end-to-end PO1 acceptance.

## 69. Batch B evidence follow-up (offline)

- Compared the model acceptance requirement to Blueprint p. 12 and Playbook
  p. 14: held-out `r2_score >= 0.6`; top `ML.FEATURE_IMPORTANCE` drivers must
  match each defect's generator rules. The local handoff contains SQL and
  historical notes, but no model artifact/version payload, held-out lot
  evaluation set, fresh evaluation result, or feature-importance output.
  Historical R² values previously recorded (warp 0.6052, delam 0.6664,
  strength 0.4673, print 0.7512, crack 0.3011) are retained as historical
  only; they were not reproduced or independently reverified in this offline
  task. The recorded strength and crack values are below the authoritative
  threshold, if still current. No training, hosted inference, or paid call was
  made. P2-OM-001 remains incomplete pending Om's current model identities,
  approved evaluation provenance/results, and feature-importance evidence;
  failing models require authorized remediation.
- Compared optimizer behavior against Blueprint pp. 12–13 and Om's
  `docs/sid_pack/SID_NOTES.md` / `optimize.sql`. The supplied SQL and handoff
  define the actual app implementation as plan-relative baseline and
  slowdown penalty. The Blueprint describes a plant-standard median-habit
  baseline and first-pass fixed penalty reference points. Existing notes also
  report INR 781 for the known case, while the later recorded SQL output is
  INR 925/17.4 kg. This session does not treat either as plant-approved or
  change SQL to guess between conflicting definitions. P2-OM-003 remains
  partial pending Om's written resolution of the reference baseline, penalty
  thresholds, plant `cost_per_kg` provenance, and expected example.
- Tightened `src/google-cloud/risk-optimization-service.js` to independently
  validate rounded plan-relative throughput penalty values against the
  documented handoff formula (Rs 200 per additional drying hour, Rs 60 per
  m/min slower single facer, Rs 30 per sheet/min slower printing). Lever
  change reasons now say the setting was selected in the lowest modeled
  total-cost candidate and explicitly disclaim causal effect. Added
  regressions for inconsistent penalties and noncausal reason wording.
- Tightened `src/google-cloud/risk-evidence-service.js`: prompt language now
  explicitly describes attributions as model contribution/association, not
  real-world cause and effect; returned text with explicit causal claims is
  rejected. Tests cover causal-claim rejection and retain acceptance of
  evidence-bounded noncausal wording. Existing conditions
  provenance/freshness, prediction-output, similar-run identifiers/filtering,
  attribution schemas, and JobSheet estimate-vs-observed boundaries were left
  intact after review; no unsupported freshness cutoff or manufacturing
  assumptions were added.
- Verification on 2026-10-14: focused optimizer/evidence/coordinator/
  JobSheet/PO1 tests passed **56/56**; full `npm test` passed **334/334** with
  zero failures or skips. `node --check` passed for changed Batch B modules
  and tests; `git diff --check` passed. The editor test tool found no tests
  for these paths, so the focused suite was run with Node's configured test
  runner. No cloud/model calls, publication, persistent write, deployment,
  IAM change, or retraining occurred.
- Status: optimizer/evidence validation changes are implemented and offline
  tested; previously completed conditions, risk mapping, similar-run row
  validation, deterministic coordinator and JobSheet safeguards remain
  intact. Batch B is not wholly accepted offline because current model
  evaluation/feature importance and the authoritative plant optimizer
  baseline/penalty reconciliation are unresolved. It is not fully live
  verified or end-to-end accepted.

## 70. Job lifecycle persistence, approval recovery, and feedback retry contract

- `src/google-cloud/job-sheet-repository.js` now reads every DRAFT merge back
  from BigQuery and checks the stored identity, plant, DRAFT state, order,
  conditions, baseline/recommended profiles, changes, evidence, explanation,
  savings/currency, and unset approval/card fields. An absent, changed, or
  non-DRAFT row is not reported as a successful creation. The conditional
  approval update is also read back before returning success; a zero-row race
  remains a conflict.
- `src/google-cloud/job-card-service.js` accepts only a validated DRAFT for
  approval, checks the uploaded object identity, and verifies the persisted
  APPROVED status, approval time and card URI. If the write response is lost,
  it reconciles by reading the job: it retains a referenced object, avoids
  deleting an object when the outcome remains unknown, and removes only the
  uploaded generation after confirming that it is not referenced. Retrieval
  requires an approved sheet, approval timestamp, private bucket URI and PDF
  signature.
- Firestore idempotency claim replacement, completion and release now use the
  Firestore document `updateTime` precondition. A stale instance cannot delete
  or complete a newer claim, and failed completion is not surfaced as job
  success. Fake-REST offline tests cover same-key concurrent calls,
  conflicting fingerprints, failed-work retry, reconstructed service replay,
  expired-lease races, and version-conditional complete/release. This is not a
  live cross-instance acceptance test. The runtime flag was not changed.
- Feedback `insertId` is derived from the mapped payload without the
  server-created timestamp, so a retry with the same feedback reuses its
  identifier. A changed payload produces a different identifier. BigQuery's
  streaming insert-ID deduplication remains best effort; no schema-level
  exactly-once guarantee or new feedback identifier was invented.
- Combined offline lifecycle coverage composes the real repository and card
  service with injected BigQuery/Storage ports. It verifies matching read-back,
  retry after an initial read failure, DRAFT retrieval, approval persistence
  despite an ambiguous response, and approved PDF retrieval. Existing linked
  feedback tests verify stored-job/lot association and the feedback writer's
  failed-write path.
- Rejection remains **BLOCKED BY EXTERNAL INPUT**: the authoritative status
  schema and documented route define DRAFT/APPROVED/RUN/CLOSED and do not
  define rejection. The product owner must specify eligible source states,
  terminal status, reason/evidence fields, and card visibility/cleanup behavior
  before a rejection transition or endpoint is added.
- Feedback-to-lot insertion remains **BLOCKED BY EXTERNAL INPUT**: Om's
  handoff says to write measured results into `lots` using conditions and
  levers actually used, but the current feedback input does not identify run
  date, actual conditions or actual settings. The proposed insert also has no
  approved idempotent lot-ID contract. Do not infer these values from a
  recommended JobSheet or write a synthetic production outcome.
- Verification: focused lifecycle/persistence/idempotency/feedback tests
  passed **104/104**; full `npm test` passed **350/350**, with zero failures or
  skips. No cloud writes, persistent demo operations, live model calls,
  publication, deployment, IAM/API changes, or runtime-gate changes occurred.
- Status: JobSheet persistence/read-back, approval/card recovery,
  Firestore CAS contract, and feedback retry identity are **IMPLEMENTED AND
  OFFLINE TESTED**. They are not acceptance-verified in this batch. P2-AI-011,
  P2-AI-014, P2-AI-016, P2-GUARD-003 remain partial; P2-TEST-008 remains
  blocked pending genuine service inputs and live authorization.

## 71. Batch D operator and integration readiness (offline)

### Impact evidence screen

- **IMPLEMENTED:** Added Screen 4 to the existing operator UI. It calls only
  the existing same-origin, read-only `/impact/summary` route; the existing
  `USTAAD_ENABLE_IMPACT_SUMMARY` gate, SQL, and service ports were not changed.
- The screen separates the held-out September 2026 synthetic evaluation from
  historical lot-table rows. It describes savings and after-settings values
  as counterfactual/modelled estimates, not measured production results,
  verified factory savings, or causal effects. Historical rows are not
  represented as verified real-world outcomes.
- Source/coverage messaging reports a direct BigQuery query versus the
  successful one-hour cache, the SQL's pre-October-2026 coverage, and the
  most recent returned month. Empty tables render explicitly; failed requests
  clear prior results, unavailable services do not reveal sample values, and
  malformed payloads are rejected before display. Expired cache data is not
  served when refresh fails.
- `P2-UI-001`, `P2-UI-007`, and `P2-UI-008` are **IMPLEMENTED AND OFFLINE
  TESTED** for the Impact surface only. Full workflow acceptance remains
  **NOT ACCEPTANCE VERIFIED** and **NOT LIVE VERIFIED**.
- `P2-AI-015` / `P2-OM-010` remain **BLOCKED BY EXTERNAL INPUT** pending
  Om-confirmed photo consent/provenance, anonymization, authoritative mapping
  of folders such as `crushed` and `good` to the supported defect taxonomy,
  label quality, and train/evaluation split metadata. A live classifier also
  requires separate **BLOCKED BY AUTHORIZATION** clearance. No labels,
  thresholds, or model results were invented.
- `P2-UI-003` / `P2-AI-017` remain **BLOCKED BY EXTERNAL INPUT** pending
  Om's reviewed glossary CSV with `en,hi,mr,ja,ko,zh-CN,id` columns and
  approved trade terminology; Translation setup and live calls remain
  **BLOCKED BY AUTHORIZATION**. No glossary content was created and no
  Translation call was made.

### PO review-to-job-card offline composition

- **IMPLEMENTED:** Fixed the draft-persistence handler forwarding contract so
  the coordinator receives the current PO review ID/fingerprint and confirmed
  source-line binding rather than dropping the submitted review.
- **OFFLINE TESTED:** The PO1 composition test now uses the supplied PDF and
  expected-results fixture through the review service, coordinator,
  draft-persistence/read-back adapter, approval service, and job-card
  retrieval. It asserts the extracted document metadata, exact selected line
  item/quantity, single extraction, stored DRAFT, approval state, and retrieved
  PDF. Extraction/catalog and downstream services, storage, and persistence
  remain injected test adapters; this is not live acceptance or durable
  persistence evidence.
- **NOT ACCEPTANCE VERIFIED / NOT LIVE VERIFIED:** No genuine model call,
  production catalog query, persistent write, deployment, or end-to-end
  factory workflow was performed. The separate live end-to-end measure
  remains **0/1 verified**.

### Verification and deployment boundary

- Historical Batch D starting baseline: `npm test`, **350/350 passed**.
- Focused UI/API, Impact-service, Impact-render-contract, and localization
  tests: **33/33 passed**.
- Before the PO-review/persistence composition change, the current repository
  baseline was `npm test`, **354/354 passed**. The focused PO review,
  coordinator, persistence, lifecycle-recovery, and composed workflow tests
  then passed **51/51**.
- Final `npm test`: **354/354 passed, 0 failed, 0 skipped**. One earlier
  invocation during final validation exited non-zero; its captured output was
  unavailable. A subsequent output-captured run completed successfully with
  the count above. The first
  post-change full-suite attempt had two localization failures because an
  English-only key was added; that key was removed, preserving existing
  locale contracts, and the focused and full suites then passed.
- `node --check` passed for the changed persistence handler and composed
  workflow test, as well as the JavaScript files checked during Batch D.
  `git diff --check` was clean; because the pre-existing `prepagent/` tree is
  untracked at the workspace root, all touched files were also scanned
  directly for trailing whitespace and none was found.
- No cloud reads/writes, model or Translation calls, sensor publication,
  deployment, API/IAM changes, or runtime-gate changes occurred. The current
  deployed revision does not include this local UI change. The existing
  historical live endpoint result in Section 60 is not fresh verification of
  this UI or current data availability.

**Next priority:** after obtaining the required genuine service inputs and
authorization, complete live `/jobs` acceptance and then separately authorize
build/deployment and Impact-screen verification. Do not start that work as
part of this Batch D update.

## 72. Final acceptance readiness (2026-10-14)

### Acceptance decision

**PARTIALLY READY — SPECIFIC BLOCKERS REMAIN.** The supplied PO1 fixture now
traverses the local review, coordinator, persistence-handler, approval and
card-service composition, and its focused regression suite passes. Extraction,
catalog resolution, conditions, prediction and optimization in this composed
test use injected adapters; this is offline evidence, not live acceptance.
The latest deployed revision is `prepagent-00005-s5x`, while repository-local
source has changed since its image was built. Historical PO1 extraction on
that revision returned HTTP 503; no successful live PO-to-card run exists.

### Required PO-to-card stage evidence

| Stage | Current evidence | Acceptance boundary / next action |
|---|---|---|
| PO input, extraction and review | Supplied PO1 bytes and expected-results fixture; review service returns the expected PO metadata and line. The composed test explicitly marks extraction `mock-demo` and not a real model prediction. Earlier offline tests cover stale review, ambiguity and invalid lines. | Live Vertex extraction/catalog has not succeeded; the historical deployed PO1 request returned 503. One controlled retry requires explicit approval for PDF upload, paid Vertex generation and bounded BigQuery catalog read. |
| Selected line and catalog validation | Offline review confirmation binds the fixture's exact line, item code, quantity, file digest and review fingerprint; coordinator rejects mismatches in dedicated tests. | Real catalog lookup has not been verified on an accepted extraction. |
| Conditions | Adapter and coordinator tests cover valid, malformed, future, mismatched-plant and empty results; empty data stops the workflow without a synthetic substitute. Historical Cloud Run conditions request returned unavailable because no stored plant reading existed. | No current valid sensor row is evidenced. A one-message simulated test and route check require separate authorization; no publish or Dataflow retry occurred here. |
| Prediction and optimization | Supplied SQL and service adapters have offline contract tests; recorded direct BigQuery query outputs exist in earlier sections. The composed E2E uses injected test results. | Direct SQL output is not current model evaluation or route acceptance. Resolve the optimizer contract and reproduce model acceptance from current versioned artifacts before claiming production acceptance. |
| JobSheet, DRAFT persistence/read-back, approval and card | Composed offline test passes using the real coordinator, persistence handler, mapper and card service with injected storage/repository ports; repository/card recovery tests cover failures and approved-only retrieval. | No current-source Cloud Run write/read/approval/upload/retrieval was performed. Obtain separate authorization for one test lifecycle, after current source is privately deployed. |
| Overall E2E | **OFFLINE-TESTED** through the stages above; no complete current live evidence. | **NOT ACCEPTANCE VERIFIED / NOT LIVE VERIFIED.** Preserve the separate live measure at 0/1. |

### Model and contract blockers

- **P2-OM-001 — BLOCKED BY EVALUATION EVIDENCE:** Read-only BigQuery and
  Vertex metadata on 2026-10-14 confirm `m_warp`, `m_delam`, `m_strength`,
  `m_print`, and `m_crack` exist and map to `prepagent_{warp,delam,strength,
  print,crack}` version `1` with the `default` alias in `asia-south1`. Model
  metadata confirms `BOOSTED_TREE_REGRESSOR`, `RANDOM`, and a 20% evaluation
  fraction. The supplied training SQL uses `prepagent.lots` with
  `run_date < 2026-09-01`; the separate September held-out Impact set is not
  the model-evaluation split. Historical BigQuery metadata recorded on
  2026-10-12 reports R² `.6052, .6664, .4673, .7512, .3011` respectively:
  warp, delam and print met the `r2_score >= 0.6` threshold in that snapshot;
  strength and crack did not. These values have not been freshly reproduced
  or directly linked to today's registry version metadata. No
  `ML.FEATURE_IMPORTANCE` output or training-data provenance/leakage evidence
  is recorded, so no model is acceptance-verified. Minimum evaluation is
  `SELECT * FROM ML.EVALUATE(MODEL \`prepagent-hack.prepagent.m_warp\`);` and
  `SELECT * FROM ML.FEATURE_IMPORTANCE(MODEL
  \`prepagent-hack.prepagent.m_warp\`) ORDER BY importance_gain DESC;`, repeated
  for each of the five names. Those BigQuery model queries were not run:
  cost cannot be estimated from the available job metadata, and explicit
  operation-specific authorization is required. Om owns the version-linked
  score/feature-importance evidence and any failing-model remediation.
- **P2-OM-003 — BLOCKED BY EXTERNAL INPUT:** The Blueprint (pp. 12–13)
  specifies plant-median baseline and first-pass fixed penalty references;
  Om's `SID_NOTES.md`/`optimize.sql` use the supervisor's plan as baseline and
  charge plan-relative slowdown. Their documented example says INR 781/17.4
  kg, while later recorded SQL output says INR 925/17.4 kg. Om must resolve
  the baseline, penalty formula/thresholds, plant `cost_per_kg` provenance
  and expected example. No objective/result was changed to guess.
- **P2-AI-014 — BLOCKED BY EXTERNAL INPUT only if rejection is required:**
  Authoritative status/route evidence defines DRAFT, APPROVED, RUN, CLOSED
  and approve/card retrieval, but no reject transition. Rejection is not a
  stage in the required PO-to-card chain. Before adding rejection, the product
  owner must specify eligible source states, target/terminal status,
  mandatory reason, evidence retention, existing-card handling, and retrieval
  visibility.
- **P2-AI-016 / feedback-to-lot — BLOCKED BY EXTERNAL INPUT:** The handoff
  requires a lot-learning insert from actual outcomes, actual run date,
  actual conditions and actual levers. Current `FeedbackInputSchema` records
  rates/photos and job/optional lot IDs, but not those measured-run inputs or
  an approved stable lot ID/idempotency rule. Om must define the exact
  measured-run payload and identity semantics. Never infer actual values from
  the JobSheet recommendations.

### Integration and optional-capability status

- **P2-AI-002 / sensor:** current-conditions adapter fails explicitly on no
  row and never substitutes values. Read-only checks on 2026-10-14 confirm
  ACTIVE `sensor-readings-bq` and `sensor-readings-df`; the BigQuery sink
  targets `prepagent.sensor_readings` with table-schema mapping. Table
  metadata reports zero rows, partitioned by `ts`, with the expected reading
  fields including nullable `source`; therefore no qualifying plant reading
  is currently stored. No row query or live conditions request was made.
  Minimum live evidence is one separately authorized bounded simulated
  publication, exactly one stored `source="simulated"` row matching its
  publication timestamp and `PLANT-01`, and a private conditions response
  whose provenance matches that row. No continuous publisher or Dataflow
  retry.
- **P2-AI-001 / extraction and catalog:** offline fixture/service contracts
  pass; no accepted live result. Keep the UI's operator-supplied order ID,
  paper type and supplier explicit. Authorize upload, one Vertex call and
  catalog read separately; do not repeat the historical 503 call without
  approval.
- **P2-AI-011, P2-AI-013, P2-AI-014 / persistence and card:** current adapters
  and recovery tests are offline-tested. Historical synthetic cloud writes
  are not fresh current-source workload-identity evidence. A future single
  lifecycle must record DRAFT write/read-back, conditional approval, exact
  private card object/URI and approved retrieval; it requires explicit
  deployment and persistent-write authorization.
- **P2-UI-001/007/008 / Impact:** screen is implemented and its offline tests
  cover valid, empty, unavailable, malformed and expired-cache refresh
  failures. It uses the existing gated read-only endpoint and does not write
  or substitute samples. Existing endpoint results are historical; the latest
  local screen is not live-verified. The shared localhost page was inspected
  without triggering an API request; it displayed the unconfigured message
  and explicitly reported that no request or preview/sample values were used.
- **P2-UI-003 / Translation:** not required to execute the enumerated core
  English PO-to-approved-card sequence, but required for the Playbook's
  translated-card/demo capability. Remains **BLOCKED BY EXTERNAL INPUT**
  pending Om's reviewed glossary CSV/terminology and **BLOCKED BY
  AUTHORIZATION** for setup or calls.
- **P2-AI-015 / photo classification:** separate from the enumerated core
  PO-to-card path; do not block that path solely on classification. The
  Day-3 photo capability remains **BLOCKED BY EXTERNAL INPUT** for
  consent/provenance, taxonomy mapping, label quality and split metadata, and
  **BLOCKED BY AUTHORIZATION** for upload/inference.
- **Deployment/configuration:** current read-only Cloud Run metadata reports
  Ready service `prepagent` in `asia-south1`, 100% traffic on
  `prepagent-00005-s5x`, service maximum scale 2, and no `allUsers` or
  `allAuthenticatedUsers` IAM principal. The deployed image digest remains
  `sha256:25395f6c46ff43833b8ecd077bc8950173299cc743425d46baae3c03adaaa9f2`.
  Cloud Build `8e9522b4-c92b-4e73-9707-81e779162840` records a Cloud Storage
  source archive but no repository commit SHA. Current local HEAD is
  `844d872193793fe23aa3c1ec81243c81d760b314` with a dirty worktree; exact
  source-to-image equivalence cannot be established and local changes are not
  represented by a clean source revision. The repository has a Dockerfile
  and a Cloud Build status manifest, but no executable build/deploy script or
  Cloud Build YAML; do not invent a deployment command. The config records
  port 8080, `npm start`, the existing runtime service account, 1 GiB,
  maximum two and private access. Existing opt-in gates recorded on the
  deployed revision were not changed or exercised. A user handoff image says
  “public URL”; that conflicts with the explicit private-service boundary and
  is not authorization to widen access.

### Quality evidence and exact next actions

- Current initial baseline: `npm test` **354/354 passed**. Final focused run
  across app routes, PO review, coordinator, persistence, lifecycle recovery,
  idempotency, feedback, conditions, extraction/catalog, prediction,
  optimization, evidence and Impact: **245/245 passed, 0 failed, 0 skipped**.
  Final full `npm test`: **354/354 passed, 0 failed, 0 skipped**. One earlier
  focused invocation overlapped a second loopback app-test run and exited
  non-zero despite TAP reporting 245 passed/0 failed; reruns without
  concurrent app-server tests passed, including the final sequential run.
- `node --check` passed for `index.mjs`, `src/job-draft-persistence.js`, and
  `test/po1-coordinator-workflow.test.js`. Every `config/*.json` file and the
  supplied PO expected-results JSON parsed successfully. `git diff --check`
  and direct trailing-whitespace checks on the acceptance changes passed.
- No unresolved test failures. The parallel-run exit anomaly was not
  reproducible when the loopback tests were run serially.
- Local next steps are complete for the offline composition; no further
  implementation batch is warranted unless a concrete acceptance failure is
  found.
- External inputs: current model evaluation/importance package; Om's
  optimizer interpretation; if actual-lot learning is required, the measured
  run payload and stable lot identity; if rejection is required, the explicit
  rejection contract; and, separately, photo consent/taxonomy and glossary.
- Explicit authorization required for live work: one simulated sensor
  publication; one PO upload/paid extraction/catalog read; private deployment
  of current source; one bounded BigQuery JobSheet/approval lifecycle and
  private Storage card operation. Keep Cloud Run private; no live operation
  was performed for this assessment.

## 73. Batch F bounded acceptance and release readiness (2026-10-14)

### Status

**PARTIALLY COMPLETE — OFFLINE WORK COMPLETE; LIVE ACCEPTANCE NOT VERIFIED.**
The current-source offline PO1 composition passes through review, exact line
selection, coordinator services, DRAFT write/read-back adapters, approval,
and approved-card retrieval. It uses injected extraction, catalog, conditions,
prediction, optimization, repository, and Storage adapters. Do not count it
as genuine service execution or a live PO-to-card acceptance run.

### Concrete acceptance defect fixed

- **P2-TEST-008 / source-line traceability:** the exact zero-based extracted
  `lineIndex` was checked during coordinator preparation but was not retained
  in the DRAFT JobSheet's persisted `order_json` or final card. Added optional
  `order.purchaseOrderLineIndex` only to the JobSheet order contract, set it
  from the validated selected line at JobSheet construction (after risk and
  optimization services consume the unchanged production-order profile),
  preserved it through the existing JSON persistence/read-back path, and
  render it as a one-based “Source PO line” on the PDF. Non-PO JobSheets omit
  the field; old stored JobSheets remain valid. No table column or business
  value was added.
- Regression coverage verifies the source index survives the composed PO1
  DRAFT round trip and is passed to the real offline PDF renderer; renderer
  tests verify the displayed one-based number and omission for non-PO jobs.
- **Implemented and offline-tested only.** No persistent Cloud Run record or
  card was created.
- Current verification from the application repository: focused lifecycle,
  review, service-contract, Impact, and provenance tests **201/201 passed**;
  complete `npm test` **356/356 passed**. JavaScript syntax checks passed for
  `index.mjs` and all `.js`/`.mjs` files under `src`, `tools`, and `test`
  excluding vendored `node_modules`; all 11 relevant JSON files parsed;
  `git diff --check` passed. The first validation invocation was mistakenly
  run from the workspace parent and could not locate app files; corrected
  invocations from `prepagent/` produced the results above.

### Model evaluation (P2-OM-001)

As of this update, read-only `bq show --model` plus Vertex model/version
metadata list the following current version identities (all have `default`
alias, created/updated 2026-10-11):

| BQML model | Vertex model version | Historical R² (2026-10-12 tracker evidence) | Historical threshold comparison | Current acceptance |
|---|---|---:|---|---|
| `m_warp` | `prepagent_warp@1` | 0.6052 | Met 0.6 in the recorded snapshot | UNKNOWN; no fresh version-linked evaluation or feature importance |
| `m_delam` | `prepagent_delam@1` | 0.6664 | Met 0.6 in the recorded snapshot | UNKNOWN; no fresh version-linked evaluation or feature importance |
| `m_strength` | `prepagent_strength@1` | 0.4673 | Below 0.6 in the recorded snapshot | UNKNOWN; historical result requires remediation if reproduced |
| `m_print` | `prepagent_print@1` | 0.7512 | Met 0.6 in the recorded snapshot | UNKNOWN; no fresh version-linked evaluation or feature importance |
| `m_crack` | `prepagent_crack@1` | 0.3011 | Below 0.6 in the recorded snapshot | UNKNOWN; historical result requires remediation if reproduced |

The documented minimum queries are `ML.EVALUATE` and `ML.FEATURE_IMPORTANCE`
for each named BQML model; no such query or model invocation was performed.
Query cost is not reasonably estimable from the available evidence. The
evaluation split remains random 20% over the pre-September-2026 training
source; no fixed seed, independent lot-level leakage analysis, or feature
importance result is available. The September Impact holdout remains separate.

### Current read-only preflight

- Cloud Run service `prepagent` is Ready in `asia-south1`; revision
  `prepagent-00005-s5x` receives 100% of traffic. The platform service cap is
  `run.googleapis.com/maxScale=2`; the revision template annotation says 12
  and is bounded by the service cap. IAM has no public `allUsers` or
  `allAuthenticatedUsers` member. No deployed route was invoked.
- Cloud Build reports success for build
  `8e9522b4-c92b-4e73-9707-81e779162840`, image digest
  `sha256:25395f6c46ff43833b8ecd077bc8950173299cc743425d46baae3c03adaaa9f2`,
  and a Cloud Storage source archive with no resolved repository commit SHA.
  The current app worktree has uncommitted changes; the deployed image cannot
  be treated as current source.
- Local `PORT=48711 npm start` returned HTTP 200 from `/health` and
  `/api/status`. Status identified the process as local development and
  reported live adapters/model calls/writes unavailable. The local startup
  command and port work; this is not deployed-health evidence.
- Current metadata shows Pub/Sub topic and both subscriptions ACTIVE, with
  `sensor-readings-bq` targeting the existing partitioned
  `prepagent.sensor_readings` table. Table metadata reported zero rows at
  inspection; no publication, row query, or conditions endpoint call was
  performed.
- **Prepared sensor procedure, pending authorization:** run from `prepagent`
  only after explicit permission for one Pub/Sub write:
  `PROJECT_ID=prepagent-hack PUBLISH_SIMULATED_SENSOR_DATA=true PUBLISH_MAX_MESSAGES=1 node tools/publisher.mjs`.
  The publisher requires explicit opt-in and enforces one message. Then use
  an authorized bounded read for exactly one `PLANT-01`, `source='simulated'`
  row at the logged publication timestamp and confirm the private
  `/conditions/current?shift=<operator-selected-shift>` response has matching
  `readingId`, timestamp and sensor values. Do not retry Dataflow.

### External decisions, authorization, and classification

- **Om / P2-OM-003:** resolve plant-median versus supervisor-plan baseline,
  fixed Blueprint penalties versus plan-relative slowdown, the source of
  `cost_per_kg`, and INR 781 versus INR 925 for the 17.4 kg example. Do not
  deploy model-dependent workflow acceptance before this formula is approved.
- **Om / P2-OM-001:** supply data lineage and top-driver rules/evidence or
  authorize the exact ten model-evaluation/importance queries; remediate
  strength/crack if the historical below-threshold values reproduce.
- **User/operations authorization:** one private deployment of current source
  (Cloud Build source upload/image push and Cloud Run revision change), one
  simulated Pub/Sub publication plus bounded BigQuery row/conditions reads,
  one PO1 PDF upload/paid Vertex extraction/catalog read, and one persistent
  DRAFT/read-back/approval/private-card/retrieval lifecycle. These are
  distinct operations. Preserve current runtime environment/gates, service
  identity, max two, and private access; no cleanup may delete a committed
  card. The deployment invocation is not present in the repository; obtain
  the approved runbook rather than guessing.
- **Om/product owner, optional capabilities:** feedback-to-lot is a later
  learning/demo capability, not a required PO-to-card stage; it remains
  blocked on actual-run date/conditions/settings, measured outcomes, and lot
  identity/idempotency semantics. Rejection is not in the core route contract;
  define its state/reason/cleanup rules only if required. Translation remains
  blocked on the reviewed glossary. Photo classification remains separate
  and blocked on the consent line, approved taxonomy/labels, provenance and
  split metadata. Impact UI is implemented and offline-tested; live values
  were not refreshed and estimates remain distinct from observed outcomes.
- No public access, deployment, build, sensor publication, Dataflow retry,
  BigQuery query/write, Storage upload, Gemini/Translation call, approval,
  persistent test record, or runtime-gate/IAM/API change was performed.

### Batch G handoff

Batch F's offline acceptance and release preparation is complete to the extent
allowed by the current inputs. **The full Batch F exit criteria and product
acceptance remain unmet:** historical model failures and unresolved optimizer
semantics block use of model recommendations; sensor ingestion is empty; no
current-source live workflow exists; and deployment/paid/persistent operations
lack authorization. Carry these exact blockers and this source-line regression
fix forward; do not repeat Batches A–E or claim live acceptance.

## 74. Live model-call path and browser 403 triage (2026-10-14)

### Flag and application path

- The exact flag is `USTAAD_ENABLE_LIVE_MODEL_CALLS`. `src/service-ports.js`
  reads it as an exact `"true"` string and requires the independent
  `config/gcp-vertex-ai.json` `modelCallsEnabled: true` setting plus project,
  bucket, model, and location. Unset, empty, `"false"`, `"TRUE"`, and `"1"`
  leave extraction/explanation adapters unavailable. `index.mjs` separately
  derives `/api/status.runtimeAvailability.liveModelCallsEnabled` from the
  process flag and actual adapter availability; this status field is
  descriptive, not an additional call gate.
- Local startup does not load an env file. Its unset process flag is disabled.
  The deployed manifest `config/gcp-cloud-run.json` records the flag `true`
  on `prepagent-00005-s5x`; the current worktree remains dirty and its code
  has not been built/deployed, so this does not establish the current source
  is live.
- UI API requests are same-origin (`window.location.origin`) and contain no
  Cloud Run ID token. The PO extraction UI reaches `POST /orders/extract`;
  the Vertex adapter then obtains workload identity and sends one
  `:generateContent` request. Gate-off extraction fails explicitly with
  HTTP 503 `SERVICE_UNAVAILABLE`, not 403.

### Changes and offline verification

- Corrected the service-port documentation comment to match the actual
  two-setting gate; documented the exact local flag, fail-closed parsing,
  identity requirement, and same-origin browser behavior in
  `docs/LOCAL_DEVELOPMENT.md`.
- Added mocked offline checks proving non-exact/unset opt-ins do not reach a
  provider; exact opt-in wires the configured Storage, Vertex and catalog
  adapters; the Vertex adapter sends exactly one mocked `:generateContent`
  call; and the HTTP route returns its explicit disabled 503.
- Focused `node --test test/google-cloud-order-extraction.test.js
  test/app.test.js`: **43/43 passed**. Full `npm test`: **358/358 passed**.
  Syntax checks for the changed JavaScript, relevant model/Cloud Run JSON
  parsing, and `git diff --check` passed. The initial focused run had one test
  expectation mismatch (it expected the legacy standalone extraction
  message; the route uses the review adapter); the corrected assertion and
  rerun passed. No application failure remains.

### Live call and 403 status

- After the user explicitly authorized exactly one text-only request, one
  real `generateContent` request was sent using the current repository's
  `createVertexGeminiClient` adapter, ADC, and
  `prepagent-hack/asia-south1/gemini-3.5-flash`. At
  `2026-10-14T09:58:05.808Z` UTC, it returned a valid `ready` response in
  1,306 ms. Sanitized provider usage metadata was 15 prompt, 1 candidate,
  91 thoughts, 107 total tokens. The response text was not logged or stored.
  Local evidence correlation ID:
  `68fe1e6a-d25b-49cf-89ca-419230dd67ab`; the adapter exposed no provider
  request ID. One call only; no retry.
- This verifies one live provider response through the current low-level
  Vertex adapter, not a deployed revision, the configured full extraction
  API route, or browser access. No PO upload, Storage/BigQuery request,
  deployment, IAM change, or browser API request was made.
- The shared browser target `http://localhost:4172/#screen-impact` returned
  connection refused. `lsof` confirmed no listener on 4172. `package.json`
  defines `npm start` as `node index.mjs`, which defaults to 8080; it has no
  4172 script. An existing Node server was listening on 8080 from this
  repository, but its in-memory page lacked the current Impact screen, so it
  was left untouched. Started a fresh instance with `PORT=8081 npm start`;
  it reported `Ustaad AI Prep Agent running at http://localhost:8081`.
  Browser and HTTP checks confirmed current-worktree root UI/Impact screen,
  `/health`, `/api/status`, and same-origin API routing on 8081. With the
  model gate unset, a valid synthetic PDF request returned the expected
  `503 SERVICE_UNAVAILABLE`; no provider or cloud adapter was invoked.
- For the user-reported direct Cloud Run response
  `403 "Your client does not have permission to get URL / from this server."`,
  Cloud Run's recorded `allowUnauthenticated: false` policy and absence of a
  public IAM binding, together with the operator UI's same-origin requests
  and lack of an ID-token mechanism, identify Cloud Run IAM authentication as
  the cause for a direct unauthenticated browser request. It is rejected
  before application routes; the model gate cannot cause this 403.
- `gcloud run services proxy --help` confirms the supported private path:
  it attaches the active account's identity token to proxied requests and is
  specifically intended for IAM-protected Cloud Run services. With explicit
  authorization, ran
  `gcloud run services proxy prepagent --project=prepagent-hack
  --region=asia-south1 --port=8082`. All three allowed requests returned
  HTTP 200: `/` (HTML), `/health` (`mode=cloud-run`), and `/api/status`
  (`mode=cloud-run`, model gate enabled, extraction adapter configured).
  Opened the browser UI at `http://localhost:8082/`; its same-origin
  `/api/status` request succeeded and showed Cloud Run mode. UI remains the
  older deployed build (only Screens 1–3; no current-worktree Impact screen).
  Proxy and current local app remain listening on 8082 and 8081 respectively.
  The active caller has sufficient invocation permission for the successful
  requests; IAM was not changed. Do not add a public IAM principal or change
  authentication.

**Status:** flag parsing/config is implemented and now documented; disabled
behavior is verified; enabled extraction wiring is offline-tested; one
text-only live model call through the current Vertex adapter is verified;
the existing deployed UI/API browser path is verified through the authenticated
proxy; current local source is not deployed, and extraction workflow is not
verified live.

## 75. Screen 1 submission visibility and offline browser simulation

### P2-UI-001 / P2-UI-002 — operator UI and PO review flow

### P2-UI-002 — operator PO review flow

- The single existing `#review-order` action was moved from below the long
  Screen 1 input card into the Screen 1 heading, alongside its submission
  status. In the current local browser at a 1024×768 viewport, the button was
  visible at y=292–336px without scrolling. No second submit control was added.
- Replaced the stale initial message that said the PDF would be submitted
  during job preparation on Screen 2. File selection now says the document is
  selected but still must be submitted. Attempting submission with no file or
  missing operator context now produces an explicit live-region message and
  does not send a request.
- Browser simulation used the supplied synthetic
  `PO1_ClientA_single_B1047.pdf`, operator inputs from its documented
  scenario, and intercepted `POST /orders/extract` responses: first a
  `SERVICE_UNAVAILABLE`, then a success-shaped test response populated from
  `expected_results.json`. Missing file/context errors did not send a request;
  after the mocked 503, the file and operator fields were retained for retry.
  The successful intercepted request was multipart with the PO ID, paper type
  and supplier; the UI displayed PO `CLA/PO/2026/1047`, buyer, delivery date,
  source line `PKBX0041`, quantity `1300`, and `MATCHED`, then allowed line
  selection and operator confirmation. This is **offline UI simulation only**,
  not Gemini extraction, catalog connectivity, or acceptance evidence.
- The actual local `/orders/extract` route, with the live-model gate disabled,
  returned HTTP 503 `SERVICE_UNAVAILABLE` for the synthetic PO1; `/`,
  `/health`, and `/api/status` returned HTTP 200. No extraction result was
  represented as successful.
- The authenticated Cloud Run proxy still serves revision
  `prepagent-00005-s5x`. Its Screen 1 has no separate extraction action and
  retains the prior upload-during-job-preparation description. No deployment,
  Cloud Run mutation, or IAM change was made; the local fix is not deployed.
- `P2-UI-002` remains **PARTIALLY COMPLETE**. Live PO extraction/catalog
  access and the full PO-to-approved-card workflow remain unverified.
- Validation: focused `node --test test/app.test.js
  test/po1-coordinator-workflow.test.js` passed **21/21**; `npm test` passed
  **358/358**; `node --check` passed for both changed JavaScript files; and
  `git diff --check` passed.

## 76. Whole-application production-readiness follow-up — 2026-10-14

- `P2-UI-002` remains **PARTIALLY COMPLETE**. The PO ID and loaded-reel
  fields remain part of Screen 1; they were not removed. The form now puts
  those required operator inputs first, followed by the source document and
  the single extraction action. At a 1024×768 local viewport, all three
  operator fields, the file selector and submit action fit in the initial
  view. Empty-file submission displays validation feedback and sends no
  request.
- Screen-by-screen local inspection found the Screen 4 Impact click listener
  placed after an unconditional return inside the generic GET-handler loop.
  It is now registered separately and reaches `/impact/summary`; a local
  browser request returned the expected HTTP 503 because local Impact reads
  are not configured. No preview values were shown.
- Other screens remain present in the current local source. Screen 2 analysis
  and Screen 3 persistent-job actions are disabled when local adapters are
  unavailable; rejection remains disabled because there is no rejection API
  contract. The deployed private revision is older and does not contain the
  local Screen 1 layout or Screen 4 navigation.
- At the time of this initial review, read-only live checks through the
  authenticated private proxy showed `/health` and `/api/status` HTTP 200,
  `/conditions/current?shift=DAY` HTTP 503 with no stored sensor reading,
  `/impact/summary` HTTP 200, and `/fx?base=INR` using the dated static
  fallback (`2026-10-09`). The controlled live follow-up and later calls are
  recorded in Section 77 and supersede the statements about sensor publication
  and PO upload below.
- The direct Cloud Run URL remains private; the user-observed 403 is consistent
  with its `allowUnauthenticated: false` configuration. Authenticated proxy
  checks succeeded without changing IAM.
- At the time of Section 76, full PO-to-approved-card live verification was
  **BLOCKED** by missing sensor data and the lack of operation-specific
  authorization for an extraction or sensor publish. Section 77 records the
  subsequent authorized bounded tests; neither those tests nor the later
  simulated reading constitute job approval or production acceptance.
- Validation after these UI changes: focused `node --test test/app.test.js`
  passed **20/20**; `npm test` passed **358/358**; `node --check` passed for
  `src/operator-ui.js` and `test/app.test.js`; `src/locales/en.json` parsed
  successfully; and `git diff --check` passed.

## 77. Controlled live smoke follow-up and failure diagnostics — 2026-10-14

- **Sensor acceptance evidence:** one simulated message was published after
  explicit user authorization using the bounded repository publisher.
  Pub/Sub acknowledged message `21979885863051723` at
  `2026-10-14T11:57:13.921Z`; a read-only BigQuery read-back found row
  `b6dccb94-3f54-4f3b-b41d-cc7bca09ca43` (`PLANT-01`, `source=simulated`,
  RH 59.9, temperature 30.2, moisture 8.88). This verifies the one message's
  delivery/read-back, not a production sensor feed or a Dataflow retry.
- **Current conditions:** despite that row and a successful exact-SQL read
  under the caller's `bq` identity, Cloud Run returned HTTP 503 for
  `/conditions/current?shift=DAY`. Cloud Run request logs contain the 503 but
  no application-level diagnostic. Root cause is **UNRESOLVED**; no row
  absence should be reported as the current cause.
- **PO extraction:** one live `POST /orders/extract` using the documented
  synthetic PO1 and its documented operator context returned HTTP 503 after
  3.686 seconds with `SERVICE_UNAVAILABLE` / `INTEGRATION_ERROR`. No review
  result or model-usage metadata was returned. The service reported no
  temporary-object cleanup failure; successful Vertex generation and billing
  status remain unverified. The request was not retried.
- **Read-only production APIs:** `/risk/predict` returned HTTP 200 with source
  `bigquery-ml` and `isRealModelPrediction=true`. `/risk/optimize` returned
  HTTP 200 using the actual catalog record and the explicitly simulated
  conditions: baseline prediction 6.44% / 63.5 kg / INR 3,387; best
  prediction 5.31% / 52.3 kg / INR 2,790; model-estimated savings 11.2 kg /
  INR 597. `/evidence/seen-before` returned HTTP 200 from BigQuery for
  DELAM/86% RH. These outputs are model predictions or historical evidence,
  not measured production outcomes.
- **Deployed artifact and access:** read-only Cloud Run inspection confirms
  revision `prepagent-00005-s5x` at 100% traffic, image tag
  `po1-e2e-20261014-2`, digest
  `sha256:25395f6c46ff43833b8ecd077bc8950173299cc743425d46baae3c03adaaa9f2`,
  service URL `https://prepagent-26mwt2n7ba-el.a.run.app`, port 8080,
  runtime identity `prepagent-run@prepagent-hack.iam.gserviceaccount.com`,
  and max instances 2. The service remains private; its IAM policy returned
  no public `allUsers` binding. Direct browser 403 is expected without Cloud
  Run authentication; the existing authenticated proxy on port 8082 works.
  Cloud Build metadata did not expose a source SHA, and the deployed UI lacks
  local Screen 4/current Screen 1 changes, so source equivalence is not
  established.
- **Local diagnostics:** added structured, redacted error logs for the
  conditions and PO extraction catch paths plus tests. The diagnostic includes
  only event, stage, allowlisted error code, and sanitized error class; it
  never includes exception messages, PO content, prompts, or model response.
  These local changes are not deployed, so they do not explain the observed
  Cloud Run failures yet.
- No job was created; approval, feedback persistence, and stored job-card
  retrieval were not invoked. They must not be marked live verified. The full
  PO-to-approved-card flow remains **BLOCKED** by the conditions and
  extraction failures, plus the need for a genuine authorized human approval.
- Validation after the diagnostic change: focused conditions and extraction
  tests passed **37/37**; `npm test` passed **359/359**; JavaScript syntax,
  Problems checks, and whitespace checks passed. A deployment is required to
  activate these diagnostics, but no deployment or other cloud mutation was
  performed.

## 78. Catalog numeric decoding and candidate live extraction — 2026-10-14

- **Root cause and fix:** The tagged conditions-fix revision returned HTTP
  503 for the synthetic PO1 extraction. Sanitized Cloud Logging identified
  schema type errors on catalog dimensions, ply, GSM, and BF. BigQuery REST
  declares numeric schema types as `INTEGER` and `FLOAT` and returns their
  values as strings; the catalog decoder recognized only `INT64` and
  `FLOAT64` aliases. The decoder now normalizes both standard aliases and the
  focused regression covers their wire representation.
- **Live candidate verification:** Cloud Build
  `62c92ff7-9600-46b1-a6d7-2cd7ad4186c4` built image
  `catalog-numeric-20261014-1`, digest
  `sha256:f839a6b2862e41fff90229ea046c777881077b5c41b9c56ae2e6cacc7c5054ca`.
  Candidate revision `prepagent-00009-voy` was deployed with the matching
  private traffic tag and 0% default traffic. `/health`, `/api/status`, and
  `/conditions/current?shift=DAY` returned HTTP 200. One bounded synthetic
  PO1 extraction returned HTTP 200 from `vertex-gemini`, a valid real model
  response, one `MATCHED` line, no clarification requirement, and an accepted
  in-memory review; usage reported 825 prompt, 62 candidate, 1,276 total
  tokens. The successfully uploaded PDF remains in private Cloud Storage for
  workflow linkage.
- **Deployment boundary:** Production remains at 100% traffic on
  `prepagent-00005-s5x`. Candidate `prepagent-00009-voy` receives no default
  traffic. The service remains private; no IAM or public-access changes were
  made. The source archive came from a dirty worktree and Cloud Build did not
  capture a commit SHA.
- **Not verified:** No DRAFT JobSheet or job was created; there was no
  approval, feedback write, or job-card retrieval. Only the simulated sensor
  reading was available. Candidate live extraction and conditions success do
  not constitute production rollout or PO-to-approved-card acceptance. A
  genuine authorized operator must make any approval.
- **Offline validation:** `node --test test/google-cloud-order-extraction.test.js`
  passed **25/25**; complete `npm test` passed **362/362**; syntax checks for
  both changed JavaScript files and `git diff --check` passed.
- **DRAFT persistence remains blocked:** Operator-supplied DAY, MED gum
  application, 170°C roll temperature, and 35-second gum viscosity are demo
  settings. SF speed 38 m/min, MED pasting pressure, and four-hour drying are
  proposed optimizer-grid values, not confirmed actual settings; print speed
  remains unconfirmed. Since `/jobs` requires the complete operator-confirmed
  settings, no second extraction or persistent DRAFT submission was
  performed. Conditions remain explicitly simulated. Any future test record
  must remain test-only and unapproved.

## 79. Local operator UI recovery and Screen 2 integration wiring — 2026-10-14

**Tracker items advanced:** P2-UI-001, P2-AI-005 and P2-AI-006. All remain
partially complete; no live acceptance status changed.

- **Browser/runtime defects fixed:** The emitted inline module previously
  contained a literal newline in a JavaScript string and a NUL-delimited
  fingerprint separator, so Chromium rejected the module. The label escape
  and fingerprint serialization are now safe for the enclosing HTML template.
  Screen navigation also now toggles the `.is-active` CSS class as well as
  `hidden`; previously all panels were hidden by `.screen { display: none; }`.
- **Screen 2 integration:** Similar-run and explanation controls now call the
  existing validated `POST /risk/similar-runs` and `POST /risk/explanation`
  routes. The UI renders only bounded, validated historical evidence, marks
  explicit `offline-test-adapter` results as test-only, and enables explanation
  only for current model-sourced prediction/optimizer results plus evidence
  sourced from the configured BigQuery adapter. Input changes and out-of-date
  requests invalidate or discard dependent results. No route was enabled in
  the local runtime.
- **Browser verification:** Current source started on local port 8097. `/`,
  `/health`, and `/api/status` returned HTTP 200; status reported
  `local-development`, live model calls disabled, and no production adapters
  configured. All four screen panels displayed on navigation; submitting
  Screen 1 with no document returned actionable validation feedback. A browser
  request to Screen 2 was intercepted locally and verified as a same-origin
  POST with the supplied complete order/conditions shape. The intercepted
  empty response was labeled `OFFLINE TEST ADAPTER`; the explanation button
  remained disabled. No file was uploaded and no cloud endpoint was called.
- **Offline validation:** Focused route/UI tests passed **2/2**; complete
  `npm test` passed **363/363**; `node --check` passed for changed JavaScript
  files; `git diff --check` passed.
- **Not verified / handoff:** No PO extraction, live prediction/optimization,
  BigQuery similar-run read, Gemini explanation, job persistence, approval,
  card retrieval, deployment, IAM change, or traffic shift was performed in
  this follow-up. The supplied PO-to-approved-card journey remains incomplete.
  Before release, deploy only with operation-specific authorization and
  demonstrate the complete workflow with confirmed operator settings and
  approved acceptance records; do not infer that these local UI checks satisfy
  live acceptance.

## 80. Test-only settings and local API gate verification — 2026-10-14

- **Runtime evidence:** The current source was started with `PORT=8098 npm
  start`. `/health` and `/api/status` both returned HTTP 200. Status identified
  `local-development`, with live model calls, extraction, conditions, risk,
  persistence, and durable idempotency unavailable. No production adapter was
  enabled.
- **Browser/API evidence:** Screen 1 rendered the operator-confirmed PO ID,
  loaded paper type, supplier, PDF picker, and extraction action. Submitting
  a synthetic in-memory PDF to the actual local `POST /orders/extract` route
  returned HTTP 503 `SERVICE_UNAVAILABLE` because
  `extractOrderForReview` is not configured. The UI displayed that no
  operation was completed. No Vertex, Storage, or catalog request occurred.
- **Job submission gate:** A valid-shaped local `POST /jobs` request used
  explicitly test-only order values and the proposed test values
  `SF=38`, `roll temperature=170`, `gum=MED`, `viscosity=35`,
  `pasting pressure=MED`, and `drying=4h`; `printSpeedSpm=50` came only from
  the synthetic fixture and is not an operator-confirmed setting. The route
  returned HTTP 503 `SERVICE_UNAVAILABLE` with
  `Durable JobSheet persistence is not configured; job preparation was not
  run.` It did not invoke the coordinator or persist a DRAFT. This verifies a
  safe local gate response, not successful job creation or setting acceptance.
- **Offline regression evidence:** The fixture-backed coordinator test covers
  PO review through in-memory draft persistence, retrieval, approval, and card
  retrieval, but all adapters and records are test-only. Focused PO/review/
  lifecycle tests passed **15/15**; full `npm test` passed **363/363**.
  JavaScript syntax checks and `git diff --check` passed.
- **Production acceptance remains blocked:** None of the supplied machine
  values is approved as an actual operating profile; print speed remains
  unconfirmed. A real operator must confirm all seven levers, order/loaded
  paper context, shift, and conditions before any production job. No genuine
  extraction, sensor read, prediction, optimization, durable DRAFT,
  read-back, human approval, or card retrieval was attempted.
- **Independent release blockers remain:** The optimizer baseline, penalty,
  `cost_per_kg` provenance, and INR 781/925 discrepancy still require the
  authoritative owner decision. Current version-linked held-out model
  evaluation and feature-importance evidence is absent; historical Strength
  and Crack metrics are below the recorded 0.6 threshold. The PO review
  reference remains process-local, and rate limiting remains per-instance;
  no approved shared-store/retention or trusted-proxy contract exists. Do not
  invent these contracts or add a persistent schema to the existing bucket or
  Firestore.
- No cloud build/deployment, Cloud Run invocation, paid model call, BigQuery
  query, Storage upload, production record, approval, IAM change, or traffic
  change was performed. Production remains on the previously recorded
  `prepagent-00005-s5x`; this local source is not represented as deployed.

## 81. Private current-source candidate deployment and smoke evidence — 2026-10-14

- **Authorization and release scope:** The user explicitly approved the
  standard Cloud Build plus private Cloud Run zero-traffic candidate flow.
  No public-access change, IAM mutation, runtime-gate change, or traffic
  migration was authorized or performed.
- **Preflight:** Read-only Cloud Run metadata showed service `prepagent` in
  `asia-south1`, production traffic at 100% on `prepagent-00005-s5x`, the
  configured runtime identity `prepagent-run@prepagent-hack.iam.gserviceaccount.com`,
  service-level `run.googleapis.com/maxScale=2`, and no `allUsers` or
  `allAuthenticatedUsers` IAM member. The external reference directory at
  `/prepagent-work/docs` was outside the application build context; no commit
  was created.
- **Build/deploy:** Cloud Build `1b17eb12-d717-4cef-bf96-0398ee12c42a`
  completed `SUCCESS` in `asia-south1` from the recorded source archive
  `gs://prepagent-hack_cloudbuild/source/1791984562.559358-1b18074ef59e4a10bb96ea0867e27e19.tgz`
  (generation `1791984570993025`). Image
  `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent:release-readiness-20261014-1`
  has digest
  `sha256:75eb3a5af8f18388b309018c4e106f9e168ba202363fbf83f15a7e4eef8e83ec`.
  Cloud Run revision `prepagent-00010-pag` is Ready with the configured
  runtime service account and receives 0% default traffic. Its private tagged
  URL is
  `https://release-readiness-20261014-1---prepagent-26mwt2n7ba-el.a.run.app`.
  Production traffic remains 100% on `prepagent-00005-s5x`. No source commit
  SHA exists because the built worktree was dirty; the Cloud Build archive is
  the captured source artifact.
- **Authenticated verification:** `gcloud run services proxy prepagent
  --region=asia-south1 --project=prepagent-hack --port=8099
  --tag=release-readiness-20261014-1` accessed the candidate without changing
  its IAM boundary. `/health` returned HTTP 200 (`mode=cloud-run`),
  `/api/status` returned HTTP 200 and reported the expected configured
  production adapters/gates, and `/insights/summary` returned HTTP 503 with
  an explicit `getInsights is not configured` response. The candidate UI
  loaded through the authenticated local proxy, showed Cloud Run mode, and
  retained Screen 1's operator PO ID, loaded-paper details, file picker, and
  extraction action. These checks verify startup, status, UI and one
  fail-closed optional route only; they do not prove adapter connectivity.
- **Final offline validation:** Focused deployment-manifest and API regression
  tests passed **24/24**; final `npm test` passed **363/363**. The updated
  Cloud Run manifest parsed as JSON, changed JavaScript passed `node --check`,
  and `git diff --check` passed.
- **No paid or persistent acceptance operation:** No Vertex request,
  BigQuery query, Storage upload, `/orders/extract`, `/jobs`, approval, card
  generation, or production record was sent to the candidate. Its status
  reports live model calls, persistence, and job creation configured, which
  is configuration evidence only. The test-only settings were exercised only
  against the local fail-closed route as recorded in Section 80.
- **Readiness disposition:** `prepagent-00010-pag` is a private,
  zero-traffic release candidate—not a production rollout. The application
  remains **not production-ready** pending real operator-confirmed machine
  settings and conditions, successful live PO-to-card acceptance, approved
  optimizer semantics, current model-quality evidence, and durable review /
  cross-instance rate-limit design. Do not shift traffic or create/approve a
  DRAFT until those gates pass.

## 82. Master acceptance prompt source reconciliation — 2026-10-14

Reference material was inspected in the workspace-level `docs/` directory,
outside the application Git repository. No reference file was added to a Git
commit. The master Blueprint, Playbook, Om's `SID_NOTES.md` and SQL handoff,
synthetic PO readme/expected results, photo-handoff screenshot, and legacy
`impact_dashboard.html` were compared with current source and tests.

| Gate / requirement | Current source and evidence | Status / remaining blocker |
|---|---|---|
| Source/build provenance | App branch `main`; existing worktree contains numerous prior edits and untracked implementation files. Candidate `prepagent-00010-pag` maps to Cloud Build archive and image digest in Section 81, but not a clean commit SHA. Model-evaluation SQL/tests in the local tree were added after that build; no runtime implementation changed after it. | Candidate is an identifiable artifact, but release tree is not clean/reconciled and exact latest-tree identity is not a Git revision. Do not describe source as commit-pinned. |
| PO1 review-to-card flow | `test/po1-coordinator-workflow.test.js` consumes the supplied synthetic PO1 PDF and expected output, then runs extraction mock, line confirmation, coordinator, in-memory persistence/read-back, approval, and card retrieval. In Chromium on local port 8101, Screen 1 accepted the synthetic PO1 and test-only operator fields and rendered the expected extracted review from an explicitly intercepted response labeled `offline-synthetic-fixture`. No real extraction API or business write was made. `/orders/extract` and `/jobs` in the local API fail closed because local adapters are absent. | Offline fixture workflow passes; local Screen 1 rendering passes with interception only. Current deployed live PO1 flow is not complete: production extraction previously failed; tagged revision `prepagent-00009-voy` extraction passed, but DRAFT persistence/read-back, operator approval, and job-card retrieval remain unverified live. Do not repeat a paid call without specific authorization. |
| Sensor/current conditions | Conditions adapter validates provenance/freshness and has empty/malformed cases in its test suite. Historical controlled evidence records one simulated Pub/Sub row and HTTP 200 from tagged revision `prepagent-00009-voy` for `/conditions/current?shift=DAY`. | No sensor row was used in the complete PO-to-card workflow, and the simulated reading is not production telemetry. The older production revision had returned 503; the newer `prepagent-00010-pag` conditions route was not probed. No sensor publication or Dataflow operation was performed in this segment. |
| Five models | On 2026-10-14 at 13:53 UTC, the authorized read-only `ML.EVALUATE` query returned current results for all five named BQML models. `ML.FEATURE_IMPORTANCE` then returned 29 rows/model using fields `feature`, `importance_gain`, `importance_cover`, and `importance_weight`. | Fresh evaluation and importance output exist, but `m_strength` and `m_crack` remain below the 0.6 minimum. Feature rankings still need formal comparison with the approved generator rules; data lineage, leakage review, and exact model-version linkage remain incomplete. |
| Optimizer and savings | Blueprint p.12 says plant-standard/median baseline and first-pass fixed penalty thresholds. Om's supplied `sid_pack/optimize.sql` and `SID_NOTES.md` use the supervisor's planned settings as baseline and plan-relative slowdown penalties. SQL implementation/tests currently enforce the Om handoff contract. | Do not change the formula without owner decision. The INR example difference is consistent with different cost-per-kg inputs: Om's 100.4 kg / INR 4,518 baseline implies INR 45/kg, while the historical INR 5,351 baseline / 100.4 kg implies about INR 53.30/kg; the INR 781 vs INR 925 savings ratio is correspondingly close to 45 vs 53.30. Rounded figures alone do not prove the exact raw calculation. Om must confirm authoritative baseline, penalty and current plant cost input, and provide the expected unrounded comparison. |
| Persistence, review, approval, idempotency | `src/purchase-order-review.js` holds a 30-minute/100-entry in-memory review map. Firestore is wired only for job idempotency; JobSheet read/write and card operations have explicit adapters and the offline lifecycle recovery suite. | No approved PO-review collection/schema/retention contract exists. Do not store extracted PO contents in Firestore/Storage by assumption. Two-instance review continuity and distributed rate limiting remain blocked. |
| Test-only DRAFT path and operator settings | No application `TEST_ONLY` route or flag exists; the production `/jobs` path retains the validated machine-settings contract. The offline `test/job-draft-persistence.test.js` harness injects fixture preparation and in-memory persistence/idempotency and stops at DRAFT retrieval. `test/schemas.test.js` checks the production shape/ranges. | This is a test-only harness, not a deployable test mode, and it does not prove a persistent Cloud Run DRAFT. The operator confirmed no operator-approved record is available: DAY, 38 m/min, 170°C, MED gum, 35 sec, MED pressure, 4 hours, and print speed are all unconfirmed (print speed has no value). No persistent `/jobs` submission was attempted. |
| UI, Impact and supporting features | Current UI calls `/impact/summary`, validates only BigQuery/cache provenance, and has unavailable/empty states. Existing `impact_dashboard.html` is a separate legacy page with hard-coded preview values; it is not the app's live data source. Similar-runs/explanation UI is source-gated and offline-tested. | Browser screen/navigation and fail-closed route behavior are verified. No live Impact refresh or complete deployed user workflow was run. Do not use the legacy preview values as current production results. |
| Localization, glossary, photos/feedback | Current app has locale/currency schemas and UI paths; `config/gcp-translation.json` records glossary provisioning pending. Workspace reference inventory contains no glossary CSV. The supplied photo-handoff screenshot requests a photo-consent line but is not itself consent. Photo upload/classification and feedback adapters are unavailable by default. | Do not provision/call Translation or classify a plant photo until the reviewed glossary or explicit consent/provenance/taxonomy artifact is supplied and authorized. |
| Private Cloud Run candidate | Section 81 records candidate readiness, authenticated proxy health/status, zero traffic, private IAM and the two-instance service cap. | Candidate is verified for startup/status and an honest unavailable route, not live integration readiness. Production remains on the older revision. |

The two SQL files are read-only acceptance tooling. After separate
authorization for these potentially billable queries, both were run with
standard SQL in project `prepagent-hack`, location `asia-south1`.
`ML.EVALUATE` returned:

| BQML model | R² | Threshold (`>= 0.6`) |
|---|---:|---|
| `m_warp` | 0.6051769 | Pass |
| `m_delam` | 0.6664104 | Pass |
| `m_strength` | 0.4672613 | **Fail** |
| `m_print` | 0.7511529 | Pass |
| `m_crack` | 0.3010716 | **Fail** |

The values reproduce the prior recorded snapshot but are fresh query results
against the current named BQML models. The query itself does not pin a Vertex
model version, so the prior model metadata must not be treated as exact
query-time version linkage. `ML.FEATURE_IMPORTANCE` returned 29 rows for each
model. Top five features by `importance_gain` were:

| Model | Top features (`feature: importance_gain`) |
|---|---|
| `m_warp` | `ambient_rh_pct: 21.5994`, `gum_application: 16.5942`, `top_liner_gsm: 12.4828`, `drying_hours: 6.8346`, `ink_colors: 3.5743` |
| `m_delam` | `ambient_rh_pct: 60.4611`, `gum_application: 40.9375`, `paper_moisture_pct: 18.3665`, `gum_viscosity_sec: 9.8429`, `sf_speed_mpm: 9.8296` |
| `m_strength` | `ambient_rh_pct: 6.8115`, `paper_type: 5.3110`, `pasting_pressure: 1.9758`, `liner_bf: 0.8466`, `ambient_temp_c: 0.5514` |
| `m_print` | `ink_colors: 260.7668`, `ink_coverage_pct: 64.1382`, `flute_profile: 44.4900`, `ply: 11.2203`, `width_mm: 11.1836` |
| `m_crack` | `ambient_rh_pct: 13.9981`, `ink_coverage_pct: 2.2085`, `roll_temp_c: 1.9815`, `paper_type: 1.6461`, `paper_supplier: 1.6423` |

Several leading drivers are plausible from the described process (for example
humidity for warp/delamination and ink features for print), but importance
gain has no direction and plausibility is not acceptance. Compare the full
rankings with Om's actual defect-generator rules, establish feature lineage
and leakage safety, and obtain exact version-linked evaluation before
accepting any model. Notably, `customer_id` has nonzero feature importance in
all five models (gain: crack 0.8643, delam 1.7916, print 8.2992, strength
0.1662, warp 2.3926). Combined with the documented random row-level 20%
evaluation split, this is a concrete memorization/generalization risk that
requires source review and a customer-grouped holdout; it is not, by itself,
proof of target leakage. the initial importance query used an incorrect assumed output field
(`feature_name`) and failed at compile time. After correcting the SQL to the
observed schema, the query succeeded; the CLI's default 100-row display limit
omitted the final model's rows, so the same read-only query was rerun with
`--max_rows=1000` to capture all 145 results. The successful query may
therefore have incurred charges more than once; the amount is not available
in captured CLI output. No training, model replacement, or business-data
mutation was performed.

**Validation for this update:** before the operator-settings clarification,
the complete offline suite passed **365/365** with `cd prepagent && npm test`.
That suite includes the existing isolated PO1 lifecycle fixture test, which
uses in-memory adapters for its later approval/card assertions; it creates no
Cloud Run or business records. After the explicit instruction not to perform
approval or card creation, the focused DRAFT/schema suite
(`node --test test/job-draft-persistence.test.js test/schemas.test.js`) passed
**24/24**; it stops at DRAFT behavior and uses in-memory adapters. I did not
rerun the full PO1 lifecycle test after that instruction. `node --check
index.mjs` and syntax checks for all `.js`/`.mjs` files under `src`, `tools`,
and `test` (excluding vendored `node_modules`) passed. Every JSON file directly
under `config/` parsed, and `git diff --check` passed. The Screen 1 browser
exercise used `PORT=8101 npm start` and an explicitly intercepted synthetic
fixture response; it is UI-rendering evidence only, not live extraction
evidence.

## 83. Remediation candidate and final acceptance state — 2026-10-14

### Code fixes and offline verification

- Feedback persistence now rejects any photo URI, defect label, or confidence
  value before calling the writer. Photo presence is not consent, and no
  consent/provenance-safe photo storage path is configured.
- Job-card approval now checks the requested language and currency before
  repository or storage side effects. The API validates and forwards the
  selected preferences, and the UI sends those preferences; unsupported
  values fail before approval.
- `cd prepagent && npm test`: **378 passed, 0 failed**. Syntax checks for
  `index.mjs` and `.js`/`.mjs` files under `src`, `tools`, and `test` passed;
  all `config/*.json` parsed; `git diff --check` passed.

### Model and optimizer evidence

- The fresh read-only named-model evaluation remains Warp R² `0.6051769`,
  Delam `0.6664104`, Strength `0.4672613`, Print `0.7511529`, and Crack
  `0.3010716`; Strength and Crack do not meet the `>=0.6` acceptance floor.
  `customer_id` remains a nonzero-gain feature in all five models. The
  customer-grouped candidate SQL is prepared but has not been executed or
  trained, and exact model-version linkage is missing.
- A bounded read-only optimizer prediction returned raw baseline
  `100.39080697 kg / INR 5350.83001153` and BEST
  `83.04681388 kg / INR 4426.39517993`; under the existing row-level rounding
  it reports INR 925 savings at INR 53.30/kg. The INR 781 historical example
  is consistent with INR 45/kg. This resolves the arithmetic discrepancy,
  not the contract conflict: Blueprint median/standard baseline versus Om's
  supervisor-planned baseline and plan-relative penalties. No formula was
  changed; Om's business-rule decision remains required.

### Private zero-traffic deployment evidence

- Cloud Build `e01b285a-d6d2-4729-a6e4-31dd150b3786` succeeded and produced
  `sha256:7d75f6ea42f67832d0cfb2240592be4b966a68fd68e8cf98038b131cc2117e75`.
  Its source archive and source generation are recorded in
  `config/gcp-cloud-run.json`. The archive was built from the dirty worktree
  based on HEAD `844d872193793fe23aa3c1ec81243c81d760b314`; it is not a
  commit-pinned clean build.
- The image is deployed as revision `prepagent-00011-yew`, tag
  `remediation-20261014-1513`, URL
  `https://remediation-20261014-1513---prepagent-26mwt2n7ba-el.a.run.app`.
  Revision readiness and container health are true. Its default traffic is
  0%; production remains 100% on `prepagent-00005-s5x`. Port 8080,
  runtime service account `prepagent-run@prepagent-hack.iam.gserviceaccount.com`,
  service-wide maximum of two instances, and runtime gates were read from
  Cloud Run metadata. The revision-level scale annotation is 12, bounded by
  the service-wide cap of two.
- The Cloud Run service policy has no bindings, and the project policy has no
  `roles/run.invoker` binding or public invoker member. The private candidate
  returned `/health` and `/api/status` HTTP 200 through `gcloud run services
  proxy`; the browser loaded the Order Input screen through that authenticated
  proxy. Direct anonymous access remains expected to fail at the Cloud Run
  IAM boundary. Status says adapters are configured but connectivity and
  persistence have not been tested.
- No PO was uploaded, no paid model request was repeated, and no cloud
  conditions/insights query, BigQuery write, Firestore claim, DRAFT creation,
  approval, job-card operation, IAM change, or traffic promotion occurred.

### Acceptance disposition

**NOT READY — ENGINEERING ACCEPTANCE GATES FAIL.** The private candidate
confirms candidate startup, status, and browser delivery only; it is not
production traffic and is not a live workflow acceptance. The blocking items
remain: Strength/Crack model thresholds and grouped evaluation; unconfirmed
operator production settings and genuine sensor evidence; no complete live
PO1-to-DRAFT-to-retrieval-to-approval-to-card run; Om's optimizer semantics;
review continuity across instances and distributed rate limiting; photo
consent/provenance handling; and source/build reconciliation to a clean
commit. Do not promote traffic or represent the workflow as production-ready.

## 84. Independent engineering closure before Batch G — 2026-10-14

### Current local implementation and verification

- The grouped-model evaluation SQL now labels each exact `*_grouped_v1` model
  resource and split, dataset, exclusive training cutoff, observed evaluation
  date range, and train/evaluation row/customer counts. Training still uses
  non-overwriting candidate names and is not run. The SQL change is prepared,
  not an evaluation result.
- Container context now excludes local dotenv/credential files and ignores
  Git, tests, tools, docs and non-runtime config. The Dockerfile retains an
  explicit source allowlist. A regression test checks those rules and scans
  the two copied runtime manifests for common credential signatures without
  displaying values.
- Runtime port parsing now rejects malformed/out-of-range `PORT` rather than
  silently falling back. Unexpected-error and not-found responses report the
  actual local/Cloud Run mode without exposing exception details.
- Added `npm run test:acceptance`, a deterministic local acceptance selector
  covering app HTTP startup, the fixture-backed PO1 coordinator and DRAFT /
  approval / card lifecycle, adapter failure contracts, sensor provenance,
  PDF/localization, Impact, feedback privacy, idempotency, and build/runtime
  checks. External service boundaries use offline fakes.
- Current verification: `npm run test:acceptance` **218/218 passed**;
  `npm test` **384/384 passed**; JavaScript syntax checks passed (excluding
  vendored `node_modules`); all 10 `config/*.json` files parsed;
  `git diff --check` passed.
- Local `PORT=8120 npm start` printed the expected startup URL.
  `/health`, `/api/status`, and `/` returned HTTP 200. Status reported local
  mode, no production adapters, live model calls disabled, conditions
  unchecked/unconfigured, and job creation unavailable. Browser navigation
  loaded screens 1–4. Screen 3 explicitly states persistence, approval,
  feedback/photo classification and card retrieval are unavailable; no
  workflow form was submitted.

### Model, sensor and workflow evidence boundaries

- Existing serving and optimizer SQL pass `customer_id` to the named active
  models; the grouped candidate training/evaluation SQL excludes it. Historical
  nonzero feature importance is therefore a generalization/memorization risk,
  not proof of leakage. The source-of-truth training SQL and complete
  model-version lineage are not present in the repository. The supplied
  historical R² values still fail the `>=0.6` target for Strength
  (`0.4672613`) and Crack (`0.3010716`). Neither grouped candidates nor a new
  BigQuery evaluation were executed.
- The sensor publisher only generates `source=simulated` messages. The
  current-conditions adapter reads the latest plant row and preserves its
  source; freshness stays `unassessed` because no owner-approved age limit is
  defined. The coordinator rejects simulated, unverified, missing, or
  unassessed provenance before prediction/DRAFT. Offline tests now also prove
  an old `source=live` fixture is not relabeled fresh. Added bounded,
  parameterized, read-only `sql/sensor_ingestion_acceptance.sql` and an offline
  test of its table/parameter/duplicate-detection/no-write contract. No
  genuine sensor reading was queried or created in this closure pass.
- The fixture-backed PO1 E2E covers real coordinator/review/persistence
  handler/job-card service orchestration with fake extraction, catalog,
  conditions, risk, optimizer, explanation, storage, and repository
  boundaries. It is offline evidence only. It does not establish live
  Gemini/BigQuery/Storage/Firestore integration or a cloud workflow.
- PO review state remains a 30-minute/100-entry process-local map; the
  per-IP limiter is process-local and does not trust forwarded headers.
  Durable job idempotency has a Firestore adapter and a runtime gate, but no
  live claim/write was tested. Do not enable a substitute persistence system
  or treat configured gates as verified writes.

### Batch G handoff

| Gate | Owner / missing item | Smallest next action and success evidence |
|---|---|---|
| Optimizer contract | Om: authoritative baseline, penalty semantics, cost basis, and one unrounded expected case | Record the decision against Blueprint p.12 and Om's handoff; then update SQL/tests. No formula change is authorized before this. |
| Model generalization | Model owner / user authorization: current model resource metadata and training permission | Authorize the mutating, billable `sql/model_grouped_candidate_training.sql`; then run the read-only grouped evaluation and feature-importance SQL. Accept only version-identified held-out customer results with all five R² >= 0.6 and rule/feature review. |
| Genuine sensor evidence | Plant operator: actual device measurement and one-message publication approval; Dataflow owner: current capacity/status | Do not use the simulated publisher. After explicit approval, publish one real reading to the existing topic, then run `sql/sensor_ingestion_acceptance.sql` with its actual `readingId` and `plantId` parameters; require one matching `source=live` row, valid timestamp, RH 0–100, finite numeric temperature, and moisture 0–20. Persistent row remains; no cleanup or retry. This alone does not verify the historically capacity-failed Dataflow path. |
| Production preparation inputs | Authorized operator: actual shift, seven machine levers, selected PO item/quantity, and current genuine fresh conditions | Supply/confirm inputs and an owner-approved sensor freshness limit. Success is a validated DRAFT whose provenance and settings match those inputs; no values may be inferred. |
| Live PO-to-card acceptance | User/release owner plus authorized supervisor: one bounded end-to-end cloud run | Separately authorize any paid Vertex extraction, PDF/object upload, Firestore claim, JobSheet writes/read-back, and an actual supervisor approval/card operation. Require one traceable record through all stages and no duplicate on retry. None was performed here. |
| Multi-instance durability / privacy | Product/privacy owner: PO-review lifetime/schema, consent attribution/provenance/retention contract, trusted proxy client-IP design | Approve those contracts before adding durable PO review, photo feedback, or distributed rate limiting. Until then, review continuity and photo writes remain unavailable/fail-closed. |
| Source-to-artifact release | User/release owner: clean-source review and explicit build authorization | Review/preserve current dirty changes, approve a clean commit, then authorize a build from that exact SHA. The current `prepagent-00011-yew` artifact predates this closure pass; no build, deploy, IAM change, or traffic shift occurred here. |

Authoritative Batch G sources remain the Blueprint/Playbook and Om handoff
under workspace `docs/`, the supplied synthetic PO README/results, application
contracts in `src/schemas.js`, source SQL under `sql/`, and this tracker plus
`CLOUD_INTEGRATION_TODO.md`. Reference documents remain outside the application
repository and were not added to a commit.

## 85. Master acceptance audit and sequential test re-verification — 2026-10-14

- Added the self-contained acceptance disposition, workflow traceability,
  model/optimizer/impact findings, cloud/source provenance boundaries,
  security and authorization status, runbook, and independent-review handoff
  in `docs/CODEX_END_TO_END_ACCEPTANCE_AUDIT.md`.
- Re-ran `cd prepagent && npm run test:acceptance` alone: **218/218 passed**.
  Then ran `cd prepagent && npm test` separately: **384/384 passed**.
  Running both commands concurrently first caused test HTTP server collisions
  on shared port 4100; those concurrent attempts are not counted as passes.
- Application JavaScript syntax checks excluding all `node_modules`
  directories passed; all 10 `config/*.json` files parsed; `git diff --check`
  passed. No code behavior or cloud configuration changed in this audit.
- The branch remains `main` at HEAD
  `844d872193793fe23aa3c1ec81243c81d760b314`; at audit start, 40 tracked
  paths were modified and 47 paths were untracked. All were preserved. The
  audit report and this tracker section are additional local documentation,
  not committed.
- Acceptance remains **NOT READY**: no live workflow or cloud operation was
  executed; historical model threshold failures, unresolved optimizer and
  annualization decisions, missing genuine fresh sensor evidence, consent and
  durability gaps, and dirty-source/candidate provenance remain open. See the
  audit report for statuses and owner-specific next actions.

  ## 86. Demo handoff artifacts and legacy extraction fail-closed correction

  - The legacy `POST /api/agents/extractOrder` route returned an HTTP 200
    `mock-demo` extraction result from caller-supplied JSON. It was not used by
    the operator UI and was not the configured PDF/Vertex/catalog path. Changed
    this route to return explicit HTTP 503 `SERVICE_UNAVAILABLE`; updated the
    HTTP test and local-development guide. The standalone mock helper remains
    available to its unit tests and is not wired as a production route.
  - Added `docs/OM_DEPENDENCY_REGISTER.md`, `docs/OM_INPUT_CONTRACTS.md`,
    `docs/DEMO_RUNBOOK.md`, `docs/DEMO_ACCEPTANCE_MATRIX.md`,
    `docs/RELEASE_PROVENANCE.md`, `docs/LIVE_INTEGRATION_EVIDENCE.md`, and
    `docs/INDEPENDENT_WORK_COMPLETION.md`. These distinguish offline tests,
    historical cloud records, and fresh live evidence, and state that the
    complete live workflow is not accepted.
  - No synthetic UI demo mode was implemented. Existing fixture-backed tests
    remain offline evidence and are not described as a judge-ready UI workflow.
  - No cloud query/write, Pub/Sub/Dataflow operation, model call, deployment,
    traffic or IAM mutation, resource creation, or public-access change was
    performed. The local source correction has not been deployed. No task
    status is promoted by this work.
  - Focused `node --test test/app.test.js test/schemas.test.js`: **32/32
    passed**; `node --check index.mjs`: passed.
  - Sequential `npm run test:acceptance`: **218/218 passed**, then `npm test`:
    **384/384 passed**. JavaScript syntax checks across `src`, `tools`, and
    `test` passed; all `config/*.json` parsed; `git diff --check` passed.
  - Worktree changes remain uncommitted; preserve all unrelated pre-existing
    changes.
