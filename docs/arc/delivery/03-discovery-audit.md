# 03. Discovery audit: v2 code and live configuration

Status: M0 discovery, read-only. Author role: solutions architect. Date: 2026-11-22. Branch `arc/m0-discovery` at `eb6eab9` (same commit as `v2` and `origin/v2`; `git rev-parse v2 origin/v2 HEAD`).

Scope: what the v2 backend and the two UIs actually do, where state lives, and where the reference PDFs disagree with the code. It does not repeat `01`, `02` (C1 to C20, G1 to G14), `STATUS.md` or `changes/2026-11-22-momentum-limits.md`; it cites them where it adds to them.

Amended 2026-11-23 at the M0 gate: the test baseline in 1.5 and D10 is replaced with the figures measured on Node 26.13.1, and wording that described live access in more detail than the plan needs is removed.

No source file, branch, commit or cloud resource was changed. Cloud reads were `describe` and `list` only. Secret values and secret-like env values (PROJECT_ID, BUCKET, USTAAD_PUBLIC_ORIGIN, keys) were not printed.

## 0. Commands run

| # | Command (abridged) | Used for |
|---|---|---|
| R1 | `gcloud run services describe momentum\|prepagent --region asia-south1 --format=json`, filtered to annotations, concurrency, resources, env var names, non-secret flag values | Sections 1.7, 3 |
| R2 | `gcloud run revisions describe momentum-00023-yaz ... --format="value(metadata.annotations)"` | Revision max scale and affinity |
| R3 | `gcloud firestore databases list --project prepagent-hack` | Firestore mode and settings |
| R4 | `gcloud projects get-iam-policy prepagent-hack`, filtered to the runtime service account | Runtime account roles |
| R5 | `node --test test/*.test.js` (`K_SERVICE` unset). The baseline in 1.5 is the M0 gate run on Node 26.13.1 (`reviews/M0-review.md`) | Test counts |
| R6 | `npm run test:acceptance` | Acceptance counts |
| R7 | `git rev-list --count main..v2`, `git log --all -S createFirestoreIdempotencyStore` | History checks |

NOT RUN: Playwright (`npm run test:ui`), `web` build (`npm run build` in `web/`), any request to the live services, any Firestore document read.

## 1. v2 map

### 1.1 Stack and entry points

| Item | Value | Evidence |
|---|---|---|
| Server | Node, Hono 4 on `@hono/node-server`, zod 4, pdfkit, firebase-admin | `package.json` dependencies |
| Node version | `engines >=20.10.0`; container is `node:22-slim`; the original audit ran on Node 22.17.1; the gate baseline was measured on Node 26.13.1, the only version on the gate reviewer's machine | `package.json`, `Dockerfile:1` |
| Entry | `index.mjs` (1,628 lines), `npm start` | `package.json` `start` |
| Adapters | `src/service-ports.js` builds every Google Cloud adapter from env flags at import time (`servicePorts`, line 576) | `src/service-ports.js:427-576` |
| Old UI | Server-rendered HTML at `/` (`src/operator-ui.js`, modules in `src/ui/*.js` served from `/ui/:filename`) | `index.mjs:416-422, 556` |
| New UI | React 19 + Vite 8 + Tailwind 4 in `web/`, built to `public/app` and served at `/app` | `web/vite.config.ts:14`, `index.mjs:437-469` |
| Cloud calls | REST with ADC tokens for BigQuery, Storage, Vertex, Firestore counter and idempotency; firebase-admin SDK only for the live store and Google sign-in | `src/google-cloud/*.js`, `live-store.js:60` |

### 1.2 HTTP routes in `index.mjs`

Guard key: **S** = `requireSupervisor` (live: signed `__Host-ustaad-demo` cookie, same-origin check on non-GET, demo-session scoping of `/jobs/:id` and `/api/runs/*`; `index.mjs:219-246`). **RL** = per-IP rate limit, 60 requests per 60 s per instance (`index.mjs:159-169`, `src/request-guardrails.js:2-3`). All routes except the trace stream get the 60 s timeout (`index.mjs:152-157`) and the 10 MiB body limit (`index.mjs:171`).

