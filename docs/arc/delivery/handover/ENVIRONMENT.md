# The live environment (read-only inventory, 2026-11-24)

Names only; no secret values. Read with `gcloud`, `bq` and `gsutil` list and describe calls on 2026-11-24 from an account with access to the project. Re-check anything you rely on before a change.

## Project and region

Google Cloud project `prepagent-hack` (display name in the portals: "prepagent"; the product is named Momentum). Region `asia-south1` for Cloud Run, Firestore, Artifact Registry and the Gemini models in use. Times: the Gemini daily counters reset at midnight IST (02:30 Singapore time); the pitch is on 4 December SGT.

## Cloud Run

| Service | URL | Notes |
|---|---|---|
| `momentum` | https://momentum-26mwt2n7ba-el.a.run.app | The product. 100% of traffic on revision `momentum-00023-yaz` (tag `arc-limits`): max 4 instances, session affinity on, 1 CPU, 1 GiB, Gemini attempt cap 300 a day. Older revisions kept with tags (`demo`, `domain`, `polish`, `r2fix`, `v2be`, `welcome`); rollback target `momentum-v2be-8`. Change records: `docs/arc/delivery/changes/2026-11-22-momentum-limits.md`. |
| `prepagent` | https://prepagent-26mwt2n7ba-el.a.run.app | An older service people may still open. Left on and unchanged (decision F1). Its Gemini cap is 100. |

Image repository: Artifact Registry `asia-south1-docker.pkg.dev/prepagent-hack/prepagent/prepagent` (repository `prepagent`). Runtime service account: `prepagent-run@prepagent-hack.iam.gserviceaccount.com` (it holds project-wide `storage.objectAdmin`, `bigquery.dataEditor` and `datastore.user`; narrowing them is ARC-M8 work, M1 gate SEC-10). Public invoker is on today (closed in Phase B, ARC-M11-01).

Plain environment variables on `momentum` (names): `USTAAD_ENABLE_APPROVAL_AUDIT`, `USTAAD_SYNTHETIC_ONLY`, `USTAAD_ENABLE_FIRESTORE_GEMINI_CAP`, `USTAAD_ENABLE_LIVE_MODEL_CALLS`, `USTAAD_ENABLE_RISK_PREDICTION`, `USTAAD_ENABLE_HISTORICAL_EVIDENCE`, `USTAAD_ENABLE_IMPACT_SUMMARY`, `USTAAD_ENABLE_BIGQUERY_WRITES`, `USTAAD_ENABLE_JOB_STORAGE`, `USTAAD_ENABLE_FEEDBACK_WRITES`, `PROJECT_ID`, `REGION`, `VERTEX_LOCATION`, `GEMINI_MODEL`, `BUCKET`, `USTAAD_PLANT_ID`, and more (read them with `gcloud run services describe momentum --region asia-south1 --format=json`). Secrets are mounted from Secret Manager.

**None of the Arc and M1 feature flags are set on the live revision**, so none of the M1 protections or Arc routes are active there yet: `USTAAD_ENABLE_ARC`, `USTAAD_ENABLE_ARC_METRICS`, `USTAAD_ENABLE_FIRESTORE_IDEMPOTENCY`, `USTAAD_ENABLE_DURABLE_PO_REVIEWS`, `USTAAD_ENABLE_DURABLE_TRACES`, `USTAAD_GEMINI_BUDGET_POLICY=budget-v2` with `GEMINI_BUDGET_LIMITS` (JSON), `USTAAD_ENABLE_LOT_REVISIONS`, `USTAAD_ENFORCE_APPROVE_GUARD`, `USTAAD_ENABLE_CONDITION_PROVENANCE`, and the secret `ARC_PITCH_RESERVE_CODE`. They are turned on in the release candidate revision (ARC-M8-01, ARC-M8-05), tested on a tagged no-traffic revision first. Flag semantics and the exact values are in the code (`grep -rn "USTAAD_" index.mjs src`) and the tickets.

## Secret Manager

Existing: `momentum-weather-api-key`, `ustaad-hackathon-session-signing`. To create (ARC-M1-17): `arc-pitch-reserve-code`, mounted as `ARC_PITCH_RESERVE_CODE`, with `secretAccessor` for the runtime service account on that one secret only; generate 32 random bytes without printing them; disable after 5 December.

## BigQuery (dataset `prepagent`)

Tables: `lots` (modeled history, partitioned by `run_date`, generator `sid_pack.zip` seed 20261010 not in the repository), `items` (the 117-item catalog), `plants`, `job_sheets`, `feedback`, `impact_lots`, `impact_lots_v2`, `impact_recs`, `impact_recs_v2`, `sensor_readings` (partitioned by `ts`; one simulated row only), `sensor_readings_error_records`. Models: `m2_warp`, `m2_delam`, `m2_strength`, `m2_print`, `m2_crack` (boosted-tree regressors trained 20 November, current R² 0.468, 0.519, 0.388, 0.640, 0.108) and the older `m_*` models they replace (still referenced by some fixtures, ARC-M1-16). Never alter or delete existing data; add new tables, views or columns beside it (`CLAUDE.md` section 6). Query cost caps: 50 MiB per Arc metric query, 100 MiB for the optimizer.

## Firestore

Database `(default)`, `asia-south1`, native mode. Existing: `gemini_daily_usage` (the shared Gemini counter, left in place). Added by the Arc work: `po_reviews`, `idempotency`, `traces` with `trace_events`, `budget_counters`, `lot_heads`, `lot_revisions`, `arc_sessions` with `turns`, `arc_task_runs` and related collections, each with a TTL policy on `expiresAt` (13 policies, all ACTIVE on 2026-11-24; record `changes/2026-11-23-firestore-ttl-policies.md`).

## Other

Cloud Storage: `prepagent-hack-data` (approved photos, job card PDFs, data), `prepagent-hack_cloudbuild`. Pub/Sub: topic `sensor-readings` (feeds BigQuery `sensor_readings`; the stream is simulated and labelled so). Vertex AI: models `gemini-3.5-flash` and `gemini-3.5-flash-lite`, region `asia-south1`; settings in `config/arc-models.json` and `config/gcp-vertex-ai.json`; prices in `config/gemini-prices.json`. Weather: the Google Maps Platform Weather API for Pune, key in Secret Manager, labelled "public weather record, not a plant sensor".

## Budget

₹10,000 of 25,000 in credits (F2): daily rupee caps ₹600 (`momentum`) and ₹200 (eval pool), attempt limits alongside, 80-attempt pitch reserve for 4 December SGT, eval day limit 900 attempts. A billing budget of ₹10,000 with alerts at 50, 90 and 100 percent is created in ARC-M8-02.

## Running locally

`npm ci`, `npm start` (the app; demo mode flags are in the README and `.env.example`; local demo mode is for development only and is never a product path), `npm test`, `npm --prefix web run build`, `PLAYWRIGHT_CHANNEL=chrome npm run test:ui`. The app serves the built `web/` at `/app`.
