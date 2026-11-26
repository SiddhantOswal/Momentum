# 07 Backend contract index

Evidence: `index.mjs` routes on `arc/main@cb1338f` (grep of `app.get/post/put/use`), `src/arc/routes.js`, `docs/arc/delivery/06-arc-wire-contract.md` (503 lines; the detailed Arc contract, read it instead of duplicating it here). Branch differences: `dev` and `main` have the legacy routes only; `v2` adds `/api/live`, `/api/lots`, `/api/auth/session|logout|me|config`, `/evidence/diagnose-photo`, and serves `/app`; `arc/main` adds `/api/arc/*`, `PUT /lots/:lotId/conditions`, `GET /lots/:lotId`, `/api/auth/pitch-claim`, `/api/runs/*` durable traces, `/api/auth/demo-session` limits. Request/response schemas live in `src/schemas.js` and `src/state-schemas.js` (zod). Verification column: "unit" = a repo test exists (not individually re-run); "NOT RUN" = no live evidence.

| Area | Route | Method | Auth / guard | Verification | UI units |
|---|---|---|---|---|---|
| Status | `/api/status` | GET | public; SEC-2 will trim without session | unit | U01, U02, U06 |
| Auth | `/api/auth/demo-session`, `/pitch-claim`, `/session`, `/logout`, `/me`, `/config` | POST/GET | rate-limited; signed cookie | unit; live NOT RUN | U01 |
| PO | `/orders/extract` | POST | demo scope, synthetic allowlist (`index.mjs:248-272`) | unit | U03, U11 |
| Conditions | `/conditions/current`, `/conditions/weather`, `/fx` | GET | rate-limited | unit | U03 |
| Risk | `/risk/predict`, `/risk/optimize`, `/risk/similar-runs`, `/risk/explanation` | POST | rate-limited, Gemini budget on explanation | unit | U03, U04, U06 |
| Plan | `/jobs` | POST | `Idempotency-Key`; returns 503 outside demo without durable idempotency flag (M1-REPAIR-1) | unit; live NOT RUN | U03, U11 |
| Job | `/jobs/:id`, `/jobs/:id/card.pdf` | GET | session-scoped | unit | U03, U09, U11 |
| Approve | `/jobs/:id/approve` | POST | session-scoped; body must carry `reviewConfirmed` and `revisionFingerprint`; server guard behind `USTAAD_ENFORCE_APPROVE_GUARD` (off live) | unit; live NOT RUN | U03, U11 |
| Lots | `/lots/:lotId`, `/lots/:lotId/conditions` | GET/PUT | lot access check | unit; live Firestore NOT RUN | U03 |
| Feedback | `/jobs/:id/feedback` | POST | | unit | none (DR-012) |
| Evidence | `/evidence/approved-photos`, `/classify-photo`, `/diagnose-photo`, `/seen-before` | GET/POST | image checked by magic bytes and size (spec: JPEG/PNG/WebP, 8 MiB) | unit; live Gemini NOT RUN | U07, U13 |
| Insights | `/impact/summary`, `/insights/summary` | GET | `/insights/summary` has no live adapter | unit | U06 |
| Live | `/api/live`, `/api/lots` | GET | flag `USTAAD_ENABLE_LIVE_STORE`; SEC-4 will scope them | unit | U02 |
| Trace | `/api/runs/:id/events` | GET (SSE) | in-memory 30 min; durable store behind `USTAAD_ENABLE_DURABLE_TRACES` | unit | U05 |
| Arc | `/api/arc/session`, `/turns` (GET history, POST stream), `/turns/:clientTurnId`, `/runs/:taskRunId` | GET/POST | `USTAAD_ENABLE_ARC`; 404 `ARC_NOT_ENABLED` when off; no-store; query strings rejected | unit; live NOT RUN | U10 to U14 |
| Arc (planned, not built) | `/api/arc/runs/:id/events`, `/runs/:id/resume` | GET/POST | ticket ARC-M2-06 | n/a | U11 |
| Legacy mock | `/api/agents/*` (7 routes) | POST | offline only | unit | none |

## Feature-level contract owners
- Arc wire contract: `docs/arc/delivery/06-arc-wire-contract.md` (authoritative).
- State documents and Firestore collections: `docs/arc/delivery/04-technical-design.md` section 2; `src/state-schemas.js`.
- Gemini config, safety, thinking, tool config: `config/arc-models.json`, `docs/arc/delivery/05-ai-design.md`.
- Metrics: `config/arc-metrics.json`, `sql/arc/*.sql`.

## Contract drift procedure
On each incoming range, diff the files in `02b` section 6.4. Any route added, removed or reshaped updates this table and the `pages/` that cite it before merging.

## Known gaps
No OpenAPI document exists. Contract tests exist per route in `test/` but this audit did not map each test to each route (130 entries in `test/`). Do that mapping during U01 for the routes a unit touches.
