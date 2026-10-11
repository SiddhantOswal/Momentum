# Part 2 readiness and cloud integration TODO

This status is based on a read-only inspection of the project and local
repository on 2026-10-11, against Part 2 of the supplied sprint playbook and
the supplied product blueprint. Billing remains disabled. No billing,
resource, IAM, deployment, job, or live-service mutations were performed in
that audit.

Status meanings:

- **VERIFIED COMPLETE** — inspected against the playbook and verified locally
  or with a read-only cloud check.
- **PARTIALLY IMPLEMENTED** — some contract or route exists, but the
  acceptance behavior is incomplete.
- **BLOCKED BY BILLING / CLOUD PROVISIONING** — requires deferred cloud
  provisioning, a live call, or a billing prerequisite.
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
| 2.2 Billing | BLOCKED BY BILLING / CLOUD PROVISIONING | Billing describe returned `billingEnabled=false`. | Deliberately deferred; no billing account or trial action. |
| 2.3 ₹5,000 monthly budget; 50/90/100% alerts | BLOCKED BY BILLING / CLOUD PROVISIONING | Not created; playbook places it after billing is linked. | Configure through Billing → Budgets & alerts when billing is authorized. |
| 2.4 Required APIs | PARTIALLY IMPLEMENTED | BigQuery, Storage, Logging enabled. Cloud Run, Cloud Build, Artifact Registry, Vertex AI, Pub/Sub, Dataflow, Translation and Compute were not enabled in last read-only API inspection. | Enable only after billing decision; no retries made. |
| 2.5 Om project access | VERIFIED COMPLETE | Read-only IAM policy showed Om `roles/editor`. | None. |
| 2.6 Runtime service account | VERIFIED COMPLETE | Runtime identity exists with all six playbook roles: Vertex AI user, BigQuery data editor/job user, Storage object admin, Cloud Translation user, Pub/Sub publisher. | APIs and workloads remain unavailable. No key is created. |
| 2.7 Local ADC | VERIFIED COMPLETE | ADC availability was checked without displaying the token. | None; never share credential files or tokens. |
| 2.8 Storage bucket | BLOCKED BY BILLING / CLOUD PROVISIONING | `gs://prepagent-hack-data` not present in read-only listing; manifest says pending. | Create in `asia-south1` with uniform access after prerequisites. |
| 2.9 Dataset and five tables | VERIFIED COMPLETE | Dataset `prepagent`, location `asia-south1`; live schema comparison matched playbook fields. `lots` is partitioned on `run_date`, sensor readings on `ts`. | None for schema creation. |
| 2.9 `PLANT-01` seed | PARTIALLY IMPLEMENTED | Read-only query returned zero rows. Idempotent MERGE prepared in `docs/bigquery-seed-plant.sql`; not executed. A later BigQuery dry-run request was rejected with `Billing has not been enabled for this project. DML queries are not allowed in the free tier.` | Execute only when DML prerequisite is resolved; no retry made. |
| 2.10 Pub/Sub topic/subscription | BLOCKED BY BILLING / CLOUD PROVISIONING | No topic/subscription listed; Pub/Sub API not enabled. | Enable API, create topic and subscription later. |
| 2.11 Dataflow worker identity/roles | PARTIALLY IMPLEMENTED | Expected default identity `514663464609-compute@developer.gserviceaccount.com` returned `NOT_FOUND`; no roles were added. Manifest records job config, not a live job. | Recheck identity after cloud prerequisites; grant documented worker roles only if it exists. |
| 2.11 Streaming job | BLOCKED BY BILLING / CLOUD PROVISIONING | Dataflow API disabled; no job launched. Playbook warns that a worker bills continuously. | Do not start until testing is scheduled and ongoing cost is accepted. |
| 2.12 Sensor publisher | PARTIALLY IMPLEMENTED | `tools/publisher.mjs` follows the documented message shape and 30-second cadence, labels readings simulated, and checks opt-in/project/billing/API/topic before publishing. Offline test verifies default refusal without invoking gcloud or publishing. | Do not publish in no-billing phase; no live topic or BigQuery visibility is verified. |
| 2.13 Vertex AI/Gemini | BLOCKED BY BILLING / CLOUD PROVISIONING | Vertex API disabled; manifest keeps live calls disabled. Offline test verifies the Gemini utility refuses without its explicit live-call flag; no authorized live-call flag was used. | API/model availability and live smoke test require separate authorization. |
| 2.14 Translation glossary | BLOCKED BY OM / EXTERNAL HANDOFF | Translation API/glossary not provisioned; glossary CSV absent in repo/reference docs. Manifest captures `corrugated`, `us-central1`, and seven codes. | Wait for Om’s CSV; then provision/test when allowed. |
| 2.15 Cloud Run hello-world/final service | BLOCKED BY BILLING / CLOUD PROVISIONING | Cloud Run API is disabled; no service deployed. Existing app has `/health` and `npm start`; cloud adapters are unavailable. | Cloud deployment deferred; full service workflow must be implemented before claiming completion. |
| 2.15 Cloud Build / Artifact Registry | BLOCKED BY BILLING / CLOUD PROVISIONING | APIs not enabled; no repository/build executed. Manifests are pending. | Provision for deployment later. |
| 2.16 Troubleshooting | PARTIALLY IMPLEMENTED | Safe local/read-only diagnostics and API-to-capability mapping are documented below; previously recorded Phase 2 results are explicitly historical. No cloud state was checked or changed in this sprint. | Live resource diagnostics remain impossible for disabled APIs and require authorized cloud access; do not retry known billing-blocked DML. |
| 2.17 build/deploy checklist | PARTIALLY IMPLEMENTED | FX helper, Zod contracts, API routes and schema mapper exist. Many live workflows below are incomplete. | See application matrix and external dependencies. |
| 2.18 keep-running/judging operations | NOT APPLICABLE | No deployed service or active Dataflow stream; this is a post-deployment judging procedure. | Revisit only after authorized deployment. |

