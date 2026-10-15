> Final consolidation: six proposed queries remain **unapproved and unexecuted**, including no server dry runs. The offline historical/fresh ingestion validator and version/member/review checks are documented in [D4_EVIDENCE_INGESTION.md](D4_EVIDENCE_INGESTION.md). Genuine evidence and owner review are still mandatory.

# Optional new evaluation — approval proposal, not executed

15 October 2026. This is an alternative only if Om cannot recover the historical evaluation membership/counts. It is **new evidence**, never a reconstruction of the original random split. Approval must cover both this evaluation population and its bounded queries. Current thresholds and fail-closed gates remain unchanged.

## Exact proposed scope

- Existing project `prepagent-hack`, dataset `prepagent`, location `asia-south1`; existing five `m_warp`, `m_delam`, `m_strength`, `m_print`, `m_crack` resources. No training, replacement model, cloud table, API, database, IAM change or Gemini call.
- Proposed population: all existing synthetic `prepagent.lots` rows with `run_date >= DATE '2026-09-01' AND run_date < DATE '2026-10-01' AND NOT STARTS_WITH(lot_id, 'TEST-')`. September is the documented held-out month; using it for new acceptance consumes that holdout for this assessment. It must not be represented as the original within-training 20% split.
- Choose and record one server-side `source_as_of` TIMESTAMP immediately before execution. Every source query uses `FROM prepagent.lots FOR SYSTEM_TIME AS OF @source_as_of`. Verify source table supports that timestamp; stop if unavailable. Time travel expires, so archive the exact input rows locally, not just a query string.
- First job reads **all** proposed source rows, ordered by `lot_id`, with all input/label values, without LIMIT/sampling. Store the actual response in a permission-restricted evidence file, SHA256 it, record membership IDs, actual count, min/max dates and source-table metadata. Stop on empty population, duplicate lot IDs, malformed schema/labels or archive exceeding10MiB; do not silently filter, downsample or fill outcomes. Keep row data out of public outputs.
- Next five jobs each call `ML.EVALUATE` on one existing model and the same time-travel population. Project exactly the model's saved `featureColumns` plus its saved label, checked against recovered training SQL. Do not use `SELECT *` to silently introduce additional outcomes/features. Explicit supplied input is required; `ML.EVALUATE(MODEL ...)` without input would report saved historical metrics instead.
- Read exact model etags, creation/last-modified times and linked Vertex version IDs before and after; stop if any change. BigQuery SQL addresses a model resource, not an invented `@1` SQL suffix. Link accepted evidence to observed unchanged model metadata and each actual evaluation job ID.
- Record actual R², input membership/count, query hash, source archive hash, source timestamp/window, job ID, start/end times and billed bytes for each model. Retain all returned regression metrics. Om reviews the exact version-specific feature evidence and records reviewer/date/artifact; a software-generated Boolean is not that review.
- Require Warp/Delam/Print R²≥0.60, Strength≥0.45, Crack≥0.30. A failed model remains blocked; no threshold changes, retraining or automatic alternative population.

## Exact prepared SQL, still not authorized or executed

The six files under `ops/evaluation-proposed/` are now generated from the actual saved model metadata and cross-checked against the original training SQL:

- `source_rows.sql`: exact membership, source features and five labels for the private local archive.
- `m_warp.sql`, `m_delam.sql`, `m_strength.sql`, `m_print.sql`, `m_crack.sql`: each projects the model's29 saved input features and its actual training label into `ML.EVALUATE`.

The actual input label comes from `trainingOptions.inputLabelColumns`, checked against the original CREATE MODEL SQL; it is not guessed from prediction-output label names. Model etags, Vertex versions, feature lists, query hashes and byte ceilings are recorded in `docs/evidence/p0-reconciliation-20261015/EVALUATION_PREPARATION.json`.

All six require the same `@source_as_of` parameter selected and recorded immediately before an authorized execution. First re-read metadata: the prepared etags must still match. These are SELECT-only statements; no server-side syntax validation or dry run has occurred because new evaluation remains unapproved.

After explicit approval, the command shape for each final reviewed file is:

```sh
bq query --project_id=prepagent-hack --location=asia-south1 \
  --use_legacy_sql=false --dry_run \
  --maximum_bytes_billed=52428800 \
  --parameter=source_as_of:TIMESTAMP:REVIEWED_SOURCE_TIMESTAMP \
  < ops/evaluation-proposed/m_warp.sql
```

Use the installed SDK path, the one recorded timestamp and a unique job ID. Only after valid bounded dry runs, execute each approved job once without `--dry_run`, capture JSON output privately, and independently retrieve job metadata. Do not paste placeholder parameters or automatically retry. Source archival must complete and pass membership/label checks before the five actual evaluation jobs. No command above has been run.

## Cost, preflight and rollback

Proposed maximum: **six executed jobs**, each `maximum_bytes_billed=52428800` (50MiB); aggregate ceiling300MiB. No automatic retries or additional feature queries. Dry-run all final statements after authorization, inspect regional billing mode/prices, and stop if any estimate is unknown or exceeds its bound. Capture metadata through read-only GETs. Do not reuse the already-consumed optimizer retry approval.

At the public reference evaluation rate of US$6.25/TiB,300MiB is approximately US$0.0018 before tax/credits. This is an illustrative reference calculation, not a verified Mumbai invoice price; verify the applicable regional SKU before execution and stop if the defensible estimate exceeds US$1. Existing free allowance or promotional credit is not assumed. [Official BigQuery pricing](https://cloud.google.com/bigquery/pricing). [Explicit-input ML.EVALUATE contract](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/bigqueryml-syntax-evaluate).

Read-only evaluation does not mutate cloud source/models and needs no new runtime role or resource. Cancellation stops outstanding query jobs but cannot refund completed work. Keep evidence; do not update acceptance config until all criteria and owner review pass. No deployment or live application calls are included.

## Approval required

Owner/Om must approve: (1) the September frozen population and its acceptance interpretation, (2) six capped source/evaluation jobs and regional cost preflight, and (3) the review artifact. Historical evidence remains the first choice. This proposal is not authority to execute.
