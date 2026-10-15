# Ustaad AI frontend rebuild — delivery report

Latest UI-only follow-up: [production data presentation](FRONTEND_PRODUCTION_DATA_PRESENTATION.md). Sample controls and banners were removed at user request; explicitly generated responses are excluded. Existing BigQuery integrations remain unchanged.

Latest follow-up: [minimal interface refinement](FRONTEND_MINIMAL_REFINEMENT.md) records the streamlined layout, exact control preservation and current 470 regression / 12 browser checks. Screenshots were refreshed. The original rebuild evidence below remains historical.

15 October 2026 · local application checkout `prepagent` · branch `main` · existing HEAD `274a941`. Changes remain uncommitted. This report covers the frontend work; substantial unrelated pre-existing backend and test changes were preserved.

## A. Implementation summary

The previous presentation layer has been replaced with a new product layout, component styling and modular browser implementation. The application stays buildless: semantic server-generated HTML, JavaScript ES modules, CSS, same-origin APIs and local assets.

- **New Lot:** source upload/drop, exact approved synthetic PO1–PO5 samples, extracted multiline review, ambiguity/unknown-code handling, catalog specification, operator context, conditions/provenance, seven planned levers, explicit confirmations and prerequisite-gated planning.
- **Agent Run:** actual trace events, predicted defect distribution, planned/recommended settings and outcome comparisons, explanations/attribution, similar historical runs, independent what-if scoring, persisted job review, supervisor approval dialog and approved PDF retrieval. Full order, planned settings and predicted risks are accessible in the stored-job review. The separate supplied-JSON PDF utility remains available.
- **Defect Check:** real defect-and-humidity evidence contract with counts, good/bad historical group averages and operator notes; observed feedback for a persisted job. Photo classification is explicitly unavailable because no endpoint exists.
- **Impact:** validated held-out synthetic estimates, historical charts and tables, source/coverage information, display currency conversion, and honest unavailable/malformed/empty states. `/impact` now opens this unified workspace.

Existing request and approval boundaries remain server-authoritative. The extracted workflow controller preserves review fingerprints, source-line binding, idempotency, strict risk payload projection, authentication integration, event identity validation, persistence and approval gates. Improvements include stale extraction/analysis/evidence/scenario protection, planned-setting confirmation, input-change invalidation, strict explanation payload projection and response validation. No frontend default silently sets production values.

## B. Design system and Arc UI decision

IBM Plex Sans is self-hosted with its OFL notice. Graphite surfaces use restrained monsoon blue (`#86bdd4`) and kraft (`#c8a57c`), tabular numbers, semantic feedback colors, 4–64px spacing tokens, 5–12px radii and mostly 180ms transitions. Layout uses dividers and comparison rows rather than repeated dashboard cards. Reduced-motion preferences disable movement and chart animation.

Native controls provide labels, keyboard operation and focus. Native dialogs provide focus containment, Escape and focus return. Asynchronous status uses polite live regions. Charts have explicit units, zero-origin quantitative axes and accessible data tables. Critical provenance does not rely on tooltips or color alone.

Arc's official documentation, catalog, licensing and button source were reviewed. It requires React 19/TypeScript and Motion; its source was not copied into this vanilla application. Original native equivalents follow the relevant interaction principles. No React, Tailwind, Vite, Next.js, build step or animation framework was added. Chart.js 4.4.8 is a pinned local runtime asset; Playwright 1.58.2 is development-only. See [Arc research](ARC_UI_RESEARCH.md).

## C. Files changed by this task

**Replaced / modified presentation and delivery files**

- `src/operator-ui.js` — new application shell and four product areas.
- `src/operator-ui.css` — complete new tokens, components, motion and responsive styles.
- `src/localization.js` — imports only the supported English locale, correcting browser startup 404s; existing fallback semantics preserved.
- `src/locales/en.json` — accurate trace-disconnection recovery wording.
- `public/impact.html` — unified-workspace redirect and accessible fallback.
- `index.mjs` — additive allowlisted frontend-module/font/chart/sample delivery only. Existing backend work remains untouched.
- `package.json`, `package-lock.json` — pinned development-only Playwright dependency and `test:ui` command; existing dependencies preserved.
- `test/app.test.js`, `test/impact-ui.test.js` — presentation assertions updated for the replacement architecture. Existing API behavior tests remain; obsolete sidebar/inline-script checks are replaced by module contracts and real browser interaction tests.
- `docs/PART2_COMPLETION_TRACKER.md` — appended frontend implementation/verification record; no product acceptance gate promoted.