| Method | Path | Handler | Guard | Gemini | Line |
|---|---|---|---|---|---|
| GET | `/display-currency.js`, `/operator-ui.css`, `/localization.js`, `/locales/*`, `/money-contracts.js`, `/risk-ui.js`, `/impact-ui.js`, `/supervisor-auth-client.js`, `/dashboard.css` | static files | none | no | 389-539, 553 |
| GET | `/samples/:filename` | allowlist of PO1 to PO5 | none | no | 405-413 |
| GET | `/ui/:filename` | allowlist of 8 old-UI modules | none | no | 416-422 |
| GET | `/vendor/chart.umd.js`, `/fonts/*.woff2` | static | none | no | 423-433 |
| GET | `/app`, `/app/`, `/app/*` | React shell and assets from `public/app` | none | no | 449-469 |
| GET | `/impact` | `public/impact.html` | none | no | 471 |
| GET | `/api/runs/:runId/events` | `src/trace-routes.js:67` (SSE over in-memory trace registry) | S, RL, ownership via `demoTraceOwners` | no | 541-547 |
| GET | `/dashboard`, `/dasboard` (+ trailing slash) | redirect to `/` | none | no | 550-552 |
| GET | `/` | old operator UI (`homePage`) | none | no | 556 |
| GET | `/health` | inline | none | no | 558 |
| POST | `/api/auth/demo-session` | issue signed demo cookie | same-origin, RL | no | 562 |
| POST | `/api/auth/session` | Google sign-in cookie (404 unless `USTAAD_AUTH_MODE=FIREBASE_SESSION`) | same-origin, RL | no | 572 |
| POST | `/api/auth/logout` | clear cookie | same-origin, RL | no | 582 |
| GET | `/api/auth/me` | session principal | session cookie, RL | no | 587 |
| GET | `/api/auth/config` | auth mode for clients | RL | no | 595 |
| GET | `/api/status` | integrations, cap, model acceptance (with current R² per model) | RL | no | 614 |
| POST | `/orders/extract` | `servicePorts.extractOrderForReview` (`src/purchase-order-review.js`) | S, RL, synthetic-PO allowlist | **yes** | 749 |
| GET | `/conditions/current` | `current-conditions-service.js` (BigQuery) | S, RL | no | 834 |
| GET | `/fx` | `src/fx-rates.js` | RL only | no | 868 |
| POST | `/risk/predict` | `risk-prediction-service.js` | S, RL, `conditionsConfirmed` | no | 888 |
| POST | `/risk/optimize` | `risk-optimization-service.js` | S, RL, `conditionsConfirmed` | no | 921 |
| POST | `/jobs` | `job-draft-persistence.js` then `job-coordinator.js` | S, RL, allowlist, `Idempotency-Key` | **yes** (re-extracts if no `reviewId`; explanation 1 to 2 attempts, `risk-evidence-service.js:516`) | 954 |
| POST | `/job-sheets/render.pdf` | local PDF render; 503 on Cloud Run | none | no | 1157 |
| GET | `/jobs/:id` | `stored-job-sheet-lookup.js` (BigQuery) | S, RL, demo ownership | no | 1214 |
| POST | `/jobs/:id/approve` | `job-card-service.js` approve (BigQuery UPDATE + GCS PDF) | S, RL, model acceptance, demo ownership | no | 1228 |
| GET | `/jobs/:id/card.pdf` | `job-card-service.js` getJobCard | S, RL, demo ownership | no | 1283 |
| POST | `/jobs/:id/feedback` | `linked-feedback-service.js` (BigQuery insert) | S, RL | no | 1312 |
| POST | `/evidence/diagnose-photo` | `defect-diagnosis-service.js` + optional `findSeenBefore` | S, RL | **yes** | 1354 |
| GET | `/conditions/weather` | Weather API, 10-minute module cache | RL only | no | 1384 |
| GET | `/api/live` | SSE from `live-store.js` | S, RL | no | 1395 |
| GET | `/api/lots` | live-store snapshot | S, RL | no | 1417 |
| GET | `/insights/summary` | `servicePorts.getInsights` (no live adapter, see 2.4) | S (403 in demo mode, line 231), RL | no | 1431 |
| GET | `/impact/summary` | `impact-summary-service.js` | **RL only, no session** | no | 1456 |
| GET | `/evidence/approved-photos` | `approved-photo-service.js` list | S, RL | no | 1462 |
| POST | `/evidence/classify-photo` | `approved-photo-service.js` classify | S, RL | **yes** | 1467 |
| POST | `/evidence/seen-before` | `risk-evidence-service.js` (BigQuery) | S, RL | no | 1477 |
| POST | `/risk/similar-runs` | `risk-evidence-service.js` (BigQuery) | S, RL | no | 1499 |
| POST | `/risk/explanation` | `risk-evidence-service.js` (BigQuery ML + Gemini) | S, RL, model acceptance | **yes** | 1517 |
| POST | `/api/agents/extractOrder` | always 503 | RL | no | 1545 |
| POST | `/api/agents/{getConditions,predictRisk,optimizeLevers,findSimilarRuns,explainRisk,generateJobSheet}` | `mock-agents.js`; 503 outside local demo mode | RL | no | 1555-1618 |