## API-to-capability map and safe troubleshooting

The API states below are the Phase 2 read-only snapshot recorded in the
authoritative tracker (2026-10-11); they were not rechecked in this local
readiness sprint. API enablement is not resource existence, workload
authorization, or proof that a service call is billing-safe.

| API | Last recorded state | Dependent capability / what it does not prove |
|---|---|---|
| `bigquery.googleapis.com` | Enabled | Sensor conditions, model/optimizer/evidence queries, JobSheet and feedback persistence. Dataset/table existence does not prove rows exist or that DML/query charges are allowed. |
| `storage.googleapis.com` | Enabled | Order/PDF/photo uploads and stored job cards. The intended bucket was previously read-only checked and returned 404. |
| `aiplatform.googleapis.com` | Disabled | Genuine Gemini extraction/tool orchestration and photo classification. A local gate test is not model access. |
| `pubsub.googleapis.com` | Disabled | Sensor publisher topic. The topic/subscription were previously listed as empty; no publication occurred. |
| `dataflow.googleapis.com` | Disabled | Pub/Sub-to-BigQuery stream. The worker identity was not found in the previous listing; do not create one speculatively. |
| `compute.googleapis.com` | Disabled | Default Dataflow worker identity. API state does not prove an identity exists. |
| `translate.googleapis.com` | Disabled | Glossary-backed translations in `us-central1`. The Om-provided CSV is still required. |
| `run.googleapis.com` | Disabled | Cloud Run deployment in `asia-south1`. Service listing failed because the API was disabled; service absence is not established. |
| `cloudbuild.googleapis.com` | Disabled | Image build. Listing failed with the API disabled; no build was run. |
| `artifactregistry.googleapis.com` | Disabled | Container image repository in `asia-south1`. Listing failed with the API disabled; repository absence is not established. |
| `logging.googleapis.com` | Enabled | Cloud logs/diagnostics; this does not imply application deployment or integration health. |

Use only these read-only checks after confirming the active project. Never
accept an API-enable prompt as part of a diagnostic, add `--quiet` to a
mutating command, or retry an operation already blocked by billing:

1. Project, billing and API state:
   `gcloud config get-value project`,
   `gcloud billing projects describe prepagent-hack --format='value(billingEnabled)'`,
   and `gcloud services list --enabled --project=prepagent-hack --format='value(config.name)'`.
   Stop if the active project differs. Keep billing disabled unless the user
   explicitly changes that decision.
2. Bucket: only after Storage API availability is established, inspect
   `gcloud storage buckets describe gs://prepagent-hack-data`. A 404 is
   evidence that this named bucket is absent; a 403, disabled API or CLI
   activation prompt is not.
3. Pub/Sub: first inspect API state. Only if enabled, use
   `gcloud pubsub topics list --project=prepagent-hack` and
   `gcloud pubsub subscriptions list --project=prepagent-hack`. A disabled-API
   error does not establish resource absence. Do not publish or create resources.
4. BigQuery: use `bq show --format=json prepagent-hack:prepagent` and the
   individual table metadata commands for schemas/partitions. Do not query
   rows, dry-run, or execute `docs/bigquery-seed-plant.sql` under the known
   billing restriction. The future seed command is
   `bq query --use_legacy_sql=false < docs/bigquery-seed-plant.sql`, but it
   requires explicit user authorization and confirmed billing/query
   eligibility first.
