# Part 2 readiness and cloud integration TODO

This document tracks Part 2 against the supplied sprint playbook and product
blueprint. `PART2_COMPLETION_TRACKER.md` is the status source. Reconciled
read-only GCP evidence is recorded there; no GCP resources were changed during
this code-integration pass. Earlier snapshots below are historical where
superseded. The Playbook plant seed is present; no seed write or permanent-table
DML was executed by this pass.

Status meanings:

- **VERIFIED COMPLETE** — inspected against the playbook and verified locally
  or with a read-only cloud check.
- **PARTIALLY IMPLEMENTED** — some contract or route exists, but the
  acceptance behavior is incomplete.
- **BLOCKED BY BILLING / CLOUD PROVISIONING** — requires deferred cloud
  provisioning, a live call, or a billing prerequisite.
- **BLOCKED BY USER AUTHORIZATION / CLOUD PROVISIONING** — resource or
  permission changes lack separate authorization, regardless of billing state.
- **BLOCKED BY OM / EXTERNAL HANDOFF** — requires Om's specified data, glossary,
  SQL, or model deliverable.
- **NOT IMPLEMENTED** — an applicable local requirement has no working
  implementation.
- **NOT APPLICABLE** — the playbook does not require the proposed item in Part
  2, or it is superseded by the stated scope.

## GCP setup requirements

| Part 2 requirement | Status | Evidence | Remaining work / dependency |
|---|---|---|---|
| 2.0 CLI, Node and local account | VERIFIED COMPLETE | Local Node `v22.17.1`, gcloud/bq available; active account was inspected. | None for local prerequisites. |
| 2.1 Project variables | VERIFIED COMPLETE | Both workspace and repository `env.sh` use project ID `prepagent-hack`, Mumbai `asia-south1`, glossary `us-central1`, intended bucket and service account; repository file is Git-ignored. | Keep values local; do not commit credentials. |
| 2.2 Project identity/state | VERIFIED COMPLETE | Read-only describe: project `prepagent-hack`, number `514663464609`, `ACTIVE`; active gcloud project is the project ID. | None. |
| 2.2 Billing | VERIFIED COMPLETE | An earlier read-only describe returned `billingEnabled=false`; later verified evidence recorded in the tracker confirms billing is enabled for `prepagent-hack`. | Enabled billing is not authorization to incur costs; no additional billing change is requested. |
| 2.3 ₹5,000 monthly budget; 50/90/100% alerts | VERIFIED CONFIGURATION; DELIVERY UNTESTED | Latest tracker evidence verifies a project-scoped ₹5,000/month budget including credits, current-spend thresholds at 50/90/100%, and an enabled Monitoring email notification channel. | Alert delivery to an inbox is untested. A budget notification is not a hard spending cap. Do not mutate budget settings without separate authorization. |
| 2.4 Required APIs | VERIFIED COMPLETE | P2-GCP-005 records all requested APIs enabled in `prepagent-hack`, including Run, Build, Artifact Registry, Vertex AI, Dataflow, Translation and Compute. | API enablement does not prove resources, workload access, or live integration acceptance. |
| 2.5 Om project access | VERIFIED AGAINST USER-CONFIRMED REQUIREMENT; SOURCE DIVERGENCE | User confirms Om should have project `roles/owner`; tracker records that role as current. Blueprint/Playbook still specify `roles/editor`. | The source documents need a product-owner decision/update if they are to match the changed access requirement. No IAM change is indicated by this TODO. |
| 2.6 Runtime service account | VERIFIED COMPLETE | Runtime identity exists with all six playbook roles: Vertex AI user, BigQuery data editor/job user, Storage object admin, Cloud Translation user, Pub/Sub publisher. | Vertex/Translation APIs are enabled; no production workload was exercised. No key is created. |
| 2.7 Local ADC | PARTIALLY VERIFIED | Prior audit verified ADC without printing a token; the latest pass did not establish its quota-project setting. The installed CLI rejected the attempted `get-quota-project` command as unsupported. | If required, verify quota-project state later with a supported token-safe method; never expose credentials. |
| 2.8 Storage bucket | RESOURCE VERIFIED; APP ACCESS NOT VERIFIED | Fresh read-only describe found `gs://prepagent-hack-data` in `ASIA-SOUTH1`, with uniform bucket-level access enabled and public access prevention inherited. Bucket IAM policy inspection succeeded. | No object read/write or application prefix behavior was tested. Do not perform object writes without separate authorization. |
| 2.9 Dataset and tables | RESOURCE/SCHEMA VERIFIED | Latest tracker evidence confirms `prepagent` in `asia-south1`, required tables and documented partitioning. Om reports the approved current lots target is 5,350 and the auxiliary item master has 117 anonymized records; do not conflate the approved target with the Blueprint's earlier 6,000 prototype target. | No table creation remains. The additional `items` table is the source for item-spec lookup in Om's PO workflow. |
| 2.9 `PLANT-01` seed | VERIFIED PRESENT | Read-only inspection confirms `PLANT-01 | Pune unit | INR | 45.0 | mr`, matching the literal Playbook §2.9 row. Om reports it was re-added. | No seed action remains. Do not repeat a write. The operator selects the shift; current conditions still require an available sensor row. |
| 2.10 Pub/Sub topic/subscription | ONE SIMULATED MESSAGE READ BACK; TAGGED CANDIDATE CONDITIONS 200; PRODUCTION CONDITIONS NOT ACCEPTED | The ACTIVE direct sink `sensor-readings-bq` targets `prepagent.sensor_readings` with `useTableSchema=true`; the separate `sensor-readings-df` subscription remains ACTIVE. One authorized message `21979885863051723` was matched to BigQuery row `b6dccb94-3f54-4f3b-b41d-cc7bca09ca43` (`source=simulated`, `PLANT-01`). The tagged decoder-fix candidate `prepagent-00009-voy` returned that row from `/conditions/current?shift=DAY` with HTTP 200. | This proves one bounded delivery/read-back and one candidate conditions response only. Production `prepagent-00005-s5x` previously returned 503 for the same row; the newer candidate `prepagent-00010-pag` has not had this route verified. The simulated row is not a production sensor feed. Do not retry Dataflow or publish again. |
| 2.11 Dataflow worker identity/roles | VERIFIED COMPLETE (READINESS ONLY) | Existing authorized evidence and `config/gcp-dataflow.json` confirm the expected worker identity, the four documented worker roles, and the Dataflow service-agent binding. | Identity/IAM readiness does not establish worker availability or data delivery. Do not launch a job without separate authorization and cost acceptance. |
| 2.11 Streaming job | DATAFLOW BLOCKED BY RESOURCE AVAILABILITY; DIRECT BIGQUERY SINK DELIVERY VERIFIED ONCE | Dataflow's earlier authorized retry failed with `ZONE_RESOURCE_POOL_EXHAUSTED`. The Playbook alternative `sensor-readings-bq` is ACTIVE and accepted the single bounded simulated message, which was read back from BigQuery. The tagged decoder-fix candidate returned that reading successfully; this does not establish the production route or continuous stream reliability. | Do not retry Dataflow. Keep the simulated reading distinct from production sensor data. |
| 2.12 Sensor publisher | PROFILE/BOUNDED PUBLISHER IMPLEMENTED; ONE SIMULATED CLOUD DELIVERY VERIFIED | `tools/publisher.mjs` remains opt-in and bounded; its generator follows the Blueprint profile and marks `source: "simulated"`. Tests cover month/timezone boundaries and schema. The one authorized message and corresponding BigQuery row are recorded in the 2026-10-14 follow-up below. | No production sensor feed or ongoing delivery guarantee is verified. Do not publish again or retry Dataflow as part of this evidence. |
| 2.13 Vertex AI/Gemini | TAGGED-CANDIDATE EXTRACTION 200; LIVE MODEL METRICS/IMPORTANCE RETURNED; FULL MODEL ACCEPTANCE BLOCKED | One explicitly authorized `gemini-3.5-flash` readiness call is historical. Production revision `prepagent-00005-s5x` previously returned HTTP 503 for synthetic PO1 extraction; tagged candidate `prepagent-00009-voy` later returned HTTP 200 from `vertex-gemini` with a valid matched line and usage metadata. On 2026-10-14, the authorized read-only `ML.EVALUATE` query returned R²: warp 0.6052, delam 0.6664, strength 0.4673, print 0.7512, crack 0.3011. `ML.FEATURE_IMPORTANCE` returned 29 feature rows per model; `customer_id` has nonzero importance in all five, with random row-level evaluation split, so customer leakage/generalization must be investigated. Full scores and top drivers are recorded in tracker Section 82. | Do not repeat extraction or model queries without specific authorization. Strength and crack are below the documented 0.6 minimum. Feature rankings require comparison with the approved generator rules and data-lineage/leakage review; live query output alone does not prove model acceptance. `prepagent-00010-pag` extraction has not been tested and production remains on the older revision. |
| 2.14 Translation glossary | BLOCKED BY OM / EXTERNAL HANDOFF | Translation API is recorded enabled; the glossary CSV is absent. Manifest captures `corrugated`, `us-central1`, and seven language codes. | Obtain Om’s actual CSV; glossary provisioning and live translation require separate authorization. |
| 2.15 Cloud Run hello-world/final service | DEPLOYED PRIVATE; AUTHENTICATED BROWSER/READ-ONLY ROUTES VERIFIED; LOCAL SOURCE NOT DEPLOYED | Through the authorized `gcloud run services proxy` on localhost:8082, `/`, `/health`, and `/api/status` returned HTTP 200. Browser-loaded UI made same-origin `/api/status` request and reported `mode=cloud-run`, live model gate enabled, and extraction adapter configured. The deployed UI lacks the current local Impact screen, confirming a source/build difference. Direct unauthenticated public URL returns the reported 403 because IAM auth is required. | Keep private. Current worktree is not this revision; do not claim current-source deployment or production workflow acceptance. Any new revision requires explicit deployment authorization. |
| 2.15 Cloud Build / Artifact Registry | EXISTING RESOURCES VERIFIED; SOURCE-TO-IMAGE IDENTITY UNRESOLVED | Cloud Build `8e9522b4-c92b-4e73-9707-81e779162840` succeeded and produced digest `sha256:25395f6c46ff43833b8ecd077bc8950173299cc743425d46baae3c03adaaa9f2`. Its source provenance identifies a Cloud Storage archive, not a resolved repository commit SHA. Current application HEAD is `844d872193793fe23aa3c1ec81243c81d760b314` with a dirty worktree. | No Cloud Build YAML or executable deployment script exists in the repository; `config/gcp-cloud-build.json` is a status manifest. Do not invent a build/deploy command or deploy until the approved runbook and operation authorization are available. |
| 2.16 Troubleshooting | PARTIALLY IMPLEMENTED | The symptom-based workflow below distinguishes local configuration, CLI/ADC context, API state, resource absence/permission errors, and application/test failures. The latest audit reconciled previously stale billing, API, IAM, Storage, Pub/Sub and BigQuery statements without repeating cloud checks in this local pass. | Live service diagnosis and any state-changing fix require a separately authorized operation. Do not retry permanent-table DML or seed the plant. |
| 2.17 build/deploy checklist | PARTIALLY IMPLEMENTED | FX helper, Zod contracts, API routes and schema mapper exist. Many live workflows below are incomplete. | See application matrix and external dependencies. |
| 2.18 keep-running/judging operations | DEFERRED | Private Cloud Run service is deployed, but there is no active Dataflow stream or accepted end-to-end workflow. These are post-acceptance judging operations. | Revisit after current-source deployment and workflow acceptance. |

