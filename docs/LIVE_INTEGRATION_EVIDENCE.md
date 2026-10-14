# Live integration evidence

**Status: no fresh live integration verification was performed for this
execution.** The legacy JSON extraction endpoint was changed locally to fail
closed; this source change is not deployed.

| Integration / route | Current code evidence | Fresh live evidence in this execution |
|---|---|---|
| Health and status | `/health`, `/api/status` routes; local HTTP tests | None |
| PO extraction and catalog | Gated Storage/Vertex/catalog adapters; explicit local unavailable behavior | None |
| Current conditions | Parameterized BigQuery lookup, plant gate and provenance validation | None |
| Prediction | Parameterized `sql/predict.sql` adapter and offline contract tests | None |
| Optimization | Existing SQL/service adapter; objective semantics still disputed | None |
| Similar runs / explanation | Existing parameterized BigQuery/Vertex adapters and offline tests | None |
| JobSheet persistence | BigQuery repository and stored-job lifecycle adapters | None for complete `/jobs` run |
| Approval and job card | Existing persisted lifecycle/Storage card adapters | None for complete `/jobs` run |
| Dashboard proxy | No verified Om-owned BFF endpoint is recorded | None |
| Cloud Run deployment | Historical private service/revision metadata exists in config | None; no deployment, traffic, IAM, or resource mutation |

Historical manifest and tracker entries are intentionally not restated as
fresh success. Do not run a paid or persistent integration test without
operation-specific approval. Record the exact request boundary, timestamp,
revision/digest, source, status/error, and cleanup result for each future
authorized test. Never include identity tokens, credentials, customer
documents, or sensitive payloads in this evidence file.
