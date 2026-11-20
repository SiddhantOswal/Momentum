# Repository guide

Momentum is a Cloud Run application for preparing corrugated production jobs. The root [README](../README.md) gives the product overview; this guide covers cloning, local use, test fixtures and verified operating boundaries.

## Local setup

Use Node.js 22 and npm. From an authorized clone:

```sh
npm ci
npm run preview:local
```

Open `http://localhost:4173`. This preview is for viewing the interface and empty states. It makes no paid provider calls and does not prove cloud integrations. For a deterministic offline walkthrough, run `npm run demo:local`; it uses labeled mock outputs and process-memory records, so its results are not live-cloud evidence. A local clone does not inherit Cloud Run identity or GCP permissions.

## Approved purchase-order fixtures

The application serves the approved demonstration inputs from [`public/samples`](../public/samples/). The matching test copies and expected extraction cases are in [`test/fixtures/synthetic_POs`](../test/fixtures/synthetic_POs/). Use these for the approved demo/test workflow; the server validates inputs against its allowlist.

| Fixture | Format | Purpose |
|---|---|---|
| [PO1](../public/samples/PO1_ClientA_single_B1047.pdf) | PDF | Single-line order |
| [PO2](../public/samples/PO2_ClientA_multiline.pdf) | PDF | Multi-line order |
| [PO3](../public/samples/PO3_ClientP_electronics_with_fitment.pdf) | PDF | Item with fitment details |
| [PO4](../public/samples/PO4_ClientQ_ambiguous_set.pdf) | PDF | Ambiguous order requiring review |
| [PO5](../public/samples/PO5_ClientB_scanned.jpg) | JPEG | Scanned order image |

## Maintainer checks

```sh
npm test
npm run test:acceptance
npm run test:ui
```

`npm test` is the full Node test suite, `test:acceptance` selects backend acceptance contracts, and `test:ui` runs Playwright browser checks. `npm run start` starts the server. `npm ci` uses the committed lockfile. Copy `.env.example` only when configuring a separately authorized environment; never commit credentials.

## Cloud architecture and safeguards

The deployed application is [Momentum on Cloud Run](https://momentum-ai.cloud.run/), a domain mapping to service `momentum` in region `asia-south1`. The original `prepagent` service serves the same build. Cloud Run uses its runtime service identity to access Vertex AI Gemini, BigQuery / BigQuery ML, Cloud Storage and Firestore. A local machine needs its own authorized credentials; cloning the repository does not grant GCP access.

- Cloud Run maximum: two instances. Shared Gemini usage limit: 100 attempted calls per Asia/Kolkata day; failed or ambiguous attempts count.
- Existing project budget notification: ₹5,000. This is an alert, not a hard spending limit.
- Hackathon operator authorization uses the selected Approach B demo session. Firebase remains separate. The demo session does not assert independently verified human identity.
- Uploaded order inputs and writes remain restricted by the approved allowlist and TEST-only application rules.

## Model acceptance and evidence boundary

The model configuration is in [`config/model-acceptance.json`](../config/model-acceptance.json).

**Current models (D4-2026-11-20-OM).** The app uses the `prepagent.m2_*` models: one boosted-tree model per defect, trained on lots before July 2026 with six engineered features built inside the model (humidity band, humidity × paper moisture, dew point, recycled paper, board weight, gum viscosity × roll temperature). Om accepted them on a clean September 2026 holdout of 219 lots that neither these models nor the models they replace had seen. September R²: WARP 0.468 (was 0.402), DELAM 0.519 (0.500), STRENGTH 0.388 (0.297), PRINT 0.640 (0.610), CRACK 0.108 (−0.014). The acceptance rule is that every model beats the model it replaces on the same counted rows and beats the mean (R² > 0). The DELAM and PRINT gains are within noise. The October internal-split thresholds (WARP 0.60, DELAM 0.60, STRENGTH 0.45, PRINT 0.60, CRACK 0.30) are kept as reference values only: these models were trained without an internal split, so they are not claimed. CRACK has little skill and is shown as low confidence, including in monsoon. Model versions are the BigQuery model etags. Details: [`docs/evidence/model-card-v2.md`](evidence/model-card-v2.md) and [`docs/evidence/model-candidates-v2.json`](evidence/model-candidates-v2.json).

**Previous models (D4-2026-10-16-OM, kept in the configuration as `previousAcceptance`).** The `prepagent.m_*` models were accepted against the thresholds above on an internal random split. Om approved supervised-prototype acceptance despite original internal-split sample counts and exact membership being unrecoverable. On the same September holdout they cleared only PRINT's threshold.

Both decisions are limited to supervised demonstration: every recommendation needs supervisor approval, values are shown as predicted or estimated, and neither certifies autonomous use. Training history is modelled on the plant's real item master; it is not a set of measured factory outcomes. Do not interpret modelled history, prediction or held-out estimates as observed factory performance or measured savings.

## Product boundaries

- Production conditions may be simulated or manually entered; physical sensor integration is not part of this prototype.
- Historical correlations are descriptive, not causal recommendations.
- Ten approved photos were previously classified; seven labels matched and three did not. This is not calibrated inspection accuracy.
- Impact figures are held-out simulation estimates, not measured factory outcomes; they are not annualized.
- Process-local PO review and trace state can be lost on instance changes. Persisted approved jobs and PDF cards are stored durably; no cross-instance exactly-once guarantee is claimed.
- Completed-lot learning is outside approved V1 scope because a verified outcome contract is not defined.

## Release and rollback

The public service URL above is the judging entry point. Cloud Run traffic, IAM and image provenance are managed in the project; this repository does not contain credentials. Before changing a release, inspect the current Cloud Run revision and traffic in project `prepagent-hack`, region `asia-south1`, and retain the known-good revision as rollback target. Do not infer the deployed source from a local Git HEAD alone.
