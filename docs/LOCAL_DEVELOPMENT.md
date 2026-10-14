# Local development

## Requirements

- macOS or another Node.js-supported operating system
- Node.js 20 or newer
- npm

## Start the app

From Terminal:

```sh
cd ~/prepagent-work/prepagent
npm install
npm start
```

Open <http://localhost:8080>. To use another port:

```sh
PORT=8081 npm start
```

Port `4172` is not used by this application's `npm start` script. If the
documented default port is occupied, start on an available port such as 8081
and open that same port in the browser. Do not confuse an already-running
process on 8080 with a newly started process after source changes; restart
only a process you own, or use another free port to inspect the current
worktree without interrupting it.

`GET /health` reports local process health. `GET /api/status` describes the
local capabilities and integrations that are not configured. The root page
provides the operator interface for actual API responses, validation errors,
and unavailable states. It does not synthesize risk, optimization, evidence,
or job records.

The four operator screens use the hash in the URL; for example,
`http://localhost:8080/#screen-impact`. Screen navigation keeps the selected
panel visible and updates the current navigation link. On Screen 2, similar
runs use `POST /risk/similar-runs`; the explanation action remains disabled
until the current inputs have a real prediction, optimization response, and
similar-run response from the configured BigQuery adapter. Editing any
analysis input invalidates those results. Responses explicitly marked
`offline-test-adapter` are labeled as test-only and cannot enable the
explanation action. None of these UI states establishes live BigQuery or
Gemini connectivity.

## Local routes and limitations

- `POST /api/agents/extractOrder` is a deprecated legacy surface and returns
  `503 SERVICE_UNAVAILABLE`; it must not be used as an extraction endpoint or
  treated as a successful demo. The PDF `/orders/extract` endpoint remains
  available for a standalone extraction request; Cloud Run uses the existing
  Storage, Vertex Gemini and bounded BigQuery item-catalog adapters behind
  explicit runtime gates. The default local app does not upload or invoke a
  model.
- The exact model gate is `USTAAD_ENABLE_LIVE_MODEL_CALLS`. The model manifest
  (`config/gcp-vertex-ai.json`) must also have `modelCallsEnabled: true`, and
  the process environment must set `USTAAD_ENABLE_LIVE_MODEL_CALLS=true`
  (lowercase string). An unset value, `"false"`, `"TRUE"`, or `"1"` stays
  disabled. This flag alone does not provide credentials: the application
  adapter uses Cloud Run workload identity, so local startup without the
  metadata token endpoint cannot make a live request. Do not enable the flag
  for normal local development; any authorized live call must use a bounded
  process environment and the existing Vertex adapter. The operator UI sends
  same-origin requests and does not attach a Cloud Run identity token.
- The local order-validation tests use explicitly synthetic `PO-TEST-*` values;
  `test/fixtures/job-sheet.js` is a synthetic renderer fixture, not production
  data. The supplied PO1 PDF and its expected-results evidence are reference
  fixtures outside the application source tree and must not be committed.
- Om's current extraction contract is Gemini reading only `itemCode` and
  `quantity`, followed by `prepagent.items` lookup. The table supplies
  dimensions and board/print fields by matching column name. The operator must
  provide the purchase-order ID and the loaded reel's `paperType` and
  `paperSupplier`; these values are sent separately from the PDF and identified
  as operator-supplied in the extraction response. Do not infer them from the
  product specification. Screen 1 presents the selected PDF or JPEG and the
  required operator-confirmed context before its primary **Submit PDF for
  extraction** action; it posts those inputs to `/orders/extract`, then displays extracted
  document fields and each PO line for review. The selected review reference
  and explicitly confirmed source line are passed to `/jobs`, which revalidates
  them without extracting the document again. Default local gates keep live
  model and cloud access disabled; an unavailable extraction adapter returns
  an explicit error rather than a mock review. Photo classification is
  separate.
- `GET /conditions/current` has a latest-stored-row BigQuery adapter, but is
  wired only when `USTAAD_PLANT_ID` is set. `PLANT-01` is confirmed by the
  verified plant row and recorded in the Cloud Run environment manifest. The
  UI requires the operator to choose DAY/NIGHT; no shift is inferred. The
  sensor table currently has no readings, so the route remains unavailable
  until actual sensor data is present.
- `POST /risk/predict` has an adapter for Om's `sql/predict.sql`, recovered
  read-only from his successful BigQuery job history and covered by offline
  request/result tests. Its risk-specific billed-bytes ceiling is 80 MiB; the
  general BigQuery read client is capped at 50 MiB. Neither byte ceiling is a
  total monetary spending cap. `/risk/optimize` and the deterministic `/jobs`
  coordinator use the existing SQL and service adapters; unavailable stages
  stop the coordinator without substituting results. JobSheet repository,
  approval/card and feedback BigQuery/Storage adapters are guarded by
  `USTAAD_ENABLE_BIGQUERY_WRITES`, `USTAAD_ENABLE_JOB_STORAGE`, and
  `USTAAD_ENABLE_FEEDBACK_WRITES`. Firestore idempotency is separately guarded
  by `USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY`. Local defaults keep these gates
  disabled. Cloud Run's write/idempotency gate configuration is pending its
  next private deployment; persistence, approval and card retrieval are not
  considered live until verified against the same stored JobSheet.
- `GET /fx?base=INR` uses the Frankfurter feed and can fall back to the dated
  snapshot at `src/fx-fallback.json`. The snapshot date and source are returned;
  formatting money with `Intl.NumberFormat` is distinct from converting it.
