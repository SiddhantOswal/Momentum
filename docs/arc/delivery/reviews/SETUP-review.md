# Review gate: ARC-SETUP-01 and the M0 records

Date: 2026-11-23. Branch `arc/setup` (cut from `origin/v2` at `eb6eab9`, no upstream). Scope as the founders asked: a short gate on this change, with four reviewers. Each reviewer was independent of the work, and none graded its own changes.

## Reviewers and verdicts

| Reviewer | First verdict | Blocking findings | Resolution | Re-check |
|---|---|---|---|---|
| Code reviewer | CONDITIONAL GO | 1. Docs claimed "the hooks cannot be skipped"; several bypasses remain (`git commit -an`, a trailing `-n`, abbreviated `--no-verify`, `git config --unset` or `--local`, git config environment variables) | `00-plan.md` section 0 and ARC-SETUP-01 now say the common bypasses are denied and CI is the real gate. More denies are a founder decision (STATUS) | Wording checked by the delivery lead |
| Security reviewer | CONDITIONAL GO | B1. A gcloud account email appeared in `data/PKBX0041-m2-rerun.md`. B2. `.claude/settings.json` auto-allows `bq query`, which can run DDL and DML | B1 fixed: the email is replaced, and a grep of all 249 files finds no email address. B2 is a permission change proposed by a reviewer, so it goes to the founders (STATUS) | B1 re-checked by the compliance reviewer and with grep |
| Compliance reviewer | CONDITIONAL GO | 1. ARC-M0-04 asked Om to sign off the superseded 24.5 °C figures. 2. `00-plan.md` gave the 24.5 °C run as the m2 result | Both now give 7.3% / 42.0% RH / 18.5 °C, 62.9 to 55.1 kg, 7.8 kg and ₹421, with the job ID. The superseded sections in `PKBX0041-m2-rerun.md` and `stale-claims.md` are marked | Grep for 24.5, 61.9 and ₹437 in the plan, STATUS and tickets: only lines marked superseded or history remain |
| Verification auditor | CONDITIONAL GO | 1. The plan said "done" while the gate was open. 2. "Byte for byte" could not be re-checked after the deletion. 3. Re-check the edited files | 1. Now "built, in review". 2. A SHA-256 list of all 126 files is in `changes/2026-11-23-ui-zip-deletion.md`. 3. Re-checked after the last edit | 126 of 126 checksums identical (`cmp`) |

## Fixes made during the gate

- Code reviewer findings 5 to 7, fixed by the backend engineer, the original owner:
  - merge commits are now checked;
  - a bad range prints NOT CHECKED and exits 1;
  - new tests cover the rev-parse argument, an empty merge-base, and a CLI run in a temp repo with no `origin/v2`.
- Tests: `node --test test/quality-rules.test.js` gives 17 of 17 passing (it was 15 before these fixes). `node scripts/quality/check.mjs commits` reports 0 commits checked from `eb6eab9` and exits 0.
- The verification auditor checked the PKBX0041 job read-only against BigQuery. The stored parameters and results match the doc, the baseline minus the best gives 7.8 kg and ₹421, and 100 MiB was billed in total.

## Open, not blocking this commit

- ARC-SETUP-02 (a condition for the M1 gate): a shared CI range path, install-hooks output, diff path parsing, pinned action SHAs with `persist-credentials: false`, CODEOWNERS on `scripts/quality/**`, and rewording public docs that map live exposure.
- A founder decision on settings hardening: security B2 and N1 to N3, plus code reviewer finding 1. The options are in STATUS.
- Not edited, as instructed: README, `DEMO_LOT` and the design files (ARC-M6-09, ARC-M6-19). Compliance finding 8, a placeholder note in the design README, waits for ARC-M6-19.
- Not run in this gate: QA lead test verification, AI evals, responsible-AI review and copy edit. The founders scoped them out of this short gate. They run at the M0 gate (ARC-M0-03).

## Verdict

**CONDITIONAL GO** for committing on `arc/setup`. The conditions are ARC-SETUP-02 and the settings decision, both before the M1 gate. Nothing is merged to `arc/main` and nothing is pushed.
