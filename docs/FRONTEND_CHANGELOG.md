# Frontend implementation and verification record

## 87. Complete frontend replacement and local browser verification — 2026-10-15

**IMPLEMENTED / OFFLINE TESTED.** The old presentation is replaced by a new
buildless HTML/CSS/ES-module application with four destinations: New Lot,
Agent Run, Defect Check and Impact. The required order → production analysis
→ persisted JobSheet → supervisor approval → stored PDF workflow remains
accessible. Backend schemas, authentication, model/optimizer gates, persistence,
cloud configuration and business calculations were not changed by this task.
Static-file handling gained explicit allowlists for frontend modules, fonts,
Chart.js and the five exact approved synthetic PO fixtures.

The new workflow retains review IDs/fingerprints, exact source-line binding,
operator confirmation, seven planned levers, idempotency, authenticated SSE,
model-grounded explanations, similar runs, independent what-if scoring, stored
job retrieval/approval/card printing, observed feedback, the local supplied-sheet
PDF utility, currency conversion and runtime diagnostics. The frontend adds
stale-response protection and explicit planned-setting confirmation. It fixes
a browser startup issue caused by imports of disabled locale URLs, and removes
a presentation-only optimizer field from the strict explanation request body.

IBM Plex Sans and Chart.js are locally bundled with licence notices. Arc UI's
official documentation, licence and button source were researched; its
React/TypeScript/Motion source was not adopted. Native accessible equivalents
preserve the repository's no-build-step architecture. Details are in
`docs/ARC_UI_RESEARCH.md`.

Verification performed sequentially where test servers share port 4100:

- Permitted pre-rebuild baseline: `npm test` — **451 passed**. The initial
  sandboxed attempt could not reach its localhost servers; it is not counted
  as application regression evidence.
- Final `npm test` — **468 passed, 0 failed, 0 skipped**.
- Final `npm run test:acceptance` — **247 passed, 0 failed, 0 skipped**.
- `node --test test/frontend-contracts.test.js` — **6 passed**, also included
  in the full suite.
- Final `npm run test:ui` — **11 passed**, using isolated headless Chrome,
  localhost-only networking and explicit test-harness fixtures for successful
  service responses. No application mock production mode was introduced.
- Browser checks cover all four areas at 1440/1280/1024/768/390px, loaded job
  layouts, forms, errors, ambiguity/quantity, source invalidation, actual-event
  trace rendering, strict payloads, idempotency, approval dialog, PDF links,
  feedback, stale what-if, Impact charts and FX, evidence escaping, reduced
  motion, label association, focus/skip-link behavior and control contrast.
- Screenshots were captured and visually inspected. Fixture screenshots are
  prominently labelled offline test evidence. Final logs/screenshots are in
  `docs/evidence/frontend/`. JavaScript syntax (45 checks), manifest parsing
  and `git diff --check` passed. Local preview/test processes were stopped.

The complete delivery report, file inventory, functional-preservation matrix,
API matrix, source limitations and acceptance assessment are in
`docs/FRONTEND_REBUILD_REPORT.md`, `docs/FRONTEND_PRESERVATION_MATRIX.md`, and
`docs/FRONTEND_API_MATRIX.md`.

**NOT LIVE VERIFIED / NOT PRODUCTION ACCEPTED.** Om's later written D2
resolves the prototype planned-baseline contract, but the frontend does not
rewrite the optimizer or bypass incomplete model acceptance. Genuine PO1
operator-confirmed settings were not fabricated. Photo classification/upload
has no route; supported defect/humidity evidence is exposed honestly. Full
current cloud order-to-approved-card acceptance remains unverified. No model
call, cloud query/write, sensor publish, billing/IAM/secret/configuration
change, deployment or traffic operation occurred. No official task acceptance
percentage is promoted by this local frontend result. Existing unrelated
uncommitted work remains preserved.


## 88. Minimal frontend refinement with full control preservation — 2026-10-15

**IMPLEMENTED / OFFLINE TESTED.** Reduced heading size, repeated copy and visual density across the four areas. Production setup, supporting evidence, what-if controls, secondary Impact metrics and stored-job details use accessible progressive disclosure. Source confirmation opens production setup; relevant errors reveal their section. Draft conditions and recommended settings remain visible for review.

Comparison with the pre-refinement HTML retains all **84 controls, 8 forms and 207 original IDs**, including input contracts and request bindings. No backend API, business calculation, confirmation, approval gate or persistence rule changed.

`npm test`: **470 passed, 0 failed, 0 skipped**. `npm run test:ui`: **12 passed**, including keyboard disclosure operation and values preserved across navigation. Browser checks cover 1440/1280/1024/768/390px. Refreshed screenshots and logs are under `docs/evidence/frontend/`; details are in `docs/FRONTEND_MINIMAL_REFINEMENT.md`.

**NOT LIVE VERIFIED / NOT PRODUCTION ACCEPTED.** Service-success scenarios remain explicitly labelled offline fixtures. Existing backend acceptance limitations remain. No cloud/model operation or deployment occurred; unrelated working-tree changes were preserved.


## 89. Production-focused UI data presentation — 2026-10-15

**IMPLEMENTED / OFFLINE TESTED.** At the user’s explicit UI-only request, removed the demonstration banner, synthetic PO picker and its toast, and static simulation wording. Existing BigQuery integrations, backend data, fixture/security allowlists and API contracts remain unchanged. Shared UI response validation now excludes explicitly generated/simulated/mock/test-only payloads before data or diagnostics render. Current Impact series with a simulated marker remains unavailable rather than being relabelled. Stored readings retain source/age distinctions; rejected readings do not populate fields.

Status diagnostics present concise operator language while retaining model metrics, backend-policy restrictions and unverified production provenance. This does not certify unmarked BigQuery records as real factory history or enable backend-restricted real-order processing.

Final `npm test`: **475 passed, 0 failed, 0 skipped**. Final `npm run test:ui`: **13 passed**. The first browser pass identified one legacy model note in status diagnostics; that projection was corrected and the complete browser suite rerun successfully. Screens, notifications, responsive layouts, exclusion states and preserved production workflows were checked. Evidence and details: `docs/FRONTEND_PRODUCTION_DATA_PRESENTATION.md` and `docs/evidence/frontend/production-ui-*.txt`.

No cloud operation or deployment occurred. No live-service or production acceptance milestone is promoted.
