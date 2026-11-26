---
name: momentum-sync
description: Compare remote branches with the audited snapshot and report incoming changes that affect the UI migration. Read-only unless an integration is authorised.
allowed-tools: Bash(docs/migration/tools/revalidate.sh*) Bash(git fetch origin --no-prune) Bash(git log*) Bash(git diff*) Bash(git merge-tree*) Read Edit
---
1. `docs/migration/tools/revalidate.sh`. It fetches without pruning and compares every branch with `docs/migration/02a-branch-snapshot.json`.
2. For each moved branch, read the commit list and the file stat it prints. Judge each range by purpose, not by recency: new or changed routes, schemas, Firestore documents, config flags, dependencies, `docs/arc/design/**`, and `web/**`.
3. For a range that touches `web/`, `index.mjs`, `src/schemas.js`, `src/state-schemas.js`, `config/` or `docs/arc/delivery/06-arc-wire-contract.md`, run `git merge-tree --write-tree <migration branch> <incoming tip>` to see whether it merges cleanly, and name the completed units it could affect in `docs/migration/progress.json`.
4. Add or update rows in `docs/migration/02d-incoming-change-register.csv` (range, capability, disposition, dependencies, conflict risk, verification).
5. Recommend merge now, merge before unit X, defer, or exclude, with the regression checks each needs.

Do not merge, rebase, cherry-pick or push. A new remote commit is not automatically right for the migration branch.
