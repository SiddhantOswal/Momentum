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

`GET /health` reports local process health. `GET /api/status` describes the
local capabilities and integrations that are not configured. The root page
provides the operator interface for actual API responses, validation errors,
and unavailable states. It does not synthesize risk, optimization, evidence,
or job records.

## Local routes and limitations

- `POST /api/agents/extractOrder` validates caller-supplied partial order
  fields. It does not read the supplied PDF or invoke Gemini.
- `GET /conditions/current`, `POST /risk/predict`, `POST /risk/optimize`,
  `POST /jobs`, job approval/card routes, feedback, and insights validate their
  request surface but report `503 SERVICE_UNAVAILABLE` where cloud services
  are required.
- `GET /fx?base=INR` uses the Frankfurter feed and can fall back to the dated
  snapshot at `src/fx-fallback.json`. The snapshot date and source are returned;
  formatting money with `Intl.NumberFormat` is distinct from converting it.
- The `/api/agents/*` helpers are local schema/validation surfaces, not a live
  Gemini function-calling loop. There is no SSE agent trace.
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
Its unavailable notice also makes clear that agent traces, job creation,
approval, stored cards and feedback are not configured.

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
```

The tests start local HTTP servers and require no Google Cloud account. They
also verify that cloud tools refuse by default and validate manifests/seed SQL
without contacting Google Cloud. The
optional utilities under `tools/` are not test files:

- `tools/publisher.mjs` only publishes clearly labelled simulated readings
  after explicit opt-in and project/API/billing/topic preflight. Do not run it
  during the no-billing phase.
- `tools/test-gemini.mjs` only attempts inference after an explicit flag and
  project/API/billing/model checks. Do not run it during the no-billing phase.

Local approval or in-memory job storage is not implemented. The live app does
not claim BigQuery persistence or issue any cloud requests through its
unconfigured service ports.
