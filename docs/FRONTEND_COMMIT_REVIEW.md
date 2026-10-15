# Frontend-only commit review — 15 October 2026

The candidate was assembled on committed HEAD `274a9416d6ab1d5695fa36f8181940545c91099e`, independently of unrelated uncommitted backend work.

## Scope

Presentation templates, CSS, browser modules, local fonts/Chart.js and licence notices, browser tests, frontend assertions and frontend documentation are included. Shared files were staged by content rather than by whole-file addition:

- `index.mjs`: only explicit allowlisted static routes for UI modules/assets/documents.
- `package.json` and lockfile: only the Playwright development dependency, its dependency closure and browser-test script.
- `test/app.test.js`: replacement presentation test and Impact redirect assertions; all committed backend tests remain unchanged.
- `test/impact-ui.test.js`: only presentation architecture assertions; pre-existing pending data-contract edits remain unstaged.
- The authoritative completion tracker remains untracked; only the frontend's own appended entries are copied into `FRONTEND_CHANGELOG.md`.

No backend business service, optimizer, model, schema, security, authentication, persistence, approval, SQL, configuration or cloud file is included. Pending Firebase dependencies and integration modules remain outside the commit. The UI loads the optional existing supervisor adapter only when advertised by that server. Risk/optimization requests follow the server-delivered projection while retaining mandatory operator confirmation.

The intentional UI behavior change remains: responses explicitly marked simulated/mock/test-only are excluded instead of relabelled. This can leave Impact or conditions unavailable when their backend data has those markers. No actual record or backend source was changed.

## Independent verification

- Unchanged HEAD: **405 tests, 399 passed, 6 failed**.
- Frontend-only candidate: **414 tests, 408 passed, the same 6 failed**. Failure names match exactly; **zero new regression failures**.
- Candidate browser suite: **13 passed** against the committed backend, using isolated Chrome and explicit offline fixtures. All four screens, responsive layouts, confirmation, strict requests, stale results, evidence, approval/PDF, diagnostics and keyboard access were checked.
- The keyboard test now explicitly focuses the document before pressing Tab, avoiding a platform-dependent starting point. Request tests validate the actual committed schema; the UI supports both the committed and pending confirmation projections.
- The earlier full working checkout passed 475 tests. A later recheck while unrelated backend edits/tests were being added had 479/484 passing with five HTTP failures; it is not used as an isolated commit acceptance result. Those unrelated edits/tests were not staged.

The six unchanged HEAD failures are in existing explanation availability, status shape, Cloud Run idempotency, malformed JSON, legacy analysis validation and risk-adapter configuration tests. They are not hidden or changed by frontend test updates.

Evidence: [baseline](evidence/frontend/isolated-head-regression.txt), [candidate](evidence/frontend/isolated-frontend-regression.txt), [browser](evidence/frontend/isolated-frontend-browser.txt), [scope audit](evidence/frontend/isolation-audit.json).

No deployment or cloud operation occurred. Git commit/push is separate from product or production acceptance.
