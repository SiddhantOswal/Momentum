# Local development and cloud access

## Prerequisites

- Git and an authorized GitHub account for this private repository.
- Node.js 22 and npm. Use `.nvmrc` with your version manager if available.
- No Google Cloud credentials for the ordinary local UI preview.

From a fresh clone, run `npm ci`, then `npm run preview:local`. Open http://localhost:4173. The preview launcher disables mock and cloud adapters explicitly. It does not show sample KPI values. Impact exposes a labeled empty workspace and reports missing integration configuration. All cloud-dependent actions fail closed rather than creating local substitutes.

The default port can be changed with `USTAAD_LOCAL_PREVIEW_PORT`. The existing opt-in `npm run demo:local` is a separate, visibly labeled mock backup; it does not prove Gemini, BigQuery, Firestore or GCS connectivity. Do not use it when reviewing real-data behavior.

## Environment files

`npm start` does not load `.env` automatically. With Node 22:

```sh
cp .env.example .env
node --env-file=.env index.mjs
```

Keep `.env` local. The checked-in example contains only disabled flags and a port. Project/bucket IDs are nonsecret configuration; tokens, keys, identity cookies and raw cloud evidence are not repository configuration. Never set `K_SERVICE` on a laptop to impersonate Cloud Run.

## Genuine Google Cloud execution

The runtime adapters use the Cloud Run metadata token service. A laptop ADC login is not a substitute for that service. Existing project resources do not grant access to a new collaborator, and source code does not contain production credentials.

Current public application:

https://prepagent-26mwt2n7ba-el.a.run.app

Revision `prepagent-momentum-v1` is publicly invokable. Open this URL directly; no Google infrastructure login or local proxy is needed. Approach B issues a temporary signed demo session at the deployed origin; ownership, TEST-only and same-origin checks remain enforced. This does not establish a verified human identity. Historical tagged URLs are retired.

Public application access does not grant GCP administration, direct database/storage access or repository access. Cloud resource administration still requires separately authorized Google credentials. Do not disable Origin/session protections to make a localhost proxy behave like the deployed application.

No collaborator should receive new IAM automatically. Use the approved runtime account, shared 100-attempt IST Gemini counter and existing TEST/fixture restrictions. Model-dependent operations run only on a revision whose config records accepted D4 (the source now records owner decision D4-2026-10-16-OM). See `FINAL_PO_TO_CARD_ACCEPTANCE.md` and `D4_EVIDENCE_INGESTION.md`.

## Build and maintenance

The Dockerfile pins a Node 22 base image and installs the exact production lockfile. For an optional local image build, `docker build -t momentum:local .` uses the existing Docker context; this document does not claim a new image was built. `ops/cloudbuild-private.yaml` and `tools/prepare-release-snapshot.py` prepare controlled builds, not automatic cloud deployment.

Run optional maintainers' tests as listed in the root README. Playwright uses its installed Chromium by default; `PLAYWRIGHT_CHANNEL=chrome` selects local Chrome. Results are ignored. Administrative utilities resolve `gcloud` from PATH or `GCLOUD_BIN`, not another developer's home directory.

Raw operational evidence stays outside the tracked source. `docs/evidence/README.md` describes the curated subset. Internal construction notes and raw journals are not shipped with the product repository. Their absence from a fresh clone is not a missing application dependency.
