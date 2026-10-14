# Om dependency register — reconciled 15 Oct 2026

`docs/OM_DECISIONS.md` is authoritative for the hackathon prototype. A resolved
decision is not evidence that a live adapter, cloud resource, or acceptance
workflow has been exercised. Tests with fixtures and test doubles are local
contract evidence only.

| Decision | Owner decision | Repository status | Remaining evidence / action |
|---|---|---|---|
| D1 Public judging deployment | Public Cloud Run for judging, max 2 instances, per-IP limiter, daily Gemini cap, budget alert, synthetic/anonymized data, prototype disclaimer, then private/delete after 7 Nov. | No deployment in this pass. Existing manifest records private service and service max 2; per-IP limiter exists. | Daily Gemini cap is not implemented and Om has not specified a numeric cap. Confirm cap, budget alert state, exact source/revision provenance, and rollback steps before separate deployment. |
| D2 Optimizer contract | Plan-relative baseline; 7 lever grids; at most 3 changes; approved linear slower-production allowances; deterministic tie-break; whole-rupee row values; savings versus rounded plan; show kg, INR and percent; exact no-improvement and missing-item/plant messages. | `sql/optimize.sql` encodes the plan baseline, all approved candidate grids and penalties, <=3 changes, stable tie ordering, rounded cost/savings, and explicit BigQuery ASSERT messages. Adapter verifies row count, baseline, change count, and predicted savings; returns exact no-improvement message or a qualified predicted-savings note. UI exposes predicted kg, INR and baseline-relative percentage. | Locally contract-tested only. SQL syntax, approved PKBX0041 output and ASSERT behavior remain unverified against BigQuery. |
| D3 PLANT-01 configuration | INR; ₹53.30/kg paper cost; approved standards 42/168/MED/40/MED/6/55; prototype ranges. | Blank plan levers are filled from those standards and response/UI label identifies the standard baseline; BigQuery contract uses the approved ₹53.30/kg basis. | No live plant-row read or optimizer query was run; verify configured plant row and candidate results during bounded live acceptance. |
| D4 Models | R² thresholds WARP .6, DELAM .6, PRINT .6, STRENGTH .45, CRACK .30; grouped evaluation/retraining deferred. | Config and summary distinguish prototype thresholds met from complete version-linked acceptance evidence. Real-model acceptance remains fail-closed. Historical aggregate R² values are not version-linked. | Current model versions, evaluation provenance/sample counts where available, and persisted feature-importance review evidence are absent. No live evaluation or model mutation performed. |
| D5 Conditions | Only simulated readings; visibly label them, supervisor confirms/edits before prediction; show stale age over 24 h; manual values allowed without readings; no fabricated rows. | UI requires condition confirmation, exposes manual entry when no reading exists, labels simulated readings and displays age/stale notice over 24 h. Job preparation requires explicit confirmation and accepts validated manual conditions without a sensor adapter. No missing reading is synthesized. | Local tests cover the code path. No BigQuery sensor read occurred; supervisor interaction and real deployed UI behavior remain unverified. |
| D6 State/idempotency | BigQuery `prepagent.job_sheets`; process-local trace/idempotency/rate limit; max 2 instances; Firestore/distributed rate limit deferred. | Runtime no longer requires Firestore. Drafts require configured persistence and process-local idempotency; BigQuery draft/approval/card writes are restricted to `TEST-` orders; transitions require DRAFT and repository read-back. | Live persistence, read-back and two-instance behavior not exercised. Process-local state is intentionally not cross-instance durable; supervisor identity/authorization is not implemented as an authenticated principal. |
| D7 Feedback/photos | Consent and 12-photo set approved; folder label `crushed` → STRENGTH, `good` → NONE; classify each once; writes only for `TEST-`; blur logos in public video. | Folder labels map all six visible folders (`crack`, `crushed`, `delam`, `good`, `print`, `warp`); feedback writes now fail closed unless the persisted order starts `TEST-`. A read-only listing of the approved bucket prefix found 10 image objects, not the 12 stated in Om's decision. No classification or write attempted. | Owner must supply/locate the 2 missing approved images or confirm the expected set is 10 before classifying once. Learning-lot write path is not implemented. Blur logos in video. |
| D8 Language/currency | English UI only; no glossary; stored INR; conversion is display-only, approximate, and dated. | API/UI locale list now exposes English only. Existing converter shows `≈`, rate, and date; job-card storage defaults to INR. | Verify end-to-end that display conversion cannot be persisted into order/job data. |
| D9 Impact | Same-origin dashboard and `GET /impact/summary` from four `dash_*.sql` files; estimates on held-out simulation, not factory outcomes. | Same-origin `/impact` serves `public/impact.html`; endpoint exists and runs the four SQL adapters; unavailable state does not show sample figures. Summary series is labeled simulated. | SQL covers monthly history through Sep 2026, seasonal history, top items Oct 2025–Sep 2026, and held-out Sep KPIs. SID notes say do not annualize; the SQL comment says annual = month × 12. We follow the explicit SID/D9 held-out-month-only framing and document the stale SQL comment; no annual figure is shown. |
| D10 Cloud authority | Bounded prepagent reads/queries/predictions/explanations; TEST-only writes; Gemini Flash and scoped GCS writes; deployment subject to D1. | No cloud operation exercised in this implementation pass. | Any future cloud run must remain within the exact D10 scope; public deployment is not part of this pass. |
| D11 Manufacturing stages | Printing, single facer, sheet cutting, pasting, drying/conditioning, cutting/creasing, slotting, stitching/gluing, QC/bundling. | Job-card PDF renderer uses the approved order; a local PDF text assertion verifies the sequence. | No live generated card was stored or retrieved; Cloud Storage card read-back remains unverified. |

## PO fixture inputs

The approved synthetic fixtures and `expected_results.json` are copied under
`docs/synthetic_POs/`. Local review tests assert each fixture's PO metadata,
line values, ambiguity, unknown-code, and missing-quantity behavior through an
isolated extraction/catalog test double. Passing these tests does **not** prove
Gemini extraction against the PDFs or a live catalog lookup.

## Public deployment guardrail snapshot

| Guardrail | Evidence/status |
|---|---|
| Per-IP limiter | Implemented in `src/request-guardrails.js`; not load-tested here. |
| Daily Gemini cap | Not implemented; numeric cap is an owner input. |
| Synthetic/anonymized-only | D1 prototype decision; fixture files are labeled synthetic. An endpoint-level synthetic-only enforcement gate is not proven; no public deployment. |
| Prototype disclaimer | Visible on the local landing screen and covered by app tests; public deployed route not checked. |
| Maximum instances | Manifest records service max 2; no setting changed in this pass; 1-instance video setting and deployed revision metadata must be checked before deployment. |
| Budget alert | Configuration/status not verified in this pass. |
| Source/revision provenance | Existing cloud records cite dirty-worktree builds; current source/revision pairing is not reproducible or clean-pinned. |
| Rollback/containment | D1 says revert to private or delete after 7 Nov; exact deploy/rollback commands and owner runbook are not in this repo. |

A read-only object listing of `gs://prepagent-hack-data/photos/photos/` was
performed under D10; it returned 10 images. No BigQuery query, ML prediction or
explanation, Gemini call, upload, cloud write, or deployment was run. The local
tests use synthetic files and isolated adapters.
