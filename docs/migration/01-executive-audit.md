# 01 Executive audit

Audited 2026-11-26T08:04Z. Status: **partial but decision-ready.** Complete for pushed refs; blocked on unpublished work, live cloud verification and confirmation of the design export.

## Key findings
1. **Base = `origin/arc/main` @ `cb1338f6ce898dfa23493484e73c4ac8d95c07ab`.** History is linear: `dev` → `main` → `v2` → `arc/main`. It contains all other pushed branches except two test-infra commits on `arc/ARC-M1-16-stale-fixtures` (merge-tree clean, not a UI prerequisite). No consolidation branch needed.
2. **Frontend restart is cheap; backend restart is not.** `web/` is about 1,460 lines and does not follow the approved navigation (rail with Floor/Lots/Defects/Impact/Models vs 232px sidebar with 7 items). The backend (Arc, Firestore state, safety, 130 test entries) passes `npm test` 1107 of 1108 (1 cancelled: known flaky weather test). Recommendation for "start from scratch": restart `web/` only (PD-11).
3. **Someone else is already doing this work.** The repo's own plan (M6 tickets, `external/queue.md` lane 1) assigns the same screens to other sessions, and in-flight work sits in unpublished worktrees. Two parallel migrations will collide (DR-022, DR-023). This is the top risk.
4. **The React app is not deployed.** The Dockerfile never builds `web/`; the live product is the legacy page (DR-018).
5. **Arc is a backend with a disconnected panel.** Typed answers are not wired; evals and every live cloud path are NOT RUN; M1 protections are off on the live revision (DR-014 to DR-017).
6. **Design gaps and stale figures.** 17 undesigned states (G1 to G17); 15 screens carry superseded October figures awaiting Om (DR-019, DR-024).
7. **Timeline.** Release candidate 2026-11-30, pitch 2026-12-04. Full 30-screen fidelity plus Arc plus live verification in that window is unlikely. P0 subset defined in `08`.

## Coverage
- Branches inspected: 5 remote (`dev`, `main`, `v2`, `arc/main`, `arc/ARC-M1-16-stale-fixtures`) + the session branch. PRs: none exist.
- Design: 30 screens, 60 theme files, 14 implementation units. Light and dark text identical on all 30.
- Capabilities: 22 UI/backend rows (`04`), 16 cross-branch rows (`02c`), 38 discrepancies (`05`).
- Frontend: legacy UI plus React; backend: about 60 routes; Arc: 15 tools.

## Discrepancy counts (`05`)
Severity: critical 2, high 14, medium 17, low 5 (accepted-by-plan items included). Rows by class (a row may carry several): D01 7, D28 4, D20 4, D22 3, D15 3, D10 3, D26 3, D02/D05/D06/D11/D12/D16/D21/D23/D25 2 each, others 1.

## Principal risks
Lane collision; unpublished work; four days; no live evidence; Om sign-off; design gaps; shared Gemini daily cap.

## Confidence and limitations
High on base choice. Medium on plan. Not verified: gcloud (no credentials), Playwright browser suite, other branches' tests, dependency advisories, contributor-local work, whether the committed design equals your 61-screen export. See `02a-branch-snapshot.json` evidenceLimitations.

## Decisions needed first
PD-01, PD-02, PD-08, PD-11 (`11-product-decisions.md`).
