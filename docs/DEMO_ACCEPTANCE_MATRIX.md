# Demo acceptance matrix

Acceptance state reflects the latest recorded audit evidence, not a new live
cloud check. Offline fixtures and historical operations are not promoted to
live acceptance.

| Stage | Required judge-visible outcome | Evidence currently recorded | State / remaining gate |
|---|---|---|---|
| Startup and health | App starts on configured port; health responds | Local health/status was previously observed; startup is covered offline | Offline verified; current Cloud Run revision not freshly checked |
| PO extraction | Approved document fields extracted; no inferred data | Fixture-based tests; historical live extraction returned unavailable/503 | **Not accepted live**; approved PO and successful live extraction needed |
| Item matching | Catalog-backed resolved match with operator review | Offline review/catalog fakes and contracts | Offline only; current live adapter acceptance needed |
| Conditions | Genuine reading, source/time/provenance and explicit shift | Adapter/tests; sensor data previously absent | **Blocked** by genuine accepted reading and freshness policy |
| Prediction | Five defect metrics from accepted model version | Parameterized SQL adapter and offline tests; historical metrics include two below .6 R² | **Not accepted**; quality and live query acceptance open |
| Optimization | Approved baseline/objective, bounded changes and auditable savings | Adapter and offline tests; contract conflicts remain | **Blocked** by written owner decision and expected result |
| Similar runs | Bounded historical observations with source | Adapter and offline tests | Live accepted evidence not recorded |
| Explanation | Grounded in current model/evidence; causation caveat | Adapter and offline tests | Live accepted response not recorded |
| DRAFT creation | Durable persisted DRAFT with idempotent identity | Lifecycle tested offline; historical isolated live lifecycle does not prove `/jobs` end-to-end | **Not accepted end-to-end** |
| Retrieval and approval | Same persisted job retrieved, supervisor approves | Offline tests and historical isolated lifecycle evidence | Full current workflow not demonstrated |
| Job card | Card for same approved record is retrieved | Offline tests and historical isolated lifecycle evidence | Full current workflow not demonstrated |
| UI/API safety | No fake success, exposed credentials or public service | UI uses real same-origin routes; legacy JSON extraction now explicitly unavailable | Local code verified after focused test; deployment of that fix is not verified |
| Release | Clean source provenance, max two instances, private access, health/version | Historical config/build evidence; prior candidate was built from dirty source | **Not release-ready**; clean reproducible release and fresh verification needed |

Decision: **NOT READY for a live end-to-end judge demonstration or production
release.** A separate explicitly synthetic UI demo mode has not been
implemented; the existing fixture-based tests are not a replacement for it.