Five routes can spend Gemini attempts: `/orders/extract`, `/jobs`, `/risk/explanation`, `/evidence/diagnose-photo`, `/evidence/classify-photo`. There is no chat, Arc or function-calling route. `src/google-cloud/gemini-function-runner.js` (8 rounds, 12 tool calls, 256 KiB results; lines 3-5) exists but is imported only by its test.

### 1.3 Services in `src/google-cloud/`

| Module | Backs | Store | Wired when (`src/service-ports.js`) |
|---|---|---|---|
| `order-extraction-service.js` | PO read (Gemini JSON, line 204) | GCS + Vertex | live model calls allowed (`allowed`, 448-450, 562) |
| `item-catalog-service.js` | catalog match | BigQuery | same |
| `current-conditions-service.js` | stored conditions | BigQuery | `USTAAD_PLANT_ID` set (474) |
| `risk-prediction-service.js` | five models, per-defect fallback, RH band | BigQuery ML (80 MiB cap) | `USTAAD_ENABLE_RISK_PREDICTION` (482) |
| `risk-optimization-service.js` | lever search | BigQuery ML (80 or 100 MiB) | contract status + version + budget (491-500) |
| `risk-evidence-service.js` | seen-before, similar runs, explanation | BigQuery (+ Gemini) | `USTAAD_ENABLE_HISTORICAL_EVIDENCE`; explanation needs Gemini (544-553) |
| `defect-diagnosis-service.js` | upload diagnosis (JPEG/PNG/WebP, 8 MiB) | GCS + Gemini | `USTAAD_ENABLE_DEFECT_DIAGNOSIS` (554) |
| `approved-photo-service.js` | ten approved photos | GCS + Gemini | approved-photo flag + HACKATHON_DEMO + synthetic-only (557) |
| `job-sheet-repository.js`, `bigquery-write-client.js` | DRAFT MERGE, APPROVE UPDATE | BigQuery `prepagent.job_sheets` | job storage + BigQuery writes (506-519) |
| `job-card-service.js`, `storage-client.js` | approval PDF, card fetch | GCS | same; approve also needs approval audit |
| `feedback-service.js` | feedback insert | BigQuery `feedback` | feedback + BigQuery writes (521-525) |
| `lot-association-service.js` | lot to order lookup | BigQuery | `projectId` set (469) |
| `impact-summary-service.js` | impact KPIs, monthly, seasonal, top items | BigQuery, 1 h cache | `USTAAD_ENABLE_IMPACT_SUMMARY` (470) |
| `weather-service.js` | Pune weather | Maps Weather API | `WEATHER_API_KEY` set |
| `live-store.js` | lots and events feed | Firestore `lots`, `events` (or memory) | `USTAAD_ENABLE_LIVE_STORE` (`index.mjs:87`) |
| `firestore-gemini-attempt-store.js` | shared daily Gemini count | Firestore `gemini_daily_usage/<day>` | `USTAAD_ENABLE_FIRESTORE_GEMINI_CAP` + database `(default)` + Asia/Kolkata (442-445) |
| `firestore-idempotency-store.js` | durable `/jobs` idempotency | Firestore `job_idempotency` | **never constructed** (section 3.2) |
| `vertex-gemini-client.js` | Gemini on Vertex, 2,048 default output tokens | Vertex | live model calls allowed |
| `gemini-function-runner.js` | tool-calling loop | none | **not used** |
| `bigquery-read-client.js` | query client, 50 MiB default cap | BigQuery | always |

### 1.4 Schemas

`src/schemas.js` (763 lines) exports 77 zod schemas (`grep -c "^export const .*Schema"`). The route-facing ones are listed in the `index.mjs:10-30` import. `live-store.js:11-30` defines its own `LiveLotSchema` and `LiveEventSchema`; `approved-photo-service.js` exports `PhotoClassificationRequestSchema`.

### 1.5 Tests

| Suite | Files | Result (this audit) |
|---|---|---|
| `npm test` on `origin/v2` (`node --test test/*.test.js`, Node 26.13.1) | 75 files, 588 tests | R5: 587 pass, 1 fail, 0 cancelled |
| `npm test` on `arc/main` at `a4480ec` (Node 26.13.1) | 76 files, 605 tests | 604 pass, 1 fail |
| `npm run test:acceptance` on `origin/v2` | 32 of the 75 files (`package.json`) | R6: 317 tests, 316 pass, 1 fail |
| `npm run test:ui` (Playwright) | `test/browser/{dashboard,frontend,local-backup}.spec.js` | NOT RUN |