**Created modules and tests**

- `src/ui/fields.js` — shared field metadata and units.
- `src/ui/api.js` — same-origin request boundary and latest-request gate.
- `src/ui/contracts.js` — finite, source-compatible display validation.
- `src/ui/components.js` — native shell/dialogs, risk/comparison/evidence/job rendering and Chart.js lifecycle.
- `src/ui/currency-display.js` — display-only money conversion with dated provenance, daily per-base caching and stale-response protection.
- `src/ui/workflow.js` — preserved and integrated workflow controller, separate from page composition.
- `playwright.config.js`, `test/browser/frontend.spec.js`, `test/frontend-contracts.test.js`.

**Created local assets**

- `public/fonts/plex-regular.woff2`, `plex-medium.woff2`, `plex-semibold.woff2`, `OFL.txt`.
- `public/vendor/chart.umd.js`, `CHART-LICENSE.md`.
- `public/samples/PO1_ClientA_single_B1047.pdf`, `PO2_ClientA_multiline.pdf`, `PO3_ClientP_electronics_with_fitment.pdf`, `PO4_ClientQ_ambiguous_set.pdf`, `PO5_ClientB_scanned.jpg`. Their bytes are tested against the pre-existing backend allowlist.

**Created documentation and evidence**

- This report, [preservation matrix](FRONTEND_PRESERVATION_MATRIX.md), [API matrix](FRONTEND_API_MATRIX.md), [Arc research](ARC_UI_RESEARCH.md).
- `docs/evidence/frontend/` contains the final screenshots and verification logs described below.

**Removed files:** none. Presentation files were replaced in place. No unrelated work was reset or deleted. Original presentation/delivery snapshots are retained in `/private/tmp/ustaad-frontend-before` for this session.

## D. Functional preservation

The [feature-preservation matrix](FRONTEND_PRESERVATION_MATRIX.md) maps every previous operator capability and newly exposed supported evidence capability to its new location, purpose, endpoint/schema, validation, required human action, error behavior and regression coverage. Navigation keeps form state in the current page; reload recovery uses the existing persisted-job retrieval contract rather than invented local job persistence.

The three required Blueprint stages remain: order/context in New Lot, production analysis in Agent Run, and job review/approval/printing within Agent Run. The four proposed destinations coexist with that workflow.

## E. API integration

The [API matrix](FRONTEND_API_MATRIX.md) records each endpoint, actual request and response, availability and verification level. Application API calls remain same-origin. Firebase supervisor authentication and backend authorization are preserved. Reachability is explicitly separate from downstream configuration and connectivity.

`POST /jobs` is synchronous in the current contract. While waiting, the UI shows an honest indeterminate request state. It connects to the actual trace only once a real run ID is returned; replayed server events are not presented as fabricated live progress.

## F. Testing evidence

| Command / check | Final result |
|---|---|
| Pre-rebuild `npm test` with localhost permission | 451 passed, 0 failed |
| `npm test` on final source | **468 passed, 0 failed, 0 skipped** |
| `npm run test:acceptance`, run separately | **247 passed, 0 failed, 0 skipped** |
| `node --test test/frontend-contracts.test.js` | **6 passed**; included in full suite |
| `npm run test:ui` | **11 passed, 0 failed** |
| JavaScript syntax / package JSON parsing | 45 syntax checks passed; both package manifests parse |
| `git diff --check` | Passed |

The first sandboxed baseline could not reach its localhost servers and failed 34 HTTP tests; the permitted baseline passed completely. Intermediate browser runs exposed and corrected disabled-locale imports, a re-extraction stale-review window, misleading post-draft status copy, a strict explanation-body mismatch, FX table markup and control-border contrast. Final results supersede those intermediate failures.

No test was weakened to accept fake production output. Browser success responses are intercepted fixtures in the test harness, never a production mock mode. Existing service, auth, persistence, idempotency, model, calculation and PDF tests continue to run. Local/offline tests do not establish current cloud-service acceptance.

## G. Browser verification

An isolated headless Chrome launched from the project terminal performed actual rendering and interaction checks. The native/embedded connectors were unavailable; this separate test browser used a temporary profile and blocked external requests.

