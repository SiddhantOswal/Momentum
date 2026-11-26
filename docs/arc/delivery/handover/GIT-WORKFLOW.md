# Git workflow: branches, merges, remotes, releases

The rules that keep the code safe. They follow `CLAUDE.md` section 7 and the founders' decisions; the commands are the ones used so far. When in doubt, do the safer thing and write down why.

## Branch model

| Branch | What it is | Rule |
|---|---|---|
| `v2` (`origin/v2`) | Om's branch, last commit `eb6eab9` | Never modified, rebased, merged into or pushed. Om's commits are never rewritten. |
| `main` | the product's main line | Untouched. The delivery never merges into or pushes to `main` or `v2`. |
| `v3` | the integration branch since 2026-11-26, a copy of `arc/main` (which was cut from `origin/v2` at `eb6eab9`). `arc/main` is kept on GitHub as an older copy and gets no new commits | All Arc work reaches it only by `git merge --no-ff` of a verified feature branch. Never rebased, never reset, never force-updated. Only the orchestrator merges. |
| `arc/<TICKET-ID>-<short-name>` (for example `arc/ARC-M2-05-answer-writer`) | one ticket | Cut from `v3`, or from its parent's branch when stacked. Small commits, test first. Fixes after QA go on the same branch as new commits. |
| `arc/ARC-SETUP-<NN>-<name>` | process, record and tooling changes (packets, STATUS, runbooks, scripts) | Same rules; merged the same way. |
| `worktree-agent-*` | leftovers of subagent worktrees | Ignore; delete only after the work they held is merged and recorded. |

## Commits

- One logical change per commit; subject at most 72 characters, imperative and specific ("Persist PO review state in Firestore"); no attribution trailers; no emoji; the words "Claude", "Codex" and "Copilot" are rejected in subjects.
- The hooks in `scripts/git-hooks/` run on every commit and CI repeats the check. Never use `--no-verify`, `-n` or change `core.hooksPath`. A commit rejected by a hook did not happen: fix the cause and make a new commit. Never amend to get around a failure.
- Never commit: secrets, `.env` files, `docs/arc/reference/`, `node_modules`, build output, scratch logs.
- Existing assertions are never weakened to make a test pass. A planned change to one goes in its own commit with the reason in the message body.

## Worktrees

- One worktree per session, under `../momentum-wt/` next to the repository (`tools/orchestrator/new-worktree.sh`). Never two sessions in one worktree. A branch can be checked out in only one worktree at a time.
- Remove a worktree only when `git status` is clean and its merge is recorded in STATUS (`git worktree remove <path>`). Never remove one with uncommitted files; copy them to `../momentum-backups/` first if in doubt.
- Do not switch the main checkout's branch while a build or test run is using it. The main checkout stays on `v3`.

## Merging a ticket

1. The branch is verified: suites green (twice at once), the commit check passes, QA done where the ticket is in tier A, findings fixed or carried to a named ticket.
2. If the branch was stacked or `v3` has moved: in the ticket's own worktree run `git rebase v3` (allowed only on an unmerged ticket branch that no other session uses; resolve conflicts, rerun the suite).
3. In the main checkout on `v3`: `git merge --no-ff <branch> -m "Merge <TICKET>: <what it does>"` (subject at most 72 characters).
4. Run `npm test` and `node scripts/quality/check.mjs commits` on `v3`. If it fails, find the interaction before doing anything else. If the merge must come out, use `git revert -m 1 <merge>` (a new commit; `git reset --hard` is denied) and record why. Never fix a failure on `v3` quietly: open a ticket branch.
5. Record: STATUS (merge hash, QA verdict, counts, NOT RUN), the queue, the decision log. Then refresh the backup bundle.

Never delete a branch that is not merged. After a merge is recorded in STATUS a ticket branch may stay; branches are cheap and are the audit trail.

## Remotes and pushing

- On the first laptop `origin` is the public GitHub repository; on a second laptop cloned from the handover bundle `origin` is the bundle file. In both cases **never push `arc/*` to `origin`**: the delivery records include security findings and design detail that must not be public, and a push to a file path reaches nothing. Do not add the public URL as a writable remote on the second laptop. To read Om's newer commits there, add a fetch-only remote: `git remote add upstream https://github.com/SiddhantOswal/Momentum.git` then `git remote set-url --push upstream no-push`, and `git fetch upstream v2`.
- **Backup remote.** When the founders create an empty private repository, add it as `backup` and push after each merge session and at each gate: `git push backup v3` and `git push backup 'refs/heads/arc/*:refs/heads/arc/*'`, then tags (`git push backup --tags`). Never `--force`. Record each push in STATUS. Until then the backup is the git bundle (`git bundle create <dir>/arc-<date>.bundle --branches='arc/*'`, verified with `git bundle verify`) after each merge session and gate.
- If Om has pushed new commits to `v2` since `eb6eab9`, bring them in with a merge commit on `v3` (`git merge upstream/v2`), never a rebase; resolve conflicts, rerun everything, record it. Never push anything to `v2`.

## Release candidate and the product line

- At the release candidate (30 November 2026, after the ARC-M8-05 release gate) create an annotated tag on the exact `v3` commit that was verified: `git tag -a arc-rc-<YYYYMMDD> -m "<suite counts, gate verdict, revision>"`. The scripted deploy (ARC-M8-01) builds the image from that tag, and the Cloud Run revision records the commit. Deploy with `--no-traffic` first.
- After the finals, Phase B (M9 to M14) continues on `v3` the same way.

## If something goes wrong

`git reflog` and the backup bundles hold every state. Do not run destructive commands (`reset --hard`, `clean -f`, `checkout .`, `branch -D`, `rm -rf` on a repository path) to make a problem disappear. Stash with `-u` or commit to a branch first, then investigate. Unknown branches, files or worktrees may be someone's work in progress: find out before touching them.
