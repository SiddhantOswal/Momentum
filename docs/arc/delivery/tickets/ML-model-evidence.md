# ML model evidence

Added 2026-11-25 by Om's session. They answer the model findings of the 23 Nov independent audit (M01, M02, M06 and the five-target evaluation standard in `02_MODEL_RELEASE_AND_JUDGE_EVIDENCE.md` of that handoff) and close ARC-M0-05. Owner role in brackets. The models themselves (`prepagent.m2_*`, owner decision D4-2026-11-20-OM) are not retrained here.

### ARC-M0-05 Recover the lot generator (P1, closes the ticket in `M0-audit-and-plan.md`)
- Goal: `prepagent.lots` can be reproduced from the repository.
- AC: `generator.ts` and `impact.ts` from `sid_pack.zip` are stored under `tools/data/` with a README that names the seed (20261010), the assumptions, the inputs (`items.jsonl`), the outputs and the cost-per-kg setting. The README records that the live impact tables were built with ₹53.3 per kg (`prepagent.plants`) while the file says 45, and the stored file reads the price from one documented setting. A test runs the generator offline and checks that its `truth.jsonl` hash matches the recorded hash and that a fixed sample of lots matches stored values. Nothing from `docs/arc/reference/` is committed.
- Depends on: Om pointing to the file (done 2026-11-25: `~/Downloads/Google AI Builder Cup/sid_pack.zip`). Owner: data engineer.
- Test plan: the reproduction test; a deliberate change to the seed fails it.

### ARC-ML-01 Five-target evaluator (P0)
- Goal: one command scores any model set against an incumbent and a training-only naive reference on identical lots, and refuses bad evidence.
- AC: `node tools/ml/evaluate.mjs --labels <file> --predictions <file>...` reads lot-level labels and paired predictions (JSONL with pseudonymous lot IDs) and prints, per target: lot counts, R², MAE, RMSE, median and 90th-percentile absolute error, signed bias, and paired deltas against the incumbent and the naive reference with a lot-bootstrap 95% interval (fixed seed). It exits non-zero on missing labels, mismatched units, duplicate lot IDs, non-finite values, unpaired comparisons, or a zero-variance holdout for R². Every output row carries the model, dataset and split identifiers it was given. Output is JSON plus a short table. No cloud calls in the tool.
- Depends on: nothing. Owner: data engineer.
- Test plan: unit tests with small fixtures whose metrics are computed by hand; one test per refusal reason; a deliberately unpaired input fails.

### ARC-ML-02 Fresh generated holdout (P0)
- Goal: a holdout that played no part in choosing the m2_* models, because September 2026 informed the D4 decision.
- AC: the generator (ARC-M0-05) can emit lots for a later window (October and November 2026) with a separate documented seed, without changing the lots it already produced (the original `truth.jsonl` hash still matches). The holdout file is labelled `generated` in the data and in every report. A read-only BigQuery script scores it on `m2_*` and `m_*` (rows passed as query parameters, nothing written to BigQuery, a bytes cap on every job), and ARC-ML-01 produces the comparison. Results go to `docs/evidence/` with job IDs and bytes billed.
- Depends on: ARC-M0-05, ARC-ML-01. Owner: data engineer; the orchestrator runs the BigQuery step.
- Test plan: the generator test above; the evaluator run is recorded with its command and input hashes.

### ARC-ML-03 Per-target eligibility (P0)
- Goal: a target with too little skill cannot move a recommendation (audit M02).
- AC: `config/model-acceptance.json` gives each target a use class: `optimizer`, `advisory` or `abstain`, with a reason. Crack is `advisory` (R² 0.11). The optimizer objective and the impact batch use only `optimizer` targets; `advisory` targets are still predicted and shown with a low-confidence label; `abstain` targets are neither shown as a number nor used. The prediction and optimization responses list the use class per target, and the job card shows it. A test fails if an advisory target changes the chosen settings.
- Depends on: nothing. Owner: backend engineer with the data engineer for the SQL.
- Test plan: SQL text tests and service tests with a fixture where only the crack term differs between candidates.

### ARC-ML-04 Model version binding (P0)
- Goal: the service refuses to serve models that are not the accepted ones (audit M01).
- AC: at startup and every 10 minutes, the service reads each `m2_*` model's etag from the BigQuery models API (metadata only, no query cost) and compares it with `currentModelVersions` in `config/model-acceptance.json`. A mismatch or a read failure makes prediction and optimization return 503 `MODEL_VERSION_MISMATCH` or `MODEL_VERSION_UNVERIFIED`, and `/api/status` reports which target failed. The check is behind `USTAAD_ENFORCE_MODEL_VERSIONS` (exact "true"); off means today's behaviour.
- Depends on: nothing. Owner: backend engineer.
- Test plan: service tests with a fake models API for match, mismatch, read failure and recovery.

### ARC-REL-01 Ship every runtime config file (P0, found 2026-11-25)
- Goal: an image built from `arc/main` starts. `.dockerignore` and `tools/prepare-release-snapshot.py` list config files one by one and leave out `config/arc.json`, `config/arc-scope.json` and `config/arc-metrics.json`, which Arc modules import when the server loads.
- AC: both lists include every config file the server reads; a test scans `index.mjs` and `src/` for `config/*.json` references and fails if any is missing from either list; the server starts from a copy of only the files the Dockerfile would ship.
- Depends on: nothing. Owner: backend engineer.
- Test plan: the scan test; removing one entry fails it; a start-up test from the shipped file set.