## API-to-capability map and safe troubleshooting

The states below summarize the latest evidence recorded in the authoritative
tracker on 2026-10-11. Except for the specifically documented Storage bucket
metadata check, these states rely on existing recorded API/resource evidence
and were not rechecked in this update. API enablement is not resource
existence, workload authorization, or proof that a service call is
billing-safe.

| API | Last recorded state | Dependent capability / what it does not prove |
|---|---|---|
| `bigquery.googleapis.com` | Enabled (latest recorded) | Dataset and five table schemas were verified; a read-only query and temporary-table DML succeeded. This does not establish permanent-table DML eligibility or plant seed values. |
| `storage.googleapis.com` | Enabled | Bucket exists in `ASIA-SOUTH1`; UBLA is enabled. No application object access was tested. |
| `aiplatform.googleapis.com` | Enabled (P2-GCP-005) | One P2-GCP-014 Gemini readiness smoke test succeeded; this does not establish production extraction/tool orchestration or photo classification. |
| `pubsub.googleapis.com` | Enabled | Topic and ACTIVE linked subscription exist. No publication or consumption occurred. |
| `dataflow.googleapis.com` | Enabled (P2-GCP-005) | Three previously authorized attempts failed worker allocation; the final job was cancelled. Do not retry without fresh authorization. |
| `compute.googleapis.com` | Enabled (P2-GCP-005) | The documented worker identity and IAM readiness are recorded verified; this does not establish worker capacity or job success. |
| `translate.googleapis.com` | Enabled (P2-GCP-005) | Glossary-backed translations remain unavailable until Om supplies the CSV and glossary/live-call acceptance is authorized. |
| `run.googleapis.com` | Enabled (P2-GCP-005) | No deployment is evidenced; service presence was not established by this audit. |
| `cloudbuild.googleapis.com` | Enabled (P2-GCP-005) | One recorded successful image build exists; it predates the current integration changes and does not prove runtime health. |
| `artifactregistry.googleapis.com` | Enabled (P2-GCP-005) | The `prepagent` repository and historical image digest are verified; this does not prove that a current image is built or deployed. |
| `logging.googleapis.com` | Enabled | Cloud logs/diagnostics; this does not imply application deployment or integration health. |