5. Dataflow identity: a read-only
   `gcloud iam service-accounts list --project=prepagent-hack --filter='email~compute@developer.gserviceaccount.com'`
   may establish whether the documented default identity is listed. Do not
   create an account or change IAM to bypass a missing identity.
6. Model/Translation readiness: check enabled API state and local manifest
   regions. Do not make inference or Translation calls. Verify the actual
   glossary/SQL/model inputs from Om before proceeding; a manifest is not
   proof of those artifacts or a provisioned glossary.
7. Build/Run/Artifact Registry: only attempt resource listings when the
   corresponding API is confirmed enabled. With a disabled API, a listing
   error or activation prompt leaves resource existence unknown. Do not enable,
   build, create a repository, deploy, or expose a service as troubleshooting.
8. Local application: `curl -i http://localhost:8080/api/status` shows declared
   local capabilities; `curl -i http://localhost:8080/conditions/current`
   demonstrates the actual route response. `503 SERVICE_UNAVAILABLE` means
   no integration result was produced. Do not treat route validation or a
   local PDF as a cloud write/upload.

## Local application requirements

| Requirement | Status | Evidence | Remaining work / dependency |
|---|---|---|---|
| Backend foundation: `npm start`, `PORT`, `/health`, `/api/status`, root UI | PARTIALLY IMPLEMENTED | Start script reads `PORT`; routes exist. Tests exercise health/status/root and rate limiting. Root serves an operator page for file/JSON input, actual endpoint responses, PDF rendering and explicit unavailable states. | Genuine cloud-backed production workflow remains unavailable. |
| JSON errors, malformed input, not-found, request cap | VERIFIED COMPLETE | Central JSON 400 validation; 10 MiB body cap; non-object JSON rejection; local tests cover malformed JSON, 413 and 404. | Unexpected server failure semantics remain basic. |
| Zod order/condition/lever/risk/job/feedback/photo/BigQuery contracts | VERIFIED COMPLETE | `src/schemas.js`, `src/types.js`, schema tests. | These contracts do not themselves supply live results. |
| Order field validation and missing-field report | VERIFIED COMPLETE | `src/order-extraction.js`; tests verify omitted-field reporting and invalid data. | This validates supplied JSON; it does not extract from PDF. |
| PDF-to-Gemini order extraction | BLOCKED BY BILLING / CLOUD PROVISIONING | `/orders/extract` checks multipart PDF then service port returns 503; no Gemini call. | Needs Storage/Vertex configuration and real sample orders. |
| FX rates endpoint, currencies, date/provenance, cache/fallback, formatting | VERIFIED COMPLETE | `src/fx-rates.js`, `src/fx-fallback.json`, `/fx`, `Intl.NumberFormat`, FX tests. | FX conversion is distinct from formatting; ECB feed coverage is limited as documented. |
| Current sensor conditions endpoint | BLOCKED BY BILLING / CLOUD PROVISIONING | `/conditions/current` validates query then unavailable port returns 503. | BigQuery sensor integration and stored-reading fallback. |
| Five-defect model prediction | BLOCKED BY OM / EXTERNAL HANDOFF | Contract and route validation exist; live port returns 503. No fabricated model results. | Om’s trained models/predict SQL and cloud setup. |
| Lever optimizer, baseline/changes/savings | BLOCKED BY OM / EXTERNAL HANDOFF | Result schema exists; route returns unavailable; no fake savings generated. | Om’s optimizer SQL/model outputs. |
| Similar-run/evidence search and grounded explanation | BLOCKED BY OM / EXTERNAL HANDOFF | Input validation helpers exist; no historical records or SQL in repo. | Om’s evidence query plus model attributions; Gemini later. |
| Seven agent functions and real Gemini tool loop | PARTIALLY IMPLEMENTED | Seven local helper functions and routes exist in `src/mock-agents.js`/`index.mjs`; cloud-dependent helpers return unavailable. No central Gemini tool registry, function-calling loop, or trace. | Vertex setup and integration implementation. |
| SSE tool trace | NOT IMPLEMENTED | No SSE route/client event trace found. | Implement as part of real agent orchestration; no simulated live trace. |
| Documented job creation and approval (`POST /jobs`, `POST /jobs/:id/approve`) | BLOCKED BY BILLING / CLOUD PROVISIONING | Routes validate PDF/job ID then return explicit service unavailable; no BigQuery writes or state transitions occur. | Implement real pipeline and persistence after BigQuery, models, Gemini and Storage are available. |
| Job list/detail/reject endpoints | NOT APPLICABLE | The Part 2 API contract does not list `GET /jobs`, `GET /jobs/:id`, or `POST /jobs/:id/reject`. | Do not add unless product scope is explicitly expanded. |
| Printable job card/PDF and Unicode fonts | PARTIALLY IMPLEMENTED | `src/job-sheet-pdf.js` renders a caller-supplied validated JobSheet locally; bundled, licensed Noto Sans fonts cover Devanagari, Japanese, Korean and Simplified Chinese. The card route still returns unavailable. | Job generation, approval, Storage upload/retrieval and persistent card state remain unimplemented or cloud-blocked. |
| Multilingual UI, translation helper/cache | PARTIALLY IMPLEMENTED | Language/currency validation and configuration exist. No locale JSON UI structure, Translation adapter or per-job cache. | Om glossary CSV and Translation service setup. |
| Feedback validation and persistence | PARTIALLY IMPLEMENTED | `FeedbackInputSchema`/route validate payload; service port returns unavailable; no upload/classifier/BigQuery persistence. | Storage/Vertex/Translation/BigQuery adapters. |
| Photo classification | BLOCKED BY BILLING / CLOUD PROVISIONING | Contract exists, but no genuine classifier; no cloud prediction claim. | Vertex/Gemini plus real Om-provided defect photos. |
| Full operator UI | PARTIALLY IMPLEMENTED | Root page collects a PDF or caller-supplied JSON, displays real endpoint responses and sanitized errors, and renders a supplied validated JobSheet locally. It does not fabricate cloud results. | Agent trace, job creation/approval, stored cards, feedback, and full production workflow remain unavailable. |
| Rate limit and 60-second request timeout | PARTIALLY IMPLEMENTED | Direct-socket in-process limit is 60 requests/IP/60 seconds; `/health` is excluded. Timeout middleware returns structured 504 and aborts cooperative handlers. | No trusted-proxy IP design or cross-replica shared limiter is configured; not production-grade for Cloud Run. |
| Google Cloud adapters and parameterized SQL | BLOCKED BY OM / EXTERNAL HANDOFF | Service ports are explicitly unconfigured; no ML/evidence query files found. | Om’s SQL/model deliverables and cloud setup. |
| Local tests and smoke coverage | PARTIALLY IMPLEMENTED | Tests cover contracts, basic routes, FX, unavailable services, malformed/non-object/oversized JSON, root and 404. | No local end-to-end job lifecycle is possible with current service ports; cloud integrations intentionally untested. |
| README/local/cloud handoff docs | VERIFIED COMPLETE | `README.md`, `docs/LOCAL_DEVELOPMENT.md`, this readiness record and schema docs exist. | Update status when implementation or cloud state changes. |

