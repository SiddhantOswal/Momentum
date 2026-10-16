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

The deployed application is [Momentum on Cloud Run](https://prepagent-26mwt2n7ba-el.a.run.app), service `prepagent`, region `asia-south1`. Cloud Run uses its runtime service identity to access Vertex AI Gemini, BigQuery / BigQuery ML, Cloud Storage and Firestore. A local machine needs its own authorized credentials; cloning the repository does not grant GCP access.

- Cloud Run maximum: two instances. Shared Gemini usage limit: 100 attempted calls per Asia/Kolkata day; failed or ambiguous attempts count.
- Existing project budget notification: ₹5,000. This is an alert, not a hard spending limit.
- Hackathon operator authorization uses the selected Approach B demo session. Firebase remains separate. The demo session does not assert independently verified human identity.
- Uploaded order inputs and writes remain restricted by the approved allowlist and TEST-only application rules.

## Model acceptance and evidence boundary

The model configuration is in [`config/model-acceptance.json`](../config/model-acceptance.json). It records unchanged thresholds: WARP 0.60, DELAM 0.60, STRENGTH 0.45, PRINT 0.60 and CRACK 0.30; model resource versions are 1. Om approved supervised-prototype acceptance despite original internal-split sample counts and exact membership being unrecoverable. The owner-approved exception is limited to supervised demonstration and does not certify autonomous use.

The supplementary, independently counted September 2026 holdout contains 219 lots. Its R² values are WARP 0.4021, DELAM 0.5003, STRENGTH 0.2971, PRINT 0.6102 and CRACK −0.0136; it clears only PRINT's original threshold. CRACK is disclosed as low confidence in monsoon. The configuration records the model versions, etags and read-only verification job IDs. Training history is modeled using the plant's real item master; it is not a set of measured factory outcomes. Thresholds and models have not been changed for this exception.

The September holdout summary and unrecoverable-count limitation are recorded in the acceptance configuration itself. Do not interpret modeled history, prediction or held-out estimates as observed factory performance or measured savings.

## Product boundaries

- Production conditions may be simulated or manually entered; physical sensor integration is not part of this prototype.
- Historical correlations are descriptive, not causal recommendations.
- Ten approved photos were previously classified; seven labels matched and three did not. This is not calibrated inspection accuracy.
- Impact figures are held-out simulation estimates, not measured factory outcomes; they are not annualized.
- Process-local PO review and trace state can be lost on instance changes. Persisted approved jobs and PDF cards are stored durably; no cross-instance exactly-once guarantee is claimed.
- Completed-lot learning is outside approved V1 scope because a verified outcome contract is not defined.

## Release and rollback

The public service URL above is the judging entry point. Cloud Run traffic, IAM and image provenance are managed in the project; this repository does not contain credentials. Before changing a release, inspect the current Cloud Run revision and traffic in project `prepagent-hack`, region `asia-south1`, and retain the known-good revision as rollback target. Do not infer the deployed source from a local Git HEAD alone.