- `src/google-cloud/gemini-function-runner.js` provides a bounded seven-tool
  function-calling loop and records sanitized lifecycle events in the existing
  SSE registry. The PO1 coordinator remains deterministic and consumes
  validated adapter outputs; a model call does not supply conditions,
  optimizer results, savings, or persisted job records. The last controlled
  PO1 extraction request returned HTTP 503, so successful live extraction is
  not established.
- `POST /job-sheets/render.pdf` validates a caller-supplied JobSheet with the
  existing Zod contract and renders a local A4 PDF. It does not generate a
  JobSheet, persist a record, approve a job, or upload to Cloud Storage.
- The renderer uses PDFKit's built-in Helvetica for Latin text and bundled
  Noto Sans variable TTFs for Devanagari, Japanese, Korean and Simplified
  Chinese. Each font has its upstream `OFL.txt` beside it under
  `assets/fonts/`; the files came from the Google Fonts repository at commit
  `bd8f81ddb5c74d5c8897b36ad88b440266245103` and are licensed under SIL OFL
  1.1. The renderer subsets embedded fonts to the characters used. Licensed
  replacements can be selected with `USTAAD_PDF_FONT_DEVANAGARI`,
  `USTAAD_PDF_FONT_JAPANESE`, `USTAAD_PDF_FONT_KOREAN`, or
  `USTAAD_PDF_FONT_CHINESE`. Han-only text can select a regional face through
  `?lang=ja`, `?lang=ko`, or `?lang=zh-CN`; without a locale, configure a
  generic Noto CJK file with `USTAAD_PDF_FONT_CJK`. Other non-Latin scripts
  require `USTAAD_PDF_FONT_UNICODE`. An unconfigured or missing requested font
  returns `PDF_FONT_UNAVAILABLE`; the renderer does not silently substitute a
  font that may lack glyphs.

The UI displays actual successful response bodies. For failed responses it
shows the HTTP status, known error code and safe user-facing explanation; it
does not echo arbitrary upstream messages, stack traces or diagnostic bodies.
The status endpoint advertises configured adapters and the UI enables only
those individual actions; this is configuration visibility, not a live
connectivity or end-to-end acceptance check. Local job creation stays disabled
unless durable persistence and Firestore idempotency are configured. Cloud Run
must be checked separately after each deployment.

The application has a 10 MiB HTTP request-body limit. Do not upload customer
orders, personal information, credentials, or production material to an
unreviewed local or public instance.

Operational API routes also have an in-process per-IP limit of 60 requests per
60 seconds and a 60-second request deadline. The playbook specifies per-IP
limiting but no threshold; 60/minute is this local implementation's default.
`/health` is excluded from rate limiting. The limiter reads the Node
connection's socket address and ignores `X-Forwarded-For`; this is safe for
direct local connections but is not a
verified client-IP strategy behind Cloud Run or another reverse proxy. The
in-memory limit is per Node process, not shared across replicas. Do not treat it
as production perimeter protection without an explicitly trusted proxy/client
IP design and a distributed limiter. Timeout-aware adapters receive an abort
signal and must honor it to stop their underlying work.

## Test and validate

```sh
npm test
npm run test:acceptance
```

The tests start local HTTP servers and require no Google Cloud account. They
also verify that cloud tools refuse by default and validate manifests/seed SQL
without contacting Google Cloud. The
optional utilities under `tools/` are not test files:

`npm run test:acceptance` runs the deterministic local acceptance set across
the real HTTP application, PO review/coordinator/DRAFT orchestration, fake
external service boundaries, lifecycle recovery with in-memory fakes,
conditions provenance, PDF rendering, approval/card guards, Impact, feedback
privacy, model/optimizer contracts, localization, sensor-ingestion SQL
read-only bounds, and container configuration.
It must finish with zero failures. Fixtures and adapter outputs are offline
test evidence; this command does not establish Vertex, BigQuery, Pub/Sub,
Dataflow, Storage, or Firestore connectivity or writes.

- `tools/publisher.mjs` only publishes clearly labelled simulated readings
  after explicit opt-in, a required `PUBLISH_MAX_MESSAGES` value from 1 to
  100, and project/API/billing/topic preflight. It publishes at most that
  many messages and defaults to a 30-second interval; an explicitly set
  `PUBLISH_INTERVAL_MS` may be 1,000–30,000 milliseconds. These simulated
  publishes use Cloud Pub/Sub and can incur charges. Do not run the publisher
  unless the live test is explicitly authorized and any costs are accepted.
- `tools/test-gemini.mjs --check-config` validates the pinned Vertex settings
  offline: project `prepagent-hack`, model `gemini-3.5-flash`, and location
  `asia-south1` (`v1` API). Live inference requires the separate
  `--allow-live-model-call` flag, project/API/billing/ADC preflights, and
  explicit authorization and cost acceptance. The live result is bounded to
  30 seconds and only the expected `ready` response is reported. Do not use
  live inference to troubleshoot local failures.

Local approval or in-memory job storage is not implemented. `/jobs` now returns
`SERVICE_UNAVAILABLE` before running the coordinator unless JobSheet persistence
and Cloud Run Firestore idempotency are both configured. It never treats a
process-local idempotency map or an unpersisted DRAFT as a successful job
creation. `/api/status` reports persistence, durable idempotency, and complete
job-creation readiness separately; configured adapters still require live
acceptance tests before they are considered operational.
