# Sync and publish: commit everything, keep `arc/main` complete, push to the one repository

Use this when the founders ask for "everything committed and pushed" (before travelling, before handing the work to another person or laptop, or at the end of a day). It is a procedure and a paste-ready prompt. It works for Claude Code and for Codex.

## The rules

- **One repository.** The founders keep a single repository: `origin` (`github.com/SiddhantOswal/Momentum`), which is **public**. There is no second repository. Know what that means: everything pushed there can be read by anyone, including judges and competitors. `arc/main` already holds the delivery records (reviews with security findings, STATUS, the live-setup inventory) and was pushed on 2026-11-24 by the founders' decision (STATUS decision log, 2026-11-25). It holds no secret and no private reference material; keep it that way (the scan below).
- **What is pushed:** `arc/main` and any named unmerged work branch the founders want shared. Not the roughly 100 merged feature branches (their commits are in `arc/main`), not `worktree-agent-*`, not scratch branches. **`pitch/*` is not pushed** until the founders confirm in writing, because it holds competitive positioning and rehearsed answers.
- **What is never pushed or touched:** `main` and `v2` (Om's lines); never `--force` or `--force-with-lease`; never anything under `docs/arc/reference/`; never a secret, token, key or `.env`; never `--no-verify`.
- **What goes into `arc/main`:** only verified work. A Tier B branch (UI, copy, docs, test-only) needs the orchestrator's own checks; a Tier A branch needs an independent QA first. A branch that deletes or weakens existing tests is Tier A whatever its ticket says. Unverified work stays on its feature branch, committed and pushed there if the founders want it shared, and is reported as not merged.

## The procedure

1. **Inventory.** `bash tools/orchestrator/resume.sh` and `node tools/orchestrator/ticket-status.mjs`. For every worktree with uncommitted files, read what the files are: a builder's work (look for `commit-plan.json`), a person's work, or scratch. Never delete or overwrite any of it.
2. **Commit what is real, where it belongs.** Uncommitted work goes onto its own feature branch in small commits with accurate subjects (at most 72 characters, no attribution, none of the words Claude, Codex or Copilot; the hooks run). If a builder left `commit-plan.json`, apply it with `node tools/apply-commit-plan.mjs commit-plan.json <worktree>`. If the sandbox cannot write to git, write the plan and have a full-access session apply it. Do not commit scratch, logs, `node_modules`, `commit-plan.json` itself or anything private.
3. **Verify each unmerged branch** before merging it into `arc/main`: if its base is old, put its own commits on top of the current `arc/main` (`git cherry-pick`, or a rebase of an unmerged branch nobody else uses); run `npm test`, `npm --prefix web run build` and `PLAYWRIGHT_CHANNEL=chrome npm run test:ui` for `web/` work, and `node scripts/quality/check.mjs commits`; read the diff for removed assertions and for anything outside the ticket; break the most important rule on purpose and see a test fail, then restore.
4. **Merge** verified branches with `git merge --no-ff <branch> -m "Merge <TICKET>: <what it does>"` into `arc/main`; run `npm test` and the commit check on `arc/main`; update `STATUS.md` (Done, the decision log) and `external/queue.md` on a branch and merge it.
5. **Scan before any push:** no secret-like string in the tree (`git grep -nIE 'AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----|ya29\.[0-9A-Za-z_-]{20,}' arc/main -- . ':!tools/prepare-release-snapshot.py' ':!test' ':!docs/arc/delivery/handover'` prints nothing), `git ls-files docs/arc/reference` prints nothing, and `git diff --stat origin/arc/main..arc/main` shows only what you expect.
6. **Push, never forced.** `git push origin arc/main` (a fast-forward; if it is rejected, `git fetch origin`, merge `origin/arc/main` into `arc/main` with a merge commit, rerun the checks, push again) and `git push origin <branch>` for each named unmerged work branch. Verify: `git ls-remote origin refs/heads/arc/main` shows the same commit as `git rev-parse arc/main`.
7. **Refresh the backup and the handover zip** from the `arc/main` checkout: `bash tools/orchestrator/build-handover-zip.sh <output-folder>` (it includes every local branch, so the unpushed `pitch/*` branches travel in the zip, not on GitHub).
8. **Report** in under 200 words: what was committed and where, what merged into `arc/main` and what did not (and why), the commit now on `origin/arc/main`, which branches were pushed, which work is local only, and the zip path.

## Paste-ready prompt

```
Sync and publish the Arc by Momentum work. Work in /Users/siddhant/Developer/Momentum. Read CLAUDE.md, then docs/arc/delivery/handover/SYNC-AND-PUBLISH.md and docs/arc/delivery/handover/GIT-WORKFLOW.md completely, and follow SYNC-AND-PUBLISH.md exactly, step by step.

The goal: every change in every worktree is committed on the right branch; arc/main holds all verified work; arc/main and the branches named below are pushed to origin (the single, public repository) with a normal push; the handover zip is rebuilt. The founders decided on one repository, so do not create or use another remote.

Hard limits: never push main or v2; never use --force or --force-with-lease; never push pitch/* (the founders have not confirmed it); never push anything under docs/arc/reference/, a secret, a key or an .env file; never bypass a hook; do not delete or overwrite anyone's uncommitted work; do not merge an unverified branch, and never merge a branch that deletes or weakens tests without an independent QA. Run the secret scan in step 5 before pushing and stop if it prints anything.

Branches to push besides arc/main: <list the unmerged work branches the founders want shared, for example arc/ARC-M1-16-stale-fixtures>.

Report as step 8 says. If something blocks you after three attempts, write BLOCKED with the reason and continue with the rest.
```
