# D4 evidence ingestion — offline validation, explicit installation

**Status (16 Oct 2026):** neither bundle kind below can be completed for the current version-1 models. HISTORICAL needs the internal-split members, which BigQuery deleted; NEW_EVALUATION is the September 2026 holdout, where warp, delam, strength and crack fall below their bars. The source config is instead accepted for the supervised prototype by owner decision D4-2026-10-16-OM (`ownerDecision` in `config/model-acceptance.json`, evidence in [docs/d4](d4/D4_MODEL_ACCEPTANCE_REPORT.md)). This procedure remains the route for any future model version. It never retrains or evaluates a model. Approach B governs application participants; Om's model review is a separate project decision, not a visitor-granted privilege.

## Required reviewed model evidence

For **each version1** resource below, supply the genuinely evaluated feature/label rows or immutable membership archive, actual sample count, original source identity/snapshot or reproducible source query/window, evaluation/training job and SQL, actual metric artifact, and review of that version's feature evidence:

| BigQuery resource | Vertex resource / version | Minimum R² |
|---|---|---:|
|`prepagent-hack.prepagent.m_warp`|`projects/514663464609/locations/asia-south1/models/prepagent_warp`,1|0.60|
|`prepagent-hack.prepagent.m_delam`|`projects/514663464609/locations/asia-south1/models/prepagent_delam`,1|0.60|
|`prepagent-hack.prepagent.m_strength`|`projects/514663464609/locations/asia-south1/models/prepagent_strength`,1|0.45|
|`prepagent-hack.prepagent.m_print`|`projects/514663464609/locations/asia-south1/models/prepagent_print`,1|0.60|
|`prepagent-hack.prepagent.m_crack`|`projects/514663464609/locations/asia-south1/models/prepagent_crack`,1|0.30|

Refresh these identities/etags before installation; do not assume version1 forever. Keep recovered training IDs, saved SQL, metrics, split-table references and explanations in the private evidence archive; raw evaluation records are not distributed in this product repository. The missing part is actual membership/count/provenance and the precise feature-review binding, not numerical threshold approval.

Anonymous training splits may omit lot IDs and dates. Genuine frozen feature-row membership is supported; do not manufacture discarded identifiers or row dates. The source snapshot/query provenance and evaluation date remain mandatory. Historical evidence cannot be replaced with a newly computed metric under the historical label.

## Bundle contract

Use a private JSON file≤16MiB. This normalization format is an ingestion contract, not a claim that Google emits it directly. Preserve original raw artifacts; Codex/operator can normalize them without inventing values.

Top-level fields:

- `schemaVersion:1`, `evidenceKind:"HISTORICAL"|"NEW_EVALUATION"`, `evaluationId`, actual `evaluatedAt` ISO timestamp and `splitId`.
- `source`: exact `dataset`, immutable `identity`, inclusive source `from`/`through` dates supported by provenance, original source `query` and its SHA256, `rowIdentity:"lot-id"|"feature-row"`, and actual `rows`.
- Each source row: stable `id`, full actual `values`, `rowSha256`. For lot-ID archives, `values.lot_id===id`, `values.run_date===runDate`, and `runDate` must be within the source window. Historical feature-row archives may omit discarded lot IDs/dates; stable unique occurrence identities must identify rows within the frozen archive. No inference of sample counts from split fractions.
- Exactly five `models`, one per defect, containing `defect`, `resource` (`prepagent.m_*`), `modelVersion`, `modelEtag`, actual `sampleCount`, exact member-ID array `members`, actual `r2`, `evaluatedAt`, raw successful `evaluationJob` metadata (including statistics start/end milliseconds) and `querySha256` of its exact SQL.
- Per-model `evaluatedAt` is the actual job-completion timestamp, matching its `statistics.endTime`, and cannot predate the current model creation. This rejects stale timestamps without inventing an age threshold.