- Failing test in both runs: `test/job-draft-persistence.test.js:508` "completed request replay retains the durable APPROVED lifecycle and audit". The v2 PDF lists it as a known failure that also fails on `main`.
- An earlier run on Node 22.17.1 reported 599 tests, 597 pass, 1 fail and 1 cancelled (`test/weather-service.test.js`, "weather provider times out to unavailable instead of hanging"). The original audit did run on Node 22.17.1, but the gate reviewer's machine has only Node 26.13.1, so that figure is NOT VERIFIED; on Node 26.13.1 no test was cancelled. The v2 figure of 588 was measured on `arc/main` with `test/quality-rules.test.js` excluded. That is equivalent to v2 only because M0 changed no app or test code. ARC-M1-13 pins Node 22 and must reproduce the cancellation before any fix.
- On `origin/v2`, 43 test files are outside `test:acceptance`, including `firestore-idempotency-store`, `trace-registry`, `trace-routes`, `request-guardrails`, `live-store`, `condition-guard`, `defect-diagnosis-service`, `gemini-function-runner` and `schemas`. `arc/main` adds `quality-rules`, also outside it.
- All three Playwright specs target the old UI at `/` (`frontend.spec.js:421,435`, `dashboard.spec.js:26,155-160`). No browser test covers `/app`. The Playwright server runs with every cloud flag off (`playwright.config.js:8`).
- `test/quality-rules.test.js` was untracked on `arc/m0-discovery` when this audit ran; it is committed on `arc/main`.

### 1.6 Build and deploy

| Item | What it does | Gap |
|---|---|---|
| `Dockerfile` | `node:22-slim`, `npm ci --omit=dev`, copies `index.mjs src public sql assets config` | Does not build `web/`. `public/app/` is gitignored (`.gitignore:29`) and absent in this checkout, so `/app` in an image depends on a local `web` build at build time. Not reproducible from git. |
| `.dockerignore` | Excludes `test`, `tools`, `docs`, most of `config` | None found |
| `ops/cloudbuild-private.yaml` | Builds the image, smoke-tests `/health`, `/`, `/ui/*`, `/api/auth/config`, runs `npm audit --omit=dev` | Does not deploy and does not check `/app` |
| `ops/firestore/gemini-counter.rules` | Proposed rules (deny all client access to `gemini_daily_usage`) | Header says not deployed |
| `ops/iam/*.yaml` | Custom role drafts (counter, token verifier) | The runtime account has the verifier role and `roles/datastore.user` (R4) |
| `tools/release-preflight.mjs` | Read-only checks of a tagged revision | Used in the limits change |
| `scripts/` | Git hooks and `scripts/quality/` text rules | Untracked on this branch |
| Deploy command | **None in the repository.** `grep` for `gcloud run deploy`, `max-instances`, `session-affinity` finds only `.claude/settings.json` and the delivery change record | Scaling, concurrency, affinity and env flags exist only in the live service. The v2 PDF (page 5) already flags the missing concurrency setting. |

### 1.7 Gemini daily cap and instance limit

| Setting | Code default | Env var | Live `momentum` | Live `prepagent` | Evidence |
|---|---|---|---|---|---|
| Daily attempt cap | 100 | `GEMINI_DAILY_ATTEMPT_CAP` | 300 | 100 | `src/daily-gemini-call-cap.js:2,6`; R1 |
| Cap time zone | Asia/Kolkata | `GEMINI_DAILY_ATTEMPT_TIMEZONE` | Asia/Kolkata | Asia/Kolkata | `daily-gemini-call-cap.js:3,7`; R1 |
| Shared counter | off | `USTAAD_ENABLE_FIRESTORE_GEMINI_CAP`, `USTAAD_GEMINI_COUNTER_DATABASE` | true, `(default)` | true, `(default)` | `service-ports.js:442-445`; R1 |
| Counter document | n/a | n/a | `gemini_daily_usage/<dayKey>` in `(default)`, Firestore Native, asia-south1, PITR off, delete protection off | same | `firestore-gemini-attempt-store.js:77`; R3 |
| Model | `config/gcp-vertex-ai.json` `testModel` | `GEMINI_MODEL` | `gemini-3.5-flash` | `gemini-3.5-flash` | `service-ports.js:453`; R1 |
| Revision max instances | not in repo | n/a (flag `--max-instances`) | 4 (`autoscaling.knative.dev/maxScale`) | 2 | R1, R2 |
| Service-level max instances | not in repo | n/a | 12 (`run.googleapis.com/maxScale`) | 2 | R1 |
| Min instances | not in repo | n/a | not set (scale to zero) | not set | R1 |
| Concurrency | not in repo | n/a | 20 | **1** | R1 |
| Session affinity | not in repo | n/a | on | off | R1, R2 |
| Request timeout, CPU, memory | not in repo | n/a | 120 s, 1 vCPU, 1 GiB, CPU throttled, no startup boost | same | R1 |