Use this symptom-first flow and stop at the first unresolved prerequisite.
Recorded observations above are sufficient unless the user reports a change;
do not repeat a check just to refresh it. Read-only diagnosis is preferred.
Resource changes, message publication, model calls, workloads, builds and
deployment must stay within the user's specific authorization and budget
constraints; do not repeat permanent-table DML or the plant seed as
troubleshooting.

### Local configuration and missing environment variables

- Check the manifest syntax and focused contracts with
  `node --test test/cloud-readiness.test.js`.
- Check only whether expected variables are present, without printing their
  values:

  ```sh
  for name in PROJECT_ID REGION BUCKET SA; do
    if printenv "$name" >/dev/null; then
      printf '%s: set\n' "$name"
    else
      printf '%s: missing\n' "$name"
    fi
  done
  ```

- Add `GEMINI_MODEL` and `VERTEX_LOCATION` to the presence check only when
  diagnosing the gated Gemini utility. Do not print `.env`, `env.sh`, tokens,
  credential files, or arbitrary process environments. `env.sh` is local
  configuration, not proof that cloud resources exist.

### gcloud context and authentication

- The latest preflight already recorded project `prepagent-hack`, a verified
  active account/project Owner context, and Cloud Storage API enabled. Do not
  repeat these checks unless the user reports their CLI context changed.
- If context did change, the non-secret read-only checks are
  `gcloud config get-value project` and
  `gcloud auth list --filter="status:ACTIVE" --format="value(account)"`.
  Stop if the selected project is not `prepagent-hack`. An active gcloud
  account does not prove Application Default Credentials (ADC) are available.
- Only if a tool reports an ADC failure, check without displaying the token:

  ```sh
  if gcloud auth application-default print-access-token >/dev/null 2>&1; then
    printf 'ADC token retrieval succeeded; token discarded\n'
  else
    printf 'ADC token retrieval failed; do not share credential output\n'
  fi
  ```

  Never remove the redirection, capture/print the token, or paste credential
  output. Authentication or permission failures require the account owner to
  resolve access; do not change IAM as a diagnostic.

### API and resource prerequisites

- Billing is enabled according to the latest verified record. The earlier
  `billingEnabled=false` result and BigQuery free-tier DML rejection are
  historical. Billing enabled does not authorize spending or mean that every
  service operation is permitted.
- Latest recorded API states: BigQuery, Storage, Pub/Sub and Logging enabled;
  Cloud Run, Cloud Build, Artifact Registry, Vertex AI, Dataflow, Translation
  and Compute were absent from the enabled-API listing. Do not re-list them
  unless evidence indicates a change.
  If the project owner reports a change and an API error needs diagnosis, a
  read-only command is
  `gcloud services describe API_NAME --project=prepagent-hack --format="value(state)"`.
  If it is disabled, stop. Do not use `services enable` or answer an activation
  prompt.
- The bucket describe most recently succeeded: `gs://prepagent-hack-data`
  exists in `ASIA-SOUTH1` with uniform bucket-level access enabled. No object
  access was tested. A 403 on a future read means access is insufficient and
  does not prove that a resource is absent; do not create or write objects.
- The `sensor-readings` Pub/Sub topic and ACTIVE `sensor-readings-df`
  subscription were verified during this earlier baseline; no message had yet
  been published or consumed at that time. The single later authorized
  publication is recorded below. Dataflow has no listed job and remains
  deferred. Cloud Run service, build and Artifact
  Registry resources could not be listed while their APIs were disabled;
  those resource states remain unverified. Do not repeat checks absent a
  specific evidence gap and a requested read-only audit.
- For a future authorized model-not-found response, verify the exact model ID
  and supported location against the playbook before changing configuration;
  the playbook's documented fallback is `VERTEX_LOCATION=global`. Do not
  invoke Vertex AI to troubleshoot now. Glossary calls require `us-central1`
  and Om's actual CSV; do not call Translation or invent glossary data.
- BigQuery schemas and partitioning, read-only query, temporary-table DML,
  permissions, and zero plant rows have already been evidenced in the tracker.
  Permanent-table DML was not tested. Do not issue another query, dry-run, or
  seed command.

### Local application and test failures

- Run `node --version` (the app requires Node.js `>=20.10.0`), then `npm test`
  from the repository root. Diagnose the first failing local test; do not
  interpret a local pass as cloud integration acceptance.
- Start the app with `npm start`; from another local shell,
  `curl -fsS http://localhost:8080/health` checks process health and
  `curl -i http://localhost:8080/api/status` reports declared capabilities.
  `/health` returns local-development status, not Cloud Run health.
- A `503 SERVICE_UNAVAILABLE` from a cloud-backed route means the local
  service port is unavailable/unconfigured and no integration result was
  produced. It is not fixed by retrying a cloud mutation. A validated request
  or locally rendered PDF is not evidence of a cloud write, upload, approval,
  or model result.
- Publisher/Gemini gate tests are local and must not contact Google Cloud.
  Never run the opt-in publisher, Gemini live-call command, or production
  routes to diagnose a local test failure.

## Local application requirements

