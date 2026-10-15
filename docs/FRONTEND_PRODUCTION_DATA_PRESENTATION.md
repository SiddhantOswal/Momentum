# Production data presentation — 15 October 2026

User clarification limits this follow-up to the UI; the existing BigQuery integrations and backend data contracts remain unchanged. No cloud data, security gate, model, environment setting or deployment was modified.

## Changes

- Removed the prototype data banner, PO1–PO5 sample picker and its sample-selection toast. Operators retain document upload, drag/drop, extraction, source review and all production workflows.
- Removed static demonstration/simulation wording from screen copy, chart labels, tooltips/accessible descriptions and confirmations. Predictions and estimates remain explicitly distinguished from observed outcomes.
- Added a shared response check before rendering or diagnostics. Responses explicitly marked as generated, simulated, preview, mock or test-only are rejected, including nested job/evidence/series metadata. Errors remain errors; no values are relabelled or substituted.
- Backend restrictions that mention sample fixtures use an operator-facing backend-policy error. Backend enforcement remains unchanged.
- Status diagnostics project backend flags and historical notes into concise operator language. Model metrics and acceptance limitations remain visible; unverified production provenance is stated directly. Exact backend status is unchanged at the API.
- Non-excluded BigQuery/Gemini responses still follow the existing request schemas, source checks, confirmation and approval gates.

The current Impact adapter explicitly marks its monthly series as simulated; that response now remains unavailable in the operator UI. The frontend cannot certify the provenance of unmarked historical records merely because BigQuery returned them. This change does not claim that every existing BigQuery row has become genuine factory data, and it does not enable real-order processing where the backend restricts it.

## Files

`src/operator-ui.js`, `src/ui/api.js`, `src/ui/workflow.js`, `src/ui/components.js`, `src/locales/en.json`, `test/app.test.js`, `test/frontend-contracts.test.js`, `test/browser/frontend.spec.js`, preservation matrix, delivery-report link, completion tracker and this note. Current screenshots and final logs are stored under `docs/evidence/frontend/`.

## Verification

- `npm test`: **475 passed, 0 failed, 0 skipped**.
- `npm run test:ui`: **13 passed** using isolated Chrome and localhost-only service fixtures. This is not live cloud acceptance.
- Checks include all four screens at 1440/1280/1024/768/390px, dialogs, notifications, diagnostic text, sample-picker absence, simulated-series exclusion, field preservation after rejected readings, existing risk/optimization/evidence requests, approval and PDF flows.
- The first browser pass caught an old model-acceptance note in status diagnostics. Its UI projection was corrected; the final full browser pass passes.
- Updated desktop New Lot was visually inspected. JavaScript syntax checks and `git diff --check` pass.

[Regression log](evidence/frontend/production-ui-regression.txt) · [Browser log](evidence/frontend/production-ui-browser.txt) · [Updated New Lot](evidence/frontend/new-lot-1440.png) · [Impact excluded-data state](evidence/frontend/impact-real-data-unavailable-1440.png).

No deployment or live cloud/model operation occurred. Unrelated working-tree changes remain preserved.