The limit is enforced per caller: each service passes its own `limit` to the shared transaction (`daily-gemini-call-cap.js:121-122`). Both services count into one document, so `prepagent` refuses once the shared count reaches 100 and `momentum` once it reaches 300.

The comment at `index.mjs:118-119` ("Cloud Run is capped at two instances") is now stale. `momentum` has a service-level cap of 12 that the limits change record does not mention.

## 2. Capability inventory against the approved designs

UI key: **Old** = server-rendered UI at `/` (sections `screen-impact`, `screen-order-input`, `screen-production-analysis`, `dashboard-job-review`, `screen-defect-check`; `src/operator-ui.js:9-11, 66-122`). **App** = React at `/app` (Floor, Lots, Defects; Impact and Models are "being built" placeholders, `web/src/App.tsx:24`). Neither UI follows the approved designs' navigation (C10).

### 2.1 (a) Built with a UI

| Capability | Endpoint | Old | App | Notes |
|---|---|---|---|---|
| PO read and line review | `POST /orders/extract` | yes (`workflow.js:821`) | yes, PO1 sample only (`Lots.tsx:10,118`) | Synthetic allowlist enforced live (`index.mjs:248-272`) |
| Catalog match | inside extract and review confirm | yes | yes | `item-catalog-service.js` |
| Conditions (stored reading) | `GET /conditions/current` | yes (`workflow.js:523,604`) | yes (`Lots.tsx:126`, `Defects.tsx:32`) | BigQuery reading for `PLANT-01` |
| Weather reading | `GET /conditions/weather` | no | status strip (`StatusStrip.tsx:15`) | Not passed into conditions by the App |
| Risk, optimize, explain as separate calls | `/risk/predict`, `/risk/optimize`, `/risk/similar-runs`, `/risk/explanation` | yes (`workflow.js:1034,1216,1248,1307`) | no | |
| Full plan to DRAFT | `POST /jobs` | yes (`workflow.js:1455`) | yes (`Lots.tsx:148`, with `Idempotency-Key`) | One call runs extract (or review confirm), conditions, predict, optimize, similar runs, explain, persist |
| Load stored draft | `GET /jobs/:id` | yes | yes (`Lots.tsx:366`) | Scoped to the demo session |
| Approve | `POST /jobs/:id/approve` | yes | yes, with a checkbox (`Lots.tsx:245,265`) | Old UI has no checkbox; backend does not require one (C9, C16) |
| PDF | `GET /jobs/:id/card.pdf` | yes | yes (`Lots.tsx:333`) | |
| Run trace stream | `GET /api/runs/:id/events` | yes (`workflow.js:1687`) | no | In-memory (section 3) |
| Feedback (actual scrap) | `POST /jobs/:id/feedback` | yes (`workflow.js:1598`) | no | |
| Seen before (one defect, one RH) | `POST /evidence/seen-before` | yes (`components.js:261`) | via diagnose-photo `pastCases` | |
| Approved-photo diagnosis | `/evidence/approved-photos`, `/evidence/classify-photo` | yes (`workflow.js:2053,2068`) | no | |
| Uploaded-photo diagnosis | `POST /evidence/diagnose-photo` | no | yes (`Defects.tsx:48`) | |
| Impact summary | `GET /impact/summary` | yes (`workflow.js:634`, `/impact`) | Floor (`Floor.tsx:64`) | No session required |
| Live lots and events | `/api/lots`, `/api/live` | no | Floor (`live.ts:30-31`) | Firestore-backed on `momentum` |
| FX display | `GET /fx` | yes | no | |

### 2.2 (b) Built without a UI, or with no UI in either app

