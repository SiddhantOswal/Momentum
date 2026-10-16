# Local development and existing private-cloud access

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

Current known private candidate:

`https://premium-analytics-v1---prepagent-26mwt2n7ba-el.a.run.app`

It is revision `prepagent-premium-analytics-v2`, built before the latest local empty-state change. Bare browser navigation without an authorized Cloud Run invocation credential may return 403. That is expected for a private service.

The official authenticated proxy can expose private **read-only pages** locally for an already approved invoker:

```sh
gcloud auth login
gcloud run services proxy prepagent --project=prepagent-hack --region=asia-south1 --tag=premium-analytics-v1 --port=4174
```

Open http://127.0.0.1:4174. This is the deployed Cloud Run application through a proxy, not a local application using fake cloud services. The proxy was checked for HTML access. **It is not a complete operator-login workaround**: the existing same-origin protection rejects localhost-origin session/mutation requests (observed 403 `ORIGIN_REQUIRED`). Do not disable that protection or rewrite the application security policy. Full privileged browser operations require the approved deployed-origin authorization/access mechanism; release access remains controlled separately.

No collaborator should receive new IAM automatically. Use the approved runtime account, shared 100-attempt IST Gemini counter and existing TEST/fixture restrictions. D4 must be accepted legitimately before model-dependent operations can run. See `FINAL_PO_TO_CARD_ACCEPTANCE.md` and `D4_EVIDENCE_INGESTION.md`.

## Build and maintenance

The Dockerfile pins a Node 22 base image and installs the exact production lockfile. For an optional local image build, `docker build -t ustaad:local .` uses the existing Docker context; this document does not claim a new image was built. `ops/cloudbuild-private.yaml` and `tools/prepare-release-snapshot.py` prepare controlled builds, not automatic cloud deployment.

Run optional maintainers' tests as listed in the root README. Playwright uses its installed Chromium by default; `PLAYWRIGHT_CHANNEL=chrome` selects local Chrome. Results are ignored. Administrative utilities resolve `gcloud` from PATH or `GCLOUD_BIN`, not another developer's home directory.

Raw operational evidence stays outside the tracked source. `docs/evidence/README.md` describes the curated subset. Existing reports retain historical evidence identifiers; a missing private raw journal in a fresh clone is not a missing application dependency.