## Current completion boundaries

### Cloud infrastructure

Project, identity, ADC, runtime IAM, Om access, dataset/table schemas, and
Logging API are verified. Billing is off; the budget alert, bucket, Pub/Sub,
Vertex, Translation, Cloud Run/build/image repository, and Dataflow stream are
not provisioned.

### Local application

The app starts as a local Hono service, validates schemas, reports explicit
service unavailability, serves an operator UI and provides FX formatting and
rate retrieval. It can render a caller-supplied validated JobSheet locally,
but it is **not an end-to-end production-prep workflow**: it cannot extract an
uploaded order, get current conditions, predict, optimize, create/retrieve/
approve stored jobs, upload/retrieve a Cloud Storage card, classify photos, or
persist feedback.

### Live integrations

No live cloud adapter was tested or claimed. Offline tests verify the
publisher and Gemini utility refuse their default execution paths; neither
tool was run with its opt-in/live-call flag.

### Om/external handoffs

Required before the documented model/evidence/translation pieces can be
completed:

1. Model-training and inference SQL/names for the five defect models.
2. Optimizer grid/objective SQL and evidence/similar-run query.
3. The actual glossary CSV with the documented language columns.
4. Plant season profile and real anonymized order/photos required by the
   playbook’s data/demo track.

## Next steps

1. Complete the safe local operator-facing work only after deciding whether a
   clearly marked demo-only mock mode is wanted; do not make up production
   predictions or savings.
2. Obtain Om’s model SQL, evidence query, season profile, glossary, and demo
   fixtures.
3. Resolve billing separately and configure the playbook budget alert before
   cloud workloads.
4. Provision the documented cloud resources in playbook order and verify each.
5. Implement real adapters, SSE trace, persistence, job-card rendering,
   feedback/photo processing, and operator UI; then test against cloud-backed
   resources.
6. Do not deploy publicly until access/security review and explicit
   authorization.