| Requirement | Status | Evidence | Remaining work / dependency |
|---|---|---|---|
| Backend foundation: `npm start`, `PORT`, `/health`, `/api/status`, root UI | LOCAL UI/API VERIFIED ON CURRENT WORKTREE; CLOUD RUN NOT RECHECKED | `PORT=8081 npm start` reported `http://localhost:8081`; `/`, `/health`, and `/api/status` returned HTTP 200. The browser loaded the order-input and Impact screens and called same-origin `/api/status`; `POST /orders/extract` returned the expected safe 503 with model calls disabled. Port 4172 had no listener; port 8080 had an older already-running Node process whose served page lacked the current Impact screen. | Keep the existing 8080 process untouched unless its owner requests a restart. Local UI/API success is not Cloud Run deployment or production acceptance. |
| JSON errors, malformed input, not-found, request cap | VERIFIED COMPLETE | Central JSON 400 validation; 10 MiB body cap; non-object JSON rejection; local tests cover malformed JSON, 413 and 404. | Unexpected server failure semantics remain basic. |
| Zod order/condition/lever/risk/job/feedback/photo/BigQuery contracts | VERIFIED COMPLETE | `src/schemas.js`, `src/types.js`, schema tests. | These contracts do not themselves supply live results. |
| Order field validation and missing-field report | VERIFIED COMPLETE | `src/order-extraction.js`; tests verify omitted-field reporting and invalid data. | This validates supplied JSON; it does not extract from PDF. |
| PDF-to-Gemini order extraction | IMPLEMENTED/OFFLINE-TESTED; TAGGED-CANDIDATE SYNTHETIC EXTRACTION VERIFIED; PRODUCTION/FULL WORKFLOW NOT ACCEPTED | Exact two-setting gate: model manifest `modelCallsEnabled === true` and runtime `USTAAD_ENABLE_LIVE_MODEL_CALLS === "true"`. One text-only readiness call to `gemini-3.5-flash` is historical. Production revision `prepagent-00005-s5x` returned HTTP 503 `INTEGRATION_ERROR` for a synthetic PO1 request without usage metadata. After the catalog numeric-decoder fix, tagged revision `prepagent-00009-voy` returned HTTP 200 from `vertex-gemini`, with a valid matched line and usage metadata; the PDF was retained in private Cloud Storage for normal linkage. | Do not repeat the paid extraction without specific authorization. `prepagent-00010-pag` has not been extraction-tested, and no DRAFT was persisted, approved, or retrieved as a card. Current local source is not the production revision. |
| Browser 403 / private service access | AUTHENTICATED PROXY VERIFIED; DIRECT UNAUTHENTICATED 403 EXPECTED; PRIVATE IAM PRESERVED | Direct Cloud Run URL access returns 403 before the application because the service requires IAM authentication. The existing authenticated `gcloud run services proxy` on localhost:8082 successfully served the UI/status and live API requests; read-only policy inspection returned no public `allUsers` binding. | Continue using the authenticated proxy for private verification. Do not broaden IAM or change the private access boundary. |
| FX rates endpoint, currencies, date/provenance, cache/fallback, formatting | PARTIALLY IMPLEMENTED | `src/fx-rates.js`, `src/fx-fallback.json`, `/fx`, `Intl.NumberFormat`, and offline tests cover dated rate snapshots, 24-hour cache, fallback provenance and display formatting. | Local contract only: no live provider response was verified in the current audit; fallback rates must be treated as dated reference values. |
| Current sensor conditions endpoint | IMPLEMENTED/OFFLINE-TESTED; TAGGED CANDIDATE RETURNS SIMULATED ROW; PRODUCTION/NEWER CANDIDATE NOT VERIFIED | Bounded parameterized latest-row SQL and `PLANT-01` are configured; UI requires operator-selected `shift=DAY|NIGHT`. One simulated row was read back using the exact SQL. Production revision `prepagent-00005-s5x` returned HTTP 503; tagged decoder-fix revision `prepagent-00009-voy` returned HTTP 200 for `/conditions/current?shift=DAY` and that row. Offline tests cover valid, malformed, mismatched, future, and empty readings. | The response proves one candidate read of simulated data, not production-sensor readiness or continuous delivery. The newer candidate `prepagent-00010-pag` conditions route was not verified. Do not publish or retry Dataflow. |
| Five-defect model prediction | IMPLEMENTED/OFFLINE-TESTED; LIVE CLOUD RUN ROUTE VERIFIED; MODEL ACCEPTANCE PARTIAL | Exact `sql/predict.sql` is wired through the bounded Node risk service; adapter tests validate all five outputs and named parameters. `/risk/predict` returned HTTP 200 from `bigquery-ml` with `isRealModelPrediction=true` for documented PKBX0041 inputs. Authorized read-only `ML.EVALUATE`/`ML.FEATURE_IMPORTANCE` queries now provide current named-model evidence in tracker Section 82: strength and crack fail the 0.6 threshold; the version linkage and leakage review are unresolved. | Prediction is not a measured outcome. Do not present outputs as production acceptance until model threshold, feature lineage and evaluation-split checks pass. |
| Lever optimizer, baseline/changes/savings | LIVE ROUTE VERIFIED; BUSINESS CONTRACT UNRESOLVED | `/risk/optimize` returned HTTP 200 from `bigquery-ml` using the actual PKBX0041 item-master profile and the explicitly simulated sensor row. It returned model-predicted baseline 6.44% / 63.5 kg / INR 3,387 and best 5.31% / 52.3 kg / INR 2,790 (estimated 11.2 kg / INR 597 savings). Older direct-SQL examples remain separately recorded. | Obtain Om's written resolution of baseline, penalty interpretation, plant `cost_per_kg` provenance and expected result. These optimizer outputs are predictions, not production savings. |
| Similar-run/evidence search and grounded explanation | SEEN-BEFORE LIVE ROUTE VERIFIED; SIMILAR-RUN/EXPLANATION FULL FLOW PENDING | The `/evidence/seen-before` route returned HTTP 200 from BigQuery for DELAM at 86% RH. Offline contracts validate result shape/linkage and reject unsupported/causal explanation claims. | Similar-run and Gemini explanation have not been verified inside a complete application run; extraction/conditions currently fail. Do not infer causal impact from historical evidence. |
| Seven agent functions and real Gemini tool loop | PARTIALLY IMPLEMENTED | `src/google-cloud/gemini-function-runner.js` sends the seven Blueprint tools, executes allowed calls sequentially with round/call/output limits, and records sanitized tool lifecycle in the trace registry. | Full tool handlers depend on Om's model, prediction, optimizer and evidence SQL; no production `/jobs` run or live model call is accepted. |
| SSE tool trace | PARTIALLY IMPLEMENTED | Existing `src/trace-routes.js` and EventSource panel are connected to the same registry used by the function runner; offline halves pass tests. | Demonstrate a genuine application run through the complete seven-tool runner and UI after remaining handlers exist. |
| Documented job creation and approval (`POST /jobs`, `POST /jobs/:id/approve`) | IMPLEMENTED/OFFLINE-TESTED; LIVE ACCEPTANCE PENDING | Bounded BigQuery JobSheet write/read-back, conditional DRAFT→APPROVED state update, private GCS card upload/download and recovery are composed in local services. Offline PO1 tests use injected downstream adapters. Deployed gates are recorded enabled; this follow-up made read-only API calls and one separately authorized sensor publish but no JobSheet, approval, or card write. Live PO1 extraction failed before the lifecycle could proceed. | Keep gates/configuration and privacy unchanged. Current-source deployment and a genuine test lifecycle need separate explicit authorization; approval must be performed by an authorized human. |
| Job list/detail/reject endpoints | PARTIALLY IMPLEMENTED (DETAIL ONLY) | `GET /jobs/:id` reads a persisted JobSheet through the existing repository port and returns `503` when retrieval is unconfigured, `404` when no matching stored row exists, and `400` for an empty job ID. `GET /jobs` list and `POST /jobs/:id/reject` remain absent; the authoritative status schema defines DRAFT/APPROVED/RUN/CLOSED but no rejection status, reason or transition semantics. | Do not invent a job list or rejection operation. Rejection requires the product owner to define eligible states, terminal status, reason/evidence fields and card cleanup/visibility behavior. Live retrieval still requires a genuine stored JobSheet and authorized BigQuery read. |
| Printable job card/PDF and Unicode fonts | PARTIALLY IMPLEMENTED | `src/job-sheet-pdf.js` renders a validated JobSheet; approval adapter uploads the approved PDF under `jobcards/`, conditionally records the URI, and the card route retrieves approved-only files. Adapter tests pass; no live Storage/BigQuery write or workload-identity acceptance was performed. Translated/converted stored cards are explicitly unavailable. | Verify the complete storage/persistence lifecycle during final cloud integration after a genuine JobSheet can be generated. |
| Multilingual UI, translation helper/cache | PARTIALLY IMPLEMENTED | Seven locale JSON files and localized UI labels exist; there is no Translation adapter or per-job glossary cache. | Om glossary CSV and authorized Translation service setup. |
| Feedback validation and persistence | IMPLEMENTED/OFFLINE-TESTED; LOT LEARNING BLOCKED BY EXTERNAL INPUT | `FeedbackInputSchema` accepts actual defect rates and/or photo evidence linked to a stored job; the bounded feedback writer and job/optional-lot linkage are offline-tested. Retry `insertId` is deterministic but BigQuery streaming deduplication is best effort. The handoff's learned-lot insertion requires actual run date, actual conditions and actual settings, which the feedback schema does not capture. | Om must define the measured-run payload/provenance and stable lot identity/idempotency rule before an actual lot can be constructed. Never substitute recommended settings or synthesize measured outcomes. No persistent write was performed here. |
| Photo classification | BLOCKED BY EXTERNAL INPUT AND AUTHORIZATION | Photo contract exists, but no genuine classifier or accepted classification result. The handoff's photo/seen-before beat is separate from the required PO-to-approved-card sequence. Existing folder names do not prove consent, provenance, label mapping or split quality. | Obtain Om-confirmed consent/provenance, taxonomy mapping (including `crushed`/`good`), label quality and train/evaluation split; separately authorize upload/classification. Do not hold core job-card acceptance solely for this optional gated capability. |
| Full operator UI | IMPLEMENTED/OFFLINE-TESTED; DEPLOYED UI OUTDATED; LIVE WORKFLOW PENDING | Current local Screen 1 exposes its single extraction action and live status within both 1024×768 and 759×510 initial viewports. Browser tests of the supplied PO1 fixture verified explicit no-file/missing-context feedback without requests, multipart request fields, an intercepted 503 with retained inputs/retry, and a success-shaped intercepted response rendering/selecting the fixture line. The current local endpoint itself returned 503 with the live-model gate disabled. These are UI simulations/local-gate evidence, not extraction evidence. | Through the authenticated private proxy, deployed revision `prepagent-00005-s5x` showed an older Screen 1 with no separate extraction action and the old “upload during job preparation” text. Current local source is not deployed; no successful Cloud Run workflow, current sensor row, stored DRAFT, approval or card retrieval is evidenced. Do not treat local fixture/mock responses as live acceptance. |
| Rate limit and 60-second request timeout | PARTIALLY IMPLEMENTED | Direct-socket in-process limit is 60 requests/IP/60 seconds; `/health` is excluded. Timeout middleware returns structured 504 and aborts cooperative handlers. | No trusted-proxy IP design or cross-replica shared limiter is configured; not production-grade for Cloud Run. |
| Google Cloud adapters and parameterized SQL | PARTIALLY IMPLEMENTED | Read-only BigQuery query transport, exact risk-prediction SQL, item catalog lookup, sensor read, bounded BigQuery persistence, and create-only Cloud Storage adapters exist. Query transport limits scan bytes, result count, and wait time. Optimizer/evidence SQL and several Om-owned inputs remain unavailable. | Add handlers only when their query/input contracts arrive. Do not use mock production results. |
| Local tests and smoke coverage | VERIFIED FOR CODE CONTRACTS; CLOUD ACCEPTANCE PENDING | After the Screen 1 changes, focused `node --test test/app.test.js test/po1-coordinator-workflow.test.js` passed 21/21 and complete `npm test` passed 358/358. Syntax checks and `git diff --check` passed. All cloud adapters/mocks remained offline; no live extraction is asserted. | Test live adapters only during the planned authorized cloud acceptance window and avoid duplicate billable operations. |
| README/local/cloud handoff docs | VERIFIED COMPLETE | `README.md`, `docs/LOCAL_DEVELOPMENT.md`, this readiness record and schema docs exist. | Update status when implementation or cloud state changes. |

