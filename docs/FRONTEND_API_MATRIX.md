# Frontend API matrix

Current local verification only. Default runtime is offline; configured ≠ connected and reachable ≠ downstream-ready. Tests do not call cloud models, storage, BigQuery or live FX. Browser success paths use explicit fixture interception outside the application.

| Endpoint | Usage / actual request | Actual response / limitations | Current availability and evidence |
|---|---|---|---|
| GET `/api/status` | Automatic once; manual refresh in status dialog | Mode, backendReachable, runtimeAvailability, integrations, modelAcceptance | Local real HTTP/browser verified; reports cloud gates disabled |
| GET `/api/auth/config` | Existing supervisor client startup | Firebase web config only when enabled | Real local HTTP; unconfigured state verified. No Google account session started |
| POST `/orders/extract` | Multipart file + operator orderId, paperType, paperSupplier | Extracted metadata, lines/candidates/missing fields, review UUID/fingerprint | Real validation/unavailable tests; browser fixture review. Live extraction not called |
| GET `/conditions/current?shift=` | Explicit operator action | RunConditions + source/reading identity/time/age/stale provenance | Real HTTP validation, service tests, browser fixture. No physical-sensor claim |
| POST `/risk/predict` | Four order fields + four conditions + conditionsConfirmed + all 7 levers | Five rates, total kg/cost/currency/primary defect and model acceptance | Real HTTP auth/gates; strict payload unit tests + browser fixture. Real ML not called |
| POST `/risk/optimize` | Full OrderProfile + RunConditions + confirmed + 7 planned levers | Planned baseline, best, changes, predicted savings, notes | Real HTTP auth/gates + service/unit/browser fixtures; optimizer unchanged |
| POST `/risk/similar-runs` | Full order/conditions | Up to five historical runs, settings, outcomes, notes | HTTP validation + adapter tests + browser fixture; no live query |
| POST `/risk/explanation` | Schema-projected prediction and optimization + order/conditions/evidence | Explanation, model attribution rows and evidence references | HTTP validation + adapter tests + strict browser request assertion. Presentation-only planBaselineLabel excluded from strict request |
| POST `/jobs` | Multipart source file/context/review/confirmed line, conditions, confirmation and 7 levers; idempotency header | Durable stored JobSheet and real runId when supplied | Server blocked by current model/identity/runtime gates; existing offline composition and fixture browser path pass |
| GET `/api/runs/:runId/events` | Authenticated same-origin fetch SSE | Existing typed tool/run events; process-local run registry | Existing route tests and browser fixture stream; events only after backend provides runId |
| GET `/jobs/:id` | User-entered or creation-returned ID | Persisted jobSheet | HTTP fail-closed + repository/recovery tests + browser fixture; no current live read |
| POST `/jobs/:id/approve?lang=en&currency=` | Explicit review dialog | Approved jobSheet/card URI if server authorizes | Server identity/model/DRAFT gates retained; browser fixture confirms no request before dialog confirmation |
| GET `/jobs/:id/card.pdf?lang=en&currency=` | Loaded approved sheet | Stored PDF | HTTP/card service tests + browser fixture blob/open link; no storage call |
| POST `/job-sheets/render.pdf?lang=en` | Supplied complete JobSheet JSON | Locally rendered PDF or structured validation | Actual local renderer route and unit tests; browser utility interaction fixture |
| POST `/jobs/:id/feedback` | Observed optional rates, optional existing photo URI, lot ID, note | Persisted feedback result or structured error | HTTP/association/write guard tests and browser fixture; no live feedback write |
| POST `/evidence/seen-before` | Defect enum + ambientRhPct | Count, average rate/cost, good/bad aggregate settings, notes | HTTP/adapter tests + browser fixture; no live query. No image endpoint exists |
| GET `/impact/summary` | Explicit Load impact | Validated kpis, monthly, seasonal, anonymized topItems, held-out counterfactual; direct/cache source | Real offline unavailable and validator/service tests; browser fixture chart/FX/failed-refresh checks |
| GET `/fx?base=` | Display conversion only; shared frontend cache by base | Base, rates, date, source; existing dated fallback semantics | Existing FX/currency unit tests + browser intercepted rates. No live FX request performed |
| GET `/insights/summary?from=&to=` | No previous operator entry point; not added | Existing backend historical insight contract | Preserved unchanged; existing route tests. Impact does not impersonate this endpoint |

New static delivery only: `/ui/:filename` (explicit module allowlist), three `/fonts/plex-*.woff2`, `/vendor/chart.umd.js`, five exact `/samples/:filename` fixtures. `/impact` serves a same-origin redirect/fallback to `/#screen-impact`. No API business contract, cloud gate, secret or authorization rule changed.

Other preserved routes: `GET /health` returns runtime health for local startup checks; the legacy `POST /api/agents/extractOrder`, `/getConditions`, `/predictRisk`, `/optimizeLevers`, `/findSimilarRuns`, `/explainRisk`, and `/generateJobSheet` are retained unchanged and deliberately unused by this UI. Their availability stays governed by existing demo/live fail-closed rules. Static compatibility routes `/display-currency.js`, `/localization.js`, `/locales/*`, `/money-contracts.js`, `/risk-ui.js`, `/impact-ui.js`, and `/supervisor-auth-client.js` remain in place.