| Capability | Where | What is missing |
|---|---|---|
| Per-defect partial prediction, fail-closed for JobSheet drafts | `risk-prediction-service.js:259-278`; `job-coordinator.js:495-522` | No partial-state UI (G1, G2) |
| Humidity band (RH ±5) | `risk-prediction-service.js:15-17` | Not shown in the App |
| Condition sources (`plant`, `weather`, `seasonal`) and reduced confidence | `condition-guard.js:129-163` | Only on the stored JobSheet; C20 |
| Attribution rows per defect | `/risk/explanation` returns `rows` (`risk-evidence-service.js:548-553`) | Insights "What moved the Warp estimate" has no screen |
| Current R² per model and the October thresholds | `/api/status` `modelAcceptance.models[].r2`, `requiredR2` (`model-acceptance.js:103,113`) | The App Models screen is a placeholder. The replaced models' R² ("earlier check") is not returned. |
| Gemini cap state | `/api/status` `runtimeAvailability.dailyGeminiCallCap` | Shows the limit only, not calls used, when the shared store is on (`daily-gemini-call-cap.js:149-152`) |
| Google sign-in with roles | `user-session-auth.js:74-77`, `/api/auth/session` | Not used live; the live service uses signed demo sessions (spec C9) |
| Tool-calling loop | `gemini-function-runner.js` | Not wired to any route; candidate base for Arc |
| Durable idempotency adapter | `firestore-idempotency-store.js` | Not wired (section 3.2) |
| Similar runs as a standalone call | `/risk/similar-runs` | App does not call it |

### 2.3 (c) Designed with no backend

| Design | Element | Backend status |
|---|---|---|
| All Arc screens (`Arc-*`) | Chat, intent routing, refusals, "insufficient data" answers, history panel | No route, no session store, no Arc tool registry |
| `Insights`, Insights spec | Ask Insights, conversational analytics (BigQuery data agent or parameterized queries) | Nothing. `/insights/summary` has no live adapter (2.4). |
| `Insights` | Software checks "43 passed" | No endpoint; test results are not stored |
| `Insights` | Photo diagnosis "7 of 10 labels matched" | No stored accuracy result; `classify-photo` is per photo |
| `Insights` | Approved job card "2 pages, 16,994 bytes" | No page count or size returned (C11) |
| `Insights` | Defect intelligence trend by month, delivery timeline, throughput, capacity | No source data (designed as "not connected"; correct) |
| `Main` | "Continue review" and lot stage per sample PO | No durable review or lot record (C8, C17) |
| `Plant-Explorer` | Per-stage lever changes of the current lot, "Compare HIGH and MEDIUM" | No lot-in-progress record; a two-value compare would need two `/risk/predict` calls |
| `Prep-Flow*` | Step status per lot (9 steps, held, partial) | Only the in-memory trace (per run, 30 min); no durable stage record |
| `Operator-Phone`, `Arc-Phone` | "I received this card", "Report a mismatch", three records, revision check | No endpoint, no table |
| `NewLot-Stale`, `Arc-Lot-Replaced` | Revisions, superseded drafts | No revision record (C8) |
| `NewLot-Settings`, compare screens | "8,640 combinations" | Not returned. The grid in `sql/optimize.sql:40-46` ranges from 2,160 to 17,280 candidates depending on inputs. |
| `Planning` | Roadmap | Static by design; nothing needed |

### 2.4 `getInsights` and `durableIdempotencyConfigured`

The open STATUS item ("off in production, owner and intended state not checked") has a code answer. Neither is controlled by a flag:

- `getInsights` has no live adapter anywhere. `createConfiguredServicePorts` never sets `adapters.getInsights`; only the local mock does (`service-ports.js:407`). Demo mode also blocks the route (`index.mjs:231`).
- `durableIdempotencyConfigured` is the literal `false` at `index.mjs:711` and `index.mjs:723`, and `idempotencyScope` is derived from the in-memory store (`index.mjs:712,724`).

## 3. State held only in process memory

Live context: `momentum` runs up to 4 instances per revision with 20 concurrent requests each, session affinity on, scale to zero (R1). Affinity is cookie-based and best-effort. Scale-in, a new revision or a restart also drops every entry below.