**Viewports:** 1440, 1280, 1024, 768 and 390px. All four areas were checked for page overflow at each width. Loaded recommendation/job layouts were also checked at 1280/1024/768/390. Data tables scroll within labelled regions where needed.

**11 scenarios:** offline startup/navigation; file validation/sample selection; dialogs/Escape/focus return; unknown/ambiguous/missing-quantity review and confirmation; multipart/idempotency/trace/draft/approval/PDF/feedback; direct risk and stale what-if; Impact charts/FX/malformed refresh; defect evidence and hostile-note text; reduced motion/label association/control contrast/skip link; conditions provenance and late extraction; strict optimizer/evidence/explanation payloads; separate local PDF utility. Several checks are grouped within one scenario.

Final passing scenarios assert no unexpected browser console/page errors on startup and the major success paths. Expected unavailable services are represented in the UI. Screenshots were rendered and inspected; successful service fixtures are prominently labelled **OFFLINE BROWSER TEST · injected service fixtures**.

- [New Lot · desktop](evidence/frontend/new-lot-1440.png)
- [New Lot · tablet](evidence/frontend/new-lot-768.png)
- [New Lot · narrow viewport](evidence/frontend/new-lot-390.png)
- [Agent Run · fixture desktop](evidence/frontend/agent-run-fixture-1440.png)
- [Agent Run · fixture tablet](evidence/frontend/agent-run-fixture-768.png)
- [Defect Check · fixture](evidence/frontend/defect-fixture-1440.png)
- [Impact · unavailable](evidence/frontend/impact-unavailable-1440.png)
- [Impact · fixture](evidence/frontend/impact-fixture-1440.png)

Final browser run: **11/11 passed** in 47.7 seconds. Saved logs: [regression](evidence/frontend/regression.txt), [acceptance](evidence/frontend/acceptance.txt), [browser](evidence/frontend/browser.txt), [frontend contracts](evidence/frontend/contracts.txt). The temporary local preview and test browsers were stopped after verification.

This is browser interaction and visual QA, not a formal WCAG certification or a fresh cloud E2E test.

## H. Outstanding blockers and boundaries

- **Optimizer:** later written Om D2 resolves the prototype baseline to supervisor-planned settings and plan-relative penalties. The frontend displays the existing contract without rewriting SQL. The historical Blueprint fixed-reference contract differs; no claim is made that the original Blueprint acceptance contract has been met.
- **Model acceptance:** the repository records prototype threshold compliance, but complete version-linked evaluation/sample-count/provenance evidence remains blocked. Strength/Crack remain below the Blueprint's 0.6 threshold. Server gates are preserved.
- **PO1 confirmation:** no genuine PO1 operator-confirmed machine record was created. Fixture values are test inputs only. Current requests require all seven planned levers; the UI does not silently supply plant defaults.
- **Cloud / E2E:** no current model call, BigQuery query/write, Storage operation, real supervisor login, approval persistence or full cloud order-to-card run was performed. Offline passing tests do not prove those services ready.
- **Photos:** no classification/upload route exists. Historical evidence works with selected defect and humidity; photo references in feedback do not diagnose images.
- **Other product gaps:** feedback-to-completed-lot learning and unsupported rejection are not invented. English-only submission follows the current supported-language contract. Distributed state and production sensor integration remain separate work.

## I. Deployment status

**No deployment performed.** No GCP billing, project configuration, IAM, traffic, secrets, production data or resources were changed. No chargeable cloud/model operation was invoked. Local source and tests are reviewable and uncommitted.

Start locally with `npm start` or `npm run dev` from the application directory. No build step is required. Run `npm test`, `npm run test:acceptance`, and `npm run test:ui` separately. The browser suite uses installed Chrome and explicit offline service fixtures.

## J. Acceptance assessment

| Milestone | Assessment |
|---|---|
| Frontend implementation | **Complete for verified existing contracts** |
| Frontend behavior | **Offline automated and rendered-browser verified** |
| Backend integration | Same-origin contracts and offline service/HTTP tests verified; **fresh real cloud integration not verified** |
| Full order-to-approved-card E2E | Fixture/offline verified; **live acceptance remains unverified** |
| Production readiness | **Not accepted**; frontend completion does not remove model, cloud, data and operational acceptance gates |