## Current completion boundaries

### Cloud infrastructure

Project and billing context, runtime service-account bindings, Storage bucket,
Pub/Sub resources, BigQuery dataset/table metadata, Artifact Registry, and
Logging API are verified in the recorded evidence. Om's project Owner role is
user-confirmed; the source documents still say Editor. ADC was verified in an
earlier audit, but its quota-project setting remains unverified. The current
budget matches the playbook's ₹5,000 amount and 50/90/100% thresholds; email
delivery itself is untested. All eleven required APIs are recorded enabled.
Cloud Run is not deployed; the existing image predates current integration
changes. Dataflow worker identity/IAM readiness is verified, but the previous
attempts failed worker allocation and current evidence does not show recovery.
Resource existence does not establish application access or end-to-end
integration.

### Local application

The app is a Node/Hono service intended for Cloud Run. `npm start`, `PORT`,
`/health`, and `/api/status` were smoke-tested locally during Batch F; both
routes returned 200 and status reported that live adapters were unavailable.
The supplied PO1 offline composition now traverses review confirmation,
coordinator preparation, injected DRAFT persistence/read-back, approval, and
approved-card retrieval. It is an offline composition only, not a
production-backed end-to-end acceptance run.

### Live integrations

No live application route, adapter, model inference, Translation call, or
persistent write was invoked during Batch F. This does not mean all Cloud Run
gates are disabled: the deployed revision's recorded model, risk/evidence,
Impact, JobSheet-write/storage and Firestore idempotency opt-ins include
enabled values. They remain unchanged and were not exercised. Local
process-default status reports production adapters unavailable. Read-only
resource metadata checks are recorded in tracker Section 73.

### Om/external handoffs

Required before the documented model/evidence/translation pieces can be
completed:

1. Om's training SQL/configuration, documented model acceptance threshold and
   feature/evaluation evidence; exact prediction SQL is already recovered.
2. Optimizer grid/objective SQL and evidence/similar-run query.
3. The actual glossary CSV with the documented language columns.
4. Plant season profile, approved anonymized PO fixtures, and photo
   provenance/consent/label mapping required by the Playbook's data/demo track.

## Next steps

1. Finish the cloud-backed application path in the shared codebase; Cloud Run
   is the intended runtime, and offline tests are code checks rather than a
   separate local-only product implementation.
2. Incorporate Om's remaining optimizer/evidence SQL, baselines, POs, glossary,
   stage order, and photo provenance/label mapping as they arrive. Keep those
   dependent functions explicitly unavailable until their contracts exist.
3. Complete just-in-time live integration acceptance only where needed. Avoid
   duplicate model queries, writes, message publishing, or other billable calls;
   the $300 credit and ₹5,000 notification budget are not spending caps.
4. Keep Dataflow blocked until read-only evidence shows the worker-capacity
   constraint changed; use only the previously authorized conditional retry.
5. Assemble and test the genuine `/jobs` workflow after its required model and
   operating inputs are available. The plant ID and shift source are now
   configured (verified `PLANT-01`, operator selection); sensor retrieval
   remains unavailable until an actual reading is stored.
6. Build the final Cloud Run image after integration is complete, then deploy
   only at the agreed final stage. Keep production exposure of the Impact
   dashboard after `/jobs` acceptance; its local screen is now implemented
   and offline-tested but has not been added to the deployed revision.

