# Review: landing page, sign-in page and app gate (`feat/landing-login`)

Date: 2026-11-28. Base: `v3` at `c4778f8`.

## Scope

New `site/` source and built `public/site/` pages, `src/admin-login.js`, routes in `index.mjs` (`/`, `/login`, `POST /api/auth/admin-login`, the `/app/` gate, sign-in check on `POST /api/auth/demo-session`), tests, STATUS row.

## Results

| Gate | Result |
|---|---|
| Code review | Findings fixed: gate bypass through `/app/index.html`, unused font dependencies, error copy. |
| Test verification | `npm test`: 1313 tests, 1311 pass, 0 fail, 2 skipped. Baseline on `v3`: 1303 tests, 1301 pass, 0 fail, 2 skipped. Ten new tests; the stale-build test fails if `site/` changes without a rebuild. |
| Security | Real findings fixed: `/app/index.html` skipped the gate; `demo-session` issued sessions without sign-in. Both now return a redirect or 401, with tests. Admin sessions last 4 hours; the hash cost is validated. |
| AI safety and evals | No model call or prompt changed. Eval suites not re-run: NOT RUN, not affected. |
| Compliance | Copy corrected to match the product: no solver named, 10 MB limit, no named approver, real lever names, generic customer, moisture described as operator entry. Third-party notices added. |
| Verification audit | Test counts, changed-file list, built-page match, no credential and no attribution verified. The one condition (uncommitted edits) is closed by this commit set. |

## Open conditions

- `site/src/model/m01.glb`: origin undocumented. Founders to confirm it is theirs or licensed before the repository goes public.
- Landing copy about the Insights and Maintenance pages not checked against the live app screens.
- Link URLs (video, blog, team profiles) and Firebase keys are empty; the Google sign-in path is untested.
- The gate is active only when a sign-in method is configured.
- The admin password works only while Google sessions are off.
- The failed-attempt limiter is per instance. No content security policy on the new pages.
- Click smoothness on a real GPU is not measured.

## Verdict

CONDITIONAL GO for merging into `v3`. Deploying is a separate step.
