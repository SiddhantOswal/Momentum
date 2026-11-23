# M0 audit and plan

Most M0 work is written (see `00-plan.md` section 1). These tickets are what remains before M1 starts.

### ARC-SETUP-01 Setup safeguards (P0, built 2026-11-23 on `arc/setup`, in review)
- Goal: the commit-message check covers only commits that are not in `origin/v2`, the common ways of skipping the git hooks are denied (CI re-checks every commit not in `origin/v2`, so a local bypass is still caught before merge), and the duplicate UI zip is removed.
- AC: `check.mjs commits` with no RANGE checks `merge-base(origin/v2, HEAD)..HEAD` and fails if `origin/v2` is missing. CI uses the same range on push and on PR. `.claude/settings.json` denies `git commit -n*`, `git commit *-n *`, `git -c core.hooksPath*` and `git config core.hooksPath*`. `docs/Momentum_UI_Source.zip` is deleted after a byte-for-byte diff against `docs/arc/design/source/`.
- Depends on: nothing. Owner: backend engineer (check); delivery lead (settings, zip).
- Test plan: `node --test test/quality-rules.test.js` gives 15 of 15. `check.mjs commits` gives 0 commits checked from `eb6eab9`. An explicit range over Om's last 3 commits exits 1, which shows that the default range is what keeps them out. The code reviewer ran the missing-`origin/v2` path in a scratch repo: exit 1 with "NOT CHECKED: origin/v2 is not available". Known gaps: the settings denies do not catch combined short flags (`-an`), a trailing `-n`, abbreviated `--no-verify`, `git config --unset` or `--local`, or git config environment variables. These are listed for a founder decision in STATUS.

### ARC-SETUP-02 Safeguard follow-ups from the setup gate (P1, condition for the M1 gate)
- Goal: close the non-blocking findings from the ARC-SETUP-01 gate.
  - Code reviewer 4: CI and local runs share one tested range path (`commits --head`).
  - Code reviewer 8: `install-hooks.sh` uses `set -e`, prints its result and is documented.
  - Code reviewer 9: diff paths with tabs or quotes are parsed correctly.
  - Security N4: pin the GitHub actions by commit SHA and set `persist-credentials: false`. Add CODEOWNERS review on `scripts/quality/**`.
  - Security N5: reword public docs that map live exposure (sign-in off, public invoker, unused roles) until M11 closes it. Done in the M0 gate repair by each doc owner; re-checked by the security reviewer.
  - QA lead S3 and S4 (M0 gate): add a `+++` diff-header guard case, and one positive and one negative fixture for every phrase and secret rule, so that deleting any single rule fails a test.
  - Code reviewer nit (M0 gate): `check.mjs commits` rejects a RANGE that starts with `-`, and a test covers merge commits being checked.
- AC: QA S3 and S4 are fixed, not waived: deleting any single phrase or secret rule fails a test, shown by a recorded mutation run in the PR. Each other finding is fixed or explicitly accepted in the M1 review file.
- Depends on: ARC-SETUP-01. Owner: backend engineer (scripts, CI); delivery lead (docs).
- Test plan: `node --test test/quality-rules.test.js`; a CI run on the PR.

Settings-file hardening (security B2 and N1 to N3, code reviewer 1) was decided by the founders on 2026-11-23 (option a) and applied, so it is not part of this ticket.

### ARC-M0-01 Founder approval of the plan (P0)
- Goal: founders approve `00-plan.md` and answer the open questions in its section 7.
- AC: each question has a recorded answer in the STATUS decision log with date and name.
- Depends on: nothing. Owner: delivery lead.
- Test plan: none (decision record). The verification auditor checks that the log entries match the answers given.

### ARC-M0-02 Create `arc/main` and commit the M0 records (P0)
- Goal: an integration branch cut from `origin/v2` holding the charter, agents, quality tooling and delivery docs.
- AC: `arc/main` is cut from `origin/v2` at `eb6eab9` or its current tip. One commit per logical change: charter and agents; quality tooling (`scripts/quality/`, `scripts/git-hooks/`, `.github/workflows/quality.yml`, `test/quality-rules.test.js`); delivery docs; `.gitignore`. `git ls-files docs/arc/reference` and `git ls-files docs/Momentum_UI_Source.zip` are empty. `v2` is not changed.
- Depends on: M0-01. Owner: release manager.
- Test plan: `node --test test/quality-rules.test.js`; `node scripts/quality/check.mjs` over the staged diff; `git log origin/v2..arc/main` reviewed.

### ARC-M0-03 M0 review gate (P0)
- Goal: run the charter gate over the M0 documents.
- AC: `reviews/M0-review.md` with the copy editor, compliance reviewer and verification auditor results and a verdict. The code and security reviews are N/A because no code changed. Evals are NOT RUN because no suites exist.
- Depends on: M0-02. Owner: delivery lead (runs `/review-gate`).
- Test plan: the reviewers' own checks.

### ARC-M0-04 Om's domain sign-offs (P0, needed by M3)
- Goal: Om reviews the plant-realism assumptions.
- AC: a written answer on each of these. (1) The PKBX0041 final reference: 7.3% moisture, 42.0% RH, 18.5 °C; 62.9 to 55.1 kg, a reduction of 7.8 kg and ₹421; job `arc_pkbx0041_m2_t19_rh420_t185_20261122T212952Z` (`data/PKBX0041-m2-rerun.md`, "Final reference"), and whether 18.5 °C with 42% RH is a realistic winter day at the plant. (2) Whether Pune outdoor weather is a fair stand-in for plant ambient (`data/data-audit.md` P1). (3) The 7.3% moisture default against the November modeled median of 8.72%. (4) The model-score headline (spec Q11).
- Depends on: nothing. Owner: delivery lead to ask; Om to answer.
- Test plan: none (sign-off record in `data/`).

### ARC-M0-06 Amend O10 for decision A3 (P0)
- Goal: the product manager and business analyst amend outcome O10 in `01-business-requirements.md` and `02-product-spec.md` so that a typed data question may use 2 attempts (router plus answer writer), and record A6 once the founders answer it.
- AC: O10 and AC2.5 match `05-ai-design.md` section 3. The change is noted in the STATUS decision log.
- Depends on: M0-01. Owner: product manager.
- Test plan: none (doc change). The verification auditor checks it at the M0 gate.

### ARC-M0-05 Recover the lot generator (P1)
- Goal: put the generator that produced `prepagent.lots` back where it can be reproduced (CLAUDE.md section 6).
- AC: `generator.ts` (seed 20261010) from `sid_pack.zip` is found and stored in the repo under `tools/data/` with a README naming its seed and assumptions. If it cannot be found, the gap is recorded as BLOCKED in STATUS and the data docs.
- Depends on: a founder pointing to the file. Owner: data engineer.
- Test plan: a dry-run reproduction on a 50-lot sample compared with the stored distributions. No writes to existing tables.