## 2026-10-12 current-state reconciliation

The preceding tables include historical snapshots; use this update together
with the latest `docs/PART2_COMPLETION_TRACKER.md` section for current cloud
state. Read-only evidence recorded there confirms all eleven required APIs,
the Storage bucket and Pub/Sub topic/subscription, Artifact Registry, the
BigQuery tables and five BQML models, and the `PLANT-01` row. The ₹5,000/month
budget includes credits and has 50%, 90%, and 100% current-spend rules routed
to its Monitoring notification channel. The sensor table has no readings.

There is no Cloud Run service and no active Dataflow job in `asia-south1`.
The bounded 2026-10-12 Dataflow retry failed worker provisioning with
`ZONE_RESOURCE_POOL_EXHAUSTED` in `asia-south1-b`; the one synthetic Pub/Sub
test message remains unacknowledged and was not found in BigQuery. The job is
cancelled and no active job remains. Do not spend credits on another retry
without new capacity evidence.
Cloud Run deployment remains the final stage. The existing Artifact Registry
image predates the latest recovered `sql/predict.sql` and risk adapter, so a
new build belongs after application integration is complete. No cloud resource
was created or reconfigured in the implementation pass; one bounded Dataflow
job was started and cancelled, and one simulated Pub/Sub message was published.
No repeat prediction or model call was run. The actual charge for that attempt
was not independently visible. The ₹5,000 alert is not a hard spending cap.

The non-secret Cloud Run environment contract is recorded in
`config/gcp-cloud-run.json`: `PROJECT_ID`, `REGION`, `BUCKET`,
`VERTEX_LOCATION`, `GEMINI_MODEL`, and verified `USTAAD_PLANT_ID=PLANT-01`.
`src/service-ports.js` accepts these deployment names directly while retaining
the existing aliases. The contract was applied to the private service on
2026-10-14; the final deployment state and gates are recorded below.

## 2026-10-14 supplied SQL handoff update

Om's SQL assets and synthetic PO fixtures are now present in workspace
`/prepagent-work/docs/`; original reference assets are excluded by the
workspace `.gitignore`. Supplied SQL has been copied to the app's canonical
`sql/` directory. The latest `npm test` passes 271/271 after BigQuery
result-type/row checks and order-independent optimizer decoding. Supplied prediction,
optimization, explanation, similar-run, seen-before, dashboard, and
`PLANT-01` cost queries were also run directly against BigQuery with explicit
per-query billed-byte ceilings. These direct reads do not verify the HTTP
adapters or Cloud Run. No Gemini generation, data write, resource creation,
IAM/billing change, or deployment occurred.

The latest SQL results supersede the earlier figures in this document:
prediction scrap cost is INR 5,351 (not INR 4,518); optimizer savings are
INR 925/17.4 kg (not INR 781); live dashboard net savings are INR 7,320
(not INR 6,194). See tracker Section 59 for the source-output comparison,
the INR 20 KPI cost arithmetic discrepancy, and remaining acceptance work.
The `/impact/summary` API is implemented behind
`USTAAD_ENABLE_IMPACT_SUMMARY=true`, caches successful results for one hour,
and explicitly returns unavailable instead of using `PREVIEW` data. The local
operator UI now includes an Impact screen using only that existing endpoint;
it separates historical lot-table values from the held-out synthetic
counterfactual and reports cache/period limits. Contract tests are offline
only. The currently recorded Cloud Run revision predates this screen; no
build, deployment, cloud read, or gate change was performed for Batch D.

## 2026-10-14 first private Cloud Run deployment

This supersedes earlier notes that deployment was held or no service existed.
The user authorized a private first deployment. Cloud Build
`3a1c27ad-db4d-42a9-9010-e6625e6fce39` succeeded and pushed
`asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent:part2-20261014-0245`
(digest `sha256:5676d82c371544a7404af4c395231c6ad8adf7c72e87fa8820e14bd6e954f038`).
Cloud Run service `prepagent`, revision `prepagent-00002-nsm`, is ready in
`asia-south1`; its URL is
<https://prepagent-26mwt2n7ba-el.a.run.app>. The revision uses
`prepagent-run@prepagent-hack.iam.gserviceaccount.com`, port 8080, 1 GiB,
zero minimum and max two instances. The IAM policy has no public `allUsers`
binding.

Authenticated private-proxy checks: `/health` and `/` returned 200.
`/risk/predict`, `/risk/optimize`, `/evidence/seen-before`, and
`/impact/summary` returned live BigQuery-backed 200 responses. Decoder fixes
were required for BigQuery `FLOAT`/`INTEGER` schema names, and the seen-before
service now validates business fields separately from its AbortSignal. The
deployed endpoint `/conditions/current?shift=DAY` returned the explicit 503
for no stored `PLANT-01` sensor row; a bounded read confirmed the table has no
matching row.

Risk, evidence, and Impact read gates are enabled. Gemini, BigQuery/Storage
writes, job persistence, feedback persistence, and Firestore idempotency are
disabled. Thus extraction, similar-run/explanation through the live Gemini
flow, DRAFT JobSheet lifecycle, approval, and card retrieval remain
unavailable. No production/test rows or objects were written. PO1 has not
completed the required end-to-end lifecycle. Public access and
sensor-to-BigQuery delivery remain blockers. The Impact screen is now present
in the local source tree but is not in the deployed revision; see tracker
Sections 60 and 71 for the historical route results and current offline
implementation evidence.

## Current application smoke evidence — 2026-10-14

This section supersedes older deployment-state notes above where they conflict.
Requests were made only through the existing authenticated local Cloud Run
proxy; no public-access, IAM, deployment, or runtime configuration changes
were made.

- `/health` and `/api/status` returned HTTP 200. Status describes revision
  `prepagent-00005-s5x` adapter configuration, not successful model inference
  or job persistence.
- At the time of this initial check, `/conditions/current?shift=DAY` returned
  HTTP 503 because no sensor row was present. The controlled follow-up below
  later published one explicitly simulated row; the endpoint continued to
  return 503 despite that row being readable from BigQuery.
- `/impact/summary` returned HTTP 200 from BigQuery. Its history is labeled
  observed, while its September 2026 counterfactual is explicitly labeled as
  not observed production. This is not causal proof of agent savings.
- `/fx?base=INR` returned HTTP 200 from the dated static fallback
  (`2026-10-09`), not the live Frankfurter feed.
- The private deployed UI remains older than the local source: its navigation
  does not include Screen 4 and Screen 1 still describes upload during job
  preparation. Local source changes have not been deployed.
- At the time of this initial check, no PO had been uploaded and no simulated
  reading had been published. The controlled follow-up below supersedes those
  statements. No JobSheet, approval, feedback, or job-card record was written.
- At that checkpoint, the complete live PO-to-approved-card workflow was
  blocked by the production conditions and extraction failures, not by an
  absent BigQuery sensor row. Later tagged-candidate evidence is recorded
  below; it does not mean production traffic was updated.