| # | State | File:line | Bounds | Lost on restart or another instance | Effect | Current mitigation |
|---|---|---|---|---|---|---|
| M1 | PO review registry | `src/purchase-order-review.js:45` (TTL 30 min, cap 100: lines 9-10, 82-86) | 100 per instance, oldest evicted | `reviewId` unknown, so `POST /jobs` returns "This PO review is stale" (`purchase-order-review.js:108-118`) | Both UIs send `reviewId` (`Lots.tsx:141`, `workflow.js:1443`), so a lost review blocks the plan and forces a re-read, which costs one more Gemini attempt | Affinity only |
| M2 | `/jobs` idempotency | `index.mjs:120-122` → `src/job-idempotency.js:19` (`InMemoryIdempotencyStore`, 30 s lease) | unbounded Map | A retry on another instance claims again and re-runs the pipeline. The job ID is deterministic (`hackathon-demo-auth.js:12-17`), so the MERGE (`bigquery-write-client.js:68-80`) usually stops a second row, but the read-back can mismatch (`JOB_SHEET_WRITE_UNCONFIRMED`, `job-sheet-repository.js:120-124`). Two concurrent MERGEs can both insert, and later reads then fail with `JOB_SHEET_NOT_UNIQUE` (line 135-137); the Firestore adapter's own header gives this reason (`firestore-idempotency-store.js:5-11`). | Duplicate Gemini and BigQuery spend; a lot can become unreadable | Affinity only. `/api/status` reports `idempotencyScope: "process-local"`. |
| M3 | Run trace registry | `src/trace-registry.js:77`, singleton at 253 (100 runs, 250 events per run, 30 min) | throws `TRACE_CAPACITY` at 100 running runs | Trace SSE returns `TRACE_NOT_FOUND` | Old UI's live progress breaks; no audit trail of a run survives | None |
| M4 | Trace ownership for demo sessions | `index.mjs:84`, eviction at 185 (1,000 entries) | 1,000 | `/api/runs/*` returns 403 `DEMO_SCOPE_REQUIRED` on another instance (`index.mjs:234`) | Same as M3 | None |
| M5 | Per-IP rate limit | `src/request-guardrails.js:73` (60 per 60 s, 10,000 clients) | per instance | Counts reset; each instance has its own budget, so the effective limit is 60 × instances | Weak as an abuse control. The key is the socket address (`request-guardrails.js:47-54`), not `X-Forwarded-For`. Behind Cloud Run's front end this address may be the same for every client, which would put all users in one bucket per instance. NOT VERIFIED; needs a read-only check in logs before Arc adds traffic. | None |
| M6 | Gemini local counter | `src/daily-gemini-call-cap.js:97` | per day | Used only without the shared store | Not active live: Cloud Run requires the shared counter (`service-ports.js:448-450`) | Firestore transaction (live) |
| M7 | Weather cache for `/conditions/weather` | `index.mjs:1383-1391` (10 min) | one entry | Each instance calls the API on its own | Low. The condition guard uses a separate, uncached provider (`service-ports.js:461-463`), so every plan with missing humidity or temperature calls the Weather API. | None |
| M8 | FX snapshot | `src/fx-rates.js:24` (24 h), fallback `src/fx-fallback.json` | one entry | Re-fetch per instance | Low | Static fallback |
| M9 | Impact summary cache | `src/google-cloud/impact-summary-service.js:131` (1 h) | one entry | Re-query per instance | Low (BigQuery bytes per instance per hour) | None |
| M10 | Live store fallback | `src/google-cloud/live-store.js:43-44` | 200 events | Only when `USTAAD_ENABLE_LIVE_STORE` is not `true` | `momentum`: Firestore (flag true). `prepagent`: flag absent, so it runs on memory (R1). | Firestore on `momentum` |
| M11 | Local demo job storage and feedback | `src/service-ports.js:198-199` | n/a | Local demo mode only | None live | n/a |
| M12 | Demo principals | `src/hackathon-demo-auth.js:3` (WeakSet) | n/a | None: tokens are HMAC-signed with a shared Secret Manager key, so any instance accepts them | None | Stateless signed cookie |

### 3.1 Durable state that already exists

| Store | Holds | Evidence |
|---|---|---|
| BigQuery `prepagent.job_sheets` | DRAFT and APPROVED JobSheet records, approval audit JSON | `job-sheet-repository.js:98`, `bigquery-write-client.js:68-80, 150-152` |
| BigQuery `feedback` | actual-scrap feedback | `bigquery-write-client.js:5` |
| Cloud Storage | PO files, photos, job-card PDFs | `storage-client.js`, `job-card-service.js` |
| Firestore `gemini_daily_usage` | shared daily attempt count (transaction) | `firestore-gemini-attempt-store.js:77-82` |
| Firestore `lots`, `events` | live floor feed (not authoritative, not session-scoped) | `live-store.js:60-61` |

### 3.2 Firestore alternatives present in code but switched off

| Component | State | Control |
|---|---|---|
| `src/google-cloud/firestore-idempotency-store.js` (collection `job_idempotency`, set-if-absent create, owner-token complete and release, 316 lines, tested in `test/firestore-idempotency-store.test.js`) | **Not imported by `index.mjs` or `service-ports.js`.** Its header names a gate `USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY` (line 19), but no code reads that variable, and the variable is not set on either service (R1). `git log --all -S createFirestoreIdempotencyStore` shows it was never wired in any commit. | None. Switching it on is a code change plus an ADR, not a flag flip. |
| Durable PO review store | Does not exist | n/a |
| Durable trace store | Does not exist | n/a |

