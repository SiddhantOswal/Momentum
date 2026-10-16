# Repository hygiene and local reproducibility review

Date: 16 October 2026. Owner authorized committing the latest product source and synchronizing the existing **private** GitHub repository's `main` branch. No force-push, history rewrite, GCP deployment, resource/IAM/budget mutation or public release is part of this operation.

## Preserved state

Protected baseline `936b86893330057c32958aaae1e1733b40a8bb97`, prior UX `7509266ed70202e4eaf83aab56734a5502ccb3be` and premium presentation `a689c99b43c59804548befc7a93f484f23cefc14` remain in history. Before cleanup, all Git refs were saved in an external Git bundle and all 542 modified/untracked files in a separate external archive with a hash inventory. No worktree file was destructively cleaned or reset.

Repository visibility was checked through GitHub's API: private, default branch main, owner identity has push permission. The remote was fetched; it had no divergent commits. Main publication will use ordinary fast-forward history and a normal push, never a force update.

## Inventory decisions

| Material | Disposition | Reason |
|---|---|---|
| `index.mjs`, all application `src/` and served `public/` modules | Keep | Existing routes, business rules, UI and adapters; not redesigned during cleanup |
| Current empty Impact state | Commit | Owner-requested labels/placeholders, no dummy numbers; no autoquery or hidden mock fallback |
| Production package/lockfile, pinned Dockerfile | Keep | Required reproducible dependency/runtime configuration |
| `config/` approved runtime contracts | Keep | Model, fixture, bucket and provider configuration; no keys |
| Previously untracked feature-importance observation | Commit | `test/model-acceptance.test.js` reads it; otherwise a fresh clone lacks a required fixture. Status remains observed-for-review / incomplete acceptance |
| Six proposed evaluation SQL files | Commit as proposals | Referenced by the D4 alternative runbook; contain SQL, not returned dataset rows. Not executed or automatically applied |
| Canonical SQL and existing optional training/evaluation scripts | Keep | Runtime contracts and approved provenance; startup does not train/evaluate models |
| `tables.sql` | Keep with explicit historical warning | Existing schema provenance; not a complete current cloud setup or an automatic migration |
| PDF fonts and font licenses (~37 MiB) | Keep | Directly referenced by `src/job-sheet-pdf.js`; removal would break existing supported renderer behavior |
| Approved PO fixtures in public and test locations | Keep | Served fixture downloads/allowlists and independent test fixture paths both use them. No arbitrary raw manufacturing dataset added |
| Existing regression tests and helper fixtures | Keep | Meaningful contract/security coverage; no assertion weakened or test deleted |
| Cloud/admin tools and their separate lockfile | Keep | Opt-in bounded maintenance functions; install optional tools separately |
| Current decisions/runbooks/audit history | Keep, index | Relevant security, manufacturing, evidence and authorization history; not runtime code. Historical claims retain their dates |
| 22 old generated logs/screenshots under `docs/evidence/frontend` | Remove from Git index; preserve locally | Repeated test output is not needed to run/build/understand the current product; earlier history and external backup remain |
| 32 report-linked screenshots | Keep curated | Explicit current before/after and empty-state review evidence; not all intermediate captures |
| Raw API/IAM/billing/model journals, unreviewed snapshots, reference images and intermediate captures | Ignore; preserve locally | Avoid private payload publication, third-party image redistribution, redundant artifacts and developer paths |
| `.env`, credentials, node_modules, reports, logs and build output | Ignore | Machine-specific, sensitive or reproducible generated output |

Cleanup does not shrink past Git history, erase earlier failures or delete the owner's evidence. No production feature or dataset was removed to reduce file count.

## Portability repairs

- Added `.nvmrc` (Node 22), disabled `.env.example`, a useful root README, local development guide and documentation index.
- Added `npm run preview:local`, which explicitly disables mock and paid cloud adapters. The default visible Impact layout contains em dashes and chart placeholders, not illustrative business values.
- Kept `npm run demo:local` as a separately invoked, visibly labeled offline backup; it is not the ordinary real-data preview.
- Cloud acceptance utilities use `GCLOUD_BIN` or `gcloud` on PATH rather than a developer's absolute home-directory path.
- Playwright writes to ignored relative `test-results/` and uses its installed Chromium unless `PLAYWRIGHT_CHANNEL` explicitly selects another installed browser.
- Removed an unnecessary browser-test write to a hardcoded `/private/tmp` PDF path. The original PDF assertions and Playwright PDF attachment remain intact.
- Added narrow ignore rules with an explicit curated-evidence exception list. No `git add .` / `git add -A` was used.

## Cloud prerequisites and limits

A clone can install and run the local interface without credentials. It cannot inherit Google Cloud IAM or Cloud Run workload identity. Current REST adapters obtain tokens from the Cloud Run metadata service, not laptop ADC. The official authenticated `gcloud run services proxy` was checked: HTML GET succeeded, but localhost-origin session POST returned 403 `ORIGIN_REQUIRED`. The local guide documents that limit instead of claiming the proxy completes privileged login or weakening origin protections.

D4 still blocks model-enabled preparation/approval acceptance. The current local source is newer than deployed `prepagent-premium-analytics-v2`; GitHub publication does not deploy it. No full cloud workflow or general factory readiness is asserted.

## Verification record

Repository/source inspection, relative dependency completeness, secret-sensitive staging review, JavaScript syntax, JSON parsing, diff validation and a fresh-checkout installation/startup smoke check are the intended checks. Broad local unit/acceptance/browser suites are not rerun under the owner's existing instruction. The verification results are appended below before the final publication commit.


### Completed fresh-clone verification

Independent clean clone of `e84b32af45792d06ba477b55ebd03f47e4ea52af`, without the original workspace's ignored/untracked files:

- Node **22.17.1**, npm **10.9.2**.
- `npm ci`: success, 204 packages installed, zero reported vulnerabilities; lockfile unchanged.
- **16/16** narrow installation/startup smoke checks passed: health, actual served UI/assets, no mock execution, visible empty layout, hidden unloaded metrics, unavailable Impact 503 without fabricated KPIs, missing-fixture repair, six proposed SQL files, no distributed private `.env`/`env.sh`, JSON validity, syntax and clean checkout state.
- **22 tracked JSON files** parsed; **seven changed JavaScript/config files** passed syntax checking in the independent clone.
- Literal relative source/test dependencies all resolve within the staged repository, including the previously missing feature observation.
- Current index review covered **309 tracked files**. Bounded credential/token/private-key pattern checks and sensitive-path checks reported no findings. The unpublished text history was also checked. This is not a guarantee that every conceivable secret format can be detected.
- `git diff --check`: passed. No full historical unit, acceptance or browser suites rerun, and no Google model/query/write was needed for these startup checks.

The subsequent verification-record commit changes documentation/evidence summary only, not the smoke-checked runtime. See `docs/evidence/REVIEWED_RELEASE_SUMMARY.json` for machine-readable checks. Publication targets the existing private remote's `main`; the final synchronized SHA is reported in the handoff after the remote is checked.