## 2026-10-14 controlled live follow-up

- The user authorized one bounded simulated sensor publication. The repository
  publisher sent exactly one message: Pub/Sub message ID
  `21979885863051723` at `2026-10-14T11:57:13.921Z`. A read-only BigQuery
  read-back confirmed row `b6dccb94-3f54-4f3b-b41d-cc7bca09ca43` for
  `PLANT-01`, source `simulated`, RH 59.9, temperature 30.2, moisture 8.88.
  No second message was published and no Dataflow retry was performed.
- The exact parameterized conditions SQL returned that row when run through
  `bq` as the caller. Cloud Run `/conditions/current?shift=DAY` nevertheless
  returned HTTP 503 (`SERVICE_UNAVAILABLE`) after the row existed. The
  deployed handler emitted only generic errors and Cloud Logging had no
  application diagnostic identifying whether the cause was workload identity,
  query execution, or result decoding. The root cause is therefore not proven.
- One `POST /orders/extract` was made through the existing authenticated
  private proxy with the documented synthetic PO1 and operator context
  (`CLA/PO/2026/1047`, `RECYCLED`, `SUP-D`). It returned HTTP 503 after 3.686 s:
  `SERVICE_UNAVAILABLE`, reason `INTEGRATION_ERROR`; no review or extraction
  result was accepted. The service's failure response confirms its temporary
  upload cleanup did not report a failure. No model-usage metadata was
  returned, so successful Vertex generation is not established; the request
  may still have incurred a provider charge if it reached Vertex. It was not
  retried.
- Read-only live API checks: `/risk/predict` returned HTTP 200 from
  `bigquery-ml` with `isRealModelPrediction=true`; `/risk/optimize` returned
  HTTP 200 from `bigquery-ml` using the actual item-master profile and the
  simulated sensor row. The optimizer returned a model-predicted baseline
  6.44% / 63.5 kg / INR 3,387 and best 5.31% / 52.3 kg / INR 2,790, with
  estimated savings 11.2 kg / INR 597. These are predictions, not measured
  production results. `/evidence/seen-before` returned HTTP 200 from BigQuery
  for DELAM at 86% RH (historical average 2.81%, cost INR 280,063, three
  notes); these values are historical evidence, not current-run outcomes.
- Cloud Run read-only inspection confirms service `prepagent`, project
  `prepagent-hack`, region `asia-south1`, URL
  `https://prepagent-26mwt2n7ba-el.a.run.app`, revision
  `prepagent-00005-s5x` receiving 100% traffic, image
  `prepagent:po1-e2e-20261014-2` at digest
  `sha256:25395f6c46ff43833b8ecd077bc8950173299cc743425d46baae3c03adaaa9f2`,
  runtime service account `prepagent-run@prepagent-hack.iam.gserviceaccount.com`,
  port 8080, and service maximum two instances. The service remains IAM
  authenticated; no `allUsers` binding was returned. Direct unauthenticated
  access returning 403 is expected. The existing authenticated proxy on port
  8082 is the verified private access path.
- Cloud Build metadata did not expose a source revision SHA, and the deployed
  UI is observably older than the local worktree. Current local changes are
  not verified as deployed. No deployment, IAM change, API enablement, or
  other cloud configuration change was made.
- Added redacted error-class/code logging for conditions and PO extraction
  failures with offline regression tests. Logs exclude exception messages,
  document contents, prompts, and model responses. This worktree change is
  not in the running revision and requires a separately authorized deployment
  before it can diagnose another live request.
- No JobSheet creation, approval, feedback write, or job-card retrieval was
  performed. The end-to-end PO-to-approved-card workflow remains unverified;
  do not treat the optimizer output or the simulated sensor reading as
  production acceptance evidence.

## 2026-10-14 candidate decoder fix and live extraction verification

This section supersedes the earlier unresolved conditions/extraction status
above for the tagged candidate only. Production traffic and the private IAM
boundary were not changed.

- Candidate image `catalog-numeric-20261014-1` was built by Cloud Build
  `62c92ff7-9600-46b1-a6d7-2cd7ad4186c4`, digest
  `sha256:f839a6b2862e41fff90229ea046c777881077b5c41b9c56ae2e6cacc7c5054ca`,
  and deployed as revision `prepagent-00009-voy` with tag
  `catalog-numeric-20261014-1`. It receives **0% default traffic**. The
  production traffic split remains 100% on `prepagent-00005-s5x`; Cloud Run
  remains private and no IAM policy was modified. Build provenance does not
  identify a clean source commit because the source worktree was dirty.
- The tagged candidate returned HTTP 200 for `/health`, `/api/status`, and
  `/conditions/current?shift=DAY`. Conditions returned the available row with
  `source=simulated-sensor`; this is the single earlier simulated sensor
  reading, not a production sensor feed.
- One bounded `POST /orders/extract` using the supplied synthetic PO1 and
  operator context returned HTTP 200 in 5.599 seconds. The live result came
  from `vertex-gemini`, reported a real model prediction, contained one
  `MATCHED` line with no clarification requirement, and returned an accepted
  in-memory review. Model usage reported 825 prompt, 62 candidate, and 1,276
  total tokens. The original PDF is retained in private Cloud Storage for
  normal workflow linkage; no JobSheet, job, approval, feedback, or card was
  created.
- The earlier candidate extraction failure was traced to BigQuery REST schema
  types: `INTEGER` and `FLOAT` fields were returned as strings, while the
  catalog decoder converted only `INT64` and `FLOAT64` aliases. Added both
  aliases to the numeric decoder and regression coverage. The first failure's
  diagnostic identified invalid types at `lengthMm`, `widthMm`, `heightMm`,
  `ply`, `topLinerGsm`, `fluteGsm`, `innerLinerGsm`, and `linerBf`.
- Focused extraction suite: **25/25 passed**. Complete `npm test`:
  **362/362 passed**. Syntax checks for both changed JavaScript files and
  `git diff --check` passed.
- This is **candidate live integration evidence**, not production rollout or
  full workflow acceptance. DRAFT persistence/read-back, operator approval,
  job-card retrieval, and real production conditions remain unverified. Do
  not approve the synthetic review or shift traffic without a release decision
  and an authorized human operator.
- **DRAFT persistence blocker:** The operator supplied DAY, MED gum
  application, 170°C roll temperature, and 35-second gum viscosity as demo
  settings. SF speed 38 m/min, MED pasting pressure, and four-hour drying are
  proposed candidate-grid values, not confirmed actual settings; print speed
  is not confirmed. Because `/jobs` requires the operator settings and no
  print speed was supplied, no additional extraction or persistent DRAFT
  submission was made. The available conditions are simulated; any future
  test record must remain explicitly test-only and unapproved.

### Local browser/UI follow-up (2026-10-14)