Flags present on `momentum` but read by no code: `USTAAD_ENABLE_FIREBASE_AUTH=false`. The code reads `USTAAD_FIREBASE_AUTH_ENABLED` (`firebase-supervisor-auth.js:96,128`) and `USTAAD_AUTH_MODE` (`user-session-auth.js:75`), and neither is set, so the live flag has no effect. The live service uses signed demo sessions.

## 4. Reference PDFs compared with the code

| # | Reference says | Code or live config says | Evidence |
|---|---|---|---|
| D1 | v2 PDF p. 4: "Cloud Translation: operator notes in other languages" | No Translation API call exists. Only static locale JSON and an error message mention translation. The runtime account holds `roles/cloudtranslate.user`, which is unused. | `grep -rn translat src`; R4 |
| D2 | v2 PDF p. 5: max 2 instances, live revision `momentum-v2be-7`, "16 commits on top of main", "only copy is this laptop" | Revision max 4 and service max 12 on `momentum-00023-yaz`. `main..v2` is 18 commits, and `v2` is pushed (`origin/v2` = `eb6eab9`). | R1, R2, R7 |
| D3 | v2 PDF p. 2: weather "10-minute cache to keep calls low" | True only for `/conditions/weather`. The condition guard's provider, used by `/jobs` and `/risk/*`, has no cache. | `index.mjs:1383`; `service-ports.js:461-463` |
| D4 | v2 PDF p. 3: the optimizer searched "about 17,000 setting combinations" (designs: "8,640") | The grid size depends on the entered values (2,160 to 17,280 before the three-change filter), and the response does not return it | `sql/optimize.sql:40-46`; C12 |
| D5 | v2 PDF p. 5 to-do: "Durable idempotency store and the Insights service show as off in status. Decide: switch on or hide" | Neither can be switched on. One is a hard-coded `false`, and the other has no live adapter (2.4). | `index.mjs:711,723`; `service-ports.js:407` |
| D6 | v2 PDF p. 4: Cloud Build "builds every release" | The build config builds and smoke-tests an image but does not build `web/` and does not deploy. `/app` assets come from an untracked local build, so "built from commit 7d9c2e5" cannot cover the React bundle. | `Dockerfile`; `.gitignore:29`; `ops/cloudbuild-private.yaml` |
| D7 | v2 PDF p. 2: Firebase sign-in "built, not switched on" | Correct, but the live env carries the unused `USTAAD_ENABLE_FIREBASE_AUTH` flag (3.2) | R1 |
| D8 | OM addendum WP04 asks for review handles, idempotency and leases checked across two instances and restarts; Master audit lists Firestore idempotency as an "optional baseline" | In v2, review handles, idempotency and traces are all process memory (M1 to M4). The Firestore idempotency adapter is unused. | Section 3 |
| D9 | OM addendum WP03: fail closed on an incomplete five-model prediction | Done for `/jobs` (blocks the JobSheet draft). `/risk/predict` alone still returns a partial result with `unavailableDefects` by design. | `job-coordinator.js:495-522`; `risk-prediction-service.js:270-278` |
| D10 | Master audit: "535 passed, 0 failed, 1 skipped" scoped Node tests; acceptance "315 passed, 1 skipped" | On `origin/v2`, Node 26.13.1: 75 files, 588 tests, 587 pass, 1 fail (`test/job-draft-persistence.test.js:508`), 0 cancelled; acceptance 317, 316 pass, 1 fail. On `arc/main` at `a4480ec`: 605 tests, 604 pass, 1 fail. The audit measured a different branch (Session 2 local), not v2. | R5, R6; `reviews/M0-review.md` |
| D11 | Node 22 container (addendum WP02) against brief's "Node 20" | `engines >=20.10.0`, image `node:22-slim` | `package.json`; `Dockerfile:1` |

## 5. Points for the technical design (not decisions)

These follow from the findings and belong in ADRs by the solutions and AI architects.

1. Durable state for M1 (reviews), M2 (idempotency) and M3/M4 (traces) in the existing Firestore `(default)` database. The idempotency adapter already exists and has tests. Wiring it and adding review and trace stores is code plus an ADR. No new service is needed.
2. Arc needs a new route and a tool registry over the existing service ports. `gemini-function-runner.js` is an unused starting point. Each Arc turn adds Gemini attempts against the shared counter in 1.7.
3. Check M5 (rate-limit key behind Cloud Run) with a read-only log query before any load rehearsal.
4. Put the live scaling, concurrency, affinity and flag set into a checked-in deploy command, and build `web/` inside the image build.
5. `/impact/summary`, `/fx` and `/conditions/weather` have no session guard. They are cheap, but Arc should not widen that set.
