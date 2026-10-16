# Ustaad AI — Corrugated Production Prep

Ustaad turns an approved purchase order into a reviewed production setup: Gemini extraction, catalog validation, confirmed conditions, five defect-risk models, constrained optimization, explanations, a JobSheet, operator approval and a stored PDF card. Historical evidence, photo diagnosis and Production Impact support the preparation workflow.

**Model acceptance (D4):** accepted for the supervised prototype under Om's and the project owner's explicit exception for unrecoverable internal evaluation counts/membership. Complete strict evidence is **not** claimed; the September holdout and CRACK limitations remain disclosed. The genuine private PO1 → prediction → optimization → approved stored card workflow was exercised on 16 October. The latest presentation revision also passed durable job/PDF read-back. Cross-instance PO review/replay remains a documented process-local limitation. See [release evidence and scope](docs/RELEASE_PROVENANCE.md).

## Run locally — no credentials or dummy metrics

Install **Node.js 22** (the `.nvmrc` records the major version), npm and Git.

```sh
git clone https://github.com/SiddhantOswal/UstaadAI---PrepAgent.git
cd UstaadAI---PrepAgent
npm ci
npm run preview:local
```

Open **http://localhost:4173**. New Lot, Defect Check and Impact are available for inspection. The ordinary preview explicitly disables mocks and paid cloud adapters. Empty KPI/chart placeholders show where results belong; unavailable integrations do not produce invented numbers. Stop with Ctrl+C. For another port:

```sh
USTAAD_LOCAL_PREVIEW_PORT=4175 npm run preview:local
```

The repository is private: cloning requires your own authorized GitHub account.

## Choose the right execution mode

| Mode | Command | What it does |
|---|---|---|
| Ordinary local preview | `npm run preview:local` | Current interface, no fabricated results, no cloud business calls |
| Explicit offline backup | `npm run demo:local` | Clearly labeled deterministic mock workflow, process-memory records, local PDF; **not cloud acceptance** |
| Configured development | `npm start` | Starts on port 8080 by default; uses explicitly supplied environment settings. Does not automatically read `.env` |
| Existing private Cloud Run | Authorized access to the deployed candidate | Genuine configured Google Cloud services, Approach B sessions and D4 gate |

For optional local environment settings, copy `.env.example` to `.env`, review it, then use `node --env-file=.env index.mjs`. Never commit credentials or a session-signing key.

## Cloud access is not inherited by cloning

The established deployment uses project `prepagent-hack`, region `asia-south1`, service `prepagent`, BigQuery dataset `prepagent`, the approved storage bucket and the existing Firestore counter. The app obtains Google access tokens through **Cloud Run workload identity**. A laptop does not have that metadata service; `gcloud auth login` alone does not turn the local Node process into the deployed runtime account.

Each collaborator needs their own authorized Google Cloud identity/access. Do not copy service-account keys, share identity tokens, bypass origin checks, enable APIs or grant IAM to make a clone appear functional. The existing deployment is private, and D4 remains fail-closed.

See [local development and private-cloud access](docs/LOCAL_DEVELOPMENT.md), [Approach B authorization](docs/HACKATHON_DEMO_AUTHORIZATION.md), and the [final genuine PO-to-card acceptance runbook](docs/FINAL_PO_TO_CARD_ACCEPTANCE.md). Firebase remains a separate production policy.

## Repository map

- `src/`, `index.mjs`: application, UI, adapters, security and lifecycle logic.
- `public/`: bundled frontend assets and explicitly approved input fixtures.
- `config/`: nonsecret runtime contracts and the D4 model-acceptance record.
- `sql/`: canonical tool/query contracts; proposed/training SQL is not run by startup.
- `assets/fonts/`: licensed PDF fonts required by the renderer; not unused assets.
- `test/`: unit, contract and browser regression coverage; not shipped in the image.
- `tools/`: opt-in development, validation and bounded administrative utilities.
- `ops/`: reviewed configuration and **proposals**, not permission to apply them.
- `docs/`: product usage, security/model runbooks and a small reviewed screenshot set. Start at the [judging/testing guide](docs/JUDGING_GUIDE.md) or [documentation index](docs/README.md).

The copies of approved purchase-order fixtures under `test/fixtures/` and `public/samples/` are intentional: tests and the served download/allowlist contract use their respective paths.

## Optional verification

These commands are for maintainers; installing or starting Ustaad does not invoke them automatically.

```sh
npm test
npm run test:acceptance
npx playwright install chromium
npm run test:ui
```

Browser output goes to ignored `test-results/`. To use an installed Chrome instead of Playwright Chromium, set `PLAYWRIGHT_CHANNEL=chrome`. Cloud administration tools find `gcloud` on PATH, or use an explicit `GCLOUD_BIN` path. Optional standalone publisher/Gemini tooling has its own lockfile: `npm ci --prefix tools`; it is not needed for the ordinary preview. Cloud operations remain opt-in and may be billable.

No README command deploys, changes IAM/traffic, runs model evaluation/training or makes the service public.
