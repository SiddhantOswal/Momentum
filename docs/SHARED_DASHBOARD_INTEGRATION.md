# Shared public-folder dashboard integration — 15 October 2026

The owner subsequently selected the guided dashboard as the **only interface**. Start/restart the existing app with `npm run dev`, then open `http://localhost:8080/` (or the configured `PORT`). `/dashboard`, `/dashboard/`, `/dasboard` and `/dasboard/` redirect to `/`; query parameters and browser fragments are retained. Existing job-card and `/impact` bookmarks open the same application. No build step was added. This supersedes the initial two-interface integration.

## What was integrated

The incoming folder is `/Users/siddhant/prepagent-work/public`. Its HTML, CSS, application controller, API guesses, mock module, samples, README and separate Impact page were inspected. The incoming folder remains unchanged, with SHA256 evidence retained.

The single application adapts its useful three-stage layout—Order input, Production analysis, Job card & approval—plus its three-area navigation and manufacturing-stage presentation. Its sole template in `src/operator-ui.js` retains all operational markup and imports the same validated workflow controller through `src/ui/dashboard.js`. The old presentation, duplicate template wrapper and workspace-switch link have been removed. This preserves every existing input, form, button, ID, source-review reference, validation and approval boundary without maintaining competing API implementations.

The interface also gains explicit text markers for changed machine settings and an expandable nine-stage manufacturing table populated only from the stored job's returned recommended settings. Draft captions continue to require approval. No hardcoded plant defaults or unrecorded “standard” stage settings were adopted.

The supplied guessed transport was not copied: it sends incompatible risk/evidence/explanation/job/feedback requests, normalizes missing defect rates to zero, combines draft creation with approval, and contains a query-enabled mock mode. Supported workflows now use the verified contracts directly. See [the complete integration matrix](SHARED_DASHBOARD_CONTRACTS.md).

## Preserved boundaries

- `src/operator-ui.js` is the sole guided application template. `src/ui/workflow.js` and `src/ui/api.js` are byte-for-byte unchanged from the routing-task snapshots; authentication and business APIs are untouched.
- Server changes deliver the single dashboard, redirect its legacy aliases, serve CSS and explicitly allowlist the `dashboard.js` presentation module. No catch-all static server exposes the incoming folder or shadows API routes.
- No optimizer, model, schema, production calculation, persistence, security, confirmation, approval, billing or cloud setting changed.
- Existing authorization-mode disclosures and data-source rules remain authoritative in the application. The dashboard has no separate mock toggle.
- Backend-unsupported final-plan selection and kg-only feedback were not invented. The supported persisted recommendation and defect-rate/photo feedback remain available.
- No new dependency, cloud/provider request, storage write, production operation or deployment was performed. No commit or push was performed for this follow-up.

## File scope

Created: `src/ui/dashboard.js`, `public/dashboard.css`, `test/dashboard-ui.test.js`, `test/dashboard-http.test.js`, `test/browser/dashboard.spec.js`, these integration notes/matrix and `docs/evidence/shared-dashboard/`.

Replaced: `src/operator-ui.js` with the guided template. Removed: our temporary `src/dashboard-ui.js` wrapper. Created: `test/fixtures/dashboard-control-contract.json`.

Modified: `index.mjs` (presentation import/static routes/allowlist only), `src/operator-ui.css` (shared display styles only), `src/ui/fields.js` (manufacturing display metadata only), `src/ui/components.js` (changed labels and read-only stored-stage rendering). The completion tracker gains an implementation record. Existing browser tests now navigate the three-stage layout, preserving their original functional assertions. Root-page tests expect the single guided template and five functional panels. Browser screenshots are refreshed. All pre-existing unrelated work remains preserved.

## Verification

- `npm test`: **499 passed, 0 failed, 0 skipped**.
- `npm run test:ui -- --config=/private/tmp/ustaad-canonical-playwright.config.mjs`: **24 passed** (15 retained functional scenarios + 9 dashboard/routing scenarios). This temporary config only isolates localhost port 4193 and the artifact directory because another test process occupies 4182; all other browser/server settings are inherited unchanged.
- Real local HTTP verifies page/static isolation, ignored `mock=1`, signed HttpOnly/SameSite sessions, authorization denial and the unchanged `MODEL_ACCEPTANCE_REQUIRED` refusal. No real cloud adapters are enabled in this check.
- Browser scenarios verify extraction context, ambiguity/quantity/confirmation, exact risk/optimizer/evidence/explanation bodies, one persisted job request, real-event rendering, explicit approval/PDF, supported feedback, photo IDs, Impact/FX, stale-response protection and error recovery. Success service responses are test-harness fixtures and screenshots label them accordingly.
- Desktop/tablet/mobile checks at **1440, 1280, 1024, 768 and 390px** show no unintended page overflow. Desktop/mobile New Lot, job review and Impact screenshots were rendered and visually inspected.
- Structural tests retain every existing field, form, button and ID. A frozen control-contract fixture confirms exact preservation of the pre-promotion fields, forms, buttons and IDs. Snapshot comparison confirms the API client and workflow are unchanged; the index diff is limited to presentation routing.
- Syntax and `git diff --check` pass. Initial canonical browser checks found obsolete title/navigation expectations and a keyboard-test race with hash navigation; the assertions retain their coverage and wait for navigation focus before opening disclosures. Historical failed-attempt logs are retained.

Canonical routing evidence: [24 browser checks](evidence/shared-dashboard/canonical-browser.txt), [regression](evidence/shared-dashboard/canonical-regression.txt), [scope audit](evidence/shared-dashboard/canonical-integration-audit.json).

Initial integration evidence: [regression](evidence/shared-dashboard/regression.txt), [all browser tests](evidence/shared-dashboard/all-browser.txt), [final dashboard checks](evidence/shared-dashboard/dashboard-browser.txt), [local HTTP](evidence/shared-dashboard/http.txt), [scope audit](evidence/shared-dashboard/integration-audit.json), [incoming hashes](evidence/shared-dashboard/source-folder-sha256.json), [desktop](evidence/shared-dashboard/new-lot-1440.png), [mobile](evidence/shared-dashboard/new-lot-390.png), [draft stages](evidence/shared-dashboard/job-draft-settings-fixture-1440.png), [approved review](evidence/shared-dashboard/job-card-fixture-1440.png), [Impact](evidence/shared-dashboard/impact-fixture-1440.png).

## Acceptance limit

Frontend integration and local behavior are verified. A fresh live cloud PO-to-approved-card workflow is **not accepted**: the latest Stage B report still records incomplete model-acceptance evidence, and its provider allowance was exhausted. No model gate or allowance was bypassed to make the new dashboard appear successful. Existing private/public deployment boundaries remain unchanged.