Historical model entries additionally contain raw saved `evaluatedModel` metadata and exact `evaluationDataset` split-table identity. Metrics/split references must agree with independently read current model metadata.
- New evaluation entries contain raw BigQuery `evaluationResult` (`schema.fields` and `rows`; metric column `r2_score`). Every model must use the entire archived source population and the same `source.asOf` timestamp parameter. Its SQL and source SQL must match the six reviewed prepared files exactly.
- Each model has an owner `featureReview`: `reviewer`, actual `reviewedAt`, `decision:"APPROVE_PROTOTYPE"`, matching `modelEtag`, `featureEvidenceSha256` and `membershipSha256`. This binds review to the exact current global explanation and evaluated member array. No software-created reviewer/approval is acceptable.

Hash rules: SQL hashes use SHA256 of exact UTF-8 SQL bytes. Object/array and row hashes use exported `evidenceDigest(value)`, SHA256 of `JSON.stringify(value)`; preserve the archived ordering. Feature hash input is the exact current last training run's `modelLevelGlobalExplanation`. The member hash input is its exact member-ID array. An operator may compute these hashes for Om to review; computing a hash is not Om's approval.

Every evaluated member must contain all saved model features and a finite actual training label. The label comes from `trainingOptions.inputLabelColumns`, not the output column's `predicted_` name. Source values remain private; the tool's report omits row contents.

## Capture current metadata, then validate

Capture actual `bq show --model --format=prettyjson prepagent-hack:prepagent.m_*` results for all five models. Store either an array of raw model records or the recorded `CLOUD_READBACK.json`/`POSTFLIGHT.json` format with `records`, `purpose:"current model m_*"`, `exitCode:0`, `result`.

```sh
node tools/validate-model-evidence.mjs \
  --bundle /PRIVATE/OWNER_APPROVED_BUNDLE.json \
  --metadata /PRIVATE/FRESH_CURRENT_MODELS.json \
  --output /PRIVATE/NEW_VALIDATION_REPORT.json
```

The output path must not exist. The tool never modifies configuration or calls cloud APIs. Exit0 means `CONSISTENT_NOT_INSTALLED`; exit1 means BLOCKED; exit2 means invalid file/arguments/output. Distinct errors identify unverified evidence/jobs/metrics versus an observed metric below threshold. Missing count, wrong model/version/etag, duplicate/missing models, source/member mismatch, absent review or future review fails closed.

**The tool proves internal consistency, not authenticity of arbitrary supplied files.** A trusted operator must compare raw artifacts with actual cloud job/model observations and Om's reviewed source. A local fabricated test bundle is not production evidence, even if internally consistent. Repository tests clearly label such doubles.

## Explicit installation after genuine approval

1. Record Om's actual review/approval reference and the validated bundle hash.
2. Refresh five current model metadata records. Revalidate; stop on any changed etag/version or missing permission. Do not escalate access.
3. Review `acceptanceCandidate` in the successful report against the original artifacts. It includes real sample counts, model identities and evidence digest; it is not active configuration.
4. Back up the exact current `config/model-acceptance.json` outside Git, mode0600, create-only. Record its SHA256 and preserve historical data/notes.
5. Make a narrow source edit merging the validated candidate into that config. Keep `recordedEvaluation` as historical evidence; clearly prefix obsolete notes as historical. Do not overwrite unrelated edits or change thresholds. There is deliberately no public activation endpoint or automatic install switch.
6. Run model-evidence, model-acceptance, prediction/optimizer, session/audit tests and the complete acceptance/full/browser suites. Verify `getModelAcceptanceSummary` reports the accepted record's actual metrics/date/split.
7. Generate a **new** source snapshot, build/deploy only with release authorization, then verify the actual private candidate status and fresh model metadata. Editing a local file does not update Cloud Run.
8. Execute [FINAL_PO_TO_CARD_ACCEPTANCE.md](FINAL_PO_TO_CARD_ACCEPTANCE.md) with fresh bounded call authorization and genuine participant confirmations.

The six files in `ops/evaluation-proposed/` are retained because the offline validator loads them to verify the exact SQL contract for `NEW_EVALUATION` bundles. Their presence does not authorize execution. A fresh evaluation requires a separately reviewed population, byte/cost caps, immutable source archive and owner approval; historical data must never be fabricated from a new run. Newly generated results must be labeled `NEW_EVALUATION`; lower metrics remain failures.