The current local Screen 2 now submits similar-run and explanation requests
through the existing validated routes. Chromium browser verification confirmed
all four screen panels are visible on navigation and confirmed a complete
same-origin `POST /risk/similar-runs` request using an explicitly intercepted
`offline-test-adapter` response. The UI labeled the result as offline test
data and left explanation disabled. This did not invoke BigQuery or Gemini,
verify live adapter output, or advance the PO-to-approved-card acceptance.
The current local `/api/status` still reports no production adapters and live
model calls disabled; no deployment or cloud mutation followed.

## 2026-10-14 remediation candidate deployment

Cloud Build `e01b285a-d6d2-4729-a6e4-31dd150b3786` produced image digest
`sha256:7d75f6ea42f67832d0cfb2240592be4b966a68fd68e8cf98038b131cc2117e75`,
deployed privately as tagged revision `prepagent-00011-yew`
(`remediation-20261014-1513`) with 0% default traffic. Production remains
100% on `prepagent-00005-s5x`. Authenticated proxy health and API status
returned HTTP 200, and the browser loaded Screen 1. Service IAM and project
invoker checks found no public invoker. No workflow write, paid provider call,
IAM mutation, or traffic promotion was performed.

The candidate runtime has the existing live-model, read/write, storage, and
idempotency gates enabled, with feedback writes disabled. Status verifies
configuration, not integration connectivity. Offline `npm test` passed
378/378. Final acceptance is **NOT READY**: see Section 83 of
`PART2_COMPLETION_TRACKER.md` for model, operator-evidence, optimizer-contract,
full live workflow, and other remaining blockers.

## 2026-10-14 independent closure evidence and authorized-run procedures

### Local verification

Run from the application repository:

```sh
cd prepagent
npm run test:acceptance
npm test
```

The current runs passed **218/218** and **384/384**, respectively. The
acceptance run uses fake external adapters and in-memory test repositories;
it is not a live cloud workflow. `PORT=8120 npm start` also returned HTTP 200
for `/health`, `/api/status`, and `/`; browser navigation loaded all four
screens. Local status reported live model calls disabled and job creation
unavailable.

### Grouped model acceptance

No grouped training or evaluation was performed. Following explicit
operation-specific authorization, run these already-prepared SQL files in
order from `prepagent/`:

```sh
bq query --project_id=prepagent-hack --location=asia-south1 --use_legacy_sql=false < sql/model_grouped_candidate_training.sql
bq query --project_id=prepagent-hack --location=asia-south1 --use_legacy_sql=false < sql/model_grouped_candidate_evaluation.sql
bq query --project_id=prepagent-hack --location=asia-south1 --use_legacy_sql=false < sql/model_grouped_candidate_feature_importance.sql
```

The first command creates five distinct `*_grouped_v1` BQML resources and is
mutating/billable; the latter two are read-only but may incur BigQuery charges.
The evaluation output names the exact model resource/version, dataset,
customer-hash split, training cutoff, observed held-out date range, and row /
customer counts. Record the result and model metadata. Accept only if all five
held-out-customer R² values are at least 0.6 and feature/schema/rule review
passes. Do not overwrite active `m_*` models or lower the threshold.

### Genuine sensor ingestion verification

No genuine sensor publication or row was created/verified in this closure.
`tools/publisher.mjs` produces only simulated data and must not be used as a
genuine sensor. A real device/authorized producer must emit exactly one
reading to the existing `sensor-readings` topic after separate approval. Use
the unique correlation `reading_id` `LIVE-ACCEPTANCE-20261014-01` only if that
identifier has not already been used; do not fabricate the measurement. The
message must match this schema:

| Field | Required value |
|---|---|
| `reading_id` | `LIVE-ACCEPTANCE-20261014-01` if unused; otherwise a new unique device-issued/correlation ID |
| `ts` | Actual UTC RFC3339 time of measurement |
| `plant_id` | `PLANT-01` |
| `ambient_rh_pct` | Actual measured relative humidity percentage (numeric) |
| `ambient_temp_c` | Actual measured temperature in degrees Celsius (numeric) |
| `paper_moisture_pct` | Actual measured paper moisture percentage (numeric) |
| `source` | `live`, emitted only by the genuine device/authorized producer |

After the producer confirms one successful publish, allow up to 120 seconds
for the existing direct sink subscription `sensor-readings-bq`. Run this
read-only query from `prepagent/`, substituting the exact accepted reading ID
and plant:

```sh
bq query --project_id=prepagent-hack --location=asia-south1 --use_legacy_sql=false \
  --parameter='readingId:STRING:LIVE-ACCEPTANCE-20261014-01' \
  --parameter='plantId:STRING:PLANT-01' \
  < sql/sensor_ingestion_acceptance.sql
```

Success requires exactly one row, matching identifier and actual measurement,
`plant_id=PLANT-01`, `source=live`, timestamp parseable and not future-dated,
relative humidity in `[0, 100]`, finite numeric temperature (the schema sets
no physical temperature range), and paper moisture in `[0, 20]`. The bounded
read-back must succeed within 120 seconds. Zero, duplicate, mismatched,
malformed, or timed-out rows fail. The row is persistent; there is no cleanup.
Pub/Sub and BigQuery use may incur charges. This verifies only the direct
sink, not Dataflow. Historical Dataflow attempts failed for zone capacity; do
not retry, create, or restart a Dataflow job without fresh read-only evidence
that capacity changed and separate explicit authorization. Conditions
freshness still cannot pass production preparation until an owner-approved
maximum age is defined; the current adapter reports `unassessed` and the
coordinator rejects it.

### Remaining gate owners

| Gate | Owner and required input | Operation/evidence that closes it |
|---|---|---|
| Optimizer semantics | Om: authoritative baseline, penalty rules, cost basis, expected raw case | Written contract decision, followed by targeted SQL/tests; no cloud operation. |
| Actual machine settings | Plant operator: confirmed shift and all seven lever settings, including print speed | Record confirmed inputs and compare them to a validated DRAFT; no inferred values. |
| Model generalization | Model owner and user: training authorization; exact candidate metadata/results | The three SQL commands above; model creation is persistent and billable, evaluation queries may be billable. |
| Genuine sensor path | Plant operator/device owner and cloud-operation approver | One actual reading as specified above; persistent row and possible query charges. Dataflow remains a separate blocked path. |
| Full cloud workflow | User/release owner and approving supervisor | Explicit bounded authorization for paid extraction, Storage/Firestore/BigQuery operations, DRAFT read-back, approval, and card retrieval. Do not reuse isolated extraction evidence as end-to-end proof. |
| Review/photo/rate-limit production safety | Product/privacy owner | Approve PO review lifetime/schema, explicit attributable photo consent/provenance/retention, and trusted proxy client-IP design before adding durable state or distributed limiting. |
| Release artifact | User/release owner | Review dirty worktree, authorize a clean commit, then separately authorize a build from that exact SHA. Do not deploy or shift traffic without a further explicit decision. |

The private Cloud Run boundary remains unchanged. No Cloud Run deployment,
traffic shift, IAM change, paid provider call, BigQuery query/write, Pub/Sub
publication, Dataflow operation, Firestore write, approval, or job-card
creation occurred in this closure pass.
